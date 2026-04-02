"""
Investment transactions — drive actualamount on periodinvestments and
optionally update the linked account balance.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
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
    )


def _get_period_investment(finperiodid: int, investmentdesc: str, db: Session) -> PeriodInvestment:
    pi = db.get(PeriodInvestment, (finperiodid, investmentdesc))
    if not pi:
        raise HTTPException(404, "Investment line item not found in this period")
    return pi

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
    if period.islocked:
        raise HTTPException(423, "Period is locked")

    pi = _get_period_investment(finperiodid, investmentdesc, db)

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
    if period.islocked:
        raise HTTPException(423, "Period is locked")

    tx = db.get(PeriodTransaction, tx_id)
    if not tx or tx.finperiodid != finperiodid or tx.source != "investment" or tx.source_key != investmentdesc:
        raise HTTPException(404, "Transaction not found")

    pi = _get_period_investment(finperiodid, investmentdesc, db)

    db.delete(tx)
    db.flush()
    sync_period_state(finperiodid, db)
    db.commit()
