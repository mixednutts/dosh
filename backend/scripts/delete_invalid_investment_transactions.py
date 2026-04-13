#!/usr/bin/env python3
"""
One-off cleanup script: delete invalid pre-fix investment transactions.

Background:
- Investment transactions created before the source-account fix only credited
  the destination account without debiting a source account.
- These transactions have `source == 'investment'` and `related_account_desc IS NULL`.
- This script identifies and removes them, then recalculates affected period balances.

Hard Control #7 applies: this script modifies production data and must only be
run inside the Docker container after an explicit backup.
"""
from __future__ import annotations

import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

DB_PATH = Path("/app/data/dosh.db")
BACKUP_DIR = Path("/app/data/backups")


def _require_database() -> None:
    if not DB_PATH.exists():
        raise FileError(f"Database not found at {DB_PATH}")


def _backup_database() -> Path:
    BACKUP_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = BACKUP_DIR / f"dosh-invalid-investment-cleanup-{timestamp}.db"
    shutil.copy2(DB_PATH, backup_path)
    return backup_path


def _find_invalid_transactions(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """
        SELECT id, finperiodid, budgetid, source_key, amount, note, entrydate
        FROM periodtransactions
        WHERE source = 'investment'
          AND related_account_desc IS NULL
        ORDER BY finperiodid, id
        """
    ).fetchall()
    return [
        {
            "id": row[0],
            "finperiodid": row[1],
            "budgetid": row[2],
            "investmentdesc": row[3],
            "amount": row[4],
            "note": row[5],
            "entrydate": row[6],
        }
        for row in rows
    ]


def _delete_transactions(conn: sqlite3.Connection, tx_ids: list[int]) -> int:
    if not tx_ids:
        return 0
    placeholders = ",".join("?" * len(tx_ids))
    cursor = conn.execute(
        f"DELETE FROM periodtransactions WHERE id IN ({placeholders})",
        tx_ids,
    )
    return cursor.rowcount


def _sync_affected_periods(period_ids: set[int]) -> None:
    if not period_ids:
        return
    # Import app code inside the container
    backend_dir = Path("/app")
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    from app.database import SessionLocal
    from app.transaction_ledger import sync_period_state

    db = SessionLocal()
    try:
        for period_id in sorted(period_ids):
            sync_period_state(period_id, db)
        db.commit()
    finally:
        db.close()


def main() -> int:
    _require_database()
    backup_path = _backup_database()
    print(f"Backup created at: {backup_path}")

    with sqlite3.connect(DB_PATH) as conn:
        invalid = _find_invalid_transactions(conn)
        if not invalid:
            print("No invalid investment transactions found.")
            return 0

        print(f"Found {len(invalid)} invalid investment transaction(s):")
        for tx in invalid:
            print(
                f"  id={tx['id']} period={tx['finperiodid']} "
                f"investment={tx['investmentdesc']} amount={tx['amount']} "
                f"note={tx['note']!r} entrydate={tx['entrydate']}"
            )

        tx_ids = [tx["id"] for tx in invalid]
        affected_period_ids = {tx["finperiodid"] for tx in invalid}

        confirm = input("\nType 'DELETE' to permanently remove these transactions: ")
        if confirm.strip() != "DELETE":
            print("Aborted. No changes were made.")
            return 1

        deleted_count = _delete_transactions(conn, tx_ids)
        conn.commit()
        print(f"Deleted {deleted_count} transaction(s).")

    _sync_affected_periods(affected_period_ids)
    print(f"Recalculated balances for period(s): {sorted(affected_period_ids)}")
    print("Cleanup complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
