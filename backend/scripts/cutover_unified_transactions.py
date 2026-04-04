from __future__ import annotations

import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
DB_PATH = BACKEND_DIR / "dosh.db"
BACKUP_DIR = BACKEND_DIR / "db_backups"


def _require_database() -> None:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Database not found at {DB_PATH}")


def _backup_database() -> Path:
    BACKUP_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = BACKUP_DIR / f"dosh-{timestamp}.db"
    shutil.copy2(DB_PATH, backup_path)
    return backup_path


def _column_names(conn: sqlite3.Connection, table_name: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    return {row[1] for row in rows}


def _table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    return row is not None


def _add_column_if_missing(conn: sqlite3.Connection, table_name: str, column_name: str, definition: str) -> None:
    if not _table_exists(conn, table_name):
        return
    if column_name in _column_names(conn, table_name):
        return
    conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")


def _apply_schema_cutover() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        _add_column_if_missing(conn, "budgets", "allow_cycle_lock", "INTEGER NOT NULL DEFAULT 1")
        _add_column_if_missing(conn, "budgets", "account_naming_preference", "VARCHAR NOT NULL DEFAULT 'Transaction'")
        _add_column_if_missing(conn, "financialperiods", "cycle_status", "VARCHAR NOT NULL DEFAULT 'PLANNED'")
        _add_column_if_missing(conn, "financialperiods", "closed_at", "DATETIME")
        _add_column_if_missing(conn, "periodincome", "is_system", "INTEGER NOT NULL DEFAULT 0")
        _add_column_if_missing(conn, "periodincome", "system_key", "VARCHAR")
        _add_column_if_missing(conn, "periodinvestments", "status", "VARCHAR NOT NULL DEFAULT 'Current'")
        _add_column_if_missing(conn, "periodinvestments", "revision_comment", "VARCHAR")

        # Normalize nullable values on pre-cutover databases.
        conn.execute("UPDATE budgets SET allow_cycle_lock = COALESCE(allow_cycle_lock, 1)")
        conn.execute(
            "UPDATE budgets SET account_naming_preference = COALESCE(account_naming_preference, 'Transaction')"
        )
        conn.execute("UPDATE financialperiods SET cycle_status = COALESCE(cycle_status, 'PLANNED')")
        conn.execute("UPDATE periodincome SET is_system = COALESCE(is_system, 0)")
        conn.execute("UPDATE periodinvestments SET status = COALESCE(status, 'Current')")

        # Remove legacy transaction tables after unified-ledger cutover.
        conn.execute("DROP TABLE IF EXISTS periodexpense_transactions")
        conn.execute("DROP TABLE IF EXISTS periodinvestment_transactions")
        conn.commit()


def _normalize_lifecycle_states() -> None:
    if str(BACKEND_DIR) not in sys.path:
        sys.path.insert(0, str(BACKEND_DIR))

    from app.cycle_management import assign_period_lifecycle_states
    from app.database import SessionLocal
    from app.models import Budget

    db = SessionLocal()
    try:
        budget_ids = [budget_id for (budget_id,) in db.query(Budget.budgetid).all()]
        for budget_id in budget_ids:
            assign_period_lifecycle_states(budget_id, db)
        db.commit()
    finally:
        db.close()


def main() -> int:
    _require_database()
    backup_path = _backup_database()
    _apply_schema_cutover()
    _normalize_lifecycle_states()
    print(f"Backup created at {backup_path}")
    print("Unified transaction cutover completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
