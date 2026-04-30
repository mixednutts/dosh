from __future__ import annotations

from decimal import Decimal

from app.models import BalanceType, ExpenseItem, PeriodBalance, PeriodIncome, PeriodTransaction

from .factories import create_minimum_budget_setup, generate_periods
from app.time_utils import utc_now


def test_close_account_preview_returns_balance_and_candidates(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )

    preview = client.get(f"/api/budgets/{budget.budgetid}/balance-types/Main%20Account/close-preview")
    assert preview.status_code == 200, preview.text
    data = preview.json()
    assert "current_balance" in data
    assert data["is_primary"] is True
    assert data["other_active_accounts"] == []


def test_close_non_primary_account_with_zero_balance(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    bt = BalanceType(
        budgetid=budget.budgetid,
        balancedesc="Secondary",
        balance_type="Banking",
        opening_balance="0.00",
        active=True,
        is_primary=False,
    )
    db_session.add(bt)
    db_session.commit()

    generate_periods(client, budgetid=budget.budgetid, startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0), count=1)

    close_resp = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/Secondary/close",
        json={},
    )
    assert close_resp.status_code == 200, close_resp.text
    assert close_resp.json()["active"] is False

    closed_bt = db_session.get(BalanceType, (budget.budgetid, "Secondary"))
    assert closed_bt.active is False


def test_close_primary_account_requires_new_primary(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    generate_periods(client, budgetid=budget.budgetid, startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0), count=1)

    close_resp = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/Main%20Account/close",
        json={},
    )
    assert close_resp.status_code == 422
    assert "new primary account must be selected" in close_resp.json()["detail"].lower()


def test_close_account_transfers_balance_and_reassigns_primary(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]

    # Add a second account
    bt2 = BalanceType(
        budgetid=budget.budgetid,
        balancedesc="Savings",
        balance_type="Banking",
        opening_balance="0.00",
        active=True,
        is_primary=False,
    )
    db_session.add(bt2)
    db_session.commit()

    generate_periods(client, budgetid=budget.budgetid, startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0), count=1)

    # Add an income transaction to give Main Account a balance
    periods = client.get(f"/api/budgets/{budget.budgetid}/periods").json()
    finperiodid = periods[0]["finperiodid"]

    tx = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/income/Salary/transactions/",
        json={"amount": "500.00", "note": "Payday"},
    )
    assert tx.status_code == 201, tx.text

    # Link an expense item to Main Account
    expense = db_session.get(ExpenseItem, (budget.budgetid, "Rent"))
    expense.default_account_desc = "Main Account"
    db_session.commit()

    preview = client.get(f"/api/budgets/{budget.budgetid}/balance-types/Main%20Account/close-preview")
    assert preview.status_code == 200, preview.text
    balance_before = Decimal(str(preview.json()["current_balance"]))

    close_resp = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/Main%20Account/close",
        json={"transfer_to_account": "Savings", "new_primary_account": "Savings"},
    )
    assert close_resp.status_code == 200, close_resp.text

    # Main Account is closed and demoted
    main_bt = db_session.get(BalanceType, (budget.budgetid, "Main Account"))
    assert main_bt.active is False
    assert main_bt.is_primary is False

    # Savings is now primary
    savings_bt = db_session.get(BalanceType, (budget.budgetid, "Savings"))
    assert savings_bt.is_primary is True

    # Expense item was re-linked
    expense_after = db_session.get(ExpenseItem, (budget.budgetid, "Rent"))
    assert expense_after.default_account_desc == "Savings"

    # Transfer transaction exists with the full balance amount
    transfer_txs = (
        db_session.query(PeriodTransaction)
        .filter(
            PeriodTransaction.finperiodid == finperiodid,
            PeriodTransaction.source == "transfer",
            PeriodTransaction.system_reason == "account_close_balance_transfer",
        )
        .all()
    )
    assert len(transfer_txs) == 1
    assert Decimal(str(transfer_txs[0].amount)) == balance_before
    assert transfer_txs[0].affected_account_desc == "Savings"
    assert transfer_txs[0].related_account_desc == "Main Account"

    # Savings balance received the transfer
    savings_pb = db_session.get(PeriodBalance, (finperiodid, "Savings"))
    assert savings_pb is not None
    assert Decimal(str(savings_pb.closing_amount)) == balance_before


def test_close_account_rejects_transfer_to_same_account(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    generate_periods(client, budgetid=budget.budgetid, startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0), count=1)

    close_resp = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/Main%20Account/close",
        json={"transfer_to_account": "Main Account", "new_primary_account": "Main Account"},
    )
    assert close_resp.status_code == 422
    assert "same account" in close_resp.json()["detail"].lower()


def test_close_account_removes_from_future_planned_periods(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    bt2 = BalanceType(
        budgetid=budget.budgetid,
        balancedesc="Savings",
        balance_type="Banking",
        opening_balance="0.00",
        active=True,
        is_primary=False,
    )
    db_session.add(bt2)
    db_session.commit()

    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=3,
    )
    active_period = next(p for p in periods if p["cycle_status"] == "ACTIVE")
    future_periods = [p for p in periods if p["cycle_status"] == "PLANNED"]
    assert len(future_periods) >= 1

    close_resp = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/Main%20Account/close",
        json={"new_primary_account": "Savings"},
    )
    assert close_resp.status_code == 200, close_resp.text

    # Active period should still have the balance record
    active_balances = client.get(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/balances")
    assert active_balances.status_code == 200
    active_descs = {b["balancedesc"] for b in active_balances.json()}
    assert "Main Account" in active_descs

    # Future planned periods should NOT have the closed account
    for future in future_periods:
        future_balances = client.get(f"/api/budgets/{budget.budgetid}/periods/{future['finperiodid']}/balances")
        assert future_balances.status_code == 200
        future_descs = {b["balancedesc"] for b in future_balances.json()}
        assert "Main Account" not in future_descs


def test_close_account_rejects_when_already_closed(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    bt = db_session.get(BalanceType, (budget.budgetid, "Main Account"))
    bt.active = False
    db_session.commit()

    close_resp = client.post(
        f"/api/budgets/{budget.budgetid}/balance-types/Main%20Account/close",
        json={},
    )
    assert close_resp.status_code == 422
    assert "already closed" in close_resp.json()["detail"].lower()
