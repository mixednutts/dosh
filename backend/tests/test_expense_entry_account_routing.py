from __future__ import annotations

from decimal import Decimal

from app.time_utils import utc_now

from .factories import create_balance_type, create_budget, create_expense_item, create_income_type, generate_periods


def test_expense_entry_debits_selected_non_primary_account(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    primary = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Main", "balance_type": "Transaction", "opening_balance": "1000.00", "active": True, "is_primary": True},
    )
    assert primary.status_code == 201

    secondary = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Joint", "balance_type": "Transaction", "opening_balance": "500.00", "active": True, "is_primary": False},
    )
    assert secondary.status_code == 201

    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    entry = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/expenses/Rent/entries/",
        json={"amount": "120.00", "note": "Debit joint", "account_desc": "Joint"},
    )
    assert entry.status_code == 201, entry.text
    assert entry.json()["affected_account_desc"] == "Joint"

    balances = client.get(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/balances")
    assert balances.status_code == 200
    by_name = {b["balancedesc"]: b for b in balances.json()}
    assert Decimal(by_name["Joint"]["movement_amount"]) == Decimal("-120.00")
    assert Decimal(by_name["Main"]["movement_amount"]) == Decimal("0.00")


def test_expense_entry_falls_back_to_primary_when_no_account_desc(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    primary = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Main", "balance_type": "Transaction", "opening_balance": "1000.00", "active": True, "is_primary": True},
    )
    assert primary.status_code == 201

    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    entry = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/expenses/Rent/entries/",
        json={"amount": "75.00", "note": "Debit primary by fallback"},
    )
    assert entry.status_code == 201, entry.text
    assert entry.json()["affected_account_desc"] == "Main"


def test_expense_entry_rejects_unknown_account(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    primary = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Main", "balance_type": "Transaction", "opening_balance": "1000.00", "active": True, "is_primary": True},
    )
    assert primary.status_code == 201

    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    entry = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/expenses/Rent/entries/",
        json={"amount": "50.00", "note": "Bad account", "account_desc": "Ghost"},
    )
    assert entry.status_code == 404
    assert "account not found" in entry.json()["detail"].lower()
