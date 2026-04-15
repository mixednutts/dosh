"""Seed and migration utilities for the simplified Budget Health Engine."""

from __future__ import annotations

import json
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Budget, BudgetHealthMatrix, BudgetHealthMatrixItem, HealthMetric


def create_default_matrix_for_budget(db: Session, budget: Budget) -> BudgetHealthMatrix:
    """Create a default simplified BudgetHealthMatrix for a budget."""
    existing = db.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    if existing:
        return existing

    matrix = BudgetHealthMatrix(
        budgetid=budget.budgetid,
        name="Budget Health",
        is_active=True,
    )
    db.add(matrix)
    db.flush()

    setup_metric = HealthMetric(
        budgetid=budget.budgetid,
        metric_key="setup_health",
        name="Setup Health",
        description="Checks whether the budget has the minimum required setup lines.",
        scope="CURRENT_PERIOD",
    )
    discipline_metric = HealthMetric(
        budgetid=budget.budgetid,
        metric_key="budget_discipline",
        name="Budget Discipline",
        description="Measures historical expense overrun against your tolerance.",
        scope="OVERALL",
    )
    db.add(setup_metric)
    db.add(discipline_metric)
    db.flush()

    db.add(BudgetHealthMatrixItem(
        matrix_id=matrix.matrix_id,
        metric_id=setup_metric.metric_id,
        weight=Decimal("0.30"),
        scoring_sensitivity=50,
        display_order=0,
        is_enabled=True,
        parameters_json=json.dumps({"min_income_lines": 1, "min_expense_lines": 1, "min_investment_lines": 1}),
    ))
    db.add(BudgetHealthMatrixItem(
        matrix_id=matrix.matrix_id,
        metric_id=discipline_metric.metric_id,
        weight=Decimal("0.70"),
        scoring_sensitivity=50,
        display_order=1,
        is_enabled=True,
        parameters_json=json.dumps({"max_overrun_dollar": 0, "max_overrun_pct_of_expenses": 10}),
    ))
    db.flush()

    return matrix
