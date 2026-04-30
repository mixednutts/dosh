from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy.orm import Session

from .models import FinancialPeriod, PeriodTransaction, SetupRevisionEvent
from .schemas import SetupHistoryEntryOut


FIELD_LABELS: dict[str, str] = {
    "amount": "Amount",
    "expenseamount": "Amount",
    "planned_amount": "Planned amount",
    "freqtype": "Schedule type",
    "frequency_value": "Schedule value",
    "effectivedate": "Effective date",
    "linked_account": "Linked account",
    "linked_account_desc": "Linked account",
    "autoinclude": "Auto include",
    "issavings": "Savings",
    "initial_value": "Initial value",
    "active": "Active",
    "is_primary": "Primary",
    "paytype": "Payment type",
}


def _json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return format(value.quantize(Decimal("0.01")), "f")
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _changed_field_payload(field: str, before_value: Any, after_value: Any) -> dict[str, Any]:
    return {
        "field": field,
        "label": FIELD_LABELS.get(field, field.replace("_", " ").capitalize()),
        "before_value": _json_safe(before_value),
        "after_value": _json_safe(after_value),
    }


def build_changed_fields(current_obj: Any, incoming_data: dict[str, Any], revision_fields: set[str]) -> list[dict[str, Any]]:
    changed_fields: list[dict[str, Any]] = []
    for field in revision_fields:
        if field not in incoming_data:
            continue
        before_value = getattr(current_obj, field)
        after_value = incoming_data[field]
        if before_value != after_value:
            changed_fields.append(_changed_field_payload(field, before_value, after_value))
    return changed_fields


def record_setup_revision_event(
    db: Session,
    *,
    budgetid: int,
    category: str,
    item_desc: str,
    revisionnum: int,
    changed_fields: list[dict[str, Any]],
) -> SetupRevisionEvent | None:
    if not changed_fields:
        return None

    event = SetupRevisionEvent(
        budgetid=budgetid,
        category=category,
        item_desc=item_desc,
        revisionnum=revisionnum,
        changed_fields_json=json.dumps(changed_fields),
    )
    db.add(event)
    db.flush()
    return event


def current_supported_revisionnum(db: Session, *, budgetid: int, category: str, item_desc: str) -> int:
    transaction_rows = (
        db.query(PeriodTransaction.revisionnum)
        .filter(
            PeriodTransaction.budgetid == budgetid,
            PeriodTransaction.source == category,
            PeriodTransaction.source_key == item_desc,
            PeriodTransaction.type == "BUDGETADJ",
            PeriodTransaction.revisionnum.is_not(None),
        )
        .all()
    )
    setup_rows = (
        db.query(SetupRevisionEvent.revisionnum)
        .filter(
            SetupRevisionEvent.budgetid == budgetid,
            SetupRevisionEvent.category == category,
            SetupRevisionEvent.item_desc == item_desc,
        )
        .all()
    )
    revision_values = [value for (value,) in transaction_rows + setup_rows if value is not None]
    return max(revision_values, default=0)


def next_supported_revisionnum(db: Session, *, budgetid: int, category: str, item_desc: str) -> int:
    return current_supported_revisionnum(db, budgetid=budgetid, category=category, item_desc=item_desc) + 1


def rebase_item_revisionnum(item: Any, *, budgetid: int, category: str, item_desc: str, db: Session) -> int:
    supported_revisionnum = current_supported_revisionnum(db, budgetid=budgetid, category=category, item_desc=item_desc)
    if getattr(item, "revisionnum", 0) != supported_revisionnum:
        item.revisionnum = supported_revisionnum
        db.flush()
    return supported_revisionnum


def _parse_changed_fields(raw_json: str | None) -> list[dict[str, Any]]:
    if not raw_json:
        return []
    try:
        parsed = json.loads(raw_json)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def delete_setup_revision_events_for_item(db: Session, *, budgetid: int, category: str, item_desc: str) -> None:
    db.query(SetupRevisionEvent).filter(
        SetupRevisionEvent.budgetid == budgetid,
        SetupRevisionEvent.category == category,
        SetupRevisionEvent.item_desc == item_desc,
    ).delete(synchronize_session=False)


def build_setup_history_entries(db: Session, *, budgetid: int, category: str, item_desc: str) -> list[SetupHistoryEntryOut]:
    transaction_rows = (
        db.query(PeriodTransaction, FinancialPeriod)
        .join(FinancialPeriod, FinancialPeriod.finperiodid == PeriodTransaction.finperiodid)
        .filter(
            PeriodTransaction.budgetid == budgetid,
            PeriodTransaction.source == category,
            PeriodTransaction.source_key == item_desc,
            PeriodTransaction.type == "BUDGETADJ",
        )
        .all()
    )
    revision_rows = (
        db.query(SetupRevisionEvent)
        .filter(
            SetupRevisionEvent.budgetid == budgetid,
            SetupRevisionEvent.category == category,
            SetupRevisionEvent.item_desc == item_desc,
        )
        .all()
    )

    entries = [
        SetupHistoryEntryOut(
            id=tx.id,
            history_kind="budget_adjustment",
            finperiodid=tx.finperiodid,
            period_startdate=period.startdate,
            period_enddate=period.enddate,
            source=tx.source,
            type=tx.type,
            amount=tx.amount,
            note=tx.note,
            entrydate=tx.entrydate,
            is_system=tx.is_system,
            system_reason=tx.system_reason,
            source_key=tx.source_key,
            source_label=tx.source_label,
            affected_account_desc=tx.affected_account_desc,
            related_account_desc=tx.related_account_desc,
            linked_incomedesc=tx.linked_incomedesc,
            entry_kind=getattr(tx, "entry_kind", "movement"),
            line_status=getattr(tx, "line_status", None),
            budget_scope=getattr(tx, "budget_scope", None),
            budget_before_amount=getattr(tx, "budget_before_amount", None),
            budget_after_amount=getattr(tx, "budget_after_amount", None),
            revisionnum=getattr(tx, "revisionnum", None),
        )
        for tx, period in transaction_rows
    ]
    entries.extend(
        SetupHistoryEntryOut(
            id=row.id,
            history_kind="setup_revision",
            note=None,
            entrydate=row.created_at,
            revisionnum=row.revisionnum,
            entry_kind="setup_revision",
            change_details=_parse_changed_fields(row.changed_fields_json),
        )
        for row in revision_rows
    )
    entries.sort(key=lambda entry: (entry.entrydate, entry.id), reverse=True)
    return entries
