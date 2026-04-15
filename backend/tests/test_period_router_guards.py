from __future__ import annotations

from app.cycle_constants import CARRIED_FORWARD_DESC
from app.time_utils import utc_now

from .factories import create_minimum_budget_setup, generate_periods


def test_cannot_remove_system_managed_carried_forward_income(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=2,
    )
    active_period = next(period for period in periods if period["cycle_status"] == "ACTIVE")
    next_period = next(period for period in periods if period["cycle_status"] == "PLANNED")

    closeout = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/closeout",
        json={"create_next_cycle": False, "comments": "Close and carry forward"},
    )
    assert closeout.status_code == 200, closeout.text

    response = client.delete(
        f"/api/budgets/{budget.budgetid}/periods/{next_period['finperiodid']}/income/{CARRIED_FORWARD_DESC.replace(' ', '%20')}"
    )

    assert response.status_code == 409
    assert "carried forward income cannot be removed" in response.json()["detail"].lower()


def test_cannot_remove_income_line_with_recorded_transactions(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    add_transaction = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/income/Salary/transactions/",
        json={"amount": "125.00", "note": "Recorded payment"},
    )
    assert add_transaction.status_code == 201, add_transaction.text

    remove_response = client.delete(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/income/Salary")

    assert remove_response.status_code == 409
    assert "cannot remove income with recorded transactions" in remove_response.json()["detail"].lower()


def test_cannot_remove_expense_line_with_recorded_actuals(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    add_actual = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/expenses/Rent/entries/",
        json={"amount": "40.00", "note": "Partial payment"},
    )
    assert add_actual.status_code == 201, add_actual.text

    remove_response = client.delete(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/expense/Rent")

    assert remove_response.status_code == 409
    assert "cannot remove expense with recorded actuals" in remove_response.json()["detail"].lower()


def test_expense_and_investment_status_routes_reject_invalid_transitions(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    invalid_expense_status = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/expense/Rent/status",
        json={"status": "Done"},
    )
    assert invalid_expense_status.status_code == 422
    assert "status must be one of" in invalid_expense_status.json()["detail"]

    revise_unpaid_expense = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/expense/Rent/status",
        json={"status": "Revised"},
    )
    assert revise_unpaid_expense.status_code == 409
    assert "only paid expenses can be revised" in revise_unpaid_expense.json()["detail"].lower()

    invalid_investment_status = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/investment/Emergency%20Fund/status",
        json={"status": "Done"},
    )
    assert invalid_investment_status.status_code == 422
    assert "status must be one of" in invalid_investment_status.json()["detail"]

    revise_unpaid_investment = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/investment/Emergency%20Fund/status",
        json={"status": "Revised"},
    )
    assert revise_unpaid_investment.status_code == 409
    assert "only paid investments can be revised" in revise_unpaid_investment.json()["detail"].lower()
