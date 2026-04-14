from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, HTTPException
from sqlalchemy.orm import Session

from ..api_docs import DbSession, error_responses
from ..models import (
    Budget,
    BudgetHealthMatrix,
    BudgetHealthMatrixItem,
    BudgetMetricThreshold,
    HealthDataSource,
    HealthMetric,
    HealthMetricTemplate,
    HealthThresholdDefinition,
    HealthScale,
)

router = APIRouter(prefix="/budgets/{budgetid}/health-matrix", tags=["health-matrices"])


def _serialize_scale(scale: HealthScale | None) -> dict | None:
    """Serialize a HealthScale for API response."""
    if not scale:
        return None
    return {
        "scale_key": scale.scale_key,
        "name": scale.name,
        "scale_type": scale.scale_type,
        "min_value": float(scale.min_value) if scale.min_value is not None else None,
        "max_value": float(scale.max_value) if scale.max_value is not None else None,
        "step_value": float(scale.step_value) if scale.step_value is not None else None,
        "unit_label": scale.unit_label,
    }


def _parse_threshold_value(value_json: str, scale_type: str | None) -> int | float | str | None:
    """Parse a threshold value from JSON based on scale type."""
    try:
        raw = json.loads(value_json)
    except json.JSONDecodeError:
        return value_json
    if raw is None:
        return None
    if scale_type == "money":
        return float(raw) if raw is not None else None
    elif scale_type == "integer_range":
        return int(raw) if raw is not None else None
    elif scale_type == "decimal_range":
        return float(raw) if raw is not None else None
    return raw


@router.get("/", responses=error_responses(404))
def get_budget_health_matrix(budgetid: int, db: DbSession):
    """Get the active health matrix for a budget, including items and thresholds."""
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

    threshold_defs = {
        t.threshold_key: t
        for t in db.query(HealthThresholdDefinition).all()
    }

    result_items = []
    for item in items:
        metric = item.metric
        if not metric:
            continue

        threshold_value = None
        threshold_def = None
        if metric.threshold_key:
            threshold_def = threshold_defs.get(metric.threshold_key)
            bmt = db.query(BudgetMetricThreshold).filter_by(
                budgetid=budgetid, metric_id=metric.metric_id
            ).first()
            if bmt:
                scale_type = threshold_def.scale.scale_type if threshold_def and threshold_def.scale else None
                threshold_value = _parse_threshold_value(bmt.value_json, scale_type)

        result_items.append({
            "matrix_item_id": f"{item.matrix_id}-{item.metric_id}",
            "metric_id": metric.metric_id,
            "template_key": metric.template_key,
            "name": metric.name,
            "description": metric.description,
            "scope": metric.scope,
            "formula_expression": metric.formula_expression,
            "formula_data_sources_json": json.loads(metric.formula_data_sources_json or "[]"),
            "weight": float(item.weight),
            "scoring_sensitivity": item.scoring_sensitivity,
            "is_enabled": item.is_enabled,
            "display_order": item.display_order,
            "threshold_key": metric.threshold_key,
            "threshold_value": threshold_value,
            "threshold_scale": _serialize_scale(threshold_def.scale) if threshold_def else None,
        })

    return {
        "matrix_id": matrix.matrix_id,
        "budgetid": budgetid,
        "name": matrix.name,
        "items": result_items,
    }


@router.get("/definitions", responses=error_responses(404))
def get_threshold_definitions(budgetid: int, db: DbSession):
    """Get all available threshold definitions with their scales."""
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    definitions = db.query(HealthThresholdDefinition).all()
    result = []
    for d in definitions:
        try:
            default_value = json.loads(d.default_value_json)
        except json.JSONDecodeError:
            default_value = d.default_value_json
        result.append({
            "threshold_key": d.threshold_key,
            "name": d.name,
            "description": d.description,
            "default_value": default_value,
            "scale": _serialize_scale(d.scale),
        })
    return result


@router.patch("/items/{metric_id}", responses=error_responses(404))
def update_matrix_item(
    budgetid: int,
    metric_id: int,
    payload: dict,
    db: DbSession,
):
    """Update a matrix item's weight, sensitivity, or enablement."""
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

    db.commit()
    db.refresh(item)
    return {"ok": True}


@router.patch("/thresholds/{metric_id}", responses=error_responses(404, 400))
def update_metric_threshold(
    budgetid: int,
    metric_id: int,
    payload: dict,
    db: DbSession,
):
    """Update the threshold value for a metric in this budget's matrix."""
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    metric = db.query(HealthMetric).filter_by(metric_id=metric_id, budgetid=budgetid).first()
    if not metric:
        raise HTTPException(404, "Metric not found")

    threshold_key = payload.get("threshold_key") or metric.threshold_key
    value = payload.get("value")

    if not threshold_key:
        raise HTTPException(400, "No threshold key defined for this metric")

    threshold_def = db.query(HealthThresholdDefinition).filter_by(
        threshold_key=threshold_key
    ).first()

    if threshold_def and threshold_def.scale:
        scale = threshold_def.scale
        if scale.scale_type in ("integer_range", "decimal_range", "money") and value is not None:
            try:
                num_value = float(value)
                if scale.min_value is not None and num_value < float(scale.min_value):
                    raise HTTPException(400, f"Value must be >= {scale.min_value}")
                if scale.max_value is not None and num_value > float(scale.max_value):
                    raise HTTPException(400, f"Value must be <= {scale.max_value}")
            except ValueError:
                raise HTTPException(400, "Invalid numeric value")

    bmt = db.query(BudgetMetricThreshold).filter_by(
        budgetid=budgetid, metric_id=metric_id
    ).first()

    if bmt:
        bmt.value_json = json.dumps(value)
        bmt.threshold_key = threshold_key
        bmt.updated_at = datetime.now(timezone.utc)
    else:
        bmt = BudgetMetricThreshold(
            budgetid=budgetid,
            metric_id=metric_id,
            threshold_key=threshold_key,
            value_json=json.dumps(value),
        )
        db.add(bmt)

    db.commit()
    return {"ok": True}


@router.get("/data-sources", responses=error_responses(404))
def get_data_sources(budgetid: int, db: DbSession):
    """List available HealthDataSource catalog entries for metric building."""
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    sources = db.query(HealthDataSource).order_by(HealthDataSource.name).all()
    return [
        {
            "source_key": s.source_key,
            "name": s.name,
            "description": s.description,
            "return_type": s.return_type,
        }
        for s in sources
    ]


@router.post("/metrics", responses=error_responses(404, 400))
def create_custom_metric(
    budgetid: int,
    payload: dict,
    db: DbSession,
):
    """Create a custom HealthMetric for this budget from available data sources.

    Payload keys:
    - name: str
    - description: str (optional)
    - scope: str (OVERALL | CURRENT_PERIOD | BOTH)
    - formula_expression: str (e.g., "live_period_surplus / total_budgeted_income")
    - data_sources: list[str] (source_keys referenced in formula)
    - threshold_key: str (optional)
    """
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    name = payload.get("name", "").strip()
    scope = payload.get("scope", "OVERALL")
    formula = payload.get("formula_expression", "").strip()
    data_sources = payload.get("data_sources", [])
    threshold_key = payload.get("threshold_key")

    if not name:
        raise HTTPException(400, "Metric name is required")
    if not formula:
        raise HTTPException(400, "Formula expression is required")
    if scope not in ("OVERALL", "CURRENT_PERIOD", "BOTH"):
        raise HTTPException(400, "Invalid scope")

    if data_sources:
        existing = {s.source_key for s in db.query(HealthDataSource).filter(
            HealthDataSource.source_key.in_(data_sources)
        ).all()}
        missing = [k for k in data_sources if k not in existing]
        if missing:
            raise HTTPException(400, f"Unknown data sources: {missing}")

    if threshold_key:
        threshold_def = db.query(HealthThresholdDefinition).filter_by(
            threshold_key=threshold_key
        ).first()
        if not threshold_def:
            raise HTTPException(400, f"Unknown threshold key: {threshold_key}")

    from ..health_engine.formula_evaluator import evaluate_formula
    dummy_values = {k: Decimal(1) for k in data_sources}
    try:
        evaluate_formula(formula, dummy_values)
    except Exception as exc:
        raise HTTPException(400, f"Invalid formula: {exc}")

    metric = HealthMetric(
        template_key=None,
        budgetid=budgetid,
        name=name,
        description=payload.get("description", ""),
        scope=scope,
        formula_expression=formula,
        formula_data_sources_json=json.dumps(data_sources),
        threshold_key=threshold_key,
        scoring_logic_json=json.dumps({"type": "custom_metric_v1"}),
        evidence_template_json=json.dumps({
            "supportive": f"{name} looks good.",
            "factual": f"{name} evaluated.",
            "friendly": f"{name} is doing fine!",
        }),
        drill_down_enabled=False,
    )
    db.add(metric)
    db.commit()
    db.refresh(metric)

    matrix = db.query(BudgetHealthMatrix).filter_by(budgetid=budgetid, is_active=True).first()
    if matrix:
        max_order = db.query(BudgetHealthMatrixItem).filter_by(matrix_id=matrix.matrix_id).count()
        db.add(BudgetHealthMatrixItem(
            matrix_id=matrix.matrix_id,
            metric_id=metric.metric_id,
            weight=Decimal("0.2000"),
            scoring_sensitivity=50,
            display_order=max_order,
            is_enabled=True,
        ))
        db.commit()

    return {
        "metric_id": metric.metric_id,
        "name": metric.name,
        "scope": metric.scope,
        "formula_expression": metric.formula_expression,
    }


@router.delete("/items/{metric_id}", responses=error_responses(404))
def remove_matrix_item(
    budgetid: int,
    metric_id: int,
    db: DbSession,
):
    """Remove a metric from this budget's active health matrix."""
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

    db.delete(item)

    db.query(BudgetMetricThreshold).filter_by(
        budgetid=budgetid, metric_id=metric_id
    ).delete()

    metric = db.query(HealthMetric).filter_by(metric_id=metric_id, budgetid=budgetid).first()
    if metric and not metric.template_key:
        db.delete(metric)

    db.commit()
    return {"ok": True}
