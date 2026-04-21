from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal

from tests.factories import (
    create_budget,
    create_balance_type,
    create_expense_item,
    create_income_type,
    create_investment_item,
    generate_periods,
    local_midnight_utc,
)
from app.models import Budget, FinancialPeriod, IncomeType, ExpenseItem, BalanceType, PeriodTransaction
from app.version import APP_VERSION


def _make_backup_payload(budget) -> dict:
    """Helper to build a minimal valid backup payload for one budget."""
    return {
        "dosh_backup": True,
        "app_version": APP_VERSION,
        "schema_revision": "test",
        "exported_at": "2026-04-21T00:00:00+00:00",
        "budgets": [
            {
                "old_budgetid": budget.budgetid,
                "budget": {
                    "budgetowner": budget.budgetowner,
                    "description": budget.description,
                    "budget_frequency": budget.budget_frequency,
                    "variance_mode": "always",
                    "auto_add_surplus_to_investment": False,
                    "acceptable_expense_overrun_pct": 10,
                    "comfortable_surplus_buffer_pct": 5,
                    "revision_sensitivity": 50,
                    "savings_priority": 50,
                    "period_criticality_bias": 50,
                    "allow_cycle_lock": True,
                    "account_naming_preference": "Transaction",
                    "locale": "en-AU",
                    "currency": "AUD",
                    "timezone": "Australia/Sydney",
                    "date_format": "medium",
                    "auto_expense_enabled": False,
                    "auto_expense_offset_days": 0,
                    "record_line_status_changes": False,
                    "max_forward_balance_cycles": 10,
                    "health_tone": "supportive",
                },
                "income_types": [],
                "expense_items": [],
                "investment_items": [],
                "balance_types": [],
                "setup_revision_events": [],
                "health_matrices": [],
                "health_summaries": [],
                "periods": [],
            }
        ],
    }


def test_backup_all_budgets(client, db_session):
    budget1 = create_budget(db_session, description="Budget One")
    budget2 = create_budget(db_session, description="Budget Two")

    response = client.post("/api/budgets/backup")
    assert response.status_code == 200
    assert response.headers["content-disposition"].startswith('attachment; filename="dosh-backup-all.json"')

    data = json.loads(response.content)
    assert data["dosh_backup"] is True
    assert data["app_version"] == APP_VERSION
    assert len(data["budgets"]) == 2
    descriptions = {b["budget"]["description"] for b in data["budgets"]}
    assert descriptions == {"Budget One", "Budget Two"}


def test_backup_single_budget(client, db_session):
    budget = create_budget(db_session, description="Solo Budget")
    create_budget(db_session, description="Other Budget")

    response = client.post("/api/budgets/backup", data={"budgetid": budget.budgetid})
    assert response.status_code == 200
    assert f"dosh-backup-budget-{budget.budgetid}.json" in response.headers["content-disposition"]

    data = json.loads(response.content)
    assert len(data["budgets"]) == 1
    assert data["budgets"][0]["budget"]["description"] == "Solo Budget"


def test_backup_single_budget_not_found(client):
    response = client.post("/api/budgets/backup", data={"budgetid": 99999})
    assert response.status_code == 404


def test_restore_inspect_valid_backup(client):
    payload = {
        "dosh_backup": True,
        "app_version": APP_VERSION,
        "schema_revision": "test",
        "exported_at": "2026-04-21T00:00:00+00:00",
        "budgets": [
            {
                "budget": {"description": "Test Budget", "budgetowner": "Alice", "budget_frequency": "Monthly"},
                "income_types": [],
                "expense_items": [],
                "investment_items": [],
                "balance_types": [],
                "setup_revision_events": [],
                "health_matrices": [],
                "health_summaries": [],
                "periods": [],
            }
        ],
    }

    response = client.post(
        "/api/budgets/restore/inspect",
        files={"file": ("backup.json", json.dumps(payload), "application/json")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["budget_count"] == 1
    assert data["budgets"][0]["description"] == "Test Budget"
    assert data["compatibility"] == "exact"


def test_restore_inspect_invalid_json(client):
    response = client.post(
        "/api/budgets/restore/inspect",
        files={"file": ("backup.json", "not json", "application/json")},
    )
    assert response.status_code == 400


def test_restore_inspect_missing_marker(client):
    response = client.post(
        "/api/budgets/restore/inspect",
        files={"file": ("backup.json", json.dumps({}), "application/json")},
    )
    assert response.status_code == 400


def test_restore_apply_creates_new_budget(client, db_session):
    payload = {
        "dosh_backup": True,
        "app_version": APP_VERSION,
        "schema_revision": "test",
        "exported_at": "2026-04-21T00:00:00+00:00",
        "budgets": [
            {
                "budget": {
                    "budgetowner": "Alice",
                    "description": "Restored Budget",
                    "budget_frequency": "Monthly",
                    "variance_mode": "always",
                    "auto_add_surplus_to_investment": False,
                    "acceptable_expense_overrun_pct": 10,
                    "comfortable_surplus_buffer_pct": 5,
                    "revision_sensitivity": 50,
                    "savings_priority": 50,
                    "period_criticality_bias": 50,
                    "allow_cycle_lock": True,
                    "account_naming_preference": "Transaction",
                    "locale": "en-AU",
                    "currency": "AUD",
                    "timezone": "Australia/Sydney",
                    "date_format": "medium",
                    "auto_expense_enabled": False,
                    "auto_expense_offset_days": 0,
                    "record_line_status_changes": False,
                    "max_forward_balance_cycles": 10,
                    "health_tone": "supportive",
                },
                "income_types": [
                    {"incomedesc": "Salary", "amount": "3000.00", "autoinclude": True, "issavings": False, "revisionnum": 0},
                ],
                "expense_items": [
                    {"expensedesc": "Rent", "expenseamount": "1200.00", "active": True, "freqtype": "Always", "paytype": "MANUAL", "revisionnum": 0, "sort_order": 0},
                ],
                "investment_items": [],
                "balance_types": [
                    {"balancedesc": "Main", "balance_type": "Transaction", "opening_balance": "500.00", "active": True, "is_primary": True},
                ],
                "setup_revision_events": [],
                "health_matrices": [],
                "health_summaries": [],
                "periods": [],
            }
        ],
    }

    response = client.post(
        "/api/budgets/restore/apply",
        files={"file": ("backup.json", json.dumps(payload), "application/json")},
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert len(data["restored"]) == 1
    assert data["restored"][0]["description"] == "Restored Budget"
    assert data["warnings"] == []

    # Verify budget exists in DB
    budget = db_session.query(Budget).filter(Budget.description == "Restored Budget").first()
    assert budget is not None
    assert budget.budgetowner == "Alice"

    # Verify related data
    income_types = db_session.query(IncomeType).filter(IncomeType.budgetid == budget.budgetid).all()
    assert len(income_types) == 1
    assert income_types[0].incomedesc == "Salary"
    assert income_types[0].amount == Decimal("3000.00")

    expense_items = db_session.query(ExpenseItem).filter(ExpenseItem.budgetid == budget.budgetid).all()
    assert len(expense_items) == 1
    assert expense_items[0].expensedesc == "Rent"

    balance_types = db_session.query(BalanceType).filter(BalanceType.budgetid == budget.budgetid).all()
    assert len(balance_types) == 1
    assert balance_types[0].balancedesc == "Main"


def test_restore_apply_skips_existing_without_overwrite(client, db_session):
    existing = create_budget(db_session, description="Existing Budget")

    payload = _make_backup_payload(existing)
    payload["budgets"][0]["budget"]["description"] = "Existing Budget"

    response = client.post(
        "/api/budgets/restore/apply",
        files={"file": ("backup.json", json.dumps(payload), "application/json")},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["restored"]) == 0
    assert len(data["warnings"]) == 1
    assert "already exists" in data["warnings"][0]


def test_restore_apply_overwrites_when_allowed(client, db_session):
    existing = create_budget(db_session, description="Overwrite Me", budgetowner="Old Owner")
    create_income_type(db_session, budgetid=existing.budgetid, incomedesc="Old Income")

    payload = {
        "dosh_backup": True,
        "app_version": APP_VERSION,
        "schema_revision": "test",
        "exported_at": "2026-04-21T00:00:00+00:00",
        "budgets": [
            {
                "budget": {
                    "budgetowner": "New Owner",
                    "description": "Overwrite Me",
                    "budget_frequency": "Monthly",
                    "variance_mode": "always",
                    "auto_add_surplus_to_investment": False,
                    "acceptable_expense_overrun_pct": 10,
                    "comfortable_surplus_buffer_pct": 5,
                    "revision_sensitivity": 50,
                    "savings_priority": 50,
                    "period_criticality_bias": 50,
                    "allow_cycle_lock": True,
                    "account_naming_preference": "Transaction",
                    "locale": "en-AU",
                    "currency": "AUD",
                    "timezone": "Australia/Sydney",
                    "date_format": "medium",
                    "auto_expense_enabled": False,
                    "auto_expense_offset_days": 0,
                    "record_line_status_changes": False,
                    "max_forward_balance_cycles": 10,
                    "health_tone": "supportive",
                },
                "income_types": [
                    {"incomedesc": "New Income", "amount": "5000.00", "autoinclude": True, "issavings": False, "revisionnum": 0},
                ],
                "expense_items": [],
                "investment_items": [],
                "balance_types": [],
                "setup_revision_events": [],
                "health_matrices": [],
                "health_summaries": [],
                "periods": [],
            }
        ],
    }

    response = client.post(
        "/api/budgets/restore/apply",
        files={"file": ("backup.json", json.dumps(payload), "application/json")},
        data={"allow_overwrite": "true"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["restored"]) == 1
    assert len(data["warnings"]) == 0

    budget = db_session.query(Budget).filter(Budget.description == "Overwrite Me").first()
    assert budget is not None
    assert budget.budgetowner == "New Owner"

    income_types = db_session.query(IncomeType).filter(IncomeType.budgetid == budget.budgetid).all()
    assert len(income_types) == 1
    assert income_types[0].incomedesc == "New Income"


def test_restore_apply_blocks_newer_backup(client):
    payload = {
        "dosh_backup": True,
        "app_version": "99.0.0-alpha",
        "schema_revision": "test",
        "exported_at": "2026-04-21T00:00:00+00:00",
        "budgets": [
            {
                "budget": {"description": "Future Budget", "budgetowner": "Alice", "budget_frequency": "Monthly"},
                "income_types": [],
                "expense_items": [],
                "investment_items": [],
                "balance_types": [],
                "setup_revision_events": [],
                "health_matrices": [],
                "health_summaries": [],
                "periods": [],
            }
        ],
    }

    response = client.post(
        "/api/budgets/restore/apply",
        files={"file": ("backup.json", json.dumps(payload), "application/json")},
    )
    assert response.status_code == 409
    assert "newer app version" in response.json()["detail"]


def test_restore_apply_selected_indices(client, db_session):
    payload = {
        "dosh_backup": True,
        "app_version": APP_VERSION,
        "schema_revision": "test",
        "exported_at": "2026-04-21T00:00:00+00:00",
        "budgets": [
            {
                "budget": {"budgetowner": "Alice", "description": "First", "budget_frequency": "Monthly", "variance_mode": "always", "auto_add_surplus_to_investment": False, "acceptable_expense_overrun_pct": 10, "comfortable_surplus_buffer_pct": 5, "revision_sensitivity": 50, "savings_priority": 50, "period_criticality_bias": 50, "allow_cycle_lock": True, "account_naming_preference": "Transaction", "locale": "en-AU", "currency": "AUD", "timezone": "Australia/Sydney", "date_format": "medium", "auto_expense_enabled": False, "auto_expense_offset_days": 0, "record_line_status_changes": False, "max_forward_balance_cycles": 10, "health_tone": "supportive"},
                "income_types": [], "expense_items": [], "investment_items": [], "balance_types": [], "setup_revision_events": [], "health_matrices": [], "health_summaries": [], "periods": [],
            },
            {
                "budget": {"budgetowner": "Bob", "description": "Second", "budget_frequency": "Monthly", "variance_mode": "always", "auto_add_surplus_to_investment": False, "acceptable_expense_overrun_pct": 10, "comfortable_surplus_buffer_pct": 5, "revision_sensitivity": 50, "savings_priority": 50, "period_criticality_bias": 50, "allow_cycle_lock": True, "account_naming_preference": "Transaction", "locale": "en-AU", "currency": "AUD", "timezone": "Australia/Sydney", "date_format": "medium", "auto_expense_enabled": False, "auto_expense_offset_days": 0, "record_line_status_changes": False, "max_forward_balance_cycles": 10, "health_tone": "supportive"},
                "income_types": [], "expense_items": [], "investment_items": [], "balance_types": [], "setup_revision_events": [], "health_matrices": [], "health_summaries": [], "periods": [],
            },
        ],
    }

    response = client.post(
        "/api/budgets/restore/apply",
        files={"file": ("backup.json", json.dumps(payload), "application/json")},
        data={"selected_indices": "1"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["restored"]) == 1
    assert data["restored"][0]["description"] == "Second"

    budgets = db_session.query(Budget).all()
    descriptions = {b.description for b in budgets}
    assert "Second" in descriptions
    assert "First" not in descriptions


def test_restore_preserves_periods_and_transactions(client, db_session):
    budget = create_budget(db_session, description="Period Budget")
    create_income_type(db_session, budgetid=budget.budgetid)
    create_expense_item(db_session, budgetid=budget.budgetid)
    create_balance_type(db_session, budgetid=budget.budgetid)
    generate_periods(client, budgetid=budget.budgetid, startdate=local_midnight_utc(datetime.now()), count=2)

    # Backup
    backup_resp = client.post("/api/budgets/backup", data={"budgetid": budget.budgetid})
    payload = json.loads(backup_resp.content)

    # Delete original
    client.delete(f"/api/budgets/{budget.budgetid}")

    # Restore
    restore_resp = client.post(
        "/api/budgets/restore/apply",
        files={"file": ("backup.json", json.dumps(payload), "application/json")},
    )
    assert restore_resp.status_code == 200
    data = restore_resp.json()
    assert len(data["restored"]) == 1

    new_budgetid = data["restored"][0]["new_budgetid"]
    periods = db_session.query(FinancialPeriod).filter(FinancialPeriod.budgetid == new_budgetid).all()
    assert len(periods) > 0

    # Check period incomes exist
    from app.models import PeriodIncome
    period_incomes = db_session.query(PeriodIncome).filter(PeriodIncome.budgetid == new_budgetid).all()
    assert len(period_incomes) > 0
