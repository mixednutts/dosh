from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from ..api_docs import DbSession, error_responses
from ..models import Budget, BalanceType, PeriodBalance, FinancialPeriod
from ..schemas import (
    BalanceTypeCreate, BalanceTypeOut, BalanceTypeUpdate,
    PeriodBalanceOut, PeriodBalanceUpdate,
)
from ..setup_assessment import account_assessment

router = APIRouter(prefix="/budgets/{budgetid}/balance-types", tags=["balance-types"])
period_router = APIRouter(prefix="/periods", tags=["period-balances"])


def _get_budget_or_404(budgetid: int, db: Session) -> Budget:
    b = db.get(Budget, budgetid)
    if not b:
        raise HTTPException(404, "Budget not found")
    return b


# ── Balance Types CRUD ────────────────────────────────────────────────────────

@router.get("/", response_model=list[BalanceTypeOut], responses=error_responses(404))
def list_balance_types(budgetid: int, db: DbSession):
    _get_budget_or_404(budgetid, db)
    return db.query(BalanceType).filter(BalanceType.budgetid == budgetid).all()


def _clear_primary(budgetid: int, balance_type: str | None, db: Session) -> None:
    db.query(BalanceType).filter(
        BalanceType.budgetid == budgetid,
        BalanceType.balance_type == balance_type,
        BalanceType.is_primary == True,  # noqa: E712
    ).update({"is_primary": False})


def _assert_balance_delete_allowed(budgetid: int, balancedesc: str, db: Session) -> None:
    assessment = account_assessment(budgetid, balancedesc, db)
    if not assessment["can_delete"]:
        raise HTTPException(422, f'Account "{balancedesc}" is in use and cannot be changed this way. {"; ".join(assessment["reasons"])}.')


def _assert_balance_deactivate_allowed(budgetid: int, balancedesc: str, db: Session) -> None:
    assessment = account_assessment(budgetid, balancedesc, db)
    if not assessment["can_deactivate"]:
        raise HTTPException(422, f'Account "{balancedesc}" is in use and cannot be deactivated. {"; ".join(assessment["reasons"])}.')


def _assert_balance_edit_allowed(budgetid: int, balancedesc: str, db: Session) -> None:
    assessment = account_assessment(budgetid, balancedesc, db)
    if not assessment["can_edit_structure"]:
        raise HTTPException(422, f'Account "{balancedesc}" is in use and its structure cannot be edited. {"; ".join(assessment["reasons"])}.')


def _assert_active_primary_will_remain(
    budgetid: int,
    balancedesc: str,
    bt: BalanceType,
    updates: dict,
    db: Session,
) -> None:
    was_active_primary = bool(bt.active and bt.is_primary)
    will_be_active = updates.get("active", bt.active)
    will_be_primary = updates.get("is_primary", bt.is_primary)
    active_transaction_accounts_exist = (
        db.query(BalanceType)
        .filter(
            BalanceType.budgetid == budgetid,
            BalanceType.balancedesc != balancedesc,
            BalanceType.active == True,  # noqa: E712
            BalanceType.balance_type == "Transaction",
        )
        .first()
        is not None
    ) or (
        updates.get("balance_type", bt.balance_type) == "Transaction" and will_be_active
    )

    if not was_active_primary or (will_be_active and will_be_primary) or not active_transaction_accounts_exist:
        return

    other_active_primary = (
        db.query(BalanceType)
        .filter(
            BalanceType.budgetid == budgetid,
            BalanceType.balancedesc != balancedesc,
            BalanceType.active == True,  # noqa: E712
            BalanceType.is_primary == True,  # noqa: E712
            BalanceType.balance_type == "Transaction",
        )
        .first()
    )
    if other_active_primary is None:
        raise HTTPException(422, "One active primary account is required. Choose another primary account before removing this one.")


def _assert_delete_wont_remove_required_primary(
    budgetid: int,
    bt: BalanceType,
    db: Session,
) -> None:
    if not (bt.active and bt.is_primary and bt.balance_type == "Transaction"):
        return

    other_active_transaction = (
        db.query(BalanceType)
        .filter(
            BalanceType.budgetid == budgetid,
            BalanceType.balancedesc != bt.balancedesc,
            BalanceType.active == True,  # noqa: E712
            BalanceType.balance_type == "Transaction",
        )
        .first()
    )
    if other_active_transaction is None:
        return

    other_active_primary = (
        db.query(BalanceType)
        .filter(
            BalanceType.budgetid == budgetid,
            BalanceType.balancedesc != bt.balancedesc,
            BalanceType.active == True,  # noqa: E712
            BalanceType.is_primary == True,  # noqa: E712
            BalanceType.balance_type == "Transaction",
        )
        .first()
    )
    if other_active_primary is None:
        raise HTTPException(422, "One active primary account is required. Choose another primary account before deleting this one.")


@router.post("/", response_model=BalanceTypeOut, status_code=201, responses=error_responses(404, 409))
def create_balance_type(budgetid: int, payload: BalanceTypeCreate, db: DbSession):
    _get_budget_or_404(budgetid, db)
    existing = db.get(BalanceType, (budgetid, payload.balancedesc))
    if existing:
        raise HTTPException(409, "Balance type with this description already exists")
    if payload.is_primary:
        _clear_primary(budgetid, payload.balance_type, db)
    bt = BalanceType(budgetid=budgetid, **payload.model_dump())
    db.add(bt)
    db.commit()
    db.refresh(bt)
    return bt


@router.patch("/{balancedesc}", response_model=BalanceTypeOut, responses=error_responses(404, 422))
def update_balance_type(
    budgetid: int, balancedesc: str, payload: BalanceTypeUpdate, db: DbSession
):
    bt = db.get(BalanceType, (budgetid, balancedesc))
    if not bt:
        raise HTTPException(404, "Balance type not found")
    updates = payload.model_dump(exclude_none=True)
    _assert_active_primary_will_remain(budgetid, balancedesc, bt, updates, db)
    if payload.is_primary:
        _clear_primary(budgetid, updates.get("balance_type", bt.balance_type), db)
    if "active" in updates and updates["active"] is False:
        _assert_balance_deactivate_allowed(budgetid, balancedesc, db)

    structural_changes = set()
    if "balance_type" in updates and updates["balance_type"] != bt.balance_type:
        structural_changes.add("balance_type")
    if "opening_balance" in updates and updates["opening_balance"] != bt.opening_balance:
        structural_changes.add("opening_balance")

    if structural_changes:
        _assert_balance_edit_allowed(budgetid, balancedesc, db)
    for k, v in updates.items():
        setattr(bt, k, v)
    db.commit()
    db.refresh(bt)
    return bt


@router.delete("/{balancedesc}", status_code=204, responses=error_responses(404, 422))
def delete_balance_type(budgetid: int, balancedesc: str, db: DbSession):
    bt = db.get(BalanceType, (budgetid, balancedesc))
    if not bt:
        raise HTTPException(404, "Balance type not found")
    _assert_delete_wont_remove_required_primary(budgetid, bt, db)
    _assert_balance_delete_allowed(budgetid, balancedesc, db)
    db.delete(bt)
    db.commit()


# ── Period Balance endpoints ──────────────────────────────────────────────────

@period_router.get("/{finperiodid}/balances", response_model=list[PeriodBalanceOut], responses=error_responses(404))
def list_period_balances(finperiodid: int, db: DbSession):
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


@period_router.patch("/{finperiodid}/balances/{balancedesc}", response_model=PeriodBalanceOut, responses=error_responses(405))
def update_period_balance(
    finperiodid: int,
    balancedesc: str,
    payload: PeriodBalanceUpdate,
    db: DbSession,
):
    raise HTTPException(405, "Period balance movement is calculated from transactions and cannot be edited directly")
