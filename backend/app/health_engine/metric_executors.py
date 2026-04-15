"""Metric executors — code-backed scoring logic for each system metric.

Each executor receives:
- db: SQLAlchemy Session
- budget: Budget model instance
- period: FinancialPeriod model instance (may be None for OVERALL metrics)
- parameters: dict parsed from BudgetHealthMatrixItem.parameters_json
- scoring_sensitivity: int 0-100 controlling steepness of penalty curves
- tone: str "supportive" | "factual" | "friendly"

Returns a dict with:
- score: int 0-100
- status: str "Strong" | "Watch" | "Needs Attention"
- summary: str (tone-aware message)
- evidence: list[str] (supporting details)
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


def _budget_discipline_executor(
    *,
    db: Session,
    budget: Budget,
    period: FinancialPeriod | None,
    parameters: dict,
    scoring_sensitivity: int,
    tone: str,
    **kwargs,
) -> dict:
    """Evaluate historical expense overrun against user-defined dollar and percentage limits."""
    from datetime import datetime, timezone
    from ..models import FinancialPeriod, PeriodExpense

    max_overrun_dollar = Decimal(str(parameters.get("max_overrun_dollar", 0)))
    max_overrun_pct = Decimal(str(parameters.get("max_overrun_pct_of_expenses", 10)))

    now = datetime.now(timezone.utc)
    closed_periods = (
        db.query(FinancialPeriod)
        .filter(
            FinancialPeriod.budgetid == budget.budgetid,
            FinancialPeriod.enddate < now,
            FinancialPeriod.islocked == True,
        )
        .all()
    )

    if not closed_periods:
        score = 100
        status = HEALTH_STRONG
        summaries = {
            "supportive": "Not enough history to judge discipline yet — check back after a few periods close out.",
            "factual": "No closed historical periods available to evaluate budget discipline.",
            "friendly": "No history yet — once a few periods wrap up, this score will come alive!",
        }
        evidence = ["No closed periods found"]
        return {
            "score": score,
            "status": status,
            "summary": summaries.get(tone, summaries["factual"]),
            "evidence": evidence,
        }

    overruns = []
    total_budgeted = Decimal(0)
    total_actual = Decimal(0)
    for p in closed_periods:
        expenses = db.query(PeriodExpense).filter_by(finperiodid=p.finperiodid).all()
        pb = sum((e.budgetamount or Decimal(0)) for e in expenses)
        pa = sum((e.actualamount or Decimal(0)) for e in expenses)
        total_budgeted += pb
        total_actual += pa
        if pb > 0:
            overrun_dollar = pa - pb
            overrun_pct = ((pa / pb) - Decimal(1)) * Decimal(100)
            overruns.append({"dollar": overrun_dollar, "pct": overrun_pct, "budgeted": pb, "actual": pa})

    if total_budgeted > 0:
        avg_overrun_dollar = total_actual - total_budgeted
        avg_overrun_pct = ((total_actual / total_budgeted) - Decimal(1)) * Decimal(100)
    else:
        avg_overrun_dollar = Decimal(0)
        avg_overrun_pct = Decimal(0)

    dollar_excess = max(Decimal(0), avg_overrun_dollar - max_overrun_dollar)
    pct_excess = max(Decimal(0), avg_overrun_pct - max_overrun_pct)

    sensitivity_factor = max(0.01, Decimal(scoring_sensitivity) / Decimal(50))

    # Compute score
    score = 100
    if dollar_excess > 0:
        score -= int(_clamp(float(dollar_excess) * float(sensitivity_factor) * 2, 0, 50))
    if pct_excess > 0:
        score -= int(_clamp(float(pct_excess) * float(sensitivity_factor) * 3, 0, 50))
    score = int(_clamp(score, 0, 100))
    status = _health_status(score)

    summaries = {
        "supportive": (
            "Your historical spending is tracking within the tolerance you set."
            if score >= 80
            else "Historical spending has run a bit over budget compared to the tolerance you set."
        ),
        "factual": (
            "Historical expense overrun is within configured limits."
            if score >= 80
            else "Historical expense overrun exceeds configured limits."
        ),
        "friendly": (
            "Nice work keeping historical spending in line with your plan!"
            if score >= 80
            else "Looks like spending has crept past your set tolerance — worth a look."
        ),
    }

    evidence = [
        f"Average overrun: ${avg_overrun_dollar:.2f} (limit: ${max_overrun_dollar:.2f})",
        f"Average overrun: {avg_overrun_pct:.1f}% of budgeted expenses (limit: {max_overrun_pct:.1f}%)",
        f"Periods evaluated: {len(closed_periods)}",
    ]

    return {
        "score": score,
        "status": status,
        "summary": summaries.get(tone, summaries["factual"]),
        "evidence": evidence,
    }


METRIC_EXECUTORS = {
    "setup_health": _setup_health_executor,
    "budget_discipline": _budget_discipline_executor,
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
