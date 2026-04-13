"""Tests for cycle stage derivation from dates, not just persisted cycle_status."""
from __future__ import annotations

from datetime import timedelta

from app.cycle_constants import CURRENT_STAGE, PLANNED
from app.cycle_management import cycle_stage
from app.models import FinancialPeriod
from app.time_utils import utc_now

from .factories import create_minimum_budget_setup


def test_planned_period_with_past_start_date_derives_as_current(db_session):
    """A period with cycle_status=PLANNED but a past start date should derive as CURRENT."""
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    now = utc_now()

    # Create a period that started yesterday but is marked PLANNED (stale status)
    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=now - timedelta(days=1),
        enddate=now + timedelta(days=10),
        budgetowner=budget.budgetowner,
        islocked=False,
        cycle_status=PLANNED,
    )
    db_session.add(period)
    db_session.commit()
    db_session.refresh(period)

    # The cycle_stage should derive from dates, not the stale PLANNED status
    assert cycle_stage(period) == CURRENT_STAGE


def test_planned_period_with_future_start_date_remains_planned(db_session):
    """A period with cycle_status=PLANNED and a future start date should remain PLANNED."""
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    now = utc_now()

    # Create a period starting tomorrow (truly planned)
    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=now + timedelta(days=1),
        enddate=now + timedelta(days=14),
        budgetowner=budget.budgetowner,
        islocked=False,
        cycle_status=PLANNED,
    )
    db_session.add(period)
    db_session.commit()
    db_session.refresh(period)

    # The cycle_stage should remain PLANNED since it hasn't started yet
    assert cycle_stage(period) == PLANNED
