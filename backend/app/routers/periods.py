from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    Budget, FinancialPeriod, IncomeType,
    ExpenseItem, PeriodIncome, PeriodExpense,
)
from ..schemas import (
    PeriodGenerateRequest, PeriodOut, PeriodDetailOut,
    PeriodLockRequest, PeriodIncomeOut, PeriodExpenseOut,
    PeriodIncomeActualUpdate, PeriodExpenseActualUpdate,
    PeriodIncomeAddActual, PeriodExpenseAddActual,
    AddExpenseToPeriodRequest, AddIncomeToPeriodRequest,
)
from ..period_logic import calc_period_end, periods_overlap, expense_occurs_in_period

router = APIRouter(prefix="/periods", tags=["periods"])


def _get_period_or_404(finperiodid: int, db: Session) -> FinancialPeriod:
    p = db.get(FinancialPeriod, finperiodid)
    if not p:
        raise HTTPException(404, "Period not found")
    return p


def _assert_unlocked(period: FinancialPeriod) -> None:
    if period.islocked:
        raise HTTPException(423, "Period is locked — unlock it before making changes")


def _enrich_expenses(expenses: list[PeriodExpense], db: Session) -> list[PeriodExpenseOut]:
    """Attach freqtype/frequency_value/paytype from ExpenseItem to each PeriodExpense."""
    out = []
    for pe in expenses:
        ei = db.get(ExpenseItem, (pe.budgetid, pe.expensedesc))
        d = PeriodExpenseOut.model_validate(pe)
        if ei:
            d.freqtype = ei.freqtype
            d.frequency_value = ei.frequency_value
            d.paytype = ei.paytype
        out.append(d)
    return out


# ── Generate ──────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=PeriodOut, status_code=201)
def generate_period(payload: PeriodGenerateRequest, db: Session = Depends(get_db)):
    budget: Budget | None = db.get(Budget, payload.budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    # Require at least one income type and one active expense item
    income_count = db.query(IncomeType).filter(IncomeType.budgetid == payload.budgetid).count()
    if income_count == 0:
        raise HTTPException(422, "Budget must have at least one income type before generating a period")

    expense_count = db.query(ExpenseItem).filter(
        ExpenseItem.budgetid == payload.budgetid,
        ExpenseItem.active == True,  # noqa: E712
    ).count()
    if expense_count == 0:
        raise HTTPException(422, "Budget must have at least one active expense item before generating a period")

    start = payload.startdate.replace(hour=0, minute=0, second=0, microsecond=0)
    end = calc_period_end(start, budget.budget_frequency)

    # Overlap check
    existing = db.query(FinancialPeriod).filter(
        FinancialPeriod.budgetid == payload.budgetid
    ).all()
    for ep in existing:
        if periods_overlap(start, end, ep.startdate, ep.enddate):
            raise HTTPException(
                409,
                f"Period overlaps with existing period "
                f"{ep.startdate.date()} – {ep.enddate.date()} (id={ep.finperiodid})",
            )

    period = FinancialPeriod(
        budgetid=payload.budgetid,
        startdate=start,
        enddate=end,
        budgetowner=budget.budgetowner,
        islocked=False,
    )
    db.add(period)
    db.flush()

    # Populate income rows for autoinclude income types
    income_types = db.query(IncomeType).filter(
        IncomeType.budgetid == payload.budgetid,
        IncomeType.autoinclude == True,  # noqa: E712
    ).all()
    for it in income_types:
        budget_amount = Decimal(str(it.amount)) if it.isfixed else Decimal("0.00")
        pi = PeriodIncome(
            finperiodid=period.finperiodid,
            budgetid=payload.budgetid,
            incomedesc=it.incomedesc,
            budgetamount=budget_amount,
            actualamount=Decimal("0.00"),
            varianceamount=Decimal("0.00"),
        )
        db.add(pi)

    # Populate expense rows for active expense items
    expense_items = db.query(ExpenseItem).filter(
        ExpenseItem.budgetid == payload.budgetid,
        ExpenseItem.active == True,  # noqa: E712
    ).all()
    for ei in expense_items:
        if ei.freqtype and ei.frequency_value and ei.effectivedate:
            budgeted = expense_occurs_in_period(
                freqtype=ei.freqtype,
                frequency_value=ei.frequency_value,
                effectivedate=ei.effectivedate,
                period_start=start,
                period_end=end,
                expense_amount=Decimal(str(ei.expenseamount)),
            )
        else:
            budgeted = None

        if budgeted is not None:
            pe = PeriodExpense(
                finperiodid=period.finperiodid,
                budgetid=payload.budgetid,
                expensedesc=ei.expensedesc,
                budgetamount=budgeted,
                actualamount=Decimal("0.00"),
                varianceamount=Decimal("0.00"),
                is_oneoff=False,
            )
            db.add(pe)

    db.commit()
    db.refresh(period)
    return period


# ── List / Get ────────────────────────────────────────────────────────────────

@router.get("/budget/{budgetid}", response_model=list[PeriodOut])
def list_periods_for_budget(budgetid: int, db: Session = Depends(get_db)):
    if not db.get(Budget, budgetid):
        raise HTTPException(404, "Budget not found")
    return (
        db.query(FinancialPeriod)
        .filter(FinancialPeriod.budgetid == budgetid)
        .order_by(FinancialPeriod.startdate)
        .all()
    )


@router.get("/{finperiodid}", response_model=PeriodDetailOut)
def get_period_detail(finperiodid: int, db: Session = Depends(get_db)):
    period = _get_period_or_404(finperiodid, db)
    incomes = db.query(PeriodIncome).filter(PeriodIncome.finperiodid == finperiodid).all()
    expenses = db.query(PeriodExpense).filter(PeriodExpense.finperiodid == finperiodid).all()
    return PeriodDetailOut(
        period=PeriodOut.model_validate(period),
        incomes=[PeriodIncomeOut.model_validate(i) for i in incomes],
        expenses=_enrich_expenses(expenses, db),
    )


# ── Lock / Unlock ─────────────────────────────────────────────────────────────

@router.patch("/{finperiodid}/lock", response_model=PeriodOut)
def set_period_lock(finperiodid: int, payload: PeriodLockRequest, db: Session = Depends(get_db)):
    period = _get_period_or_404(finperiodid, db)
    period.islocked = payload.islocked
    db.commit()
    db.refresh(period)
    return period


# ── Update actual income (set) ────────────────────────────────────────────────

@router.patch("/{finperiodid}/income/{incomedesc}", response_model=PeriodIncomeOut)
def update_income_actual(
    finperiodid: int,
    incomedesc: str,
    payload: PeriodIncomeActualUpdate,
    db: Session = Depends(get_db),
):
    _get_period_or_404(finperiodid, db)
    pi = db.get(PeriodIncome, (finperiodid, incomedesc))
    if not pi:
        raise HTTPException(404, "Period income entry not found")
    pi.actualamount = payload.actualamount
    pi.varianceamount = pi.actualamount - pi.budgetamount
    db.commit()
    db.refresh(pi)
    return pi


# ── Add to actual income (additive) ──────────────────────────────────────────

@router.post("/{finperiodid}/income/{incomedesc}/add", response_model=PeriodIncomeOut)
def add_income_actual(
    finperiodid: int,
    incomedesc: str,
    payload: PeriodIncomeAddActual,
    db: Session = Depends(get_db),
):
    _get_period_or_404(finperiodid, db)
    pi = db.get(PeriodIncome, (finperiodid, incomedesc))
    if not pi:
        raise HTTPException(404, "Period income entry not found")
    pi.actualamount = (pi.actualamount or Decimal("0")) + payload.amount
    pi.varianceamount = pi.actualamount - pi.budgetamount
    db.commit()
    db.refresh(pi)
    return pi


# ── Update actual expense (set) ───────────────────────────────────────────────

@router.patch("/{finperiodid}/expense/{expensedesc}", response_model=PeriodExpenseOut)
def update_expense_actual(
    finperiodid: int,
    expensedesc: str,
    payload: PeriodExpenseActualUpdate,
    db: Session = Depends(get_db),
):
    period = _get_period_or_404(finperiodid, db)
    pe = (
        db.query(PeriodExpense)
        .filter(
            PeriodExpense.finperiodid == finperiodid,
            PeriodExpense.expensedesc == expensedesc,
        )
        .first()
    )
    if not pe:
        raise HTTPException(404, "Period expense entry not found")
    pe.actualamount = payload.actualamount
    pe.varianceamount = pe.actualamount - pe.budgetamount
    db.commit()
    db.refresh(pe)
    return _enrich_expenses([pe], db)[0]


# ── Add to actual expense (additive) ─────────────────────────────────────────

@router.post("/{finperiodid}/expense/{expensedesc}/add", response_model=PeriodExpenseOut)
def add_expense_actual(
    finperiodid: int,
    expensedesc: str,
    payload: PeriodExpenseAddActual,
    db: Session = Depends(get_db),
):
    _get_period_or_404(finperiodid, db)
    pe = (
        db.query(PeriodExpense)
        .filter(
            PeriodExpense.finperiodid == finperiodid,
            PeriodExpense.expensedesc == expensedesc,
        )
        .first()
    )
    if not pe:
        raise HTTPException(404, "Period expense entry not found")
    pe.actualamount = (pe.actualamount or Decimal("0")) + payload.amount
    pe.varianceamount = pe.actualamount - pe.budgetamount
    db.commit()
    db.refresh(pe)
    return _enrich_expenses([pe], db)[0]


# ── Add expense to period ─────────────────────────────────────────────────────

@router.post("/{finperiodid}/add-expense", response_model=PeriodExpenseOut, status_code=201)
def add_expense_to_period(
    finperiodid: int,
    payload: AddExpenseToPeriodRequest,
    db: Session = Depends(get_db),
):
    period = _get_period_or_404(finperiodid, db)
    _assert_unlocked(period)

    ei = db.get(ExpenseItem, (payload.budgetid, payload.expensedesc))
    if not ei:
        raise HTTPException(404, "Expense item not found")

    existing = (
        db.query(PeriodExpense)
        .filter(
            PeriodExpense.finperiodid == finperiodid,
            PeriodExpense.budgetid == payload.budgetid,
            PeriodExpense.expensedesc == payload.expensedesc,
        )
        .first()
    )
    if existing:
        raise HTTPException(409, "Expense already exists in this period")

    is_oneoff = payload.scope == "oneoff"

    pe = PeriodExpense(
        finperiodid=finperiodid,
        budgetid=payload.budgetid,
        expensedesc=payload.expensedesc,
        budgetamount=payload.budgetamount,
        actualamount=Decimal("0.00"),
        varianceamount=Decimal("0.00"),
        is_oneoff=is_oneoff,
    )
    db.add(pe)

    if not is_oneoff:
        ei.active = True
        future_periods = (
            db.query(FinancialPeriod)
            .filter(
                FinancialPeriod.budgetid == payload.budgetid,
                FinancialPeriod.startdate > period.startdate,
                FinancialPeriod.islocked == False,  # noqa: E712
            )
            .all()
        )
        for fp in future_periods:
            already = (
                db.query(PeriodExpense)
                .filter(
                    PeriodExpense.finperiodid == fp.finperiodid,
                    PeriodExpense.budgetid == payload.budgetid,
                    PeriodExpense.expensedesc == payload.expensedesc,
                )
                .first()
            )
            if not already:
                if ei.freqtype and ei.frequency_value and ei.effectivedate:
                    budgeted = expense_occurs_in_period(
                        freqtype=ei.freqtype,
                        frequency_value=ei.frequency_value,
                        effectivedate=ei.effectivedate,
                        period_start=fp.startdate,
                        period_end=fp.enddate,
                        expense_amount=Decimal(str(ei.expenseamount)),
                    ) or Decimal("0.00")
                else:
                    budgeted = payload.budgetamount
                db.add(PeriodExpense(
                    finperiodid=fp.finperiodid,
                    budgetid=payload.budgetid,
                    expensedesc=payload.expensedesc,
                    budgetamount=budgeted,
                    actualamount=Decimal("0.00"),
                    varianceamount=Decimal("0.00"),
                    is_oneoff=False,
                ))

    db.commit()
    db.refresh(pe)
    return _enrich_expenses([pe], db)[0]


# ── Add income to period ──────────────────────────────────────────────────────

@router.post("/{finperiodid}/add-income", response_model=PeriodIncomeOut, status_code=201)
def add_income_to_period(
    finperiodid: int,
    payload: AddIncomeToPeriodRequest,
    db: Session = Depends(get_db),
):
    period = _get_period_or_404(finperiodid, db)
    _assert_unlocked(period)

    it = db.get(IncomeType, (payload.budgetid, payload.incomedesc))
    if not it:
        raise HTTPException(404, "Income type not found")

    existing = db.get(PeriodIncome, (finperiodid, payload.incomedesc))
    if existing:
        raise HTTPException(409, "Income already exists in this period")

    is_oneoff = payload.scope == "oneoff"

    pi = PeriodIncome(
        finperiodid=finperiodid,
        budgetid=payload.budgetid,
        incomedesc=payload.incomedesc,
        budgetamount=payload.budgetamount,
        actualamount=Decimal("0.00"),
        varianceamount=Decimal("0.00"),
    )
    db.add(pi)

    if not is_oneoff:
        it.autoinclude = True
        future_periods = (
            db.query(FinancialPeriod)
            .filter(
                FinancialPeriod.budgetid == payload.budgetid,
                FinancialPeriod.startdate > period.startdate,
                FinancialPeriod.islocked == False,  # noqa: E712
            )
            .all()
        )
        for fp in future_periods:
            already = db.get(PeriodIncome, (fp.finperiodid, payload.incomedesc))
            if not already:
                budget_amount = Decimal(str(it.amount)) if it.isfixed else payload.budgetamount
                db.add(PeriodIncome(
                    finperiodid=fp.finperiodid,
                    budgetid=payload.budgetid,
                    incomedesc=payload.incomedesc,
                    budgetamount=budget_amount,
                    actualamount=Decimal("0.00"),
                    varianceamount=Decimal("0.00"),
                ))

    db.commit()
    db.refresh(pi)
    return pi


# ── Delete period ─────────────────────────────────────────────────────────────

@router.delete("/{finperiodid}", status_code=204)
def delete_period(
    finperiodid: int,
    force: bool = Query(False),
    db: Session = Depends(get_db),
):
    period = _get_period_or_404(finperiodid, db)
    _assert_unlocked(period)

    if not force:
        # Check for any entered actual data
        has_expense_actuals = (
            db.query(PeriodExpense)
            .filter(
                PeriodExpense.finperiodid == finperiodid,
                PeriodExpense.actualamount != 0,
            )
            .first()
        )
        has_income_actuals = (
            db.query(PeriodIncome)
            .filter(
                PeriodIncome.finperiodid == finperiodid,
                PeriodIncome.actualamount != 0,
            )
            .first()
        )
        if has_expense_actuals or has_income_actuals:
            raise HTTPException(
                409,
                "Period has recorded actual values. Pass ?force=true to delete anyway."
            )

    db.delete(period)
    db.commit()
