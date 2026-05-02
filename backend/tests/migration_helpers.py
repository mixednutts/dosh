from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config


BASELINE_REVISION = "abfa823847b9"
HEAD_REVISION = "8d512b6cf2c3"
BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_INI_PATH = BACKEND_DIR / "alembic.ini"
ALEMBIC_SCRIPT_PATH = BACKEND_DIR / "alembic"


def sqlite_url(db_path: Path) -> str:
    return f"sqlite:///{db_path.resolve().as_posix()}"


@contextmanager
def _database_url(db_path: Path):
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = sqlite_url(db_path)
    try:
        yield
    finally:
        if previous is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous


def _alembic_config() -> Config:
    config = Config(str(ALEMBIC_INI_PATH))
    config.set_main_option("script_location", str(ALEMBIC_SCRIPT_PATH))
    return config


def upgrade_database(db_path: Path, revision: str = "head") -> Path:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with _database_url(db_path):
        command.upgrade(_alembic_config(), revision)
    return db_path


def stamp_database(db_path: Path, revision: str) -> Path:
    with _database_url(db_path):
        command.stamp(_alembic_config(), revision)
    return db_path


def current_revision(db_path: Path) -> str | None:
    with sqlite3.connect(db_path) as connection:
        row = connection.execute("SELECT version_num FROM alembic_version LIMIT 1").fetchone()
    return row[0] if row else None


def build_pre_feature_database(db_path: Path) -> Path:
    upgrade_database(db_path, BASELINE_REVISION)

    with sqlite3.connect(db_path) as connection:
        connection.execute("INSERT INTO paytypes (paytype) VALUES ('AUTO')")
        connection.execute("INSERT INTO paytypes (paytype) VALUES ('MANUAL')")
        cursor = connection.execute(
            """
            INSERT INTO budgets (
                budgetowner,
                description,
                budget_frequency,
                variance_mode,
                auto_add_surplus_to_investment,
                acceptable_expense_overrun_pct,
                comfortable_surplus_buffer_pct,
                maximum_deficit_amount,
                revision_sensitivity,
                savings_priority,
                period_criticality_bias,
                allow_cycle_lock,
                account_naming_preference
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "Migration Test User",
                "Pre-feature budget",
                "Monthly",
                "always",
                0,
                10,
                5,
                None,
                50,
                50,
                50,
                1,
                "Transaction",
            ),
        )
        budgetid = cursor.lastrowid

        connection.executemany(
            """
            INSERT INTO expenseitems (
                budgetid,
                expensedesc,
                active,
                freqtype,
                frequency_value,
                paytype,
                revisionnum,
                effectivedate,
                expenseamount,
                sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    budgetid,
                    "Scheduled Auto",
                    1,
                    "Fixed Day of Month",
                    12,
                    "AUTO",
                    0,
                    "2026-01-01 00:00:00",
                    "100.00",
                    0,
                ),
                (
                    budgetid,
                    "Always Auto",
                    1,
                    "Always",
                    None,
                    "AUTO",
                    0,
                    None,
                    "45.00",
                    1,
                ),
                (
                    budgetid,
                    "Missing Schedule Auto",
                    1,
                    None,
                    None,
                    "AUTO",
                    0,
                    None,
                    "30.00",
                    2,
                ),
                (
                    budgetid,
                    "Incomplete Schedule Auto",
                    1,
                    "Every N Days",
                    14,
                    "AUTO",
                    0,
                    None,
                    "60.00",
                    3,
                ),
            ],
        )
        connection.commit()

    return db_path
