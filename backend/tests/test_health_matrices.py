import json

from tests.factories import create_budget


def test_get_health_matrix(client, db_session):
    budget = create_budget(db_session)
    response = client.get(f"/api/budgets/{budget.budgetid}/health-matrix/")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert len(data["items"]) == 6
    metric_keys = {item["metric_key"] for item in data["items"]}
    assert metric_keys == {
        "setup_health",
        "budget_cycles_pending_closeout",
        "budget_vs_actual_amount",
        "budget_vs_actual_lines",
        "in_cycle_budget_adjustments",
        "revisions_on_paid_expenses",
    }


def test_update_matrix_item(client, db_session):
    budget = create_budget(db_session)
    response = client.get(f"/api/budgets/{budget.budgetid}/health-matrix/")
    assert response.status_code == 200
    data = response.json()
    metric_key = data["items"][0]["metric_key"]

    response = client.patch(
        f"/api/budgets/{budget.budgetid}/health-matrix/items/{metric_key}",
        json={"weight": 0.5, "scoring_sensitivity": 75, "is_enabled": False},
    )
    assert response.status_code == 200

    response = client.get(f"/api/budgets/{budget.budgetid}/health-matrix/")
    updated = response.json()
    item = next(i for i in updated["items"] if i["metric_key"] == metric_key)
    assert item["weight"] == 0.5
    assert item["scoring_sensitivity"] == 75
    assert item["is_enabled"] is False


def test_update_matrix_item_parameters(client, db_session):
    budget = create_budget(db_session)
    response = client.get(f"/api/budgets/{budget.budgetid}/health-matrix/")
    assert response.status_code == 200
    data = response.json()
    setup_item = next(i for i in data["items"] if i["metric_key"] == "setup_health")
    metric_key = setup_item["metric_key"]

    response = client.patch(
        f"/api/budgets/{budget.budgetid}/health-matrix/items/{metric_key}",
        json={"parameters": {"min_income_lines": 2, "min_expense_lines": 3}},
    )
    assert response.status_code == 200

    response = client.get(f"/api/budgets/{budget.budgetid}/health-matrix/")
    updated = response.json()
    item = next(i for i in updated["items"] if i["metric_key"] == metric_key)
    assert item["parameters"]["min_income_lines"] == 2
    assert item["parameters"]["min_expense_lines"] == 3


def test_update_matrix_item_not_found(client, db_session):
    budget = create_budget(db_session)
    response = client.patch(
        f"/api/budgets/{budget.budgetid}/health-matrix/items/setup_healthzzz",
        json={"weight": 0.5},
    )
    assert response.status_code == 404


def test_get_health_matrix_budget_not_found(client, db_session):
    response = client.get("/api/budgets/99999/health-matrix/")
    assert response.status_code == 404
