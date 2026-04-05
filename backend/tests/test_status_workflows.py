from __future__ import annotations

from app.time_utils import app_now_naive

from .factories import create_minimum_budget_setup, generate_periods


def test_paid_expense_requires_revision_before_more_changes(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    mark_paid = client.patch(
        f"/api/periods/{active_period['finperiodid']}/expense/Rent/status",
        json={"status": "Paid"},
    )
    assert mark_paid.status_code == 200, mark_paid.text
    assert mark_paid.json()["status"] == "Paid"

    budget_edit = client.patch(
        f"/api/periods/{active_period['finperiodid']}/expense/Rent/budget",
        json={"budgetamount": "1300.00", "scope": "current", "note": "Increase current period budget"},
    )
    assert budget_edit.status_code == 423

    add_entry = client.post(
        f"/api/periods/{active_period['finperiodid']}/expenses/Rent/entries/",
        json={"amount": "50.00", "note": "Late fee"},
    )
    assert add_entry.status_code == 423

    revise = client.patch(
        f"/api/periods/{active_period['finperiodid']}/expense/Rent/status",
        json={"status": "Revised"},
    )
    assert revise.status_code == 200, revise.text

    updated_budget = client.patch(
        f"/api/periods/{active_period['finperiodid']}/expense/Rent/budget",
        json={"budgetamount": "1300.00", "scope": "current", "note": "Increase current period budget"},
    )
    assert updated_budget.status_code == 200, updated_budget.text
    assert updated_budget.json()["status"] == "Revised"


def test_paid_investment_requires_revision_before_more_changes(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    mark_paid = client.patch(
        f"/api/periods/{active_period['finperiodid']}/investment/Emergency%20Fund/status",
        json={"status": "Paid"},
    )
    assert mark_paid.status_code == 200, mark_paid.text
    assert mark_paid.json()["status"] == "Paid"

    budget_edit = client.patch(
        f"/api/periods/{active_period['finperiodid']}/investment/Emergency%20Fund/budget",
        json={"budgetamount": "250.00", "scope": "current", "note": "Increase current period contribution"},
    )
    assert budget_edit.status_code == 423

    add_transaction = client.post(
        f"/api/periods/{active_period['finperiodid']}/investments/Emergency%20Fund/transactions/",
        json={"amount": "25.00", "note": "Extra contribution"},
    )
    assert add_transaction.status_code == 423

    revise = client.patch(
        f"/api/periods/{active_period['finperiodid']}/investment/Emergency%20Fund/status",
        json={"status": "Revised"},
    )
    assert revise.status_code == 200, revise.text

    updated_budget = client.patch(
        f"/api/periods/{active_period['finperiodid']}/investment/Emergency%20Fund/budget",
        json={"budgetamount": "250.00", "scope": "current", "note": "Increase current period contribution"},
    )
    assert updated_budget.status_code == 200, updated_budget.text
    assert updated_budget.json()["status"] == "Revised"
