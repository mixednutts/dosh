"""
Expense entry transactions — the child records that drive actualamount on periodexpenses.
"""
from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from ..api_docs import DbSession, error_responses
from ..cycle_constants import CLOSED, PAID
from ..models import FinancialPeriod, PeriodExpense, PeriodTransaction, ExpenseItem, BalanceType
from ..schemas import ExpenseEntryCreate, ExpenseEntryOut
from ..transaction_ledger import build_expense_tx, get_primary_account_desc, sync_period_state

router = APIRouter(prefix="/periods/{finperiodid}/expenses/{expensedesc}/entries", tags=["expense-entries"])


def _to_expense_entry_out(tx: PeriodTransaction) -> ExpenseEntryOut:
    return ExpenseEntryOut(
        id=tx.id,
        finperiodid=tx.finperiodid,
        budgetid=tx.budgetid,
        expensedesc=tx.source_key or "",
        amount=tx.amount,
        note=tx.note,
        entrydate=tx.entrydate,
        type=tx.type,
        entry_kind=getattr(tx, "entry_kind", "movement"),
        line_status=getattr(tx, "line_status", None),
        budget_scope=getattr(tx, "budget_scope", None),
        budget_before_amount=getattr(tx, "budget_before_amount", None),
        budget_after_amount=getattr(tx, "budget_after_amount", None),
        revisionnum=getattr(tx, "revisionnum", None),
        affected_account_desc=getattr(tx, "affected_account_desc", None),
    )


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
    if (getattr(pe, "status", "Current") or "Current") == PAID:
        raise HTTPException(423, "Expense is marked Paid — revise it before making changes")


@router.get("/", response_model=list[ExpenseEntryOut], responses=error_responses(404))
def list_entries(finperiodid: int, expensedesc: str, db: DbSession):
    _get_period_expense(finperiodid, expensedesc, db)
    rows = (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.finperiodid == finperiodid,
            PeriodTransaction.source == "expense",
            PeriodTransaction.source_key == expensedesc,
        )
        .order_by(PeriodTransaction.entrydate, PeriodTransaction.id)
        .all()
    )
    return [_to_expense_entry_out(row) for row in rows]


@router.post("/", response_model=ExpenseEntryOut, status_code=201, responses=error_responses(404, 422, 423))
def add_entry(
    finperiodid: int,
    expensedesc: str,
    payload: ExpenseEntryCreate,
    db: DbSession,
):
    period = db.get(FinancialPeriod, finperiodid)
    if not period:
        raise HTTPException(404, "Period not found")
    if getattr(period, "cycle_status", None) == CLOSED:
        raise HTTPException(423, "Budget cycle is closed")

    pe = _get_period_expense(finperiodid, expensedesc, db)
    _assert_expense_not_paid(pe)
    if not get_primary_account_desc(pe.budgetid, db):
        raise HTTPException(422, "Set one account as the primary account before recording expense activity.")

    account_desc = None
    if payload.account_desc:
        bt = db.get(BalanceType, (pe.budgetid, payload.account_desc))
        if not bt:
            raise HTTPException(404, "Account not found")
        if not bt.active:
            raise HTTPException(422, "Account is not active")
        account_desc = payload.account_desc
    else:
        expense_item = db.get(ExpenseItem, (pe.budgetid, expensedesc))
        if expense_item and expense_item.default_account_desc:
            account_desc = expense_item.default_account_desc

    entry = build_expense_tx(
        finperiodid,
        pe.budgetid,
        expensedesc,
        payload.amount,
        db,
        note=payload.note,
        entrydate=payload.entrydate,
        account_desc=account_desc,
    )
    sync_period_state(finperiodid, db)
    db.commit()
    db.refresh(entry)
    return _to_expense_entry_out(entry)


@router.delete("/{entry_id}", status_code=204, responses=error_responses(404, 423))
def delete_entry(
    finperiodid: int,
    expensedesc: str,
    entry_id: int,
    db: DbSession,
):
    period = db.get(FinancialPeriod, finperiodid)
    if not period:
        raise HTTPException(404, "Period not found")
    if getattr(period, "cycle_status", None) == CLOSED:
        raise HTTPException(423, "Budget cycle is closed")

    entry = db.get(PeriodTransaction, entry_id)
    if not entry or entry.finperiodid != finperiodid or entry.source != "expense" or entry.source_key != expensedesc:
        raise HTTPException(404, "Entry not found")

    pe = _get_period_expense(finperiodid, expensedesc, db)
    _assert_expense_not_paid(pe)
    db.delete(entry)
    db.flush()
    sync_period_state(finperiodid, db)
    db.commit()
