from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from app.auto_expense import (
    process_auto_expenses_for_period,
    expense_has_valid_schedule,
    normalize_expense_paytype,
    scheduled_due_dates_for_period,
    effective_run_date,
)
from app.models import ExpenseItem, FinancialPeriod, PeriodTransaction
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
        f"/api/budgets/{budget.budgetid}/periods/{period_id}/expenses/Rent/entries/",
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

    response = client.post(f"/api/budgets/{budget.budgetid}/periods/{period_id}/run-auto-expenses")
    assert response.status_code == 422
    assert "disabled" in response.json()["detail"].lower()


def test_auto_expense_run_uses_next_day_rollover_for_missing_fixed_day(client, db_session):
    budget = create_budget(db_session)
    budget.auto_expense_enabled = True
    budget.auto_expense_offset_days = 0
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    expense = ExpenseItem(
        budgetid=budget.budgetid,
        expensedesc="Month End Bill",
        active=True,
        freqtype="Fixed Day of Month",
        frequency_value=31,
        paytype="AUTO",
        effectivedate=datetime(2026, 1, 1),
        expenseamount=Decimal("85.00"),
        sort_order=0,
        revisionnum=0,
    )
    db_session.add(expense)
    db_session.commit()

    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 5, 1))
    period_id = periods[0]["finperiodid"]

    first = process_auto_expenses_for_period(period_id, db_session, run_date=datetime(2026, 5, 1, 8, 0, 0))
    db_session.commit()
    assert first.created_count == 1

    tx = (
        db_session.query(PeriodTransaction)
        .filter(
            PeriodTransaction.finperiodid == period_id,
            PeriodTransaction.source == "expense",
            PeriodTransaction.source_key == "Month End Bill",
        )
        .one()
    )

    assert tx.note == "Auto expense created for due date 2026-05-01"


# ---------------------------------------------------------------------------
# Pure logic tests for uncovered helper functions
# ---------------------------------------------------------------------------


def test_expense_has_valid_schedule_rejects_always():
    item = ExpenseItem(freqtype="Always", frequency_value=1, effectivedate=datetime(2026, 1, 1))
    assert expense_has_valid_schedule(item) is False


def test_expense_has_valid_schedule_accepts_scheduled():
    item = ExpenseItem(freqtype="Fixed Day of Month", frequency_value=15, effectivedate=datetime(2026, 1, 1))
    assert expense_has_valid_schedule(item) is True


def test_expense_has_valid_schedule_rejects_incomplete():
    item = ExpenseItem(freqtype="Fixed Day of Month", frequency_value=None, effectivedate=datetime(2026, 1, 1))
    assert expense_has_valid_schedule(item) is False


def test_normalize_expense_paytype_defaults_none_to_manual():
    assert normalize_expense_paytype(paytype=None, freqtype="Always", frequency_value=None, effectivedate=None) == "MANUAL"


def test_normalize_expense_paytype_preserves_manual():
    assert normalize_expense_paytype(paytype="MANUAL", freqtype="Always", frequency_value=None, effectivedate=None) == "MANUAL"


def test_normalize_expense_paytype_rejects_auto_for_always():
    with pytest.raises(ValueError, match="AUTO is only available for scheduled expenses"):
        normalize_expense_paytype(paytype="AUTO", freqtype="Always", frequency_value=1, effectivedate=datetime(2026, 1, 1))


def test_normalize_expense_paytype_rejects_auto_without_schedule():
    with pytest.raises(ValueError, match="AUTO is only available for scheduled expenses with a complete schedule"):
        normalize_expense_paytype(paytype="AUTO", freqtype="Fixed Day of Month", frequency_value=None, effectivedate=None)


def test_normalize_expense_paytype_accepts_auto_with_schedule():
    assert normalize_expense_paytype(
        paytype="AUTO", freqtype="Fixed Day of Month", frequency_value=15, effectivedate=datetime(2026, 1, 1)
    ) == "AUTO"


def test_effective_run_date_on_period_end_returns_due_date():
    due = datetime(2026, 4, 30, 10, 0, 0)
    period_end = datetime(2026, 4, 30, 0, 0, 0)
    assert effective_run_date(due_date=due, period_end=period_end, offset_days=2) == due


def test_effective_run_date_before_end_adds_offset():
    due = datetime(2026, 4, 15, 10, 0, 0)
    period_end = datetime(2026, 4, 30, 0, 0, 0)
    assert effective_run_date(due_date=due, period_end=period_end, offset_days=2) == datetime(2026, 4, 17, 10, 0, 0)


def test_scheduled_due_dates_for_period_fixed_day_of_month():
    item = ExpenseItem(
        budgetid=1,
        expensedesc="Test",
        freqtype="Fixed Day of Month",
        frequency_value=15,
        effectivedate=datetime(2026, 1, 1),
        expenseamount=Decimal("100.00"),
    )
    period = FinancialPeriod(startdate=datetime(2026, 4, 1), enddate=datetime(2026, 4, 30))
    dates = scheduled_due_dates_for_period(item, period)
    assert len(dates) == 1
    assert dates[0].day == 15


def test_scheduled_due_dates_for_period_every_n_days():
    item = ExpenseItem(
        budgetid=1,
        expensedesc="Test",
        freqtype="Every N Days",
        frequency_value=7,
        effectivedate=datetime(2026, 4, 1),
        expenseamount=Decimal("100.00"),
    )
    period = FinancialPeriod(startdate=datetime(2026, 4, 1), enddate=datetime(2026, 4, 30))
    dates = scheduled_due_dates_for_period(item, period)
    assert len(dates) == 5  # 1, 8, 15, 22, 29
    assert dates[0].day == 1
    assert dates[-1].day == 29


def test_scheduled_due_dates_for_period_skips_before_period_start():
    item = ExpenseItem(
        budgetid=1,
        expensedesc="Test",
        freqtype="Every N Days",
        frequency_value=7,
        effectivedate=datetime(2026, 3, 1),
        expenseamount=Decimal("100.00"),
    )
    period = FinancialPeriod(startdate=datetime(2026, 4, 5), enddate=datetime(2026, 4, 30))
    dates = scheduled_due_dates_for_period(item, period)
    assert all(d >= period.startdate for d in dates)


def test_scheduled_due_dates_for_period_no_valid_schedule_returns_empty():
    item = ExpenseItem(budgetid=1, expensedesc="Test", freqtype="Always", frequency_value=None, effectivedate=None)
    period = FinancialPeriod(startdate=datetime(2026, 4, 1), enddate=datetime(2026, 4, 30))
    assert scheduled_due_dates_for_period(item, period) == []


# ---------------------------------------------------------------------------
# Integration tests for process_auto_expenses_for_period edge cases
# ---------------------------------------------------------------------------


def test_process_auto_expenses_skips_when_period_not_found(db_session):
    result = process_auto_expenses_for_period(99999, db_session)
    assert result.created_count == 0
    assert result.skipped_count == 1
    assert "Period not found" in result.skipped_reasons


def test_process_auto_expenses_skips_when_budget_disabled(client, db_session):
    budget = create_budget(db_session)
    budget.auto_expense_enabled = False
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Utilities", freqtype="Fixed Day of Month", paytype="AUTO")
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    result = process_auto_expenses_for_period(period_id, db_session, run_date=datetime(2026, 4, 2))
    assert result.created_count == 0
    assert result.skipped_count == 1
    assert "disabled" in result.skipped_reasons[0]


def test_process_auto_expenses_skips_when_no_primary_account(client, db_session):
    budget = create_budget(db_session)
    budget.auto_expense_enabled = True
    create_income_type(db_session, budgetid=budget.budgetid)
    # Create a balance type but NOT primary — generation needs a primary, so create one,
    # generate periods, then flip it to non-primary to test the auto-expense skip path.
    bt = create_balance_type(db_session, budgetid=budget.budgetid, is_primary=True)
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Utilities", freqtype="Fixed Day of Month", paytype="AUTO")
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    bt.is_primary = False
    db_session.commit()

    result = process_auto_expenses_for_period(period_id, db_session, run_date=datetime(2026, 4, 2))
    assert result.created_count == 0
    assert result.skipped_count == 1
    assert "No primary account" in result.skipped_reasons[0]


def test_process_auto_expenses_skips_paid_expense(client, db_session):
    budget = create_budget(db_session)
    budget.auto_expense_enabled = True
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    create_expense_item(
        db_session,
        budgetid=budget.budgetid,
        expensedesc="Utilities",
        freqtype="Fixed Day of Month",
        frequency_value=2,
        paytype="AUTO",
        effectivedate=datetime(2026, 1, 1),
    )
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    from app.models import PeriodExpense
    pes = db_session.query(PeriodExpense).filter_by(finperiodid=period_id, expensedesc="Utilities").all()
    assert len(pes) == 1
    pes[0].status = "Paid"
    db_session.commit()

    result = process_auto_expenses_for_period(period_id, db_session, run_date=datetime(2026, 4, 2))
    assert result.created_count == 0
    assert any("Paid" in r for r in result.skipped_reasons)


def test_process_auto_expenses_skips_when_run_day_in_future(client, db_session):
    budget = create_budget(db_session)
    budget.auto_expense_enabled = True
    budget.auto_expense_offset_days = 5
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    create_expense_item(
        db_session,
        budgetid=budget.budgetid,
        expensedesc="Utilities",
        freqtype="Fixed Day of Month",
        frequency_value=2,
        paytype="AUTO",
        effectivedate=datetime(2026, 1, 1),
    )
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    # Due date is the 2nd, with offset 5 the run_day becomes the 7th.
    # Running on the 1st should skip because run_day (7th) > today (1st).
    result = process_auto_expenses_for_period(period_id, db_session, run_date=datetime(2026, 4, 1))
    assert result.created_count == 0
    # When all due dates are skipped because run_day is in the future,
    # the expense loop body never executes, so skipped_count stays 0.
    # This is correct behavior — verify no transactions were created.
    txs = (
        db_session.query(PeriodTransaction)
        .filter_by(finperiodid=period_id, source="expense", source_key="Utilities")
        .all()
    )
    assert len(txs) == 0


def test_process_auto_expenses_skips_non_auto_expense(client, db_session):
    budget = create_budget(db_session)
    budget.auto_expense_enabled = True
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Rent", freqtype="Always", paytype="MANUAL")
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    result = process_auto_expenses_for_period(period_id, db_session, run_date=datetime(2026, 4, 2))
    assert result.created_count == 0
    assert any("not set to AUTO" in r for r in result.skipped_reasons)


def test_process_auto_expenses_skips_closed_period(client, db_session):
    budget = create_budget(db_session)
    budget.auto_expense_enabled = True
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid, expensedesc="Utilities", freqtype="Fixed Day of Month", paytype="AUTO")
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    period = db_session.get(FinancialPeriod, period_id)
    period.cycle_status = "CLOSED"
    db_session.commit()

    result = process_auto_expenses_for_period(period_id, db_session, run_date=datetime(2026, 4, 2))
    assert result.created_count == 0
    assert any("closed" in r.lower() for r in result.skipped_reasons)


def test_process_auto_expenses_with_naive_run_date_gets_utc_timezone(client, db_session):
    budget = create_budget(db_session)
    budget.auto_expense_enabled = True
    budget.auto_expense_offset_days = 0
    create_income_type(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    create_expense_item(
        db_session,
        budgetid=budget.budgetid,
        expensedesc="Utilities",
        freqtype="Fixed Day of Month",
        frequency_value=2,
        paytype="AUTO",
        effectivedate=datetime(2026, 1, 1),
    )
    periods = generate_periods(client, budgetid=budget.budgetid, startdate=datetime(2026, 4, 1))
    period_id = periods[0]["finperiodid"]

    naive_date = datetime(2026, 4, 2, 10, 0, 0)
    assert naive_date.tzinfo is None
    result = process_auto_expenses_for_period(period_id, db_session, run_date=naive_date)
    db_session.commit()
    assert result.created_count == 1


import pytest
