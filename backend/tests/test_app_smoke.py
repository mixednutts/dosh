from __future__ import annotations

from app.time_utils import utc_now
from app.models import Budget, FinancialPeriod, InvestmentItem, PeriodCloseoutSnapshot, SetupRevisionEvent

from .factories import create_minimum_budget_setup, iso_date


def test_health_endpoint_returns_ok(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "app": "Dosh"}


def test_info_endpoint_returns_app_version(client):
    response = client.get("/api/info")

    assert response.status_code == 200
    assert response.json()["app"] == "Dosh"
    assert response.json()["version"] == "0.6.3-alpha"


def test_release_notes_endpoint_returns_current_release(client, monkeypatch):
    from app import main as app_main

    monkeypatch.setattr(app_main, "release_notes_payload", lambda current_version: {
        "current_version": current_version,
        "update_available": False,
        "newer_release_count": 0,
        "previous_release_count": 0,
        "current_release": {
            "version": current_version,
            "status": "released",
            "release_date": "2026-04-08",
            "summary": "Dosh release test payload",
            "sections": [],
        },
        "newer_releases": [],
        "previous_releases": [],
    })
    response = client.get("/api/release-notes")

    assert response.status_code == 200
    payload = response.json()
    assert payload["current_version"] == "0.6.3-alpha"
    assert payload["update_available"] is False
    assert payload["newer_release_count"] == 0
    assert payload["current_release"]["version"] == "0.6.3-alpha"


def test_generate_period_creates_expected_core_rows(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    startdate = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)

    response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/generate",
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
    detail_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{finperiodid}")
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
    startdate = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)

    response = client.post(
        f"/api/budgets/{budgetid}/periods/generate",
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


def test_localisation_options_are_exposed_before_budget_id_routes(client):
    response = client.get("/api/budgets/localisation-options")

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["locales"] == ["en-AU", "en-US", "en-GB", "en-NZ", "de-DE"]
    assert "AUD" in payload["currencies"]
    assert "Australia/Sydney" in payload["timezones"]
    assert payload["date_formats"] == ["compact", "short", "medium", "long", "numeric", "MM-dd-yy", "MMM-dd-yyyy"]


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
        f"/api/budgets/{budget.budgetid}/income-types/Salary",
        json={"amount": "2600.00"},
    )
    assert revision_response.status_code == 200, revision_response.text

    assert (
        db_session.query(SetupRevisionEvent)
        .filter(SetupRevisionEvent.budgetid == budgetid)
        .count()
    ) == 1

    delete_response = client.delete(f"/api/budgets/{budget.budgetid}")

    assert delete_response.status_code == 204, delete_response.text
    db_session.expire_all()
    assert db_session.get(Budget, budgetid) is None
    assert (
        db_session.query(SetupRevisionEvent)
        .filter(SetupRevisionEvent.budgetid == budgetid)
        .count()
    ) == 0


def test_demo_budget_endpoint_returns_not_found_when_dev_mode_is_disabled(client, monkeypatch):
    monkeypatch.setenv("DEV_MODE", "false")
    response = client.post("/api/budgets/demo")

    assert response.status_code == 404


def test_demo_budget_endpoint_creates_seeded_budget_with_closed_pending_current_and_planned_cycles(client, db_session, monkeypatch):
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
    assert len([period for period in periods if period.cycle_status == "CLOSED"]) == 1
    assert len([period for period in periods if period.cycle_status == "ACTIVE"]) == 3
    assert len([period for period in periods if period.cycle_status == "PLANNED"]) == 3

    snapshots = (
        db_session.query(PeriodCloseoutSnapshot)
        .join(FinancialPeriod, FinancialPeriod.finperiodid == PeriodCloseoutSnapshot.finperiodid)
        .filter(FinancialPeriod.budgetid == budgetid)
        .all()
    )
    assert len(snapshots) == 1
    assert all(snapshot.comments for snapshot in snapshots)
    assert all(snapshot.goals for snapshot in snapshots)

    investment = db_session.get(InvestmentItem, (budgetid, "Emergency Fund"))
    assert investment is not None
    assert investment.linked_account_desc == "Rainy Day Savings"

    detail_response = client.get(f"/api/budgets/{budgetid}/periods/{periods[1].finperiodid}")
    assert detail_response.status_code == 200, detail_response.text
    detail = detail_response.json()
    assert any(income["incomedesc"] == "Carried Forward" for income in detail["incomes"])
    assert any(income["incomedesc"] == "Transfer from Rainy Day Savings" for income in detail["incomes"])
    assert any(balance["balancedesc"] == "Rainy Day Savings" for balance in detail["balances"])
    assert any(investment_row["investmentdesc"] == "Emergency Fund" for investment_row in detail["investments"])

    # Demo budgets now get a seeded health matrix so the health endpoint returns data.
    health_response = client.get(f"/api/budgets/{budgetid}/health")
    assert health_response.status_code == 200, health_response.text
    assert health_response.json()["overall_score"] is not None
