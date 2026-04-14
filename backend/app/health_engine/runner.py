"""Budget Health Engine runner.

Orchestrates the evaluation of budget health by:
1. Loading the budget's active health matrix
2. Resolving and executing data sources
3. Evaluating metric formulas
4. Executing metric scoring logic
5. Aggregating overall scores and momentum
6. Persisting period snapshots when requested
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from .formula_evaluator import evaluate_formula
from .metric_executors import get_executor

if TYPE_CHECKING:
    from ..models import Budget, FinancialPeriod


def _resolve_data_source(
    db: Session,
    source_key: str,
    params: dict[str, int],
    cache: dict[str, Decimal],
) -> Decimal:
    """Execute a HealthDataSource and cache the result per request."""
    cache_key = f"{source_key}:{json.dumps(params, sort_keys=True)}"
    if cache_key in cache:
        return cache[cache_key]

    from ..models import HealthDataSource

    ds = db.query(HealthDataSource).filter_by(source_key=source_key).first()
    if not ds:
        raise ValueError(f"Unknown data source: {source_key}")

    # Import and call the executor function by path
    module_path, func_name = ds.executor_path.rsplit(".", 1)
    module = __import__(module_path, fromlist=[func_name])
    func = getattr(module, func_name)

    result = func(db, **params)
    decimal_result = Decimal(str(result or 0))
    cache[cache_key] = decimal_result
    return decimal_result


def _build_data_source_params(
    metric,
    budgetid: int,
    period: FinancialPeriod | None,
) -> dict[str, dict[str, int]]:
    """Map each referenced data source to its parameter values."""
    source_keys = json.loads(metric.formula_data_sources_json or "[]")
    params_map: dict[str, dict[str, int]] = {}
    for source_key in source_keys:
        # Simple parameter resolution based on known patterns
        if source_key in {
            "total_budgeted_income",
            "total_budgeted_expenses",
            "total_actual_expenses",
            "revised_line_count",
            "live_period_surplus",
            "period_progress_ratio",
        }:
            params_map[source_key] = {"finperiodid": period.finperiodid} if period else {"finperiodid": -1}
        else:
            params_map[source_key] = {"budgetid": budgetid}
    return params_map


def _load_personalisation_value(
    db: Session,
    budgetid: int,
    metric,
) -> Decimal | None:
    """Load the effective personalisation value for a metric."""
    from ..models import BudgetMetricPersonalisation, HealthPersonalisationDefinition

    if not metric.personalisation_key:
        return None

    bmp = db.query(BudgetMetricPersonalisation).filter_by(
        budgetid=budgetid, metric_id=metric.metric_id
    ).first()

    if bmp:
        try:
            raw = json.loads(bmp.value_json)
            if raw is None:
                return None
            return Decimal(str(raw)) if isinstance(raw, (int, float, str, Decimal)) else Decimal(str(raw))
        except (json.JSONDecodeError, ValueError):
            pass

    # Fall back to definition default
    pd = db.query(HealthPersonalisationDefinition).filter_by(
        personalisation_key=metric.personalisation_key
    ).first()
    if pd:
        try:
            raw = json.loads(pd.default_value_json)
            if raw is None:
                return None
            return Decimal(str(raw)) if isinstance(raw, (int, float, str, Decimal)) else None
        except (json.JSONDecodeError, ValueError):
            return None
    return None


def evaluate_period_health(
    db: Session,
    budget: Budget,
    period: FinancialPeriod | None,
    matrix,
    tone: str | None = None,
) -> list[dict]:
    """Evaluate all enabled metrics in the matrix for a specific period.

    Returns a list of metric result dicts.
    """
    from ..models import BudgetHealthMatrixItem

    if tone is None:
        tone = budget.health_tone or "supportive"

    items = (
        db.query(BudgetHealthMatrixItem)
        .filter_by(matrix_id=matrix.matrix_id, is_enabled=True)
        .order_by(BudgetHealthMatrixItem.display_order)
        .all()
    )

    results = []
    cache: dict[str, Decimal] = {}

    for item in items:
        metric = item.metric
        if not metric:
            continue

        # Resolve data sources
        source_params_map = _build_data_source_params(metric, budget.budgetid, period)
        source_values: dict[str, Decimal] = {}
        for source_key, params in source_params_map.items():
            try:
                source_values[source_key] = _resolve_data_source(db, source_key, params, cache)
            except Exception:
                source_values[source_key] = Decimal(0)

        # Evaluate formula
        try:
            formula_result = evaluate_formula(metric.formula_expression, source_values)
        except Exception:
            formula_result = Decimal(0)

        # Load personalisation
        personalisation_value = _load_personalisation_value(db, budget.budgetid, metric)

        # Execute metric logic
        executor = get_executor(metric.template_key or "")
        metric_result = executor(
            db=db,
            budget=budget,
            period=period,
            formula_result=formula_result,
            personalisation_value=personalisation_value,
            scoring_sensitivity=item.scoring_sensitivity,
            tone=tone,
        )

        results.append({
            "metric_id": metric.metric_id,
            "name": metric.name,
            "scope": metric.scope,
            "weight": float(item.weight),
            "score": metric_result["score"],
            "status": metric_result["status"],
            "summary": metric_result["summary"],
            "evidence": metric_result["evidence"],
            "drill_down": metric_result.get("drill_down", []),
        })

    return results


def evaluate_budget_health(
    db: Session,
    budgetid: int,
) -> dict | None:
    """Evaluate overall budget health using the active health matrix.

    Returns a payload similar to the legacy BudgetHealthOut schema.
    """
    from ..models import Budget, BudgetHealthMatrix, FinancialPeriod
    from ..cycle_constants import CURRENT_STAGE, PENDING_CLOSURE_STAGE
    from datetime import datetime, timezone

    budget = db.get(Budget, budgetid)
    if not budget:
        return None

    matrix = db.query(BudgetHealthMatrix).filter_by(budgetid=budgetid, is_active=True).first()
    if not matrix:
        return None

    now = datetime.now(timezone.utc)

    # Resolve current period
    current_period = db.query(FinancialPeriod).filter(
        FinancialPeriod.budgetid == budgetid,
        FinancialPeriod.startdate <= now,
        FinancialPeriod.enddate >= now,
    ).first()

    # Evaluate metrics for current period
    period_results = evaluate_period_health(db, budget, current_period, matrix)

    # Split current-period vs overall metrics
    current_metrics = [r for r in period_results if r["scope"] == "CURRENT_PERIOD"]
    overall_metrics = [r for r in period_results if r["scope"] in ("OVERALL", "BOTH")]

    # Compute overall score from overall metrics weighted
    total_weight = sum(r["weight"] for r in overall_metrics)
    if total_weight > 0:
        overall_score = int(sum(r["score"] * r["weight"] for r in overall_metrics) / total_weight)
    else:
        overall_score = 50

    overall_score = max(0, min(100, overall_score))
    overall_status = _health_status(overall_score)

    # Compute momentum from historical closed periods
    momentum_status, momentum_delta = _compute_momentum(db, budgetid, matrix)

    # Build pillars list for legacy compatibility
    pillars = []
    for r in overall_metrics:
        pillars.append({
            "name": r["name"],
            "score": r["score"],
            "status": r["status"],
            "summary": r["summary"],
            "evidence": [{"label": e} for e in r["evidence"]],
            "drill_down": r.get("drill_down", []),
        })

    # Current period check (for legacy compatibility)
    current_period_check = None
    if current_metrics:
        current_period_check = {
            "score": int(sum(r["score"] * r["weight"] for r in current_metrics) / sum(r["weight"] for r in current_metrics)) if current_metrics else 50,
            "status": _health_status(int(sum(r["score"] * r["weight"] for r in current_metrics) / sum(r["weight"] for r in current_metrics))) if current_metrics else "Watch",
            "summary": current_metrics[0]["summary"] if current_metrics else "Current period evaluation complete.",
            "details": [
                {
                    "label": m["name"],
                    "value": str(m["score"]),
                    "status": m["status"],
                }
                for m in current_metrics
            ],
        }

    return {
        "version": "engine-phase2-v1",
        "overall_score": overall_score,
        "overall_status": overall_status,
        "pillars": pillars,
        "momentum_status": momentum_status,
        "momentum_delta": momentum_delta,
        "current_period_check": current_period_check,
        "evaluated_at": now.isoformat(),
    }


def _health_status(score: int) -> str:
    if score >= 80:
        return "Strong"
    if score >= 55:
        return "Watch"
    return "Needs Attention"


def _compute_momentum(db: Session, budgetid: int, matrix) -> tuple[str, int]:
    """Compute momentum based on historical PeriodHealthResult snapshots."""
    from ..models import PeriodHealthResult, FinancialPeriod
    from ..cycle_constants import CLOSED

    # For Phase B, use a simplified momentum based on overall score trend across last 6 closed periods
    closed_periods = (
        db.query(FinancialPeriod)
        .filter(
            FinancialPeriod.budgetid == budgetid,
            FinancialPeriod.islocked == True,
        )
        .order_by(FinancialPeriod.enddate.desc())
        .limit(6)
        .all()
    )

    if len(closed_periods) < 2:
        return ("Stable", 0)

    period_ids = [p.finperiodid for p in closed_periods]
    snapshots = (
        db.query(PeriodHealthResult)
        .filter(
            PeriodHealthResult.finperiodid.in_(period_ids),
            PeriodHealthResult.matrix_id == matrix.matrix_id,
            PeriodHealthResult.is_snapshot == True,
        )
        .all()
    )

    if not snapshots:
        return ("Stable", 0)

    # Average score per period from snapshots
    period_scores: dict[int, list[int]] = {}
    for snap in snapshots:
        period_scores.setdefault(snap.finperiodid, []).append(snap.score)

    averaged = []
    for pid in period_ids:
        scores = period_scores.get(pid, [])
        if scores:
            averaged.append(int(sum(scores) / len(scores)))

    if len(averaged) < 2:
        return ("Stable", 0)

    # Compare most recent vs average of previous
    recent = averaged[0]
    previous_avg = sum(averaged[1:]) / len(averaged[1:])
    delta = int(recent - previous_avg)

    if delta >= 5:
        return ("Improving", delta)
    if delta <= -5:
        return ("Declining", delta)
    return ("Stable", delta)


def persist_period_health_snapshot(
    db: Session,
    budget: Budget,
    period: FinancialPeriod,
    matrix,
) -> None:
    """Write PeriodHealthResult snapshot rows after closing a period."""
    from ..models import PeriodHealthResult

    tone = budget.health_tone or "supportive"
    results = evaluate_period_health(db, budget, period, matrix, tone=tone)

    for result in results:
        db.add(PeriodHealthResult(
            finperiodid=period.finperiodid,
            matrix_id=matrix.matrix_id,
            metric_id=result["metric_id"],
            evaluated_at=datetime.now(timezone.utc),
            score=result["score"],
            status=result["status"],
            summary=result["summary"],
            evidence_json=json.dumps(result["evidence"]),
            drill_down_json=json.dumps(result.get("drill_down", [])),
            is_snapshot=True,
        ))

    db.flush()
