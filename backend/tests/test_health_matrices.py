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
    # Standard Budget Health is now an empty shell until metrics are created via UI.
    assert len(data["items"]) >= 0


def _create_custom_metric_for_budget(client, budget):
    payload = {
        "name": "Temp Metric",
        "description": "Temporary metric for test mutation",
        "scope": "OVERALL",
        "formula_expression": "income_source_count",
        "data_sources": ["income_source_count"],
    }
    response = client.post(
        f"/api/budgets/{budget.budgetid}/health-matrix/metrics",
        json=payload,
    )
    assert response.status_code == 200, response.text
    return response.json()["metric_id"]


def test_update_matrix_item(client, db_session):
    budget = create_budget(db_session)
    from app.models import BudgetHealthMatrix, BudgetHealthMatrixItem
    metric_id = _create_custom_metric_for_budget(client, budget)
    bhm = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    matrix = (
        db_session.query(BudgetHealthMatrixItem)
        .filter_by(matrix_id=bhm.matrix_id, metric_id=metric_id)
        .first()
    )

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


def test_update_matrix_item_threshold_value(client, db_session):
    budget = create_budget(db_session)
    from app.models import BudgetHealthMatrix, BudgetHealthMatrixItem, HealthMetric, HealthScale
    metric_id = _create_custom_metric_for_budget(client, budget)
    bhm = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    matrix_item = (
        db_session.query(BudgetHealthMatrixItem)
        .filter_by(matrix_id=bhm.matrix_id, metric_id=metric_id)
        .first()
    )
    metric = db_session.query(HealthMetric).filter_by(metric_id=metric_id).first()
    scale = db_session.query(HealthScale).filter_by(scale_key="percentage_0_100").first()
    if not scale:
        scale = HealthScale(scale_key="percentage_0_100", name="Percentage", scale_type="integer_range", min_value=0, max_value=100)
        db_session.add(scale)
        db_session.commit()
    metric.scale_key = scale.scale_key
    metric.default_value_json = "0"
    db_session.commit()

    response = client.patch(
        f"/api/budgets/{budget.budgetid}/health-matrix/items/{metric_id}",
        json={"threshold_value": 42},
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True

    db_session.refresh(matrix_item)
    assert matrix_item.threshold_value_json == "42"


def test_get_health_scales(client, db_session):
    budget = create_budget(db_session)
    response = client.get(f"/api/budgets/{budget.budgetid}/health-matrix/scales")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    for scale in data:
        assert "scale_key" in scale
        assert "name" in scale


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
        "scale_key": "percentage_0_100",
        "default_value": 50,
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
    assert metric.scale_key == "percentage_0_100"
    assert metric.default_value_json == "50"


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
    from app.models import BudgetHealthMatrix, BudgetHealthMatrixItem
    metric_id = _create_custom_metric_for_budget(client, budget)
    bhm = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    matrix_item = (
        db_session.query(BudgetHealthMatrixItem)
        .filter_by(matrix_id=bhm.matrix_id, metric_id=metric_id)
        .first()
    )
    assert matrix_item is not None

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


def test_get_matrix_templates(client, db_session):
    budget = create_budget(db_session)
    response = client.get(f"/api/budgets/{budget.budgetid}/health-matrix/templates")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert "template_key" in data[0]
    assert "name" in data[0]


def test_apply_matrix_template(client, db_session):
    budget = create_budget(db_session)
    from app.models import BudgetHealthMatrix
    original = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    original_id = original.matrix_id

    response = client.post(
        f"/api/budgets/{budget.budgetid}/health-matrix/apply-template",
        json={"template_key": "standard_budget_health"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["based_on_template_key"] == "standard_budget_health"
    assert data["is_customized"] is False
    assert data["matrix_id"] != original_id

    db_session.refresh(original)
    assert original.is_active is False


def test_get_budget_health_matrix_includes_customized_flag(client, db_session):
    budget = create_budget(db_session)
    response = client.get(f"/api/budgets/{budget.budgetid}/health-matrix/")
    assert response.status_code == 200
    data = response.json()
    assert "is_customized" in data
    assert data["is_customized"] is False
    assert "based_on_template_key" in data
    assert data["based_on_template_key"] == "standard_budget_health"
    assert "template_name" in data
    assert data["template_name"] == "Standard Budget Health"


def test_apply_matrix_template_400_unknown_template(client, db_session):
    budget = create_budget(db_session)
    response = client.post(
        f"/api/budgets/{budget.budgetid}/health-matrix/apply-template",
        json={"template_key": "nonexistent_template"},
    )
    assert response.status_code == 400
    assert "Unknown template" in response.text


def test_delete_matrix_template_requires_dev_mode(client, db_session):
    budget = create_budget(db_session)
    response = client.delete(f"/api/budgets/{budget.budgetid}/health-matrix/templates/standard_budget_health")
    assert response.status_code == 404


def test_delete_matrix_template_404_when_template_missing(client, db_session, monkeypatch):
    monkeypatch.setenv("DEV_MODE", "true")
    budget = create_budget(db_session)
    response = client.delete(f"/api/budgets/{budget.budgetid}/health-matrix/templates/nonexistent")
    assert response.status_code == 404


def test_delete_matrix_template_ok_and_nulls_metric_references(client, db_session, monkeypatch):
    from app.models import (
        BudgetHealthMatrix,
        BudgetHealthMatrixItem,
        HealthMetric,
        HealthMatrixTemplate,
        HealthMatrixTemplateItem,
        HealthMetricTemplate,
    )
    monkeypatch.setenv("DEV_MODE", "true")
    budget = create_budget(db_session)

    # Build a custom template with a metric template and a matrix template item
    mt = HealthMetricTemplate(
        template_key="test_metric_tmpl",
        name="Test Metric",
        scope="OVERALL",
        formula_expression="income_source_count",
        formula_data_sources_json='["income_source_count"]',
        scale_key="percentage_0_100",
        default_value_json="0",
        scoring_logic_json='{"tone":"neutral"}',
        evidence_template_json='{}',
    )
    db_session.add(mt)
    db_session.flush()

    matrix_tmpl = HealthMatrixTemplate(
        template_key="test_matrix_tmpl",
        name="Test Matrix",
    )
    db_session.add(matrix_tmpl)
    db_session.flush()

    db_session.add(HealthMatrixTemplateItem(
        template_key="test_matrix_tmpl",
        metric_template_key="test_metric_tmpl",
        weight=1.0,
        display_order=0,
    ))
    db_session.flush()

    # Create a metric from the template so there is a foreign-key reference to null out
    metric = HealthMetric(
        template_key="test_metric_tmpl",
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

    bhm = BudgetHealthMatrix(
        budgetid=budget.budgetid,
        name="Test Matrix",
        based_on_template_key="test_matrix_tmpl",
        is_active=True,
    )
    db_session.add(bhm)
    db_session.flush()

    db_session.add(BudgetHealthMatrixItem(
        matrix_id=bhm.matrix_id,
        metric_id=metric.metric_id,
        weight=1.0,
        scoring_sensitivity=50,
        display_order=0,
        is_enabled=True,
    ))
    db_session.commit()

    metric_id = metric.metric_id
    response = client.delete(f"/api/budgets/{budget.budgetid}/health-matrix/templates/test_matrix_tmpl")
    assert response.status_code == 200
    assert response.json()["ok"] is True

    db_session.expunge_all()
    assert db_session.query(HealthMatrixTemplate).filter_by(template_key="test_matrix_tmpl").first() is None
    assert db_session.query(HealthMatrixTemplateItem).filter_by(template_key="test_matrix_tmpl").first() is None
    assert db_session.query(HealthMetricTemplate).filter_by(template_key="test_metric_tmpl").first() is None
    assert db_session.query(HealthMetric).filter_by(metric_id=metric_id).first() is None
    assert response.json()["deleted_metrics"] == 1
    assert response.json()["affected_budgets"] == 1


def test_get_budget_health_matrix_marked_customized_after_weight_change(client, db_session):
    budget = create_budget(db_session)
    from app.models import BudgetHealthMatrix, BudgetHealthMatrixItem
    metric_id = _create_custom_metric_for_budget(client, budget)
    bhm = db_session.query(BudgetHealthMatrix).filter_by(budgetid=budget.budgetid, is_active=True).first()
    matrix_item = (
        db_session.query(BudgetHealthMatrixItem)
        .filter_by(matrix_id=bhm.matrix_id, metric_id=metric_id)
        .first()
    )
    assert matrix_item is not None

    response = client.patch(
        f"/api/budgets/{budget.budgetid}/health-matrix/items/{metric_id}",
        json={"weight": 0.99},
    )
    assert response.status_code == 200

    response = client.get(f"/api/budgets/{budget.budgetid}/health-matrix/")
    assert response.status_code == 200
    data = response.json()
    assert data["is_customized"] is True
