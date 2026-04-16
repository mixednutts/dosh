"""Metric executors — code-backed scoring logic for each system metric.

Each executor receives:
- db: SQLAlchemy Session
- budget: Budget model instance
- period: FinancialPeriod model instance (may be None for OVERALL metrics)
- parameters: dict parsed from BudgetHealthMatrixItem.health_metric_parameters
- scoring_sensitivity: int 0-100 controlling steepness of penalty curves
- tone: str "supportive" | "factual" | "friendly"

Returns a dict with:
- score: int 0-100
- status: str "Strong" | "Watch" | "Needs Attention"
- summary: str (tone-aware message)
- evidence: list[str] (supporting details)
"""

from __future__ import annotations

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


def _clamp(value: int | float, min_val: int | float, max_val: int | float) -> int | float:
    return max(min_val, min(max_val, value))


def _setup_health_executor(
    *,
    db: Session,
    budget: Budget,
    period: FinancialPeriod | None,
    parameters: dict,
    scoring_sensitivity: int,
    tone: str,
    **kwargs,
) -> dict:
    """Evaluate setup completeness based on count of income, expense, and investment lines."""
    from ..models import IncomeType, ExpenseItem, InvestmentItem

    min_income = max(0, int(parameters.get("min_income_lines", 1)))
    min_expense = max(0, int(parameters.get("min_expense_lines", 1)))
    min_investment = max(0, int(parameters.get("min_investment_lines", 1)))

    income_count = db.query(IncomeType).filter_by(budgetid=budget.budgetid).count()
    expense_count = db.query(ExpenseItem).filter_by(budgetid=budget.budgetid, active=True).count()
    investment_count = db.query(InvestmentItem).filter_by(budgetid=budget.budgetid, active=True).count()

    checks = {
        "income": (income_count >= min_income, income_count, min_income, "income source"),
        "expense": (expense_count >= min_expense, expense_count, min_expense, "active expense"),
        "investment": (investment_count >= min_investment, investment_count, min_investment, "active investment"),
    }

    passed = sum(1 for ok, _, _, _ in checks.values() if ok)
    total = len(checks)
    base_score = int((passed / total) * 100) if total else 100

    # Sensitivity adjusts how harshly missing items are penalised
    sensitivity_factor = max(0.01, scoring_sensitivity / 50.0)
    if base_score < 100:
        penalty = (100 - base_score) * (sensitivity_factor - 1.0) * 0.5
        score = int(_clamp(base_score - penalty, 0, 100))
    else:
        score = 100

    status = _health_status(score)

    summaries = {
        "supportive": (
            "Your budget setup looks solid with the current income, expenses, and period coverage."
            if score >= 80
            else "It looks like a few setup pieces are still missing — adding them will help the budget health check."
        ),
        "factual": (
            "Income sources, active expenses, and investment counts are within expected ranges."
            if score >= 80
            else "Income sources, active expenses, or investment counts are below the configured minimums."
        ),
        "friendly": (
            "Looks like your budget is set up nicely — income, expenses, and investments are all in order!"
            if score >= 80
            else "A few more setup details and your budget will be looking great!"
        ),
    }

    evidence = []
    for ok, count, minimum, label in checks.values():
        if ok:
            evidence.append(f"{count} {label}{'s' if count != 1 else ''} configured (minimum {minimum})")
        else:
            evidence.append(f"{count} {label}{'s' if count != 1 else ''} configured — need at least {minimum}")

    return {
        "score": score,
        "status": status,
        "summary": summaries.get(tone, summaries["factual"]),
        "evidence": evidence,
    }


def _budget_vs_actual_amount_executor(
    *,
    db: Session,
    budget: Budget,
    period: FinancialPeriod | None,
    parameters: dict,
    scoring_sensitivity: int,
    tone: str,
    **kwargs,
) -> dict:
    """Evaluate aggregate expense overrun amount against tolerance."""
    from ..models import PeriodExpense

    upper_tolerance_amount = Decimal(str(parameters.get("upper_tolerance_amount", 50)))
    upper_tolerance_pct = Decimal(str(parameters.get("upper_tolerance_pct", 5)))

    if period is None:
        return {
            "score": 100,
            "status": HEALTH_STRONG,
            "summary": "No current period to evaluate.",
            "evidence": ["No current period available"],
        }

    expenses = db.query(PeriodExpense).filter_by(finperiodid=period.finperiodid).all()
    total_budgeted = sum((e.budgetamount or Decimal(0)) for e in expenses)
    overrun = sum(
        ((e.actualamount or Decimal(0)) - (e.budgetamount or Decimal(0)))
        for e in expenses
        if (e.actualamount or Decimal(0)) > (e.budgetamount or Decimal(0))
    )
    overrun = max(Decimal(0), overrun)

    tolerance_pct_value = (total_budgeted * upper_tolerance_pct) / Decimal(100)
    tolerance = min(upper_tolerance_amount, tolerance_pct_value) if total_budgeted > 0 else upper_tolerance_amount

    sensitivity_factor = max(0.01, Decimal(scoring_sensitivity) / Decimal(50))

    if overrun <= 0:
        score = 100
    elif overrun <= tolerance:
        ratio = float(overrun) / float(tolerance) if tolerance > 0 else 0
        score = int(100 - (ratio * 30))
    else:
        excess = overrun - tolerance
        score = int(70 - (float(excess) * float(sensitivity_factor) * 2))

    score = int(_clamp(score, 0, 100))
    status = _health_status(score)

    summaries = {
        "supportive": (
            "Your spending is within the tolerance you set."
            if score >= 80
            else "Spending has exceeded your set tolerance — worth reviewing."
        ),
        "factual": (
            "Expense overrun is within configured limits."
            if score >= 80
            else "Expense overrun exceeds configured limits."
        ),
        "friendly": (
            "Nice work keeping spending in line with your plan!"
            if score >= 80
            else "Looks like spending has crept past your set tolerance — worth a look."
        ),
    }

    evidence = [
        f"Overrun amount: ${overrun:.2f} (limit: ${upper_tolerance_amount:.2f})",
        f"Overrun percentage limit: {upper_tolerance_pct:.1f}% of budgeted expenses",
    ]
    if total_budgeted > 0:
        evidence.append(f"Budgeted expenses: ${total_budgeted:.2f}")

    return {
        "score": score,
        "status": status,
        "summary": summaries.get(tone, summaries["factual"]),
        "evidence": evidence,
    }


def _budget_vs_actual_lines_executor(
    *,
    db: Session,
    budget: Budget,
    period: FinancialPeriod | None,
    parameters: dict,
    scoring_sensitivity: int,
    tone: str,
    **kwargs,
) -> dict:
    """Evaluate count of over-budget expense lines against tolerance."""
    from ..models import PeriodExpense

    upper_tolerance_instances = max(0, int(parameters.get("upper_tolerance_instances", 2)))
    upper_tolerance_pct = Decimal(str(parameters.get("upper_tolerance_pct", 10)))

    if period is None:
        return {
            "score": 100,
            "status": HEALTH_STRONG,
            "summary": "No current period to evaluate.",
            "evidence": ["No current period available"],
        }

    expenses = db.query(PeriodExpense).filter_by(finperiodid=period.finperiodid).all()
    total_lines = len(expenses)
    overrun_lines = sum(
        1 for e in expenses if (e.actualamount or Decimal(0)) > (e.budgetamount or Decimal(0))
    )

    tolerance_pct_instances = int((Decimal(total_lines) * upper_tolerance_pct) / Decimal(100)) if total_lines > 0 else 0
    tolerance = min(upper_tolerance_instances, tolerance_pct_instances) if total_lines > 0 else upper_tolerance_instances

    sensitivity_factor = max(0.01, Decimal(scoring_sensitivity) / Decimal(50))

    if overrun_lines <= 0:
        score = 100
    elif tolerance > 0 and overrun_lines <= tolerance:
        ratio = overrun_lines / tolerance
        score = int(100 - (ratio * 30))
    else:
        excess = overrun_lines - tolerance
        score = int(70 - (excess * 15 * float(sensitivity_factor)))

    score = int(_clamp(score, 0, 100))
    status = _health_status(score)

    summaries = {
        "supportive": (
            "The number of over-budget lines is within your tolerance."
            if score >= 80
            else "Quite a few lines are over budget — it may be time to review."
        ),
        "factual": (
            "Over-budget line count is within configured limits."
            if score >= 80
            else "Over-budget line count exceeds configured limits."
        ),
        "friendly": (
            "You're keeping most lines under budget — nice one!"
            if score >= 80
            else "A few too many lines have gone over budget — maybe take a look?"
        ),
    }

    evidence = [
        f"Over-budget lines: {overrun_lines} (limit: {upper_tolerance_instances})",
    ]
    if total_lines > 0:
        evidence.append(f"Total expense lines: {total_lines}")

    return {
        "score": score,
        "status": status,
        "summary": summaries.get(tone, summaries["factual"]),
        "evidence": evidence,
    }


def _in_cycle_budget_adjustments_executor(
    *,
    db: Session,
    budget: Budget,
    period: FinancialPeriod | None,
    parameters: dict,
    scoring_sensitivity: int,
    tone: str,
    **kwargs,
) -> dict:
    """Evaluate in-cycle budget adjustments against tolerance."""
    from ..models import PeriodTransaction

    upper_tolerance_instances = max(0, int(parameters.get("upper_tolerance_instances", 1)))

    if period is None:
        return {
            "score": 100,
            "status": HEALTH_STRONG,
            "summary": "No current period to evaluate.",
            "evidence": ["No current period available"],
        }

    adjustment_count = (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.finperiodid == period.finperiodid,
            PeriodTransaction.entry_kind == "budget_adjustment",
            PeriodTransaction.entrydate > period.startdate,
        )
        .count()
    )

    sensitivity_factor = max(0.01, Decimal(scoring_sensitivity) / Decimal(50))

    if adjustment_count <= 0:
        score = 100
    elif adjustment_count <= upper_tolerance_instances:
        score = int(100 - (adjustment_count * 15))
    else:
        excess = adjustment_count - upper_tolerance_instances
        score = int(70 - (excess * 20 * float(sensitivity_factor)))

    score = int(_clamp(score, 0, 100))
    status = _health_status(score)

    summaries = {
        "supportive": (
            "Budget adjustments this period are within your tolerance."
            if score >= 80
            else "There have been several budget adjustments this period — consider locking the plan."
        ),
        "factual": (
            "In-cycle budget adjustments are within configured limits."
            if score >= 80
            else "In-cycle budget adjustments exceed configured limits."
        ),
        "friendly": (
            "Only a few budget tweaks so far — looking stable!"
            if score >= 80
            else "Lots of budget changes this period — maybe time to settle on a plan?"
        ),
    }

    evidence = [
        f"Budget adjustments: {adjustment_count} (limit: {upper_tolerance_instances})",
    ]

    return {
        "score": score,
        "status": status,
        "summary": summaries.get(tone, summaries["factual"]),
        "evidence": evidence,
    }


def _revisions_on_paid_expenses_executor(
    *,
    db: Session,
    budget: Budget,
    period: FinancialPeriod | None,
    parameters: dict,
    scoring_sensitivity: int,
    tone: str,
    **kwargs,
) -> dict:
    """Evaluate revisions on paid expenses against tolerance."""
    from ..models import PeriodTransaction

    upper_tolerance_instances = max(0, int(parameters.get("upper_tolerance_instances", 2)))

    if period is None:
        return {
            "score": 100,
            "status": HEALTH_STRONG,
            "summary": "No current period to evaluate.",
            "evidence": ["No current period available"],
        }

    revision_count = (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.finperiodid == period.finperiodid,
            PeriodTransaction.entry_kind == "status_change",
        )
        .count()
    )

    sensitivity_factor = max(0.01, Decimal(scoring_sensitivity) / Decimal(50))

    if revision_count <= 0:
        score = 100
    elif revision_count <= upper_tolerance_instances:
        score = int(100 - (revision_count * 15))
    else:
        excess = revision_count - upper_tolerance_instances
        score = int(70 - (excess * 20 * float(sensitivity_factor)))

    score = int(_clamp(score, 0, 100))
    status = _health_status(score)

    summaries = {
        "supportive": (
            "Revisions on paid expenses are within your tolerance."
            if score >= 80
            else "There have been several revisions on paid expenses — review your workflow."
        ),
        "factual": (
            "Paid expense revisions are within configured limits."
            if score >= 80
            else "Paid expense revisions exceed configured limits."
        ),
        "friendly": (
            "Not many paid expense revisions — things look steady!"
            if score >= 80
            else "Quite a few paid expense revisions — maybe double-check entries?"
        ),
    }

    evidence = [
        f"Paid expense revisions: {revision_count} (limit: {upper_tolerance_instances})",
    ]

    return {
        "score": score,
        "status": status,
        "summary": summaries.get(tone, summaries["factual"]),
        "evidence": evidence,
    }


def _budget_cycles_pending_closeout_executor(
    *,
    db: Session,
    budget: Budget,
    period: FinancialPeriod | None,
    parameters: dict,
    scoring_sensitivity: int,
    tone: str,
    **kwargs,
) -> dict:
    """Evaluate pending close-out cycles against tolerance."""
    from datetime import datetime, timezone
    from ..models import FinancialPeriod
    from ..cycle_constants import CLOSED

    upper_tolerance_instances = max(0, int(parameters.get("upper_tolerance_instances", 0)))

    now = datetime.now(timezone.utc)
    pending_count = (
        db.query(FinancialPeriod)
        .filter(
            FinancialPeriod.budgetid == budget.budgetid,
            FinancialPeriod.enddate < now,
            FinancialPeriod.cycle_status != CLOSED,
        )
        .count()
    )

    sensitivity_factor = max(0.01, Decimal(scoring_sensitivity) / Decimal(50))

    if pending_count <= 0:
        score = 100
    elif pending_count <= upper_tolerance_instances:
        score = int(100 - (pending_count * 20))
    else:
        excess = pending_count - upper_tolerance_instances
        score = int(70 - (excess * 25 * float(sensitivity_factor)))

    score = int(_clamp(score, 0, 100))
    status = _health_status(score)

    summaries = {
        "supportive": (
            "Your budget cycles are up to date."
            if score >= 80
            else "Some budget cycles are awaiting close-out — it's worth catching up."
        ),
        "factual": (
            "Pending close-out cycles are within configured limits."
            if score >= 80
            else "Pending close-out cycles exceed configured limits."
        ),
        "friendly": (
            "All caught up on budget cycles — great job!"
            if score >= 80
            else "A few budget cycles are still waiting to close out — time to tidy up!"
        ),
    }

    evidence = [
        f"Pending close-out cycles: {pending_count} (limit: {upper_tolerance_instances})",
    ]

    return {
        "score": score,
        "status": status,
        "summary": summaries.get(tone, summaries["factual"]),
        "evidence": evidence,
    }


METRIC_EXECUTORS = {
    "setup_health": _setup_health_executor,
    "budget_vs_actual_amount": _budget_vs_actual_amount_executor,
    "budget_vs_actual_lines": _budget_vs_actual_lines_executor,
    "in_cycle_budget_adjustments": _in_cycle_budget_adjustments_executor,
    "revisions_on_paid_expenses": _revisions_on_paid_expenses_executor,
    "budget_cycles_pending_closeout": _budget_cycles_pending_closeout_executor,
}


def get_executor(metric_key: str):
    """Get the executor function for a metric key."""
    executor = METRIC_EXECUTORS.get(metric_key)
    if executor is None:
        def fallback_executor(*args, **kwargs):
            return {
                "score": 50,
                "status": HEALTH_WATCH,
                "summary": "Metric evaluation not yet implemented.",
                "evidence": [],
            }
        return fallback_executor
    return executor
