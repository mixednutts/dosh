from __future__ import annotations

from datetime import datetime as dt
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
TRANSFER_PREFIX = "Transfer from "
ENTRY_KIND_MOVEMENT = "movement"
ENTRY_KIND_BUDGET_ADJUSTMENT = "budget_adjustment"


def _as_decimal(value) -> Decimal:
    return Decimal(str(value or 0))


def _rounded(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def get_primary_account_desc(budgetid: int, db: Session) -> str | None:
    primary = (
        db.query(BalanceType)
        .filter(BalanceType.budgetid == budgetid, BalanceType.is_primary == True)  # noqa: E712
        .first()
    )
    return primary.balancedesc if primary else None


def add_period_transaction(
    db: Session,
    *,
    finperiodid: int,
    budgetid: int,
    source: str,
    tx_type: str,
    amount,
    note: str | None = None,
    entrydate: dt | None = None,
    is_system: bool = False,
    system_reason: str | None = None,
    source_key: str | None = None,
    source_label: str | None = None,
    affected_account_desc: str | None = None,
    related_account_desc: str | None = None,
    linked_incomedesc: str | None = None,
    legacy_table: str | None = None,
    legacy_id: int | None = None,
    dedupe_key: str | None = None,
    entry_kind: str = ENTRY_KIND_MOVEMENT,
    budget_scope: str | None = None,
    budget_before_amount=None,
    budget_after_amount=None,
):
    amount = _rounded(_as_decimal(amount))
    if amount == Decimal("0.00"):
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
        finperiodid=finperiodid,
        budgetid=budgetid,
        source=source,
        type=tx_type,
        amount=amount,
        note=note,
        entrydate=entrydate or dt.utcnow(),
        is_system=is_system,
        system_reason=system_reason,
        source_key=source_key,
        source_label=source_label,
        affected_account_desc=affected_account_desc,
        related_account_desc=related_account_desc,
        linked_incomedesc=linked_incomedesc,
        legacy_table=legacy_table,
        legacy_id=legacy_id,
        dedupe_key=dedupe_key,
        entry_kind=entry_kind,
        budget_scope=budget_scope,
        budget_before_amount=_rounded(_as_decimal(budget_before_amount)) if budget_before_amount is not None else None,
        budget_after_amount=_rounded(_as_decimal(budget_after_amount)) if budget_after_amount is not None else None,
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
    tx_type = TX_TYPE_ADJUST if is_system else (TX_TYPE_DEBIT if amount >= 0 else TX_TYPE_CREDIT)
    return add_period_transaction(
        db,
        finperiodid=finperiodid,
        budgetid=budgetid,
        source="expense",
        tx_type=tx_type,
        amount=amount,
        note=note,
        entrydate=entrydate,
        is_system=is_system,
        system_reason=system_reason,
        source_key=expensedesc,
        source_label=expensedesc,
        affected_account_desc=get_primary_account_desc(budgetid, db),
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
            finperiodid=finperiodid,
            budgetid=budgetid,
            source="transfer",
            tx_type=TX_TYPE_TRANSFER,
            amount=amount,
            note=note,
            entrydate=entrydate,
            is_system=is_system,
            system_reason=system_reason,
            source_key=incomedesc,
            source_label=incomedesc,
            affected_account_desc=get_primary_account_desc(budgetid, db),
            related_account_desc=incomedesc[len(TRANSFER_PREFIX):],
            dedupe_key=dedupe_key,
        )

    income_type = db.get(IncomeType, (budgetid, incomedesc))
    tx_type = TX_TYPE_ADJUST if is_system else (TX_TYPE_CREDIT if amount >= 0 else TX_TYPE_DEBIT)
    return add_period_transaction(
        db,
        finperiodid=finperiodid,
        budgetid=budgetid,
        source="income",
        tx_type=tx_type,
        amount=amount,
        note=note,
        entrydate=entrydate,
        is_system=is_system,
        system_reason=system_reason,
        source_key=incomedesc,
        source_label=incomedesc,
        affected_account_desc=income_type.linked_account if income_type else None,
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
    tx_type = TX_TYPE_ADJUST if is_system else (TX_TYPE_CREDIT if amount >= 0 else TX_TYPE_DEBIT)
    return add_period_transaction(
        db,
        finperiodid=finperiodid,
        budgetid=budgetid,
        source="investment",
        tx_type=tx_type,
        amount=amount,
        note=note,
        entrydate=entrydate,
        is_system=is_system,
        system_reason=system_reason,
        source_key=investmentdesc,
        source_label=investmentdesc,
        affected_account_desc=item.linked_account_desc if item else None,
        linked_incomedesc=linked_incomedesc,
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
        finperiodid=finperiodid,
        budgetid=budgetid,
        source="balance",
        tx_type=TX_TYPE_ADJUST,
        amount=amount,
        note=note,
        is_system=True,
        system_reason=system_reason,
        source_key=balancedesc,
        source_label=balancedesc,
        affected_account_desc=balancedesc,
        dedupe_key=dedupe_key,
    )


def build_budget_adjustment_tx(
    finperiodid: int,
    budgetid: int,
    source: str,
    source_key: str,
    db: Session,
    *,
    note: str,
    budget_scope: str,
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
        finperiodid=finperiodid,
        budgetid=budgetid,
        source=source,
        tx_type=TX_TYPE_BUDGET_ADJ,
        amount=_rounded(_as_decimal(budget_after_amount) - _as_decimal(budget_before_amount)),
        note=note,
        entrydate=entrydate,
        is_system=is_system,
        system_reason=system_reason,
        source_key=source_key,
        source_label=source_label or source_key,
        dedupe_key=dedupe_key,
        entry_kind=ENTRY_KIND_BUDGET_ADJUSTMENT,
        budget_scope=budget_scope,
        budget_before_amount=budget_before_amount,
        budget_after_amount=budget_after_amount,
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
    now = dt.utcnow()
    in_range = period.startdate <= now <= period.enddate
    return (not period.islocked) or in_range
