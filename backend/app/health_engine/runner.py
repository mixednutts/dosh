"""Budget Health Engine runner.

Orchestrates the evaluation of budget health by:
1. Loading the budget's active health matrix
2. Executing metric scoring logic directly by metric key
3. Aggregating overall scores and momentum
4. Persisting period snapshots when requested
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from .metric_executors import get_executor
from .system_metrics import get_system_metric

if TYPE_CHECKING:
    from ..models import Budget, FinancialPeriod


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

    for item in items:
        metric_def = get_system_metric(item.metric_key)
        if not metric_def:
            continue

        try:
            parameters = json.loads(item.health_metric_parameters or "{}")
        except Exception:
            parameters = {}

        executor = get_executor(item.metric_key)
        metric_result = executor(
            db=db,
            budget=budget,
            period=period,
            parameters=parameters,
            scoring_sensitivity=item.scoring_sensitivity,
            tone=tone,
        )

        results.append({
            "metric_key": item.metric_key,
            "name": metric_def["name"],
            "scope": metric_def["scope"],
            "weight": float(item.weight),
            "score": metric_result["score"],
            "status": metric_result["status"],
            "summary": metric_result["summary"],
            "evidence": metric_result["evidence"],
        })

    return results


def evaluate_budget_health(
    db: Session,
    budgetid: int,
) -> dict | None:
    """Evaluate overall budget health using the active health matrix.

    Returns a payload similar to the legacy BudgetHealthOut schema.
    """
    from ..models import Budget, BudgetHealthMatrix, BudgetHealthMatrixItem, FinancialPeriod
    from ..cycle_constants import CLOSED

    budget = db.get(Budget, budgetid)
    if not budget:
        return None

    matrix = db.query(BudgetHealthMatrix).filter_by(budgetid=budgetid, is_active=True).first()
    if not matrix:
        return None

    # An empty matrix (no items) should behave as if no matrix exists
    has_items = db.query(BudgetHealthMatrixItem).filter_by(matrix_id=matrix.matrix_id).first()
    if not has_items:
        return None

    now = datetime.now(timezone.utc)

    # Resolve current period (exclude already-closed periods)
    current_period = db.query(FinancialPeriod).filter(
        FinancialPeriod.budgetid == budgetid,
        FinancialPeriod.startdate <= now,
        FinancialPeriod.enddate >= now,
        FinancialPeriod.cycle_status != CLOSED,
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
        })

    # Current period check (for legacy compatibility)
    current_period_check = None
    if current_metrics:
        current_period_check = {
            "score": int(sum(r["score"] * r["weight"] for r in current_metrics) / sum(r["weight"] for r in current_metrics)) if current_metrics else 50,
            "status": _health_status(int(sum(r["score"] * r["weight"] for r in current_metrics) / sum(r["weight"] for r in current_metrics))) if current_metrics else "Watch",
            "summary": current_metrics[0]["summary"] if current_metrics else "Current period evaluation complete.",
            "evidence": [
                {
                    "label": m["name"],
                    "value": str(m["score"]),
                }
                for m in current_metrics
            ],
        }

    return {
        "version": "engine-v1",
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
            metric_key=result["metric_key"],
            evaluated_at=datetime.now(timezone.utc),
            score=result["score"],
            status=result["status"],
            summary=result["summary"],
            evidence_json=json.dumps(result["evidence"]),
            is_snapshot=True,
        ))

    db.flush()
