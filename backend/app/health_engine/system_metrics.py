"""Global system metric registry for the Budget Health Engine.

This module defines the canonical set of health metrics available to all budgets.
Each metric is keyed by `metric_key` and referenced from `BudgetHealthMatrixItem`
via that key rather than a database-level `metric_id`.
"""

from __future__ import annotations

from decimal import Decimal


SYSTEM_METRICS = {
    "setup_health": {
        "name": "Setup Health",
        "description": "Checks whether the budget has the minimum required setup lines.",
        "scope": "OVERALL",
        "default_parameters": {"min_income_lines": 1, "min_expense_lines": 1, "min_investment_lines": 1},
        "default_weight": Decimal("0.40"),
        "default_display_order": 0,
    },
    "budget_cycles_pending_closeout": {
        "name": "Budget Cycles Pending Close-Out",
        "description": "The number of budget cycles that are awaiting close-out.",
        "scope": "OVERALL",
        "default_parameters": {"upper_tolerance_instances": 0},
        "default_weight": Decimal("0.60"),
        "default_display_order": 1,
    },
    "budget_vs_actual_amount": {
        "name": "Budget vs Actual (Amount)",
        "description": "Expense line actual amount exceeds the budget amount (aggregate overrun).",
        "scope": "CURRENT_PERIOD",
        "default_parameters": {"upper_tolerance_amount": 50, "upper_tolerance_pct": 5},
        "default_weight": Decimal("0.30"),
        "default_display_order": 2,
    },
    "budget_vs_actual_lines": {
        "name": "Budget vs Actual (Lines)",
        "description": "Number of expense lines where actual amount exceeds the budget amount.",
        "scope": "CURRENT_PERIOD",
        "default_parameters": {"upper_tolerance_instances": 2, "upper_tolerance_pct": 10},
        "default_weight": Decimal("0.25"),
        "default_display_order": 3,
    },
    "in_cycle_budget_adjustments": {
        "name": "In Cycle Budget Adjustments",
        "description": "Change made to budget amount since the period started.",
        "scope": "CURRENT_PERIOD",
        "default_parameters": {"upper_tolerance_instances": 1},
        "default_weight": Decimal("0.25"),
        "default_display_order": 4,
    },
    "revisions_on_paid_expenses": {
        "name": "In Cycle Expense Revisions",
        "description": "Number of expense revision transactions recorded after the period started.",
        "scope": "CURRENT_PERIOD",
        "default_parameters": {"upper_tolerance_instances": 2},
        "default_weight": Decimal("0.20"),
        "default_display_order": 5,
    },
}


def get_system_metric(metric_key: str) -> dict | None:
    return SYSTEM_METRICS.get(metric_key)
