from __future__ import annotations

from decimal import Decimal

from app.models import PeriodExpense, PeriodIncome
from app.time_utils import app_now_naive

from .factories import create_balance_type, create_budget, create_expense_item, create_income_type, generate_periods


def _health_payload(client, budgetid: int) -> dict:
    response = client.get(f"/api/budgets/{budgetid}/health")
    assert response.status_code == 200, response.text
    return response.json()


def _create_budget_via_api(client, *, budgetowner: str) -> int:
    response = client.post(
        "/api/budgets/",
        json={
            "budgetowner": budgetowner,
            "description": f"{budgetowner} budget",
            "budget_frequency": "Monthly",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["budgetid"]


def test_budget_health_revision_sensitivity_penalizes_revised_lines_more_when_higher(client, db_session):
    low_budgetid = _create_budget_via_api(client, budgetowner="Low Sensitivity")
    high_budgetid = _create_budget_via_api(client, budgetowner="High Sensitivity")

    for budgetid in (low_budgetid, high_budgetid):
        create_income_type(db_session, budgetid=budgetid, amount=Decimal("2000.00"))
        create_expense_item(db_session, budgetid=budgetid, expensedesc="Rent", expenseamount=Decimal("800.00"))
        create_expense_item(db_session, budgetid=budgetid, expensedesc="Groceries", expenseamount=Decimal("200.00"), sort_order=1)
        create_balance_type(db_session, budgetid=budgetid, balancedesc="Main Account", is_primary=True)

    low_update = client.patch(f"/api/budgets/{low_budgetid}", json={"revision_sensitivity": 10})
    assert low_update.status_code == 200, low_update.text
    high_update = client.patch(f"/api/budgets/{high_budgetid}", json={"revision_sensitivity": 100})
    assert high_update.status_code == 200, high_update.text

    startdate = app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0)
    low_period = generate_periods(client, budgetid=low_budgetid, startdate=startdate, count=1)[0]
    high_period = generate_periods(client, budgetid=high_budgetid, startdate=startdate, count=1)[0]

    for budgetid, finperiodid in (
        (low_budgetid, low_period["finperiodid"]),
        (high_budgetid, high_period["finperiodid"]),
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

    low_health = _health_payload(client, low_budgetid)
    high_health = _health_payload(client, high_budgetid)

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
        create_balance_type(db_session, budgetid=budget.budgetid, balancedesc="Main Account", is_primary=True)

    startdate = app_now_naive().replace(hour=0, minute=0, second=0, microsecond=0)
    healthy_period = generate_periods(client, budgetid=healthy_budget.budgetid, startdate=startdate, count=1)[0]
    pressured_period = generate_periods(client, budgetid=pressured_budget.budgetid, startdate=startdate, count=1)[0]

    healthy_income = db_session.query(PeriodIncome).filter_by(finperiodid=healthy_period["finperiodid"], incomedesc="Salary").one()
    healthy_income.actualamount = Decimal("1000.00")

    pressured_income = db_session.query(PeriodIncome).filter_by(finperiodid=pressured_period["finperiodid"], incomedesc="Salary").one()
    pressured_income.actualamount = Decimal("300.00")

    pressured_expense = db_session.query(PeriodExpense).filter_by(finperiodid=pressured_period["finperiodid"], expensedesc="Rent").one()
    pressured_expense.actualamount = Decimal("1100.00")
    pressured_expense.varianceamount = Decimal("200.00")

    db_session.commit()

    healthy_health = _health_payload(client, healthy_budget.budgetid)
    pressured_health = _health_payload(client, pressured_budget.budgetid)

    assert healthy_health["pillars"] == pressured_health["pillars"]
    assert healthy_health["current_period_check"]["score"] > pressured_health["current_period_check"]["score"]
    assert healthy_health["overall_score"] > pressured_health["overall_score"]
