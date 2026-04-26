from decimal import Decimal
from datetime import datetime, timezone, timedelta

from app.health_engine.metric_executors import get_executor
from app.health_engine.runner import (
    evaluate_budget_health,
    evaluate_period_health,
    _compute_momentum,
    _health_status,
    _current_period_summary,
    _closed_period_summary,
    persist_period_health_snapshot,
)


def test_get_executor_returns_setup_health_executor(client, db_session) -> None:
    from tests.factories import create_budget
    budget = create_budget(db_session)
    executor = get_executor("setup_health")
    result = executor(
        db=db_session,
        budget=budget,
        period=None,
        parameters={"min_income_lines": 1, "min_expense_lines": 1, "min_investment_lines": 1},
        scoring_sensitivity=50,
        tone="factual",
    )
    assert "score" in result
    assert "status" in result
    assert "summary" in result
    assert "evidence" in result


def test_setup_health_executor_perfect_score(client, db_session) -> None:
    from tests.factories import create_budget
    from app.models import IncomeType, ExpenseItem, InvestmentItem

    budget = create_budget(db_session)
    db_session.add(IncomeType(budgetid=budget.budgetid, incomedesc="Salary", amount=Decimal("1000")))
    db_session.add(ExpenseItem(budgetid=budget.budgetid, expensedesc="Rent", active=True))
    db_session.add(InvestmentItem(budgetid=budget.budgetid, investmentdesc="Shares", active=True))
    db_session.commit()

    executor = get_executor("setup_health")
    result = executor(
        db=db_session,
        budget=budget,
        period=None,
        parameters={"min_income_lines": 1, "min_expense_lines": 1, "min_investment_lines": 1},
        scoring_sensitivity=50,
        tone="factual",
    )
    assert result["score"] == 100
    assert result["status"] == "Strong"


def test_setup_health_executor_penalises_missing_items(client, db_session) -> None:
    from tests.factories import create_budget

    budget = create_budget(db_session)
    executor = get_executor("setup_health")
    result = executor(
        db=db_session,
        budget=budget,
        period=None,
        parameters={"min_income_lines": 1, "min_expense_lines": 1, "min_investment_lines": 1},
        scoring_sensitivity=100,
        tone="factual",
    )
    assert result["score"] < 100
    assert result["status"] == "Needs Attention"


def test_budget_vs_actual_amount_executor_no_overrun(client, db_session) -> None:
    from tests.factories import create_budget

    budget = create_budget(db_session)
    executor = get_executor("budget_vs_actual_amount")
    result = executor(
        db=db_session,
        budget=budget,
        period=None,
        parameters={"upper_tolerance_amount": 50, "upper_tolerance_pct": 5},
        scoring_sensitivity=50,
        tone="factual",
    )
    assert result["score"] == 100
    assert result["status"] == "Strong"


def test_budget_vs_actual_amount_executor_penalises_overrun(client, db_session) -> None:
    from tests.factories import create_budget
    from app.models import FinancialPeriod, PeriodExpense, ExpenseItem

    budget = create_budget(db_session)
    db_session.add(ExpenseItem(budgetid=budget.budgetid, expensedesc="Rent", active=True, expenseamount=Decimal("500")))
    db_session.commit()

    now = datetime.now(timezone.utc)
    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=now - timedelta(days=30),
        enddate=now + timedelta(days=1),
        islocked=False,
    )
    db_session.add(period)
    db_session.flush()
    db_session.add(PeriodExpense(finperiodid=period.finperiodid, budgetid=budget.budgetid, expensedesc="Rent", budgetamount=Decimal("500"), actualamount=Decimal("700")))
    db_session.commit()

    executor = get_executor("budget_vs_actual_amount")
    result = executor(
        db=db_session,
        budget=budget,
        period=period,
        parameters={"upper_tolerance_amount": 50, "upper_tolerance_pct": 5},
        scoring_sensitivity=50,
        tone="factual",
    )
    assert result["score"] < 100
    assert result["status"] in ("Watch", "Needs Attention")


def test_evaluate_budget_health_returns_structure(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    payload = evaluate_budget_health(db_session, budget.budgetid)
    assert payload is not None
    assert "overall_score" in payload
    assert "overall_status" in payload
    assert "pillars" in payload
    assert "momentum_status" in payload
    assert "current_period_check" in payload
    assert payload["version"] == "engine-v1"

    for pillar in payload["pillars"]:
        assert "key" in pillar
        assert "weight" in pillar
        assert "weighted_contribution" in pillar
        for ev in pillar["evidence"]:
            assert "label" in ev
            assert "value" in ev

    cpc = payload["current_period_check"]
    assert cpc is not None
    assert "metrics" in cpc
    for m in cpc["metrics"]:
        assert "key" in m
        assert "weight" in m
        assert "weighted_contribution" in m
        for ev in m["evidence"]:
            assert "label" in ev
            assert "value" in ev


def test_evaluate_period_health_returns_metrics(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import BudgetHealthMatrix

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    results = evaluate_period_health(db_session, budget, None, matrix)
    assert len(results) == 6
    for r in results:
        assert "score" in r
        assert "status" in r
        assert "summary" in r
        assert "evidence" in r
        for ev in r["evidence"]:
            assert "label" in ev
            assert "value" in ev


def test_compute_momentum_stable_with_no_history(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import BudgetHealthMatrix

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    status, delta = _compute_momentum(db_session, budget.budgetid, matrix)
    assert status == "Stable"
    assert delta == 0


# ---------------------------------------------------------------------------
# Additional tests for runner.py uncovered paths
# ---------------------------------------------------------------------------


def test_evaluate_budget_health_returns_none_for_missing_budget(client, db_session) -> None:
    result = evaluate_budget_health(db_session, 99999)
    assert result is None


def test_evaluate_budget_health_returns_none_for_empty_matrix(client, db_session) -> None:
    from tests.factories import create_budget
    from app.models import BudgetHealthMatrix

    budget = create_budget(db_session)
    # Deactivate the default matrix created by create_budget
    db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid).update({"is_active": False})
    db_session.commit()

    # Create a new empty matrix (no items)
    matrix = BudgetHealthMatrix(budgetid=budget.budgetid, is_active=True, name="Test Matrix")
    db_session.add(matrix)
    db_session.commit()

    result = evaluate_budget_health(db_session, budget.budgetid)
    assert result is None


def test_health_status_boundaries() -> None:
    assert _health_status(100) == "Strong"
    assert _health_status(80) == "Strong"
    assert _health_status(79) == "Watch"
    assert _health_status(55) == "Watch"
    assert _health_status(54) == "Needs Attention"
    assert _health_status(0) == "Needs Attention"


def test_current_period_summary_all_tones_and_bands() -> None:
    for tone in ("supportive", "friendly", "direct"):
        for score in (0, 25, 50, 75, 100):
            summary = _current_period_summary(score, tone)
            assert isinstance(summary, str)
            assert len(summary) > 0


def test_current_period_summary_fallback() -> None:
    # Score outside defined bands should fall back to highest band
    summary = _current_period_summary(1000, "supportive")
    assert "tracking well" in summary.lower() or "good work" in summary.lower()


def test_closed_period_summary_all_tones_and_bands() -> None:
    for tone in ("supportive", "friendly", "direct"):
        for score in (0, 25, 50, 75, 100):
            summary = _closed_period_summary(score, tone)
            assert isinstance(summary, str)
            assert len(summary) > 0


def test_closed_period_summary_fallback() -> None:
    summary = _closed_period_summary(1000, "supportive")
    assert "solid result" in summary.lower() or "tracked well" in summary.lower()


def test_compute_momentum_with_insufficient_closed_periods(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import BudgetHealthMatrix, FinancialPeriod

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    # Add only one locked period
    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=datetime.now(timezone.utc) - timedelta(days=60),
        enddate=datetime.now(timezone.utc) - timedelta(days=30),
        islocked=True,
    )
    db_session.add(period)
    db_session.commit()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    status, delta = _compute_momentum(db_session, budget.budgetid, matrix)
    assert status == "Stable"
    assert delta == 0


def test_compute_momentum_with_locked_periods_but_no_snapshots(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import BudgetHealthMatrix, FinancialPeriod

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    # Add two locked periods but no health snapshots
    for i in range(2):
        period = FinancialPeriod(
            budgetid=budget.budgetid,
            startdate=datetime.now(timezone.utc) - timedelta(days=90 - i * 30),
            enddate=datetime.now(timezone.utc) - timedelta(days=60 - i * 30),
            islocked=True,
        )
        db_session.add(period)
    db_session.commit()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    status, delta = _compute_momentum(db_session, budget.budgetid, matrix)
    assert status == "Stable"
    assert delta == 0


def test_persist_period_health_snapshot_creates_rows(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import BudgetHealthMatrix, FinancialPeriod, PeriodHealthResult

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=datetime.now(timezone.utc) - timedelta(days=30),
        enddate=datetime.now(timezone.utc) + timedelta(days=1),
        islocked=False,
    )
    db_session.add(period)
    db_session.commit()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    persist_period_health_snapshot(db_session, budget, period, matrix)
    db_session.commit()

    snapshots = db_session.query(PeriodHealthResult).filter_by(finperiodid=period.finperiodid).all()
    assert len(snapshots) == 6  # default matrix has 6 metrics
    for snap in snapshots:
        assert snap.is_snapshot is True
        assert snap.score is not None
        assert snap.status is not None
        assert snap.summary is not None


def test_evaluate_period_health_skips_unknown_metric_key(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import BudgetHealthMatrix, BudgetHealthMatrixItem

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()

    # Add an item with an unknown metric key
    item = BudgetHealthMatrixItem(
        matrix_id=matrix.matrix_id,
        metric_key="nonexistent_metric",
        is_enabled=True,
        weight=10,
        display_order=99,
    )
    db_session.add(item)
    db_session.commit()

    results = evaluate_period_health(db_session, budget, None, matrix)
    # Should still return results for the 6 valid metrics, skipping the unknown one
    assert len(results) == 6


def test_evaluate_period_health_handles_invalid_parameters_json(client, db_session) -> None:
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import BudgetHealthMatrix, BudgetHealthMatrixItem

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()

    # Corrupt one item's parameters
    item = db_session.query(BudgetHealthMatrixItem).filter_by(matrix_id=matrix.matrix_id).first()
    item.health_metric_parameters = "not valid json {{{"
    db_session.commit()

    results = evaluate_period_health(db_session, budget, None, matrix)
    # Should still return results, using empty dict for corrupted parameters
    assert len(results) == 6


def test_evaluate_budget_health_finds_current_period_on_last_day(client, db_session) -> None:
    """A period whose enddate has passed but is less than a full day ago must still be
    treated as current by the health engine, matching cycle_stage() behaviour.
    """
    from datetime import datetime, timezone, timedelta
    from tests.factories import create_budget
    from app.health_engine_seed import create_default_matrix_for_budget
    from app.models import FinancialPeriod

    budget = create_budget(db_session)
    create_default_matrix_for_budget(db_session, budget)
    db_session.commit()

    now = datetime.now(timezone.utc)
    # enddate is 1 hour in the past: now > enddate, but now < enddate + 1 day
    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=now - timedelta(days=30),
        enddate=now - timedelta(hours=1),
        islocked=False,
    )
    db_session.add(period)
    db_session.commit()

    payload = evaluate_budget_health(db_session, budget.budgetid)
    assert payload is not None
    cpc = payload["current_period_check"]
    assert cpc is not None

    for m in cpc["metrics"]:
        assert m["summary"] != "No current period to evaluate."
