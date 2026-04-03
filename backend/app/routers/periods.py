from collections import defaultdict
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..budget_health import _build_current_period_check, _current_period_totals
from ..cycle_constants import (
    ACTIVE,
    CARRIED_FORWARD_DESC,
    CARRIED_FORWARD_SYSTEM_KEY,
    CLOSED,
    PAID,
    PLANNED,
    REVISED,
    WORKING,
)
from ..cycle_management import (
    assign_period_lifecycle_states,
    build_closeout_preview,
    close_cycle,
    cycle_status,
    has_cycle_actuals,
    has_cycle_transactions,
    next_period_for,
    ordered_budget_periods,
    recalculate_budget_chain,
)
from ..database import get_db
from ..models import (
    Budget, FinancialPeriod, IncomeType,
    ExpenseItem, PeriodIncome, PeriodExpense, BalanceType, PeriodBalance,
    InvestmentItem, PeriodInvestment,
)
from ..schemas import (
    PeriodGenerateRequest, PeriodOut, PeriodDetailOut, PeriodSummaryOut,
    PeriodLockRequest, PeriodIncomeOut, PeriodExpenseOut,
    PeriodIncomeActualUpdate, PeriodExpenseActualUpdate,
    PeriodIncomeAddActual, PeriodExpenseAddActual,
    AddExpenseToPeriodRequest, AddIncomeToPeriodRequest,
    SavingsTransferRequest,
    PeriodBalanceOut, PeriodExpenseReorderRequest, PeriodInvestmentOut,
    PeriodExpenseStatusUpdate, PeriodExpenseBudgetUpdate, PeriodExpenseNoteUpdate,
    PeriodCloseoutPreviewOut, PeriodCloseoutRequest, PeriodDeleteOptionsOut,
    PeriodInvestmentStatusUpdate,
)
from ..period_logic import calc_period_end, periods_overlap, expense_occurs_in_period
from ..time_utils import app_now_naive
from ..transaction_ledger import build_expense_tx, build_income_tx, sync_period_state

router = APIRouter(prefix="/periods", tags=["periods"])


def _get_period_or_404(finperiodid: int, db: Session) -> FinancialPeriod:
    p = db.get(FinancialPeriod, finperiodid)
    if not p:
        raise HTTPException(404, "Period not found")
    return p


def _assert_unlocked(period: FinancialPeriod) -> None:
    if period.islocked:
        raise HTTPException(423, "Period is locked — unlock it before making changes")


def _assert_not_closed(period: FinancialPeriod) -> None:
    if cycle_status(period) == CLOSED:
        raise HTTPException(423, "Budget cycle is closed — corrections must be handled through reconciliation")


def _assert_budget_editable(period: FinancialPeriod, budget: Budget) -> None:
    _assert_not_closed(period)
    if budget.allow_cycle_lock and period.islocked:
        raise HTTPException(423, "Budget cycle is locked — unlock it before changing budget structure")


def _assert_expense_not_paid(pe: PeriodExpense) -> None:
    if (getattr(pe, "status", WORKING) or WORKING) == PAID:
        raise HTTPException(423, "Expense is marked Paid — revise it before making changes")


def _assert_investment_not_paid(pi: PeriodInvestment) -> None:
    if (getattr(pi, "status", WORKING) or WORKING) == PAID:
        raise HTTPException(423, "Investment is marked Paid — revise it before making changes")


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
        status = getattr(pe, 'status', WORKING) or WORKING
        d.status = status
        if status == PAID:
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
        d.status = getattr(pi, "status", WORKING) or WORKING
        if d.status == PAID:
            d.remaining_amount = Decimal("0")
        else:
            d.remaining_amount = Decimal(str(pi.budgeted_amount)) - Decimal(str(pi.actualamount))
        out.append(d)
    return out


def _period_status(period: FinancialPeriod, now: datetime) -> str:
    status = cycle_status(period)
    if status == ACTIVE:
        return "Current"
    if status == PLANNED:
        return "Future"
    return "Historical"


def _projected_savings(period_status: str, savings_budget: Decimal, savings_actual: Decimal) -> Decimal:
    if period_status == "Historical":
        return savings_actual
    if period_status == "Current":
        if savings_actual <= Decimal("0"):
            return savings_budget
        if savings_actual < savings_budget:
            return savings_budget - savings_actual
        return savings_actual
    return savings_budget


def _pick_auto_surplus_investment(investment_items: list[InvestmentItem]) -> Optional[InvestmentItem]:
    for item in investment_items:
        if item.active and item.is_primary:
            return item
    return None


def _normalize_period_datetime(value: datetime) -> datetime:
    if value.tzinfo is not None:
        value = value.replace(tzinfo=None)
    return value.replace(hour=0, minute=0, second=0, microsecond=0)


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
    auto_surplus_target = _pick_auto_surplus_investment(investment_items) if budget.auto_add_surplus_to_investment else None

    current_start = _normalize_period_datetime(payload.startdate)
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
            cycle_status=PLANNED,
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
        projected_expense_budget = Decimal("0.00")
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
                projected_expense_budget += budgeted
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
                    status=WORKING,
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

        projected_period_surplus = sum(
            (Decimal(str(it.amount)) if it.isfixed else Decimal("0.00") for it in income_types),
            Decimal("0.00"),
        ) - projected_expense_budget
        auto_surplus_amount = projected_period_surplus if projected_period_surplus > Decimal("0.00") else Decimal("0.00")

        # Populate investment rows
        for ii in investment_items:
            if prev_period:
                prev_pi = db.get(PeriodInvestment, (prev_period.finperiodid, ii.investmentdesc))
                opening = Decimal(str(prev_pi.closing_value)) if prev_pi else Decimal(str(ii.initial_value))
            else:
                opening = Decimal(str(ii.initial_value))
            budgeted_amount = Decimal("0.00")
            if auto_surplus_target and ii.investmentdesc == auto_surplus_target.investmentdesc:
                budgeted_amount = auto_surplus_amount
            db.add(PeriodInvestment(
                finperiodid=period.finperiodid,
                budgetid=payload.budgetid,
                investmentdesc=ii.investmentdesc,
                opening_value=opening,
                closing_value=opening,
                budgeted_amount=budgeted_amount,
                actualamount=Decimal("0.00"),
                status=WORKING,
            ))

        last_period = period
        current_start = current_end + timedelta(days=1)

    db.commit()
    assign_period_lifecycle_states(payload.budgetid, db)
    recalculate_budget_chain(payload.budgetid, db)
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


@router.get("/budget/{budgetid}/summary", response_model=list[PeriodSummaryOut])
def list_period_summaries_for_budget(budgetid: int, db: Session = Depends(get_db)):
    if not db.get(Budget, budgetid):
        raise HTTPException(404, "Budget not found")

    periods = (
        db.query(FinancialPeriod)
        .filter(FinancialPeriod.budgetid == budgetid)
        .order_by(FinancialPeriod.startdate)
        .all()
    )

    if not periods:
        return []

    period_ids = [period.finperiodid for period in periods]
    income_rows = (
        db.query(PeriodIncome)
        .filter(PeriodIncome.finperiodid.in_(period_ids))
        .all()
    )
    expense_rows = (
        db.query(PeriodExpense)
        .filter(PeriodExpense.finperiodid.in_(period_ids))
        .all()
    )
    investment_rows = (
        db.query(PeriodInvestment)
        .filter(PeriodInvestment.finperiodid.in_(period_ids))
        .all()
    )
    incomes_by_period: dict[int, list[PeriodIncome]] = defaultdict(list)
    expenses_by_period: dict[int, list[PeriodExpense]] = defaultdict(list)
    investments_by_period: dict[int, list[PeriodInvestment]] = defaultdict(list)

    for row in income_rows:
        incomes_by_period[row.finperiodid].append(row)
    for row in expense_rows:
        expenses_by_period[row.finperiodid].append(row)
    for row in investment_rows:
        investments_by_period[row.finperiodid].append(row)

    now = app_now_naive()
    summaries: list[PeriodSummaryOut] = []
    cumulative_projected_savings = Decimal("0.00")

    for period in periods:
        incomes = incomes_by_period.get(period.finperiodid, [])
        expenses = expenses_by_period.get(period.finperiodid, [])
        investments = investments_by_period.get(period.finperiodid, [])

        income_budget = sum((Decimal(str(row.budgetamount or 0)) for row in incomes), Decimal("0.00"))
        income_actual = sum((Decimal(str(row.actualamount or 0)) for row in incomes), Decimal("0.00"))
        expense_budget = sum((
            Decimal(str(row.actualamount if (getattr(row, "status", WORKING) or WORKING) == PAID else row.budgetamount or 0))
            for row in expenses
        ), Decimal("0.00"))
        expense_actual = sum((Decimal(str(row.actualamount or 0)) for row in expenses), Decimal("0.00"))
        investment_budget = sum((
            Decimal(str(row.actualamount if (getattr(row, "status", WORKING) or WORKING) == PAID else row.budgeted_amount or 0))
            for row in investments
        ), Decimal("0.00"))
        investment_actual = sum((Decimal(str(row.actualamount or 0)) for row in investments), Decimal("0.00"))

        savings_budget = investment_budget
        savings_actual = investment_actual

        period_status = _period_status(period, now)
        later_periods = [candidate for candidate in periods if candidate.startdate > period.startdate]
        single_delete_allowed = (
            cycle_status(period) != CLOSED
            and not later_periods
            and not has_cycle_actuals(period.finperiodid, db)
            and not has_cycle_transactions(period.finperiodid, db)
        )
        future_chain_allowed = (
            cycle_status(period) != CLOSED
            and all(
                not has_cycle_actuals(candidate.finperiodid, db) and not has_cycle_transactions(candidate.finperiodid, db)
                for candidate in [period, *later_periods]
            )
        )
        can_delete = single_delete_allowed or future_chain_allowed
        delete_mode = "single" if single_delete_allowed else ("future_chain" if future_chain_allowed else None)
        delete_reason = None
        if not can_delete:
            delete_reason = "Cycles with actuals, transactions, or closed history cannot be deleted."
        elif delete_mode == "future_chain":
            delete_reason = "Deleting this cycle requires deleting it and all upcoming cycles to preserve continuity."

        cumulative_projected_savings += _projected_savings(period_status, savings_budget, savings_actual)

        summaries.append(PeriodSummaryOut(
            period=PeriodOut.model_validate(period),
            period_status=period_status,
            income_budget=income_budget,
            income_actual=income_actual,
            expense_budget=expense_budget,
            expense_actual=expense_actual,
            investment_budget=investment_budget,
            investment_actual=investment_actual,
            surplus_budget=income_budget - expense_budget - investment_budget,
            surplus_actual=income_actual - expense_actual - investment_actual,
            projected_savings=cumulative_projected_savings,
            can_delete=can_delete,
            delete_mode=delete_mode,
            delete_reason=delete_reason,
        ))

    return summaries


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
        closeout_snapshot=period.closeout_snapshot,
    )


# ── Lock / Unlock ─────────────────────────────────────────────────────────────

@router.patch("/{finperiodid}/lock", response_model=PeriodOut)
def set_period_lock(finperiodid: int, payload: PeriodLockRequest, db: Session = Depends(get_db)):
    period = _get_period_or_404(finperiodid, db)
    budget = db.get(Budget, period.budgetid)
    if cycle_status(period) == CLOSED:
        raise HTTPException(423, "Closed cycles cannot be unlocked")
    if not budget.allow_cycle_lock:
        raise HTTPException(409, "Manual cycle locking is disabled for this budget")
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
    period = _get_period_or_404(finperiodid, db)
    _assert_not_closed(period)
    pi = db.get(PeriodIncome, (finperiodid, incomedesc))
    if not pi:
        raise HTTPException(404, "Period income entry not found")
    old_actual = Decimal(str(pi.actualamount or 0))
    delta = payload.actualamount - old_actual
    build_income_tx(
        finperiodid,
        period.budgetid,
        incomedesc,
        delta,
        db,
        is_system=True,
        system_reason="income_actual_set",
        note="System adjustment from direct income actual update",
    )
    sync_period_state(finperiodid, db)
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
    _assert_not_closed(period)
    pi = db.get(PeriodIncome, (finperiodid, incomedesc))
    if not pi:
        raise HTTPException(404, "Period income entry not found")
    build_income_tx(
        finperiodid,
        period.budgetid,
        incomedesc,
        payload.amount,
        db,
        is_system=True,
        system_reason="income_actual_add",
        note="System adjustment from direct income actual addition",
    )
    sync_period_state(finperiodid, db)
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
    _assert_not_closed(period)
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
    _assert_expense_not_paid(pe)
    old_actual = Decimal(str(pe.actualamount or 0))
    delta = payload.actualamount - old_actual
    build_expense_tx(
        finperiodid,
        period.budgetid,
        expensedesc,
        delta,
        db,
        is_system=True,
        system_reason="expense_actual_set",
        note="System adjustment from direct expense actual update",
    )
    sync_period_state(finperiodid, db)
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
    _assert_not_closed(period)
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
    _assert_expense_not_paid(pe)
    build_expense_tx(
        finperiodid,
        period.budgetid,
        expensedesc,
        payload.amount,
        db,
        is_system=True,
        system_reason="expense_actual_add",
        note="System adjustment from direct expense actual addition",
    )
    sync_period_state(finperiodid, db)
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
    budget = db.get(Budget, period.budgetid)
    _assert_budget_editable(period, budget)

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
        status=WORKING,
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
                    status=WORKING,
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
    budget = db.get(Budget, period.budgetid)
    _assert_budget_editable(period, budget)

    it = db.get(IncomeType, (payload.budgetid, payload.incomedesc))
    if not it:
        raise HTTPException(404, "Income type not found")
    if payload.incomedesc == CARRIED_FORWARD_DESC:
        raise HTTPException(409, "Carried Forward is a system-managed income line")

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
    _assert_not_closed(period)

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

@router.get("/{finperiodid}/delete-options", response_model=PeriodDeleteOptionsOut)
def get_period_delete_options(finperiodid: int, db: Session = Depends(get_db)):
    period = _get_period_or_404(finperiodid, db)
    periods = ordered_budget_periods(period.budgetid, db)
    later_periods = [candidate for candidate in periods if candidate.startdate > period.startdate]
    single_delete_allowed = (
        cycle_status(period) != CLOSED
        and not later_periods
        and not has_cycle_actuals(finperiodid, db)
        and not has_cycle_transactions(finperiodid, db)
    )
    future_chain_allowed = (
        cycle_status(period) != CLOSED
        and all(
            not has_cycle_actuals(candidate.finperiodid, db) and not has_cycle_transactions(candidate.finperiodid, db)
            for candidate in [period, *later_periods]
        )
    )
    reason = None
    if cycle_status(period) == CLOSED:
        reason = "Closed cycles cannot be deleted."
    elif not future_chain_allowed:
        reason = "Cycles with actuals or transactions cannot be deleted."
    elif not single_delete_allowed:
        reason = "Delete this cycle and all upcoming cycles to preserve continuity."
    return PeriodDeleteOptionsOut(
        can_delete_single=single_delete_allowed,
        can_delete_future_chain=future_chain_allowed,
        future_chain_count=len(later_periods) + 1,
        delete_reason=reason,
        cycle_status=cycle_status(period),
    )


@router.delete("/{finperiodid}", status_code=204)
def delete_period(
    finperiodid: int,
    delete_mode: str = Query("single"),
    db: Session = Depends(get_db),
):
    period = _get_period_or_404(finperiodid, db)
    _assert_not_closed(period)
    options = get_period_delete_options(finperiodid, db)
    periods = ordered_budget_periods(period.budgetid, db)
    targets = [candidate for candidate in periods if candidate.startdate >= period.startdate] if delete_mode == "future_chain" else [period]

    if delete_mode == "single" and not options.can_delete_single:
        raise HTTPException(409, options.delete_reason or "This cycle cannot be deleted on its own.")
    if delete_mode == "future_chain" and not options.can_delete_future_chain:
        raise HTTPException(409, options.delete_reason or "This cycle chain cannot be deleted.")
    if delete_mode not in {"single", "future_chain"}:
        raise HTTPException(422, "delete_mode must be 'single' or 'future_chain'")

    for target in targets:
        db.delete(target)
    db.commit()
    assign_period_lifecycle_states(period.budgetid, db)
    recalculate_budget_chain(period.budgetid, db)
    db.commit()


# ── Update expense status (Current | Paid | Revised) ─────────────────────────

@router.patch("/{finperiodid}/expense/{expensedesc}/status", response_model=PeriodExpenseOut)
def set_expense_status(
    finperiodid: int,
    expensedesc: str,
    payload: PeriodExpenseStatusUpdate,
    db: Session = Depends(get_db),
):
    period = _get_period_or_404(finperiodid, db)
    _assert_not_closed(period)
    allowed = {WORKING, PAID, REVISED}
    if payload.status not in allowed:
        raise HTTPException(422, f"status must be one of {allowed}")
    if payload.status == REVISED and not (payload.revision_comment or '').strip():
        raise HTTPException(422, "revision_comment is required when revising a paid expense")
    pe = (
        db.query(PeriodExpense)
        .filter(PeriodExpense.finperiodid == finperiodid, PeriodExpense.expensedesc == expensedesc)
        .first()
    )
    if not pe:
        raise HTTPException(404, "Period expense not found")
    current_status = getattr(pe, 'status', WORKING) or WORKING
    if current_status != PAID and payload.status == REVISED:
        raise HTTPException(409, "Only paid expenses can be revised")
    if current_status == PAID and payload.status == WORKING:
        raise HTTPException(409, "Paid expenses must be revised before returning to Current")
    if current_status == REVISED and payload.status == WORKING:
        raise HTTPException(409, "Revised expenses must be marked Paid when edits are complete")
    pe.status = payload.status
    if payload.status == REVISED:
        pe.revision_comment = payload.revision_comment.strip()
    elif payload.status == PAID:
        pe.revision_comment = pe.revision_comment
    else:
        pe.revision_comment = None
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
    budget = db.get(Budget, period.budgetid)
    _assert_budget_editable(period, budget)
    pe = (
        db.query(PeriodExpense)
        .filter(PeriodExpense.finperiodid == finperiodid, PeriodExpense.expensedesc == expensedesc)
        .first()
    )
    if not pe:
        raise HTTPException(404, "Period expense not found")
    _assert_expense_not_paid(pe)
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
    period = _get_period_or_404(finperiodid, db)
    _assert_not_closed(period)
    pe = (
        db.query(PeriodExpense)
        .filter(PeriodExpense.finperiodid == finperiodid, PeriodExpense.expensedesc == expensedesc)
        .first()
    )
    if not pe:
        raise HTTPException(404, "Period expense not found")
    _assert_expense_not_paid(pe)
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
    budget = db.get(Budget, period.budgetid)
    _assert_budget_editable(period, budget)
    pi = db.get(PeriodIncome, (finperiodid, incomedesc))
    if not pi:
        raise HTTPException(404, "Period income entry not found")
    if pi.system_key == CARRIED_FORWARD_SYSTEM_KEY:
        raise HTTPException(409, "System-managed carried forward income cannot be removed")
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
    budget = db.get(Budget, period.budgetid)
    _assert_budget_editable(period, budget)
    pe = (
        db.query(PeriodExpense)
        .filter(PeriodExpense.finperiodid == finperiodid, PeriodExpense.expensedesc == expensedesc)
        .first()
    )
    if not pe:
        raise HTTPException(404, "Period expense not found")
    _assert_expense_not_paid(pe)
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
    budget = db.get(Budget, period.budgetid)
    _assert_budget_editable(period, budget)
    pi = db.get(PeriodInvestment, (finperiodid, investmentdesc))
    if not pi:
        raise HTTPException(404, "Period investment not found")
    _assert_investment_not_paid(pi)
    pi.budgeted_amount = payload.budgetamount
    db.commit()
    db.refresh(pi)
    return _enrich_investments([pi], db)[0]


@router.patch("/{finperiodid}/investment/{investmentdesc}/status", response_model=PeriodInvestmentOut)
def set_investment_status(
    finperiodid: int,
    investmentdesc: str,
    payload: PeriodInvestmentStatusUpdate,
    db: Session = Depends(get_db),
):
    period = _get_period_or_404(finperiodid, db)
    _assert_not_closed(period)
    allowed = {WORKING, PAID, REVISED}
    if payload.status not in allowed:
        raise HTTPException(422, f"status must be one of {allowed}")
    if payload.status == REVISED and not (payload.revision_comment or "").strip():
        raise HTTPException(422, "revision_comment is required when revising a paid investment")

    pi = db.get(PeriodInvestment, (finperiodid, investmentdesc))
    if not pi:
        raise HTTPException(404, "Period investment not found")

    current_status = getattr(pi, "status", WORKING) or WORKING
    if current_status != PAID and payload.status == REVISED:
        raise HTTPException(409, "Only paid investments can be revised")
    if current_status == PAID and payload.status == WORKING:
        raise HTTPException(409, "Paid investments must be revised before returning to Current")
    if current_status == REVISED and payload.status == WORKING:
        raise HTTPException(409, "Revised investments must be marked Paid when edits are complete")

    pi.status = payload.status
    if payload.status == REVISED:
        pi.revision_comment = payload.revision_comment.strip()
    elif payload.status == WORKING:
        pi.revision_comment = None

    db.commit()
    db.refresh(pi)
    return _enrich_investments([pi], db)[0]


@router.get("/{finperiodid}/closeout-preview", response_model=PeriodCloseoutPreviewOut)
def get_closeout_preview(finperiodid: int, db: Session = Depends(get_db)):
    period = _get_period_or_404(finperiodid, db)
    budget = db.get(Budget, period.budgetid)
    if cycle_status(period) != ACTIVE:
        raise HTTPException(409, "Only the active cycle can be closed")
    preview = build_closeout_preview(period, budget, db)
    return PeriodCloseoutPreviewOut(**preview)


@router.post("/{finperiodid}/closeout", response_model=PeriodDetailOut)
def close_out_period(
    finperiodid: int,
    payload: PeriodCloseoutRequest,
    db: Session = Depends(get_db),
):
    period = _get_period_or_404(finperiodid, db)
    budget = db.get(Budget, period.budgetid)
    if cycle_status(period) != ACTIVE:
        raise HTTPException(409, "Only the active cycle can be closed")
    try:
        close_cycle(period, budget, payload.comments, payload.goals, payload.create_next_cycle, db)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    db.commit()
    db.refresh(period)
    return get_period_detail(finperiodid, db)


# ── Reorder expenses in a period ──────────────────────────────────────────────

@router.patch("/{finperiodid}/expenses/reorder", status_code=204)
def reorder_period_expenses(
    finperiodid: int,
    payload: PeriodExpenseReorderRequest,
    db: Session = Depends(get_db),
):
    period = _get_period_or_404(finperiodid, db)
    budget = db.get(Budget, period.budgetid)
    _assert_budget_editable(period, budget)
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
