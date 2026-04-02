"""
Expense entry transactions — the child records that drive actualamount on periodexpenses.
"""
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import FinancialPeriod, PeriodExpense, PeriodExpenseEntry, BalanceType, PeriodBalance
from ..schemas import ExpenseEntryCreate, ExpenseEntryOut

router = APIRouter(prefix="/periods/{finperiodid}/expenses/{expensedesc}/entries", tags=["expense-entries"])


def _get_period_expense(finperiodid: int, expensedesc: str, db: Session) -> PeriodExpense:
    pe = (
        db.query(PeriodExpense)
        .filter(
            PeriodExpense.finperiodid == finperiodid,
            PeriodExpense.expensedesc == expensedesc,
        )
        .first()
    )
    if not pe:
        raise HTTPException(404, "Expense line item not found in this period")
    return pe


def _assert_expense_not_paid(pe: PeriodExpense) -> None:
    if (getattr(pe, "status", "Current") or "Current") == "Paid":
        raise HTTPException(423, "Expense is marked Paid — revise it before making changes")


def _debit_primary_account(finperiodid: int, budgetid: int, delta: Decimal, db: Session) -> None:
    primary = (
        db.query(BalanceType)
        .filter(BalanceType.budgetid == budgetid, BalanceType.is_primary == True)  # noqa: E712
        .first()
    )
    if not primary:
        return
    pb = db.get(PeriodBalance, (finperiodid, primary.balancedesc))
    if pb:
        pb.movement_amount = Decimal(str(pb.movement_amount)) - delta
        pb.closing_amount = Decimal(str(pb.opening_amount)) + Decimal(str(pb.movement_amount))


def _resync_actual(pe: PeriodExpense, db: Session) -> None:
    """Recompute actualamount from the sum of entries and update varianceamount."""
    total = db.query(
        db.query(PeriodExpenseEntry.amount).filter(
            PeriodExpenseEntry.finperiodid == pe.finperiodid,
            PeriodExpenseEntry.budgetid == pe.budgetid,
            PeriodExpenseEntry.expensedesc == pe.expensedesc,
        ).subquery()
    )
    # simpler: use Python sum over loaded entries
    entries = db.query(PeriodExpenseEntry).filter(
        PeriodExpenseEntry.finperiodid == pe.finperiodid,
        PeriodExpenseEntry.budgetid == pe.budgetid,
        PeriodExpenseEntry.expensedesc == pe.expensedesc,
    ).all()
    pe.actualamount = sum(Decimal(str(e.amount)) for e in entries)
    pe.varianceamount = pe.actualamount - pe.budgetamount


@router.get("/", response_model=list[ExpenseEntryOut])
def list_entries(finperiodid: int, expensedesc: str, db: Session = Depends(get_db)):
    _get_period_expense(finperiodid, expensedesc, db)
    return (
        db.query(PeriodExpenseEntry)
        .filter(
            PeriodExpenseEntry.finperiodid == finperiodid,
            PeriodExpenseEntry.expensedesc == expensedesc,
        )
        .order_by(PeriodExpenseEntry.entrydate)
        .all()
    )


@router.post("/", response_model=ExpenseEntryOut, status_code=201)
def add_entry(
    finperiodid: int,
    expensedesc: str,
    payload: ExpenseEntryCreate,
    db: Session = Depends(get_db),
):
    period = db.get(FinancialPeriod, finperiodid)
    if not period:
        raise HTTPException(404, "Period not found")
    if period.islocked:
        raise HTTPException(423, "Period is locked")

    pe = _get_period_expense(finperiodid, expensedesc, db)
    _assert_expense_not_paid(pe)

    entry = PeriodExpenseEntry(
        finperiodid=finperiodid,
        budgetid=pe.budgetid,
        expensedesc=expensedesc,
        amount=payload.amount,
        note=payload.note,
    )
    db.add(entry)
    db.flush()

    _resync_actual(pe, db)
    _debit_primary_account(finperiodid, pe.budgetid, payload.amount, db)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=204)
def delete_entry(
    finperiodid: int,
    expensedesc: str,
    entry_id: int,
    db: Session = Depends(get_db),
):
    period = db.get(FinancialPeriod, finperiodid)
    if not period:
        raise HTTPException(404, "Period not found")
    if period.islocked:
        raise HTTPException(423, "Period is locked")

    entry = db.get(PeriodExpenseEntry, entry_id)
    if not entry or entry.finperiodid != finperiodid or entry.expensedesc != expensedesc:
        raise HTTPException(404, "Entry not found")

    pe = _get_period_expense(finperiodid, expensedesc, db)
    _assert_expense_not_paid(pe)
    entry_amount = Decimal(str(entry.amount))
    db.delete(entry)
    db.flush()
    _resync_actual(pe, db)
    _debit_primary_account(finperiodid, pe.budgetid, -entry_amount, db)
    db.commit()
