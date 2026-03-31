from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Budget, InvestmentItem
from ..schemas import InvestmentItemCreate, InvestmentItemOut, InvestmentItemUpdate

router = APIRouter(prefix="/budgets/{budgetid}/investment-items", tags=["investment-items"])


def _get_budget_or_404(budgetid: int, db: Session) -> Budget:
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")
    return budget


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
    item = InvestmentItem(budgetid=budgetid, **payload.model_dump())
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
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{investmentdesc}", status_code=204)
def delete_investment_item(budgetid: int, investmentdesc: str, db: Session = Depends(get_db)):
    item = db.get(InvestmentItem, (budgetid, investmentdesc))
    if not item:
        raise HTTPException(404, "Investment item not found")
    db.delete(item)
    db.commit()
