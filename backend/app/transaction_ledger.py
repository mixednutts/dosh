from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime as dt, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from .models import (
    BalanceType,
    FinancialPeriod,
    IncomeType,
    InvestmentItem,
    PeriodBalance,
    PeriodExpense,
    PeriodIncome,
    PeriodInvestment,
    PeriodTransaction,
)

TX_TYPE_CREDIT = "CREDIT"
TX_TYPE_DEBIT = "DEBIT"
TX_TYPE_ADJUST = "ADJUST"
TX_TYPE_TRANSFER = "TRANSFER"
TX_TYPE_BUDGET_ADJ = "BUDGETADJ"
TX_TYPE_STATUS_CHANGE = "STATUS"
TRANSFER_PREFIX = "Transfer from "
ENTRY_KIND_MOVEMENT = "movement"
ENTRY_KIND_BUDGET_ADJUSTMENT = "budget_adjustment"
ENTRY_KIND_STATUS_CHANGE = "status_change"


@dataclass
class PeriodTransactionContext:
    finperiodid: int
    budgetid: int
    source: str
    tx_type: str
    source_key: str | None = None
    source_label: str | None = None
    affected_account_desc: str | None = None
    related_account_desc: str | None = None
    linked_incomedesc: str | None = None
    line_status: str | None = None
    budget_scope: str | None = None
    revisionnum: int | None = None


def _as_decimal(value) -> Decimal:
    return Decimal(str(value or 0))


def _rounded(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def get_primary_account_desc(budgetid: int, db: Session) -> str | None:
    primary = (
        db.query(BalanceType)
        .filter(
            BalanceType.budgetid == budgetid,
            BalanceType.balance_type == "Transaction",
            BalanceType.is_primary == True,  # noqa: E712
            BalanceType.active == True,  # noqa: E712
        )
        .first()
    )
    return primary.balancedesc if primary else None


def add_period_transaction(
    db: Session,
    context: PeriodTransactionContext,
    *,
    amount,
    note: str | None = None,
    entrydate: dt | None = None,
    is_system: bool = False,
    system_reason: str | None = None,
    legacy_table: str | None = None,
    legacy_id: int | None = None,
    dedupe_key: str | None = None,
    entry_kind: str = ENTRY_KIND_MOVEMENT,
    budget_before_amount=None,
    budget_after_amount=None,
):
    amount = _rounded(_as_decimal(amount))
    # Skip zero-amount movement transactions, but allow zero-amount for
    # budget_adjustment and status_change (non-financial history records)
    if amount == Decimal("0.00") and entry_kind == ENTRY_KIND_MOVEMENT:
        return None

    if dedupe_key:
        existing = (
            db.query(PeriodTransaction)
            .filter(PeriodTransaction.dedupe_key == dedupe_key)
            .first()
        )
        if existing:
            return existing

    if legacy_table and legacy_id is not None:
        existing = (
            db.query(PeriodTransaction)
            .filter(
                PeriodTransaction.legacy_table == legacy_table,
                PeriodTransaction.legacy_id == legacy_id,
            )
            .first()
        )
        if existing:
            return existing

    tx = PeriodTransaction(
        finperiodid=context.finperiodid,
        budgetid=context.budgetid,
        source=context.source,
        type=context.tx_type,
        amount=amount,
        note=note,
        entrydate=entrydate or dt.now(timezone.utc),
        is_system=is_system,
        system_reason=system_reason,
        source_key=context.source_key,
        source_label=context.source_label,
        affected_account_desc=context.affected_account_desc,
        related_account_desc=context.related_account_desc,
        linked_incomedesc=context.linked_incomedesc,
        legacy_table=legacy_table,
        legacy_id=legacy_id,
        dedupe_key=dedupe_key,
        entry_kind=entry_kind,
        line_status=context.line_status,
        budget_scope=context.budget_scope,
        budget_before_amount=_rounded(_as_decimal(budget_before_amount)) if budget_before_amount is not None else None,
        budget_after_amount=_rounded(_as_decimal(budget_after_amount)) if budget_after_amount is not None else None,
        revisionnum=context.revisionnum,
    )
    db.add(tx)
    db.flush()
    return tx


def build_expense_tx(
    finperiodid: int,
    budgetid: int,
    expensedesc: str,
    amount,
    db: Session,
    *,
    is_system: bool = False,
    system_reason: str | None = None,
    note: str | None = None,
    entrydate: dt | None = None,
    legacy_table: str | None = None,
    legacy_id: int | None = None,
    dedupe_key: str | None = None,
):
    amount = _rounded(_as_decimal(amount))
    expense = (
        db.query(PeriodExpense)
        .filter(
            PeriodExpense.finperiodid == finperiodid,
            PeriodExpense.expensedesc == expensedesc,
        )
        .first()
    )
    tx_type = TX_TYPE_ADJUST
    if not is_system:
        tx_type = TX_TYPE_DEBIT if amount >= 0 else TX_TYPE_CREDIT
    return add_period_transaction(
        db,
        PeriodTransactionContext(
            finperiodid=finperiodid,
            budgetid=budgetid,
            source="expense",
            tx_type=tx_type,
            source_key=expensedesc,
            source_label=expensedesc,
            affected_account_desc=get_primary_account_desc(budgetid, db),
            line_status=getattr(expense, "status", None),
        ),
        amount=amount,
        note=note,
        entrydate=entrydate,
        is_system=is_system,
        system_reason=system_reason,
        legacy_table=legacy_table,
        legacy_id=legacy_id,
        dedupe_key=dedupe_key,
    )


def build_income_tx(
    finperiodid: int,
    budgetid: int,
    incomedesc: str,
    amount,
    db: Session,
    *,
    is_system: bool = False,
    system_reason: str | None = None,
    note: str | None = None,
    entrydate: dt | None = None,
    dedupe_key: str | None = None,
):
    amount = _rounded(_as_decimal(amount))
    if incomedesc.startswith(TRANSFER_PREFIX):
        return add_period_transaction(
            db,
            PeriodTransactionContext(
                finperiodid=finperiodid,
                budgetid=budgetid,
                source="transfer",
                tx_type=TX_TYPE_TRANSFER,
                source_key=incomedesc,
                source_label=incomedesc,
                affected_account_desc=get_primary_account_desc(budgetid, db),
                related_account_desc=incomedesc[len(TRANSFER_PREFIX):],
            ),
            amount=amount,
            note=note,
            entrydate=entrydate,
            is_system=is_system,
            system_reason=system_reason,
            dedupe_key=dedupe_key,
        )

    income_type = db.get(IncomeType, (budgetid, incomedesc))
    tx_type = TX_TYPE_ADJUST
    if not is_system:
        tx_type = TX_TYPE_CREDIT if amount >= 0 else TX_TYPE_DEBIT
    return add_period_transaction(
        db,
        PeriodTransactionContext(
            finperiodid=finperiodid,
            budgetid=budgetid,
            source="income",
            tx_type=tx_type,
            source_key=incomedesc,
            source_label=incomedesc,
            affected_account_desc=income_type.linked_account if income_type else None,
        ),
        amount=amount,
        note=note,
        entrydate=entrydate,
        is_system=is_system,
        system_reason=system_reason,
        dedupe_key=dedupe_key,
    )


def build_investment_tx(
    finperiodid: int,
    budgetid: int,
    investmentdesc: str,
    amount,
    db: Session,
    *,
    is_system: bool = False,
    system_reason: str | None = None,
    note: str | None = None,
    entrydate: dt | None = None,
    linked_incomedesc: str | None = None,
    legacy_table: str | None = None,
    legacy_id: int | None = None,
    dedupe_key: str | None = None,
):
    amount = _rounded(_as_decimal(amount))
    item = db.get(InvestmentItem, (budgetid, investmentdesc))
    investment = db.get(PeriodInvestment, (finperiodid, investmentdesc))
    tx_type = TX_TYPE_ADJUST
    if not is_system:
        tx_type = TX_TYPE_CREDIT if amount >= 0 else TX_TYPE_DEBIT
    return add_period_transaction(
        db,
        PeriodTransactionContext(
            finperiodid=finperiodid,
            budgetid=budgetid,
            source="investment",
            tx_type=tx_type,
            source_key=investmentdesc,
            source_label=investmentdesc,
            affected_account_desc=item.linked_account_desc if item else None,
            linked_incomedesc=linked_incomedesc,
            line_status=getattr(investment, "status", None),
        ),
        amount=amount,
        note=note,
        entrydate=entrydate,
        is_system=is_system,
        system_reason=system_reason,
        legacy_table=legacy_table,
        legacy_id=legacy_id,
        dedupe_key=dedupe_key,
    )


def build_balance_adjustment_tx(
    finperiodid: int,
    budgetid: int,
    balancedesc: str,
    amount,
    db: Session,
    *,
    system_reason: str,
    note: str | None = None,
    dedupe_key: str | None = None,
):
    return add_period_transaction(
        db,
        PeriodTransactionContext(
            finperiodid=finperiodid,
            budgetid=budgetid,
            source="balance",
            tx_type=TX_TYPE_ADJUST,
            source_key=balancedesc,
            source_label=balancedesc,
            affected_account_desc=balancedesc,
        ),
        amount=amount,
        note=note,
        is_system=True,
        system_reason=system_reason,
        dedupe_key=dedupe_key,
    )


def build_budget_adjustment_tx(
    db: Session,
    context: PeriodTransactionContext,
    *,
    note: str,
    budget_before_amount,
    budget_after_amount,
    is_system: bool = False,
    system_reason: str | None = None,
    entrydate: dt | None = None,
    source_label: str | None = None,
    dedupe_key: str | None = None,
):
    return add_period_transaction(
        db,
        PeriodTransactionContext(
            finperiodid=context.finperiodid,
            budgetid=context.budgetid,
            source=context.source,
            tx_type=TX_TYPE_BUDGET_ADJ,
            source_key=context.source_key,
            source_label=source_label or context.source_label or context.source_key,
            line_status=context.line_status,
            budget_scope=context.budget_scope,
            revisionnum=context.revisionnum,
        ),
        amount=_rounded(_as_decimal(budget_after_amount) - _as_decimal(budget_before_amount)),
        note=note,
        entrydate=entrydate,
        is_system=is_system,
        system_reason=system_reason,
        dedupe_key=dedupe_key,
        entry_kind=ENTRY_KIND_BUDGET_ADJUSTMENT,
        budget_before_amount=budget_before_amount,
        budget_after_amount=budget_after_amount,
    )


def build_status_change_tx(
    db: Session,
    finperiodid: int,
    budgetid: int,
    source: str,
    source_key: str,
    old_status: str,
    new_status: str,
    note: str | None,
    line_status: str | None = None,
):
    """Create a non-financial transaction record for status changes (Paid/Revised).

    This follows the same pattern as budget adjustments:
    - entry_kind = "status_change"
    - amount = 0 (non-financial)
    - is_system = True (not user-deletable)
    """
    return add_period_transaction(
        db,
        PeriodTransactionContext(
            finperiodid=finperiodid,
            budgetid=budgetid,
            source=source,
            tx_type=TX_TYPE_STATUS_CHANGE,
            source_key=source_key,
            line_status=line_status,
        ),
        amount=Decimal("0.00"),
        note=f"Status: {old_status} → {new_status}" + (f" | {note}" if note else ""),
        entry_kind=ENTRY_KIND_STATUS_CHANGE,
        is_system=True,
        system_reason=f"Line marked {new_status}",
    )


def _sum_amount(query_result) -> Decimal:
    return _rounded(sum((_as_decimal(row.amount) for row in query_result), Decimal("0.00")))


def _transactions_for_period(finperiodid: int, db: Session) -> list[PeriodTransaction]:
    return (
        db.query(PeriodTransaction)
        .filter(PeriodTransaction.finperiodid == finperiodid)
        .order_by(PeriodTransaction.entrydate, PeriodTransaction.id)
        .all()
    )


def expense_amount_from_ledger(finperiodid: int, budgetid: int, expensedesc: str, db: Session) -> Decimal:
    rows = (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.finperiodid == finperiodid,
            PeriodTransaction.budgetid == budgetid,
            PeriodTransaction.source == "expense",
            PeriodTransaction.source_key == expensedesc,
            PeriodTransaction.entry_kind == ENTRY_KIND_MOVEMENT,
        )
        .all()
    )
    return _sum_amount(rows)


def income_amount_from_ledger(finperiodid: int, budgetid: int, incomedesc: str, db: Session) -> Decimal:
    source = "transfer" if incomedesc.startswith(TRANSFER_PREFIX) else "income"
    rows = (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.finperiodid == finperiodid,
            PeriodTransaction.budgetid == budgetid,
            PeriodTransaction.source == source,
            PeriodTransaction.source_key == incomedesc,
            PeriodTransaction.entry_kind == ENTRY_KIND_MOVEMENT,
        )
        .all()
    )
    return _sum_amount(rows)


def investment_amount_from_ledger(finperiodid: int, budgetid: int, investmentdesc: str, db: Session) -> Decimal:
    rows = (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.finperiodid == finperiodid,
            PeriodTransaction.budgetid == budgetid,
            PeriodTransaction.source == "investment",
            PeriodTransaction.source_key == investmentdesc,
            PeriodTransaction.entry_kind == ENTRY_KIND_MOVEMENT,
        )
        .all()
    )
    return _sum_amount(rows)


def account_delta_for_transaction(tx: PeriodTransaction, balancedesc: str) -> Decimal:
    if getattr(tx, "entry_kind", ENTRY_KIND_MOVEMENT) != ENTRY_KIND_MOVEMENT:
        return Decimal("0.00")
    amount = _as_decimal(tx.amount)
    if tx.source == "expense":
        return -amount if tx.affected_account_desc == balancedesc else Decimal("0.00")
    if tx.source in {"income", "investment", "balance"}:
        return amount if tx.affected_account_desc == balancedesc else Decimal("0.00")
    if tx.source == "transfer":
        delta = Decimal("0.00")
        if tx.affected_account_desc == balancedesc:
            delta += amount
        if tx.related_account_desc == balancedesc:
            delta -= amount
        return delta
    return Decimal("0.00")


def sync_period_state(finperiodid: int, db: Session) -> None:
    period = db.get(FinancialPeriod, finperiodid)
    if not period:
        return

    for pi in db.query(PeriodIncome).filter(PeriodIncome.finperiodid == finperiodid).all():
        pi.actualamount = income_amount_from_ledger(finperiodid, pi.budgetid, pi.incomedesc, db)
        pi.varianceamount = _rounded(_as_decimal(pi.actualamount) - _as_decimal(pi.budgetamount))

    for pe in db.query(PeriodExpense).filter(PeriodExpense.finperiodid == finperiodid).all():
        pe.actualamount = expense_amount_from_ledger(finperiodid, pe.budgetid, pe.expensedesc, db)
        pe.varianceamount = _rounded(_as_decimal(pe.actualamount) - _as_decimal(pe.budgetamount))

    for pi in db.query(PeriodInvestment).filter(PeriodInvestment.finperiodid == finperiodid).all():
        pi.actualamount = investment_amount_from_ledger(finperiodid, pi.budgetid, pi.investmentdesc, db)
        pi.closing_value = _rounded(_as_decimal(pi.opening_value) + _as_decimal(pi.actualamount))

    txs = _transactions_for_period(finperiodid, db)
    for pb in db.query(PeriodBalance).filter(PeriodBalance.finperiodid == finperiodid).all():
        movement = _rounded(sum((account_delta_for_transaction(tx, pb.balancedesc) for tx in txs), Decimal("0.00")))
        pb.movement_amount = movement
        pb.closing_amount = _rounded(_as_decimal(pb.opening_amount) + movement)


def _is_active_period(period: FinancialPeriod) -> bool:
    now = dt.now(timezone.utc)
    in_range = period.startdate <= now <= period.enddate
    return (not period.islocked) or in_range
