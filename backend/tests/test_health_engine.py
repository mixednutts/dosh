from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest

from app.health_engine.formula_evaluator import evaluate_formula
from app.health_engine.metric_executors import (
    execute_budget_discipline,
    execute_current_period_check,
    execute_planning_stability,
    execute_setup_health,
    get_executor,
)
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
    with pytest.raises(ZeroDivisionError):
        evaluate_formula("a / 0", {"a": Decimal("5")})


def test_evaluate_formula_invalid_token_raises() -> None:
    with pytest.raises(ValueError):
        evaluate_formula("a + $", {"a": Decimal("5")})


def test_execute_setup_health_perfect_score() -> None:
    result = execute_setup_health(
        db=None,
        budget=None,
        period=None,
        formula_result=Decimal("3"),
        personalisation_value=None,
        scoring_sensitivity=50,
        tone="factual",
        source_values={
            "income_source_count": Decimal("1"),
            "active_expense_count": Decimal("1"),
            "future_period_count": Decimal("1"),
        },
    )
    assert result["score"] == 100
    assert result["status"] == "Strong"
    assert "income source(s) configured" in result["evidence"][0]


def test_execute_setup_health_zero_score() -> None:
    result = execute_setup_health(
        db=None,
        budget=None,
        period=None,
        formula_result=Decimal("0"),
        personalisation_value=None,
        scoring_sensitivity=50,
        tone="factual",
        source_values={
            "income_source_count": Decimal("0"),
            "active_expense_count": Decimal("0"),
            "future_period_count": Decimal("0"),
        },
    )
    assert result["score"] == 0
    assert result["status"] == "Needs Attention"


def test_execute_budget_discipline_no_overrun() -> None:
    result = execute_budget_discipline(
        db=None,
        budget=None,
        period=None,
        formula_result=Decimal("0"),
        personalisation_value=Decimal("10"),
        scoring_sensitivity=50,
        tone="factual",
    )
    assert result["score"] == 100
    assert result["status"] == "Strong"


def test_execute_budget_discipline_overrun_within_threshold() -> None:
    result = execute_budget_discipline(
        db=None,
        budget=None,
        period=None,
        formula_result=Decimal("0.05"),  # 5% overrun
        personalisation_value=Decimal("10"),
        scoring_sensitivity=50,
        tone="factual",
    )
    assert 80 <= result["score"] <= 100
    assert result["status"] in ("Strong", "Watch")


def test_execute_budget_discipline_overrun_beyond_threshold() -> None:
    result = execute_budget_discipline(
        db=None,
        budget=None,
        period=None,
        formula_result=Decimal("0.20"),  # 20% overrun
        personalisation_value=Decimal("10"),
        scoring_sensitivity=50,
        tone="factual",
    )
    assert result["score"] < 80


def test_execute_planning_stability_zero_revisions() -> None:
    result = execute_planning_stability(
        db=None,
        budget=None,
        period=None,
        formula_result=Decimal("0"),
        personalisation_value=Decimal("50"),
        scoring_sensitivity=50,
        tone="friendly",
    )
    assert result["score"] == 100
    assert result["status"] == "Strong"


def test_execute_planning_stability_multiple_revisions() -> None:
    result = execute_planning_stability(
        db=None,
        budget=None,
        period=None,
        formula_result=Decimal("5"),
        personalisation_value=Decimal("50"),
        scoring_sensitivity=50,
        tone="factual",
    )
    assert result["score"] < 100
    assert result["status"] in ("Watch", "Needs Attention")


def test_execute_current_period_check_surplus() -> None:
    period = FinancialPeriod(finperiodid=1)
    result = execute_current_period_check(
        db=None,
        budget=None,
        period=period,
        formula_result=Decimal("200"),
        personalisation_value=Decimal("50"),
        scoring_sensitivity=50,
        tone="factual",
        source_values={"total_budgeted_income": Decimal("1000")},
    )
    assert result["score"] == 100
    assert result["status"] == "Strong"


def test_execute_current_period_check_deficit_within_tolerance() -> None:
    period = FinancialPeriod(finperiodid=1)
    result = execute_current_period_check(
        db=None,
        budget=None,
        period=period,
        formula_result=Decimal("-30"),
        personalisation_value=Decimal("50"),
        scoring_sensitivity=50,
        tone="factual",
        source_values={"total_budgeted_income": Decimal("1000")},
    )
    assert 70 <= result["score"] <= 100


def test_execute_current_period_check_deficit_beyond_tolerance() -> None:
    period = FinancialPeriod(finperiodid=1)
    result = execute_current_period_check(
        db=None,
        budget=None,
        period=period,
        formula_result=Decimal("-200"),
        personalisation_value=Decimal("50"),
        scoring_sensitivity=50,
        tone="factual",
        source_values={"total_budgeted_income": Decimal("1000")},
    )
    assert result["score"] < 70


def test_execute_current_period_check_no_period() -> None:
    result = execute_current_period_check(
        db=None,
        budget=None,
        period=None,
        formula_result=Decimal("0"),
        personalisation_value=None,
        scoring_sensitivity=50,
        tone="factual",
    )
    assert result["score"] == 50
    assert result["status"] == "Watch"


def test_get_executor_returns_callable_for_known_key() -> None:
    executor = get_executor("setup_health")
    assert callable(executor)


def test_get_executor_returns_fallback_for_unknown_key() -> None:
    executor = get_executor("nonexistent")
    result = executor()
    assert result["score"] == 50
    assert result["status"] == "Watch"


def test_evaluate_period_health_with_budget_matrix(client, db_session) -> None:
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
    assert len(results) >= 3

    setup_result = next(r for r in results if r["name"] == "Setup Health")
    assert setup_result["score"] >= 0
    assert setup_result["status"] in ("Strong", "Watch", "Needs Attention")


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


def test_evaluate_budget_health_returns_structure(client, db_session) -> None:
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

    result = evaluate_budget_health(db_session, budget.budgetid)
    assert result is not None
    assert "overall_score" in result
    assert "overall_status" in result
    assert "pillars" in result
    assert "momentum_status" in result
    assert "current_period_check" in result
    assert 0 <= result["overall_score"] <= 100
