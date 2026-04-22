from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
import json

from app.cycle_management import assign_period_lifecycle_states
from app.models import FinancialPeriod
from app.time_utils import utc_now

from .factories import create_minimum_budget_setup, generate_periods, local_midnight_utc


def test_trailing_active_cycle_with_recorded_activity_cannot_be_deleted(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]

    expense_entry = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/expenses/Rent/entries/",
        json={"amount": "25.00", "note": "Recorded spend"},
    )
    assert expense_entry.status_code == 201, expense_entry.text

    options_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/delete-options")
    assert options_response.status_code == 200, options_response.text
    options = options_response.json()
    assert options["can_delete_single"] is False
    assert options["can_delete_future_chain"] is False
    assert "actuals or transactions cannot be deleted" in options["delete_reason"].lower()

    delete_response = client.delete(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}?delete_mode=single")
    assert delete_response.status_code == 409


def test_assign_period_lifecycle_states_normalizes_multiple_active_periods(db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    now = local_midnight_utc(utc_now())

    first = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=now - timedelta(days=3),
        enddate=now + timedelta(days=3),
        budgetowner=budget.budgetowner,
        islocked=False,
        cycle_status="ACTIVE",
    )
    second = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=now - timedelta(days=2),
        enddate=now + timedelta(days=4),
        budgetowner=budget.budgetowner,
        islocked=False,
        cycle_status="ACTIVE",
    )
    third = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=now + timedelta(days=5),
        enddate=now + timedelta(days=12),
        budgetowner=budget.budgetowner,
        islocked=False,
        cycle_status="ACTIVE",
    )
    db_session.add_all([first, second, third])
    db_session.commit()

    assign_period_lifecycle_states(budget.budgetid, db_session)
    db_session.commit()
    db_session.refresh(first)
    db_session.refresh(second)
    db_session.refresh(third)

    statuses = [first.cycle_status, second.cycle_status, third.cycle_status]
    assert statuses.count("ACTIVE") == 2
    assert first.cycle_status == "ACTIVE"
    assert second.cycle_status == "ACTIVE"
    assert third.cycle_status == "PLANNED"


def test_closeout_health_snapshot_stays_historical_after_budget_preference_changes(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=2,
    )
    active_period = next(period for period in periods if period["cycle_status"] == "ACTIVE")

    # Create a small deficit (income 2500, expense 2600) so the score is sensitive
    # to the maximum-deficit threshold.
    expense_budget_update = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/expense/Rent/budget",
        json={"budgetamount": "2600.00", "scope": "current", "note": "Test adjustment"},
    )
    assert expense_budget_update.status_code == 200, expense_budget_update.text

    preview = client.get(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/closeout-preview")
    assert preview.status_code == 200, preview.text
    preview_health = preview.json()["health"]

    closeout = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/closeout",
        json={"create_next_cycle": False, "comments": "Snapshot this view"},
    )
    assert closeout.status_code == 200, closeout.text
    closeout_payload = closeout.json()
    stored_snapshot = json.loads(closeout_payload["closeout_snapshot"]["health_snapshot_json"])
    assert stored_snapshot == preview_health

    # After simplification, every budget gets a default health matrix with two
    # system metrics, so the live health endpoint should return a valid result.
    health_response = client.get(f"/api/budgets/{budget.budgetid}/health")
    assert health_response.status_code == 200, health_response.text
    health_payload = health_response.json()
    assert "overall_score" in health_payload
    assert "overall_status" in health_payload
    assert "pillars" in health_payload

    period_detail = client.get(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}")
    assert period_detail.status_code == 200, period_detail.text
    historical_snapshot = json.loads(period_detail.json()["closeout_snapshot"]["health_snapshot_json"])
    assert historical_snapshot == stored_snapshot


def test_expired_open_cycle_is_reported_as_pending_closure_and_can_still_be_closed(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    past_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=40)

    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=past_start,
        count=2,
    )
    pending_period = next(period for period in periods if period["cycle_stage"] == "PENDING_CLOSURE")
    next_period = next(
        period
        for period in periods
        if period["finperiodid"] != pending_period["finperiodid"] and period["startdate"] > pending_period["startdate"]
    )

    assert pending_period["cycle_status"] == "ACTIVE"
    assert pending_period["closed_at"] is None

    summaries_response = client.get(f"/api/budgets/{budget.budgetid}/periods/summary")
    assert summaries_response.status_code == 200, summaries_response.text
    summaries = summaries_response.json()
    pending_summary = next(summary for summary in summaries if summary["period"]["finperiodid"] == pending_period["finperiodid"])
    assert pending_summary["period_status"] == "Pending Closure"

    preview_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{pending_period['finperiodid']}/closeout-preview")
    assert preview_response.status_code == 200, preview_response.text

    closeout_response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{pending_period['finperiodid']}/closeout",
        json={"create_next_cycle": False, "comments": "Closed after cycle end"},
    )
    assert closeout_response.status_code == 200, closeout_response.text
    payload = closeout_response.json()
    assert payload["period"]["cycle_stage"] == "CLOSED"

    periods_after = client.get(f"/api/budgets/{budget.budgetid}/periods")
    assert periods_after.status_code == 200, periods_after.text
    refreshed = periods_after.json()
    activated_next = next(period for period in refreshed if period["finperiodid"] == next_period["finperiodid"])
    assert activated_next["cycle_status"] == "ACTIVE"


def test_multiple_overdue_open_cycles_can_all_present_as_pending_closure(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    far_past_start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=120)

    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=far_past_start,
        count=3,
    )

    pending_periods = [period for period in periods if period["cycle_stage"] == "PENDING_CLOSURE"]
    planned_periods = [period for period in periods if period["cycle_stage"] == "PLANNED"]

    assert len(pending_periods) == 3
    assert len(planned_periods) == 0
    assert all(period["cycle_status"] == "ACTIVE" for period in pending_periods)
