"""
Income transactions — drive actualamount on periodincome rows using the unified ledger.
"""
from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from ..api_docs import DbSession, error_responses

from ..cycle_constants import CLOSED, PAID, WORKING
from ..models import FinancialPeriod, PeriodIncome, PeriodTransaction
from ..schemas import IncomeTxCreate, IncomeTxOut
from ..transaction_ledger import TRANSFER_PREFIX, build_income_tx, sync_period_state

router = APIRouter(
    prefix="/periods/{finperiodid}/income/{incomedesc}/transactions",
    tags=["income-transactions"],
)


def _transaction_source(incomedesc: str) -> str:
    return "transfer" if incomedesc.startswith(TRANSFER_PREFIX) else "income"


def _to_income_tx_out(tx: PeriodTransaction) -> IncomeTxOut:
    return IncomeTxOut(
        id=tx.id,
        finperiodid=tx.finperiodid,
        budgetid=tx.budgetid,
        incomedesc=tx.source_key or "",
        amount=tx.amount,
        note=tx.note,
        entrydate=tx.entrydate,
        source=tx.source,
        type=tx.type,
        affected_account_desc=tx.affected_account_desc,
        related_account_desc=tx.related_account_desc,
        entry_kind=getattr(tx, "entry_kind", "movement"),
        line_status=getattr(tx, "line_status", None),
        budget_scope=getattr(tx, "budget_scope", None),
        budget_before_amount=getattr(tx, "budget_before_amount", None),
        budget_after_amount=getattr(tx, "budget_after_amount", None),
        revisionnum=getattr(tx, "revisionnum", None),
    )


def _get_period_income(finperiodid: int, incomedesc: str, db: Session) -> PeriodIncome:
    pi = db.get(PeriodIncome, (finperiodid, incomedesc))
    if not pi:
        raise HTTPException(404, "Income line item not found in this period")
    return pi


@router.get("/", response_model=list[IncomeTxOut], responses=error_responses(404))
def list_transactions(finperiodid: int, incomedesc: str, db: DbSession):
    _get_period_income(finperiodid, incomedesc, db)
    rows = (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.finperiodid == finperiodid,
            PeriodTransaction.source_key == incomedesc,
            PeriodTransaction.source.in_([_transaction_source(incomedesc), "income"]),
        )
        .order_by(PeriodTransaction.entrydate, PeriodTransaction.id)
        .all()
    )
    return [_to_income_tx_out(row) for row in rows]


@router.post("/", response_model=IncomeTxOut, status_code=201, responses=error_responses(404, 423))
def add_transaction(
    finperiodid: int,
    incomedesc: str,
    payload: IncomeTxCreate,
    db: DbSession,
):
    period = db.get(FinancialPeriod, finperiodid)
    if not period:
        raise HTTPException(404, "Period not found")
    if getattr(period, "cycle_status", None) == CLOSED:
        raise HTTPException(423, "Budget cycle is closed")

    pi = _get_period_income(finperiodid, incomedesc, db)
    if (getattr(pi, "status", WORKING) or WORKING) == PAID:
        raise HTTPException(423, "Paid income must be revised before adding transactions")
    tx = build_income_tx(
        finperiodid,
        pi.budgetid,
        incomedesc,
        payload.amount,
        db,
        note=payload.note,
        entrydate=payload.entrydate,
    )
    sync_period_state(finperiodid, db)
    db.commit()
    db.refresh(tx)
    return _to_income_tx_out(tx)


@router.delete("/{tx_id}", status_code=204, responses=error_responses(404, 423))
def delete_transaction(
    finperiodid: int,
    incomedesc: str,
    tx_id: int,
    db: DbSession,
):
    period = db.get(FinancialPeriod, finperiodid)
    if not period:
        raise HTTPException(404, "Period not found")
    if getattr(period, "cycle_status", None) == CLOSED:
        raise HTTPException(423, "Budget cycle is closed")

    tx = db.get(PeriodTransaction, tx_id)
    expected_source = _transaction_source(incomedesc)
    if not tx or tx.finperiodid != finperiodid or tx.source != expected_source or tx.source_key != incomedesc:
        raise HTTPException(404, "Transaction not found")

    _get_period_income(finperiodid, incomedesc, db)
    db.delete(tx)
    db.flush()
    sync_period_state(finperiodid, db)
    db.commit()
