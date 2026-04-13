"""
Investment transactions — drive actualamount on periodinvestments and
optionally update the linked account balance.
"""
from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from ..api_docs import DbSession, error_responses
from ..cycle_constants import CLOSED, PAID
from ..models import (
    BalanceType, FinancialPeriod, InvestmentItem, PeriodInvestment,
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
        revisionnum=getattr(tx, "revisionnum", None),
        affected_account_desc=getattr(tx, "affected_account_desc", None),
    )


def _get_period_investment(finperiodid: int, investmentdesc: str, db: Session) -> PeriodInvestment:
    pi = db.get(PeriodInvestment, (finperiodid, investmentdesc))
    if not pi:
        raise HTTPException(404, "Investment line item not found in this period")
    return pi


def _assert_investment_not_paid(pi: PeriodInvestment) -> None:
    if (getattr(pi, "status", "Current") or "Current") == PAID:
        raise HTTPException(423, "Investment is marked Paid — revise it before making changes")

@router.get("/", response_model=list[InvestmentTxOut], responses=error_responses(404))
def list_transactions(finperiodid: int, investmentdesc: str, db: DbSession):
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


@router.post("/", response_model=InvestmentTxOut, status_code=201, responses=error_responses(404, 423))
def add_transaction(
    finperiodid: int,
    investmentdesc: str,
    payload: InvestmentTxCreate,
    db: DbSession,
):
    period = db.get(FinancialPeriod, finperiodid)
    if not period:
        raise HTTPException(404, "Period not found")
    if getattr(period, "cycle_status", None) == CLOSED:
        raise HTTPException(423, "Budget cycle is closed")

    pi = _get_period_investment(finperiodid, investmentdesc, db)
    _assert_investment_not_paid(pi)

    item = db.get(InvestmentItem, (pi.budgetid, investmentdesc))
    account_desc = payload.account_desc
    if account_desc:
        bt = db.get(BalanceType, (pi.budgetid, account_desc))
        if not bt:
            raise HTTPException(422, f'Account "{account_desc}" does not exist for this budget')
        if not bt.active:
            raise HTTPException(422, f'Account "{account_desc}" is inactive')
    elif item and not item.source_account_desc:
        raise HTTPException(422, "Investment item does not have a debit account configured. Set one in Budget Setup before recording transactions.")

    tx = build_investment_tx(
        finperiodid,
        pi.budgetid,
        investmentdesc,
        payload.amount,
        db,
        note=payload.note,
        linked_incomedesc=payload.linked_incomedesc,
        entrydate=payload.entrydate,
        account_desc=account_desc,
    )
    sync_period_state(finperiodid, db)
    db.commit()
    db.refresh(tx)
    return _to_investment_tx_out(tx)


@router.delete("/{tx_id}", status_code=204, responses=error_responses(404, 423))
def delete_transaction(
    finperiodid: int,
    investmentdesc: str,
    tx_id: int,
    db: DbSession,
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
