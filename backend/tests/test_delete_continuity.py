from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from app.cycle_constants import CARRIED_FORWARD_DESC
from app.models import FinancialPeriod, PeriodIncome
from app.transaction_ledger import PeriodTransactionContext, build_budget_adjustment_tx
from app.time_utils import utc_now

from .factories import create_minimum_budget_setup, generate_periods, iso_date


def test_middle_cycle_requires_future_chain_delete(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=3,
    )
    middle_period = periods[1]

    options_response = client.get(f"/api/periods/{middle_period['finperiodid']}/delete-options")
    assert options_response.status_code == 200, options_response.text
    options = options_response.json()
    assert options["can_delete_single"] is False
    assert options["can_delete_future_chain"] is True
    assert options["future_chain_count"] == 2
    assert "all upcoming cycles" in options["delete_reason"]

    single_delete = client.delete(f"/api/periods/{middle_period['finperiodid']}?delete_mode=single")
    assert single_delete.status_code == 409

    chain_delete = client.delete(f"/api/periods/{middle_period['finperiodid']}?delete_mode=future_chain")
    assert chain_delete.status_code == 204

    periods_after = client.get(f"/api/periods/budget/{budget.budgetid}")
    assert periods_after.status_code == 200
    remaining = periods_after.json()
    assert len(remaining) == 1
    assert remaining[0]["cycle_status"] == "ACTIVE"


def test_delete_and_regenerate_trailing_cycle_recomputes_carried_forward(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=2,
    )
    active_period = next(period for period in periods if period["cycle_status"] == "ACTIVE")
    original_next_period = next(period for period in periods if period["cycle_status"] == "PLANNED")

    income_update = client.patch(
        f"/api/periods/{active_period['finperiodid']}/income/Salary",
        json={"actualamount": "2800.00"},
    )
    assert income_update.status_code == 200, income_update.text

    expense_update = client.patch(
        f"/api/periods/{active_period['finperiodid']}/expense/Rent",
        json={"actualamount": "900.00"},
    )
    assert expense_update.status_code == 200, expense_update.text
    investment_tx = client.post(
        f"/api/periods/{active_period['finperiodid']}/investments/Emergency%20Fund/transactions/",
        json={"amount": "300.00", "note": "Top up"},
    )
    assert investment_tx.status_code == 201, investment_tx.text

    closeout = client.post(
        f"/api/periods/{active_period['finperiodid']}/closeout",
        json={"create_next_cycle": False},
    )
    assert closeout.status_code == 200, closeout.text

    original_carried_forward = db_session.get(PeriodIncome, (original_next_period["finperiodid"], CARRIED_FORWARD_DESC))
    assert original_carried_forward is not None
    assert Decimal(str(original_carried_forward.budgetamount)) == Decimal("1600.00")

    delete_response = client.delete(f"/api/periods/{original_next_period['finperiodid']}?delete_mode=single")
    assert delete_response.status_code == 204, delete_response.text
    assert db_session.get(FinancialPeriod, original_next_period["finperiodid"]) is None

    regenerate = client.post(
        "/api/periods/generate",
        json={
            "budgetid": budget.budgetid,
            "startdate": iso_date(
                (
                    db_session.get(FinancialPeriod, active_period["finperiodid"]).enddate + timedelta(days=1)
                ).replace(hour=0, minute=0, second=0, microsecond=0)
            ),
            "count": 1,
        },
    )
    assert regenerate.status_code == 201, regenerate.text

    periods_after = client.get(f"/api/periods/budget/{budget.budgetid}")
    assert periods_after.status_code == 200
    regenerated_period = max(periods_after.json(), key=lambda period: period["finperiodid"])
    assert regenerated_period["cycle_status"] == "PLANNED"

    regenerated_carried_forward = db_session.get(PeriodIncome, (regenerated_period["finperiodid"], CARRIED_FORWARD_DESC))
    assert regenerated_carried_forward is not None
    assert Decimal(str(regenerated_carried_forward.budgetamount)) == Decimal("1600.00")
    assert Decimal(str(regenerated_carried_forward.actualamount)) == Decimal("0.00")


def test_planned_cycle_delete_ignores_budget_adjustment_history(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=3,
    )
    first_planned_period = next(period for period in periods if period["cycle_status"] == "PLANNED")

    build_budget_adjustment_tx(
        db_session,
        PeriodTransactionContext(
            finperiodid=first_planned_period["finperiodid"],
            budgetid=budget.budgetid,
            source="income",
            tx_type="BUDGETADJ",
            source_key="Salary",
            budget_scope="future",
        ),
        note="Planning adjustment only",
        budget_before_amount=Decimal("2500.00"),
        budget_after_amount=Decimal("2600.00"),
    )
    db_session.commit()

    options_response = client.get(f"/api/periods/{first_planned_period['finperiodid']}/delete-options")
    assert options_response.status_code == 200, options_response.text
    options = options_response.json()
    assert options["can_delete_single"] is False
    assert options["can_delete_future_chain"] is True

    chain_delete = client.delete(f"/api/periods/{first_planned_period['finperiodid']}?delete_mode=future_chain")
    assert chain_delete.status_code == 204, chain_delete.text
