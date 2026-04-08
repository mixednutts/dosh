from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from app.auto_expense import process_auto_expenses_for_period
from app.models import ExpenseItem, PeriodTransaction
from .factories import create_balance_type, create_budget, create_expense_item, create_income_type, generate_periods


def test_manual_to_auto_is_rejected_after_recorded_expense_activity(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    expense = ExpenseItem(
        budgetid=budget.budgetid,
        expensedesc="Rent",
        active=True,
        freqtype="Fixed Day of Month",
        frequency_value=15,
        paytype="MANUAL",
        effectivedate=datetime(2026, 1, 1),
        expenseamount=Decimal("1200.00"),
        sort_order=0,
        revisionnum=0,
    )
    db_session.add(expense)
    db_session.commit()

    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    entry_response = client.post(
        f"/api/periods/{period_id}/expenses/Rent/entries/",
        json={"amount": "1200.00", "note": "Paid manually"},
    )
    assert entry_response.status_code == 201, entry_response.text

    response = client.patch(
        f"/api/budgets/{budget.budgetid}/expense-items/Rent",
        json={"paytype": "AUTO"},
    )
    assert response.status_code == 422
    assert "recorded expense activity" in response.json()["detail"]


def test_auto_expense_run_creates_due_transaction_once(client, db_session):
    budget = create_budget(db_session)
    budget.auto_expense_enabled = True
    budget.auto_expense_offset_days = 0
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    expense = ExpenseItem(
        budgetid=budget.budgetid,
        expensedesc="Utilities",
        active=True,
        freqtype="Fixed Day of Month",
        frequency_value=2,
        paytype="AUTO",
        effectivedate=datetime(2026, 1, 1),
        expenseamount=Decimal("85.00"),
        sort_order=0,
        revisionnum=0,
    )
    db_session.add(expense)
    db_session.commit()

    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    first = process_auto_expenses_for_period(period_id, db_session, run_date=datetime(2026, 4, 2, 8, 0, 0))
    db_session.commit()
    assert first.created_count == 1

    second = process_auto_expenses_for_period(period_id, db_session, run_date=datetime(2026, 4, 2, 9, 0, 0))
    db_session.commit()
    assert second.created_count == 0

    txs = (
        db_session.query(PeriodTransaction)
        .filter(
            PeriodTransaction.finperiodid == period_id,
            PeriodTransaction.source == "expense",
            PeriodTransaction.source_key == "Utilities",
        )
        .all()
    )
    assert len(txs) == 1


def test_run_auto_expenses_endpoint_requires_budget_setting(client, db_session):
    budget = create_budget(db_session)
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    create_expense_item(
        db_session,
        budgetid=budget.budgetid,
        expensedesc="Utilities",
        freqtype="Fixed Day of Month",
        paytype="AUTO",
    )

    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    response = client.post(f"/api/periods/{period_id}/run-auto-expenses")
    assert response.status_code == 422
    assert "disabled" in response.json()["detail"].lower()
