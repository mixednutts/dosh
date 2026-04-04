from __future__ import annotations

from app.time_utils import app_now_naive

from .factories import create_minimum_budget_setup, iso_date


def test_health_endpoint_returns_ok(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "app": "Dosh"}


def test_generate_period_creates_expected_core_rows(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    startdate = app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0)

    response = client.post(
        "/api/periods/generate",
        json={
            "budgetid": budget.budgetid,
            "startdate": iso_date(startdate),
            "count": 1,
        },
    )

    assert response.status_code == 201
    payload = response.json()
    assert payload["budgetid"] == budget.budgetid
    assert payload["cycle_status"] in {"PLANNED", "ACTIVE", "CLOSED"}

    finperiodid = payload["finperiodid"]
    detail_response = client.get(f"/api/periods/{finperiodid}")
    assert detail_response.status_code == 200, detail_response.text
    detail_payload = detail_response.json()
    assert detail_payload["period"]["finperiodid"] == finperiodid
    assert detail_payload["period"]["budgetid"] == budget.budgetid


def test_generate_period_requires_income_and_expense_prerequisites(client):
    create_budget_response = client.post(
        "/api/budgets/",
        json={
            "budgetowner": "Prereq User",
            "description": "Missing setup",
            "budget_frequency": "Monthly",
        },
    )
    budgetid = create_budget_response.json()["budgetid"]
    startdate = app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0)

    response = client.post(
        "/api/periods/generate",
        json={
            "budgetid": budgetid,
            "startdate": iso_date(startdate),
            "count": 1,
        },
    )

    assert response.status_code == 422
    assert "income type" in response.json()["detail"]
