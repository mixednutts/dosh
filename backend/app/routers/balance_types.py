from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Budget, BalanceType, PeriodBalance, FinancialPeriod
from ..schemas import (
    BalanceTypeCreate, BalanceTypeOut, BalanceTypeUpdate,
    PeriodBalanceOut, PeriodBalanceUpdate,
)

router = APIRouter(prefix="/budgets/{budgetid}/balance-types", tags=["balance-types"])
period_router = APIRouter(prefix="/periods", tags=["period-balances"])


def _get_budget_or_404(budgetid: int, db: Session) -> Budget:
    b = db.get(Budget, budgetid)
    if not b:
        raise HTTPException(404, "Budget not found")
    return b


# ── Balance Types CRUD ────────────────────────────────────────────────────────

@router.get("/", response_model=list[BalanceTypeOut])
def list_balance_types(budgetid: int, db: Session = Depends(get_db)):
    _get_budget_or_404(budgetid, db)
    return db.query(BalanceType).filter(BalanceType.budgetid == budgetid).all()


def _clear_primary(budgetid: int, db: Session) -> None:
    db.query(BalanceType).filter(
        BalanceType.budgetid == budgetid,
        BalanceType.is_primary == True,  # noqa: E712
    ).update({"is_primary": False})


@router.post("/", response_model=BalanceTypeOut, status_code=201)
def create_balance_type(budgetid: int, payload: BalanceTypeCreate, db: Session = Depends(get_db)):
    _get_budget_or_404(budgetid, db)
    existing = db.get(BalanceType, (budgetid, payload.balancedesc))
    if existing:
        raise HTTPException(409, "Balance type with this description already exists")
    if payload.is_primary:
        _clear_primary(budgetid, db)
    bt = BalanceType(budgetid=budgetid, **payload.model_dump())
    db.add(bt)
    db.commit()
    db.refresh(bt)
    return bt


@router.patch("/{balancedesc}", response_model=BalanceTypeOut)
def update_balance_type(
    budgetid: int, balancedesc: str, payload: BalanceTypeUpdate, db: Session = Depends(get_db)
):
    bt = db.get(BalanceType, (budgetid, balancedesc))
    if not bt:
        raise HTTPException(404, "Balance type not found")
    if payload.is_primary:
        _clear_primary(budgetid, db)
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(bt, k, v)
    db.commit()
    db.refresh(bt)
    return bt


@router.delete("/{balancedesc}", status_code=204)
def delete_balance_type(budgetid: int, balancedesc: str, db: Session = Depends(get_db)):
    bt = db.get(BalanceType, (budgetid, balancedesc))
    if not bt:
        raise HTTPException(404, "Balance type not found")
    db.delete(bt)
    db.commit()


# ── Period Balance endpoints ──────────────────────────────────────────────────

@period_router.get("/{finperiodid}/balances", response_model=list[PeriodBalanceOut])
def list_period_balances(finperiodid: int, db: Session = Depends(get_db)):
    period = db.get(FinancialPeriod, finperiodid)
    if not period:
        raise HTTPException(404, "Period not found")
    rows = db.query(PeriodBalance).filter(PeriodBalance.finperiodid == finperiodid).all()
    # Enrich with balance_type label
    out = []
    for pb in rows:
        bt = db.get(BalanceType, (pb.budgetid, pb.balancedesc))
        d = PeriodBalanceOut.model_validate(pb)
        d.balance_type = bt.balance_type if bt else None
        out.append(d)
    return out


@period_router.patch("/{finperiodid}/balances/{balancedesc}", response_model=PeriodBalanceOut)
def update_period_balance(
    finperiodid: int,
    balancedesc: str,
    payload: PeriodBalanceUpdate,
    db: Session = Depends(get_db),
):
    raise HTTPException(405, "Period balance movement is calculated from transactions and cannot be edited directly")
