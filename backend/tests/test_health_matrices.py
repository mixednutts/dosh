from __future__ import annotations

import pytest

from app.models import BudgetHealthMatrixItem, HealthMetric

from .factories import create_budget


def test_get_budget_health_matrix_404_when_budget_missing(client):
    response = client.get("/api/budgets/9999/health-matrix/")
    assert response.status_code == 404
    assert "Budget not found" in response.text


def test_get_budget_health_matrix_returns_default_matrix(client, db_session):
    budget = create_budget(db_session)
    response = client.get(f"/api/budgets/{budget.budgetid}/health-matrix/")
    assert response.status_code == 200
    data = response.json()
    assert data["budgetid"] == budget.budgetid
    assert "matrix_id" in data
    assert "items" in data
    assert len(data["items"]) > 0


def test_update_matrix_item(client, db_session):
    budget = create_budget(db_session)
    from app.models import BudgetHealthMatrix
    bhm = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    matrix = (
        db_session.query(BudgetHealthMatrixItem)
        .filter_by(matrix_id=bhm.matrix_id)
        .first()
    )
    metric_id = matrix.metric_id

    response = client.patch(
        f"/api/budgets/{budget.budgetid}/health-matrix/items/{metric_id}",
        json={"weight": 0.5, "scoring_sensitivity": 75, "is_enabled": False},
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True

    db_session.refresh(matrix)
    assert float(matrix.weight) == pytest.approx(0.5)
    assert matrix.scoring_sensitivity == 75
    assert matrix.is_enabled is False


def test_update_metric_personalisation(client, db_session):
    budget = create_budget(db_session)
    from app.models import BudgetHealthMatrix, HealthMetric, HealthPersonalisationDefinition, HealthScale
    bhm = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    matrix_item = (
        db_session.query(BudgetHealthMatrixItem)
        .filter_by(matrix_id=bhm.matrix_id)
        .first()
    )
    metric_id = matrix_item.metric_id
    metric = db_session.query(HealthMetric).filter_by(metric_id=metric_id).first()
    scale = db_session.query(HealthScale).first()
    if not scale:
        scale = HealthScale(scale_key="test_scale", name="Test Scale")
        db_session.add(scale)
        db_session.commit()
    db_session.add(HealthPersonalisationDefinition(
        personalisation_key="test_pers_key",
        name="Test",
        description="Test",
        scale_key=scale.scale_key,
        default_value_json="0",
    ))
    db_session.commit()
    metric.personalisation_key = "test_pers_key"
    db_session.commit()

    response = client.patch(
        f"/api/budgets/{budget.budgetid}/health-matrix/personalisation/{metric_id}",
        json={"value": 42.0},
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True


def test_get_data_sources(client, db_session):
    budget = create_budget(db_session)
    response = client.get(f"/api/budgets/{budget.budgetid}/health-matrix/data-sources")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for source in data:
        assert "source_key" in source
        assert "name" in source


def test_create_custom_metric(client, db_session):
    budget = create_budget(db_session)
    payload = {
        "name": "Custom Metric",
        "description": "A custom health metric",
        "scope": "CURRENT_PERIOD",
        "formula_expression": "total_budgeted_income - total_budgeted_expenses",
        "data_sources": ["total_budgeted_income", "total_budgeted_expenses"],
    }
    response = client.post(
        f"/api/budgets/{budget.budgetid}/health-matrix/metrics",
        json=payload,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Custom Metric"
    assert data["scope"] == "CURRENT_PERIOD"

    metric = db_session.query(HealthMetric).filter_by(metric_id=data["metric_id"]).first()
    assert metric is not None


def test_create_custom_metric_invalid_formula(client, db_session):
    budget = create_budget(db_session)
    payload = {
        "name": "Bad Metric",
        "scope": "OVERALL",
        "formula_expression": "1 + ",
        "data_sources": [],
    }
    response = client.post(
        f"/api/budgets/{budget.budgetid}/health-matrix/metrics",
        json=payload,
    )
    assert response.status_code == 400
    assert "Invalid formula" in response.text


def test_create_custom_metric_unknown_data_source(client, db_session):
    budget = create_budget(db_session)
    payload = {
        "name": "Bad Metric",
        "scope": "OVERALL",
        "formula_expression": "unknown_source",
        "data_sources": ["unknown_source"],
    }
    response = client.post(
        f"/api/budgets/{budget.budgetid}/health-matrix/metrics",
        json=payload,
    )
    assert response.status_code == 400
    assert "Unknown data sources" in response.text


def test_remove_matrix_item(client, db_session):
    budget = create_budget(db_session)
    from app.models import BudgetHealthMatrix
    bhm = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    matrix_item = (
        db_session.query(BudgetHealthMatrixItem)
        .filter_by(matrix_id=bhm.matrix_id)
        .first()
    )
    metric_id = matrix_item.metric_id

    response = client.delete(
        f"/api/budgets/{budget.budgetid}/health-matrix/items/{metric_id}"
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True

    assert (
        db_session.query(BudgetHealthMatrixItem)
        .filter_by(metric_id=metric_id)
        .first()
    ) is None
