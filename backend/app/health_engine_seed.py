"""Seed and migration utilities for the simplified Budget Health Engine."""

from __future__ import annotations

import json
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Budget, BudgetHealthMatrix, BudgetHealthMatrixItem
from app.health_engine.system_metrics import SYSTEM_METRICS


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

    for metric_key, definition in SYSTEM_METRICS.items():
        db.add(BudgetHealthMatrixItem(
            matrix_id=matrix.matrix_id,
            metric_key=metric_key,
            weight=definition["default_weight"],
            scoring_sensitivity=50,
            display_order=definition["default_display_order"],
            is_enabled=True,
            health_metric_parameters=json.dumps(definition["default_parameters"]),
        ))
    db.flush()

    return matrix
