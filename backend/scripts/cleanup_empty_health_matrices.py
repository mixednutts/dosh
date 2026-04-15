#!/usr/bin/env python3
"""Clean up empty BudgetHealthMatrix rows and associated results/summaries."""
from __future__ import annotations

import sqlite3
import sys

DB_PATH = "/app/data/dosh.db"


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys=ON")
    cursor = conn.cursor()

    # Find empty matrices (no items)
    cursor.execute(
        """
        SELECT bhm.matrix_id
        FROM budgethealthmatrices bhm
        LEFT JOIN budgethealthmatrixitems bhi ON bhm.matrix_id = bhi.matrix_id
        WHERE bhi.matrix_id IS NULL
        """
    )
    empty_matrix_ids = [row[0] for row in cursor.fetchall()]

    if not empty_matrix_ids:
        print("No empty BudgetHealthMatrix rows found.")
        conn.close()
        return 0

    print(f"Found {len(empty_matrix_ids)} empty BudgetHealthMatrix row(s) to remove.")
    placeholders = ",".join("?" * len(empty_matrix_ids))

    # Delete associated PeriodHealthResult rows
    cursor.execute(
        f"DELETE FROM periodhealthresults WHERE matrix_id IN ({placeholders})",
        empty_matrix_ids,
    )
    deleted_results = cursor.rowcount
    print(f"  Deleted {deleted_results} PeriodHealthResult(s).")

    # Delete associated BudgetHealthSummary rows
    cursor.execute(
        f"DELETE FROM budgethealthsummaries WHERE matrix_id IN ({placeholders})",
        empty_matrix_ids,
    )
    deleted_summaries = cursor.rowcount
    print(f"  Deleted {deleted_summaries} BudgetHealthSummary(s).")

    # Delete empty matrices
    cursor.execute(
        f"DELETE FROM budgethealthmatrices WHERE matrix_id IN ({placeholders})",
        empty_matrix_ids,
    )
    deleted_matrices = cursor.rowcount
    print(f"  Deleted {deleted_matrices} BudgetHealthMatrix row(s).")

    conn.commit()
    conn.close()
    print("Cleanup complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
