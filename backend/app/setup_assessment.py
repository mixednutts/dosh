from __future__ import annotations

from sqlalchemy.orm import Session

from .models import (
    BalanceType,
    Budget,
    ExpenseItem,
    IncomeType,
    InvestmentItem,
    PeriodBalance,
    PeriodExpense,
    PeriodIncome,
    PeriodInvestment,
    PeriodTransaction,
)


def _dedupe(values: list[str]) -> list[str]:
    deduped: list[str] = []
    for value in values:
        if value not in deduped:
            deduped.append(value)
    return deduped


def _account_has_generated_rows(budgetid: int, balancedesc: str, db: Session) -> bool:
    return (
        db.query(PeriodBalance)
        .filter(
            PeriodBalance.budgetid == budgetid,
            PeriodBalance.balancedesc == balancedesc,
        )
        .first()
        is not None
    )


def _account_has_transactions(budgetid: int, balancedesc: str, db: Session) -> bool:
    return (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.budgetid == budgetid,
            (PeriodTransaction.affected_account_desc == balancedesc)
            | (PeriodTransaction.related_account_desc == balancedesc),
        )
        .first()
        is not None
    )


def account_assessment(budgetid: int, balancedesc: str, db: Session) -> dict:
    setup_reasons: list[str] = []
    downstream_reasons: list[str] = []

    if (
        db.query(IncomeType)
        .filter(
            IncomeType.budgetid == budgetid,
            IncomeType.linked_account == balancedesc,
        )
        .first()
        is not None
    ):
        setup_reasons.append("Linked to one or more income sources")

    if (
        db.query(InvestmentItem)
        .filter(
            InvestmentItem.budgetid == budgetid,
            InvestmentItem.linked_account_desc == balancedesc,
        )
        .first()
        is not None
    ):
        setup_reasons.append("Linked to one or more investment lines")

    if _account_has_generated_rows(budgetid, balancedesc, db):
        downstream_reasons.append("Included in generated budget cycles")

    if _account_has_transactions(budgetid, balancedesc, db):
        downstream_reasons.append("Referenced by recorded account movement")

    return {
        "balancedesc": balancedesc,
        "in_use": bool(downstream_reasons),
        "reasons": _dedupe([*setup_reasons, *downstream_reasons]),
        "can_delete": not (setup_reasons or downstream_reasons),
        "can_deactivate": not (setup_reasons or downstream_reasons),
        "can_edit_structure": not downstream_reasons,
    }


def _income_has_generated_rows(budgetid: int, incomedesc: str, db: Session) -> bool:
    return (
        db.query(PeriodIncome)
        .filter(
            PeriodIncome.budgetid == budgetid,
            PeriodIncome.incomedesc == incomedesc,
        )
        .first()
        is not None
    )


def _income_has_transactions(budgetid: int, incomedesc: str, db: Session) -> bool:
    return (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.budgetid == budgetid,
            PeriodTransaction.source == "income",
            PeriodTransaction.source_key == incomedesc,
        )
        .first()
        is not None
    )


def income_assessment(budgetid: int, incomedesc: str, db: Session) -> dict:
    reasons: list[str] = []

    if _income_has_generated_rows(budgetid, incomedesc, db):
        reasons.append("Included in generated budget cycles")

    if _income_has_transactions(budgetid, incomedesc, db):
        reasons.append("Referenced by recorded income activity")

    reasons = _dedupe(reasons)
    return {
        "incomedesc": incomedesc,
        "in_use": bool(reasons),
        "reasons": reasons,
        "can_delete": not reasons,
        "can_edit_structure": not reasons,
    }


def _expense_has_generated_rows(budgetid: int, expensedesc: str, db: Session) -> bool:
    return (
        db.query(PeriodExpense)
        .filter(
            PeriodExpense.budgetid == budgetid,
            PeriodExpense.expensedesc == expensedesc,
        )
        .first()
        is not None
    )


def _expense_has_transactions(budgetid: int, expensedesc: str, db: Session) -> bool:
    return (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.budgetid == budgetid,
            PeriodTransaction.source == "expense",
            PeriodTransaction.source_key == expensedesc,
        )
        .first()
        is not None
    )


def expense_assessment(budgetid: int, expensedesc: str, db: Session) -> dict:
    reasons: list[str] = []

    if _expense_has_generated_rows(budgetid, expensedesc, db):
        reasons.append("Included in generated budget cycles")

    if _expense_has_transactions(budgetid, expensedesc, db):
        reasons.append("Referenced by recorded expense activity")

    reasons = _dedupe(reasons)
    return {
        "expensedesc": expensedesc,
        "in_use": bool(reasons),
        "reasons": reasons,
        "can_delete": not reasons,
        "can_deactivate": not reasons,
        # Expense revisions are an established supported workflow.
        "can_edit_structure": True,
    }


def _investment_has_generated_rows(budgetid: int, investmentdesc: str, db: Session) -> bool:
    return (
        db.query(PeriodInvestment)
        .filter(
            PeriodInvestment.budgetid == budgetid,
            PeriodInvestment.investmentdesc == investmentdesc,
        )
        .first()
        is not None
    )


def _investment_has_transactions(budgetid: int, investmentdesc: str, db: Session) -> bool:
    return (
        db.query(PeriodTransaction)
        .filter(
            PeriodTransaction.budgetid == budgetid,
            PeriodTransaction.source == "investment",
            PeriodTransaction.source_key == investmentdesc,
        )
        .first()
        is not None
    )


def investment_assessment(budgetid: int, investmentdesc: str, db: Session) -> dict:
    reasons: list[str] = []

    if _investment_has_generated_rows(budgetid, investmentdesc, db):
        reasons.append("Included in generated budget cycles")

    if _investment_has_transactions(budgetid, investmentdesc, db):
        reasons.append("Referenced by recorded investment activity")

    reasons = _dedupe(reasons)
    return {
        "investmentdesc": investmentdesc,
        "in_use": bool(reasons),
        "reasons": reasons,
        "can_delete": not reasons,
        "can_deactivate": not reasons,
        "can_edit_structure": not reasons,
    }


def budget_setup_assessment(budgetid: int, db: Session) -> dict | None:
    budget = db.get(Budget, budgetid)
    if not budget:
        return None

    balances = db.query(BalanceType).filter(BalanceType.budgetid == budgetid).all()
    income_types = db.query(IncomeType).filter(IncomeType.budgetid == budgetid).all()
    expense_items = db.query(ExpenseItem).filter(ExpenseItem.budgetid == budgetid).all()
    investment_items = db.query(InvestmentItem).filter(InvestmentItem.budgetid == budgetid).all()
    active_expense_items = [item for item in expense_items if item.active]
    active_accounts = [balance for balance in balances if balance.active]
    primary_account = next((balance for balance in active_accounts if balance.is_primary), None)

    blocking_issues: list[str] = []
    warnings: list[str] = []

    if not income_types:
        blocking_issues.append("Add at least one income source so your budget cycle has income to plan with.")

    if not active_expense_items:
        blocking_issues.append("Add at least one active expense item so your budget cycle has spending to plan for.")

    if not active_accounts:
        blocking_issues.append("Add at least one active account so Dosh has a place to track this budget's balances.")
    elif not primary_account and active_expense_items:
        blocking_issues.append("Choose one active account as the primary transaction account so expense entries have a default home.")

    if budget.auto_add_surplus_to_investment:
        primary_investment = next((item for item in investment_items if item.active and item.is_primary), None)
        if not primary_investment:
            warnings.append("Automatic surplus allocation is turned on, but no active primary investment line is ready yet.")

    return {
        "budgetid": budgetid,
        "can_generate": len(blocking_issues) == 0,
        "blocking_issues": blocking_issues,
        "warnings": warnings,
        "accounts": [account_assessment(budgetid, balance.balancedesc, db) for balance in balances],
        "income_types": [income_assessment(budgetid, income.incomedesc, db) for income in income_types],
        "expense_items": [expense_assessment(budgetid, expense.expensedesc, db) for expense in expense_items],
        "investment_items": [investment_assessment(budgetid, investment.investmentdesc, db) for investment in investment_items],
    }
