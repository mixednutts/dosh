from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Budget, ExpenseItem
from ..schemas import ExpenseItemCreate, ExpenseItemOut, ExpenseItemUpdate

router = APIRouter(prefix="/budgets/{budgetid}/expense-items", tags=["expense-items"])


def _get_budget_or_404(budgetid: int, db: Session) -> Budget:
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")
    return budget


def _get_expense_or_404(budgetid: int, expensedesc: str, db: Session) -> ExpenseItem:
    ei = db.get(ExpenseItem, (budgetid, expensedesc))
    if not ei:
        raise HTTPException(404, "Expense item not found")
    return ei


@router.get("/", response_model=list[ExpenseItemOut])
def list_expense_items(budgetid: int, active_only: bool = False, db: Session = Depends(get_db)):
    _get_budget_or_404(budgetid, db)
    q = db.query(ExpenseItem).filter(ExpenseItem.budgetid == budgetid)
    if active_only:
        q = q.filter(ExpenseItem.active == True)  # noqa: E712
    return q.all()


@router.post("/", response_model=ExpenseItemOut, status_code=201)
def create_expense_item(budgetid: int, payload: ExpenseItemCreate, db: Session = Depends(get_db)):
    _get_budget_or_404(budgetid, db)
    existing = db.get(ExpenseItem, (budgetid, payload.expensedesc))
    if existing:
        raise HTTPException(409, "Expense item with this description already exists")
    ei = ExpenseItem(budgetid=budgetid, revisionnum=0, **payload.model_dump())
    db.add(ei)
    db.commit()
    db.refresh(ei)
    return ei


@router.get("/{expensedesc}", response_model=ExpenseItemOut)
def get_expense_item(budgetid: int, expensedesc: str, db: Session = Depends(get_db)):
    return _get_expense_or_404(budgetid, expensedesc, db)


@router.patch("/{expensedesc}", response_model=ExpenseItemOut)
def update_expense_item(
    budgetid: int, expensedesc: str, payload: ExpenseItemUpdate, db: Session = Depends(get_db)
):
    ei = _get_expense_or_404(budgetid, expensedesc, db)
    data = payload.model_dump(exclude_none=True)
    bump = data.pop("bump_revision", False)
    for field, value in data.items():
        setattr(ei, field, value)
    if bump:
        ei.revisionnum = (ei.revisionnum or 0) + 1
    db.commit()
    db.refresh(ei)
    return ei


@router.delete("/{expensedesc}", status_code=204)
def delete_expense_item(budgetid: int, expensedesc: str, db: Session = Depends(get_db)):
    ei = _get_expense_or_404(budgetid, expensedesc, db)
    db.delete(ei)
    db.commit()
