"""Closeout health helpers extracted from legacy budget_health.py.

These functions support cycle_management.build_closeout_preview until
the closeout preview is migrated to use the health engine directly.
"""

from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from ..cycle_constants import CLOSED, CURRENT_STAGE, PENDING_CLOSURE_STAGE, PLANNED
from ..models import Budget, FinancialPeriod
from ..time_utils import utc_now


PHASE1_HEALTH_VERSION = "phase1-v2"
HEALTH_STRONG = "Strong"
HEALTH_WATCH = "Watch"
HEALTH_ATTENTION = "Needs Attention"

DEFAULT_ACCEPTABLE_EXPENSE_OVERRUN_PCT = 10
DEFAULT_COMFORTABLE_SURPLUS_BUFFER_PCT = 5
DEFAULT_MAXIMUM_DEFICIT_AMOUNT = None
DEFAULT_REVISION_SENSITIVITY = 50
DEFAULT_SAVINGS_PRIORITY = 50
DEFAULT_PERIOD_CRITICALITY_BIAS = 50


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _to_decimal(value) -> Decimal:
    return Decimal(str(value or 0))


def _period_range(period: FinancialPeriod) -> str:
    return f"{period.startdate.strftime('%d %b %y')} - {period.enddate.strftime('%d %b %y')}"


def _clamp_score(score: float) -> int:
    return max(0, min(100, int(round(score))))


def _budget_preference(budget: Budget, field_name: str, default: int) -> int:
    value = getattr(budget, field_name, default)
    try:
        return max(0, min(100, int(value)))
    except (TypeError, ValueError):
        return default


def _budget_money_preference(budget: Budget, field_name: str, default: Decimal | None = None) -> Decimal | None:
    value = getattr(budget, field_name, default)
    if value is None:
        return default
    try:
        decimal_value = _quantize_money(_to_decimal(value))
    except Exception:
        return default
    if decimal_value < Decimal("0.00"):
        return default
    return decimal_value


def _ten_scale_display(value: int) -> int:
    return max(1, min(10, int(round(value / 10))))


def _health_status(score: int) -> str:
    if score >= 80:
        return HEALTH_STRONG
    if score >= 55:
        return HEALTH_WATCH
    return HEALTH_ATTENTION


def _timing_factor(progress_ratio: float, criticality_anchor: float) -> float:
    if progress_ratio >= criticality_anchor:
        return 1.0 + min(0.45, (progress_ratio - criticality_anchor) * 0.9)
    return 1.0 - min(0.25, (criticality_anchor - progress_ratio) * 0.5)


def _period_progress_ratio(period: FinancialPeriod) -> float:
    from datetime import timezone
    startdate = period.startdate if period.startdate.tzinfo else period.startdate.replace(tzinfo=timezone.utc)
    enddate = period.enddate if period.enddate.tzinfo else period.enddate.replace(tzinfo=timezone.utc)
    now = utc_now()
    total_seconds = max((enddate - startdate).total_seconds(), 1)
    elapsed_seconds = min(max((now - startdate).total_seconds(), 0), total_seconds)
    return elapsed_seconds / total_seconds


def current_period_totals(period: FinancialPeriod) -> dict[str, Decimal]:
    """Calculate budget and actual totals for a period."""
    income_budget = sum((_to_decimal(income.budgetamount) for income in period.period_incomes), Decimal("0"))
    income_actual = sum((_to_decimal(income.actualamount) for income in period.period_incomes), Decimal("0"))
    expense_budget = sum((
        _to_decimal(expense.actualamount if (getattr(expense, "status", "Current") or "Current") == "Paid" else expense.budgetamount)
        for expense in period.period_expenses
    ), Decimal("0"))
    expense_actual = sum((_to_decimal(expense.actualamount) for expense in period.period_expenses), Decimal("0"))
    investment_budget = sum((
        _to_decimal(investment.actualamount if (getattr(investment, "status", "Current") or "Current") == "Paid" else investment.budgeted_amount)
        for investment in period.period_investments
    ), Decimal("0"))
    investment_actual = sum((_to_decimal(investment.actualamount) for investment in period.period_investments), Decimal("0"))
    return {
        "income_budget": income_budget,
        "income_actual": income_actual,
        "expense_budget": expense_budget,
        "expense_actual": expense_actual,
        "investment_budget": investment_budget,
        "investment_actual": investment_actual,
        "surplus_budget": income_budget - expense_budget - investment_budget,
        "surplus_actual": income_actual - expense_actual - investment_actual,
    }


def build_current_period_check(
    budget: Budget,
    current_periods: list[FinancialPeriod],
    future_periods: list[FinancialPeriod],
    historical_periods: list[FinancialPeriod],
) -> dict:
    """Legacy current period health check for closeout preview."""
    current_period = current_periods[0] if current_periods else None

    if not current_period:
        latest_historical = historical_periods[-1] if historical_periods else None
        next_future = future_periods[0] if future_periods else None
        score = 60 if next_future else 40

        if next_future and not latest_historical:
            summary = "There is no active period yet, so check when the next planned period is due."
            detail = f"Next planned period: {_period_range(next_future)}"
        elif next_future:
            summary = "There is no active period right now, so period coverage should be checked before the next cycle starts."
            detail = f"Last completed period: {_period_range(latest_historical)}. Next planned period: {_period_range(next_future)}"
        else:
            summary = "There is no active period right now, so the budget cannot be checked against a live plan."
            detail = f"Last completed period: {_period_range(latest_historical)}" if latest_historical else "No periods have been created yet."

        return {
            "key": "current_period_check",
            "title": "Health Check for Current Period",
            "score": score,
            "status": _health_status(score),
            "summary": summary,
            "evidence": [
                {
                    "label": "Active period",
                    "value": "Not available",
                    "detail": detail,
                },
                {
                    "label": "Immediate action",
                    "value": "Check period coverage",
                    "detail": "This check becomes more meaningful once a current period is live.",
                },
            ],
        }

    totals = current_period_totals(current_period)
    acceptable_expense_overrun_pct = _budget_preference(
        budget,
        "acceptable_expense_overrun_pct",
        DEFAULT_ACCEPTABLE_EXPENSE_OVERRUN_PCT,
    )
    comfortable_surplus_buffer_pct = _budget_preference(
        budget,
        "comfortable_surplus_buffer_pct",
        DEFAULT_COMFORTABLE_SURPLUS_BUFFER_PCT,
    )
    maximum_deficit_amount = _budget_money_preference(
        budget,
        "maximum_deficit_amount",
        DEFAULT_MAXIMUM_DEFICIT_AMOUNT,
    )
    savings_priority = _budget_preference(
        budget,
        "savings_priority",
        DEFAULT_SAVINGS_PRIORITY,
    )
    period_criticality_bias = _budget_preference(
        budget,
        "period_criticality_bias",
        DEFAULT_PERIOD_CRITICALITY_BIAS,
    )
    revision_sensitivity = _budget_preference(
        budget,
        "revision_sensitivity",
        DEFAULT_REVISION_SENSITIVITY,
    )
    progress_ratio = _period_progress_ratio(current_period)
    criticality_anchor = 1 - (period_criticality_bias / 100)
    timing_factor = _timing_factor(progress_ratio, criticality_anchor)

    income_budget = totals["income_budget"]
    percent_deficit_threshold = _quantize_money(
        (income_budget * Decimal(comfortable_surplus_buffer_pct)) / Decimal("100")
    ) if income_budget > Decimal("0") else Decimal("0.00")
    deficit_threshold_candidates = [percent_deficit_threshold]
    if maximum_deficit_amount is not None:
        deficit_threshold_candidates.append(maximum_deficit_amount)
    effective_deficit_threshold = min(deficit_threshold_candidates) if deficit_threshold_candidates else Decimal("0.00")
    deficit_amount = max(Decimal("0.00"), -totals["surplus_budget"])
    revised_lines = [
        expense for expense in current_period.period_expenses
        if (expense.status or "Current") == "Revised"
    ]
    paid_over_budget_lines = [
        expense for expense in current_period.period_expenses
        if (expense.status or "Current") == "Paid" and _to_decimal(expense.actualamount) > _to_decimal(expense.budgetamount)
    ]
    live_over_budget_lines = [
        expense for expense in current_period.period_expenses
        if (expense.status or "Current") != "Paid" and _to_decimal(expense.actualamount) > _to_decimal(expense.budgetamount)
    ]
    meaningful_over_budget_lines = [
        expense for expense in current_period.period_expenses
        if _to_decimal(expense.budgetamount) > Decimal("0")
        and (
            ((_to_decimal(expense.actualamount) - _to_decimal(expense.budgetamount)) / _to_decimal(expense.budgetamount)) * Decimal("100")
        ) > Decimal(str(acceptable_expense_overrun_pct))
    ]

    score = 100
    if deficit_amount > effective_deficit_threshold:
        deficit_excess = deficit_amount - effective_deficit_threshold
        deficit_scale = max(effective_deficit_threshold, Decimal("50.00"))
        deficit_excess_ratio = deficit_excess / deficit_scale
        score -= max(20, min(70, int(round(float(deficit_excess_ratio) * 40 * timing_factor))))

    if totals["surplus_actual"] < Decimal("0"):
        score -= int(round(25 * timing_factor))

    if totals["investment_actual"] > totals["investment_budget"] and totals["investment_budget"] > Decimal("0"):
        score -= max(5, int(round((savings_priority / 100) * 15)))

    score -= min(20, len(revised_lines) * max(2, int(round(2 + (revision_sensitivity / 25)))))
    score -= min(15, len(meaningful_over_budget_lines) * max(3, int(round(3 + ((100 - acceptable_expense_overrun_pct) / 20)))))
    score -= min(12, len(paid_over_budget_lines) * 4)
    score -= min(10, len(live_over_budget_lines) * 3)
    score = _clamp_score(score)

    if deficit_amount > effective_deficit_threshold:
        summary = "This period is currently planning to spend more than it brings in, so it would be worth taking another look."
    elif deficit_amount > Decimal("0"):
        summary = "This period has moved into deficit, though it is still within the limit you said can happen before it becomes a budget health concern."
    elif totals["surplus_actual"] < Decimal("0"):
        summary = "This period is still workable, though recent spending has started to run ahead of the income recorded so far."
    elif revised_lines or meaningful_over_budget_lines or paid_over_budget_lines or live_over_budget_lines:
        summary = "Things are still on track overall, though there are a few signs that make this period worth a quick check-in."
    else:
        summary = "This period looks to be tracking along nicely with the current plan."

    pressure_notes = []
    if deficit_amount > effective_deficit_threshold:
        pressure_notes.append("budget deficit is beyond your health concern setting")
    if totals["surplus_actual"] < Decimal("0"):
        pressure_notes.append("actual surplus is negative")
    if revised_lines:
        pressure_notes.append(f"{len(revised_lines)} revised expense line{'s' if len(revised_lines) != 1 else ''}")
    if meaningful_over_budget_lines:
        pressure_notes.append(
            f"{len(meaningful_over_budget_lines)} expense line{'s' if len(meaningful_over_budget_lines) != 1 else ''} beyond your over-budget tolerance"
        )

    return {
        "key": "current_period_check",
        "title": "Health Check for Current Period",
        "score": score,
        "status": _health_status(score),
        "summary": summary,
        "evidence": [
            {
                "label": "Active period",
                "value": _period_range(current_period),
                "detail": "This check focuses on the currently active period only.",
            },
            {
                "label": "Surplus (Budget)",
                "value": str(_quantize_money(totals["surplus_budget"])),
                "detail": (
                    f"Budgeted income minus effective expense budget and investment budget. "
                    f"Your budget health concern point is set to the lower of {comfortable_surplus_buffer_pct}% deficit "
                    f"({percent_deficit_threshold})"
                    + (
                        f" and a fixed deficit amount of {maximum_deficit_amount}."
                        if maximum_deficit_amount is not None
                        else "."
                    )
                    + f" Effective deficit limit: -{effective_deficit_threshold}."
                ),
            },
            {
                "label": "Surplus (Actual)",
                "value": str(_quantize_money(totals["surplus_actual"])),
                "detail": "Actual income received minus actual expense activity recorded so far.",
            },
            {
                "label": "Pressure signals",
                "value": "None" if not pressure_notes else str(len(pressure_notes)),
                "detail": "No current issues detected." if not pressure_notes else ", ".join(pressure_notes),
            },
            {
                "label": "Expense tolerance",
                "value": f"{acceptable_expense_overrun_pct}%",
                "detail": f"{len(meaningful_over_budget_lines)} line{'s' if len(meaningful_over_budget_lines) != 1 else ''} are beyond the over-budget level you said would feel acceptable.",
            },
            {
                "label": "Revision sensitivity",
                "value": f"{_ten_scale_display(revision_sensitivity)}/10",
                "detail": f"{len(revised_lines)} revised expense line{'s' if len(revised_lines) != 1 else ''} {'is' if len(revised_lines) == 1 else 'are'} active right now.",
            },
            {
                "label": "Period timing",
                "value": f"{_ten_scale_display(period_criticality_bias)}/10",
                "detail": f"This period is {int(round(progress_ratio * 100))}% complete. Lower values make issues matter earlier in the cycle, while higher values push that caution later.",
            },
        ],
    }


# Backwards compatibility aliases
_current_period_totals = current_period_totals
_build_current_period_check = build_current_period_check
