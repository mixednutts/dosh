from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

from ..api_docs import DbSession, error_responses
from ..models import Budget, BudgetHealthMatrix, BudgetHealthMatrixItem
from ..health_engine.system_metrics import get_system_metric, SYSTEM_METRICS

router = APIRouter(prefix="/budgets/{budgetid}/health-matrix", tags=["health-matrices"])


@router.get("/", responses=error_responses(404))
def get_budget_health_matrix(budgetid: int, db: DbSession):
    """Get the active health matrix for a budget, including items and parameters."""
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    matrix = db.query(BudgetHealthMatrix).filter_by(budgetid=budgetid, is_active=True).first()
    if not matrix:
        raise HTTPException(404, "Health matrix not found for this budget")

    items = (
        db.query(BudgetHealthMatrixItem)
        .filter_by(matrix_id=matrix.matrix_id)
        .order_by(BudgetHealthMatrixItem.display_order)
        .all()
    )

    result_items = []
    for item in items:
        metric_def = get_system_metric(item.metric_key)
        if not metric_def:
            continue
        try:
            parameters = json.loads(item.health_metric_parameters or "{}")
        except Exception:
            parameters = {}

        result_items.append({
            "metric_key": item.metric_key,
            "name": metric_def["name"],
            "description": metric_def["description"],
            "scope": metric_def["scope"],
            "weight": float(item.weight),
            "scoring_sensitivity": item.scoring_sensitivity,
            "is_enabled": item.is_enabled,
            "display_order": item.display_order,
            "parameters": parameters,
        })

    return {
        "matrix_id": matrix.matrix_id,
        "budgetid": budgetid,
        "name": matrix.name,
        "items": result_items,
    }


@router.patch("/items/{metric_key}", responses=error_responses(404, 400))
def update_matrix_item(
    budgetid: int,
    metric_key: str,
    payload: dict,
    db: DbSession,
):
    """Update a matrix item's weight, sensitivity, enablement, or parameters."""
    if metric_key not in SYSTEM_METRICS:
        raise HTTPException(404, "Metric not found")

    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    matrix = db.query(BudgetHealthMatrix).filter_by(budgetid=budgetid, is_active=True).first()
    if not matrix:
        raise HTTPException(404, "Health matrix not found")

    item = db.query(BudgetHealthMatrixItem).filter_by(
        matrix_id=matrix.matrix_id, metric_key=metric_key
    ).first()
    if not item:
        raise HTTPException(404, "Matrix item not found")

    if "weight" in payload:
        item.weight = payload["weight"]
    if "scoring_sensitivity" in payload:
        item.scoring_sensitivity = payload["scoring_sensitivity"]
    if "is_enabled" in payload:
        item.is_enabled = payload["is_enabled"]
    if "parameters" in payload:
        # Merge parameters
        try:
            current = json.loads(item.health_metric_parameters or "{}")
        except Exception:
            current = {}
        current.update(payload["parameters"])
        item.health_metric_parameters = json.dumps(current)

    db.commit()
    db.refresh(item)
    return get_budget_health_matrix(budgetid, db)
