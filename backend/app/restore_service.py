from __future__ import annotations

import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from .models import (
    Budget,
    BudgetHealthMatrix,
    BudgetHealthMatrixItem,
    BudgetHealthSummary,
    ExpenseItem,
    FinancialPeriod,
    IncomeType,
    InvestmentItem,
    BalanceType,
    PeriodBalance,
    PeriodCloseoutSnapshot,
    PeriodExpense,
    PeriodHealthResult,
    PeriodIncome,
    PeriodInvestment,
    PeriodTransaction,
    SetupRevisionEvent,
)
from .version import APP_VERSION


def _parse_version(version: str) -> tuple[int, int, int]:
    """Extract (major, minor, patch) from a version string like '0.6.7-alpha'."""
    match = re.match(r"(\d+)\.(\d+)\.(\d+)", version)
    if not match:
        return (0, 0, 0)
    return (int(match.group(1)), int(match.group(2)), int(match.group(3)))


def compute_compatibility(backup_version: str, current_version: str = APP_VERSION) -> str:
    """Return compatibility status: 'exact', 'older_backup', or 'newer_backup'."""
    backup = _parse_version(backup_version)
    current = _parse_version(current_version)
    if backup == current:
        return "exact"
    if backup > current:
        return "newer_backup"
    return "older_backup"


def inspect_backup(payload: dict[str, Any]) -> dict[str, Any]:
    """Inspect a backup payload and return metadata without modifying the database."""
    if not payload.get("dosh_backup"):
        raise ValueError("Invalid backup file: missing dosh_backup marker.")

    backup_version = payload.get("app_version", "unknown")
    schema_revision = payload.get("schema_revision")
    exported_at = payload.get("exported_at")
    budgets = payload.get("budgets", [])

    compatibility = compute_compatibility(backup_version)

    budget_summaries = []
    for idx, b in enumerate(budgets):
        budget_data = b.get("budget", {})
        period_count = len(b.get("periods", []))
        budget_summaries.append({
            "index": idx,
            "description": budget_data.get("description") or "Untitled",
            "budgetowner": budget_data.get("budgetowner") or "Unknown",
            "budget_frequency": budget_data.get("budget_frequency") or "Unknown",
            "period_count": period_count,
        })

    return {
        "backup_version": backup_version,
        "current_version": APP_VERSION,
        "schema_revision": schema_revision,
        "compatibility": compatibility,
        "exported_at": exported_at,
        "budget_count": len(budget_summaries),
        "budgets": budget_summaries,
    }


def _deserialize_value(value: Any, target_type: Any) -> Any:
    """Convert JSON primitives back to model-compatible values."""
    if value is None:
        return None
    if target_type is Decimal or (isinstance(target_type, type) and issubclass(target_type, Decimal)):
        return Decimal(value) if isinstance(value, str) else Decimal(str(value))
    if target_type is datetime or (isinstance(target_type, type) and issubclass(target_type, datetime)):
        if isinstance(value, str):
            # Handle ISO format with or without Z
            value = value.replace("Z", "+00:00")
            return datetime.fromisoformat(value)
        return value
    return value


def _is_datetime_column(col: Any) -> bool:
    """Check if a column uses a DateTime-like type (including custom UTCDateTime)."""
    from sqlalchemy import DateTime as _DateTime
    type_cls = type(col.type)
    return type_cls is _DateTime or type_cls.__name__ == "UTCDateTime"


def _coerce_row(model_cls: Any, data: dict[str, Any], fk_overrides: dict[str, Any] | None = None) -> Any:
    """Create a model instance from a dict, coercing types and applying FK overrides."""
    fk_overrides = fk_overrides or {}
    kwargs = {}
    for col in model_cls.__table__.columns:
        if col.name in fk_overrides:
            kwargs[col.name] = fk_overrides[col.name]
        elif col.name in data:
            target_type = type(data[col.name])
            try:
                target_type = col.type.python_type
            except NotImplementedError:
                if _is_datetime_column(col):
                    target_type = datetime
            kwargs[col.name] = _deserialize_value(data[col.name], target_type)
        elif col.default is not None:
            # Let SQLAlchemy handle defaults
            pass
        elif not col.nullable and col.primary_key and col.autoincrement:
            # Skip auto-increment PKs
            pass
        elif not col.nullable:
            # Provide a sensible default for missing non-nullable fields
            try:
                if col.type.python_type is str:
                    kwargs[col.name] = ""
                elif col.type.python_type is int:
                    kwargs[col.name] = 0
                elif col.type.python_type is bool:
                    kwargs[col.name] = False
            except NotImplementedError:
                if _is_datetime_column(col) and col.default is None:
                    kwargs[col.name] = datetime.now(timezone.utc)
    return model_cls(**kwargs)


def _find_budget_by_description(db: Session, description: str | None) -> Budget | None:
    """Find an existing budget matching the given description."""
    desc = description or ""
    return db.query(Budget).filter(Budget.description == desc).first()


def restore_budgets(
    db: Session,
    payload: dict[str, Any],
    selected_indices: list[int] | None = None,
    allow_overwrite: bool = False,
) -> dict[str, Any]:
    """Restore budgets from a backup payload.

    Args:
        db: Database session
        payload: Backup payload dict
        selected_indices: Indices of budgets to restore, or None for all
        allow_overwrite: If True, delete existing budgets with matching descriptions

    Returns:
        Dict with restored budget IDs and any warnings
    """
    if not payload.get("dosh_backup"):
        raise ValueError("Invalid backup file: missing dosh_backup marker.")

    budgets_data = payload.get("budgets", [])
    if selected_indices is not None:
        budgets_data = [budgets_data[i] for i in selected_indices if 0 <= i < len(budgets_data)]

    restored = []
    warnings = []

    for b in budgets_data:
        budget_info = b.get("budget", {})
        description = budget_info.get("description") or "Untitled"

        # Check for existing budget
        existing = _find_budget_by_description(db, budget_info.get("description"))
        if existing:
            if not allow_overwrite:
                warnings.append(f"Skipped '{description}': a budget with this description already exists.")
                continue
            db.delete(existing)
            db.flush()

        # Create new budget
        new_budget = _coerce_row(Budget, budget_info)
        db.add(new_budget)
        db.flush()
        new_budgetid = new_budget.budgetid

        old_budgetid = b.get("old_budgetid")

        # Income types
        for it_data in b.get("income_types", []):
            db.add(_coerce_row(IncomeType, it_data, {"budgetid": new_budgetid}))

        # Expense items
        for ei_data in b.get("expense_items", []):
            db.add(_coerce_row(ExpenseItem, ei_data, {"budgetid": new_budgetid}))

        # Investment items
        for ii_data in b.get("investment_items", []):
            db.add(_coerce_row(InvestmentItem, ii_data, {"budgetid": new_budgetid}))

        # Balance types
        for bt_data in b.get("balance_types", []):
            db.add(_coerce_row(BalanceType, bt_data, {"budgetid": new_budgetid}))

        # Setup revision events
        for sre_data in b.get("setup_revision_events", []):
            db.add(_coerce_row(SetupRevisionEvent, sre_data, {"budgetid": new_budgetid}))

        # Health matrices (need ID remapping)
        matrix_id_map: dict[int, int] = {}
        for hm in b.get("health_matrices", []):
            old_matrix_id = hm.get("old_matrix_id")
            matrix_data = hm.get("matrix", {})
            new_matrix = _coerce_row(BudgetHealthMatrix, matrix_data, {"budgetid": new_budgetid})
            db.add(new_matrix)
            db.flush()
            if old_matrix_id is not None:
                matrix_id_map[old_matrix_id] = new_matrix.matrix_id

            for item_data in hm.get("items", []):
                db.add(_coerce_row(BudgetHealthMatrixItem, item_data, {"matrix_id": new_matrix.matrix_id}))

        # Periods (need ID remapping)
        period_id_map: dict[int, int] = {}
        for period_wrapper in b.get("periods", []):
            old_finperiodid = period_wrapper.get("old_finperiodid")
            period_data = period_wrapper.get("period", {})
            new_period = _coerce_row(FinancialPeriod, period_data, {"budgetid": new_budgetid})
            db.add(new_period)
            db.flush()
            new_finperiodid = new_period.finperiodid
            if old_finperiodid is not None:
                period_id_map[old_finperiodid] = new_finperiodid

            # Period incomes
            for pi_data in period_wrapper.get("period_incomes", []):
                db.add(_coerce_row(PeriodIncome, pi_data, {"finperiodid": new_finperiodid, "budgetid": new_budgetid}))

            # Period expenses
            for pe_data in period_wrapper.get("period_expenses", []):
                db.add(_coerce_row(PeriodExpense, pe_data, {"finperiodid": new_finperiodid, "budgetid": new_budgetid}))

            # Period balances
            for pb_data in period_wrapper.get("period_balances", []):
                db.add(_coerce_row(PeriodBalance, pb_data, {"finperiodid": new_finperiodid, "budgetid": new_budgetid}))

            # Period investments
            for pinv_data in period_wrapper.get("period_investments", []):
                db.add(_coerce_row(PeriodInvestment, pinv_data, {"finperiodid": new_finperiodid, "budgetid": new_budgetid}))

            # Period transactions
            for pt_data in period_wrapper.get("period_transactions", []):
                db.add(_coerce_row(PeriodTransaction, pt_data, {"finperiodid": new_finperiodid, "budgetid": new_budgetid}))

            # Closeout snapshot
            if period_wrapper.get("closeout_snapshot"):
                db.add(_coerce_row(PeriodCloseoutSnapshot, period_wrapper["closeout_snapshot"], {"finperiodid": new_finperiodid}))

            # Health results (need matrix_id remapping)
            for phr_data in period_wrapper.get("health_results", []):
                old_matrix_id = phr_data.get("matrix_id")
                overrides: dict[str, Any] = {"finperiodid": new_finperiodid}
                if old_matrix_id is not None and old_matrix_id in matrix_id_map:
                    overrides["matrix_id"] = matrix_id_map[old_matrix_id]
                db.add(_coerce_row(PeriodHealthResult, phr_data, overrides))

        # Health summaries (need matrix_id and budgetid remapping)
        for hs_data in b.get("health_summaries", []):
            old_matrix_id = hs_data.get("matrix_id")
            overrides: dict[str, Any] = {"budgetid": new_budgetid}
            if old_matrix_id is not None and old_matrix_id in matrix_id_map:
                overrides["matrix_id"] = matrix_id_map[old_matrix_id]
            db.add(_coerce_row(BudgetHealthSummary, hs_data, overrides))

        restored.append({
            "old_budgetid": old_budgetid,
            "new_budgetid": new_budgetid,
            "description": description,
        })

    db.commit()
    return {"restored": restored, "warnings": warnings}
