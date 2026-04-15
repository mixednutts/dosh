from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.health_engine.formula_evaluator import evaluate_formula
from app.health_engine.metric_executors import get_executor
from app.health_engine.runner import evaluate_budget_health, evaluate_period_health
from app.models import Budget, FinancialPeriod

from .factories import create_budget, create_expense_item, create_income_type


def test_evaluate_formula_basic() -> None:
    result = evaluate_formula("a + b * 2", {"a": Decimal("1"), "b": Decimal("3")})
    assert result == Decimal("7")


def test_evaluate_formula_division() -> None:
    result = evaluate_formula("a / 2", {"a": Decimal("5")})
    assert result == Decimal("2.5")


def test_evaluate_formula_parentheses() -> None:
    result = evaluate_formula("(a + b) * 2", {"a": Decimal("1"), "b": Decimal("2")})
    assert result == Decimal("6")


def test_evaluate_formula_zero_division_raises() -> None:
    import pytest
    with pytest.raises(ZeroDivisionError):
        evaluate_formula("a / 0", {"a": Decimal("5")})


def test_evaluate_formula_invalid_token_raises() -> None:
    import pytest
    with pytest.raises(ValueError):
        evaluate_formula("a + $", {"a": Decimal("5")})


def test_get_executor_returns_fallback_for_unknown_key() -> None:
    executor = get_executor("nonexistent")
    result = executor()
    assert result["score"] == 50
    assert result["status"] == "Watch"


def test_get_executor_returns_fallback_for_legacy_keys() -> None:
    """Legacy metric template keys no longer have dedicated executors."""
    for key in ("setup_health", "budget_discipline", "planning_stability", "current_period_check"):
        executor = get_executor(key)
        result = executor()
        assert result["score"] == 50
        assert result["status"] == "Watch"


def test_evaluate_period_health_with_empty_budget_matrix(client, db_session) -> None:
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=datetime(2025, 1, 1, tzinfo=timezone.utc),
        enddate=datetime(2025, 1, 31, tzinfo=timezone.utc),
    )
    db_session.add(period)
    db_session.commit()
    db_session.refresh(period)

    from app.models import BudgetHealthMatrix

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    assert matrix is not None

    results = evaluate_period_health(db_session, budget, period, matrix)
    assert isinstance(results, list)


def test_evaluate_budget_health_returns_none_for_missing_budget(db_session) -> None:
    result = evaluate_budget_health(db_session, budgetid=-999)
    assert result is None


def test_evaluate_budget_health_returns_none_for_missing_matrix(client, db_session) -> None:
    budget = create_budget(db_session)
    from app.models import BudgetHealthMatrix, BudgetHealthMatrixItem

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid).first()
    assert matrix is not None
    db_session.query(BudgetHealthMatrixItem).filter_by(matrix_id=matrix.matrix_id).delete()
    db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid).delete()
    db_session.commit()

    result = evaluate_budget_health(db_session, budget.budgetid)
    assert result is None


def test_evaluate_budget_health_returns_none_for_empty_matrix(client, db_session) -> None:
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=datetime(2025, 1, 1, tzinfo=timezone.utc),
        enddate=datetime(2025, 1, 31, tzinfo=timezone.utc),
    )
    db_session.add(period)
    db_session.commit()
    db_session.refresh(period)

    # Default matrix is empty (no metric templates seeded), so evaluation returns None
    result = evaluate_budget_health(db_session, budget.budgetid)
    assert result is None


def test_evaluate_budget_health_returns_structure_with_custom_metric(client, db_session) -> None:
    from app.models import BudgetHealthMatrix, BudgetHealthMatrixItem, HealthMetric, HealthScale, HealthDataSource
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)

    period = FinancialPeriod(
        budgetid=budget.budgetid,
        startdate=datetime(2025, 1, 1, tzinfo=timezone.utc),
        enddate=datetime(2025, 1, 31, tzinfo=timezone.utc),
    )
    db_session.add(period)
    db_session.commit()
    db_session.refresh(period)

    # Seed required catalog rows and add a custom metric to the matrix
    if not db_session.query(HealthScale).filter_by(scale_key="percentage_0_100").first():
        db_session.add(HealthScale(scale_key="percentage_0_100", name="Percentage", scale_type="integer_range", min_value=0, max_value=100, step_value=1))
    if not db_session.query(HealthDataSource).filter_by(source_key="income_source_count").first():
        db_session.add(HealthDataSource(source_key="income_source_count", name="Income Count", return_type="int", executor_path=""))
    db_session.flush()

    metric = HealthMetric(
        budgetid=budget.budgetid,
        name="Test Metric",
        scope="OVERALL",
        formula_expression="income_source_count",
        formula_data_sources_json='["income_source_count"]',
        scale_key="percentage_0_100",
        default_value_json="0",
        scoring_logic_json='{"tone":"neutral"}',
        evidence_template_json='{}',
    )
    db_session.add(metric)
    db_session.flush()

    matrix = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    db_session.add(BudgetHealthMatrixItem(
        matrix_id=matrix.matrix_id,
        metric_id=metric.metric_id,
        weight=1.0,
        scoring_sensitivity=50,
        display_order=0,
        is_enabled=True,
    ))
    db_session.commit()

    result = evaluate_budget_health(db_session, budget.budgetid)
    assert result is not None
    assert "overall_score" in result
    assert "overall_status" in result
    assert "pillars" in result
    assert "momentum_status" in result
    assert 0 <= result["overall_score"] <= 100
