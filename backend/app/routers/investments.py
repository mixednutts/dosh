from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Budget, FinancialPeriod, InvestmentItem, PeriodTransaction
from ..schemas import InvestmentItemCreate, InvestmentItemOut, InvestmentItemUpdate, SetupHistoryEntryOut, SetupHistoryOut
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
    item = InvestmentItem(budgetid=budgetid, revisionnum=0, **payload.model_dump())
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
    revision_fields = {"planned_amount"}
    is_revision = any(field in updates and getattr(item, field) != updates[field] for field in revision_fields)
    next_active = updates.get("active", item.active)
    next_is_primary = updates.get("is_primary", item.is_primary)

    if next_is_primary and not next_active:
        raise HTTPException(422, "Primary investment items must be active")

    for field, value in updates.items():
        setattr(item, field, value)
    if is_revision:
        item.revisionnum = (item.revisionnum or 0) + 1
    if not item.active:
        item.is_primary = False
    elif item.is_primary:
        _clear_other_primary_investments(budgetid, item.investmentdesc, db)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{investmentdesc}/history", response_model=SetupHistoryOut)
def get_investment_item_history(budgetid: int, investmentdesc: str, db: Session = Depends(get_db)):
    item = db.get(InvestmentItem, (budgetid, investmentdesc))
    if not item:
        raise HTTPException(404, "Investment item not found")
    rows = (
        db.query(PeriodTransaction, FinancialPeriod)
        .join(FinancialPeriod, FinancialPeriod.finperiodid == PeriodTransaction.finperiodid)
        .filter(
            PeriodTransaction.budgetid == budgetid,
            PeriodTransaction.source == "investment",
            PeriodTransaction.source_key == investmentdesc,
            PeriodTransaction.type == "BUDGETADJ",
        )
        .order_by(PeriodTransaction.entrydate.desc(), PeriodTransaction.id.desc())
        .all()
    )
    return SetupHistoryOut(
        item_desc=investmentdesc,
        category="investment",
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
                budget_scope=getattr(tx, "budget_scope", None),
                budget_before_amount=getattr(tx, "budget_before_amount", None),
                budget_after_amount=getattr(tx, "budget_after_amount", None),
            )
            for tx, period in rows
        ],
    )


@router.delete("/{investmentdesc}", status_code=204)
def delete_investment_item(budgetid: int, investmentdesc: str, db: Session = Depends(get_db)):
    item = db.get(InvestmentItem, (budgetid, investmentdesc))
    if not item:
        raise HTTPException(404, "Investment item not found")
    _assert_investment_delete_allowed(budgetid, investmentdesc, db)
    db.delete(item)
    db.commit()
