from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Budget, IncomeType
from ..schemas import IncomeTypeCreate, IncomeTypeOut, IncomeTypeUpdate, SetupHistoryOut
from ..setup_assessment import income_assessment
from ..setup_history import (
    build_changed_fields,
    build_setup_history_entries,
    next_supported_revisionnum,
    rebase_item_revisionnum,
    record_setup_revision_event,
)

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


@router.get("/", response_model=list[IncomeTypeOut])
def list_income_types(budgetid: int, db: Session = Depends(get_db)):
    _get_budget_or_404(budgetid, db)
    items = db.query(IncomeType).filter(IncomeType.budgetid == budgetid).all()
    for item in items:
        rebase_item_revisionnum(item, budgetid=budgetid, category="income", item_desc=item.incomedesc, db=db)
    db.commit()
    return items


@router.post("/", response_model=IncomeTypeOut, status_code=201)
def create_income_type(budgetid: int, payload: IncomeTypeCreate, db: Session = Depends(get_db)):
    _get_budget_or_404(budgetid, db)
    existing = db.get(IncomeType, (budgetid, payload.incomedesc))
    if existing:
        raise HTTPException(409, "Income type with this description already exists")
    data = payload.model_dump()
    # enforce autoinclude when isfixed
    if data.get("isfixed"):
        data["autoinclude"] = True
    it = IncomeType(budgetid=budgetid, revisionnum=0, **data)
    db.add(it)
    db.commit()
    db.refresh(it)
    return it


@router.patch("/{incomedesc}", response_model=IncomeTypeOut)
def update_income_type(
    budgetid: int, incomedesc: str, payload: IncomeTypeUpdate, db: Session = Depends(get_db)
):
    it = _get_income_type_or_404(budgetid, incomedesc, db)
    _assert_income_edit_allowed(budgetid, incomedesc, db)
    data = payload.model_dump(exclude_none=True)
    revision_fields = {"amount"}
    changed_fields = build_changed_fields(it, data, revision_fields)
    is_revision = bool(changed_fields)
    for field, value in data.items():
        setattr(it, field, value)
    # enforce autoinclude when isfixed
    if it.isfixed:
        it.autoinclude = True
    if is_revision:
        it.revisionnum = next_supported_revisionnum(
            db,
            budgetid=budgetid,
            category="income",
            item_desc=incomedesc,
        )
        record_setup_revision_event(
            db,
            budgetid=budgetid,
            category="income",
            item_desc=incomedesc,
            revisionnum=it.revisionnum,
            changed_fields=changed_fields,
        )
    db.commit()
    db.refresh(it)
    return it


@router.get("/{incomedesc}/history", response_model=SetupHistoryOut)
def get_income_type_history(budgetid: int, incomedesc: str, db: Session = Depends(get_db)):
    item = _get_income_type_or_404(budgetid, incomedesc, db)
    current_revisionnum = rebase_item_revisionnum(item, budgetid=budgetid, category="income", item_desc=incomedesc, db=db)
    db.commit()
    return SetupHistoryOut(
        item_desc=incomedesc,
        category="income",
        current_revisionnum=current_revisionnum,
        entries=build_setup_history_entries(db, budgetid=budgetid, category="income", item_desc=incomedesc),
    )


@router.delete("/{incomedesc}", status_code=204)
def delete_income_type(budgetid: int, incomedesc: str, db: Session = Depends(get_db)):
    it = _get_income_type_or_404(budgetid, incomedesc, db)
    _assert_income_delete_allowed(budgetid, incomedesc, db)
    db.delete(it)
    db.commit()
