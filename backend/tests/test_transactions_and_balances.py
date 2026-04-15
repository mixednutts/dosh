from __future__ import annotations

from decimal import Decimal

from app.models import IncomeType, InvestmentItem
from app.time_utils import utc_now

from .factories import create_balance_type, create_minimum_budget_setup, generate_periods


def test_period_transactions_drive_balance_movement_and_balance_transaction_views(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    salary = db_session.get(IncomeType, (budget.budgetid, "Salary"))
    salary.linked_account = "Main Account"
    emergency_fund = db_session.get(InvestmentItem, (budget.budgetid, "Emergency Fund"))
    emergency_fund.linked_account_desc = "Rainy Day"
    emergency_fund.source_account_desc = "Main Account"
    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Rainy Day",
        opening_balance=Decimal("500.00"),
        balance_type="Savings",
        is_primary=False,
    )

    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    income_update = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/income/Salary",
        json={"actualamount": "1000.00"},
    )
    assert income_update.status_code == 200, income_update.text

    expense_entry = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/expenses/Rent/entries/",
        json={"amount": "200.00", "note": "Rent paid"},
    )
    assert expense_entry.status_code == 201, expense_entry.text

    investment_tx = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/investments/Emergency%20Fund/transactions/",
        json={"amount": "50.00", "note": "Savings contribution"},
    )
    assert investment_tx.status_code == 201, investment_tx.text

    transfer_create = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/account-transfer",
        json={
            "budgetid": budget.budgetid,
            "source_account": "Rainy Day",
            "destination_account": "Main Account",
            "amount": "75.00",
        },
    )
    assert transfer_create.status_code == 201, transfer_create.text

    transfer_actual = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/income/Transfer%3A%20Rainy%20Day%20to%20Main%20Account",
        json={"actualamount": "75.00"},
    )
    assert transfer_actual.status_code == 200, transfer_actual.text

    balances_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/balances")
    assert balances_response.status_code == 200, balances_response.text
    balances = {row["balancedesc"]: row for row in balances_response.json()}

    main_account = balances["Main Account"]
    rainy_day = balances["Rainy Day"]
    assert Decimal(main_account["movement_amount"]) == Decimal("825.00")
    assert Decimal(main_account["closing_amount"]) == Decimal("1825.00")
    assert Decimal(rainy_day["movement_amount"]) == Decimal("-25.00")
    assert Decimal(rainy_day["closing_amount"]) == Decimal("475.00")

    main_account_txs = client.get(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/balances/Main%20Account/transactions"
    )
    assert main_account_txs.status_code == 200, main_account_txs.text
    main_tx_payload = main_account_txs.json()
    assert [tx["source"] for tx in main_tx_payload] == ["income", "expense", "investment", "transfer"]

    filtered_txs = client.get(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/transactions?balancedesc=Main%20Account"
    )
    assert filtered_txs.status_code == 200, filtered_txs.text
    assert len(filtered_txs.json()) == 4

    rainy_day_txs = client.get(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/balances/Rainy%20Day/transactions"
    )
    assert rainy_day_txs.status_code == 200, rainy_day_txs.text
    rainy_day_payload = rainy_day_txs.json()
    assert len(rainy_day_payload) == 2
    transfer_tx = next(tx for tx in rainy_day_payload if tx["source"] == "transfer")
    investment_tx = next(tx for tx in rainy_day_payload if tx["source"] == "investment")
    assert transfer_tx["related_account_desc"] == "Rainy Day"
    assert investment_tx["affected_account_desc"] == "Rainy Day"


def test_locked_active_cycle_still_allows_actuals_and_transactions(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    salary = db_session.get(IncomeType, (budget.budgetid, "Salary"))
    salary.linked_account = "Main Account"
    emergency_fund = db_session.get(InvestmentItem, (budget.budgetid, "Emergency Fund"))
    emergency_fund.linked_account_desc = "Rainy Day"
    emergency_fund.source_account_desc = "Main Account"
    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Rainy Day",
        opening_balance=Decimal("500.00"),
        balance_type="Savings",
        is_primary=False,
    )

    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    lock_response = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/lock",
        json={"islocked": True},
    )
    assert lock_response.status_code == 200, lock_response.text
    assert lock_response.json()["islocked"] is True
    assert lock_response.json()["cycle_status"] == "ACTIVE"

    income_update = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/income/Salary",
        json={"actualamount": "1000.00"},
    )
    assert income_update.status_code == 200, income_update.text

    expense_entry = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/expenses/Rent/entries/",
        json={"amount": "200.00", "note": "Rent paid while locked"},
    )
    assert expense_entry.status_code == 201, expense_entry.text

    investment_tx = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/investments/Emergency%20Fund/transactions/",
        json={"amount": "50.00", "note": "Savings contribution while locked"},
    )
    assert investment_tx.status_code == 201, investment_tx.text

    transfer_create = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/account-transfer",
        json={
            "budgetid": budget.budgetid,
            "source_account": "Rainy Day",
            "destination_account": "Main Account",
            "amount": "75.00",
        },
    )
    assert transfer_create.status_code == 201, transfer_create.text

    transfer_actual = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/income/Transfer%3A%20Rainy%20Day%20to%20Main%20Account",
        json={"actualamount": "75.00"},
    )
    assert transfer_actual.status_code == 200, transfer_actual.text

    balances_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/balances")
    assert balances_response.status_code == 200, balances_response.text
    balances = {row["balancedesc"]: row for row in balances_response.json()}

    assert Decimal(balances["Main Account"]["movement_amount"]) == Decimal("825.00")
    assert Decimal(balances["Rainy Day"]["movement_amount"]) == Decimal("-25.00")


def test_creating_active_balance_type_creates_period_balances_for_existing_periods(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=2,
    )
    assert len(periods) == 2

    response = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types",
        json={
            "balancedesc": "New Account",
            "balance_type": "Transaction",
            "opening_balance": "250.00",
            "active": True,
            "is_primary": False,
        },
    )
    assert response.status_code == 201, response.text

    for period in periods:
        balances_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{period['finperiodid']}/balances")
        assert balances_response.status_code == 200, balances_response.text
        balances = {row["balancedesc"]: row for row in balances_response.json()}
        assert "New Account" in balances
        assert Decimal(balances["New Account"]["opening_amount"]) == Decimal("250.00")


def test_creating_active_balance_type_skips_closed_and_pending_closure_periods(client, db_session):
    from datetime import timedelta
    from app.time_utils import utc_now

    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    # Generate 3 periods starting from 60 days ago so:
    # - first is historic (will be closed)
    # - second is pending closure (ended before now, not closed)
    # - third is current or future
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=60)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=3)
    assert len(periods) == 3

    first_period_id = periods[0]["finperiodid"]
    second_period_id = periods[1]["finperiodid"]
    third_period_id = periods[2]["finperiodid"]

    # Close the first period
    close_response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{first_period_id}/closeout",
        json={"create_next_cycle": False},
    )
    assert close_response.status_code == 200, close_response.text

    response = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types",
        json={
            "balancedesc": "Late Account",
            "balance_type": "Transaction",
            "opening_balance": "100.00",
            "active": True,
            "is_primary": False,
        },
    )
    assert response.status_code == 201, response.text

    # Closed period should NOT have the new account
    closed_balances = client.get(f"/api/budgets/{budget.budgetid}/periods/{first_period_id}/balances")
    assert closed_balances.status_code == 200, closed_balances.text
    closed_descs = {row["balancedesc"] for row in closed_balances.json()}
    assert "Late Account" not in closed_descs

    # Pending closure period should NOT have the new account
    pending_balances = client.get(f"/api/budgets/{budget.budgetid}/periods/{second_period_id}/balances")
    assert pending_balances.status_code == 200, pending_balances.text
    pending_descs = {row["balancedesc"] for row in pending_balances.json()}
    assert "Late Account" not in pending_descs

    # Current/future period SHOULD have the new account
    current_balances = client.get(f"/api/budgets/{budget.budgetid}/periods/{third_period_id}/balances")
    assert current_balances.status_code == 200, current_balances.text
    current_descs = {row["balancedesc"] for row in current_balances.json()}
    assert "Late Account" in current_descs
