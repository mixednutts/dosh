"""
Investment transactions — drive actualamount on periodinvestments and
optionally update the linked account balance.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..cycle_constants import CLOSED, PAID
from ..database import get_db
from ..models import (
    FinancialPeriod, PeriodInvestment,
    PeriodTransaction,
)
from ..schemas import InvestmentTxCreate, InvestmentTxOut
from ..transaction_ledger import build_investment_tx, sync_period_state

router = APIRouter(
    prefix="/periods/{finperiodid}/investments/{investmentdesc}/transactions",
    tags=["investment-transactions"],
)


def _to_investment_tx_out(tx: PeriodTransaction) -> InvestmentTxOut:
    return InvestmentTxOut(
        id=tx.id,
        finperiodid=tx.finperiodid,
        budgetid=tx.budgetid,
        investmentdesc=tx.source_key or "",
        amount=tx.amount,
        note=tx.note,
        entrydate=tx.entrydate,
        linked_incomedesc=tx.linked_incomedesc,
        type=tx.type,
        entry_kind=getattr(tx, "entry_kind", "movement"),
        line_status=getattr(tx, "line_status", None),
        budget_scope=getattr(tx, "budget_scope", None),
        budget_before_amount=getattr(tx, "budget_before_amount", None),
        budget_after_amount=getattr(tx, "budget_after_amount", None),
    )


def _get_period_investment(finperiodid: int, investmentdesc: str, db: Session) -> PeriodInvestment:
    pi = db.get(PeriodInvestment, (finperiodid, investmentdesc))
    if not pi:
        raise HTTPException(404, "Investment line item not found in this period")
    return pi


def _assert_investment_not_paid(pi: PeriodInvestment) -> None:
    if (getattr(pi, "status", "Current") or "Current") == PAID:
        raise HTTPException(423, "Investment is marked Paid — revise it before making changes")

@router.get("/", response_model=list[InvestmentTxOut])
def list_transactions(finperiodid: int, investmentdesc: str, db: Session = Depends(get_db)):
    _get_period_investment(finperiodid, investmentdesc, db)
    rows = (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.finperiodid == finperiodid,
            PeriodTransaction.source == "investment",
            PeriodTransaction.source_key == investmentdesc,
        )
        .order_by(PeriodTransaction.entrydate, PeriodTransaction.id)
        .all()
    )
    return [_to_investment_tx_out(row) for row in rows]


@router.post("/", response_model=InvestmentTxOut, status_code=201)
def add_transaction(
    finperiodid: int,
    investmentdesc: str,
    payload: InvestmentTxCreate,
    db: Session = Depends(get_db),
):
    period = db.get(FinancialPeriod, finperiodid)
    if not period:
        raise HTTPException(404, "Period not found")
    if getattr(period, "cycle_status", None) == CLOSED:
        raise HTTPException(423, "Budget cycle is closed")

    pi = _get_period_investment(finperiodid, investmentdesc, db)
    _assert_investment_not_paid(pi)

    tx = build_investment_tx(
        finperiodid,
        pi.budgetid,
        investmentdesc,
        payload.amount,
        db,
        note=payload.note,
        linked_incomedesc=payload.linked_incomedesc,
    )
    sync_period_state(finperiodid, db)
    db.commit()
    db.refresh(tx)
    return _to_investment_tx_out(tx)


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(
    finperiodid: int,
    investmentdesc: str,
    tx_id: int,
    db: Session = Depends(get_db),
):
    period = db.get(FinancialPeriod, finperiodid)
    if not period:
        raise HTTPException(404, "Period not found")
    if getattr(period, "cycle_status", None) == CLOSED:
        raise HTTPException(423, "Budget cycle is closed")

    tx = db.get(PeriodTransaction, tx_id)
    if not tx or tx.finperiodid != finperiodid or tx.source != "investment" or tx.source_key != investmentdesc:
        raise HTTPException(404, "Transaction not found")

    pi = _get_period_investment(finperiodid, investmentdesc, db)
    _assert_investment_not_paid(pi)

    db.delete(tx)
    db.flush()
    sync_period_state(finperiodid, db)
    db.commit()
