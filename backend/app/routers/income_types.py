from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Budget, IncomeType
from ..schemas import IncomeTypeCreate, IncomeTypeOut, IncomeTypeUpdate

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


@router.get("/", response_model=list[IncomeTypeOut])
def list_income_types(budgetid: int, db: Session = Depends(get_db)):
    _get_budget_or_404(budgetid, db)
    return db.query(IncomeType).filter(IncomeType.budgetid == budgetid).all()


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
    it = IncomeType(budgetid=budgetid, **data)
    db.add(it)
    db.commit()
    db.refresh(it)
    return it


@router.patch("/{incomedesc}", response_model=IncomeTypeOut)
def update_income_type(
    budgetid: int, incomedesc: str, payload: IncomeTypeUpdate, db: Session = Depends(get_db)
):
    it = _get_income_type_or_404(budgetid, incomedesc, db)
    data = payload.model_dump(exclude_none=True)
    for field, value in data.items():
        setattr(it, field, value)
    # enforce autoinclude when isfixed
    if it.isfixed:
        it.autoinclude = True
    db.commit()
    db.refresh(it)
    return it


@router.delete("/{incomedesc}", status_code=204)
def delete_income_type(budgetid: int, incomedesc: str, db: Session = Depends(get_db)):
    it = _get_income_type_or_404(budgetid, incomedesc, db)
    db.delete(it)
    db.commit()
