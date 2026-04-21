from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from .models import Budget
from .version import APP_VERSION, get_schema_revision


def _serialize_value(value: Any) -> Any:
    """Convert model values to JSON-serializable primitives."""
    if value is None:
        return None
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _model_to_dict(instance: Any, exclude: set[str] | None = None) -> dict[str, Any]:
    """Convert a SQLAlchemy model instance to a plain dict, excluding specified columns."""
    exclude = exclude or set()
    return {
        col.name: _serialize_value(getattr(instance, col.name))
        for col in instance.__table__.columns
        if col.name not in exclude
    }


def _serialize_budget(budget: Budget, db: Session) -> dict[str, Any]:
    """Serialize a single budget and all its related data."""
    budget_data = _model_to_dict(budget, exclude={"budgetid"})

    income_types = [_model_to_dict(it, exclude={"budgetid"}) for it in budget.income_types]
    expense_items = [_model_to_dict(ei, exclude={"budgetid"}) for ei in budget.expense_items]
    investment_items = [_model_to_dict(ii, exclude={"budgetid"}) for ii in budget.investment_items]
    balance_types = [_model_to_dict(bt, exclude={"budgetid"}) for bt in budget.balance_types]
    setup_revision_events = [_model_to_dict(sre, exclude={"id", "budgetid"}) for sre in budget.setup_revision_events]

    health_matrices = []
    for matrix in budget.health_matrices:
        matrix_data = _model_to_dict(matrix, exclude={"matrix_id", "budgetid"})
        items = [_model_to_dict(item, exclude={"matrix_id"}) for item in matrix.items]
        health_matrices.append({"old_matrix_id": matrix.matrix_id, "matrix": matrix_data, "items": items})

    health_summaries = []
    for summary in budget.health_summaries:
        summary_data = _model_to_dict(summary, exclude={"budgetid"})
        health_summaries.append(summary_data)

    periods = []
    for period in budget.periods:
        period_data = _model_to_dict(period, exclude={"finperiodid", "budgetid"})

        period_incomes = [_model_to_dict(pi, exclude={"finperiodid", "budgetid"}) for pi in period.period_incomes]
        period_expenses = [_model_to_dict(pe, exclude={"finperiodid", "budgetid"}) for pe in period.period_expenses]
        period_balances = [_model_to_dict(pb, exclude={"finperiodid", "budgetid"}) for pb in period.period_balances]
        period_investments = [_model_to_dict(pinv, exclude={"finperiodid", "budgetid"}) for pinv in period.period_investments]
        period_transactions = [_model_to_dict(pt, exclude={"id", "finperiodid", "budgetid"}) for pt in period.period_transactions]
        health_results = [_model_to_dict(phr, exclude={"id", "finperiodid"}) for phr in period.health_results]

        closeout_snapshot = None
        if period.closeout_snapshot:
            closeout_snapshot = _model_to_dict(period.closeout_snapshot, exclude={"finperiodid"})

        periods.append({
            "old_finperiodid": period.finperiodid,
            "period": period_data,
            "period_incomes": period_incomes,
            "period_expenses": period_expenses,
            "period_balances": period_balances,
            "period_investments": period_investments,
            "period_transactions": period_transactions,
            "closeout_snapshot": closeout_snapshot,
            "health_results": health_results,
        })

    return {
        "old_budgetid": budget.budgetid,
        "budget": budget_data,
        "income_types": income_types,
        "expense_items": expense_items,
        "investment_items": investment_items,
        "balance_types": balance_types,
        "setup_revision_events": setup_revision_events,
        "health_matrices": health_matrices,
        "health_summaries": health_summaries,
        "periods": periods,
    }


def build_backup_payload(budgets: list[Budget], db: Session) -> dict[str, Any]:
    """Build the top-level backup payload for one or more budgets."""
    return {
        "dosh_backup": True,
        "app_version": APP_VERSION,
        "schema_revision": get_schema_revision(),
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "budgets": [_serialize_budget(b, db) for b in budgets],
    }
