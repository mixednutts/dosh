import logging
from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session
from ..api_docs import DbSession, error_responses
from ..models import BalanceType, Budget, IncomeType
from ..schemas import IncomeTypeCreate, IncomeTypeOut, IncomeTypeUpdate, SetupHistoryOut
from ..setup_assessment import income_assessment
from ..setup_history import (
    build_changed_fields,
    build_setup_history_entries,
    next_supported_revisionnum,
    rebase_item_revisionnum,
    record_setup_revision_event,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/budgets/{budgetid}/income-types", tags=["income-types"])


def _get_budget_or_404(budgetid: int, db: Session) -> Budget:
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")
    return budget


def _get_income_type_or_404(budgetid: int, incomedesc: str, db: Session) -> IncomeType:
    it = db.get(IncomeType, (budgetid, incomedesc))
    if not it:
        raise HTTPException(404, "Income type not found")
    return it


def _assert_income_edit_allowed(budgetid: int, incomedesc: str, db: Session) -> None:
    assessment = income_assessment(budgetid, incomedesc, db)
    if not assessment["can_edit_structure"]:
        raise HTTPException(422, f'Income type "{incomedesc}" is in use and cannot be edited. {"; ".join(assessment["reasons"])}.')


def _assert_income_delete_allowed(budgetid: int, incomedesc: str, db: Session) -> None:
    assessment = income_assessment(budgetid, incomedesc, db)
    if not assessment["can_delete"]:
        raise HTTPException(422, f'Income type "{incomedesc}" is in use and cannot be deleted. {"; ".join(assessment["reasons"])}.')


def _assert_savings_account_valid(budgetid: int, linked_account: str | None, issavings: bool, db: Session) -> None:
    if not issavings or not linked_account:
        return
    bt = db.get(BalanceType, (budgetid, linked_account))
    if not bt:
        raise HTTPException(422, f'Linked account "{linked_account}" does not exist')
    if not bt.active:
        raise HTTPException(422, f'Linked account "{linked_account}" is inactive')
    if not bt.is_savings:
        raise HTTPException(422, f'Linked account "{linked_account}" must be a savings account when income is marked as savings')


@router.get("/", response_model=list[IncomeTypeOut], responses=error_responses(404))
def list_income_types(budgetid: int, db: DbSession):
    _get_budget_or_404(budgetid, db)
    items = db.query(IncomeType).filter(IncomeType.budgetid == budgetid).all()
    for item in items:
        rebase_item_revisionnum(item, budgetid=budgetid, category="income", item_desc=item.incomedesc, db=db)
    db.commit()
    return items


@router.post("/", response_model=IncomeTypeOut, status_code=201, responses=error_responses(404, 409))
def create_income_type(budgetid: int, payload: IncomeTypeCreate, db: DbSession):
    _get_budget_or_404(budgetid, db)
    existing = db.get(IncomeType, (budgetid, payload.incomedesc))
    if existing:
        raise HTTPException(409, "Income type with this description already exists")
    _assert_savings_account_valid(budgetid, payload.linked_account, payload.issavings, db)
    data = payload.model_dump()
    it = IncomeType(budgetid=budgetid, revisionnum=0, **data)
    db.add(it)
    db.commit()
    db.refresh(it)
    logger.info("create_income_type completed")
    return it


@router.patch("/{incomedesc}", response_model=IncomeTypeOut, responses=error_responses(404, 422))
def update_income_type(
    budgetid: int, incomedesc: str, payload: IncomeTypeUpdate, db: DbSession
):
    it = _get_income_type_or_404(budgetid, incomedesc, db)
    _assert_income_edit_allowed(budgetid, incomedesc, db)
    data = payload.model_dump(exclude_none=True)
    new_desc = data.get("incomedesc")
    if new_desc and new_desc != incomedesc:
        existing = db.get(IncomeType, (budgetid, new_desc))
        if existing:
            raise HTTPException(409, "Income type with this description already exists")
    next_issavings = data.get("issavings", it.issavings)
    next_linked = data.get("linked_account", it.linked_account)
    _assert_savings_account_valid(budgetid, next_linked, next_issavings, db)
    revision_fields = {"amount"}
    changed_fields = build_changed_fields(it, data, revision_fields)
    is_revision = bool(changed_fields)
    for field, value in data.items():
        setattr(it, field, value)
    if is_revision:
        it.revisionnum = next_supported_revisionnum(
            db,
            budgetid=budgetid,
            category="income",
            item_desc=it.incomedesc,
        )
        record_setup_revision_event(
            db,
            budgetid=budgetid,
            category="income",
            item_desc=it.incomedesc,
            revisionnum=it.revisionnum,
            changed_fields=changed_fields,
        )
    db.commit()
    db.refresh(it)
    logger.info("update_income_type completed")
    return it


@router.get("/{incomedesc}/history", response_model=SetupHistoryOut, responses=error_responses(404))
def get_income_type_history(budgetid: int, incomedesc: str, db: DbSession):
    item = _get_income_type_or_404(budgetid, incomedesc, db)
    current_revisionnum = rebase_item_revisionnum(item, budgetid=budgetid, category="income", item_desc=incomedesc, db=db)
    db.commit()
    return SetupHistoryOut(
        item_desc=incomedesc,
        category="income",
        current_revisionnum=current_revisionnum,
        entries=build_setup_history_entries(db, budgetid=budgetid, category="income", item_desc=incomedesc),
    )


@router.delete("/{incomedesc}", status_code=204, responses=error_responses(404, 422))
def delete_income_type(budgetid: int, incomedesc: str, db: DbSession):
    it = _get_income_type_or_404(budgetid, incomedesc, db)
    _assert_income_delete_allowed(budgetid, incomedesc, db)
    db.delete(it)
    db.commit()
