"""Code-backed data source executors for the Budget Health Engine.

These functions are referenced by HealthDataSource.executor_path and are called
by the engine runner at evaluation time.
"""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session
    from app.models import FinancialPeriod


def total_budgeted_income(db: Session, finperiodid: int) -> Decimal:
    from app.models import PeriodIncome
    result = db.query(PeriodIncome).filter_by(finperiodid=finperiodid).all()
    return sum((r.budgetamount or Decimal(0)) for r in result)


def total_budgeted_expenses(db: Session, finperiodid: int) -> Decimal:
    from app.models import PeriodExpense
    result = db.query(PeriodExpense).filter_by(finperiodid=finperiodid).all()
    return sum((r.budgetamount or Decimal(0)) for r in result)


def total_actual_expenses(db: Session, finperiodid: int) -> Decimal:
    from app.models import PeriodExpense
    result = db.query(PeriodExpense).filter_by(finperiodid=finperiodid).all()
    return sum((r.actualamount or Decimal(0)) for r in result)


def income_source_count(db: Session, budgetid: int) -> int:
    from app.models import IncomeType
    return db.query(IncomeType).filter_by(budgetid=budgetid).count()


def active_expense_count(db: Session, budgetid: int) -> int:
    from app.models import ExpenseItem
    return db.query(ExpenseItem).filter_by(budgetid=budgetid, active=True).count()


def future_period_count(db: Session, budgetid: int) -> int:
    from datetime import datetime, timezone
    from app.models import FinancialPeriod
    now = datetime.now(timezone.utc)
    return db.query(FinancialPeriod).filter(
        FinancialPeriod.budgetid == budgetid,
        FinancialPeriod.startdate > now,
    ).count()


def historical_overrun_ratio(db: Session, budgetid: int) -> Decimal:
    from datetime import datetime, timezone
    from app.models import FinancialPeriod, PeriodExpense
    now = datetime.now(timezone.utc)
    periods = db.query(FinancialPeriod).filter(
        FinancialPeriod.budgetid == budgetid,
        FinancialPeriod.enddate < now,
        FinancialPeriod.islocked == True,
    ).all()
    if not periods:
        return Decimal(0)
    ratios = []
    for period in periods:
        expenses = db.query(PeriodExpense).filter_by(finperiodid=period.finperiodid).all()
        budgeted = sum((e.budgetamount or Decimal(0)) for e in expenses)
        actual = sum((e.actualamount or Decimal(0)) for e in expenses)
        if budgeted > 0:
            ratios.append((actual / budgeted) - Decimal(1))
        else:
            ratios.append(Decimal(0))
    if not ratios:
        return Decimal(0)
    return sum(ratios) / Decimal(len(ratios))


def revised_line_count(db: Session, finperiodid: int) -> int:
    from app.models import PeriodExpense, PeriodIncome
    expense_revisions = db.query(PeriodExpense).filter(
        PeriodExpense.finperiodid == finperiodid,
        PeriodExpense.status == "Revised",
    ).count()
    income_revisions = db.query(PeriodIncome).filter(
        PeriodIncome.finperiodid == finperiodid,
        PeriodIncome.status == "Revised",
    ).count()
    return expense_revisions + income_revisions


def live_period_surplus(db: Session, finperiodid: int) -> Decimal:
    income = total_budgeted_income(db, finperiodid)
    expenses = total_budgeted_expenses(db, finperiodid)
    return income - expenses


def period_progress_ratio(db: Session, finperiodid: int) -> Decimal:
    from datetime import datetime, timezone
    from app.models import FinancialPeriod
    period = db.query(FinancialPeriod).filter_by(finperiodid=finperiodid).first()
    if not period:
        return Decimal(0)
    now = datetime.now(timezone.utc)
    start = period.startdate
    end = period.enddate
    if now <= start:
        return Decimal(0)
    if now >= end:
        return Decimal(1)
    total_seconds = (end - start).total_seconds()
    elapsed_seconds = (now - start).total_seconds()
    if total_seconds <= 0:
        return Decimal(1)
    return Decimal(elapsed_seconds / total_seconds)
