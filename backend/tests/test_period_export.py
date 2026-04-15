from __future__ import annotations

import csv
import io
from decimal import Decimal

from app.time_utils import utc_now

from .factories import create_minimum_budget_setup, generate_periods


def test_period_export_returns_404_for_missing_period(client):
    response = client.get(f"/api/budgets/{1}/periods/999999/export?format=csv")
    assert response.status_code == 404
    assert response.json()["detail"] == "Period not found"


def test_period_export_csv_includes_transaction_budget_adjustment_and_budget_only_rows(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )
    period = periods[0]
    period_id = period["finperiodid"]

    income_tx = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/income/Salary/transactions/",
        json={"amount": "2600.00", "note": "Main pay"},
    )
    assert income_tx.status_code == 201, income_tx.text

    expense_tx_1 = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/expenses/Rent/entries/",
        json={"amount": "400.00", "note": "First half"},
    )
    assert expense_tx_1.status_code == 201, expense_tx_1.text
    expense_tx_2 = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/expenses/Rent/entries/",
        json={"amount": "300.00", "note": "Second half"},
    )
    assert expense_tx_2.status_code == 201, expense_tx_2.text

    budget_adjustment = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/income/Salary/budget",
        json={"budgetamount": "2700.00", "scope": "current", "note": "Raise estimate"},
    )
    assert budget_adjustment.status_code == 200, budget_adjustment.text

    detail_response = client.get(f"/api/budgets/{budget.budgetid}/periods/{period_id}")
    assert detail_response.status_code == 200, detail_response.text
    detail_payload = detail_response.json()
    salary = next(item for item in detail_payload["incomes"] if item["incomedesc"] == "Salary")
    rent = next(item for item in detail_payload["expenses"] if item["expensedesc"] == "Rent")

    response = client.get(f"/api/budgets/{budget.budgetid}/periods/{period_id}/export?format=csv")
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment;" in response.headers["content-disposition"]
    assert '.csv"' in response.headers["content-disposition"]

    rows = list(csv.DictReader(io.StringIO(response.text)))
    assert rows

    rent_rows = [row for row in rows if row["line_type"] == "expense" and row["line_name"] == "Rent"]
    assert len(rent_rows) == 2
    assert {row["row_kind"] for row in rent_rows} == {"transaction"}
    assert {row["transaction_note"] for row in rent_rows} == {"First half", "Second half"}
    assert all(Decimal(row["line_actual_amount"]) == Decimal(rent["actualamount"]) for row in rent_rows)
    assert all(Decimal(row["line_remaining_amount"]) == Decimal(rent["remaining_amount"]) for row in rent_rows)

    salary_transaction_rows = [row for row in rows if row["line_type"] == "income" and row["line_name"] == "Salary"]
    assert len(salary_transaction_rows) == 2
    assert {row["row_kind"] for row in salary_transaction_rows} == {"transaction", "budget_adjustment"}
    assert all(Decimal(row["line_budget_amount"]) == Decimal(salary["budgetamount"]) for row in salary_transaction_rows)
    assert all(Decimal(row["line_actual_amount"]) == Decimal(salary["actualamount"]) for row in salary_transaction_rows)

    investment_rows = [row for row in rows if row["line_type"] == "investment" and row["line_name"] == "Emergency Fund"]
    assert len(investment_rows) == 1
    assert investment_rows[0]["row_kind"] == "budget_only"
    assert investment_rows[0]["transaction_id"] == ""
    assert Decimal(investment_rows[0]["line_budget_amount"]) == Decimal("0.00")


def test_period_export_json_preserves_closed_cycle_history(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    periods = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=2,
    )
    active_period = next(period for period in periods if period["cycle_status"] == "ACTIVE")

    income_tx = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/income/Salary/transactions/",
        json={"amount": "2500.00", "note": "Salary"},
    )
    assert income_tx.status_code == 201, income_tx.text

    closeout_response = client.post(
        f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/closeout",
        json={"create_next_cycle": False, "comments": "Closed cleanly."},
    )
    assert closeout_response.status_code == 200, closeout_response.text

    response = client.get(f"/api/budgets/{budget.budgetid}/periods/{active_period['finperiodid']}/export?format=json")
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("application/json")
    assert '.json"' in response.headers["content-disposition"]

    payload = response.json()
    assert payload["period"]["cycle_status"] == "CLOSED"
    assert payload["period"]["islocked"] is True
    assert payload["budget"]["budgetid"] == budget.budgetid
    assert any(row["line_name"] == "Salary" for row in payload["transactions"])
    assert any(row["row_kind"] == "budget_only" and row["line_name"] == "Emergency Fund" for row in payload["transactions"])
