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


# ── Income Allocation Trends ──────────────────────────────────────────────────


def test_income_allocation_trends_404_for_missing_budget(client):
    response = client.get("/api/reports/budgets/99999/trends/income-allocation")
    assert response.status_code == 404


def test_income_allocation_trends_empty_budget(client, db_session):
    budget = create_budget(db_session)
    response = client.get(f"/api/reports/budgets/{budget.budgetid}/trends/income-allocation")
    assert response.status_code == 200
    data = response.json()
    assert data["periods"] == []


def test_income_allocation_trends_returns_correct_totals(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=1)

    response = client.get(f"/api/reports/budgets/{budget.budgetid}/trends/income-allocation")
    assert response.status_code == 200
    data = response.json()
    assert len(data["periods"]) == 1
    period = data["periods"][0]
    assert period["income_budget"] == "2500.00"
    assert Decimal(period["income_actual"]) == Decimal("0")
    assert period["expense_budget"] == "1200.00"
    assert Decimal(period["expense_actual"]) == Decimal("0")
    assert Decimal(period["investment_budget"]) == Decimal("0")
    assert Decimal(period["investment_actual"]) == Decimal("0")
    assert "surplus_budget" in period
    assert "surplus_actual" in period
    assert "label" in period


def test_income_allocation_trends_excludes_planned_periods(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=3)

    response = client.get(
        f"/api/reports/budgets/{budget.budgetid}/trends/income-allocation",
        params={"from_date": "1900-01-01", "to_date": "2100-12-31"},
    )
    assert response.status_code == 200
    data = response.json()
    returned_ids = {p["finperiodid"] for p in data["periods"]}
    planned_ids = {p["finperiodid"] for p in periods if p["cycle_stage"] == "PLANNED"}
    assert not returned_ids & planned_ids


def test_income_allocation_trends_custom_date_range(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=120)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=5)

    from_date = (start + timedelta(days=30)).date().isoformat()
    to_date = (start + timedelta(days=90)).date().isoformat()

    response = client.get(
        f"/api/reports/budgets/{budget.budgetid}/trends/income-allocation",
        params={"from_date": from_date, "to_date": to_date},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["periods"]) >= 1


# ── Investment Trends ─────────────────────────────────────────────────────────


def test_investment_trends_404_for_missing_budget(client):
    response = client.get("/api/reports/budgets/99999/trends/investment-trends")
    assert response.status_code == 404


def test_investment_trends_empty_budget(client, db_session):
    budget = create_budget(db_session)
    response = client.get(f"/api/reports/budgets/{budget.budgetid}/trends/investment-trends")
    assert response.status_code == 200
    data = response.json()
    assert data["periods"] == []


def test_investment_trends_returns_correct_totals(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=1)

    response = client.get(f"/api/reports/budgets/{budget.budgetid}/trends/investment-trends")
    assert response.status_code == 200
    data = response.json()
    assert len(data["periods"]) == 1
    period = data["periods"][0]
    assert "cumulative_contributed" in period
    assert "cumulative_projected" in period
    assert "investment_budget" not in period
    assert "investment_actual" not in period
    assert "opening_value" not in period
    assert "closing_value" not in period
    assert "label" in period


def test_investment_trends_includes_planned_periods(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=3)

    response = client.get(f"/api/reports/budgets/{budget.budgetid}/trends/investment-trends")
    assert response.status_code == 200
    data = response.json()
    # Should include all periods including planned
    assert len(data["periods"]) == len(periods)
    planned_in_response = [p for p in data["periods"] if p["cycle_stage"] == "PLANNED"]
    assert len(planned_in_response) >= 1
    # Planned periods should have null contributed
    for p in planned_in_response:
        assert p["cumulative_contributed"] is None


def test_investment_trends_cumulative_non_decreasing(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=120)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=5)

    response = client.get(f"/api/reports/budgets/{budget.budgetid}/trends/investment-trends")
    assert response.status_code == 200
    data = response.json()
    assert len(data["periods"]) >= 1
    contributed = [Decimal(p["cumulative_contributed"]) for p in data["periods"] if p["cumulative_contributed"] is not None]
    projected = [Decimal(p["cumulative_projected"]) for p in data["periods"]]
    for i in range(1, len(contributed)):
        assert contributed[i] >= contributed[i - 1]
    for i in range(1, len(projected)):
        assert projected[i] >= projected[i - 1]


def test_investment_trends_projected_exceeds_contributed_for_planned(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=start, count=3)

    response = client.get(f"/api/reports/budgets/{budget.budgetid}/trends/investment-trends")
    assert response.status_code == 200
    data = response.json()
    # For planned periods, contributed should be null while projected grows
    planned_periods = [p for p in data["periods"] if p["cycle_stage"] == "PLANNED"]
    if planned_periods:
        for p in planned_periods:
            assert p["cumulative_contributed"] is None
            assert Decimal(p["cumulative_projected"]) >= Decimal("0")


# ── Health History ────────────────────────────────────────────────────────────

def test_health_history_404_for_missing_budget(client):
    response = client.get("/api/reports/budgets/99999/trends/health-history")
    assert response.status_code == 404


def test_health_history_empty_budget(client, db_session):
    from tests.factories import create_budget
    budget = create_budget(db_session)
    response = client.get(f"/api/reports/budgets/{budget.budgetid}/trends/health-history")
    assert response.status_code == 200
    data = response.json()
    assert data["periods"] == []
    assert data["metrics"] == []


def test_health_history_no_snapshots_returns_empty_metrics(client, db_session):
    from tests.factories import create_minimum_budget_setup, generate_periods
    from app.time_utils import utc_now

    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    start = utc_now().replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=30)
    generate_periods(client, budgetid=budget.budgetid, startdate=start, count=2)

    response = client.get(f"/api/reports/budgets/{budget.budgetid}/trends/health-history")
    assert response.status_code == 200
    data = response.json()
    # Periods exist but no snapshots, so metrics are empty and scores absent
    assert len(data["periods"]) >= 1
    assert data["metrics"] == []


def test_health_history_returns_snapshots(client, db_session):
    from tests.factories import create_budget
    from app.models import FinancialPeriod, PeriodHealthResult, BudgetHealthMatrix
    from app.cycle_constants import CLOSED

    budget = create_budget(db_session)
    db_session.commit()

    now = datetime.now(timezone.utc)
    for i in range(2):
        period = FinancialPeriod(
            budgetid=budget.budgetid,
            startdate=now - timedelta(days=30 * (i + 2)),
            enddate=now - timedelta(days=30 * (i + 1)),
            cycle_status=CLOSED,
            islocked=True,
        )
        db_session.add(period)
        db_session.flush()

        matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
        db_session.add(PeriodHealthResult(
            finperiodid=period.finperiodid,
            matrix_id=matrix.matrix_id,
            metric_key="budget_vs_actual_amount",
            score=60 + i * 10,
            status="Watch",
            summary="Test",
            evidence_json="[]",
            is_snapshot=True,
        ))
        db_session.add(PeriodHealthResult(
            finperiodid=period.finperiodid,
            matrix_id=matrix.matrix_id,
            metric_key="budget_vs_actual_lines",
            score=80 + i * 5,
            status="Strong",
            summary="Test",
            evidence_json="[]",
            is_snapshot=True,
        ))
    db_session.commit()

    response = client.get(f"/api/reports/budgets/{budget.budgetid}/trends/health-history")
    assert response.status_code == 200
    data = response.json()
    assert len(data["periods"]) == 2
    assert len(data["metrics"]) == 2
    metric_keys = {m["key"] for m in data["metrics"]}
    assert metric_keys == {"budget_vs_actual_amount", "budget_vs_actual_lines"}

    for period in data["periods"]:
        assert period["scores"]["budget_vs_actual_amount"] is not None
        assert period["scores"]["budget_vs_actual_lines"] is not None


def test_health_history_metric_keys_filter(client, db_session):
    from tests.factories import create_budget
    from app.models import FinancialPeriod, PeriodHealthResult, BudgetHealthMatrix
    from app.cycle_constants import CLOSED

    budget = create_budget(db_session)
    db_session.commit()

    now = datetime.now(timezone.utc)
    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=now - timedelta(days=30),
        enddate=now - timedelta(days=1),
        cycle_status=CLOSED,
        islocked=True,
    )
    db_session.add(period)
    db_session.flush()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    for key in ("budget_vs_actual_amount", "budget_vs_actual_lines"):
        db_session.add(PeriodHealthResult(
            finperiodid=period.finperiodid,
            matrix_id=matrix.matrix_id,
            metric_key=key,
            score=75,
            status="Strong",
            summary="Test",
            evidence_json="[]",
            is_snapshot=True,
        ))
    db_session.commit()

    response = client.get(
        f"/api/reports/budgets/{budget.budgetid}/trends/health-history",
        params={"metric_keys": "budget_vs_actual_amount"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["metrics"]) == 1
    assert data["metrics"][0]["key"] == "budget_vs_actual_amount"
    assert "budget_vs_actual_lines" not in data["periods"][0]["scores"]


def test_health_history_date_range_filter(client, db_session):
    from tests.factories import create_budget
    from app.models import FinancialPeriod, PeriodHealthResult, BudgetHealthMatrix
    from app.cycle_constants import CLOSED

    budget = create_budget(db_session)
    db_session.commit()

    now = datetime.now(timezone.utc)
    # Older period (should be excluded)
    old_period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=now - timedelta(days=90),
        enddate=now - timedelta(days=60),
        cycle_status=CLOSED,
        islocked=True,
    )
    db_session.add(old_period)
    db_session.flush()

    # Recent period (should be included)
    recent_period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=now - timedelta(days=30),
        enddate=now - timedelta(days=1),
        cycle_status=CLOSED,
        islocked=True,
    )
    db_session.add(recent_period)
    db_session.flush()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    for p in (old_period, recent_period):
        db_session.add(PeriodHealthResult(
            finperiodid=p.finperiodid,
            matrix_id=matrix.matrix_id,
            metric_key="budget_vs_actual_amount",
            score=80,
            status="Strong",
            summary="Test",
            evidence_json="[]",
            is_snapshot=True,
        ))
    db_session.commit()

    from_date = (now - timedelta(days=45)).date().isoformat()
    to_date = now.date().isoformat()

    response = client.get(
        f"/api/reports/budgets/{budget.budgetid}/trends/health-history",
        params={"from_date": from_date, "to_date": to_date},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["periods"]) == 1
    assert data["periods"][0]["finperiodid"] == recent_period.finperiodid
