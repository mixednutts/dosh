from __future__ import annotations

import sqlite3

from .migration_helpers import HEAD_REVISION, current_revision, upgrade_database


def test_clean_database_upgrade_reaches_head_and_has_budget_preference_columns(tmp_path):
    db_path = tmp_path / "clean-upgrade.sqlite3"

    upgrade_database(db_path, "head")

    with sqlite3.connect(db_path) as connection:
        budget_columns = {
            row[1]: row
            for row in connection.execute("PRAGMA table_info(budgets)").fetchall()
        }

    assert current_revision(db_path) == HEAD_REVISION
    assert "auto_expense_enabled" in budget_columns
    assert "auto_expense_offset_days" in budget_columns
    assert "locale" in budget_columns
    assert "currency" in budget_columns
    assert "timezone" in budget_columns
    assert "date_format" in budget_columns
    assert "record_line_status_changes" in budget_columns
    assert "max_forward_balance_cycles" in budget_columns


def test_auto_expense_upgrade_normalizes_invalid_legacy_auto_rows(build_pre_feature_db):
    db_path = build_pre_feature_db()

    upgrade_database(db_path, "head")

    with sqlite3.connect(db_path) as connection:
        budget_row = connection.execute(
            """
            SELECT auto_expense_enabled, auto_expense_offset_days, locale, currency, timezone, date_format, max_forward_balance_cycles
            FROM budgets
            LIMIT 1
            """
        ).fetchone()
        expense_paytypes = dict(
            connection.execute(
                """
                SELECT expensedesc, paytype
                FROM expenseitems
                ORDER BY sort_order
                """
            ).fetchall()
        )

    assert current_revision(db_path) == HEAD_REVISION
    assert budget_row == (0, 0, "en-AU", "AUD", "Australia/Sydney", "medium", 10)
    assert expense_paytypes["Scheduled Auto"] == "AUTO"
    assert expense_paytypes["Always Auto"] == "MANUAL"
    assert expense_paytypes["Missing Schedule Auto"] == "MANUAL"
    assert expense_paytypes["Incomplete Schedule Auto"] == "MANUAL"
