from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.models import PeriodInvestment, PeriodTransaction
from tests.factories import (
    create_balance_type,
    create_budget,
    create_expense_item,
    create_income_type,
    create_investment_item,
    generate_periods,
)


def test_list_investment_transactions_empty(client, db_session):
    setup = _minimum_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    response = client.get(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions"
    )
    assert response.status_code == 200
    assert response.json() == []


def test_add_investment_transaction_updates_actuals(client, db_session):
    setup = _minimum_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions",
        json={"amount": "250.00", "note": "Monthly contribution"},
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert Decimal(data["amount"]) == Decimal("250.00")
    assert data["note"] == "Monthly contribution"
    assert data["investmentdesc"] == "Emergency Fund"

    # Verify actuals updated
    detail = client.get(f"/api/budgets/{budget.budgetid}/periods/{period_id}")
    investment = next(i for i in detail.json()["investments"] if i["investmentdesc"] == "Emergency Fund")
    assert Decimal(investment["actualamount"]) == Decimal("250.00")


def test_add_investment_transaction_with_custom_account(client, db_session):
    setup = _minimum_setup(db_session)
    budget = setup["budget"]
    create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Secondary",
        opening_balance=Decimal("500.00"),
        balance_type="Transaction",
        is_primary=False,
    )
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions",
        json={"amount": "100.00", "account_desc": "Secondary"},
    )
    assert response.status_code == 201, response.text


def test_add_investment_transaction_rejects_inactive_account(client, db_session):
    setup = _minimum_setup(db_session)
    budget = setup["budget"]
    bt = create_balance_type(
        db_session,
        budgetid=budget.budgetid,
        balancedesc="Inactive",
        opening_balance=Decimal("500.00"),
        balance_type="Transaction",
        is_primary=False,
    )
    bt.active = False
    db_session.commit()

    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions",
        json={"amount": "100.00", "account_desc": "Inactive"},
    )
    assert response.status_code == 422
    assert "inactive" in response.json()["detail"].lower()


def test_add_investment_transaction_rejects_nonexistent_account(client, db_session):
    setup = _minimum_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions",
        json={"amount": "100.00", "account_desc": "Ghost Account"},
    )
    assert response.status_code == 422
    assert "does not exist" in response.json()["detail"].lower()


def test_add_investment_transaction_allows_debit_account_override(client, db_session):
    setup = _minimum_setup(db_session)
    budget = setup["budget"]
    # Create investment item with no source_account_desc
    inv = setup["investment_item"]
    inv.source_account_desc = None
    db_session.commit()

    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions",
        json={"amount": "100.00"},
    )
    # Without account_desc and no default source_account_desc, the transaction
    # should still succeed — the modal allows selecting the debit account inline.
    assert response.status_code == 201, response.text
    data = response.json()
    assert Decimal(data["amount"]) == Decimal("100.00")


def test_add_investment_transaction_rejects_paid_investment(client, db_session):
    setup = _minimum_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    pi = db_session.get(PeriodInvestment, (period_id, "Emergency Fund"))
    pi.status = "Paid"
    db_session.commit()

    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions",
        json={"amount": "100.00"},
    )
    assert response.status_code == 423
    assert "Paid" in response.json()["detail"]


def test_add_investment_transaction_rejects_closed_cycle(client, db_session):
    setup = _minimum_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1), count=2)
    period_id = periods[0]["finperiodid"]

    # Close the first period
    client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/closeout",
        json={"create_next_cycle": False, "comments": "Closed"},
    )

    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions",
        json={"amount": "100.00"},
    )
    assert response.status_code == 423
    assert "closed" in response.json()["detail"].lower()


def test_delete_investment_transaction_recomputes_actuals(client, db_session):
    setup = _minimum_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    add_response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions",
        json={"amount": "300.00"},
    )
    assert add_response.status_code == 201
    tx_id = add_response.json()["id"]

    delete_response = client.delete(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions/{tx_id}"
    )
    assert delete_response.status_code == 204

    detail = client.get(f"/api/budgets/{budget.budgetid}/periods/{period_id}")
    investment = next(i for i in detail.json()["investments"] if i["investmentdesc"] == "Emergency Fund")
    assert Decimal(investment["actualamount"]) == Decimal("0.00")


def test_delete_investment_transaction_rejects_wrong_source_key(client, db_session):
    setup = _minimum_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    # Add an expense transaction (different source) — Rent already exists from _minimum_setup
    expense_tx = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/expenses/Rent/entries/",
        json={"amount": "100.00"},
    )
    assert expense_tx.status_code == 201
    expense_tx_id = expense_tx.json()["id"]

    # Try to delete it via investment endpoint
    response = client.delete(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions/{expense_tx_id}"
    )
    assert response.status_code == 404


def test_delete_investment_transaction_rejects_closed_cycle(client, db_session):
    setup = _minimum_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1), count=2)
    period_id = periods[0]["finperiodid"]

    add_response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions",
        json={"amount": "100.00"},
    )
    tx_id = add_response.json()["id"]

    client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/closeout",
        json={"create_next_cycle": False, "comments": "Closed"},
    )

    response = client.delete(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions/{tx_id}"
    )
    assert response.status_code == 423


def test_list_transactions_returns_ordered_results(client, db_session):
    setup = _minimum_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    for i, amount in enumerate(["100.00", "200.00", "50.00"]):
        response = client.post(
            f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions",
            json={"amount": amount, "entrydate": f"2026-04-0{i+1}T10:00:00"},
        )
        assert response.status_code == 201

    list_response = client.get(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions"
    )
    assert list_response.status_code == 200
    txs = list_response.json()
    assert len(txs) == 3
    # Should be ordered by entrydate, then id
    amounts = [tx["amount"] for tx in txs]
    assert amounts == ["100.00", "200.00", "50.00"]


def test_add_transaction_with_entrydate(client, db_session):
    setup = _minimum_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    entry_date = datetime(2026, 4, 15, 10, 0, 0, tzinfo=timezone.utc)
    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions",
        json={"amount": "150.00", "entrydate": entry_date.isoformat()},
    )
    assert response.status_code == 201
    assert response.json()["entrydate"] is not None


def test_add_investment_transaction_rejects_malformed_entrydate(client, db_session):
    setup = _minimum_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions",
        json={"amount": "150.00", "entrydate": "not-a-valid-date"},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Add investment to period
# ---------------------------------------------------------------------------


def test_add_investment_to_period_existing_item(client, db_session):
    setup = _minimum_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1), count=1)
    period_id = periods[0]["finperiodid"]

    # Investment exists in setup but not in period (generated before investment created)
    # Actually _minimum_setup creates investment before generating periods, so it IS in the period.
    # Create a new investment item after generation.
    inv = create_investment_item(db_session, budgetid=budget.budgetid, investmentdesc="Holiday Fund")
    inv.source_account_desc = setup["balance_type"].balancedesc
    db_session.commit()

    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/add-investment",
        json={
            "budgetid": budget.budgetid,
            "investmentdesc": "Holiday Fund",
            "budgeted_amount": "300.00",
            "scope": "oneoff",
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["investmentdesc"] == "Holiday Fund"
    assert Decimal(data["budgeted_amount"]) == Decimal("300.00")


def test_add_investment_to_period_rejects_duplicate(client, db_session):
    setup = _minimum_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1), count=1)
    period_id = periods[0]["finperiodid"]

    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/add-investment",
        json={
            "budgetid": budget.budgetid,
            "investmentdesc": "Emergency Fund",
            "budgeted_amount": "100.00",
            "scope": "oneoff",
        },
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"].lower()


def test_add_investment_to_period_computes_opening_from_prior_period(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    bt = create_balance_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent")

    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1), count=3)
    p1_id = periods[0]["finperiodid"]
    p2_id = periods[1]["finperiodid"]
    p3_id = periods[2]["finperiodid"]

    # Create investment after generation so it's NOT auto-populated
    inv = create_investment_item(db_session, budgetid=budget.budgetid, investmentdesc="Holiday Fund")
    inv.source_account_desc = bt.balancedesc
    db_session.commit()

    # Add to period 1 manually and record a transaction
    client.post(
        f"/api/budgets/{budget.budgetid}/periods/{p1_id}/add-investment",
        json={
            "budgetid": budget.budgetid,
            "investmentdesc": "Holiday Fund",
            "budgeted_amount": "100.00",
            "scope": "oneoff",
        },
    )
    client.post(
        f"/api/budgets/{budget.budgetid}/periods/{p1_id}/investments/Holiday%20Fund/transactions",
        json={"amount": "150.00"},
    )

    # Add to period 3 — opening should carry from period 1's closing value
    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{p3_id}/add-investment",
        json={
            "budgetid": budget.budgetid,
            "investmentdesc": "Holiday Fund",
            "budgeted_amount": "100.00",
            "scope": "oneoff",
        },
    )
    assert response.status_code == 201, response.text
    data = response.json()
    # Period 1 initial_value is 250, plus 150 transaction = 400 closing
    assert Decimal(data["opening_value"]) == Decimal("400.00")


def test_add_investment_to_period_future_backfills_unlocked_periods(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    bt = create_balance_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent")

    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1), count=3)
    p1_id = periods[0]["finperiodid"]
    p2_id = periods[1]["finperiodid"]

    # Create an inactive investment item after generation
    inactive_inv = create_investment_item(db_session, budgetid=budget.budgetid, investmentdesc="Car Fund")
    inactive_inv.source_account_desc = bt.balancedesc
    inactive_inv.active = False
    db_session.commit()

    # Add to period 1 with scope=future — should backfill period 2
    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{p1_id}/add-investment",
        json={
            "budgetid": budget.budgetid,
            "investmentdesc": "Car Fund",
            "budgeted_amount": "200.00",
            "scope": "future",
        },
    )
    assert response.status_code == 201, response.text

    # Verify period 2 now has the investment
    detail = client.get(f"/api/budgets/{budget.budgetid}/periods/{p2_id}")
    invs = [i for i in detail.json()["investments"] if i["investmentdesc"] == "Car Fund"]
    assert len(invs) == 1
    assert Decimal(invs[0]["budgeted_amount"]) == Decimal("200.00")


def test_add_investment_transaction_blocked_when_overdraft_disabled(client, db_session):
    budget = create_budget(db_session, allow_overdraft_transactions=False)
    create_income_type(db_session, budgetid=budget.budgetid)
    bt = create_balance_type(db_session, budgetid=budget.budgetid, opening_balance=Decimal("50.00"))
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent")
    investment = create_investment_item(db_session, budgetid=budget.budgetid)
    investment.source_account_desc = bt.balancedesc
    db_session.commit()

    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1), count=1)
    period_id = periods[0]["finperiodid"]

    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions",
        json={"amount": "100.00"},
    )
    assert response.status_code == 422
    assert "sufficient balance" in response.json()["detail"].lower()


def test_add_investment_transaction_allowed_when_overdraft_enabled(client, db_session):
    budget = create_budget(db_session, allow_overdraft_transactions=True)
    create_income_type(db_session, budgetid=budget.budgetid)
    bt = create_balance_type(db_session, budgetid=budget.budgetid, opening_balance=Decimal("50.00"))
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent")
    investment = create_investment_item(db_session, budgetid=budget.budgetid)
    investment.source_account_desc = bt.balancedesc
    db_session.commit()

    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1), count=1)
    period_id = periods[0]["finperiodid"]

    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/investments/Emergency%20Fund/transactions",
        json={"amount": "100.00"},
    )
    assert response.status_code == 201, response.text


# ---------------------------------------------------------------------------
# Same-account validation
# ---------------------------------------------------------------------------


def test_create_investment_rejects_same_debit_and_credit_account(client, db_session):
    budget = create_budget(db_session)
    bt = create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Savings", is_primary=False)

    response = client.post(
        f"/api/budgets/{budget.budgetid}/investment-items/",
        json={
            "investmentdesc": "Emergency Fund",
            "initial_value": "250.00",
            "planned_amount": "50.00",
            "source_account_desc": bt.balancedesc,
            "linked_account_desc": bt.balancedesc,
            "active": True,
            "is_primary": True,
        },
    )
    assert response.status_code == 422
    assert "different accounts" in response.json()["detail"].lower()


def test_update_investment_rejects_same_debit_and_credit_account(client, db_session):
    budget = create_budget(db_session)
    bt = create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Savings", is_primary=False)
    bt2 = create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Checking", is_primary=False)
    inv = create_investment_item(db_session, budgetid=budget.budgetid, investmentdesc="Emergency Fund")
    inv.source_account_desc = bt2.balancedesc
    inv.linked_account_desc = bt.balancedesc
    db_session.commit()

    response = client.patch(
        f"/api/budgets/{budget.budgetid}/investment-items/Emergency%20Fund",
        json={
            "source_account_desc": bt.balancedesc,
            "linked_account_desc": bt.balancedesc,
        },
    )
    assert response.status_code == 422
    assert "different accounts" in response.json()["detail"].lower()


def test_create_investment_allows_different_debit_and_credit_account(client, db_session):
    budget = create_budget(db_session)
    bt1 = create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Checking", is_primary=False)
    bt2 = create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Savings", is_primary=False)

    response = client.post(
        f"/api/budgets/{budget.budgetid}/investment-items/",
        json={
            "investmentdesc": "Emergency Fund",
            "initial_value": "250.00",
            "planned_amount": "50.00",
            "source_account_desc": bt1.balancedesc,
            "linked_account_desc": bt2.balancedesc,
            "active": True,
            "is_primary": True,
        },
    )
    assert response.status_code == 201, response.text


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _minimum_setup(db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    bt = create_balance_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent")
    investment = create_investment_item(db_session, budgetid=budget.budgetid)
    # Link investment to the primary balance account as debit source
    investment.source_account_desc = bt.balancedesc
    db_session.commit()
    return {"budget": budget, "investment_item": investment, "balance_type": bt}
