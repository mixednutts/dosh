from __future__ import annotations

from decimal import Decimal

from app.cycle_constants import CARRIED_FORWARD_DESC
from app.models import FinancialPeriod, PeriodCloseoutSnapshot, PeriodIncome
from app.time_utils import app_now_naive

from .factories import create_minimum_budget_setup, generate_periods


def test_closeout_preview_and_closeout_persist_snapshot_and_carry_forward(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=2,
    )
    active_period = next(period for period in periods if period["cycle_status"] == "ACTIVE")
    next_period = next(period for period in periods if period["cycle_status"] == "PLANNED")

    income_response = client.patch(
        f"/api/periods/{active_period['finperiodid']}/income/Salary",
        json={"actualamount": "3000.00"},
    )
    assert income_response.status_code == 200, income_response.text

    expense_response = client.patch(
        f"/api/periods/{active_period['finperiodid']}/expense/Rent",
        json={"actualamount": "1000.00"},
    )
    assert expense_response.status_code == 200, expense_response.text

    investment_tx_response = client.post(
        f"/api/periods/{active_period['finperiodid']}/investments/Emergency%20Fund/transactions/",
        json={"amount": "250.00", "note": "Monthly contribution"},
    )
    assert investment_tx_response.status_code == 201, investment_tx_response.text

    preview_response = client.get(f"/api/periods/{active_period['finperiodid']}/closeout-preview")
    assert preview_response.status_code == 200, preview_response.text
    preview_payload = preview_response.json()
    assert Decimal(preview_payload["carry_forward_amount"]) == Decimal("1750.00")
    assert preview_payload["next_cycle_exists"] is True
    assert preview_payload["period"]["cycle_status"] == "ACTIVE"
    assert Decimal(preview_payload["totals"]["surplus_actual"]) == Decimal("1750.00")
    assert db_session.get(PeriodIncome, (next_period["finperiodid"], CARRIED_FORWARD_DESC)) is None

    closeout_response = client.post(
        f"/api/periods/{active_period['finperiodid']}/closeout",
        json={
            "create_next_cycle": False,
            "comments": "Closed comfortably.",
            "goals": "Keep the saving momentum going.",
        },
    )
    assert closeout_response.status_code == 200, closeout_response.text
    closeout_payload = closeout_response.json()
    assert closeout_payload["period"]["cycle_status"] == "CLOSED"
    assert closeout_payload["period"]["islocked"] is True
    assert closeout_payload["closeout_snapshot"]["comments"] == "Closed comfortably."
    assert closeout_payload["closeout_snapshot"]["goals"] == "Keep the saving momentum going."
    assert Decimal(closeout_payload["closeout_snapshot"]["carry_forward_amount"]) == Decimal("1750.00")
    assert {expense["status"] for expense in closeout_payload["expenses"]} == {"Paid"}
    assert {investment["status"] for investment in closeout_payload["investments"]} == {"Paid"}

    db_session.expire_all()
    refreshed_next_period = db_session.get(FinancialPeriod, next_period["finperiodid"])
    assert refreshed_next_period.cycle_status == "ACTIVE"
    assert refreshed_next_period.islocked is False

    carried_forward = db_session.get(PeriodIncome, (next_period["finperiodid"], CARRIED_FORWARD_DESC))
    assert carried_forward is not None
    assert Decimal(str(carried_forward.budgetamount)) == Decimal("1750.00")
    assert Decimal(str(carried_forward.actualamount)) == Decimal("0.00")
    assert carried_forward.is_system is True
    assert carried_forward.system_key == "carry_forward"

    snapshot = db_session.get(PeriodCloseoutSnapshot, active_period["finperiodid"])
    assert snapshot is not None
    assert Decimal(str(snapshot.carry_forward_amount)) == Decimal("1750.00")


def test_generating_upcoming_cycle_does_not_create_carried_forward_before_closeout(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=2,
    )
    next_period = next(period for period in periods if period["cycle_status"] == "PLANNED")

    carried_forward = db_session.get(PeriodIncome, (next_period["finperiodid"], CARRIED_FORWARD_DESC))
    assert carried_forward is None


def test_closeout_can_create_missing_next_cycle_when_requested(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )
    active_period = periods[0]

    preview_response = client.get(f"/api/periods/{active_period['finperiodid']}/closeout-preview")
    assert preview_response.status_code == 200, preview_response.text
    assert preview_response.json()["next_cycle_exists"] is False

    blocked_closeout = client.post(
        f"/api/periods/{active_period['finperiodid']}/closeout",
        json={"create_next_cycle": False},
    )
    assert blocked_closeout.status_code == 409
    assert "next budget cycle is required" in blocked_closeout.json()["detail"]

    allowed_closeout = client.post(
        f"/api/periods/{active_period['finperiodid']}/closeout",
        json={"create_next_cycle": True, "comments": "Closed early"},
    )
    assert allowed_closeout.status_code == 200, allowed_closeout.text

    periods_after = client.get(f"/api/periods/budget/{budget.budgetid}")
    assert periods_after.status_code == 200
    payload = periods_after.json()
    assert len(payload) == 2
    assert sum(1 for period in payload if period["cycle_status"] == "ACTIVE") == 1
    assert sum(1 for period in payload if period["cycle_status"] == "CLOSED") == 1
