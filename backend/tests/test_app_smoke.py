from __future__ import annotations

from app.time_utils import app_now_naive
from app.models import Budget, FinancialPeriod, InvestmentItem, PeriodCloseoutSnapshot, SetupRevisionEvent

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
    assert "income source" in response.json()["detail"]


def test_budget_account_naming_preference_can_be_saved(client):
    create_budget_response = client.post(
        "/api/budgets/",
        json={
            "budgetowner": "Naming User",
            "description": "Naming Budget",
            "budget_frequency": "Monthly",
        },
    )
    budgetid = create_budget_response.json()["budgetid"]

    response = client.patch(
        f"/api/budgets/{budgetid}",
        json={"account_naming_preference": "Checking"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["account_naming_preference"] == "Checking"


def test_budget_can_be_created_with_a_custom_day_cycle(client):
    response = client.post(
        "/api/budgets/",
        json={
            "budgetowner": "Cadence User",
            "description": "Ten Day Budget",
            "budget_frequency": "Every 10 Days",
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["budget_frequency"] == "Every 10 Days"


def test_budget_can_be_deleted_after_setup_revision_history_exists(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    budgetid = budget.budgetid

    revision_response = client.patch(
        f"/api/budgets/{budgetid}/income-types/Salary",
        json={"amount": "2600.00"},
    )
    assert revision_response.status_code == 200, revision_response.text

    assert (
        db_session.query(SetupRevisionEvent)
        .filter(SetupRevisionEvent.budgetid == budgetid)
        .count()
    ) == 1

    delete_response = client.delete(f"/api/budgets/{budgetid}")

    assert delete_response.status_code == 204, delete_response.text
    db_session.expire_all()
    assert db_session.get(Budget, budgetid) is None
    assert (
        db_session.query(SetupRevisionEvent)
        .filter(SetupRevisionEvent.budgetid == budgetid)
        .count()
    ) == 0


def test_demo_budget_endpoint_returns_not_found_when_dev_mode_is_disabled(client):
    response = client.post("/api/budgets/demo")

    assert response.status_code == 404


def test_demo_budget_endpoint_creates_seeded_budget_with_history_current_and_upcoming(client, db_session, monkeypatch):
    monkeypatch.setenv("DEV_MODE", "true")
    response = client.post("/api/budgets/demo")

    assert response.status_code == 201, response.text
    payload = response.json()
    budgetid = payload["budgetid"]

    periods = (
        db_session.query(FinancialPeriod)
        .filter(FinancialPeriod.budgetid == budgetid)
        .order_by(FinancialPeriod.startdate)
        .all()
    )
    assert len(periods) == 7
    assert len([period for period in periods if period.cycle_status == "CLOSED"]) == 3
    assert len([period for period in periods if period.cycle_status == "ACTIVE"]) == 1
    assert len([period for period in periods if period.cycle_status == "PLANNED"]) == 3

    snapshots = (
        db_session.query(PeriodCloseoutSnapshot)
        .join(FinancialPeriod, FinancialPeriod.finperiodid == PeriodCloseoutSnapshot.finperiodid)
        .filter(FinancialPeriod.budgetid == budgetid)
        .all()
    )
    assert len(snapshots) == 3
    assert all(snapshot.comments for snapshot in snapshots)
    assert all(snapshot.goals for snapshot in snapshots)

    investment = db_session.get(InvestmentItem, (budgetid, "Emergency Fund"))
    assert investment is not None
    assert investment.linked_account_desc == "Rainy Day Savings"

    detail_response = client.get(f"/api/periods/{periods[3].finperiodid}")
    assert detail_response.status_code == 200, detail_response.text
    detail = detail_response.json()
    assert any(income["incomedesc"] == "Carried Forward" for income in detail["incomes"])
    assert any(balance["balancedesc"] == "Rainy Day Savings" for balance in detail["balances"])
    assert any(investment_row["investmentdesc"] == "Emergency Fund" for investment_row in detail["investments"])

    health_response = client.get(f"/api/budgets/{budgetid}/health")
    assert health_response.status_code == 200, health_response.text
    health = health_response.json()
    assert health["current_period_check"]["status"] in {"Watch", "Needs Attention"}
    assert health["current_period_check"]["score"] < 80
    assert health["momentum_status"] in {"Improving", "Stable", "Declining"}
    assert any(
        item["label"] == "Pressure signals" and item["value"] != "None"
        for item in health["current_period_check"]["evidence"]
    )
    planning_stability = next(pillar for pillar in health["pillars"] if pillar["key"] == "planning_stability")
    assert planning_stability["score"] < 100
