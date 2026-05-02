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

    # Pre-compute current period composite score from CURRENT_PERIOD metrics
    # so that OVERALL metrics (like period_trend) can compare against it.
    current_period_composite_score = None
    if period is not None:
        current_period_items = [
            item for item in items
            if get_system_metric(item.metric_key) and get_system_metric(item.metric_key)["scope"] == "CURRENT_PERIOD"
        ]
        if current_period_items:
            total_weight = sum(float(item.weight) for item in current_period_items)
            weighted_score = 0.0
            for item in current_period_items:
                try:
                    parameters = json.loads(item.health_metric_parameters or "{}")
                except Exception:
                    parameters = {}
                executor = get_executor(item.metric_key)
                result = executor(
                    db=db,
                    budget=budget,
                    period=period,
                    parameters=parameters,
                    scoring_sensitivity=item.scoring_sensitivity,
                    tone=tone,
                )
                weighted_score += result["score"] * float(item.weight)
            current_period_composite_score = int(weighted_score / total_weight) if total_weight > 0 else 50

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
            matrix=matrix,
            current_period_composite_score=current_period_composite_score,
        )

        result_dict = {
            "metric_key": item.metric_key,
            "name": metric_def["name"],
            "scope": metric_def["scope"],
            "weight": float(item.weight),
            "score": metric_result["score"],
            "status": metric_result["status"],
            "summary": metric_result["summary"],
            "evidence": metric_result["evidence"],
            "calculation": metric_result.get("calculation"),
        }
        # Pass through extra fields that some executors provide
        for extra_key in ("delta", "trend", "current_period_composite_score"):
            if extra_key in metric_result:
                result_dict[extra_key] = metric_result[extra_key]

        results.append(result_dict)

    return results


def evaluate_budget_health(
    db: Session,
    budgetid: int,
) -> dict | None:
    """Evaluate overall budget health using the active health matrix.

    Returns a payload similar to the legacy BudgetHealthOut schema.
    """
    from ..models import Budget, BudgetHealthMatrix, BudgetHealthMatrixItem

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

    # Resolve current period using canonical cycle_stage logic so the
    # health engine agrees with the rest of the app on what is "current".
    from ..cycle_management import cycle_stage, ordered_budget_periods
    from ..cycle_constants import CURRENT_STAGE

    periods = ordered_budget_periods(budgetid, db)
    current_periods = [
        p for p in periods
        if cycle_stage(p) == CURRENT_STAGE
    ]
    current_period = current_periods[0] if current_periods else None

    # Evaluate metrics for current period
    tone = budget.health_tone or "supportive"
    period_results = evaluate_period_health(db, budget, current_period, matrix, tone=tone)

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

    # Derive momentum only when period_trend metric is enabled
    period_trend_result = next((r for r in overall_metrics if r["metric_key"] == "period_trend"), None)
    if period_trend_result and "delta" in period_trend_result:
        delta = period_trend_result["delta"]
        if delta >= 5:
            momentum_status = "Improving"
        elif delta <= -5:
            momentum_status = "Declining"
        else:
            momentum_status = "Stable"
        momentum_delta = delta
        momentum_summary = _momentum_summary(momentum_status, momentum_delta, tone)
    else:
        momentum_status = "Stable"
        momentum_delta = 0
        momentum_summary = ""

    # Build pillars list
    pillars = []
    for r in overall_metrics:
        weight = r["weight"]
        contribution = round(r["score"] * weight, 2)
        pillars.append({
            "name": r["name"],
            "key": r["metric_key"],
            "score": r["score"],
            "status": r["status"],
            "summary": r["summary"],
            "weight": weight,
            "weighted_contribution": contribution,
            "evidence": r["evidence"],
        })

    # Current period check
    current_period_check = None
    if current_metrics:
        total_weight = sum(r["weight"] for r in current_metrics)
        weighted_score = int(sum(r["score"] * r["weight"] for r in current_metrics) / total_weight) if total_weight > 0 else 50
        current_period_check = {
            "score": weighted_score,
            "status": _health_status(weighted_score),
            "summary": _current_period_summary(weighted_score, tone),
            "metrics": [
                {
                    "name": m["name"],
                    "key": m["metric_key"],
                    "score": m["score"],
                    "status": m["status"],
                    "summary": m["summary"],
                    "weight": m["weight"],
                    "weighted_contribution": round(m["score"] * m["weight"], 2),
                    "evidence": m["evidence"],
                }
                for m in current_metrics
            ],
        }

    return {
        "version": "engine-v1",
        "overall_score": overall_score,
        "overall_status": overall_status,
        "overall_summary": _overall_summary(overall_score, overall_status, tone),
        "pillars": pillars,
        "momentum_status": momentum_status,
        "momentum_delta": momentum_delta,
        "momentum_summary": momentum_summary,
        "current_period_check": current_period_check,
        "evaluated_at": now.isoformat(),
    }


def _closed_period_summary(score: int, tone: str) -> str:
    summaries = {
        "supportive": {
            (75, 100): "This cycle tracked well — a solid result to build on.",
            (50, 74): "This cycle had some variance, but it remained within a manageable range.",
            (25, 49): "This cycle had a few bumps; useful learnings to carry forward.",
            (0, 24): "This cycle needed more care — good insights for next time.",
        },
        "friendly": {
            (75, 100): "This cycle went great — nice work!",
            (50, 74): "A few things went off track this cycle, but nothing too serious.",
            (25, 49): "This cycle had some rough patches worth looking back on.",
            (0, 24): "This cycle was pretty rough — let's take the lessons into the next one.",
        },
        "factual": {
            (75, 100): "Cycle performed within acceptable limits.",
            (50, 74): "Cycle variance detected — performance review recommended.",
            (25, 49): "Cycle had significant issues requiring follow-up.",
            (0, 24): "Cycle was in a critical state — corrective action required going forward.",
        },
    }
    band = summaries.get(tone, summaries["supportive"])
    for (low, high), message in band.items():
        if low <= score <= high:
            return message
    return band[(75, 100)]


def _current_period_summary(score: int, tone: str) -> str:
    summaries = {
        "supportive": {
            (75, 100): "Current period is tracking well — keep up the good work.",
            (50, 74): "Current period shows some variance, but you're still in a manageable range.",
            (25, 49): "Current period has a few bumps; a quick review could help get things back on track.",
            (0, 24): "Current period needs some care — tackling the key issues early will make a big difference.",
        },
        "friendly": {
            (75, 100): "Everything's looking great this period — nice job!",
            (50, 74): "A few things are off track, but nothing a little attention can't fix.",
            (25, 49): "Heads up — there are some issues worth looking into this period.",
            (0, 24): "Oof, this period is rough — let's sort out the big items first.",
        },
        "factual": {
            (75, 100): "Period is within acceptable limits.",
            (50, 74): "Period variance detected — review recommended.",
            (25, 49): "Period has significant issues requiring action.",
            (0, 24): "Period is in a critical state — immediate intervention required.",
        },
    }
    band = summaries.get(tone, summaries["supportive"])
    for (low, high), message in band.items():
        if low <= score <= high:
            return message
    return band[(75, 100)]


def _overall_summary(score: int, status: str, tone: str) -> str:
    summaries = {
        "supportive": {
            "Strong": "Your budget health is in great shape overall.",
            "Watch": "Your budget health is okay, but there's room to improve.",
            "Needs Attention": "Your budget health needs some attention — a few areas could use focus.",
        },
        "factual": {
            "Strong": "Overall budget health is within acceptable parameters.",
            "Watch": "Overall budget health shows signs of variance.",
            "Needs Attention": "Overall budget health is below acceptable thresholds.",
        },
        "friendly": {
            "Strong": "Everything's looking great overall!",
            "Watch": "Not bad overall — a few things to keep an eye on.",
            "Needs Attention": "Overall things are a bit rough — let's tackle the big items first.",
        },
    }
    return summaries.get(tone, summaries["factual"]).get(status, "Budget health evaluated.")


def _momentum_summary(status: str, delta: int, tone: str) -> str:
    summaries = {
        "supportive": {
            "Improving": "Momentum is positive — things are heading in the right direction.",
            "Declining": "Momentum has dipped — worth a quick check on recent changes.",
            "Stable": "Momentum is steady — no major shifts since the last cycle.",
        },
        "factual": {
            "Improving": "Positive momentum detected vs historical average.",
            "Declining": "Negative momentum detected vs historical average.",
            "Stable": "Momentum is stable vs historical average.",
        },
        "friendly": {
            "Improving": "Things are trending up — nice one!",
            "Declining": "Trending down a bit — no worries, next cycle will be better.",
            "Stable": "Holding steady — consistent!",
        },
    }
    return summaries.get(tone, summaries["factual"]).get(status, "Momentum evaluated.")


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
