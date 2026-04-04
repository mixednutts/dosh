from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Budget, InvestmentItem
from ..schemas import InvestmentItemCreate, InvestmentItemOut, InvestmentItemUpdate
from ..setup_assessment import investment_assessment

router = APIRouter(prefix="/budgets/{budgetid}/investment-items", tags=["investment-items"])


def _get_budget_or_404(budgetid: int, db: Session) -> Budget:
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")
    return budget


def _clear_other_primary_investments(budgetid: int, keep_desc: str, db: Session) -> None:
    (
        db.query(InvestmentItem)
        .filter(
            InvestmentItem.budgetid == budgetid,
            InvestmentItem.investmentdesc != keep_desc,
            InvestmentItem.is_primary == True,  # noqa: E712
        )
        .update({InvestmentItem.is_primary: False}, synchronize_session=False)
    )


def _assert_investment_edit_allowed(budgetid: int, investmentdesc: str, db: Session) -> None:
    assessment = investment_assessment(budgetid, investmentdesc, db)
    if not assessment["can_edit_structure"]:
        raise HTTPException(422, f'Investment line "{investmentdesc}" is in use and cannot be edited. {"; ".join(assessment["reasons"])}.')


def _assert_investment_delete_allowed(budgetid: int, investmentdesc: str, db: Session) -> None:
    assessment = investment_assessment(budgetid, investmentdesc, db)
    if not assessment["can_delete"]:
        raise HTTPException(422, f'Investment line "{investmentdesc}" is in use and cannot be deleted. {"; ".join(assessment["reasons"])}.')


@router.get("/", response_model=list[InvestmentItemOut])
def list_investment_items(budgetid: int, db: Session = Depends(get_db)):
    _get_budget_or_404(budgetid, db)
    return db.query(InvestmentItem).filter(InvestmentItem.budgetid == budgetid).all()


@router.post("/", response_model=InvestmentItemOut, status_code=201)
def create_investment_item(budgetid: int, payload: InvestmentItemCreate, db: Session = Depends(get_db)):
    _get_budget_or_404(budgetid, db)
    existing = db.get(InvestmentItem, (budgetid, payload.investmentdesc))
    if existing:
        raise HTTPException(409, "Investment item with this description already exists")
    if payload.is_primary and not payload.active:
        raise HTTPException(422, "Primary investment items must be active")
    item = InvestmentItem(budgetid=budgetid, **payload.model_dump())
    if item.is_primary:
        _clear_other_primary_investments(budgetid, item.investmentdesc, db)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{investmentdesc}", response_model=InvestmentItemOut)
def update_investment_item(
    budgetid: int, investmentdesc: str, payload: InvestmentItemUpdate, db: Session = Depends(get_db)
):
    item = db.get(InvestmentItem, (budgetid, investmentdesc))
    if not item:
        raise HTTPException(404, "Investment item not found")
    _assert_investment_edit_allowed(budgetid, investmentdesc, db)
    updates = payload.model_dump(exclude_none=True)
    next_active = updates.get("active", item.active)
    next_is_primary = updates.get("is_primary", item.is_primary)

    if next_is_primary and not next_active:
        raise HTTPException(422, "Primary investment items must be active")

    for field, value in updates.items():
        setattr(item, field, value)
    if not item.active:
        item.is_primary = False
    elif item.is_primary:
        _clear_other_primary_investments(budgetid, item.investmentdesc, db)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{investmentdesc}", status_code=204)
def delete_investment_item(budgetid: int, investmentdesc: str, db: Session = Depends(get_db)):
    item = db.get(InvestmentItem, (budgetid, investmentdesc))
    if not item:
        raise HTTPException(404, "Investment item not found")
    _assert_investment_delete_allowed(budgetid, investmentdesc, db)
    db.delete(item)
    db.commit()
