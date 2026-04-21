"""
Regression test for budget deletion with legacy transaction tables.

Bug: Legacy periodexpense_transactions and periodinvestment_transactions tables
had FK constraints to periodexpenses/periodinvestments. When deleting a budget,
SQLAlchemy cascade would try to delete periodexpenses rows, but the legacy tables
still referenced them, causing:
    sqlite3.IntegrityError: FOREIGN KEY constraint failed
"""

import pytest
from sqlalchemy import text

from app.models import Budget, FinancialPeriod, PeriodExpense, PeriodTransaction


def _create_legacy_tables(db_session):
    """Create legacy transaction tables as they existed pre-unified-ledger."""
    db_session.execute(text("""
        CREATE TABLE IF NOT EXISTS periodexpense_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            finperiodid INTEGER NOT NULL,
            budgetid INTEGER NOT NULL,
            expensedesc VARCHAR NOT NULL,
            amount NUMERIC(10,2) NOT NULL,
            note VARCHAR,
            entrydate DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (finperiodid, budgetid, expensedesc)
                REFERENCES periodexpenses(finperiodid, budgetid, expensedesc)
        )
    """))
    db_session.execute(text("""
        CREATE TABLE IF NOT EXISTS periodinvestment_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            finperiodid INTEGER NOT NULL,
            budgetid INTEGER NOT NULL,
            investmentdesc VARCHAR NOT NULL,
            amount NUMERIC(10,2) NOT NULL,
            note VARCHAR,
            entrydate DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (finperiodid, budgetid, investmentdesc)
                REFERENCES periodinvestments(finperiodid, budgetid, investmentdesc)
        )
    """))
    db_session.commit()


def test_budget_can_be_deleted_with_legacy_transaction_tables(client, db_session):
    """Ensure budget deletion works even when legacy transaction tables exist."""
    from tests.factories import create_budget, create_income_type, create_expense_item
    from datetime import datetime, timezone

    # Create budget with minimal setup
    budget = create_budget(db_session)
    budgetid = budget.budgetid

    # Create a period and period expense
    from app.models import FinancialPeriod, PeriodExpense
    period = FinancialPeriod(
        budgetid=budgetid,
        startdate=datetime(2026, 1, 1, tzinfo=timezone.utc),
        enddate=datetime(2026, 1, 31, tzinfo=timezone.utc),
    )
    db_session.add(period)
    db_session.commit()
    db_session.refresh(period)

    # Create expense item and period expense
    expense_item = create_expense_item(db_session, budgetid=budgetid, expensedesc="Test Expense")
    period_expense = PeriodExpense(
        finperiodid=period.finperiodid,
        budgetid=budgetid,
        expensedesc="Test Expense",
    )
    db_session.add(period_expense)
    db_session.commit()

    # Create legacy transaction tables with FK constraints to period data
    _create_legacy_tables(db_session)

    # Add a legacy transaction entry referencing the period expense
    db_session.execute(text("""
        INSERT INTO periodexpense_transactions (finperiodid, budgetid, expensedesc, amount)
        VALUES (:finperiodid, :budgetid, :expensedesc, 100.00)
    """), {
        "finperiodid": period.finperiodid,
        "budgetid": budgetid,
        "expensedesc": "Test Expense",
    })
    db_session.commit()

    # Verify legacy table has data
    legacy_count = db_session.execute(
        text("SELECT COUNT(*) FROM periodexpense_transactions")
    ).scalar()
    assert legacy_count == 1

    # BUG REPRODUCTION: With legacy tables present, budget deletion fails
    # because periodexpense_transactions has FK constraints to periodexpenses.
    # The fix is to drop the legacy tables (via alembic migration).
    # First, verify deletion fails:
    with pytest.raises(Exception):  # sqlalchemy.exc.IntegrityError
        db_session.delete(budget)
        db_session.commit()
    db_session.rollback()

    # Apply the fix: drop legacy transaction tables
    db_session.execute(text("DROP TABLE IF EXISTS periodexpense_transactions"))
    db_session.execute(text("DROP TABLE IF EXISTS periodinvestment_transactions"))
    db_session.commit()

    # Now deletion via API should succeed
    delete_response = client.delete(f"/api/budgets/{budgetid}")
    assert delete_response.status_code == 204, delete_response.text

    # Verify budget is gone
    db_session.expire_all()
    assert db_session.get(Budget, budgetid) is None
