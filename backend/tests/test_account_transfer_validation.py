from __future__ import annotations

from decimal import Decimal

from app.models import BalanceType, PeriodIncome
from app.time_utils import utc_now

from .factories import create_balance_type, create_budget, create_expense_item, create_income_type, generate_periods


def test_transfer_from_cash_account_succeeds(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    primary = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Main", "balance_type": "Transaction", "opening_balance": "1000.00", "active": True, "is_primary": True},
    )
    assert primary.status_code == 201

    cash = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Cash", "balance_type": "Cash", "opening_balance": "200.00", "active": True, "is_primary": False},
    )
    assert cash.status_code == 201

    active_period = generate_periods(client, budgetid=budget.budgetid, startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0), count=1)[0]

    transfer = client.post(
        f"/api/periods/{active_period['finperiodid']}/account-transfer",
        json={"budgetid": budget.budgetid, "source_account": "Cash", "destination_account": "Main", "amount": "50.00"},
    )
    assert transfer.status_code == 201, transfer.text
    assert transfer.json()["incomedesc"] == "Transfer: Cash to Main"


def test_transfer_from_inactive_account_fails(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    primary = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Main", "balance_type": "Transaction", "opening_balance": "1000.00", "active": True, "is_primary": True},
    )
    assert primary.status_code == 201

    inactive = BalanceType(budgetid=budget.budgetid, balancedesc="Old", balance_type="Transaction", opening_balance=Decimal("100.00"), active=False, is_primary=False)
    db_session.add(inactive)
    db_session.commit()

    active_period = generate_periods(client, budgetid=budget.budgetid, startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0), count=1)[0]

    transfer = client.post(
        f"/api/periods/{active_period['finperiodid']}/account-transfer",
        json={"budgetid": budget.budgetid, "source_account": "Old", "destination_account": "Main", "amount": "50.00"},
    )
    assert transfer.status_code == 422
    assert "not active" in transfer.json()["detail"].lower()


def test_initial_transfer_exceeds_source_balance_fails(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    primary = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Main", "balance_type": "Transaction", "opening_balance": "1000.00", "active": True, "is_primary": True},
    )
    assert primary.status_code == 201

    savings = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Rainy Day", "balance_type": "Savings", "opening_balance": "100.00", "active": True, "is_primary": False},
    )
    assert savings.status_code == 201

    active_period = generate_periods(client, budgetid=budget.budgetid, startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0), count=1)[0]

    transfer = client.post(
        f"/api/periods/{active_period['finperiodid']}/account-transfer",
        json={"budgetid": budget.budgetid, "source_account": "Rainy Day", "destination_account": "Main", "amount": "150.00"},
    )
    assert transfer.status_code == 422
    assert "sufficient balance" in transfer.json()["detail"].lower()


def test_duplicate_transfer_line_fails(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    primary = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Main", "balance_type": "Transaction", "opening_balance": "1000.00", "active": True, "is_primary": True},
    )
    assert primary.status_code == 201

    savings = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Rainy Day", "balance_type": "Savings", "opening_balance": "500.00", "active": True, "is_primary": False},
    )
    assert savings.status_code == 201

    active_period = generate_periods(client, budgetid=budget.budgetid, startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0), count=1)[0]

    first = client.post(
        f"/api/periods/{active_period['finperiodid']}/account-transfer",
        json={"budgetid": budget.budgetid, "source_account": "Rainy Day", "destination_account": "Main", "amount": "50.00"},
    )
    assert first.status_code == 201

    second = client.post(
        f"/api/periods/{active_period['finperiodid']}/account-transfer",
        json={"budgetid": budget.budgetid, "source_account": "Rainy Day", "destination_account": "Main", "amount": "30.00"},
    )
    assert second.status_code == 409
    assert "already exists" in second.json()["detail"].lower()


def test_nonpaid_transfer_validates_against_max_budget_actual(client, db_session):
    """When actual > budget, committed amount follows actual."""
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    primary = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Main", "balance_type": "Transaction", "opening_balance": "1000.00", "active": True, "is_primary": True},
    )
    assert primary.status_code == 201

    # Source account opening balance = 300; after creating transfer line no movement yet
    savings = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Rainy Day", "balance_type": "Savings", "opening_balance": "300.00", "active": True, "is_primary": False},
    )
    assert savings.status_code == 201

    active_period = generate_periods(client, budgetid=budget.budgetid, startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0), count=1)[0]
    finperiodid = active_period["finperiodid"]

    # Create transfer line: budget=100
    transfer = client.post(
        f"/api/periods/{finperiodid}/account-transfer",
        json={"budgetid": budget.budgetid, "source_account": "Rainy Day", "destination_account": "Main", "amount": "100.00"},
    )
    assert transfer.status_code == 201

    # Record 120 transaction: committed = max(100, 120) = 120 <= 300 → succeeds
    tx1 = client.post(
        f"/api/periods/{finperiodid}/income/Transfer%3A%20Rainy%20Day%20to%20Main/transactions/",
        json={"amount": "120.00", "note": "Over-budget transfer"},
    )
    assert tx1.status_code == 201, tx1.text
    # Source closing balance is now 180 after the 120 debit

    # Record another 50: new actual would be 170; committed = max(100, 170) = 170 <= 180 → succeeds
    tx2 = client.post(
        f"/api/periods/{finperiodid}/income/Transfer%3A%20Rainy%20Day%20to%20Main/transactions/",
        json={"amount": "50.00", "note": "Second over-budget transfer"},
    )
    assert tx2.status_code == 201, tx2.text
    # Source closing balance is now 130

    # Record another 50: new actual would be 220; committed = max(100, 220) = 220 > 130 → fails
    tx3 = client.post(
        f"/api/periods/{finperiodid}/income/Transfer%3A%20Rainy%20Day%20to%20Main/transactions/",
        json={"amount": "50.00", "note": "Should fail"},
    )
    assert tx3.status_code == 422
    assert "sufficient balance" in tx3.json()["detail"].lower()


def test_nonpaid_transfer_validates_against_budget_when_actual_below_budget(client, db_session):
    """When budget >= actual, committed amount follows budget until actual exceeds it."""
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    primary = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Main", "balance_type": "Transaction", "opening_balance": "1000.00", "active": True, "is_primary": True},
    )
    assert primary.status_code == 201

    savings = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Rainy Day", "balance_type": "Savings", "opening_balance": "200.00", "active": True, "is_primary": False},
    )
    assert savings.status_code == 201

    active_period = generate_periods(client, budgetid=budget.budgetid, startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0), count=1)[0]
    finperiodid = active_period["finperiodid"]

    # Create transfer line: budget=150
    transfer = client.post(
        f"/api/periods/{finperiodid}/account-transfer",
        json={"budgetid": budget.budgetid, "source_account": "Rainy Day", "destination_account": "Main", "amount": "150.00"},
    )
    assert transfer.status_code == 201

    # Record 50: committed = max(150, 50) = 150 <= 200 → succeeds
    tx1 = client.post(
        f"/api/periods/{finperiodid}/income/Transfer%3A%20Rainy%20Day%20to%20Main/transactions/",
        json={"amount": "50.00", "note": "Within budget"},
    )
    assert tx1.status_code == 201, tx1.text

    # Record another 80: new actual=130; committed = max(150, 130) = 150 <= 200 → succeeds
    tx2 = client.post(
        f"/api/periods/{finperiodid}/income/Transfer%3A%20Rainy%20Day%20to%20Main/transactions/",
        json={"amount": "80.00", "note": "Still within budget"},
    )
    assert tx2.status_code == 201, tx2.text

    # Record another 80: new actual=210; committed = max(150, 210) = 210 > 200 → fails
    tx3 = client.post(
        f"/api/periods/{finperiodid}/income/Transfer%3A%20Rainy%20Day%20to%20Main/transactions/",
        json={"amount": "80.00", "note": "Should fail"},
    )
    assert tx3.status_code == 422
    assert "sufficient balance" in tx3.json()["detail"].lower()


def test_paid_transfer_validates_against_actual_plus_increment(client, db_session):
    """Paid line uses actualamount as committed base."""
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    primary = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Main", "balance_type": "Transaction", "opening_balance": "1000.00", "active": True, "is_primary": True},
    )
    assert primary.status_code == 201

    savings = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/",
        json={"balancedesc": "Rainy Day", "balance_type": "Savings", "opening_balance": "300.00", "active": True, "is_primary": False},
    )
    assert savings.status_code == 201

    active_period = generate_periods(client, budgetid=budget.budgetid, startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0), count=1)[0]
    finperiodid = active_period["finperiodid"]

    # Create transfer line and fully actualize it
    transfer = client.post(
        f"/api/periods/{finperiodid}/account-transfer",
        json={"budgetid": budget.budgetid, "source_account": "Rainy Day", "destination_account": "Main", "amount": "100.00"},
    )
    assert transfer.status_code == 201

    tx = client.post(
        f"/api/periods/{finperiodid}/income/Transfer%3A%20Rainy%20Day%20to%20Main/transactions/",
        json={"amount": "100.00", "note": "Full transfer"},
    )
    assert tx.status_code == 201

    # Mark as Paid via direct DB manipulation (income tx router blocks paid lines)
    pi = db_session.get(PeriodIncome, (finperiodid, "Transfer: Rainy Day to Main"))
    pi.status = "Paid"
    db_session.commit()

    # Direct actual addition through periods router should still validate
    # New actual would be 200; committed = 200 <= 300 → succeeds
    add_actual = client.patch(
        f"/api/periods/{finperiodid}/income/Transfer%3A%20Rainy%20Day%20to%20Main",
        json={"actualamount": "200.00"},
    )
    assert add_actual.status_code == 200, add_actual.text

    # Try to exceed balance: new actual would be 400; committed = 400 > 300 → fails
    add_actual_fail = client.patch(
        f"/api/periods/{finperiodid}/income/Transfer%3A%20Rainy%20Day%20to%20Main",
        json={"actualamount": "400.00"},
    )
    assert add_actual_fail.status_code == 422
    assert "sufficient balance" in add_actual_fail.json()["detail"].lower()
