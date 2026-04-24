"""Tests for the /budgets/{id}/periods/current shortcut endpoint."""
from __future__ import annotations

from datetime import timedelta

from app.cycle_constants import CLOSED, PLANNED
from app.models import FinancialPeriod
from app.time_utils import utc_now

from .factories import create_minimum_budget_setup, generate_periods


def test_current_period_endpoint_returns_current_period_detail(client, db_session):
    """The /current endpoint should return the detail for the current period."""
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    now = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=now, count=2)
    current_period = next(p for p in periods if p["cycle_status"] == "ACTIVE")

    response = client.get(f"/api/budgets/{budget.budgetid}/periods/current")
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["period"]["finperiodid"] == current_period["finperiodid"]
    assert "incomes" in data
    assert "expenses" in data
    assert "balances" in data


def test_current_period_endpoint_404_when_no_current_period(client, db_session):
    """The /current endpoint should 404 when there is no current period."""
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    # Create a single future period
    future = now = utc_now().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=30)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=future, count=1)
    # Close it so nothing is current
    period = db_session.get(FinancialPeriod, periods[0]["finperiodid"])
    period.cycle_status = CLOSED
    period.closed_at = utc_now()
    db_session.commit()

    response = client.get(f"/api/budgets/{budget.budgetid}/periods/current")
    assert response.status_code == 404
    assert "no current period" in response.json()["detail"].lower()


def test_current_period_endpoint_404_for_missing_budget(client):
    """The /current endpoint should 404 when the budget does not exist."""
    response = client.get("/api/budgets/99999/periods/current")
    assert response.status_code == 404
    assert "budget not found" in response.json()["detail"].lower()


def test_current_period_endpoint_prefers_earliest_current(client, db_session):
    """When multiple periods derive as CURRENT, the earliest one is returned."""
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    now = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    # Generate two monthly periods starting now
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=now, count=2)
    # Force both to ACTIVE so both derive as CURRENT
    for p in periods:
        period = db_session.get(FinancialPeriod, p["finperiodid"])
        period.cycle_status = "ACTIVE"
        period.closed_at = None
    db_session.commit()

    response = client.get(f"/api/budgets/{budget.budgetid}/periods/current")
    assert response.status_code == 200, response.text
    data = response.json()
    # Should return the earliest (lowest finperiodid)
    assert data["period"]["finperiodid"] == min(p["finperiodid"] for p in periods)
