from __future__ import annotations

import json
from datetime import timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from .budget_health import _build_current_period_check, _current_period_totals
from .cycle_constants import (
    ACTIVE,
    CARRIED_FORWARD_DESC,
    CARRIED_FORWARD_SYSTEM_KEY,
    CLOSED,
    CURRENT_STAGE,
    PAID,
    PENDING_CLOSURE_STAGE,
    PLANNED,
    REVISED,
    WORKING,
)
from .models import (
    BalanceType,
    Budget,
    ExpenseItem,
    FinancialPeriod,
    IncomeType,
    InvestmentItem,
    PeriodBalance,
    PeriodCloseoutSnapshot,
    PeriodExpense,
    PeriodIncome,
    PeriodInvestment,
    PeriodTransaction,
)
from .period_logic import calc_period_end, expense_occurs_in_period
from .time_utils import app_now_naive, utc_now
from .transaction_ledger import sync_period_state


def cycle_status(period: FinancialPeriod) -> str:
    return getattr(period, "cycle_status", None) or PLANNED


def cycle_stage(period: FinancialPeriod) -> str:
    if getattr(period, "closed_at", None) is not None or cycle_status(period) == CLOSED:
        return CLOSED
    if cycle_status(period) == PLANNED:
        return PLANNED

    now = utc_now()
    # Ensure period.enddate has timezone info for comparison
    enddate = period.enddate if period.enddate.tzinfo else period.enddate.replace(tzinfo=timezone.utc)
    if enddate < now:
        return PENDING_CLOSURE_STAGE
    return CURRENT_STAGE


def ordered_budget_periods(budgetid: int, db: Session) -> list[FinancialPeriod]:
    return (
        db.query(FinancialPeriod)
        .filter(FinancialPeriod.budgetid == budgetid)
        .order_by(FinancialPeriod.startdate, FinancialPeriod.finperiodid)
        .all()
    )


def lifecycle_groups(periods: list[FinancialPeriod]) -> tuple[list[FinancialPeriod], list[FinancialPeriod], list[FinancialPeriod]]:
    current = [period for period in periods if cycle_stage(period) in {CURRENT_STAGE, PENDING_CLOSURE_STAGE}]
    future = [period for period in periods if cycle_stage(period) == PLANNED]
    historical = [period for period in periods if cycle_stage(period) == CLOSED]
    return current, future, historical


def has_cycle_actuals(finperiodid: int, db: Session) -> bool:
    has_income = db.query(PeriodIncome).filter(
        PeriodIncome.finperiodid == finperiodid,
        PeriodIncome.actualamount != 0,
    ).first()
    has_expense = db.query(PeriodExpense).filter(
        PeriodExpense.finperiodid == finperiodid,
        PeriodExpense.actualamount != 0,
    ).first()
    has_investment = db.query(PeriodInvestment).filter(
        PeriodInvestment.finperiodid == finperiodid,
        PeriodInvestment.actualamount != 0,
    ).first()
    return any((has_income, has_expense, has_investment))


def has_cycle_transactions(finperiodid: int, db: Session) -> bool:
    movement_like_tx = (
        db.query(PeriodTransaction.id)
        .filter(
            PeriodTransaction.finperiodid == finperiodid,
            PeriodTransaction.type != "BUDGETADJ",
        )
        .first()
    )
    return movement_like_tx is not None


def carry_forward_amount_for_period(period: FinancialPeriod) -> Decimal:
    totals = _current_period_totals(period)
    return Decimal(str(totals["surplus_actual"])).quantize(Decimal("0.01"))


def upsert_carried_forward_line(finperiodid: int, budgetid: int, amount: Decimal, db: Session) -> PeriodIncome:
    row = db.get(PeriodIncome, (finperiodid, CARRIED_FORWARD_DESC))
    if row is None:
        row = PeriodIncome(
            finperiodid=finperiodid,
            budgetid=budgetid,
            incomedesc=CARRIED_FORWARD_DESC,
            budgetamount=amount,
            actualamount=Decimal("0.00"),
            varianceamount=Decimal("0.00") - amount,
            is_system=True,
            system_key=CARRIED_FORWARD_SYSTEM_KEY,
            revision_snapshot=0,
        )
        db.add(row)
    else:
        row.budgetamount = amount
        row.varianceamount = Decimal(str(row.actualamount or 0)) - amount
        row.is_system = True
        row.system_key = CARRIED_FORWARD_SYSTEM_KEY
    return row


def remove_carried_forward_line(finperiodid: int, db: Session) -> None:
    row = db.get(PeriodIncome, (finperiodid, CARRIED_FORWARD_DESC))
    if row and row.system_key == CARRIED_FORWARD_SYSTEM_KEY:
        db.delete(row)


def rebalance_period_openings(period: FinancialPeriod, previous_period: FinancialPeriod | None, db: Session) -> None:
    balance_types = db.query(BalanceType).filter(BalanceType.budgetid == period.budgetid).all()
    for balance_type in balance_types:
        pb = db.get(PeriodBalance, (period.finperiodid, balance_type.balancedesc))
        if not pb:
            continue
        if previous_period:
            prev_balance = db.get(PeriodBalance, (previous_period.finperiodid, balance_type.balancedesc))
            opening = Decimal(str(prev_balance.closing_amount if prev_balance else balance_type.opening_balance))
        else:
            opening = Decimal(str(balance_type.opening_balance))
        pb.opening_amount = opening

    investment_rows = db.query(PeriodInvestment).filter(PeriodInvestment.finperiodid == period.finperiodid).all()
    for investment in investment_rows:
        if previous_period:
            prev_investment = db.get(PeriodInvestment, (previous_period.finperiodid, investment.investmentdesc))
            if prev_investment:
                investment.opening_value = Decimal(str(prev_investment.closing_value))


def recalculate_budget_chain(budgetid: int, db: Session) -> None:
    periods = ordered_budget_periods(budgetid, db)
    previous_period: FinancialPeriod | None = None
    for period in periods:
        rebalance_period_openings(period, previous_period, db)
        if previous_period is not None and previous_period.closed_at is not None:
            upsert_carried_forward_line(period.finperiodid, period.budgetid, carry_forward_amount_for_period(previous_period), db)
        else:
            remove_carried_forward_line(period.finperiodid, db)
        sync_period_state(period.finperiodid, db)
        previous_period = period


def next_period_for(period: FinancialPeriod, db: Session) -> FinancialPeriod | None:
    return (
        db.query(FinancialPeriod)
        .filter(
            FinancialPeriod.budgetid == period.budgetid,
            FinancialPeriod.startdate > period.startdate,
        )
        .order_by(FinancialPeriod.startdate, FinancialPeriod.finperiodid)
        .first()
    )


def assign_period_lifecycle_states(budgetid: int, db: Session) -> None:
    from datetime import timezone
    periods = ordered_budget_periods(budgetid, db)
    now = utc_now()
    for period in periods:
        status = cycle_status(period)
        if status == CLOSED:
            continue
        # Ensure period.startdate has timezone info for comparison
        startdate = period.startdate if period.startdate.tzinfo else period.startdate.replace(tzinfo=timezone.utc)
        if startdate <= now:
            period.cycle_status = ACTIVE
        else:
            period.cycle_status = PLANNED


def create_next_cycle(period: FinancialPeriod, budget: Budget, db: Session) -> FinancialPeriod:
    startdate = period.enddate + timedelta(days=1)
    enddate = calc_period_end(startdate, budget.budget_frequency)
    next_period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=startdate,
        enddate=enddate,
        budgetowner=budget.budgetowner,
        islocked=False,
        cycle_status=PLANNED,
    )
    db.add(next_period)
    db.flush()

    income_types = db.query(IncomeType).filter(
        IncomeType.budgetid == budget.budgetid,
        IncomeType.autoinclude == True,  # noqa: E712
    ).all()
    expense_items = db.query(ExpenseItem).filter(
        ExpenseItem.budgetid == budget.budgetid,
        ExpenseItem.active == True,  # noqa: E712
    ).all()
    balance_types = db.query(BalanceType).filter(
        BalanceType.budgetid == budget.budgetid,
        BalanceType.active == True,  # noqa: E712
    ).all()
    investment_items = db.query(InvestmentItem).filter(
        InvestmentItem.budgetid == budget.budgetid,
        InvestmentItem.active == True,  # noqa: E712
    ).all()

    for income_type in income_types:
        db.add(PeriodIncome(
            finperiodid=next_period.finperiodid,
            budgetid=budget.budgetid,
            incomedesc=income_type.incomedesc,
            budgetamount=Decimal(str(income_type.amount)),
            actualamount=Decimal("0.00"),
            varianceamount=Decimal("0.00"),
            revision_snapshot=income_type.revisionnum,
        ))

    for expense_item in expense_items:
        if expense_item.freqtype == "Always":
            budgeted = Decimal(str(expense_item.expenseamount))
        elif expense_item.freqtype and expense_item.frequency_value and expense_item.effectivedate:
            budgeted = expense_occurs_in_period(
                freqtype=expense_item.freqtype,
                frequency_value=expense_item.frequency_value,
                effectivedate=expense_item.effectivedate,
                period_start=startdate,
                period_end=enddate,
                expense_amount=Decimal(str(expense_item.expenseamount)),
            )
        else:
            budgeted = None

        if budgeted is not None:
            db.add(PeriodExpense(
                finperiodid=next_period.finperiodid,
                budgetid=budget.budgetid,
                expensedesc=expense_item.expensedesc,
                budgetamount=budgeted,
                actualamount=Decimal("0.00"),
                varianceamount=Decimal("0.00"),
                is_oneoff=False,
                sort_order=expense_item.sort_order,
                revision_snapshot=expense_item.revisionnum,
                status=WORKING,
            ))

    for balance_type in balance_types:
        db.add(PeriodBalance(
            finperiodid=next_period.finperiodid,
            budgetid=budget.budgetid,
            balancedesc=balance_type.balancedesc,
            opening_amount=Decimal(str(balance_type.opening_balance)),
            closing_amount=Decimal(str(balance_type.opening_balance)),
        ))

    for investment_item in investment_items:
        db.add(PeriodInvestment(
            finperiodid=next_period.finperiodid,
            budgetid=budget.budgetid,
            investmentdesc=investment_item.investmentdesc,
            opening_value=Decimal(str(investment_item.initial_value)),
            closing_value=Decimal(str(investment_item.initial_value)),
            budgeted_amount=Decimal(str(investment_item.planned_amount or 0)),
            actualamount=Decimal("0.00"),
            revision_snapshot=investment_item.revisionnum,
            status=WORKING,
        ))

    return next_period


def build_closeout_preview(period: FinancialPeriod, budget: Budget, db: Session) -> dict:
    periods = ordered_budget_periods(period.budgetid, db)
    current, future, historical = lifecycle_groups(periods)
    health = _build_current_period_check(budget, current or [period], future, historical)
    totals = _current_period_totals(period)
    next_period = next_period_for(period, db)
    return {
        "period": period,
        "next_period": next_period,
        "carry_forward_amount": carry_forward_amount_for_period(period),
        "totals": {key: str(value) for key, value in totals.items()},
        "health": health,
        "next_cycle_exists": next_period is not None,
        "can_close_early": utc_now() <= (period.enddate if period.enddate.tzinfo else period.enddate.replace(tzinfo=timezone.utc)),
    }


def close_cycle(period: FinancialPeriod, budget: Budget, comments: str | None, goals: str | None, create_next_cycle_if_missing: bool, db: Session) -> tuple[FinancialPeriod, FinancialPeriod | None]:
    next_period = next_period_for(period, db)
    if next_period is None and create_next_cycle_if_missing:
        next_period = create_next_cycle(period, budget, db)
    if next_period is None:
        raise ValueError("A next budget cycle is required before this cycle can be closed")

    preview = build_closeout_preview(period, budget, db)

    for expense in db.query(PeriodExpense).filter(PeriodExpense.finperiodid == period.finperiodid).all():
        if (expense.status or WORKING) != PAID:
            expense.status = PAID

    for investment in db.query(PeriodInvestment).filter(PeriodInvestment.finperiodid == period.finperiodid).all():
        if (investment.status or WORKING) != PAID:
            investment.status = PAID

    sync_period_state(period.finperiodid, db)
    period.cycle_status = CLOSED
    period.closed_at = utc_now()
    period.islocked = True

    next_period.cycle_status = ACTIVE
    next_period.islocked = False

    snapshot = db.get(PeriodCloseoutSnapshot, period.finperiodid)
    if snapshot is None:
        snapshot = PeriodCloseoutSnapshot(finperiodid=period.finperiodid)
        db.add(snapshot)
    snapshot.comments = comments or None
    snapshot.goals = goals or None
    snapshot.carry_forward_amount = preview["carry_forward_amount"]
    snapshot.health_snapshot_json = json.dumps(preview["health"])
    snapshot.totals_snapshot_json = json.dumps(preview["totals"])

    recalculate_budget_chain(period.budgetid, db)
    return period, next_period
