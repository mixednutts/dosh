"""Metric executors — code-backed scoring logic for each metric template.

Each executor receives:
- formula_result: Decimal from evaluating the metric's formula
- threshold_value: the user's threshold/benchmark value for this metric
- scoring_sensitivity: int 0-100 controlling steepness of penalty curves
- tone: str "supportive" | "factual" | "friendly"

Returns a dict with:
- score: int 0-100
- status: str "Strong" | "Watch" | "Needs Attention"
- summary: str (tone-aware message)
- evidence: list[str] (supporting details)
- drill_down: list[dict] (optional structured references)
"""

from __future__ import annotations

import json
from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from ..models import Budget, FinancialPeriod


HEALTH_STRONG = "Strong"
HEALTH_WATCH = "Watch"
HEALTH_ATTENTION = "Needs Attention"


def _health_status(score: int) -> str:
    if score >= 80:
        return HEALTH_STRONG
    if score >= 55:
        return HEALTH_WATCH
    return HEALTH_ATTENTION


def _select_summary(template: dict, tone: str) -> str:
    """Select summary text based on tone preference."""
    templates = template.get("summary_templates", {})
    return templates.get(tone, templates.get("factual", "Health check completed."))


def execute_setup_health(
    db: Session,
    budget: Budget,
    period: FinancialPeriod | None,
    formula_result: Decimal,
    threshold_value: Decimal | None,
    scoring_sensitivity: int,
    tone: str,
    source_values: dict[str, Decimal] | None = None,
) -> dict:
    """Executor for setup_health metric.

    Evaluates income sources, active expenses, and future period coverage.
    Scoring is based on presence of minimum required setup elements.
    """
    source_values = source_values or {}
    income_count = int(source_values.get("income_source_count", Decimal(0)))
    expense_count = int(source_values.get("active_expense_count", Decimal(0)))
    future_periods = int(source_values.get("future_period_count", Decimal(0)))

    # Setup health scoring: all three components needed for full score
    score = 0
    evidence = []
    drill_down = []

    if income_count > 0:
        score += 35
        evidence.append(f"{income_count} income source(s) configured")
    else:
        evidence.append("No income sources configured")

    if expense_count > 0:
        score += 35
        evidence.append(f"{expense_count} active expense(s) configured")
    else:
        evidence.append("No active expenses configured")

    if future_periods >= 1:
        score += 30
        evidence.append(f"{future_periods} future period(s) generated")
    else:
        evidence.append("No future periods generated")

    score = min(100, score)
    status = _health_status(score)

    summaries = {
        "supportive": "Your budget setup looks solid with the current income, expenses, and period coverage.",
        "factual": "Income sources, active expenses, and future period counts are within expected ranges.",
        "friendly": "Looks like your budget is set up nicely — income, expenses, and periods are all in order!",
    }

    return {
        "score": score,
        "status": status,
        "summary": summaries.get(tone, summaries["factual"]),
        "evidence": evidence,
        "drill_down": drill_down,
    }


def execute_budget_discipline(
    db: Session,
    budget: Budget,
    period: FinancialPeriod | None,
    formula_result: Decimal,
    threshold_value: Decimal | None,
    scoring_sensitivity: int,
    tone: str,
    source_values: dict[str, Decimal] | None = None,
) -> dict:
    """Executor for budget_discipline metric.

    Measures historical outflow overrun across closed periods.
    Formula result is the average overrun ratio (0 = on budget, positive = overspend).
    """
    acceptable_overrun_pct = threshold_value or Decimal("10")
    sensitivity_factor = Decimal(scoring_sensitivity) / Decimal("50")  # 1.0 at midpoint

    overrun_pct = formula_result * Decimal("100")  # Convert ratio to percentage

    # Calculate score: 100 at 0% overrun, decreasing as overrun increases
    # Sensitivity affects how steeply we penalize
    threshold = acceptable_overrun_pct
    if overrun_pct <= 0:
        score = 100
    elif overrun_pct <= threshold:
        # Linear decay within acceptable range
        ratio = overrun_pct / threshold
        score = 100 - int(ratio * 20)  # Lose up to 20 points
    else:
        # Steeper penalty beyond threshold, modulated by sensitivity
        excess = overrun_pct - threshold
        penalty = (excess * sensitivity_factor * 3)  # 3 points per % excess at normal sensitivity
        score = max(0, 80 - int(penalty))

    score = min(100, max(0, score))
    status = _health_status(score)

    summaries = {
        "supportive": "Your historical spending discipline is tracking well." if score >= 80 else "Keep an eye on spending patterns to stay within budget.",
        "factual": f"Historical expense overrun is {overrun_pct:.1f}% (threshold: {acceptable_overrun_pct}%)",
        "friendly": "You're keeping your spending in check — nice work!" if score >= 80 else "Spending is a bit over budget lately — maybe time for a quick review?",
    }

    evidence = [f"Average historical overrun: {overrun_pct:.1f}%", f"Acceptable threshold: {acceptable_overrun_pct}%"]
    drill_down = []  # Could link to historical period detail

    return {
        "score": score,
        "status": status,
        "summary": summaries.get(tone, summaries["factual"]),
        "evidence": evidence,
        "drill_down": drill_down,
    }


def execute_planning_stability(
    db: Session,
    budget: Budget,
    period: FinancialPeriod | None,
    formula_result: Decimal,
    threshold_value: Decimal | None,
    scoring_sensitivity: int,
    tone: str,
    source_values: dict[str, Decimal] | None = None,
) -> dict:
    """Executor for planning_stability metric.

    Tracks off-plan activity (revised lines) in the current period.
    Formula result is the count of revised lines.
    """
    revision_threshold = threshold_value or Decimal("50")
    sensitivity_factor = Decimal(scoring_sensitivity) / Decimal("50")

    revised_count = int(formula_result)

    # Score based on number of revisions relative to sensitivity
    # At 50% sensitivity, allow ~3 revisions before major impact
    # At higher sensitivity, fewer revisions allowed
    base_tolerance = max(1, int(3 / sensitivity_factor))

    if revised_count == 0:
        score = 100
    elif revised_count <= base_tolerance:
        score = 100 - (revised_count * 10)
    else:
        excess = revised_count - base_tolerance
        score = max(0, 70 - (excess * 15 * sensitivity_factor))

    score = min(100, max(0, score))
    status = _health_status(score)

    summaries = {
        "supportive": "Your plan has remained stable with minimal revisions." if revised_count == 0 else f"{revised_count} revision(s) detected — changes happen, just keep them intentional.",
        "factual": f"Number of revised lines: {revised_count}",
        "friendly": "Not many changes this cycle — your plan is holding steady!" if revised_count <= 1 else f"{revised_count} changes so far — staying flexible!",
    }

    evidence = [f"Revised line count: {revised_count}", f"Revision sensitivity: {revision_threshold}"]
    drill_down = []  # Could link to revised line items

    return {
        "score": score,
        "status": status,
        "summary": summaries.get(tone, summaries["factual"]),
        "evidence": evidence,
        "drill_down": drill_down,
    }


def execute_current_period_check(
    db: Session,
    budget: Budget,
    period: FinancialPeriod | None,
    formula_result: Decimal,
    threshold_value: Decimal | None,
    scoring_sensitivity: int,
    tone: str,
    source_values: dict[str, Decimal] | None = None,
) -> dict:
    """Executor for current_period_check metric.

    Evaluates live-period surplus/deficit against the user's threshold.
    Formula result is live_period_surplus.
    """
    from ..models import PeriodExpense

    if period is None:
        return {
            "score": 50,
            "status": HEALTH_WATCH,
            "summary": "No active period to evaluate." if tone == "factual" else "Looks like there's no current period running right now.",
            "evidence": ["No current period found"],
            "drill_down": [],
        }

    source_values = source_values or {}
    surplus = formula_result
    total_income = source_values.get("total_budgeted_income", Decimal(0))

    # Get max deficit threshold
    max_deficit = threshold_value
    if max_deficit is None:
        # Default to 10% of income or $50 whichever is larger
        max_deficit = max(total_income * Decimal("0.10"), Decimal("50"))

    sensitivity_factor = Decimal(scoring_sensitivity) / Decimal("50")

    # Score based on surplus vs deficit threshold
    if surplus >= 0:
        score = 100
    elif abs(surplus) <= max_deficit:
        # Within tolerance zone
        ratio = abs(surplus) / max_deficit
        score = 100 - int(ratio * 30)  # Lose up to 30 points
    else:
        # Beyond tolerance
        excess = abs(surplus) - max_deficit
        penalty = excess * sensitivity_factor * 2  # 2 points per dollar excess at normal sensitivity
        score = max(0, 70 - int(penalty))

    score = min(100, max(0, score))
    status = _health_status(score)

    surplus_str = f"${surplus:.2f}" if surplus >= 0 else f"-${abs(surplus):.2f}"

    summaries = {
        "supportive": "This period is tracking along well with the current plan." if score >= 80 else f"Period surplus is {surplus_str} — keep an eye on upcoming expenses.",
        "factual": f"Current period surplus: {surplus_str} (threshold: ${max_deficit:.2f})",
        "friendly": "Things are looking good this cycle — no red flags!" if score >= 80 else f"Running a bit tight at {surplus_str} — manageable but watch those spends!",
    }

    # Query expenses for drill-down and expense evidence when db is available
    expenses = []
    if db is not None:
        expenses = db.query(PeriodExpense).filter_by(finperiodid=period.finperiodid).all()
    total_expense = sum((e.budgetamount or Decimal(0)) for e in expenses)

    evidence = [
        f"Period surplus: {surplus_str}",
        f"Budgeted income: ${total_income:.2f}",
        f"Budgeted expenses: ${total_expense:.2f}",
    ]

    # Drill down to over-budget lines if any
    drill_down = []
    for exp in expenses:
        if exp.actualamount and exp.actualamount > exp.budgetamount:
            drill_down.append({
                "type": "period_expense",
                "label": f"Over budget: {exp.expensedesc}",
                "finperiodid": period.finperiodid,
                "expensedesc": exp.expensedesc,
            })

    return {
        "score": score,
        "status": status,
        "summary": summaries.get(tone, summaries["factual"]),
        "evidence": evidence,
        "drill_down": drill_down,
    }


# Registry mapping metric template keys to executor functions
METRIC_EXECUTORS = {
    "setup_health": execute_setup_health,
    "budget_discipline": execute_budget_discipline,
    "planning_stability": execute_planning_stability,
    "current_period_check": execute_current_period_check,
}


def get_executor(metric_template_key: str):
    """Get the executor function for a metric template key."""
    executor = METRIC_EXECUTORS.get(metric_template_key)
    if executor is None:
        # Default fallback — return neutral score
        def fallback_executor(*args, **kwargs):
            return {
                "score": 50,
                "status": HEALTH_WATCH,
                "summary": "Metric evaluation not yet implemented.",
                "evidence": [],
                "drill_down": [],
            }
        return fallback_executor
    return executor
