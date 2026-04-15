from __future__ import annotations

from app.models import PeriodTransaction
from app.time_utils import utc_now

from .factories import create_minimum_budget_setup, generate_periods


def test_direct_actual_updates_create_system_ledger_rows_and_source_filters(client, db_session):
    setup = create_minimum_budget_setup(db_session)
    budget = setup["budget"]
    active_period = generate_periods(
        client,
        budgetid=budget.budgetid,
        startdate=utc_now().replace(hour=0, minute=0, second=0, microsecond=0),
        count=1,
    )[0]
    finperiodid = active_period["finperiodid"]

    income_update = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/income/Salary",
        json={"actualamount": "500.00"},
    )
    assert income_update.status_code == 200, income_update.text

    expense_update = client.patch(
        f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/expense/Rent",
        json={"actualamount": "125.00"},
    )
    assert expense_update.status_code == 200, expense_update.text

    period_transactions = client.get(f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/transactions")
    assert period_transactions.status_code == 200, period_transactions.text
    payload = period_transactions.json()
    assert len(payload) == 2
    assert all(tx["is_system"] is True for tx in payload)
    assert {tx["system_reason"] for tx in payload} == {"income_actual_set", "expense_actual_set"}

    income_only = client.get(f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/transactions?source=income")
    assert income_only.status_code == 200, income_only.text
    assert len(income_only.json()) == 1
    assert income_only.json()[0]["source_key"] == "Salary"

    expense_only = client.get(f"/api/budgets/{budget.budgetid}/periods/{finperiodid}/transactions?source=expense&source_key=Rent")
    assert expense_only.status_code == 200, expense_only.text
    assert len(expense_only.json()) == 1
    assert expense_only.json()[0]["source_key"] == "Rent"

    db_rows = (
        db_session.query(PeriodTransaction)
        .filter(PeriodTransaction.finperiodid == finperiodid)
        .order_by(PeriodTransaction.id)
        .all()
    )
    assert len(db_rows) == 2
    assert db_rows[0].is_system is True
    assert db_rows[1].is_system is True
