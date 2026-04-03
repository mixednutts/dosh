from __future__ import annotations

from decimal import Decimal

from app.models import IncomeType, InvestmentItem
from app.time_utils import app_now_naive

from .factories import create_balance_type, create_minimum_budget_setup, generate_periods


def test_period_transactions_drive_balance_movement_and_balance_transaction_views(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    salary = db_session.get(IncomeType, (budget.budgetid, "Salary"))
    salary.linked_account = "Main Account"
    emergency_fund = db_session.get(InvestmentItem, (budget.budgetid, "Emergency Fund"))
    emergency_fund.linked_account_desc = "Main Account"
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
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    income_update = client.patch(
        f"/api/periods/{active_period['finperiodid']}/income/Salary",
        json={"actualamount": "1000.00"},
    )
    assert income_update.status_code == 200, income_update.text

    expense_entry = client.post(
        f"/api/periods/{active_period['finperiodid']}/expenses/Rent/entries/",
        json={"amount": "200.00", "note": "Rent paid"},
    )
    assert expense_entry.status_code == 201, expense_entry.text

    investment_tx = client.post(
        f"/api/periods/{active_period['finperiodid']}/investments/Emergency%20Fund/transactions/",
        json={"amount": "50.00", "note": "Savings contribution"},
    )
    assert investment_tx.status_code == 201, investment_tx.text

    transfer_create = client.post(
        f"/api/periods/{active_period['finperiodid']}/savings-transfer",
        json={"budgetid": budget.budgetid, "balancedesc": "Rainy Day", "amount": "75.00"},
    )
    assert transfer_create.status_code == 201, transfer_create.text

    transfer_actual = client.patch(
        f"/api/periods/{active_period['finperiodid']}/income/Transfer%20from%20Rainy%20Day",
        json={"actualamount": "75.00"},
    )
    assert transfer_actual.status_code == 200, transfer_actual.text

    balances_response = client.get(f"/api/periods/{active_period['finperiodid']}/balances")
    assert balances_response.status_code == 200, balances_response.text
    balances = {row["balancedesc"]: row for row in balances_response.json()}

    main_account = balances["Main Account"]
    rainy_day = balances["Rainy Day"]
    assert Decimal(main_account["movement_amount"]) == Decimal("925.00")
    assert Decimal(main_account["closing_amount"]) == Decimal("1925.00")
    assert Decimal(rainy_day["movement_amount"]) == Decimal("-75.00")
    assert Decimal(rainy_day["closing_amount"]) == Decimal("425.00")

    main_account_txs = client.get(
        f"/api/periods/{active_period['finperiodid']}/balances/Main%20Account/transactions"
    )
    assert main_account_txs.status_code == 200, main_account_txs.text
    main_tx_payload = main_account_txs.json()
    assert [tx["source"] for tx in main_tx_payload] == ["income", "expense", "investment", "transfer"]

    filtered_txs = client.get(
        f"/api/periods/{active_period['finperiodid']}/transactions?balancedesc=Main%20Account"
    )
    assert filtered_txs.status_code == 200, filtered_txs.text
    assert len(filtered_txs.json()) == 4

    rainy_day_txs = client.get(
        f"/api/periods/{active_period['finperiodid']}/balances/Rainy%20Day/transactions"
    )
    assert rainy_day_txs.status_code == 200, rainy_day_txs.text
    rainy_day_payload = rainy_day_txs.json()
    assert len(rainy_day_payload) == 1
    assert rainy_day_payload[0]["source"] == "transfer"
    assert rainy_day_payload[0]["related_account_desc"] == "Rainy Day"

