from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from threading import Event, Lock, Thread
from time import sleep

from sqlalchemy.orm import Session

from .cycle_constants import ACTIVE, CLOSED, PAID
from .database import SessionLocal
from .models import Budget, ExpenseItem, FinancialPeriod, PeriodExpense, PeriodTransaction
from .period_logic import expense_occurs_in_period, fixed_day_occurrence_for_month
from .time_utils import app_now_naive
from .transaction_ledger import build_expense_tx, get_primary_account_desc, sync_period_state

_scheduler_lock = Lock()
_scheduler_started = False
_scheduler_stop = Event()


@dataclass
class AutoExpenseResult:
    created_count: int = 0
    skipped_count: int = 0
    skipped_reasons: list[str] | None = None

    def __post_init__(self) -> None:
        if self.skipped_reasons is None:
            self.skipped_reasons = []


def expense_has_valid_schedule(item: ExpenseItem) -> bool:
    if item.freqtype == "Always":
        return False
    return bool(item.freqtype and item.frequency_value and item.effectivedate)


def normalize_expense_paytype(
    *,
    paytype: str | None,
    freqtype: str | None,
    frequency_value: int | None,
    effectivedate: datetime | None,
) -> str:
    if paytype != "AUTO":
        return "MANUAL" if paytype in {None, ""} else paytype
    if freqtype == "Always":
        raise ValueError("AUTO is only available for scheduled expenses. Always included expenses must stay MANUAL.")
    if not (freqtype and frequency_value and effectivedate):
        raise ValueError("AUTO is only available for scheduled expenses with a complete schedule.")
    return "AUTO"


def scheduled_due_dates_for_period(item: ExpenseItem, period: FinancialPeriod) -> list[datetime]:
    if not expense_has_valid_schedule(item):
        return []

    if expense_occurs_in_period(
        freqtype=item.freqtype,
        frequency_value=item.frequency_value,
        effectivedate=item.effectivedate,
        period_start=period.startdate,
        period_end=period.enddate,
        expense_amount=Decimal(str(item.expenseamount)),
    ) is None:
        return []

    due_dates: list[datetime] = []
    if item.freqtype == "Fixed Day of Month":
        cursor = (period.startdate.replace(day=1) - timedelta(days=1)).replace(day=1)
        while cursor <= period.enddate:
            candidate = fixed_day_occurrence_for_month(cursor, item.frequency_value)
            if period.startdate <= candidate <= period.enddate:
                due_dates.append(candidate)
            cursor = (cursor.replace(day=28) + timedelta(days=4)).replace(day=1)
        return due_dates

    current = item.effectivedate
    if current < period.startdate:
        delta = (period.startdate - current).days
        steps = (delta + item.frequency_value - 1) // item.frequency_value
        current = current + timedelta(days=steps * item.frequency_value)
    while current <= period.enddate:
        due_dates.append(current)
        current = current + timedelta(days=item.frequency_value)
    return due_dates


def effective_run_date(*, due_date: datetime, period_end: datetime, offset_days: int) -> datetime:
    if due_date.date() == period_end.date():
        return due_date
    return due_date + timedelta(days=offset_days)


def process_auto_expenses_for_period(finperiodid: int, db: Session, *, run_date: datetime | None = None) -> AutoExpenseResult:
    result = AutoExpenseResult()
    period = db.get(FinancialPeriod, finperiodid)
    if not period:
        result.skipped_count += 1
        result.skipped_reasons.append("Period not found")
        return result

    budget = db.get(Budget, period.budgetid)
    if not budget or not budget.auto_expense_enabled:
        result.skipped_count += 1
        result.skipped_reasons.append("Auto Expense is disabled for this budget")
        return result

    if getattr(period, "cycle_status", None) == CLOSED:
        result.skipped_count += 1
        result.skipped_reasons.append("Budget cycle is closed")
        return result

    if not get_primary_account_desc(period.budgetid, db):
        result.skipped_count += 1
        result.skipped_reasons.append("No primary account is configured")
        return result

    today = (run_date or app_now_naive()).replace(hour=0, minute=0, second=0, microsecond=0)
    expenses = (
        db.query(PeriodExpense)
        .filter(PeriodExpense.finperiodid == finperiodid)
        .order_by(PeriodExpense.sort_order, PeriodExpense.expensedesc)
        .all()
    )
    touched_period = False

    for expense in expenses:
        if (expense.status or "Current") == PAID:
            result.skipped_count += 1
            result.skipped_reasons.append(f'{expense.expensedesc}: Expense is marked Paid')
            continue

        item = db.get(ExpenseItem, (expense.budgetid, expense.expensedesc))
        if not item or item.paytype != "AUTO":
            result.skipped_count += 1
            result.skipped_reasons.append(f'{expense.expensedesc}: Expense is not set to AUTO')
            continue
        if not expense_has_valid_schedule(item):
            result.skipped_count += 1
            result.skipped_reasons.append(f'{expense.expensedesc}: Expense does not have a valid schedule')
            continue

        for due_date in scheduled_due_dates_for_period(item, period):
            due_day = due_date.replace(hour=0, minute=0, second=0, microsecond=0)
            run_day = effective_run_date(
                due_date=due_day,
                period_end=period.enddate.replace(hour=0, minute=0, second=0, microsecond=0),
                offset_days=budget.auto_expense_offset_days,
            )
            if run_day > today:
                continue

            dedupe_key = f"auto-expense:{finperiodid}:{expense.expensedesc}:{due_day.date().isoformat()}"
            existing_tx = (
                db.query(PeriodTransaction)
                .filter(PeriodTransaction.dedupe_key == dedupe_key)
                .first()
            )
            if existing_tx:
                result.skipped_count += 1
                result.skipped_reasons.append(f'{expense.expensedesc}: AUTO transaction for {due_day.date().isoformat()} already exists')
                continue
            tx = build_expense_tx(
                finperiodid,
                expense.budgetid,
                expense.expensedesc,
                item.expenseamount,
                db,
                is_system=True,
                system_reason="auto_expense_due",
                note=f"Auto expense created for due date {due_day.date().isoformat()}",
                entrydate=run_day,
                dedupe_key=dedupe_key,
            )
            if tx is None:
                result.skipped_count += 1
                result.skipped_reasons.append(f'{expense.expensedesc}: Amount resolved to zero')
                continue
            touched_period = True
            result.created_count += 1

    if touched_period:
        sync_period_state(finperiodid, db)
    return result


def process_daily_auto_expenses(*, run_date: datetime | None = None) -> None:
    with SessionLocal() as db:
        active_period_ids = [
            finperiodid
            for (finperiodid,) in (
                db.query(FinancialPeriod.finperiodid)
                .join(Budget, Budget.budgetid == FinancialPeriod.budgetid)
                .filter(
                    Budget.auto_expense_enabled == True,  # noqa: E712
                    FinancialPeriod.cycle_status == ACTIVE,
                )
                .all()
            )
        ]
        for finperiodid in active_period_ids:
            process_auto_expenses_for_period(finperiodid, db, run_date=run_date)
        db.commit()


def _auto_expense_scheduler_loop() -> None:
    last_run_date = None
    while not _scheduler_stop.is_set():
        now = app_now_naive()
        today = now.date()
        if last_run_date != today:
            try:
                process_daily_auto_expenses(run_date=now)
            except Exception:
                pass
            last_run_date = today
        sleep(60)


def start_auto_expense_scheduler() -> None:
    global _scheduler_started
    with _scheduler_lock:
        if _scheduler_started:
            return
        thread = Thread(target=_auto_expense_scheduler_loop, name="dosh-auto-expense-scheduler", daemon=True)
        thread.start()
        _scheduler_started = True
