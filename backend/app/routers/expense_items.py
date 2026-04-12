from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from ..auto_expense import normalize_expense_paytype
from ..api_docs import DbSession, error_responses
from ..models import Budget, BalanceType, ExpenseItem, FinancialPeriod, PeriodExpense, PeriodTransaction
from ..schemas import ExpenseItemCreate, ExpenseItemOut, ExpenseItemUpdate, ExpenseItemReorderRequest, SetupHistoryOut
from ..period_logic import expense_occurs_in_period
from ..setup_assessment import expense_assessment
from ..setup_history import (
    build_changed_fields,
    build_setup_history_entries,
    next_supported_revisionnum,
    rebase_item_revisionnum,
    record_setup_revision_event,
)

router = APIRouter(prefix="/budgets/{budgetid}/expense-items", tags=["expense-items"])


def _get_budget_or_404(budgetid: int, db: Session) -> Budget:
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")
    return budget


def _validate_default_account_desc(budgetid: int, account_desc: str | None, db: Session) -> None:
    if account_desc is None:
        return
    bt = db.get(BalanceType, (budgetid, account_desc))
    if not bt:
        raise HTTPException(404, f'Account "{account_desc}" not found')
    if not bt.active:
        raise HTTPException(422, f'Account "{account_desc}" is not active')
    if bt.balance_type != "Transaction":
        raise HTTPException(422, f'Account "{account_desc}" must be a Transaction account')


def _get_expense_or_404(budgetid: int, expensedesc: str, db: Session) -> ExpenseItem:
    ei = db.get(ExpenseItem, (budgetid, expensedesc))
    if not ei:
        raise HTTPException(404, "Expense item not found")
    return ei


def _assert_expense_delete_allowed(budgetid: int, expensedesc: str, db: Session) -> None:
    assessment = expense_assessment(budgetid, expensedesc, db)
    if not assessment["can_delete"]:
        raise HTTPException(422, f'Expense item "{expensedesc}" is in use and cannot be deleted. {"; ".join(assessment["reasons"])}.')


# Deactivation guard removed - deactivation is always allowed and only affects future cycles.
# The setup assessment provides deactivation_impact guidance for UI messaging.


def _expense_has_recorded_activity(budgetid: int, expensedesc: str, db: Session) -> bool:
    return (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.budgetid == budgetid,
            PeriodTransaction.source == "expense",
            PeriodTransaction.source_key == expensedesc,
            PeriodTransaction.entry_kind == "movement",
        )
        .first()
        is not None
    )


def _normalized_paytype_or_422(
    *,
    budgetid: int,
    expensedesc: str,
    current_item: Optional[ExpenseItem],
    payload_data: dict,
    db: Session,
) -> Optional[str]:
    if "paytype" not in payload_data and current_item is None:
        return None
    requested_paytype = payload_data.get("paytype", current_item.paytype if current_item else None)
    freqtype = payload_data.get("freqtype", current_item.freqtype if current_item else None)
    frequency_value = payload_data.get("frequency_value", current_item.frequency_value if current_item else None)
    effectivedate = payload_data.get("effectivedate", current_item.effectivedate if current_item else None)

    try:
        normalized_paytype = normalize_expense_paytype(
            paytype=requested_paytype,
            freqtype=freqtype,
            frequency_value=frequency_value,
            effectivedate=effectivedate,
        )
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    current_paytype = current_item.paytype if current_item else None
    if normalized_paytype == "AUTO" and current_paytype != "AUTO" and _expense_has_recorded_activity(budgetid, expensedesc, db):
        raise HTTPException(422, f'Expense item "{expensedesc}" cannot be changed to AUTO because it already has recorded expense activity.')
    return normalized_paytype


@router.get("/", response_model=list[ExpenseItemOut], responses=error_responses(404))
def list_expense_items(budgetid: int, db: DbSession, active_only: bool = False):
    _get_budget_or_404(budgetid, db)
    q = db.query(ExpenseItem).filter(ExpenseItem.budgetid == budgetid)
    if active_only:
        q = q.filter(ExpenseItem.active == True)  # noqa: E712
    items = q.order_by(ExpenseItem.sort_order, ExpenseItem.expensedesc).all()
    for item in items:
        rebase_item_revisionnum(item, budgetid=budgetid, category="expense", item_desc=item.expensedesc, db=db)
    db.commit()
    return items


@router.patch("/reorder", status_code=204, responses=error_responses(404))
def reorder_expense_items(budgetid: int, payload: ExpenseItemReorderRequest, db: DbSession):
    _get_budget_or_404(budgetid, db)
    for item in payload.items:
        ei = db.get(ExpenseItem, (budgetid, item.expensedesc))
        if ei:
            ei.sort_order = item.sort_order
    db.commit()


@router.post("/", response_model=ExpenseItemOut, status_code=201, responses=error_responses(404, 409))
def create_expense_item(budgetid: int, payload: ExpenseItemCreate, db: DbSession):
    _get_budget_or_404(budgetid, db)
    existing = db.get(ExpenseItem, (budgetid, payload.expensedesc))
    if existing:
        raise HTTPException(409, "Expense item with this description already exists")
    data = payload.model_dump()
    _validate_default_account_desc(budgetid, data.get("default_account_desc"), db)
    data["paytype"] = _normalized_paytype_or_422(
        budgetid=budgetid,
        expensedesc=payload.expensedesc,
        current_item=None,
        payload_data=data,
        db=db,
    )
    ei = ExpenseItem(budgetid=budgetid, revisionnum=0, **data)
    db.add(ei)
    db.commit()
    db.refresh(ei)
    return ei


@router.get("/{expensedesc}", response_model=ExpenseItemOut, responses=error_responses(404))
def get_expense_item(budgetid: int, expensedesc: str, db: DbSession):
    item = _get_expense_or_404(budgetid, expensedesc, db)
    rebase_item_revisionnum(item, budgetid=budgetid, category="expense", item_desc=expensedesc, db=db)
    db.commit()
    return item


@router.patch("/{expensedesc}", response_model=ExpenseItemOut, responses=error_responses(404, 422))
def update_expense_item(
    budgetid: int, expensedesc: str, payload: ExpenseItemUpdate, db: DbSession
):
    ei = _get_expense_or_404(budgetid, expensedesc, db)
    data = payload.model_dump(exclude_none=True)
    if "default_account_desc" in data:
        _validate_default_account_desc(budgetid, data["default_account_desc"], db)
    if "paytype" in data or "freqtype" in data or "frequency_value" in data or "effectivedate" in data:
        data["paytype"] = _normalized_paytype_or_422(
            budgetid=budgetid,
            expensedesc=expensedesc,
            current_item=ei,
            payload_data=data,
            db=db,
        )
    # Deactivation is always allowed; it only affects future cycle generation.
    # Existing cycles retain the expense line until manually removed.
    bump = data.pop("bump_revision", False)

    # Detect whether a revision-worthy field changed
    revision_fields = {"freqtype", "frequency_value", "effectivedate", "expenseamount"}
    changed_fields = build_changed_fields(ei, data, revision_fields)
    is_revision = bump or bool(changed_fields)

    for field, value in data.items():
        setattr(ei, field, value)

    if is_revision:
        ei.revisionnum = next_supported_revisionnum(
            db,
            budgetid=budgetid,
            category="expense",
            item_desc=expensedesc,
        )
        record_setup_revision_event(
            db,
            budgetid=budgetid,
            category="expense",
            item_desc=expensedesc,
            revisionnum=ei.revisionnum,
            changed_fields=changed_fields,
        )
        # Propagate updated budget amounts to future unlocked periods
        future_periods = (
            db.query(FinancialPeriod)
            .filter(
                FinancialPeriod.budgetid == budgetid,
                FinancialPeriod.islocked == False,  # noqa: E712
            )
            .all()
        )
        for fp in future_periods:
            pe = (
                db.query(PeriodExpense)
                .filter(
                    PeriodExpense.finperiodid == fp.finperiodid,
                    PeriodExpense.budgetid == budgetid,
                    PeriodExpense.expensedesc == expensedesc,
                    PeriodExpense.is_oneoff == False,  # noqa: E712
                )
                .first()
            )
            if pe and ei.freqtype and ei.frequency_value and ei.effectivedate:
                new_budget = expense_occurs_in_period(
                    freqtype=ei.freqtype,
                    frequency_value=ei.frequency_value,
                    effectivedate=ei.effectivedate,
                    period_start=fp.startdate,
                    period_end=fp.enddate,
                    expense_amount=Decimal(str(ei.expenseamount)),
                )
                if new_budget is not None:
                    pe.budgetamount = new_budget
                    pe.varianceamount = pe.actualamount - pe.budgetamount
            elif pe and ei.freqtype == "Always":
                pe.budgetamount = Decimal(str(ei.expenseamount))
                pe.varianceamount = pe.actualamount - pe.budgetamount

    db.commit()
    db.refresh(ei)
    return ei


@router.get("/{expensedesc}/history", response_model=SetupHistoryOut, responses=error_responses(404))
def get_expense_item_history(budgetid: int, expensedesc: str, db: DbSession):
    item = _get_expense_or_404(budgetid, expensedesc, db)
    current_revisionnum = rebase_item_revisionnum(item, budgetid=budgetid, category="expense", item_desc=expensedesc, db=db)
    db.commit()
    return SetupHistoryOut(
        item_desc=expensedesc,
        category="expense",
        current_revisionnum=current_revisionnum,
        entries=build_setup_history_entries(db, budgetid=budgetid, category="expense", item_desc=expensedesc),
    )


@router.delete("/{expensedesc}", status_code=204, responses=error_responses(404, 422))
def delete_expense_item(budgetid: int, expensedesc: str, db: DbSession):
    ei = _get_expense_or_404(budgetid, expensedesc, db)
    _assert_expense_delete_allowed(budgetid, expensedesc, db)
    db.delete(ei)
    db.commit()
