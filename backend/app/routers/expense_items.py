from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Budget, ExpenseItem, FinancialPeriod, PeriodExpense
from ..schemas import ExpenseItemCreate, ExpenseItemOut, ExpenseItemUpdate, ExpenseItemReorderRequest
from ..period_logic import expense_occurs_in_period
from ..setup_assessment import expense_assessment

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


def _assert_expense_delete_allowed(budgetid: int, expensedesc: str, db: Session) -> None:
    assessment = expense_assessment(budgetid, expensedesc, db)
    if not assessment["can_delete"]:
        raise HTTPException(422, f'Expense item "{expensedesc}" is in use and cannot be deleted. {"; ".join(assessment["reasons"])}.')


def _assert_expense_deactivate_allowed(budgetid: int, expensedesc: str, db: Session) -> None:
    assessment = expense_assessment(budgetid, expensedesc, db)
    if not assessment["can_deactivate"]:
        raise HTTPException(422, f'Expense item "{expensedesc}" is in use and cannot be deactivated. {"; ".join(assessment["reasons"])}.')


@router.get("/", response_model=list[ExpenseItemOut])
def list_expense_items(budgetid: int, active_only: bool = False, db: Session = Depends(get_db)):
    _get_budget_or_404(budgetid, db)
    q = db.query(ExpenseItem).filter(ExpenseItem.budgetid == budgetid)
    if active_only:
        q = q.filter(ExpenseItem.active == True)  # noqa: E712
    return q.order_by(ExpenseItem.sort_order, ExpenseItem.expensedesc).all()


@router.patch("/reorder", status_code=204)
def reorder_expense_items(budgetid: int, payload: ExpenseItemReorderRequest, db: Session = Depends(get_db)):
    _get_budget_or_404(budgetid, db)
    for item in payload.items:
        ei = db.get(ExpenseItem, (budgetid, item.expensedesc))
        if ei:
            ei.sort_order = item.sort_order
    db.commit()


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
    if data.get("active") is False:
        _assert_expense_deactivate_allowed(budgetid, expensedesc, db)
    bump = data.pop("bump_revision", False)

    # Detect whether a revision-worthy field changed
    revision_fields = {"freqtype", "frequency_value", "effectivedate", "expenseamount"}
    is_revision = bump or any(
        f in data and getattr(ei, f) != data[f]
        for f in revision_fields
    )

    for field, value in data.items():
        setattr(ei, field, value)

    if is_revision:
        ei.revisionnum = (ei.revisionnum or 0) + 1
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


@router.delete("/{expensedesc}", status_code=204)
def delete_expense_item(budgetid: int, expensedesc: str, db: Session = Depends(get_db)):
    ei = _get_expense_or_404(budgetid, expensedesc, db)
    _assert_expense_delete_allowed(budgetid, expensedesc, db)
    db.delete(ei)
    db.commit()
