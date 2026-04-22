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


def _default_for_missing_column(col: Any) -> Any | None:
    """Return a sensible default for a missing non-nullable column, or None if it should be skipped."""
    if col.default is not None:
        return None  # Let SQLAlchemy handle defaults
    if not col.nullable and col.primary_key and col.autoincrement:
        return None  # Skip auto-increment PKs
    if not col.nullable:
        try:
            if col.type.python_type is str:
                return ""
            elif col.type.python_type is int:
                return 0
            elif col.type.python_type is bool:
                return False
        except NotImplementedError:
            if _is_datetime_column(col) and col.default is None:
                return datetime.now(timezone.utc)
    return None


def _coerce_row(model_cls: Any, data: dict[str, Any], fk_overrides: dict[str, Any] | None = None) -> Any:
    """Create a model instance from a dict, coercing types and applying FK overrides."""
    fk_overrides = fk_overrides or {}
    kwargs: dict[str, Any] = {}
    for col in model_cls.__table__.columns:
        if col.name in fk_overrides:
            kwargs[col.name] = fk_overrides[col.name]
            continue
        if col.name in data:
            target_type = type(data[col.name])
            try:
                target_type = col.type.python_type
            except NotImplementedError:
                if _is_datetime_column(col):
                    target_type = datetime
            kwargs[col.name] = _deserialize_value(data[col.name], target_type)
            continue
        default = _default_for_missing_column(col)
        if default is not None:
            kwargs[col.name] = default
    return model_cls(**kwargs)


def _find_budget_by_description(db: Session, description: str | None) -> Budget | None:
    """Find an existing budget matching the given description."""
    desc = description or ""
    return db.query(Budget).filter(Budget.description == desc).first()


def _maybe_delete_existing_budget(db: Session, description: str, allow_overwrite: bool) -> bool:
    """Delete an existing budget with matching description if overwrite is allowed.

    Returns True if the caller should skip this budget, False otherwise.
    """
    existing = _find_budget_by_description(db, description)
    if not existing:
        return False
    if not allow_overwrite:
        return True
    db.delete(existing)
    db.flush()
    return False


def _restore_simple_entities(db: Session, new_budgetid: int, b: dict[str, Any]) -> None:
    """Restore income types, expense items, investment items, balance types, and setup revision events."""
    for it_data in b.get("income_types", []):
        db.add(_coerce_row(IncomeType, it_data, {"budgetid": new_budgetid}))
    for ei_data in b.get("expense_items", []):
        db.add(_coerce_row(ExpenseItem, ei_data, {"budgetid": new_budgetid}))
    for ii_data in b.get("investment_items", []):
        db.add(_coerce_row(InvestmentItem, ii_data, {"budgetid": new_budgetid}))
    for bt_data in b.get("balance_types", []):
        db.add(_coerce_row(BalanceType, bt_data, {"budgetid": new_budgetid}))
    for sre_data in b.get("setup_revision_events", []):
        db.add(_coerce_row(SetupRevisionEvent, sre_data, {"budgetid": new_budgetid}))


def _restore_health_matrices(db: Session, new_budgetid: int, b: dict[str, Any]) -> dict[int, int]:
    """Restore health matrices and return an old_matrix_id → new_matrix_id mapping."""
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
    return matrix_id_map


def _restore_periods(db: Session, new_budgetid: int, b: dict[str, Any], matrix_id_map: dict[int, int]) -> None:
    """Restore periods and all period-level entities."""
    for period_wrapper in b.get("periods", []):
        old_finperiodid = period_wrapper.get("old_finperiodid")
        period_data = period_wrapper.get("period", {})
        new_period = _coerce_row(FinancialPeriod, period_data, {"budgetid": new_budgetid})
        db.add(new_period)
        db.flush()
        new_finperiodid = new_period.finperiodid

        for pi_data in period_wrapper.get("period_incomes", []):
            db.add(_coerce_row(PeriodIncome, pi_data, {"finperiodid": new_finperiodid, "budgetid": new_budgetid}))
        for pe_data in period_wrapper.get("period_expenses", []):
            db.add(_coerce_row(PeriodExpense, pe_data, {"finperiodid": new_finperiodid, "budgetid": new_budgetid}))
        for pb_data in period_wrapper.get("period_balances", []):
            db.add(_coerce_row(PeriodBalance, pb_data, {"finperiodid": new_finperiodid, "budgetid": new_budgetid}))
        for pinv_data in period_wrapper.get("period_investments", []):
            db.add(_coerce_row(PeriodInvestment, pinv_data, {"finperiodid": new_finperiodid, "budgetid": new_budgetid}))
        for pt_data in period_wrapper.get("period_transactions", []):
            db.add(_coerce_row(PeriodTransaction, pt_data, {"finperiodid": new_finperiodid, "budgetid": new_budgetid}))

        if period_wrapper.get("closeout_snapshot"):
            db.add(_coerce_row(PeriodCloseoutSnapshot, period_wrapper["closeout_snapshot"], {"finperiodid": new_finperiodid}))

        for phr_data in period_wrapper.get("health_results", []):
            old_matrix_id = phr_data.get("matrix_id")
            overrides: dict[str, Any] = {"finperiodid": new_finperiodid}
            if old_matrix_id is not None and old_matrix_id in matrix_id_map:
                overrides["matrix_id"] = matrix_id_map[old_matrix_id]
            db.add(_coerce_row(PeriodHealthResult, phr_data, overrides))


def _restore_health_summaries(db: Session, new_budgetid: int, b: dict[str, Any], matrix_id_map: dict[int, int]) -> None:
    """Restore health summaries with matrix_id remapping."""
    for hs_data in b.get("health_summaries", []):
        old_matrix_id = hs_data.get("matrix_id")
        overrides: dict[str, Any] = {"budgetid": new_budgetid}
        if old_matrix_id is not None and old_matrix_id in matrix_id_map:
            overrides["matrix_id"] = matrix_id_map[old_matrix_id]
        db.add(_coerce_row(BudgetHealthSummary, hs_data, overrides))


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

        if _maybe_delete_existing_budget(db, description, allow_overwrite):
            warnings.append(f"Skipped '{description}': a budget with this description already exists.")
            continue

        new_budget = _coerce_row(Budget, budget_info)
        db.add(new_budget)
        db.flush()
        new_budgetid = new_budget.budgetid

        _restore_simple_entities(db, new_budgetid, b)
        matrix_id_map = _restore_health_matrices(db, new_budgetid, b)
        _restore_periods(db, new_budgetid, b, matrix_id_map)
        _restore_health_summaries(db, new_budgetid, b, matrix_id_map)

        restored.append({
            "old_budgetid": b.get("old_budgetid"),
            "new_budgetid": new_budgetid,
            "description": description,
        })

    db.commit()
    return {"restored": restored, "warnings": warnings}
