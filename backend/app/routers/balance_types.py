from decimal import Decimal

import logging
from fastapi import APIRouter, HTTPException, Response
from sqlalchemy.orm import Session
from ..api_docs import DbSession, error_responses
from ..cycle_management import recalculate_budget_chain, cycle_stage, cycle_status
from ..cycle_constants import CLOSED, CURRENT_STAGE, PLANNED
from ..models import Budget, BalanceType, PeriodBalance, FinancialPeriod
from ..schemas import (
    BalanceTypeCreate, BalanceTypeOut, BalanceTypeUpdate,
    PeriodBalanceOut, PeriodBalanceUpdate,
)
from ..setup_assessment import account_assessment
from ..transaction_ledger import compute_dynamic_period_balances, _invested_amounts_for_period

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/budgets/{budgetid}/balance-types", tags=["balance-types"])
period_router = APIRouter(prefix="/budgets/{budgetid}/periods", tags=["period-balances"])


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


def _clear_primary(budgetid: int, db: Session) -> None:
    db.query(BalanceType).filter(
        BalanceType.budgetid == budgetid,
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
    active_accounts_exist = (
        db.query(BalanceType)
        .filter(
            BalanceType.budgetid == budgetid,
            BalanceType.balancedesc != balancedesc,
            BalanceType.active == True,  # noqa: E712
        )
        .first()
        is not None
    ) or will_be_active

    if not was_active_primary or (will_be_active and will_be_primary) or not active_accounts_exist:
        return

    other_active_primary = (
        db.query(BalanceType)
        .filter(
            BalanceType.budgetid == budgetid,
            BalanceType.balancedesc != balancedesc,
            BalanceType.active == True,  # noqa: E712
            BalanceType.is_primary == True,  # noqa: E712
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
    if not (bt.active and bt.is_primary):
        return

    other_active_account = (
        db.query(BalanceType)
        .filter(
            BalanceType.budgetid == budgetid,
            BalanceType.balancedesc != bt.balancedesc,
            BalanceType.active == True,  # noqa: E712
        )
        .first()
    )
    if other_active_account is None:
        return

    other_active_primary = (
        db.query(BalanceType)
        .filter(
            BalanceType.budgetid == budgetid,
            BalanceType.balancedesc != bt.balancedesc,
            BalanceType.active == True,  # noqa: E712
            BalanceType.is_primary == True,  # noqa: E712
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
        _clear_primary(budgetid, db)
    bt = BalanceType(budgetid=budgetid, **payload.model_dump())
    db.add(bt)
    db.commit()
    db.refresh(bt)

    if bt.active:
        all_periods = (
            db.query(FinancialPeriod)
            .filter(FinancialPeriod.budgetid == budgetid)
            .order_by(FinancialPeriod.startdate, FinancialPeriod.finperiodid)
            .all()
        )
        periods = [p for p in all_periods if cycle_stage(p) in {CURRENT_STAGE, PLANNED}]
        previous_period = None
        for period in periods:
            if previous_period:
                prev_pb = db.get(PeriodBalance, (previous_period.finperiodid, bt.balancedesc))
                opening = Decimal(str(prev_pb.closing_amount)) if prev_pb else Decimal(str(bt.opening_balance))
            else:
                opening = Decimal(str(bt.opening_balance))
            db.add(PeriodBalance(
                finperiodid=period.finperiodid,
                budgetid=budgetid,
                balancedesc=bt.balancedesc,
                opening_amount=opening,
                closing_amount=opening,
            ))
            previous_period = period
        if periods:
            recalculate_budget_chain(budgetid, db)
            db.commit()

    logger.info("create_balance_type completed")
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
        _clear_primary(budgetid, db)
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
    logger.info("update_balance_type completed")
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
    logger.info("delete_balance_type completed", extra={"budget_id": budgetid, "balance_desc": balancedesc})


# ── Period Balance endpoints ──────────────────────────────────────────────────

@period_router.get("/{finperiodid}/balances", response_model=list[PeriodBalanceOut], responses=error_responses(404))
def list_period_balances(budgetid: int, finperiodid: int, db: DbSession):
    period = db.get(FinancialPeriod, finperiodid)
    if not period or period.budgetid != budgetid:
        raise HTTPException(404, "Period not found")

    if cycle_status(period) != CLOSED:
        budget = db.get(Budget, period.budgetid)
        max_cycles = budget.max_forward_balance_cycles if budget else 10
        dynamic_balances = compute_dynamic_period_balances(finperiodid, db, max_forward_cycles=max_cycles)
        if dynamic_balances is None:
            return Response(content="[]", headers={"X-Balances-Limit-Exceeded": "true"})
        return dynamic_balances

    rows = db.query(PeriodBalance).filter(PeriodBalance.finperiodid == finperiodid).all()
    # Enrich with balance_type label and invested amount
    invested_amounts = _invested_amounts_for_period(finperiodid, period.budgetid, db)
    out = []
    for pb in rows:
        bt = db.get(BalanceType, (pb.budgetid, pb.balancedesc))
        d = PeriodBalanceOut.model_validate(pb)
        d.balance_type = bt.balance_type if bt else None
        if pb.balancedesc in invested_amounts:
            d.invested_amount = invested_amounts[pb.balancedesc]
        out.append(d)
    return out


@period_router.patch("/{finperiodid}/balances/{balancedesc}", response_model=PeriodBalanceOut, responses=error_responses(405))
def update_period_balance(
    budgetid: int,
    finperiodid: int,
    balancedesc: str,
    payload: PeriodBalanceUpdate,
    db: DbSession,
):
    period = db.get(FinancialPeriod, finperiodid)
    if not period or period.budgetid != budgetid:
        raise HTTPException(404, "Period not found")
    logger.info("update_period_balance blocked", extra={"budget_id": budgetid, "finperiodid": finperiodid})
    raise HTTPException(405, "Period balance movement is calculated from transactions and cannot be edited directly")
