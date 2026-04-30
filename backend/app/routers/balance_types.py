from datetime import datetime as dt, timezone
from decimal import Decimal

import logging
from fastapi import APIRouter, HTTPException, Response
from sqlalchemy.orm import Session
from ..api_docs import DbSession, error_responses
from ..cycle_management import ordered_budget_periods, recalculate_budget_chain, cycle_stage, cycle_status
from ..cycle_constants import CLOSED, CURRENT_STAGE, PLANNED
from ..models import Budget, BalanceType, ExpenseItem, PeriodBalance, FinancialPeriod
from ..schemas import (
    BalanceTypeCreate, BalanceTypeOut, BalanceTypeUpdate,
    CloseAccountPreviewOut, CloseAccountRequest,
    PeriodBalanceOut, PeriodBalanceUpdate,
)
from ..setup_assessment import account_assessment
from ..transaction_ledger import (
    add_period_transaction,
    compute_dynamic_period_balances,
    PeriodTransactionContext,
    sync_period_state,
    TX_TYPE_TRANSFER,
    validate_account_has_sufficient_balance,
)

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


# ── Close account preview ─────────────────────────────────────────────────────

@router.get("/{balancedesc}/close-preview", response_model=CloseAccountPreviewOut, responses=error_responses(404))
def close_account_preview(budgetid: int, balancedesc: str, db: DbSession):
    bt = db.get(BalanceType, (budgetid, balancedesc))
    if not bt:
        raise HTTPException(404, "Balance type not found")

    periods = ordered_budget_periods(budgetid, db)
    current_periods = [p for p in periods if cycle_stage(p) == CURRENT_STAGE]
    current_period = current_periods[0] if current_periods else None

    current_balance = Decimal("0.00")
    if current_period:
        budget = db.get(Budget, budgetid)
        max_cycles = budget.max_forward_balance_cycles if budget else 10
        dynamic_balances = compute_dynamic_period_balances(current_period.finperiodid, db, max_forward_cycles=max_cycles)
        if dynamic_balances is not None:
            for bal in dynamic_balances:
                if bal.balancedesc == balancedesc:
                    current_balance = bal.closing_amount
                    break
        else:
            pb = db.get(PeriodBalance, (current_period.finperiodid, balancedesc))
            if pb:
                current_balance = Decimal(str(pb.closing_amount or 0))

    other_active_accounts = [
        a.balancedesc
        for a in db.query(BalanceType).filter(
            BalanceType.budgetid == budgetid,
            BalanceType.balancedesc != balancedesc,
            BalanceType.active == True,  # noqa: E712
        ).order_by(BalanceType.balancedesc).all()
    ]

    return CloseAccountPreviewOut(
        current_balance=current_balance,
        is_primary=bool(bt.is_primary),
        other_active_accounts=other_active_accounts,
    )


# ── Close account ─────────────────────────────────────────────────────────────

@router.post("/{balancedesc}/close", status_code=200, response_model=BalanceTypeOut, responses=error_responses(404, 422, 423))
def close_account(budgetid: int, balancedesc: str, payload: CloseAccountRequest, db: DbSession):
    bt = db.get(BalanceType, (budgetid, balancedesc))
    if not bt:
        raise HTTPException(404, "Balance type not found")
    if not bt.active:
        raise HTTPException(422, "Account is already closed")

    periods = ordered_budget_periods(budgetid, db)
    current_periods = [p for p in periods if cycle_stage(p) == CURRENT_STAGE]
    current_period = current_periods[0] if current_periods else None

    if not current_period:
        raise HTTPException(422, "No active budget cycle found to process account closure")
    if cycle_status(current_period) == CLOSED:
        raise HTTPException(423, "Current budget cycle is closed")

    finperiodid = current_period.finperiodid

    # Determine current balance
    budget = db.get(Budget, budgetid)
    max_cycles = budget.max_forward_balance_cycles if budget else 10
    dynamic_balances = compute_dynamic_period_balances(finperiodid, db, max_forward_cycles=max_cycles)
    current_balance = Decimal("0.00")
    if dynamic_balances is not None:
        for bal in dynamic_balances:
            if bal.balancedesc == balancedesc:
                current_balance = bal.closing_amount
                break
    else:
        pb = db.get(PeriodBalance, (finperiodid, balancedesc))
        if pb:
            current_balance = Decimal(str(pb.closing_amount or 0))

    # Handle balance transfer
    if current_balance != Decimal("0.00") and payload.transfer_to_account:
        dest_bt = db.get(BalanceType, (budgetid, payload.transfer_to_account))
        if not dest_bt:
            raise HTTPException(404, "Transfer destination account not found")
        if not dest_bt.active:
            raise HTTPException(422, "Transfer destination account is not active")
        if dest_bt.balancedesc == balancedesc:
            raise HTTPException(422, "Cannot transfer balance to the same account")

        # Ensure destination has a PeriodBalance in the current period
        dest_pb = db.get(PeriodBalance, (finperiodid, payload.transfer_to_account))
        if not dest_pb:
            prev_period = None
            for p in periods:
                if p.finperiodid == finperiodid:
                    break
                prev_period = p
            if prev_period:
                prev_pb = db.get(PeriodBalance, (prev_period.finperiodid, payload.transfer_to_account))
                opening = Decimal(str(prev_pb.closing_amount)) if prev_pb else Decimal(str(dest_bt.opening_balance))
            else:
                opening = Decimal(str(dest_bt.opening_balance))
            dest_pb = PeriodBalance(
                finperiodid=finperiodid,
                budgetid=budgetid,
                balancedesc=payload.transfer_to_account,
                opening_amount=opening,
                closing_amount=opening,
            )
            db.add(dest_pb)
            db.flush()

        validate_account_has_sufficient_balance(finperiodid, budgetid, balancedesc, current_balance, db)

        add_period_transaction(
            db,
            PeriodTransactionContext(
                finperiodid=finperiodid,
                budgetid=budgetid,
                source="transfer",
                tx_type=TX_TYPE_TRANSFER,
                source_key=f"close:{balancedesc}",
                source_label=f"Account close: {balancedesc} to {payload.transfer_to_account}",
                affected_account_desc=payload.transfer_to_account,
                related_account_desc=balancedesc,
            ),
            amount=current_balance,
            note=f"Balance transfer on account close from {balancedesc} to {payload.transfer_to_account}",
            entrydate=dt.now(timezone.utc),
            is_system=True,
            system_reason="account_close_balance_transfer",
        )

    # Handle primary reassignment
    new_primary = payload.new_primary_account
    if bt.is_primary:
        if not new_primary:
            raise HTTPException(422, "A new primary account must be selected when closing the primary account")
        new_primary_bt = db.get(BalanceType, (budgetid, new_primary))
        if not new_primary_bt:
            raise HTTPException(404, "New primary account not found")
        if not new_primary_bt.active:
            raise HTTPException(422, "New primary account must be active")
        if new_primary_bt.balancedesc == balancedesc:
            raise HTTPException(422, "New primary account cannot be the account being closed")
        _clear_primary(budgetid, db)
        new_primary_bt.is_primary = True

    # Re-link expense items that default to the closing account
    if new_primary:
        (
            db.query(ExpenseItem)
            .filter(
                ExpenseItem.budgetid == budgetid,
                ExpenseItem.default_account_desc == balancedesc,
            )
            .update({"default_account_desc": new_primary}, synchronize_session=False)
        )

    bt.active = False
    bt.is_primary = False
    db.flush()

    # Remove closed account from all planned (future) periods
    planned_periods = [p for p in periods if cycle_stage(p) == PLANNED]
    for planned in planned_periods:
        (
            db.query(PeriodBalance)
            .filter(
                PeriodBalance.finperiodid == planned.finperiodid,
                PeriodBalance.balancedesc == balancedesc,
            )
            .delete(synchronize_session=False)
        )

    sync_period_state(finperiodid, db)
    db.commit()
    db.refresh(bt)
    logger.info("close_account completed", extra={"budget_id": budgetid, "balance_desc": balancedesc})
    return bt


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
        # Hide closed accounts from non-current periods
        if cycle_stage(period) != CURRENT_STAGE:
            active_descs = {
                bt.balancedesc
                for bt in db.query(BalanceType).filter(
                    BalanceType.budgetid == budgetid,
                    BalanceType.active == True,  # noqa: E712
                ).all()
            }
            dynamic_balances = [b for b in dynamic_balances if b.balancedesc in active_descs]
        return dynamic_balances

    rows = db.query(PeriodBalance).filter(PeriodBalance.finperiodid == finperiodid).all()
    # Enrich with balance_type label
    out = []
    for pb in rows:
        bt = db.get(BalanceType, (pb.budgetid, pb.balancedesc))
        d = PeriodBalanceOut.model_validate(pb)
        d.balance_type = bt.balance_type if bt else None
        d.is_savings = bt.is_savings if bt else False
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
