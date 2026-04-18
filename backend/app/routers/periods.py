from __future__ import annotations

from collections import defaultdict
import csv
from datetime import datetime, timedelta
from decimal import Decimal
import io
import json
from typing import Annotated
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy.orm import Session
from ..api_docs import DbSession, error_responses
from ..auto_expense import process_auto_expenses_for_period
from ..cycle_constants import (
    ACTIVE,
    CARRIED_FORWARD_DESC,
    CARRIED_FORWARD_SYSTEM_KEY,
    CLOSED,
    CURRENT_STAGE,
    PAID,
    PENDING_CLOSURE_STAGE,
    PLANNED,
    REVISED,
    WORKING,
)
from ..cycle_management import (
    assign_period_lifecycle_states,
    build_closeout_preview,
    close_cycle,
    cycle_stage,
    cycle_status,
    has_cycle_actuals,
    has_cycle_transactions,
    next_period_for,
    ordered_budget_periods,
    recalculate_budget_chain,
)
from ..models import (
    Budget, FinancialPeriod, IncomeType,
    ExpenseItem, PeriodIncome, PeriodExpense, BalanceType, PeriodBalance,
    InvestmentItem, PeriodInvestment, PeriodTransaction,
)
from ..schemas import (
    PeriodGenerateRequest, PeriodOut, PeriodDetailOut, PeriodSummaryOut,
    PeriodLockRequest, PeriodIncomeOut, PeriodExpenseOut,
    PeriodIncomeActualUpdate, PeriodExpenseActualUpdate,
    PeriodIncomeAddActual, PeriodExpenseAddActual,
    AddExpenseToPeriodRequest, AddIncomeToPeriodRequest,
    AccountTransferRequest,
    PeriodBalanceOut, PeriodExpenseReorderRequest, PeriodInvestmentOut,
    PeriodExpenseStatusUpdate, PeriodIncomeStatusUpdate, PeriodExpenseBudgetUpdate, PeriodLineBudgetAdjustRequest,
    PeriodCloseoutPreviewOut, PeriodCloseoutRequest, PeriodDeleteOptionsOut,
    PeriodInvestmentStatusUpdate, PeriodTransactionOut, PeriodExpensePayTypeUpdate,
    AutoExpenseRunResultOut,
)
from ..period_logic import calc_period_end, expense_occurs_in_period, normalize_budget_date, periods_overlap
from ..setup_assessment import budget_setup_assessment
from ..setup_history import next_supported_revisionnum
from ..time_utils import app_now_naive
from ..transaction_ledger import (
    PeriodTransactionContext,
    build_budget_adjustment_tx,
    build_expense_tx,
    build_income_tx,
    build_status_change_tx,
    compute_dynamic_period_balances,
    get_primary_account_desc,
    sync_period_state,
    validate_transfer_against_source_account,
)
from .expense_items import update_expense_item as update_expense_item_setup

router = APIRouter(prefix="/budgets/{budgetid}/periods", tags=["periods"])


def _get_period_or_404(finperiodid: int, budgetid: int, db: Session) -> FinancialPeriod:
    p = db.get(FinancialPeriod, finperiodid)
    if not p:
        raise HTTPException(404, "Period not found")
    if p.budgetid != budgetid:
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


def _get_period_expense_or_404(finperiodid: int, expensedesc: str, db: Session) -> PeriodExpense:
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
    return pe


def _assert_investment_not_paid(pi: PeriodInvestment) -> None:
    if (getattr(pi, "status", WORKING) or WORKING) == PAID:
        raise HTTPException(423, "Investment is marked Paid — revise it before making changes")


def _assert_primary_account_configured(budgetid: int, db: Session, *, action: str) -> None:
    assessment = budget_setup_assessment(budgetid, db)
    if assessment and assessment["can_generate"] and get_primary_account_desc(budgetid, db):
        return
    raise HTTPException(422, f"Set one account as the primary account before {action}.")


def _future_unlocked_periods(period: FinancialPeriod, db: Session) -> list[FinancialPeriod]:
    return (
        db.query(FinancialPeriod)
        .filter(
            FinancialPeriod.budgetid == period.budgetid,
            FinancialPeriod.startdate > period.startdate,
            FinancialPeriod.finperiodid != period.finperiodid,
            FinancialPeriod.islocked == False,  # noqa: E712
            FinancialPeriod.cycle_status != CLOSED,
        )
        .order_by(FinancialPeriod.startdate)
        .all()
    )


def _record_budget_adjustment(
    *,
    finperiodid: int,
    budgetid: int,
    source: str,
    source_key: str,
    note: str,
    scope: str,
    before_amount: Decimal,
    after_amount: Decimal,
    line_status: str | None,
    revisionnum: int | None,
    db: Session,
):
    if before_amount == after_amount:
        return None
    return build_budget_adjustment_tx(
        db,
        PeriodTransactionContext(
            finperiodid=finperiodid,
            budgetid=budgetid,
            source=source,
            tx_type="BUDGETADJ",
            source_key=source_key,
            budget_scope=scope,
            line_status=line_status,
            revisionnum=revisionnum,
        ),
        note=note,
        budget_before_amount=before_amount,
        budget_after_amount=after_amount,
    )


def _expense_budget_for_period(item: ExpenseItem, period: FinancialPeriod, fallback_amount: Decimal) -> Decimal:
    if item.freqtype == "Always":
        return Decimal(str(item.expenseamount))
    if item.freqtype and item.frequency_value and item.effectivedate:
        budgeted = expense_occurs_in_period(
            freqtype=item.freqtype,
            frequency_value=item.frequency_value,
            effectivedate=item.effectivedate,
            period_start=period.startdate,
            period_end=period.enddate,
            expense_amount=Decimal(str(item.expenseamount)),
        )
        return Decimal(str(budgeted or 0))
    return Decimal(str(fallback_amount))


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
    """Attach linked_account_desc, source_account_desc and compute remaining_amount."""
    from ..models import InvestmentItem as InvItem
    out = []
    for pi in investments:
        ii = db.get(InvItem, (pi.budgetid, pi.investmentdesc))
        d = PeriodInvestmentOut.model_validate(pi)
        if ii:
            d.linked_account_desc = ii.linked_account_desc
            d.source_account_desc = ii.source_account_desc
        d.status = getattr(pi, "status", WORKING) or WORKING
        if d.status == PAID:
            d.remaining_amount = Decimal("0")
        else:
            d.remaining_amount = Decimal(str(pi.budgeted_amount)) - Decimal(str(pi.actualamount))
        out.append(d)
    return out


def _enrich_incomes(incomes: list, db) -> list[PeriodIncomeOut]:
    """Attach linked_account from IncomeType."""
    from ..models import IncomeType
    out = []
    for pi in incomes:
        it = db.get(IncomeType, (pi.budgetid, pi.incomedesc))
        d = PeriodIncomeOut.model_validate(pi)
        if it:
            d.linked_account = it.linked_account
        out.append(d)
    return out


def _period_status(period: FinancialPeriod) -> str:
    stage = cycle_stage(period)
    if stage == CURRENT_STAGE:
        return "Current"
    if stage == PENDING_CLOSURE_STAGE:
        return "Pending Closure"
    if stage == PLANNED:
        return "Planned"
    return "Closed"


def _projected_investment_for_period(
    period_status: str,
    investments: list[PeriodInvestmentOut],
    period_balances: list[PeriodBalanceOut],
) -> Decimal:
    """Compute projected investment based on linked account balances + budgeted amounts."""
    balance_by_account = {pb.balancedesc: pb for pb in period_balances}
    total = Decimal("0.00")
    for inv in investments:
        linked_account = getattr(inv, "linked_account_desc", None)
        if period_status in {"Closed", "Pending Closure"}:
            # For closed or pending-closure periods, use the linked account's closing balance
            if linked_account and linked_account in balance_by_account:
                total += Decimal(str(balance_by_account[linked_account].closing_amount or 0))
            else:
                total += Decimal(str(inv.closing_value or 0))
        else:
            # For current/planned: linked account opening + budgeted amount
            if linked_account and linked_account in balance_by_account:
                total += Decimal(str(balance_by_account[linked_account].opening_amount or 0)) + Decimal(str(inv.budgeted_amount or 0))
            else:
                total += Decimal(str(inv.opening_value or 0)) + Decimal(str(inv.budgeted_amount or 0))
    return total


def _effective_expense_budget(expense: PeriodExpenseOut) -> Decimal:
    if (getattr(expense, "status", WORKING) or WORKING) == PAID:
        return Decimal(str(expense.actualamount or 0))
    return Decimal(str(expense.budgetamount or 0))


def _effective_investment_budget(investment: PeriodInvestmentOut) -> Decimal:
    if (getattr(investment, "status", WORKING) or WORKING) == PAID:
        return Decimal(str(investment.actualamount or 0))
    return Decimal(str(investment.budgeted_amount or 0))


def _surplus_contribution_for_income(income: PeriodIncome) -> Decimal:
    """Income surplus contribution: actual if non-zero, else budget."""
    actual = Decimal(str(income.actualamount or 0))
    if actual != Decimal("0.00"):
        return actual
    return Decimal(str(income.budgetamount or 0))


def _surplus_contribution_for_expense(expense: PeriodExpense) -> Decimal:
    """Expense surplus contribution: actual + positive remaining."""
    actual = Decimal(str(expense.actualamount or 0))
    status = getattr(expense, "status", WORKING) or WORKING
    if status == PAID:
        return actual
    budget = Decimal(str(expense.budgetamount or 0))
    remaining = budget - actual
    if remaining > Decimal("0.00"):
        return actual + remaining
    return actual


def _surplus_contribution_for_investment(investment: PeriodInvestment) -> Decimal:
    """Investment surplus contribution: actual + positive remaining."""
    actual = Decimal(str(investment.actualamount or 0))
    status = getattr(investment, "status", WORKING) or WORKING
    if status == PAID:
        return actual
    budget = Decimal(str(investment.budgeted_amount or 0))
    remaining = budget - actual
    if remaining > Decimal("0.00"):
        return actual + remaining
    return actual


def _serialize_export_value(value):
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [_serialize_export_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _serialize_export_value(item) for key, item in value.items()}
    return value


def _stringify_csv_value(value) -> str:
    if value is None:
        return ""
    if isinstance(value, Decimal):
        return f"{value:.2f}"
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _export_filename(period: FinancialPeriod, export_format: str) -> str:
    start = period.startdate.strftime("%Y-%m-%d")
    end = period.enddate.strftime("%Y-%m-%d")
    return f"dosh-budget-cycle-{start}_to_{end}.{export_format}"


def _load_period_detail_components(period: FinancialPeriod, db: Session) -> dict:
    finperiodid = period.finperiodid
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
    balances_limit_exceeded = False
    if cycle_status(period) != CLOSED:
        budget = db.get(Budget, period.budgetid)
        max_cycles = budget.max_forward_balance_cycles if budget else 10
        dynamic_balances = compute_dynamic_period_balances(finperiodid, db, max_forward_cycles=max_cycles)
        if dynamic_balances is not None:
            enriched_balances = dynamic_balances
        else:
            enriched_balances = []
            balances_limit_exceeded = True
    else:
        balance_rows = db.query(PeriodBalance).filter(PeriodBalance.finperiodid == finperiodid).all()
        enriched_balances = []
        for pb in balance_rows:
            bt = db.get(BalanceType, (pb.budgetid, pb.balancedesc))
            balance = PeriodBalanceOut.model_validate(pb)
            balance.balance_type = bt.balance_type if bt else None
            enriched_balances.append(balance)

    income_out = _enrich_incomes(incomes, db)
    expense_out = _enrich_expenses(expenses, db)
    investment_out = _enrich_investments(investments, db)
    period_status = _period_status(period)

    return {
        "incomes": income_out,
        "expenses": expense_out,
        "investments": investment_out,
        "balances": enriched_balances,
        "balances_limit_exceeded": balances_limit_exceeded,
        "projected_investment": _projected_investment_for_period(period_status, investment_out, enriched_balances),
    }


def _income_export_base_row(income: PeriodIncomeOut) -> dict:
    return {
        "line_type": "income",
        "line_name": income.incomedesc,
        "row_kind": "budget_only",
        "line_status": None,
        "line_budget_amount": Decimal(str(income.budgetamount or 0)),
        "line_actual_amount": Decimal(str(income.actualamount or 0)),
        "line_remaining_amount": None,
        "transaction_id": None,
        "transaction_date": None,
        "transaction_type": None,
        "transaction_amount": None,
        "transaction_note": None,
        "transaction_account": None,
        "related_account": None,
        "linked_income_desc": None,
        "budget_before_amount": None,
        "budget_after_amount": None,
    }


def _expense_export_base_row(expense: PeriodExpenseOut) -> dict:
    return {
        "line_type": "expense",
        "line_name": expense.expensedesc,
        "row_kind": "budget_only",
        "line_status": expense.status,
        "line_budget_amount": _effective_expense_budget(expense),
        "line_actual_amount": Decimal(str(expense.actualamount or 0)),
        "line_remaining_amount": Decimal(str(expense.remaining_amount or 0)),
        "transaction_id": None,
        "transaction_date": None,
        "transaction_type": None,
        "transaction_amount": None,
        "transaction_note": None,
        "transaction_account": None,
        "related_account": None,
        "linked_income_desc": None,
        "budget_before_amount": None,
        "budget_after_amount": None,
    }


def _investment_export_base_row(investment: PeriodInvestmentOut) -> dict:
    return {
        "line_type": "investment",
        "line_name": investment.investmentdesc,
        "row_kind": "budget_only",
        "line_status": investment.status,
        "line_budget_amount": _effective_investment_budget(investment),
        "line_actual_amount": Decimal(str(investment.actualamount or 0)),
        "line_remaining_amount": Decimal(str(investment.remaining_amount or 0)),
        "transaction_id": None,
        "transaction_date": None,
        "transaction_type": None,
        "transaction_amount": None,
        "transaction_note": None,
        "transaction_account": None,
        "related_account": None,
        "linked_income_desc": None,
        "budget_before_amount": None,
        "budget_after_amount": None,
    }


def _export_row_from_transaction(base_row: dict, tx: PeriodTransactionOut) -> dict:
    row = dict(base_row)
    row["row_kind"] = "budget_adjustment" if tx.entry_kind == "budget_adjustment" else "transaction"
    row["transaction_id"] = tx.id
    row["transaction_date"] = tx.entrydate
    row["transaction_type"] = tx.type
    row["transaction_amount"] = Decimal(str(tx.amount or 0))
    row["transaction_note"] = tx.note
    row["transaction_account"] = tx.affected_account_desc
    row["related_account"] = tx.related_account_desc
    row["linked_income_desc"] = tx.linked_incomedesc
    row["budget_before_amount"] = tx.budget_before_amount
    row["budget_after_amount"] = tx.budget_after_amount
    return row


def _build_period_export_rows(
    incomes: list[PeriodIncomeOut],
    expenses: list[PeriodExpenseOut],
    investments: list[PeriodInvestmentOut],
    transactions: list[PeriodTransactionOut],
) -> list[dict]:
    txs_by_line: dict[tuple[str, str], list[PeriodTransactionOut]] = defaultdict(list)
    for tx in transactions:
        if tx.source in {"income", "transfer"} and tx.source_key:
            txs_by_line[("income", tx.source_key)].append(tx)
        elif tx.source == "expense" and tx.source_key:
            txs_by_line[("expense", tx.source_key)].append(tx)
        elif tx.source == "investment" and tx.source_key:
            txs_by_line[("investment", tx.source_key)].append(tx)

    rows: list[dict] = []
    for income in incomes:
        base_row = _income_export_base_row(income)
        matched = txs_by_line.get(("income", income.incomedesc), [])
        rows.extend(_export_row_from_transaction(base_row, tx) for tx in matched) if matched else rows.append(base_row)

    for expense in expenses:
        base_row = _expense_export_base_row(expense)
        matched = txs_by_line.get(("expense", expense.expensedesc), [])
        rows.extend(_export_row_from_transaction(base_row, tx) for tx in matched) if matched else rows.append(base_row)

    for investment in investments:
        base_row = _investment_export_base_row(investment)
        matched = txs_by_line.get(("investment", investment.investmentdesc), [])
        rows.extend(_export_row_from_transaction(base_row, tx) for tx in matched) if matched else rows.append(base_row)

    def sort_key(row: dict):
        transaction_date = row.get("transaction_date")
        return (
            transaction_date is not None,
            transaction_date or datetime.min,
            row.get("line_type") or "",
            row.get("line_name") or "",
            row.get("transaction_id") or 0,
        )

    return sorted(rows, key=sort_key)


def _build_period_export_payload(period: FinancialPeriod, budget: Budget | None, db: Session) -> dict:
    detail = _load_period_detail_components(period, db)
    transactions = (
        db.query(PeriodTransaction)
        .filter(PeriodTransaction.finperiodid == period.finperiodid)
        .order_by(PeriodTransaction.entrydate, PeriodTransaction.id)
        .all()
    )
    transaction_out = [PeriodTransactionOut.model_validate(tx) for tx in transactions]
    export_rows = _build_period_export_rows(
        detail["incomes"],
        detail["expenses"],
        detail["investments"],
        transaction_out,
    )
    return {
        "period": PeriodOut.model_validate(period).model_dump(mode="json"),
        "budget": (
            {
                "budgetid": budget.budgetid,
                "description": budget.description,
                "budgetowner": budget.budgetowner,
                "budget_frequency": budget.budget_frequency,
            }
            if budget else None
        ),
        "incomes": [item.model_dump(mode="json") for item in detail["incomes"]],
        "expenses": [item.model_dump(mode="json") for item in detail["expenses"]],
        "investments": [item.model_dump(mode="json") for item in detail["investments"]],
        "transactions": _serialize_export_value(export_rows),
    }


def _build_period_export_csv(rows: list[dict]) -> str:
    fieldnames = [
        "line_type",
        "line_name",
        "row_kind",
        "line_status",
        "line_budget_amount",
        "line_actual_amount",
        "line_remaining_amount",
        "transaction_id",
        "transaction_date",
        "transaction_type",
        "transaction_amount",
        "transaction_note",
        "transaction_account",
        "related_account",
        "linked_income_desc",
        "budget_before_amount",
        "budget_after_amount",
    ]
    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow({key: _stringify_csv_value(row.get(key)) for key in fieldnames})
    return output.getvalue()


def _pick_auto_surplus_investment(investment_items: list[InvestmentItem]) -> Optional[InvestmentItem]:
    for item in investment_items:
        if item.active and item.is_primary:
            return item
    return None


def _normalize_period_datetime(value: datetime, budget_timezone: str) -> datetime:
    return normalize_budget_date(value, budget_timezone)


# ── Generate ──────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=PeriodOut, status_code=201, responses=error_responses(404, 409, 422))
def generate_period(budgetid: int, payload: PeriodGenerateRequest, db: DbSession):
    budget: Budget | None = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    # Validate once
    income_count = db.query(IncomeType).filter(IncomeType.budgetid == budgetid).count()
    if income_count == 0:
        raise HTTPException(422, "Budget must have at least one income source before generating a period")

    expense_count = db.query(ExpenseItem).filter(
        ExpenseItem.budgetid == budgetid,
        ExpenseItem.active == True,  # noqa: E712
    ).count()
    if expense_count == 0:
        raise HTTPException(422, "Budget must have at least one active expense item before generating a period")
    _assert_primary_account_configured(budgetid, db, action="generating budget cycles")

    # Load items once for all iterations
    income_types = db.query(IncomeType).filter(
        IncomeType.budgetid == budgetid,
        IncomeType.autoinclude == True,  # noqa: E712
    ).all()
    expense_items = db.query(ExpenseItem).filter(
        ExpenseItem.budgetid == budgetid,
        ExpenseItem.active == True,  # noqa: E712
    ).all()
    balance_types = db.query(BalanceType).filter(
        BalanceType.budgetid == budgetid,
        BalanceType.active == True,  # noqa: E712
    ).all()
    investment_items = db.query(InvestmentItem).filter(
        InvestmentItem.budgetid == budgetid,
        InvestmentItem.active == True,  # noqa: E712
    ).all()
    auto_surplus_target = _pick_auto_surplus_investment(investment_items) if budget.auto_add_surplus_to_investment else None

    current_start = _normalize_period_datetime(payload.startdate, budget.timezone)
    last_period = None

    for _i in range(max(1, payload.count)):
        current_end = calc_period_end(current_start, budget.budget_frequency, budget.timezone)

        # Overlap check against all existing periods (including flushed ones from prior iterations)
        existing = db.query(FinancialPeriod).filter(
            FinancialPeriod.budgetid == budgetid
        ).all()
        for ep in existing:
            if periods_overlap(current_start, current_end, ep.startdate, ep.enddate):
                raise HTTPException(
                    409,
                    f"Period overlaps with existing period "
                    f"{ep.startdate.date()} – {ep.enddate.date()} (id={ep.finperiodid})",
                )

        period = FinancialPeriod(
            budgetid=budgetid,
            startdate=current_start,
            enddate=current_end,
            budgetowner=budget.budgetowner,
            islocked=False,
            cycle_status=PLANNED,
        )
        db.add(period)
        db.flush()

        # Populate income rows for auto-included income sources
        for it in income_types:
            budget_amount = Decimal(str(it.amount))
            db.add(PeriodIncome(
                finperiodid=period.finperiodid,
                budgetid=budgetid,
                incomedesc=it.incomedesc,
                budgetamount=budget_amount,
                actualamount=Decimal("0.00"),
                varianceamount=Decimal("0.00"),
                revision_snapshot=it.revisionnum,
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
                    budgetid=budgetid,
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
                FinancialPeriod.budgetid == budgetid,
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
                budgetid=budgetid,
                balancedesc=bt.balancedesc,
                opening_amount=opening,
                closing_amount=opening,
            ))

        projected_period_surplus = sum((Decimal(str(it.amount)) for it in income_types), Decimal("0.00")) - projected_expense_budget
        auto_surplus_amount = projected_period_surplus if projected_period_surplus > Decimal("0.00") else Decimal("0.00")

        # Populate investment rows
        for ii in investment_items:
            if prev_period:
                prev_pi = db.get(PeriodInvestment, (prev_period.finperiodid, ii.investmentdesc))
                opening = Decimal(str(prev_pi.closing_value)) if prev_pi else Decimal(str(ii.initial_value))
            else:
                opening = Decimal(str(ii.initial_value))
            budgeted_amount = Decimal("0.00")
            if Decimal(str(ii.planned_amount or 0)) != Decimal("0.00"):
                budgeted_amount = Decimal(str(ii.planned_amount))
            elif auto_surplus_target and ii.investmentdesc == auto_surplus_target.investmentdesc:
                budgeted_amount = auto_surplus_amount
            db.add(PeriodInvestment(
                finperiodid=period.finperiodid,
                budgetid=budgetid,
                investmentdesc=ii.investmentdesc,
                opening_value=opening,
                closing_value=opening,
                budgeted_amount=budgeted_amount,
                actualamount=Decimal("0.00"),
                revision_snapshot=ii.revisionnum,
                status=WORKING,
            ))

        last_period = period
        current_start = current_end + timedelta(days=1)

    db.commit()
    assign_period_lifecycle_states(budgetid, db)
    recalculate_budget_chain(budgetid, db)
    db.commit()
    db.refresh(last_period)
    return last_period


# ── List / Get ────────────────────────────────────────────────────────────────

@router.get("", response_model=list[PeriodOut], responses=error_responses(404))
def list_periods_for_budget(budgetid: int, db: DbSession):
    if not db.get(Budget, budgetid):
        raise HTTPException(404, "Budget not found")
    return (
        db.query(FinancialPeriod)
        .filter(FinancialPeriod.budgetid == budgetid)
        .order_by(FinancialPeriod.startdate)
        .all()
    )


@router.get("/summary", response_model=list[PeriodSummaryOut], responses=error_responses(404))
def list_period_summaries_for_budget(budgetid: int, db: DbSession):
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

    summaries: list[PeriodSummaryOut] = []

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

        period_status = _period_status(period)
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
        if single_delete_allowed:
            delete_mode = "single"
        elif future_chain_allowed:
            delete_mode = "future_chain"
        else:
            delete_mode = None
        delete_reason = None
        if not can_delete:
            delete_reason = "Cycles with actuals, transactions, or closed history cannot be deleted."
        elif delete_mode == "future_chain":
            delete_reason = "Deleting this cycle requires deleting it and all upcoming cycles to preserve continuity."

        # Compute projected investment from dynamically computed linked account balances
        budget = db.get(Budget, period.budgetid)
        max_cycles = budget.max_forward_balance_cycles if budget else 10
        dynamic_balances = compute_dynamic_period_balances(period.finperiodid, db, max_forward_cycles=max_cycles)
        if dynamic_balances is not None:
            balance_out = dynamic_balances
        else:
            balance_out = []
        enriched_investments = _enrich_investments(investments, db)
        projected_investment = _projected_investment_for_period(period_status, enriched_investments, balance_out)

        # Compute surplus contributions using the same logic as the frontend detail page
        income_surplus_contrib = sum((_surplus_contribution_for_income(row) for row in incomes), Decimal("0.00"))
        expense_surplus_contrib = sum((_surplus_contribution_for_expense(row) for row in expenses), Decimal("0.00"))
        investment_surplus_contrib = sum((_surplus_contribution_for_investment(row) for row in investments), Decimal("0.00"))

        summaries.append(PeriodSummaryOut(
            period=PeriodOut.model_validate(period),
            period_status=period_status,
            income_budget=income_budget,
            income_actual=income_actual,
            expense_budget=expense_budget,
            expense_actual=expense_actual,
            investment_budget=investment_budget,
            investment_actual=investment_actual,
            surplus_budget=income_surplus_contrib - expense_surplus_contrib - investment_surplus_contrib,
            surplus_actual=income_actual - expense_actual - investment_actual,
            projected_investment=projected_investment,
            can_delete=can_delete,
            delete_mode=delete_mode,
            delete_reason=delete_reason,
        ))

    return summaries


@router.get("/{finperiodid}", response_model=PeriodDetailOut, responses=error_responses(404))
def get_period_detail(budgetid: int, finperiodid: int, db: DbSession):
    period = _get_period_or_404(finperiodid, budgetid, db)
    detail = _load_period_detail_components(period, db)

    return PeriodDetailOut(
        period=PeriodOut.model_validate(period),
        incomes=detail["incomes"],
        expenses=detail["expenses"],
        investments=detail["investments"],
        balances=detail["balances"],
        balances_limit_exceeded=detail.get("balances_limit_exceeded", False),
        projected_investment=detail["projected_investment"],
        closeout_snapshot=period.closeout_snapshot,
    )


@router.get("/{finperiodid}/export", responses=error_responses(404, 422))
def export_period(budgetid: int, finperiodid: int, export_format: Annotated[str, Query(alias="format")], db: DbSession):
    period = _get_period_or_404(finperiodid, budgetid, db)
    budget = db.get(Budget, period.budgetid)
    if export_format not in {"csv", "json"}:
        raise HTTPException(422, "format must be 'csv' or 'json'")

    payload = _build_period_export_payload(period, budget, db)
    filename = _export_filename(period, export_format)

    if export_format == "csv":
        content = _build_period_export_csv(payload["transactions"])
        return Response(
            content=content,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    content = json.dumps(_serialize_export_value(payload), indent=2)
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Lock / Unlock ─────────────────────────────────────────────────────────────

@router.patch("/{finperiodid}/lock", response_model=PeriodOut, responses=error_responses(404, 409, 423))
def set_period_lock(budgetid: int, finperiodid: int, payload: PeriodLockRequest, db: DbSession):
    period = _get_period_or_404(finperiodid, budgetid, db)
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

@router.patch("/{finperiodid}/income/{incomedesc}", response_model=PeriodIncomeOut, responses=error_responses(404, 423))
def update_income_actual(budgetid: int, 
    finperiodid: int,
    incomedesc: str,
    payload: PeriodIncomeActualUpdate,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
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

@router.post("/{finperiodid}/income/{incomedesc}/add", response_model=PeriodIncomeOut, responses=error_responses(404, 423))
def add_income_actual(budgetid: int, 
    finperiodid: int,
    incomedesc: str,
    payload: PeriodIncomeAddActual,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
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

@router.patch("/{finperiodid}/expense/{expensedesc}", response_model=PeriodExpenseOut, responses=error_responses(404, 422, 423))
def update_expense_actual(budgetid: int, 
    finperiodid: int,
    expensedesc: str,
    payload: PeriodExpenseActualUpdate,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
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
    _assert_primary_account_configured(period.budgetid, db, action="recording expense activity")
    old_actual = Decimal(str(pe.actualamount or 0))
    delta = payload.actualamount - old_actual
    expense_item = db.get(ExpenseItem, (period.budgetid, expensedesc))
    account_desc = expense_item.default_account_desc if expense_item else None
    build_expense_tx(
        finperiodid,
        period.budgetid,
        expensedesc,
        delta,
        db,
        is_system=True,
        system_reason="expense_actual_set",
        note="System adjustment from direct expense actual update",
        account_desc=account_desc,
    )
    sync_period_state(finperiodid, db)
    db.commit()
    db.refresh(pe)
    return _enrich_expenses([pe], db)[0]


# ── Add to actual expense (additive) ─────────────────────────────────────────

@router.post("/{finperiodid}/expense/{expensedesc}/add", response_model=PeriodExpenseOut, responses=error_responses(404, 422, 423))
def add_expense_actual(budgetid: int, 
    finperiodid: int,
    expensedesc: str,
    payload: PeriodExpenseAddActual,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
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
    _assert_primary_account_configured(period.budgetid, db, action="recording expense activity")
    expense_item = db.get(ExpenseItem, (period.budgetid, expensedesc))
    account_desc = expense_item.default_account_desc if expense_item else None
    build_expense_tx(
        finperiodid,
        period.budgetid,
        expensedesc,
        payload.amount,
        db,
        is_system=True,
        system_reason="expense_actual_add",
        note="System adjustment from direct expense actual addition",
        account_desc=account_desc,
    )
    sync_period_state(finperiodid, db)
    db.commit()
    db.refresh(pe)
    return _enrich_expenses([pe], db)[0]


# ── Add expense to period ─────────────────────────────────────────────────────

@router.post("/{finperiodid}/add-expense", response_model=PeriodExpenseOut, status_code=201, responses=error_responses(404, 409, 423))
def add_expense_to_period(budgetid: int, 
    finperiodid: int,
    payload: AddExpenseToPeriodRequest,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
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
        revision_snapshot=ei.revisionnum,
    )
    db.add(pe)

    if not is_oneoff:
        ei.active = True
        future_periods = (
            db.query(FinancialPeriod)
            .filter(
                FinancialPeriod.budgetid == payload.budgetid,
                FinancialPeriod.startdate > period.startdate,
                FinancialPeriod.finperiodid != period.finperiodid,
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
                    )
                    if budgeted is None:
                        continue
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
                    revision_snapshot=ei.revisionnum,
                    status=WORKING,
                ))

    if payload.note:
        _record_budget_adjustment(
            finperiodid=finperiodid,
            budgetid=payload.budgetid,
            source="expense",
            source_key=payload.expensedesc,
            note=payload.note.strip(),
            scope="future" if payload.scope == "future" else "current",
            before_amount=Decimal("0.00"),
            after_amount=Decimal(str(payload.budgetamount)),
            line_status=WORKING,
            revisionnum=ei.revisionnum if payload.scope == "future" else None,
            db=db,
        )

    db.commit()
    db.refresh(pe)
    return _enrich_expenses([pe], db)[0]


# ── Add income to period ──────────────────────────────────────────────────────

@router.post("/{finperiodid}/add-income", response_model=PeriodIncomeOut, status_code=201, responses=error_responses(404, 409, 423))
def add_income_to_period(budgetid: int, 
    finperiodid: int,
    payload: AddIncomeToPeriodRequest,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
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
        revision_snapshot=it.revisionnum,
    )
    db.add(pi)

    if not is_oneoff:
        it.autoinclude = True
        it.amount = payload.budgetamount
        it.revisionnum = next_supported_revisionnum(
            db,
            budgetid=payload.budgetid,
            category="income",
            item_desc=it.incomedesc,
        )
        future_periods = (
            db.query(FinancialPeriod)
            .filter(
                FinancialPeriod.budgetid == payload.budgetid,
                FinancialPeriod.startdate > period.startdate,
                FinancialPeriod.finperiodid != period.finperiodid,
                FinancialPeriod.islocked == False,  # noqa: E712
            )
            .all()
        )
        for fp in future_periods:
            already = db.get(PeriodIncome, (fp.finperiodid, payload.incomedesc))
            if already:
                already.budgetamount = Decimal(str(it.amount))
                already.revision_snapshot = it.revisionnum
                continue

            db.add(PeriodIncome(
                finperiodid=fp.finperiodid,
                budgetid=payload.budgetid,
                incomedesc=payload.incomedesc,
                budgetamount=Decimal(str(it.amount)),
                actualamount=Decimal("0.00"),
                varianceamount=Decimal("0.00"),
                revision_snapshot=it.revisionnum,
            ))

    if payload.note:
        _record_budget_adjustment(
            finperiodid=finperiodid,
            budgetid=payload.budgetid,
            source="income",
            source_key=payload.incomedesc,
            note=payload.note.strip(),
            scope="future" if payload.scope == "future" else "current",
            before_amount=Decimal("0.00"),
            after_amount=Decimal(str(payload.budgetamount)),
            line_status=None,
            revisionnum=it.revisionnum if not is_oneoff else None,
            db=db,
        )

    db.commit()
    db.refresh(pi)
    return pi


# ── Savings transfer ──────────────────────────────────────────────────────────

@router.post("/{finperiodid}/account-transfer", response_model=PeriodIncomeOut, status_code=201, responses=error_responses(404, 409, 422, 423))
def account_transfer(
    budgetid: int,
    finperiodid: int,
    payload: AccountTransferRequest,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
    _assert_not_closed(period)

    if payload.source_account == payload.destination_account:
        raise HTTPException(422, "Source and destination account cannot be the same")

    source_bt = db.get(BalanceType, (payload.budgetid, payload.source_account))
    if not source_bt:
        raise HTTPException(404, "Source account not found")
    if not source_bt.active:
        raise HTTPException(422, "Source account is not active")

    dest_bt = db.get(BalanceType, (payload.budgetid, payload.destination_account))
    if not dest_bt:
        raise HTTPException(404, "Destination account not found")
    if not dest_bt.active:
        raise HTTPException(422, "Destination account is not active")

    incomedesc = f"Transfer: {payload.source_account} to {payload.destination_account}"
    existing = db.get(PeriodIncome, (finperiodid, incomedesc))
    if existing:
        raise HTTPException(409, "A transfer between these accounts already exists in this period")

    # Validate source account can absorb the requested transfer amount
    validate_transfer_against_source_account(
        finperiodid,
        payload.budgetid,
        payload.source_account,
        payload.amount,
        db,
    )

    pi = PeriodIncome(
        finperiodid=finperiodid,
        budgetid=payload.budgetid,
        incomedesc=incomedesc,
        budgetamount=payload.amount,
        actualamount=Decimal("0.00"),
        varianceamount=-payload.amount,
        revision_snapshot=0,
    )
    db.add(pi)

    db.commit()
    db.refresh(pi)
    return pi


# ── Delete period ─────────────────────────────────────────────────────────────

@router.get("/{finperiodid}/delete-options", response_model=PeriodDeleteOptionsOut, responses=error_responses(404))
def get_period_delete_options(budgetid: int, finperiodid: int, db: DbSession):
    period = _get_period_or_404(finperiodid, budgetid, db)
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
        cycle_stage=cycle_stage(period),
    )


@router.delete("/{finperiodid}", status_code=204, responses=error_responses(404, 409, 422, 423))
def delete_period(budgetid: int, 
    finperiodid: int,
    db: DbSession,
    delete_mode: Annotated[str, Query()] = "single",
):
    period = _get_period_or_404(finperiodid, budgetid, db)
    _assert_not_closed(period)
    options = get_period_delete_options(budgetid, finperiodid, db)
    periods = ordered_budget_periods(period.budgetid, db)
    if delete_mode == "future_chain":
        targets = [candidate for candidate in periods if candidate.startdate >= period.startdate]
    else:
        targets = [period]

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

@router.patch("/{finperiodid}/expense/{expensedesc}/status", response_model=PeriodExpenseOut, responses=error_responses(404, 409, 422, 423))
def set_expense_status(budgetid: int, 
    finperiodid: int,
    expensedesc: str,
    payload: PeriodExpenseStatusUpdate,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
    _assert_not_closed(period)
    allowed = {WORKING, PAID, REVISED}
    if payload.status not in allowed:
        raise HTTPException(422, f"status must be one of {allowed}")
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
        pe.revision_comment = (payload.revision_comment or "").strip() or None
    else:
        pe.revision_comment = None

    # Conditionally create status change history record
    budget = db.get(Budget, period.budgetid)
    if budget and budget.record_line_status_changes:
        build_status_change_tx(
            db,
            finperiodid=finperiodid,
            budgetid=period.budgetid,
            source="expense",
            source_key=expensedesc,
            old_status=current_status,
            new_status=payload.status,
            note=payload.revision_comment if payload.status == REVISED else None,
            line_status=pe.revision_comment if payload.status == REVISED else None,
        )

    db.commit()
    db.refresh(pe)
    return _enrich_expenses([pe], db)[0]


@router.patch("/{finperiodid}/expense/{expensedesc}/paytype", response_model=PeriodExpenseOut, responses=error_responses(404, 422, 423))
def update_period_expense_paytype(budgetid: int, 
    finperiodid: int,
    expensedesc: str,
    payload: PeriodExpensePayTypeUpdate,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
    _assert_not_closed(period)
    pe = _get_period_expense_or_404(finperiodid, expensedesc, db)
    _assert_expense_not_paid(pe)
    item = db.get(ExpenseItem, (period.budgetid, expensedesc))
    if not item:
        raise HTTPException(404, "Expense item not found")
    update_expense_item_setup(
        budgetid=period.budgetid,
        expensedesc=expensedesc,
        payload=payload,
        db=db,
    )
    db.refresh(pe)
    return _enrich_expenses([pe], db)[0]


@router.post("/{finperiodid}/run-auto-expenses", response_model=AutoExpenseRunResultOut, responses=error_responses(404, 422))
def run_auto_expenses_for_period(budgetid: int, finperiodid: int, db: DbSession):
    period = _get_period_or_404(finperiodid, budgetid, db)
    result = process_auto_expenses_for_period(finperiodid, db)
    if result.skipped_reasons and result.created_count == 0 and result.skipped_reasons[0] == "Auto Expense is disabled for this budget":
        raise HTTPException(422, "Auto Expense is disabled for this budget.")
    db.commit()
    assign_period_lifecycle_states(period.budgetid, db)
    db.commit()
    return AutoExpenseRunResultOut(
        created_count=result.created_count,
        skipped_count=result.skipped_count,
        skipped_reasons=result.skipped_reasons,
    )


# ── Edit budget amount for period lines ──────────────────────────────────────

@router.patch("/{finperiodid}/income/{incomedesc}/budget", response_model=PeriodIncomeOut, responses=error_responses(404, 409, 423))
def update_income_budget(budgetid: int, 
    finperiodid: int,
    incomedesc: str,
    payload: PeriodLineBudgetAdjustRequest,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
    budget = db.get(Budget, period.budgetid)
    _assert_budget_editable(period, budget)
    pi = (
        db.query(PeriodIncome)
        .filter(PeriodIncome.finperiodid == finperiodid, PeriodIncome.incomedesc == incomedesc)
        .first()
    )
    if not pi:
        raise HTTPException(404, "Period income entry not found")
    if pi.system_key == CARRIED_FORWARD_SYSTEM_KEY:
        raise HTTPException(409, "System-managed carried forward income cannot be budget-adjusted")
    if (getattr(pi, "status", WORKING) or WORKING) == PAID:
        raise HTTPException(423, "Paid income must be revised before editing")

    targets = [period] if payload.scope == "current" else [period, *_future_unlocked_periods(period, db)]
    note = payload.note.strip()

    if payload.scope == "future":
        income_type = db.get(IncomeType, (period.budgetid, incomedesc))
        if not income_type:
            raise HTTPException(409, "Only setup-backed income lines can be updated across future unlocked periods")
        income_type.amount = payload.budgetamount
        income_type.revisionnum = next_supported_revisionnum(
            db,
            budgetid=period.budgetid,
            category="income",
            item_desc=incomedesc,
        )
        revision_snapshot = income_type.revisionnum
    else:
        revision_snapshot = pi.revision_snapshot

    changed_period_ids = set()
    for target in targets:
        row = db.get(PeriodIncome, (target.finperiodid, incomedesc))
        if not row:
            continue
        before_amount = Decimal(str(row.budgetamount))
        after_amount = Decimal(str(payload.budgetamount))
        row.budgetamount = after_amount
        if payload.scope == "future":
            row.revision_snapshot = revision_snapshot
        _record_budget_adjustment(
            finperiodid=target.finperiodid,
            budgetid=target.budgetid,
            source="income",
            source_key=incomedesc,
            note=note,
            scope=payload.scope,
            before_amount=before_amount,
            after_amount=after_amount,
            line_status=None,
            revisionnum=revision_snapshot if payload.scope == "future" else None,
            db=db,
        )
        changed_period_ids.add(target.finperiodid)

    for period_id in changed_period_ids:
        sync_period_state(period_id, db)

    db.commit()
    db.refresh(pi)
    return pi


# ── Update income status (Current | Paid | Revised) ─────────────────────────

@router.patch("/{finperiodid}/income/{incomedesc}/status", response_model=PeriodIncomeOut, responses=error_responses(404, 409, 422, 423))
def set_income_status(budgetid: int, 
    finperiodid: int,
    incomedesc: str,
    payload: PeriodIncomeStatusUpdate,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
    _assert_not_closed(period)
    allowed = {WORKING, PAID, REVISED}
    if payload.status not in allowed:
        raise HTTPException(422, f"status must be one of {allowed}")
    pi = db.get(PeriodIncome, (finperiodid, incomedesc))
    if not pi:
        raise HTTPException(404, "Period income not found")
    current_status = getattr(pi, "status", WORKING) or WORKING
    if current_status != PAID and payload.status == REVISED:
        raise HTTPException(409, "Only paid income can be revised")
    if current_status == PAID and payload.status == WORKING:
        raise HTTPException(409, "Paid income must be revised before returning to Current")
    if current_status == REVISED and payload.status == WORKING:
        raise HTTPException(409, "Revised income must be marked Paid when edits are complete")
    pi.status = payload.status
    if payload.status == REVISED:
        pi.revision_comment = (payload.revision_comment or "").strip() or None
    else:
        pi.revision_comment = None

    # Conditionally create status change history record
    budget = db.get(Budget, period.budgetid)
    if budget and budget.record_line_status_changes:
        build_status_change_tx(
            db,
            finperiodid=finperiodid,
            budgetid=period.budgetid,
            source="income",
            source_key=incomedesc,
            old_status=current_status,
            new_status=payload.status,
            note=payload.revision_comment if payload.status == REVISED else None,
            line_status=pi.revision_comment if payload.status == REVISED else None,
        )

    db.commit()
    db.refresh(pi)
    return pi


@router.patch("/{finperiodid}/expense/{expensedesc}/budget", response_model=PeriodExpenseOut, responses=error_responses(404, 409, 423))
def update_expense_budget(budgetid: int, 
    finperiodid: int,
    expensedesc: str,
    payload: PeriodLineBudgetAdjustRequest,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
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

    targets = [period] if payload.scope == "current" else [period, *_future_unlocked_periods(period, db)]
    note = payload.note.strip()

    if payload.scope == "future":
        expense_item = db.get(ExpenseItem, (period.budgetid, expensedesc))
        if not expense_item:
            raise HTTPException(409, "Only setup-backed expense lines can be updated across future unlocked periods")
        expense_item.expenseamount = payload.budgetamount
        expense_item.revisionnum = next_supported_revisionnum(
            db,
            budgetid=period.budgetid,
            category="expense",
            item_desc=expensedesc,
        )
        revision_snapshot = expense_item.revisionnum
    else:
        expense_item = None
        revision_snapshot = pe.revision_snapshot

    changed_period_ids = set()
    for target in targets:
        row = (
            db.query(PeriodExpense)
            .filter(PeriodExpense.finperiodid == target.finperiodid, PeriodExpense.expensedesc == expensedesc)
            .first()
        )
        if not row:
            continue
        _assert_expense_not_paid(row)
        before_amount = Decimal(str(row.budgetamount))
        after_amount = Decimal(str(payload.budgetamount)) if payload.scope == "current" else _expense_budget_for_period(
            expense_item,
            target,
            Decimal(str(payload.budgetamount)),
        )
        row.budgetamount = after_amount
        if payload.scope == "future":
            row.revision_snapshot = revision_snapshot
        _record_budget_adjustment(
            finperiodid=target.finperiodid,
            budgetid=target.budgetid,
            source="expense",
            source_key=expensedesc,
            note=note,
            scope=payload.scope,
            before_amount=before_amount,
            after_amount=after_amount,
            line_status=getattr(row, "status", WORKING) or WORKING,
            revisionnum=revision_snapshot if payload.scope == "future" else None,
            db=db,
        )
        changed_period_ids.add(target.finperiodid)

    for period_id in changed_period_ids:
        sync_period_state(period_id, db)

    db.commit()
    refreshed = (
        db.query(PeriodExpense)
        .filter(PeriodExpense.finperiodid == finperiodid, PeriodExpense.expensedesc == expensedesc)
        .first()
    )
    return _enrich_expenses([refreshed], db)[0]


# ── Remove income from period ─────────────────────────────────────────────────

@router.delete("/{finperiodid}/income/{incomedesc}", status_code=204, responses=error_responses(404, 409, 423))
def remove_income_from_period(budgetid: int, 
    finperiodid: int,
    incomedesc: str,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
    budget = db.get(Budget, period.budgetid)
    _assert_budget_editable(period, budget)
    pi = db.get(PeriodIncome, (finperiodid, incomedesc))
    if not pi:
        raise HTTPException(404, "Period income entry not found")
    if pi.system_key == CARRIED_FORWARD_SYSTEM_KEY:
        raise HTTPException(409, "System-managed carried forward income cannot be removed")
    has_transactions = (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.finperiodid == finperiodid,
            PeriodTransaction.source.in_(["income", "transfer"]),
            PeriodTransaction.source_key == incomedesc,
            PeriodTransaction.entry_kind == "movement",
        )
        .first()
        is not None
    )
    if has_transactions:
        raise HTTPException(409, "Cannot remove income with recorded transactions")
    (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.finperiodid == finperiodid,
            PeriodTransaction.source_key == incomedesc,
            PeriodTransaction.entry_kind == "budget_adjustment",
        )
        .delete(synchronize_session=False)
    )
    db.delete(pi)
    db.commit()


# ── Remove expense from period (only if no actuals recorded) ──────────────────

@router.delete("/{finperiodid}/expense/{expensedesc}", status_code=204, responses=error_responses(404, 409, 423))
def remove_expense_from_period(budgetid: int, 
    finperiodid: int,
    expensedesc: str,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
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
    (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.finperiodid == finperiodid,
            PeriodTransaction.source == "expense",
            PeriodTransaction.source_key == expensedesc,
            PeriodTransaction.entry_kind == "budget_adjustment",
        )
        .delete(synchronize_session=False)
    )
    db.delete(pe)
    db.commit()


# ── Update investment budget amount ───────────────────────────────────────────

@router.patch("/{finperiodid}/investment/{investmentdesc}/budget", response_model=PeriodInvestmentOut, responses=error_responses(404, 409, 423))
def update_investment_budget(budgetid: int, 
    finperiodid: int,
    investmentdesc: str,
    payload: PeriodLineBudgetAdjustRequest,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
    budget = db.get(Budget, period.budgetid)
    _assert_budget_editable(period, budget)
    pi = db.get(PeriodInvestment, (finperiodid, investmentdesc))
    if not pi:
        raise HTTPException(404, "Period investment not found")
    _assert_investment_not_paid(pi)

    targets = [period] if payload.scope == "current" else [period, *_future_unlocked_periods(period, db)]
    note = payload.note.strip()

    if payload.scope == "future":
        item = db.get(InvestmentItem, (period.budgetid, investmentdesc))
        if not item:
            raise HTTPException(409, "Only setup-backed investment lines can be updated across future unlocked periods")
        item.planned_amount = payload.budgetamount
        item.revisionnum = next_supported_revisionnum(
            db,
            budgetid=period.budgetid,
            category="investment",
            item_desc=investmentdesc,
        )
        revision_snapshot = item.revisionnum
    else:
        revision_snapshot = pi.revision_snapshot

    changed_period_ids = set()
    for target in targets:
        row = db.get(PeriodInvestment, (target.finperiodid, investmentdesc))
        if not row:
            continue
        _assert_investment_not_paid(row)
        before_amount = Decimal(str(row.budgeted_amount))
        after_amount = Decimal(str(payload.budgetamount))
        row.budgeted_amount = after_amount
        if payload.scope == "future":
            row.revision_snapshot = revision_snapshot
        _record_budget_adjustment(
            finperiodid=target.finperiodid,
            budgetid=target.budgetid,
            source="investment",
            source_key=investmentdesc,
            note=note,
            scope=payload.scope,
            before_amount=before_amount,
            after_amount=after_amount,
            line_status=getattr(row, "status", WORKING) or WORKING,
            revisionnum=revision_snapshot if payload.scope == "future" else None,
            db=db,
        )
        changed_period_ids.add(target.finperiodid)

    for period_id in changed_period_ids:
        sync_period_state(period_id, db)

    db.commit()
    refreshed = db.get(PeriodInvestment, (finperiodid, investmentdesc))
    return _enrich_investments([refreshed], db)[0]


@router.patch("/{finperiodid}/investment/{investmentdesc}/status", response_model=PeriodInvestmentOut, responses=error_responses(404, 409, 422, 423))
def set_investment_status(budgetid: int, 
    finperiodid: int,
    investmentdesc: str,
    payload: PeriodInvestmentStatusUpdate,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
    _assert_not_closed(period)
    allowed = {WORKING, PAID, REVISED}
    if payload.status not in allowed:
        raise HTTPException(422, f"status must be one of {allowed}")

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
        pi.revision_comment = (payload.revision_comment or "").strip() or None
    elif payload.status == WORKING:
        pi.revision_comment = None

    # Conditionally create status change history record
    budget = db.get(Budget, period.budgetid)
    if budget and budget.record_line_status_changes:
        build_status_change_tx(
            db,
            finperiodid=finperiodid,
            budgetid=period.budgetid,
            source="investment",
            source_key=investmentdesc,
            old_status=current_status,
            new_status=payload.status,
            note=payload.revision_comment if payload.status == REVISED else None,
            line_status=pi.revision_comment if payload.status == REVISED else None,
        )

    db.commit()
    db.refresh(pi)
    return _enrich_investments([pi], db)[0]


@router.get("/{finperiodid}/closeout-preview", response_model=PeriodCloseoutPreviewOut, responses=error_responses(404, 409))
def get_closeout_preview(budgetid: int, finperiodid: int, db: DbSession):
    period = _get_period_or_404(finperiodid, budgetid, db)
    budget = db.get(Budget, period.budgetid)
    if cycle_stage(period) not in {CURRENT_STAGE, PENDING_CLOSURE_STAGE}:
        raise HTTPException(409, "Only the current or pending-closure cycle can be closed")
    preview = build_closeout_preview(period, budget, db)
    return PeriodCloseoutPreviewOut(**preview)


@router.post("/{finperiodid}/closeout", response_model=PeriodDetailOut, responses=error_responses(404, 409))
def close_out_period(budgetid: int, 
    finperiodid: int,
    payload: PeriodCloseoutRequest,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
    budget = db.get(Budget, period.budgetid)
    if cycle_stage(period) not in {CURRENT_STAGE, PENDING_CLOSURE_STAGE}:
        raise HTTPException(409, "Only the current or pending-closure cycle can be closed")
    try:
        close_cycle(period, budget, payload.comments, payload.goals, payload.create_next_cycle, db)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc
    db.commit()
    db.refresh(period)
    return get_period_detail(budgetid, finperiodid, db)


# ── Reorder expenses in a period ──────────────────────────────────────────────

@router.patch("/{finperiodid}/expenses/reorder", status_code=204, responses=error_responses(404, 423))
def reorder_period_expenses(budgetid: int, 
    finperiodid: int,
    payload: PeriodExpenseReorderRequest,
    db: DbSession,
):
    period = _get_period_or_404(finperiodid, budgetid, db)
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
