from datetime import timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import (
    Budget, FinancialPeriod, IncomeType,
    ExpenseItem, PeriodIncome, PeriodExpense, BalanceType, PeriodBalance,
    InvestmentItem, PeriodInvestment,
)
from ..schemas import (
    PeriodGenerateRequest, PeriodOut, PeriodDetailOut,
    PeriodLockRequest, PeriodIncomeOut, PeriodExpenseOut,
    PeriodIncomeActualUpdate, PeriodExpenseActualUpdate,
    PeriodIncomeAddActual, PeriodExpenseAddActual,
    AddExpenseToPeriodRequest, AddIncomeToPeriodRequest,
    SavingsTransferRequest,
    PeriodBalanceOut, PeriodExpenseReorderRequest, PeriodInvestmentOut,
    PeriodExpenseStatusUpdate, PeriodExpenseBudgetUpdate, PeriodExpenseNoteUpdate,
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
    """Attach extra fields from ExpenseItem and compute remaining_amount."""
    out = []
    for pe in expenses:
        ei = db.get(ExpenseItem, (pe.budgetid, pe.expensedesc))
        d = PeriodExpenseOut.model_validate(pe)
        if ei:
            d.freqtype = ei.freqtype
            d.frequency_value = ei.frequency_value
            d.paytype = ei.paytype
            d.effectivedate = ei.effectivedate
        # remaining_amount: 0 when Paid, else budget - actual
        status = getattr(pe, 'status', 'Current') or 'Current'
        d.status = status
        if status == 'Paid':
            d.remaining_amount = Decimal("0")
        else:
            d.remaining_amount = Decimal(str(pe.budgetamount)) - Decimal(str(pe.actualamount))
        out.append(d)
    return out


def _enrich_investments(investments: list, db) -> list[PeriodInvestmentOut]:
    """Attach linked_account_desc and compute remaining_amount."""
    from ..models import InvestmentItem as InvItem
    out = []
    for pi in investments:
        ii = db.get(InvItem, (pi.budgetid, pi.investmentdesc))
        d = PeriodInvestmentOut.model_validate(pi)
        if ii:
            d.linked_account_desc = ii.linked_account_desc
        d.remaining_amount = Decimal(str(pi.budgeted_amount)) - Decimal(str(pi.actualamount))
        out.append(d)
    return out


# ── Generate ──────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=PeriodOut, status_code=201)
def generate_period(payload: PeriodGenerateRequest, db: Session = Depends(get_db)):
    budget: Budget | None = db.get(Budget, payload.budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    # Validate once
    income_count = db.query(IncomeType).filter(IncomeType.budgetid == payload.budgetid).count()
    if income_count == 0:
        raise HTTPException(422, "Budget must have at least one income type before generating a period")

    expense_count = db.query(ExpenseItem).filter(
        ExpenseItem.budgetid == payload.budgetid,
        ExpenseItem.active == True,  # noqa: E712
    ).count()
    if expense_count == 0:
        raise HTTPException(422, "Budget must have at least one active expense item before generating a period")

    # Load items once for all iterations
    income_types = db.query(IncomeType).filter(
        IncomeType.budgetid == payload.budgetid,
        IncomeType.autoinclude == True,  # noqa: E712
    ).all()
    expense_items = db.query(ExpenseItem).filter(
        ExpenseItem.budgetid == payload.budgetid,
        ExpenseItem.active == True,  # noqa: E712
    ).all()
    balance_types = db.query(BalanceType).filter(
        BalanceType.budgetid == payload.budgetid,
        BalanceType.active == True,  # noqa: E712
    ).all()
    investment_items = db.query(InvestmentItem).filter(
        InvestmentItem.budgetid == payload.budgetid,
        InvestmentItem.active == True,  # noqa: E712
    ).all()

    current_start = payload.startdate.replace(hour=0, minute=0, second=0, microsecond=0)
    last_period = None

    for _i in range(max(1, payload.count)):
        current_end = calc_period_end(current_start, budget.budget_frequency)

        # Overlap check against all existing periods (including flushed ones from prior iterations)
        existing = db.query(FinancialPeriod).filter(
            FinancialPeriod.budgetid == payload.budgetid
        ).all()
        for ep in existing:
            if periods_overlap(current_start, current_end, ep.startdate, ep.enddate):
                raise HTTPException(
                    409,
                    f"Period overlaps with existing period "
                    f"{ep.startdate.date()} – {ep.enddate.date()} (id={ep.finperiodid})",
                )

        period = FinancialPeriod(
            budgetid=payload.budgetid,
            startdate=current_start,
            enddate=current_end,
            budgetowner=budget.budgetowner,
            islocked=False,
        )
        db.add(period)
        db.flush()

        # Populate income rows for autoinclude income types
        for it in income_types:
            budget_amount = Decimal(str(it.amount)) if it.isfixed else Decimal("0.00")
            db.add(PeriodIncome(
                finperiodid=period.finperiodid,
                budgetid=payload.budgetid,
                incomedesc=it.incomedesc,
                budgetamount=budget_amount,
                actualamount=Decimal("0.00"),
                varianceamount=Decimal("0.00"),
            ))

        # Populate expense rows for active expense items
        for ei in expense_items:
            if ei.freqtype == "Always":
                budgeted = Decimal(str(ei.expenseamount))
            elif ei.freqtype and ei.frequency_value and ei.effectivedate:
                budgeted = expense_occurs_in_period(
                    freqtype=ei.freqtype,
                    frequency_value=ei.frequency_value,
                    effectivedate=ei.effectivedate,
                    period_start=current_start,
                    period_end=current_end,
                    expense_amount=Decimal(str(ei.expenseamount)),
                )
            else:
                budgeted = None

            if budgeted is not None:
                db.add(PeriodExpense(
                    finperiodid=period.finperiodid,
                    budgetid=payload.budgetid,
                    expensedesc=ei.expensedesc,
                    budgetamount=budgeted,
                    actualamount=Decimal("0.00"),
                    varianceamount=Decimal("0.00"),
                    is_oneoff=False,
                    sort_order=ei.sort_order,
                    revision_snapshot=ei.revisionnum,
                    status='Current',
                ))

        # Find the period immediately before current_start (includes ones flushed earlier)
        prev_period = (
            db.query(FinancialPeriod)
            .filter(
                FinancialPeriod.budgetid == payload.budgetid,
                FinancialPeriod.enddate < current_start,
            )
            .order_by(FinancialPeriod.enddate.desc())
            .first()
        )

        # Populate balance rows
        for bt in balance_types:
            if prev_period:
                prev_pb = db.get(PeriodBalance, (prev_period.finperiodid, bt.balancedesc))
                opening = Decimal(str(prev_pb.closing_amount)) if prev_pb else Decimal(str(bt.opening_balance))
            else:
                opening = Decimal(str(bt.opening_balance))
            db.add(PeriodBalance(
                finperiodid=period.finperiodid,
                budgetid=payload.budgetid,
                balancedesc=bt.balancedesc,
                opening_amount=opening,
                closing_amount=opening,
            ))

        # Populate investment rows
        for ii in investment_items:
            if prev_period:
                prev_pi = db.get(PeriodInvestment, (prev_period.finperiodid, ii.investmentdesc))
                opening = Decimal(str(prev_pi.closing_value)) if prev_pi else Decimal(str(ii.initial_value))
            else:
                opening = Decimal(str(ii.initial_value))
            db.add(PeriodInvestment(
                finperiodid=period.finperiodid,
                budgetid=payload.budgetid,
                investmentdesc=ii.investmentdesc,
                opening_value=opening,
                closing_value=opening,
                budgeted_amount=Decimal("0.00"),
                actualamount=Decimal("0.00"),
            ))

        last_period = period
        current_start = current_end + timedelta(days=1)

    db.commit()
    db.refresh(last_period)
    return last_period


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
    expenses = (
        db.query(PeriodExpense)
        .filter(PeriodExpense.finperiodid == finperiodid)
        .order_by(PeriodExpense.sort_order, PeriodExpense.expensedesc)
        .all()
    )
    investments = (
        db.query(PeriodInvestment)
        .filter(PeriodInvestment.finperiodid == finperiodid)
        .all()
    )
    balance_rows = db.query(PeriodBalance).filter(PeriodBalance.finperiodid == finperiodid).all()
    enriched_balances = []
    for pb in balance_rows:
        bt = db.get(BalanceType, (pb.budgetid, pb.balancedesc))
        d = PeriodBalanceOut.model_validate(pb)
        d.balance_type = bt.balance_type if bt else None
        enriched_balances.append(d)
    return PeriodDetailOut(
        period=PeriodOut.model_validate(period),
        incomes=[PeriodIncomeOut.model_validate(i) for i in incomes],
        expenses=_enrich_expenses(expenses, db),
        investments=_enrich_investments(investments, db),
        balances=enriched_balances,
    )


# ── Lock / Unlock ─────────────────────────────────────────────────────────────

@router.patch("/{finperiodid}/lock", response_model=PeriodOut)
def set_period_lock(finperiodid: int, payload: PeriodLockRequest, db: Session = Depends(get_db)):
    period = _get_period_or_404(finperiodid, db)
    period.islocked = payload.islocked
    db.commit()
    db.refresh(period)
    return period


_TRANSFER_PREFIX = "Transfer from "


def _update_balance(finperiodid: int, balancedesc: str, movement: Decimal, db: Session) -> None:
    pb = db.get(PeriodBalance, (finperiodid, balancedesc))
    if pb:
        pb.movement_amount = Decimal(str(pb.movement_amount)) + movement
        pb.closing_amount = Decimal(str(pb.opening_amount)) + Decimal(str(pb.movement_amount))


def _apply_account_movement(finperiodid: int, incomedesc: str, budgetid: int, delta: Decimal, db: Session) -> None:
    """Update linked account balances when income actuals change.

    - Savings transfer lines ("Transfer from X"): debit savings, credit primary account.
    - Regular income types with a linked_account: credit that account.
    """
    if incomedesc.startswith(_TRANSFER_PREFIX):
        balancedesc = incomedesc[len(_TRANSFER_PREFIX):]
        _update_balance(finperiodid, balancedesc, -delta, db)  # savings loses money
        # Also credit the primary banking account
        primary = (
            db.query(BalanceType)
            .filter(BalanceType.budgetid == budgetid, BalanceType.is_primary == True)  # noqa: E712
            .first()
        )
        if primary:
            _update_balance(finperiodid, primary.balancedesc, delta, db)  # primary gains money
    else:
        it = db.get(IncomeType, (budgetid, incomedesc))
        if not it or not it.linked_account:
            return
        _update_balance(finperiodid, it.linked_account, delta, db)  # transaction account gains money


# ── Update actual income (set) ────────────────────────────────────────────────

@router.patch("/{finperiodid}/income/{incomedesc}", response_model=PeriodIncomeOut)
def update_income_actual(
    finperiodid: int,
    incomedesc: str,
    payload: PeriodIncomeActualUpdate,
    db: Session = Depends(get_db),
):
    period = _get_period_or_404(finperiodid, db)
    pi = db.get(PeriodIncome, (finperiodid, incomedesc))
    if not pi:
        raise HTTPException(404, "Period income entry not found")
    old_actual = Decimal(str(pi.actualamount or 0))
    pi.actualamount = payload.actualamount
    pi.varianceamount = pi.actualamount - pi.budgetamount
    delta = payload.actualamount - old_actual
    _apply_account_movement(finperiodid, incomedesc, period.budgetid, delta, db)
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
    period = _get_period_or_404(finperiodid, db)
    pi = db.get(PeriodIncome, (finperiodid, incomedesc))
    if not pi:
        raise HTTPException(404, "Period income entry not found")
    pi.actualamount = (pi.actualamount or Decimal("0")) + payload.amount
    pi.varianceamount = pi.actualamount - pi.budgetamount
    _apply_account_movement(finperiodid, incomedesc, period.budgetid, payload.amount, db)
    db.commit()
    db.refresh(pi)
    return pi


def _debit_primary_account(finperiodid: int, budgetid: int, delta: Decimal, db: Session) -> None:
    """Deduct delta from the primary account's period balance (expenses reduce the account)."""
    primary = (
        db.query(BalanceType)
        .filter(BalanceType.budgetid == budgetid, BalanceType.is_primary == True)  # noqa: E712
        .first()
    )
    if primary:
        _update_balance(finperiodid, primary.balancedesc, -delta, db)


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
    old_actual = Decimal(str(pe.actualamount or 0))
    pe.actualamount = payload.actualamount
    pe.varianceamount = pe.actualamount - pe.budgetamount
    delta = payload.actualamount - old_actual
    _debit_primary_account(finperiodid, period.budgetid, delta, db)
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
    pe.actualamount = (pe.actualamount or Decimal("0")) + payload.amount
    pe.varianceamount = pe.actualamount - pe.budgetamount
    _debit_primary_account(finperiodid, period.budgetid, payload.amount, db)
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
        status='Current',
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
                if ei.freqtype == "Always":
                    budgeted = Decimal(str(ei.expenseamount))
                elif ei.freqtype and ei.frequency_value and ei.effectivedate:
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


# ── Savings transfer ──────────────────────────────────────────────────────────

@router.post("/{finperiodid}/savings-transfer", response_model=PeriodIncomeOut, status_code=201)
def savings_transfer(
    finperiodid: int,
    payload: SavingsTransferRequest,
    db: Session = Depends(get_db),
):
    period = _get_period_or_404(finperiodid, db)
    _assert_unlocked(period)

    bt = db.get(BalanceType, (payload.budgetid, payload.balancedesc))
    if not bt:
        raise HTTPException(404, "Account not found")
    if bt.balance_type != 'Savings':
        raise HTTPException(422, "Account is not a savings account")

    pb = db.get(PeriodBalance, (finperiodid, payload.balancedesc))
    if not pb:
        raise HTTPException(404, "Account has no balance record for this period")

    incomedesc = f"Transfer from {payload.balancedesc}"
    existing = db.get(PeriodIncome, (finperiodid, incomedesc))
    if existing:
        raise HTTPException(409, "A transfer from this account already exists in this period")

    pi = PeriodIncome(
        finperiodid=finperiodid,
        budgetid=payload.budgetid,
        incomedesc=incomedesc,
        budgetamount=payload.amount,
        actualamount=Decimal("0.00"),
        varianceamount=-payload.amount,
    )
    db.add(pi)

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


# ── Update expense status (Current | Paid | Revised) ─────────────────────────

@router.patch("/{finperiodid}/expense/{expensedesc}/status", response_model=PeriodExpenseOut)
def set_expense_status(
    finperiodid: int,
    expensedesc: str,
    payload: PeriodExpenseStatusUpdate,
    db: Session = Depends(get_db),
):
    allowed = {'Current', 'Paid', 'Revised'}
    if payload.status not in allowed:
        raise HTTPException(422, f"status must be one of {allowed}")
    pe = (
        db.query(PeriodExpense)
        .filter(PeriodExpense.finperiodid == finperiodid, PeriodExpense.expensedesc == expensedesc)
        .first()
    )
    if not pe:
        raise HTTPException(404, "Period expense not found")
    pe.status = payload.status
    db.commit()
    db.refresh(pe)
    return _enrich_expenses([pe], db)[0]


# ── Edit budget amount for a period expense ────────────────────────────────────

@router.patch("/{finperiodid}/expense/{expensedesc}/budget", response_model=PeriodExpenseOut)
def update_expense_budget(
    finperiodid: int,
    expensedesc: str,
    payload: PeriodExpenseBudgetUpdate,
    db: Session = Depends(get_db),
):
    period = _get_period_or_404(finperiodid, db)
    _assert_unlocked(period)
    pe = (
        db.query(PeriodExpense)
        .filter(PeriodExpense.finperiodid == finperiodid, PeriodExpense.expensedesc == expensedesc)
        .first()
    )
    if not pe:
        raise HTTPException(404, "Period expense not found")
    pe.budgetamount = payload.budgetamount
    pe.varianceamount = pe.actualamount - pe.budgetamount
    db.commit()
    db.refresh(pe)
    return _enrich_expenses([pe], db)[0]


# ── Update note on a period expense ──────────────────────────────────────────

@router.patch("/{finperiodid}/expense/{expensedesc}/note", response_model=PeriodExpenseOut)
def update_expense_note(
    finperiodid: int,
    expensedesc: str,
    payload: PeriodExpenseNoteUpdate,
    db: Session = Depends(get_db),
):
    _get_period_or_404(finperiodid, db)
    pe = (
        db.query(PeriodExpense)
        .filter(PeriodExpense.finperiodid == finperiodid, PeriodExpense.expensedesc == expensedesc)
        .first()
    )
    if not pe:
        raise HTTPException(404, "Period expense not found")
    pe.note = payload.note or None
    db.commit()
    db.refresh(pe)
    return _enrich_expenses([pe], db)[0]


# ── Remove income from period ─────────────────────────────────────────────────

@router.delete("/{finperiodid}/income/{incomedesc}", status_code=204)
def remove_income_from_period(
    finperiodid: int,
    incomedesc: str,
    db: Session = Depends(get_db),
):
    period = _get_period_or_404(finperiodid, db)
    _assert_unlocked(period)
    pi = db.get(PeriodIncome, (finperiodid, incomedesc))
    if not pi:
        raise HTTPException(404, "Period income entry not found")
    if Decimal(str(pi.actualamount)) != Decimal("0"):
        raise HTTPException(409, "Cannot remove income with recorded actuals")
    db.delete(pi)
    db.commit()


# ── Remove expense from period (only if no actuals recorded) ──────────────────

@router.delete("/{finperiodid}/expense/{expensedesc}", status_code=204)
def remove_expense_from_period(
    finperiodid: int,
    expensedesc: str,
    db: Session = Depends(get_db),
):
    period = _get_period_or_404(finperiodid, db)
    _assert_unlocked(period)
    pe = (
        db.query(PeriodExpense)
        .filter(PeriodExpense.finperiodid == finperiodid, PeriodExpense.expensedesc == expensedesc)
        .first()
    )
    if not pe:
        raise HTTPException(404, "Period expense not found")
    if Decimal(str(pe.actualamount)) != Decimal("0"):
        raise HTTPException(409, "Cannot remove expense with recorded actuals")
    db.delete(pe)
    db.commit()


# ── Update investment budget amount ───────────────────────────────────────────

@router.patch("/{finperiodid}/investment/{investmentdesc}/budget", response_model=PeriodInvestmentOut)
def update_investment_budget(
    finperiodid: int,
    investmentdesc: str,
    payload: PeriodExpenseBudgetUpdate,
    db: Session = Depends(get_db),
):
    period = _get_period_or_404(finperiodid, db)
    _assert_unlocked(period)
    pi = db.get(PeriodInvestment, (finperiodid, investmentdesc))
    if not pi:
        raise HTTPException(404, "Period investment not found")
    pi.budgeted_amount = payload.budgetamount
    db.commit()
    db.refresh(pi)
    return _enrich_investments([pi], db)[0]


# ── Reorder expenses in a period ──────────────────────────────────────────────

@router.patch("/{finperiodid}/expenses/reorder", status_code=204)
def reorder_period_expenses(
    finperiodid: int,
    payload: PeriodExpenseReorderRequest,
    db: Session = Depends(get_db),
):
    _get_period_or_404(finperiodid, db)
    for item in payload.items:
        pe = (
            db.query(PeriodExpense)
            .filter(
                PeriodExpense.finperiodid == finperiodid,
                PeriodExpense.expensedesc == item.expensedesc,
            )
            .first()
        )
        if pe:
            pe.sort_order = item.sort_order
    db.commit()
