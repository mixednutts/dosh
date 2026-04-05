from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Budget, FinancialPeriod, IncomeType, PeriodTransaction
from ..schemas import IncomeTypeCreate, IncomeTypeOut, IncomeTypeUpdate, SetupHistoryEntryOut, SetupHistoryOut
from ..setup_assessment import income_assessment

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
    is_revision = any(field in data and getattr(it, field) != data[field] for field in revision_fields)
    for field, value in data.items():
        setattr(it, field, value)
    # enforce autoinclude when isfixed
    if it.isfixed:
        it.autoinclude = True
    if is_revision:
        it.revisionnum = (it.revisionnum or 0) + 1
    db.commit()
    db.refresh(it)
    return it


@router.get("/{incomedesc}/history", response_model=SetupHistoryOut)
def get_income_type_history(budgetid: int, incomedesc: str, db: Session = Depends(get_db)):
    item = _get_income_type_or_404(budgetid, incomedesc, db)
    rows = (
        db.query(PeriodTransaction, FinancialPeriod)
        .join(FinancialPeriod, FinancialPeriod.finperiodid == PeriodTransaction.finperiodid)
        .filter(
            PeriodTransaction.budgetid == budgetid,
            PeriodTransaction.source == "income",
            PeriodTransaction.source_key == incomedesc,
            PeriodTransaction.type == "BUDGETADJ",
        )
        .order_by(PeriodTransaction.entrydate.desc(), PeriodTransaction.id.desc())
        .all()
    )
    return SetupHistoryOut(
        item_desc=incomedesc,
        category="income",
        current_revisionnum=item.revisionnum or 0,
        entries=[
            SetupHistoryEntryOut(
                id=tx.id,
                finperiodid=tx.finperiodid,
                period_startdate=period.startdate,
                period_enddate=period.enddate,
                source=tx.source,
                type=tx.type,
                amount=tx.amount,
                note=tx.note,
                entrydate=tx.entrydate,
                is_system=tx.is_system,
                system_reason=tx.system_reason,
                source_key=tx.source_key,
                source_label=tx.source_label,
                affected_account_desc=tx.affected_account_desc,
                related_account_desc=tx.related_account_desc,
                linked_incomedesc=tx.linked_incomedesc,
                entry_kind=getattr(tx, "entry_kind", "movement"),
                line_status=getattr(tx, "line_status", None),
                budget_scope=getattr(tx, "budget_scope", None),
                budget_before_amount=getattr(tx, "budget_before_amount", None),
                budget_after_amount=getattr(tx, "budget_after_amount", None),
            )
            for tx, period in rows
        ],
    )


@router.delete("/{incomedesc}", status_code=204)
def delete_income_type(budgetid: int, incomedesc: str, db: Session = Depends(get_db)):
    it = _get_income_type_or_404(budgetid, incomedesc, db)
    _assert_income_delete_allowed(budgetid, incomedesc, db)
    db.delete(it)
    db.commit()
