from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy.orm import Session

from ..api_docs import DbSession, error_responses
from ..models import FinancialPeriod, PeriodTransaction
from ..schemas import PeriodTransactionOut

router = APIRouter(prefix="/periods", tags=["period-transactions"])


def _get_period_or_404(finperiodid: int, db: Session) -> FinancialPeriod:
    period = db.get(FinancialPeriod, finperiodid)
    if not period:
        raise HTTPException(404, "Period not found")
    return period


@router.get("/{finperiodid}/transactions", response_model=list[PeriodTransactionOut], responses=error_responses(404))
def list_period_transactions(
    finperiodid: int,
    db: DbSession,
    source: Optional[str] = Query(None),
    source_key: Optional[str] = Query(None),
    balancedesc: Optional[str] = Query(None),
):
    _get_period_or_404(finperiodid, db)
    q = db.query(PeriodTransaction).filter(PeriodTransaction.finperiodid == finperiodid)
    if source:
        q = q.filter(PeriodTransaction.source == source)
    if source_key:
        q = q.filter(PeriodTransaction.source_key == source_key)
    if balancedesc:
        q = q.filter(
            (PeriodTransaction.affected_account_desc == balancedesc)
            | (PeriodTransaction.related_account_desc == balancedesc)
        )
    return q.order_by(PeriodTransaction.entrydate, PeriodTransaction.id).all()


@router.get("/{finperiodid}/balances/{balancedesc}/transactions", response_model=list[PeriodTransactionOut], responses=error_responses(404))
def list_balance_transactions(
    finperiodid: int,
    balancedesc: str,
    db: DbSession,
):
    _get_period_or_404(finperiodid, db)
    return (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.finperiodid == finperiodid,
            (PeriodTransaction.affected_account_desc == balancedesc)
            | (PeriodTransaction.related_account_desc == balancedesc),
        )
        .order_by(PeriodTransaction.entrydate, PeriodTransaction.id)
        .all()
    )
