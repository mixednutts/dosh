from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.time_utils import utc_now
from app.models import Budget, FinancialPeriod

from .factories import create_budget, create_expense_item, create_income_type, create_balance_type, create_investment_item, create_minimum_budget_setup, iso_date, generate_periods


def test_report_budget_summary_returns_404_for_missing_budget(client):
    response = client.get("/api/reports/budgets/99999/summary")
    assert response.status_code == 404


def test_report_budget_summary_returns_empty_budget(client, db_session):
    budget = create_budget(db_session)
    response = client.get(f"/api/reports/budgets/{budget.budgetid}/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["budget"]["budgetid"] == budget.budgetid
    assert data["period_count"] == 0
    assert data["date_range"] is None


def test_report_budget_summary_returns_date_range(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=3)

    response = client.get(f"/api/reports/budgets/{budget.budgetid}/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["period_count"] == 3
    assert data["date_range"]["start"] is not None
    assert data["date_range"]["end"] is not None


def test_budget_vs_actual_trends_404_for_missing_budget(client):
    response = client.get("/api/reports/budgets/99999/trends/budget-vs-actual")
    assert response.status_code == 404


def test_budget_vs_actual_trends_empty_budget(client, db_session):
    budget = create_budget(db_session)
    response = client.get(f"/api/reports/budgets/{budget.budgetid}/trends/budget-vs-actual")
    assert response.status_code == 200
    data = response.json()
    assert data["periods"] == []


def test_budget_vs_actual_trends_default_last_12_months(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=400)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=15)

    response = client.get(f"/api/reports/budgets/{budget.budgetid}/trends/budget-vs-actual")
    assert response.status_code == 200
    data = response.json()
    # Default 12-month window from latest non-planned period should filter some out
    assert len(data["periods"]) < 15
    assert len(data["periods"]) >= 1


def test_budget_vs_actual_trends_custom_date_range(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=120)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=5)

    # Pick a range that covers non-planned periods but excludes the earliest ones
    from_date = (start + timedelta(days=30)).date().isoformat()
    to_date = (start + timedelta(days=90)).date().isoformat()

    response = client.get(
        f"/api/reports/budgets/{budget.budgetid}/trends/budget-vs-actual",
        params={"from_date": from_date, "to_date": to_date},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["periods"]) >= 1


def test_budget_vs_actual_trends_returns_correct_totals(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=1)

    response = client.get(f"/api/reports/budgets/{budget.budgetid}/trends/budget-vs-actual")
    assert response.status_code == 200
    data = response.json()
    assert len(data["periods"]) == 1
    period = data["periods"][0]
    assert period["income_budget"] == "2500.00"
    assert period["expense_budget"] == "1200.00"
    assert Decimal(period["investment_budget"]) == Decimal("0")
    assert "surplus_budget" not in period
    assert "surplus_actual" not in period
    assert "label" in period


def test_budget_vs_actual_trends_excludes_planned_periods(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    # Generate 3 periods; the last one will be planned (future)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=3)

    response = client.get(
        f"/api/reports/budgets/{budget.budgetid}/trends/budget-vs-actual",
        params={"from_date": "1900-01-01", "to_date": "2100-12-31"},
    )
    assert response.status_code == 200
    data = response.json()
    # Only current + historical periods, no planned
    returned_ids = {p["finperiodid"] for p in data["periods"]}
    planned_ids = {p["finperiodid"] for p in periods if p["cycle_stage"] == "PLANNED"}
    assert not returned_ids & planned_ids


def test_budget_vs_actual_trends_all_time_filter(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=400)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=15)

    response = client.get(
        f"/api/reports/budgets/{budget.budgetid}/trends/budget-vs-actual",
        params={"from_date": "1900-01-01", "to_date": "2100-12-31"},
    )
    assert response.status_code == 200
    data = response.json()
    # Should return all non-planned periods
    planned_count = sum(1 for p in periods if p["cycle_stage"] == "PLANNED")
    assert len(data["periods"]) == len(periods) - planned_count
