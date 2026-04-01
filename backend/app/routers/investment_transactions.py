"""
Investment transactions — drive actualamount on periodinvestments and
optionally update the linked account balance.
"""
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    FinancialPeriod, InvestmentItem, PeriodInvestment,
    PeriodInvestmentTransaction, PeriodBalance,
)
from ..schemas import InvestmentTxCreate, InvestmentTxOut

router = APIRouter(
    prefix="/periods/{finperiodid}/investments/{investmentdesc}/transactions",
    tags=["investment-transactions"],
)


def _get_period_investment(finperiodid: int, investmentdesc: str, db: Session) -> PeriodInvestment:
    pi = db.get(PeriodInvestment, (finperiodid, investmentdesc))
    if not pi:
        raise HTTPException(404, "Investment line item not found in this period")
    return pi


def _resync(pi: PeriodInvestment, db: Session) -> None:
    """Recompute actualamount and closing_value from transactions."""
    transactions = db.query(PeriodInvestmentTransaction).filter(
        PeriodInvestmentTransaction.finperiodid == pi.finperiodid,
        PeriodInvestmentTransaction.budgetid == pi.budgetid,
        PeriodInvestmentTransaction.investmentdesc == pi.investmentdesc,
    ).all()
    total = sum(Decimal(str(t.amount)) for t in transactions)
    pi.actualamount = total
    pi.closing_value = Decimal(str(pi.opening_value)) + total


def _update_linked_account(finperiodid: int, budgetid: int, investmentdesc: str, delta: Decimal, db: Session) -> None:
    """If the investment item has a linked account, adjust its movement and closing balance."""
    ii = db.get(InvestmentItem, (budgetid, investmentdesc))
    if not ii or not ii.linked_account_desc:
        return
    pb = db.get(PeriodBalance, (finperiodid, ii.linked_account_desc))
    if not pb:
        return
    pb.movement_amount = Decimal(str(pb.movement_amount)) + delta
    pb.closing_amount = Decimal(str(pb.opening_amount)) + Decimal(str(pb.movement_amount))


@router.get("/", response_model=list[InvestmentTxOut])
def list_transactions(finperiodid: int, investmentdesc: str, db: Session = Depends(get_db)):
    _get_period_investment(finperiodid, investmentdesc, db)
    return (
        db.query(PeriodInvestmentTransaction)
        .filter(
            PeriodInvestmentTransaction.finperiodid == finperiodid,
            PeriodInvestmentTransaction.investmentdesc == investmentdesc,
        )
        .order_by(PeriodInvestmentTransaction.entrydate)
        .all()
    )


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

    tx = PeriodInvestmentTransaction(
        finperiodid=finperiodid,
        budgetid=pi.budgetid,
        investmentdesc=investmentdesc,
        amount=payload.amount,
        note=payload.note,
        linked_incomedesc=payload.linked_incomedesc,
    )
    db.add(tx)
    db.flush()

    _resync(pi, db)
    _update_linked_account(finperiodid, pi.budgetid, investmentdesc, payload.amount, db)

    db.commit()
    db.refresh(tx)
    return tx


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

    tx = db.get(PeriodInvestmentTransaction, tx_id)
    if not tx or tx.finperiodid != finperiodid or tx.investmentdesc != investmentdesc:
        raise HTTPException(404, "Transaction not found")

    tx_amount = Decimal(str(tx.amount))
    pi = _get_period_investment(finperiodid, investmentdesc, db)

    db.delete(tx)
    db.flush()

    _resync(pi, db)
    _update_linked_account(finperiodid, pi.budgetid, investmentdesc, -tx_amount, db)

    db.commit()
