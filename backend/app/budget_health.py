from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy.orm import Session, selectinload

from .cycle_constants import ACTIVE, CLOSED, PLANNED
from .models import Budget, ExpenseItem, FinancialPeriod, IncomeType, PeriodTransaction
from .time_utils import app_now, app_now_naive


PHASE1_HEALTH_VERSION = "phase1-v2"
HEALTH_STRONG = "Strong"
HEALTH_WATCH = "Watch"
HEALTH_ATTENTION = "Needs Attention"
MOMENTUM_IMPROVING = "Improving"
MOMENTUM_STABLE = "Stable"
MOMENTUM_DECLINING = "Declining"

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


def _current_future_historical(periods: list[FinancialPeriod]) -> tuple[list[FinancialPeriod], list[FinancialPeriod], list[FinancialPeriod]]:
    current = [period for period in periods if getattr(period, "cycle_status", None) == ACTIVE]
    future = [period for period in periods if getattr(period, "cycle_status", None) == PLANNED]
    historical = [period for period in periods if getattr(period, "cycle_status", None) == CLOSED]
    return current, future, historical


def _historical_outflow_metrics(period: FinancialPeriod) -> tuple[Decimal, Decimal, Decimal]:
    expense_budget = sum((_to_decimal(expense.budgetamount) for expense in period.period_expenses), Decimal("0"))
    expense_actual = sum((_to_decimal(expense.actualamount) for expense in period.period_expenses), Decimal("0"))
    investment_budget = sum((
        _to_decimal(investment.actualamount if (getattr(investment, "status", "Current") or "Current") == "Paid" else investment.budgeted_amount)
        for investment in period.period_investments
    ), Decimal("0"))
    investment_actual = sum((_to_decimal(investment.actualamount) for investment in period.period_investments), Decimal("0"))
    budget_outflow = expense_budget + investment_budget
    actual_outflow = expense_actual + investment_actual
    overrun = max(Decimal("0"), actual_outflow - budget_outflow)
    return budget_outflow, actual_outflow, overrun


def _current_period_totals(period: FinancialPeriod) -> dict[str, Decimal]:
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


def _period_progress_ratio(period: FinancialPeriod) -> float:
    total_seconds = max((period.enddate - period.startdate).total_seconds(), 1)
    elapsed_seconds = min(max((app_now_naive() - period.startdate).total_seconds(), 0), total_seconds)
    return elapsed_seconds / total_seconds


def _build_setup_pillar(
    budget: Budget,
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
    desired_future_periods = 1 if _budget_preference(budget, "revision_sensitivity", DEFAULT_REVISION_SENSITIVITY) < 60 else 2
    score += 20 if next_future_period else 0
    score += 10 if len(future_periods) >= desired_future_periods else 0
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
            "detail": f"{income_type_count} income source{'s' if income_type_count != 1 else ''}, {active_expense_count} active expense item{'s' if active_expense_count != 1 else ''}",
        },
        {
            "label": "Current period coverage",
            "value": _period_range(current_period) if current_period else "No active period",
            "detail": "An active period is in place." if current_period else "Generate the next live period to begin tracking against plan.",
        },
        {
            "label": "Upcoming period coverage",
            "value": f"{len(future_periods)} planned period{'s' if len(future_periods) != 1 else ''}",
            "detail": (
                f"Next future period: {_period_range(next_future_period)}. Preference target: {desired_future_periods} ahead."
                if next_future_period
                else "No future periods are currently ready."
            ),
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


def _build_current_period_check(
    budget: Budget,
    current_periods: list[FinancialPeriod],
    future_periods: list[FinancialPeriod],
    historical_periods: list[FinancialPeriod],
) -> dict:
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

    totals = _current_period_totals(current_period)
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
                        f" and ${maximum_deficit_amount}."
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


def _build_planning_stability_pillar(budget: Budget, current_periods: list[FinancialPeriod], db: Session) -> dict:
    current_expenses = [expense for period in current_periods for expense in period.period_expenses]
    current_investments = [investment for period in current_periods for investment in period.period_investments]
    current_lines = current_expenses + current_investments
    if not current_lines:
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
                    "detail": "Planning stability starts measuring once an active period contains working expense or investment lines.",
                },
            ],
        }

    current_period_ids = [period.finperiodid for period in current_periods]
    transaction_rows = (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.finperiodid.in_(current_period_ids),
            PeriodTransaction.source.in_(["expense", "investment"]),
        )
        .all()
    )
    off_plan_keys = {
        ("expense", expense.finperiodid, expense.expensedesc)
        for expense in current_expenses
        if (expense.status or "Current") == "Revised"
    }
    off_plan_keys.update(
        ("investment", investment.finperiodid, investment.investmentdesc)
        for investment in current_investments
        if (investment.status or "Current") == "Revised"
    )
    off_plan_keys.update(
        (tx.source, tx.finperiodid, tx.source_key)
        for tx in transaction_rows
        if tx.source_key and (
            getattr(tx, "entry_kind", "movement") == "budget_adjustment"
            or getattr(tx, "line_status", None) == "Revised"
        )
    )

    off_plan_ratio = len(off_plan_keys) / len(current_lines)
    revision_sensitivity = _budget_preference(budget, "revision_sensitivity", DEFAULT_REVISION_SENSITIVITY)
    revision_ratio_weight = 45 + (revision_sensitivity * 0.35)
    revision_count_weight = 15 + (revision_sensitivity * 0.30)
    score = _clamp_score(100 - (off_plan_ratio * revision_ratio_weight) - (min(len(off_plan_keys), 5) / 5 * revision_count_weight))

    if score >= 80:
        summary = "The active period is holding together with little revision pressure."
    elif score >= 55:
        summary = "The active period is workable, but some plan changes have already been needed."
    else:
        summary = "The active period is relying heavily on revisions, which suggests planning pressure."

    affected_periods = {
        _period_range(period)
        for period in current_periods
        if any(key[1] == period.finperiodid for key in off_plan_keys)
    }
    evidence = [
        {
            "label": "Current periods reviewed",
            "value": str(len(current_periods)),
            "detail": ", ".join(_period_range(period) for period in current_periods),
        },
        {
            "label": "Plan lines reviewed",
            "value": str(len(current_lines)),
            "detail": f"{len(off_plan_keys)} line{'s' if len(off_plan_keys) != 1 else ''} in the active period have moved off the initial plan.",
        },
        {
            "label": "Off-plan activity",
            "value": f"{len(off_plan_keys)}/{len(current_lines)}" if current_lines else "0/0",
            "detail": (
                f"{', '.join(sorted(affected_periods))}. Sensitivity setting: {_ten_scale_display(revision_sensitivity)}/10."
                if affected_periods
                else f"No revised lines are active right now. Sensitivity setting: {_ten_scale_display(revision_sensitivity)}/10."
            ),
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
    current_period_check = _build_current_period_check(budget, current_periods, future_periods, historical_periods)
    setup_pillar = _build_setup_pillar(budget, current_periods, future_periods, income_type_count, active_expense_count)
    discipline_pillar, _discipline_ratio = _build_discipline_pillar(historical_periods)
    stability_pillar = _build_planning_stability_pillar(budget, current_periods, db)
    pillars = [setup_pillar, discipline_pillar, stability_pillar]

    overall_score = _clamp_score(
        (current_period_check["score"] * 0.35)
        + (setup_pillar["score"] * 0.20)
        + (discipline_pillar["score"] * 0.25)
        + (stability_pillar["score"] * 0.20)
    )
    overall_status = _health_status(overall_score)
    momentum_status, momentum_summary, momentum_delta = _build_momentum(historical_periods)

    if overall_status == HEALTH_STRONG:
        overall_summary = "Budget health is in a strong place overall, with the current period and broader budget signals both looking steady."
    elif overall_status == HEALTH_WATCH:
        overall_summary = "Budget health is usable, though the current period or another budget area is showing enough pressure to justify a check-in."
    else:
        overall_summary = "Budget health needs attention, with the current period or broader budget pattern showing meaningful pressure."

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
        "current_period_check": current_period_check,
        "pillars": pillars,
    }
