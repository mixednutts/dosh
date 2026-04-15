from __future__ import annotations

import json
from decimal import Decimal

from fastapi import APIRouter, HTTPException

from ..api_docs import DbSession, error_responses
from ..health_engine_seed import create_matrix_from_template
from ..models import (
    Budget,
    BudgetHealthMatrix,
    BudgetHealthMatrixItem,
    HealthDataSource,
    HealthMetric,
    HealthMatrixTemplate,
    HealthMatrixTemplateItem,
    HealthMetricTemplate,
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


def _parse_threshold_value(value_json: str | None, scale_type: str | None) -> int | float | str | None:
    """Parse a threshold value from JSON based on scale type."""
    if value_json is None:
        return None
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

    template_defaults = {}
    if matrix.based_on_template_key:
        template_items = db.query(HealthMatrixTemplateItem).filter_by(
            template_key=matrix.based_on_template_key
        ).all()
        template_defaults = {
            ti.metric_template_key: {
                "weight": float(ti.weight),
                "scoring_sensitivity": 50,
                "is_enabled": True,
            }
            for ti in template_items
        }

    is_customized = False
    result_items = []
    for item in items:
        metric = item.metric
        if not metric:
            continue

        if metric.template_key is None:
            is_customized = True

        defaults = template_defaults.get(metric.template_key or "")
        if defaults is not None:
            if (
                float(item.weight) != defaults["weight"]
                or item.scoring_sensitivity != defaults["scoring_sensitivity"]
                or item.is_enabled != defaults["is_enabled"]
            ):
                is_customized = True
        elif metric.template_key:
            is_customized = True

        scale = metric.scale
        threshold_value = _parse_threshold_value(item.threshold_value_json, scale.scale_type if scale else None)
        default_value = _parse_threshold_value(metric.default_value_json, scale.scale_type if scale else None)
        if threshold_value != default_value:
            is_customized = True

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
            "threshold_value": threshold_value,
            "threshold_scale": _serialize_scale(scale),
        })

    template_name = None
    if matrix.based_on_template_key:
        template = db.query(HealthMatrixTemplate).filter_by(
            template_key=matrix.based_on_template_key
        ).first()
        template_name = template.name if template else None

    return {
        "matrix_id": matrix.matrix_id,
        "budgetid": budgetid,
        "name": matrix.name,
        "based_on_template_key": matrix.based_on_template_key,
        "template_name": template_name,
        "is_customized": is_customized,
        "items": result_items,
    }


@router.get("/templates", responses=error_responses(404))
def get_matrix_templates(budgetid: int, db: DbSession):
    """List available health matrix templates."""
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    templates = db.query(HealthMatrixTemplate).order_by(HealthMatrixTemplate.name).all()
    return [
        {
            "template_key": t.template_key,
            "name": t.name,
            "description": t.description,
            "is_system": t.is_system,
        }
        for t in templates
    ]


@router.post("/apply-template", responses=error_responses(404, 400))
def apply_matrix_template(
    budgetid: int,
    payload: dict,
    db: DbSession,
):
    """Apply a matrix template to this budget, replacing the current active matrix."""
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    template_key = payload.get("template_key", "").strip()
    if not template_key:
        raise HTTPException(400, "template_key is required")

    template = db.query(HealthMatrixTemplate).filter_by(template_key=template_key).first()
    if not template:
        raise HTTPException(400, f"Unknown template: {template_key}")

    matrix = create_matrix_from_template(db, budget, template_key)
    db.commit()

    return {
        "matrix_id": matrix.matrix_id,
        "budgetid": budgetid,
        "name": matrix.name,
        "based_on_template_key": matrix.based_on_template_key,
        "is_customized": False,
    }


@router.patch("/items/{metric_id}", responses=error_responses(404, 400))
def update_matrix_item(
    budgetid: int,
    metric_id: int,
    payload: dict,
    db: DbSession,
):
    """Update a matrix item's weight, sensitivity, enablement, or threshold value."""
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
    if "threshold_value" in payload:
        value = payload["threshold_value"]
        # Validate against metric scale if present
        metric = item.metric
        if metric and metric.scale:
            scale = metric.scale
            if scale.scale_type in ("integer_range", "decimal_range", "money") and value is not None:
                try:
                    num_value = float(value)
                    if scale.min_value is not None and num_value < float(scale.min_value):
                        raise HTTPException(400, f"Value must be >= {scale.min_value}")
                    if scale.max_value is not None and num_value > float(scale.max_value):
                        raise HTTPException(400, f"Value must be <= {scale.max_value}")
                except ValueError:
                    raise HTTPException(400, "Invalid numeric value")
        item.threshold_value_json = json.dumps(value)

    db.commit()
    db.refresh(item)
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


@router.get("/scales", responses=error_responses(404))
def get_health_scales(budgetid: int, db: DbSession):
    """List available HealthScale catalog entries for metric building."""
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    scales = db.query(HealthScale).order_by(HealthScale.name).all()
    return [_serialize_scale(s) for s in scales]


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
    - scale_key: str (optional)
    - default_value: any (optional)
    """
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    name = payload.get("name", "").strip()
    scope = payload.get("scope", "OVERALL")
    formula = payload.get("formula_expression", "").strip()
    data_sources = payload.get("data_sources", [])
    scale_key = payload.get("scale_key")
    default_value = payload.get("default_value")

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

    if scale_key:
        scale = db.query(HealthScale).filter_by(scale_key=scale_key).first()
        if not scale:
            raise HTTPException(400, f"Unknown scale key: {scale_key}")
        if scale.scale_type in ("integer_range", "decimal_range", "money") and default_value is not None:
            try:
                num_value = float(default_value)
                if scale.min_value is not None and num_value < float(scale.min_value):
                    raise HTTPException(400, f"Value must be >= {scale.min_value}")
                if scale.max_value is not None and num_value > float(scale.max_value):
                    raise HTTPException(400, f"Value must be <= {scale.max_value}")
            except ValueError:
                raise HTTPException(400, "Invalid numeric value")

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
        scale_key=scale_key,
        default_value_json=json.dumps(default_value),
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
            threshold_value_json=json.dumps(default_value),
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

    metric = db.query(HealthMetric).filter_by(metric_id=metric_id, budgetid=budgetid).first()
    if metric and not metric.template_key:
        db.delete(metric)

    db.commit()
    return {"ok": True}
