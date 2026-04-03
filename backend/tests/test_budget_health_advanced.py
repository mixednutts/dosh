from __future__ import annotations

from decimal import Decimal

from app.time_utils import app_now_naive

from .factories import create_budget, create_expense_item, create_income_type, generate_periods


def _health_payload(client, budgetid: int) -> dict:
    response = client.get(f"/api/budgets/{budgetid}/health")
    assert response.status_code == 200, response.text
    return response.json()


def test_budget_health_revision_sensitivity_penalizes_revised_lines_more_when_higher(client, db_session):
    low_budget = create_budget(db_session, budgetowner="Low Sensitivity")
    high_budget = create_budget(db_session, budgetowner="High Sensitivity")

    for budget in (low_budget, high_budget):
        create_income_type(db_session, budgetid=budget.budgetid, amount=Decimal("2000.00"))
        create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent", expenseamount=Decimal("800.00"))
        create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Groceries", expenseamount=Decimal("200.00"), sort_order=1)

    client.patch(f"/api/budgets/{low_budget.budgetid}", json={"revision_sensitivity": 10})
    client.patch(f"/api/budgets/{high_budget.budgetid}", json={"revision_sensitivity": 100})

    startdate = app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0)
    low_period = generate_periods(client, budgetid=low_budget.budgetid, startdate=startdate, count=1)[0]
    high_period = generate_periods(client, budgetid=high_budget.budgetid, startdate=startdate, count=1)[0]

    for budgetid, finperiodid in (
        (low_budget.budgetid, low_period["finperiodid"]),
        (high_budget.budgetid, high_period["finperiodid"]),
    ):
        rent_paid = client.patch(f"/api/periods/{finperiodid}/expense/Rent/status", json={"status": "Paid"})
        assert rent_paid.status_code == 200, rent_paid.text
        rent_revised = client.patch(
            f"/api/periods/{finperiodid}/expense/Rent/status",
            json={"status": "Revised", "revision_comment": "Adjust rent"},
        )
        assert rent_revised.status_code == 200, rent_revised.text

        groceries_paid = client.patch(f"/api/periods/{finperiodid}/expense/Groceries/status", json={"status": "Paid"})
        assert groceries_paid.status_code == 200, groceries_paid.text
        groceries_revised = client.patch(
            f"/api/periods/{finperiodid}/expense/Groceries/status",
            json={"status": "Revised", "revision_comment": "Adjust groceries"},
        )
        assert groceries_revised.status_code == 200, groceries_revised.text

    low_health = _health_payload(client, low_budget.budgetid)
    high_health = _health_payload(client, high_budget.budgetid)

    assert high_health["current_period_check"]["score"] < low_health["current_period_check"]["score"]

    low_stability = next(pillar for pillar in low_health["pillars"] if pillar["key"] == "planning_stability")
    high_stability = next(pillar for pillar in high_health["pillars"] if pillar["key"] == "planning_stability")
    assert high_stability["score"] < low_stability["score"]


def test_budget_health_current_period_weighting_can_shift_overall_score_without_changing_other_pillars(client, db_session):
    healthy_budget = create_budget(db_session, budgetowner="Healthy Current")
    pressured_budget = create_budget(db_session, budgetowner="Pressured Current")

    for budget in (healthy_budget, pressured_budget):
        create_income_type(db_session, budgetid=budget.budgetid, amount=Decimal("1000.00"))
        create_expense_item(db_session, budgetid=budget.budgetid, expenseamount=Decimal("900.00"))

    startdate = app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0)
    healthy_period = generate_periods(client, budgetid=healthy_budget.budgetid, startdate=startdate, count=1)[0]
    pressured_period = generate_periods(client, budgetid=pressured_budget.budgetid, startdate=startdate, count=1)[0]

    healthy_actuals = client.patch(
        f"/api/periods/{healthy_period['finperiodid']}/income/Salary",
        json={"actualamount": "1000.00"},
    )
    assert healthy_actuals.status_code == 200, healthy_actuals.text

    pressured_income = client.patch(
        f"/api/periods/{pressured_period['finperiodid']}/income/Salary",
        json={"actualamount": "300.00"},
    )
    assert pressured_income.status_code == 200, pressured_income.text

    pressured_expense = client.patch(
        f"/api/periods/{pressured_period['finperiodid']}/expense/Rent",
        json={"actualamount": "1100.00"},
    )
    assert pressured_expense.status_code == 200, pressured_expense.text

    healthy_health = _health_payload(client, healthy_budget.budgetid)
    pressured_health = _health_payload(client, pressured_budget.budgetid)

    assert healthy_health["pillars"] == pressured_health["pillars"]
    assert healthy_health["current_period_check"]["score"] > pressured_health["current_period_check"]["score"]
    assert healthy_health["overall_score"] > pressured_health["overall_score"]
