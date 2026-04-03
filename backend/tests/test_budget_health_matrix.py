from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from app.budget_health import build_budget_health_payload
from app.models import Budget, FinancialPeriod, PeriodExpense, PeriodIncome
from app.time_utils import app_now_naive

from .factories import create_budget, create_expense_item, create_income_type


def _seed_historical_period(
    db_session,
    *,
    budget: Budget,
    startdate,
    enddate,
    income_amount: str,
    expense_budget: str,
    expense_actual: str,
):
    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=startdate,
        enddate=enddate,
        budgetowner=budget.budgetowner,
        islocked=True,
        cycle_status="CLOSED",
    )
    db_session.add(period)
    db_session.flush()

    db_session.add(
        PeriodIncome(
            finperiodid=period.finperiodid,
            budgetid=budget.budgetid,
            incomedesc="Salary",
            budgetamount=Decimal(income_amount),
            actualamount=Decimal(income_amount),
            varianceamount=Decimal("0.00"),
        )
    )
    db_session.add(
        PeriodExpense(
            finperiodid=period.finperiodid,
            budgetid=budget.budgetid,
            expensedesc="Rent",
            budgetamount=Decimal(expense_budget),
            actualamount=Decimal(expense_actual),
            varianceamount=Decimal(expense_actual) - Decimal(expense_budget),
            is_oneoff=False,
            sort_order=0,
            revision_snapshot=0,
            status="Paid",
        )
    )
    db_session.commit()
    return period


def test_budget_health_uses_tighter_of_percent_and_dollar_deficit_thresholds(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid, amount=Decimal("1000.00"))
    create_expense_item(db_session, budgetid=budget.budgetid, expenseamount=Decimal("1050.00"))

    active_period = client.post(
        "/api/periods/generate",
        json={
            "budgetid": budget.budgetid,
            "startdate": app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0).isoformat(),
            "count": 1,
        },
    )
    assert active_period.status_code == 201, active_period.text

    baseline_health = client.get(f"/api/budgets/{budget.budgetid}/health")
    assert baseline_health.status_code == 200, baseline_health.text
    baseline_payload = baseline_health.json()
    baseline_current = baseline_payload["current_period_check"]
    assert baseline_current["summary"].startswith("This period has moved into deficit")
    baseline_detail = next(
        evidence["detail"]
        for evidence in baseline_current["evidence"]
        if evidence["label"] == "Surplus (Budget)"
    )
    assert "Effective deficit limit: -50.00." in baseline_detail

    tighter_threshold = client.patch(
        f"/api/budgets/{budget.budgetid}",
        json={"maximum_deficit_amount": "10.00"},
    )
    assert tighter_threshold.status_code == 200, tighter_threshold.text

    tighter_health = client.get(f"/api/budgets/{budget.budgetid}/health")
    assert tighter_health.status_code == 200, tighter_health.text
    tighter_payload = tighter_health.json()
    tighter_current = tighter_payload["current_period_check"]
    assert tighter_current["summary"].startswith("This period is currently planning to spend more than it brings in")
    tighter_detail = next(
        evidence["detail"]
        for evidence in tighter_current["evidence"]
        if evidence["label"] == "Surplus (Budget)"
    )
    assert "and $10.00." in tighter_detail
    assert "Effective deficit limit: -10.00." in tighter_detail
    assert tighter_current["score"] < baseline_current["score"]


def test_budget_health_momentum_improves_when_recent_closed_periods_overspend_less(db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)
    now = app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0)

    _seed_historical_period(
        db_session,
        budget=budget,
        startdate=now - timedelta(days=120),
        enddate=now - timedelta(days=91),
        income_amount="1000.00",
        expense_budget="800.00",
        expense_actual="1000.00",
    )
    _seed_historical_period(
        db_session,
        budget=budget,
        startdate=now - timedelta(days=90),
        enddate=now - timedelta(days=61),
        income_amount="1000.00",
        expense_budget="800.00",
        expense_actual="960.00",
    )
    _seed_historical_period(
        db_session,
        budget=budget,
        startdate=now - timedelta(days=60),
        enddate=now - timedelta(days=31),
        income_amount="1000.00",
        expense_budget="800.00",
        expense_actual="840.00",
    )
    _seed_historical_period(
        db_session,
        budget=budget,
        startdate=now - timedelta(days=30),
        enddate=now - timedelta(days=1),
        income_amount="1000.00",
        expense_budget="800.00",
        expense_actual="800.00",
    )

    payload = build_budget_health_payload(db_session, budget.budgetid)
    assert payload is not None
    assert payload["momentum_status"] == "Improving"
    assert payload["momentum_delta"] > 0
    assert "overspending less" in payload["momentum_summary"]

