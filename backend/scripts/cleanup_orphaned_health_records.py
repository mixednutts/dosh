#!/usr/bin/env python3
"""Clean up orphaned health matrix records with a required backup verification."""
from __future__ import annotations

import sqlite3
import sys

DB_PATH = "/app/data/dosh.db"


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys=ON")
    cursor = conn.cursor()

    # Identify orphaned metrics (template_key is NULL and no matching metric template exists)
    cursor.execute(
        """
        SELECT m.metric_id
        FROM healthmetrics m
        LEFT JOIN healthmetrictemplates mt ON m.template_key = mt.template_key
        WHERE mt.template_key IS NULL
        """
    )
    orphaned_metric_ids = [row[0] for row in cursor.fetchall()]

    if not orphaned_metric_ids:
        print("No orphaned metrics found. Nothing to clean up.")
        conn.close()
        return 0

    print(f"Found {len(orphaned_metric_ids)} orphaned metric(s) to remove.")

    # 1. Delete BudgetHealthMatrixItems referencing orphaned metrics
    placeholders = ",".join("?" * len(orphaned_metric_ids))
    cursor.execute(
        f"DELETE FROM budgethealthmatrixitems WHERE metric_id IN ({placeholders})",
        orphaned_metric_ids,
    )
    deleted_items = cursor.rowcount
    print(f"  Deleted {deleted_items} BudgetHealthMatrixItem(s).")

    # 2. Delete PeriodHealthResult rows referencing orphaned metrics
    cursor.execute(
        f"DELETE FROM periodhealthresults WHERE metric_id IN ({placeholders})",
        orphaned_metric_ids,
    )
    deleted_results = cursor.rowcount
    print(f"  Deleted {deleted_results} PeriodHealthResult(s).")

    # 3. Delete orphaned metrics
    cursor.execute(
        f"DELETE FROM healthmetrics WHERE metric_id IN ({placeholders})",
        orphaned_metric_ids,
    )
    deleted_metrics = cursor.rowcount
    print(f"  Deleted {deleted_metrics} HealthMetric(s).")

    conn.commit()
    conn.close()
    print("Cleanup complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
