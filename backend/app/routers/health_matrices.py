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
    BudgetMetricPersonalisation,
    HealthDataSource,
    HealthMetric,
    HealthMetricTemplate,
    HealthPersonalisationDefinition,
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


def _parse_personalisation_value(value_json: str, scale_type: str | None) -> int | float | str | None:
    """Parse a personalisation value from JSON based on scale type."""
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
    """Get the active health matrix for a budget, including items and personalisations."""
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

    pers_defs = {
        p.personalisation_key: p
        for p in db.query(HealthPersonalisationDefinition).all()
    }

    result_items = []
    for item in items:
        metric = item.metric
        if not metric:
            continue

        pers_value = None
        pers_def = None
        if metric.personalisation_key:
            pers_def = pers_defs.get(metric.personalisation_key)
            bmp = db.query(BudgetMetricPersonalisation).filter_by(
                budgetid=budgetid, metric_id=metric.metric_id
            ).first()
            if bmp:
                scale_type = pers_def.scale.scale_type if pers_def and pers_def.scale else None
                pers_value = _parse_personalisation_value(bmp.value_json, scale_type)

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
            "personalisation_key": metric.personalisation_key,
            "personalisation_value": pers_value,
            "personalisation_scale": _serialize_scale(pers_def.scale) if pers_def else None,
        })

    return {
        "matrix_id": matrix.matrix_id,
        "budgetid": budgetid,
        "name": matrix.name,
        "items": result_items,
    }


@router.get("/definitions", responses=error_responses(404))
def get_personalisation_definitions(budgetid: int, db: DbSession):
    """Get all available personalisation definitions with their scales."""
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    definitions = db.query(HealthPersonalisationDefinition).all()
    result = []
    for d in definitions:
        try:
            default_value = json.loads(d.default_value_json)
        except json.JSONDecodeError:
            default_value = d.default_value_json
        result.append({
            "personalisation_key": d.personalisation_key,
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


@router.patch("/personalisation/{metric_id}", responses=error_responses(404, 400))
def update_metric_personalisation(
    budgetid: int,
    metric_id: int,
    payload: dict,
    db: DbSession,
):
    """Update the personalisation value for a metric in this budget's matrix."""
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    metric = db.query(HealthMetric).filter_by(metric_id=metric_id, budgetid=budgetid).first()
    if not metric:
        raise HTTPException(404, "Metric not found")

    personalisation_key = payload.get("personalisation_key") or metric.personalisation_key
    value = payload.get("value")

    if not personalisation_key:
        raise HTTPException(400, "No personalisation key defined for this metric")

    pers_def = db.query(HealthPersonalisationDefinition).filter_by(
        personalisation_key=personalisation_key
    ).first()

    if pers_def and pers_def.scale:
        scale = pers_def.scale
        if scale.scale_type in ("integer_range", "decimal_range", "money") and value is not None:
            try:
                num_value = float(value)
                if scale.min_value is not None and num_value < float(scale.min_value):
                    raise HTTPException(400, f"Value must be >= {scale.min_value}")
                if scale.max_value is not None and num_value > float(scale.max_value):
                    raise HTTPException(400, f"Value must be <= {scale.max_value}")
            except ValueError:
                raise HTTPException(400, "Invalid numeric value")

    bmp = db.query(BudgetMetricPersonalisation).filter_by(
        budgetid=budgetid, metric_id=metric_id
    ).first()

    if bmp:
        bmp.value_json = json.dumps(value)
        bmp.personalisation_key = personalisation_key
        bmp.updated_at = datetime.now(timezone.utc)
    else:
        bmp = BudgetMetricPersonalisation(
            budgetid=budgetid,
            metric_id=metric_id,
            personalisation_key=personalisation_key,
            value_json=json.dumps(value),
        )
        db.add(bmp)

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
    - personalisation_key: str (optional)
    """
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    name = payload.get("name", "").strip()
    scope = payload.get("scope", "OVERALL")
    formula = payload.get("formula_expression", "").strip()
    data_sources = payload.get("data_sources", [])
    personalisation_key = payload.get("personalisation_key")

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

    if personalisation_key:
        pers_def = db.query(HealthPersonalisationDefinition).filter_by(
            personalisation_key=personalisation_key
        ).first()
        if not pers_def:
            raise HTTPException(400, f"Unknown personalisation key: {personalisation_key}")

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
        personalisation_key=personalisation_key,
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

    db.query(BudgetMetricPersonalisation).filter_by(
        budgetid=budgetid, metric_id=metric_id
    ).delete()

    metric = db.query(HealthMetric).filter_by(metric_id=metric_id, budgetid=budgetid).first()
    if metric and not metric.template_key:
        db.delete(metric)

    db.commit()
    return {"ok": True}
