from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException

from ..api_docs import DbSession, error_responses
from ..models import Budget, BudgetHealthMatrix, BudgetHealthMatrixItem

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
        metric = item.metric
        if not metric:
            continue
        try:
            parameters = json.loads(item.parameters_json or "{}")
        except Exception:
            parameters = {}

        result_items.append({
            "metric_id": metric.metric_id,
            "metric_key": metric.metric_key,
            "name": metric.name,
            "description": metric.description,
            "scope": metric.scope,
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


@router.patch("/items/{metric_id}", responses=error_responses(404, 400))
def update_matrix_item(
    budgetid: int,
    metric_id: int,
    payload: dict,
    db: DbSession,
):
    """Update a matrix item's weight, sensitivity, enablement, or parameters."""
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    matrix = db.query(BudgetHealthMatrix).filter_by(budgetid=budgetid, is_active=True).first()
    if not matrix:
        raise HTTPException(404, "Health matrix not found")

    item = db.query(BudgetHealthMatrixItem).filter_by(
        matrix_id=matrix.matrix_id, metric_id=metric_id
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
            current = json.loads(item.parameters_json or "{}")
        except Exception:
            current = {}
        current.update(payload["parameters"])
        item.parameters_json = json.dumps(current)

    db.commit()
    db.refresh(item)
    return {"ok": True}
