from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session, selectinload

from .models import Budget, ExpenseItem, FinancialPeriod, IncomeType
from .time_utils import app_now, app_now_naive


PHASE1_HEALTH_VERSION = "phase1-v1"
HEALTH_STRONG = "Strong"
HEALTH_WATCH = "Watch"
HEALTH_ATTENTION = "Needs Attention"
MOMENTUM_IMPROVING = "Improving"
MOMENTUM_STABLE = "Stable"
MOMENTUM_DECLINING = "Declining"


def _quantize_money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _to_decimal(value) -> Decimal:
    return Decimal(str(value or 0))


def _period_range(period: FinancialPeriod) -> str:
    return f"{period.startdate.strftime('%d %b %y')} - {period.enddate.strftime('%d %b %y')}"


def _clamp_score(score: float) -> int:
    return max(0, min(100, int(round(score))))


def _health_status(score: int) -> str:
    if score >= 80:
        return HEALTH_STRONG
    if score >= 55:
        return HEALTH_WATCH
    return HEALTH_ATTENTION


def _current_future_historical(periods: list[FinancialPeriod]) -> tuple[list[FinancialPeriod], list[FinancialPeriod], list[FinancialPeriod]]:
    now = app_now_naive()
    current = [period for period in periods if period.startdate <= now <= period.enddate]
    future = [period for period in periods if period.startdate > now]
    historical = [period for period in periods if period.enddate < now]
    return current, future, historical


def _historical_outflow_metrics(period: FinancialPeriod) -> tuple[Decimal, Decimal, Decimal]:
    expense_budget = sum((_to_decimal(expense.budgetamount) for expense in period.period_expenses), Decimal("0"))
    expense_actual = sum((_to_decimal(expense.actualamount) for expense in period.period_expenses), Decimal("0"))
    investment_budget = sum((_to_decimal(investment.budgeted_amount) for investment in period.period_investments), Decimal("0"))
    investment_actual = sum((_to_decimal(investment.actualamount) for investment in period.period_investments), Decimal("0"))
    budget_outflow = expense_budget + investment_budget
    actual_outflow = expense_actual + investment_actual
    overrun = max(Decimal("0"), actual_outflow - budget_outflow)
    return budget_outflow, actual_outflow, overrun


def _build_setup_pillar(
    current_periods: list[FinancialPeriod],
    future_periods: list[FinancialPeriod],
    income_type_count: int,
    active_expense_count: int,
) -> dict:
    prereqs_ready = income_type_count > 0 and active_expense_count > 0
    current_period = current_periods[0] if current_periods else None
    next_future_period = future_periods[0] if future_periods else None

    score = 0
    score += 35 if prereqs_ready else 0
    score += 35 if current_period else 0
    score += 20 if next_future_period else 0
    score += 10 if len(future_periods) >= 2 else 0
    score = _clamp_score(score)

    if score >= 80:
        summary = "Budget setup is supporting active use and forward planning."
    elif score >= 55:
        summary = "Budget setup is usable, but future planning coverage is still uneven."
    else:
        summary = "Budget setup needs more preparation before the next period arrives."

    evidence = [
        {
            "label": "Setup prerequisites",
            "value": "Ready" if prereqs_ready else "Not ready",
            "detail": f"{income_type_count} income type{'s' if income_type_count != 1 else ''}, {active_expense_count} active expense item{'s' if active_expense_count != 1 else ''}",
        },
        {
            "label": "Current period coverage",
            "value": _period_range(current_period) if current_period else "No active period",
            "detail": "An active period is in place." if current_period else "Generate the next live period to begin tracking against plan.",
        },
        {
            "label": "Future period coverage",
            "value": f"{len(future_periods)} planned period{'s' if len(future_periods) != 1 else ''}",
            "detail": f"Next future period: {_period_range(next_future_period)}" if next_future_period else "No future periods are currently ready.",
        },
    ]

    return {
        "key": "setup_health",
        "title": "Setup Health",
        "score": score,
        "status": _health_status(score),
        "summary": summary,
        "evidence": evidence,
    }


def _build_discipline_pillar(historical_periods: list[FinancialPeriod]) -> tuple[dict, float]:
    sample = historical_periods[-6:]
    if not sample:
        score = 60
        pillar = {
            "key": "budget_discipline",
            "title": "Budget Discipline",
            "score": score,
            "status": _health_status(score),
            "summary": "More completed periods are needed before budget-vs-actual discipline can be assessed properly.",
            "evidence": [
                {
                    "label": "Historical periods reviewed",
                    "value": "0",
                    "detail": "Complete at least one period to begin measuring budget discipline.",
                },
            ],
        }
        return pillar, 0.0

    overspend_periods: list[str] = []
    periods_within_budget = 0
    total_budget_outflow = Decimal("0")
    total_overrun = Decimal("0")

    for period in sample:
        budget_outflow, _actual_outflow, overrun = _historical_outflow_metrics(period)
        total_budget_outflow += budget_outflow
        total_overrun += overrun
        if overrun <= Decimal("0.00"):
            periods_within_budget += 1
        else:
            overspend_periods.append(_period_range(period))

    overspend_rate = (len(overspend_periods) / len(sample)) if sample else 0.0
    overrun_ratio = float((total_overrun / total_budget_outflow) if total_budget_outflow > Decimal("0") else Decimal("0"))
    score = _clamp_score(100 - (overspend_rate * 55) - (overrun_ratio * 45))

    if score >= 80:
        summary = "Recent completed periods are mostly landing within planned outflow budgets."
    elif score >= 55:
        summary = "Recent completed periods show some drift from the planned outflow budgets."
    else:
        summary = "Recent completed periods are regularly finishing outside the planned outflow budgets."

    evidence = [
        {
            "label": "Historical periods reviewed",
            "value": str(len(sample)),
            "detail": f"Using the most recent {len(sample)} completed period{'s' if len(sample) != 1 else ''}.",
        },
        {
            "label": "Periods within budget",
            "value": f"{periods_within_budget}/{len(sample)}",
            "detail": "Compares historical expense and investment actuals against their planned budgets.",
        },
        {
            "label": "Total overspend",
            "value": str(_quantize_money(total_overrun)),
            "detail": ", ".join(overspend_periods[:3]) if overspend_periods else "No overspend recorded in the reviewed periods.",
        },
    ]

    return {
        "key": "budget_discipline",
        "title": "Budget Discipline",
        "score": score,
        "status": _health_status(score),
        "summary": summary,
        "evidence": evidence,
    }, overrun_ratio


def _build_planning_stability_pillar(current_periods: list[FinancialPeriod]) -> dict:
    current_expenses = [expense for period in current_periods for expense in period.period_expenses]
    if not current_expenses:
        score = 70
        return {
            "key": "planning_stability",
            "title": "Planning Stability",
            "score": score,
            "status": _health_status(score),
            "summary": "There is no active period revision activity to assess yet.",
            "evidence": [
                {
                    "label": "Current periods reviewed",
                    "value": str(len(current_periods)),
                    "detail": "Planning stability starts measuring once an active period contains working expense lines.",
                },
            ],
        }

    revised_lines = [expense for expense in current_expenses if (expense.status or "Current") == "Revised"]
    revision_comment_count = sum(1 for expense in revised_lines if expense.revision_comment)
    revised_ratio = len(revised_lines) / len(current_expenses)
    score = _clamp_score(100 - (revised_ratio * 70) - (min(len(revised_lines), 5) / 5 * 30))

    if score >= 80:
        summary = "The active period is holding together with little revision pressure."
    elif score >= 55:
        summary = "The active period is workable, but some plan changes have already been needed."
    else:
        summary = "The active period is relying heavily on revisions, which suggests planning pressure."

    affected_periods = {_period_range(period) for period in current_periods if any((expense.status or "Current") == "Revised" for expense in period.period_expenses)}
    evidence = [
        {
            "label": "Current periods reviewed",
            "value": str(len(current_periods)),
            "detail": ", ".join(_period_range(period) for period in current_periods),
        },
        {
            "label": "Expense lines reviewed",
            "value": str(len(current_expenses)),
            "detail": f"{len(revised_lines)} line{'s' if len(revised_lines) != 1 else ''} currently marked Revised.",
        },
        {
            "label": "Revision comments captured",
            "value": f"{revision_comment_count}/{len(revised_lines)}" if revised_lines else "0/0",
            "detail": ", ".join(sorted(affected_periods)) if affected_periods else "No revised lines are active right now.",
        },
    ]

    return {
        "key": "planning_stability",
        "title": "Planning Stability",
        "score": score,
        "status": _health_status(score),
        "summary": summary,
        "evidence": evidence,
    }


def _build_momentum(historical_periods: list[FinancialPeriod]) -> tuple[str, str, int]:
    sample = historical_periods[-6:]
    if len(sample) < 2:
        return MOMENTUM_STABLE, "More completed periods are needed before a meaningful trend can be measured.", 0

    midpoint = max(1, len(sample) // 2)
    previous = sample[:midpoint]
    recent = sample[midpoint:]

    def average_overrun_ratio(periods: list[FinancialPeriod]) -> float:
        total_budget = Decimal("0")
        total_overrun = Decimal("0")
        for period in periods:
            budget_outflow, _actual_outflow, overrun = _historical_outflow_metrics(period)
            total_budget += budget_outflow
            total_overrun += overrun
        if total_budget <= Decimal("0"):
            return 0.0
        return float(total_overrun / total_budget)

    previous_ratio = average_overrun_ratio(previous)
    recent_ratio = average_overrun_ratio(recent)
    delta = previous_ratio - recent_ratio
    momentum_delta = max(-25, min(25, int(round(delta * 100))))

    if delta > 0.05:
        return MOMENTUM_IMPROVING, "Recent completed periods are overspending less than the earlier comparison window.", max(1, momentum_delta)
    if delta < -0.05:
        return MOMENTUM_DECLINING, "Recent completed periods are overspending more than the earlier comparison window.", min(-1, momentum_delta)
    return MOMENTUM_STABLE, "Recent completed periods are tracking close to the earlier comparison window.", 0


def build_budget_health_payload(db: Session, budgetid: int) -> dict | None:
    budget = db.get(Budget, budgetid)
    if not budget:
        return None

    periods = (
        db.query(FinancialPeriod)
        .options(
            selectinload(FinancialPeriod.period_expenses),
            selectinload(FinancialPeriod.period_investments),
            selectinload(FinancialPeriod.period_incomes),
        )
        .filter(FinancialPeriod.budgetid == budgetid)
        .order_by(FinancialPeriod.startdate.asc())
        .all()
    )
    income_type_count = db.query(IncomeType).filter(IncomeType.budgetid == budgetid).count()
    active_expense_count = db.query(ExpenseItem).filter(
        ExpenseItem.budgetid == budgetid,
        ExpenseItem.active == True,  # noqa: E712
    ).count()

    current_periods, future_periods, historical_periods = _current_future_historical(periods)
    setup_pillar = _build_setup_pillar(current_periods, future_periods, income_type_count, active_expense_count)
    discipline_pillar, _discipline_ratio = _build_discipline_pillar(historical_periods)
    stability_pillar = _build_planning_stability_pillar(current_periods)
    pillars = [setup_pillar, discipline_pillar, stability_pillar]

    overall_score = _clamp_score(
        (setup_pillar["score"] * 0.30)
        + (discipline_pillar["score"] * 0.40)
        + (stability_pillar["score"] * 0.30)
    )
    overall_status = _health_status(overall_score)
    momentum_status, momentum_summary, momentum_delta = _build_momentum(historical_periods)

    if overall_status == HEALTH_STRONG:
        overall_summary = "Budget health is in a strong place across setup, discipline, and planning stability."
    elif overall_status == HEALTH_WATCH:
        overall_summary = "Budget health is usable, but one or more areas need attention to keep periods on track."
    else:
        overall_summary = "Budget health needs attention, with visible pressure in planning or completed period discipline."

    return {
        "budgetid": budgetid,
        "score_version": PHASE1_HEALTH_VERSION,
        "evaluated_at": app_now(),
        "overall_score": overall_score,
        "overall_status": overall_status,
        "overall_summary": overall_summary,
        "momentum_status": momentum_status,
        "momentum_delta": momentum_delta,
        "momentum_summary": momentum_summary,
        "pillars": pillars,
    }
