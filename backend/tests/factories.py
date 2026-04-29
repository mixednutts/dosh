from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models import BalanceType, Budget, ExpenseItem, IncomeType, InvestmentItem
from app.health_engine_seed import create_default_matrix_for_budget


def local_midnight_utc(value: datetime, timezone_str: str = "Australia/Sydney") -> datetime:
    """Convert a naive or aware datetime to local midnight in the given timezone, expressed as UTC."""
    if value.tzinfo is None:
        local = value.replace(tzinfo=ZoneInfo(timezone_str))
    else:
        local = value.astimezone(ZoneInfo(timezone_str))
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)


def create_budget(
    db: Session,
    *,
    budgetowner: str = "Test User",
    description: str = "Test budget",
    budget_frequency: str = "Monthly",
    allow_overdraft_transactions: bool = True,
) -> Budget:
    budget = Budget(
        budgetowner=budgetowner,
        description=description,
        budget_frequency=budget_frequency,
        allow_overdraft_transactions=allow_overdraft_transactions,
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    create_default_matrix_for_budget(db, budget)
    db.commit()
    db.refresh(budget)
    return budget


def create_income_type(
    db: Session,
    *,
    budgetid: int,
    incomedesc: str = "Salary",
    amount: Decimal = Decimal("2500.00"),
    autoinclude: bool = True,
    issavings: bool = False,
    linked_account: str | None = None,
) -> IncomeType:
    income_type = IncomeType(
        budgetid=budgetid,
        incomedesc=incomedesc,
        amount=amount,
        autoinclude=autoinclude,
        issavings=issavings,
        linked_account=linked_account,
    )
    db.add(income_type)
    db.commit()
    db.refresh(income_type)
    return income_type


def create_expense_item(
    db: Session,
    *,
    budgetid: int,
    expensedesc: str = "Rent",
    expenseamount: Decimal = Decimal("1200.00"),
    freqtype: str = "Always",
    frequency_value: int | None = None,
    effectivedate: datetime | None = None,
    paytype: str = "MANUAL",
    sort_order: int = 0,
) -> ExpenseItem:
    expense_item = ExpenseItem(
        budgetid=budgetid,
        expensedesc=expensedesc,
        expenseamount=expenseamount,
        freqtype=freqtype,
        frequency_value=frequency_value,
        effectivedate=effectivedate,
        paytype=paytype,
        revisionnum=0,
        sort_order=sort_order,
    )
    db.add(expense_item)
    db.commit()
    db.refresh(expense_item)
    return expense_item


def create_balance_type(
    db: Session,
    *,
    budgetid: int,
    balancedesc: str = "Main Account",
    opening_balance: Decimal = Decimal("1000.00"),
    balance_type: str = "Banking",
    is_primary: bool = True,
    is_savings: bool = False,
) -> BalanceType:
    balance = BalanceType(
        budgetid=budgetid,
        balancedesc=balancedesc,
        opening_balance=opening_balance,
        balance_type=balance_type,
        is_primary=is_primary,
        is_savings=is_savings,
    )
    db.add(balance)
    db.commit()
    db.refresh(balance)
    return balance


def create_investment_item(
    db: Session,
    *,
    budgetid: int,
    investmentdesc: str = "Emergency Fund",
    initial_value: Decimal = Decimal("250.00"),
    planned_amount: Decimal = Decimal("0.00"),
    is_primary: bool = True,
) -> InvestmentItem:
    investment = InvestmentItem(
        budgetid=budgetid,
        investmentdesc=investmentdesc,
        initial_value=initial_value,
        planned_amount=planned_amount,
        revisionnum=0,
        is_primary=is_primary,
        active=True,
    )
    db.add(investment)
    db.commit()
    db.refresh(investment)
    return investment


def create_minimum_budget_setup(db: Session) -> dict[str, object]:
    budget = create_budget(db)
    income_type = create_income_type(db, budgetid=budget.budgetid)
    expense_item = create_expense_item(db, budgetid=budget.budgetid)
    balance_type = create_balance_type(db, budgetid=budget.budgetid)
    investment_item = create_investment_item(db, budgetid=budget.budgetid)

    return {
        "budget": budget,
        "income_type": income_type,
        "expense_item": expense_item,
        "balance_type": balance_type,
        "investment_item": investment_item,
    }


def iso_date(value: datetime) -> str:
    return value.isoformat()


def generate_periods(client, *, budgetid: int, startdate: datetime, count: int = 1) -> list[dict]:
    response = client.post(
        f"/api/budgets/{budgetid}/periods/generate",
        json={
            "budgetid": budgetid,
            "startdate": iso_date(startdate),
            "count": count,
        },
    )
    assert response.status_code == 201, response.text

    periods_response = client.get(f"/api/budgets/{budgetid}/periods")
    assert periods_response.status_code == 200, periods_response.text
    return periods_response.json()
