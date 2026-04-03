from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..budget_health import build_budget_health_payload
from ..database import get_db
from ..models import Budget
from ..schemas import BudgetCreate, BudgetHealthOut, BudgetOut, BudgetUpdate

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("/", response_model=list[BudgetOut])
def list_budgets(db: Session = Depends(get_db)):
    return db.query(Budget).all()


@router.post("/", response_model=BudgetOut, status_code=201)
def create_budget(payload: BudgetCreate, db: Session = Depends(get_db)):
    budget = Budget(**payload.model_dump())
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@router.get("/{budgetid}", response_model=BudgetOut)
def get_budget(budgetid: int, db: Session = Depends(get_db)):
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")
    return budget


@router.get("/{budgetid}/health", response_model=BudgetHealthOut)
def get_budget_health(budgetid: int, db: Session = Depends(get_db)):
    payload = build_budget_health_payload(db, budgetid)
    if not payload:
        raise HTTPException(404, "Budget not found")
    return payload


@router.patch("/{budgetid}", response_model=BudgetOut)
def update_budget(budgetid: int, payload: BudgetUpdate, db: Session = Depends(get_db)):
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(budget, field, value)
    db.commit()
    db.refresh(budget)
    return budget


@router.delete("/{budgetid}", status_code=204)
def delete_budget(budgetid: int, db: Session = Depends(get_db)):
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")
    db.delete(budget)
    db.commit()
