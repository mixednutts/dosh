#!/usr/bin/env python3
"""Diagnose orphaned health matrix records in the production database."""
from __future__ import annotations

import sqlite3
import sys

DB_PATH = "/app/data/dosh.db"


def main():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys=ON")
    cursor = conn.cursor()

    # 1. Templates that still exist
    cursor.execute("SELECT template_key, name FROM healthmatrixtemplates")
    templates = cursor.fetchall()
    print(f"=== HealthMatrixTemplates ({len(templates)}) ===")
    for t in templates:
        print(f"  {t[0]} - {t[1]}")

    # 2. Metric templates that still exist
    cursor.execute("SELECT template_key, name FROM healthmetrictemplates")
    metric_templates = cursor.fetchall()
    print(f"\n=== HealthMetricTemplates ({len(metric_templates)}) ===")
    for mt in metric_templates:
        print(f"  {mt[0]} - {mt[1]}")

    # 3. Metrics with null template_key (orphaned from deleted templates)
    cursor.execute(
        """
        SELECT m.metric_id, m.name, m.budgetid, m.template_key
        FROM healthmetrics m
        LEFT JOIN healthmetrictemplates mt ON m.template_key = mt.template_key
        WHERE mt.template_key IS NULL
        """
    )
    orphaned_metrics = cursor.fetchall()
    print(f"\n=== Orphaned HealthMetrics (template_key missing or null) ({len(orphaned_metrics)}) ===")
    for row in orphaned_metrics:
        print(f"  metric_id={row[0]} name={row[1]} budgetid={row[2]} template_key={row[3]}")

    # 4. BudgetHealthMatrixItems referencing orphaned metrics
    cursor.execute(
        """
        SELECT bhi.matrix_id, bhi.metric_id, m.name
        FROM budgethealthmatrixitems bhi
        JOIN healthmetrics m ON bhi.metric_id = m.metric_id
        LEFT JOIN healthmetrictemplates mt ON m.template_key = mt.template_key
        WHERE mt.template_key IS NULL
        """
    )
    orphaned_items = cursor.fetchall()
    print(f"\n=== BudgetHealthMatrixItems referencing orphaned metrics ({len(orphaned_items)}) ===")
    for row in orphaned_items:
        print(f"  matrix_id={row[0]} metric_id={row[1]} name={row[2]}")

    # 5. BudgetHealthMatrices with based_on_template_key pointing to missing templates
    cursor.execute(
        """
        SELECT bhm.matrix_id, bhm.budgetid, bhm.based_on_template_key
        FROM budgethealthmatrices bhm
        LEFT JOIN healthmatrixtemplates t ON bhm.based_on_template_key = t.template_key
        WHERE bhm.based_on_template_key IS NOT NULL AND t.template_key IS NULL
        """
    )
    orphaned_matrices = cursor.fetchall()
    print(f"\n=== BudgetHealthMatrices with missing based_on_template_key ({len(orphaned_matrices)}) ===")
    for row in orphaned_matrices:
        print(f"  matrix_id={row[0]} budgetid={row[1]} based_on={row[2]}")

    conn.close()
    print("\nDiagnosis complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
