from __future__ import annotations

from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas import BudgetCreate, BudgetUpdate


def test_budget_create_accepts_custom_day_cycles_within_supported_range():
    budget = BudgetCreate(
        budgetowner="Alex",
        description="Ten Day Budget",
        budget_frequency="Every 10 Days",
    )

    assert budget.budget_frequency == "Every 10 Days"


@pytest.mark.parametrize("invalid_frequency", ["Every 1 Days", "Every 366 Days", "Every Ten Days"])
def test_budget_create_rejects_invalid_custom_day_cycles(invalid_frequency):
    with pytest.raises(ValidationError) as exc_info:
        BudgetCreate(
            budgetowner="Alex",
            description="Invalid Budget",
            budget_frequency=invalid_frequency,
        )

    assert "budget_frequency" in str(exc_info.value)


def test_budget_update_validates_optional_frequency_and_quantizes_maximum_deficit():
    update = BudgetUpdate(
        budget_frequency="Every 30 Days",
        maximum_deficit_amount=Decimal("12.345"),
        allow_overdraft_transactions=True,
        locale="en-us",
        currency="usd",
        timezone="America/New_York",
        date_format="MM-DD-YY",
        auto_expense_offset_days=3,
    )

    assert update.budget_frequency == "Every 30 Days"
    assert update.maximum_deficit_amount == Decimal("12.34")
    assert update.allow_overdraft_transactions is True
    assert update.locale == "en-US"
    assert update.currency == "USD"
    assert update.timezone == "America/New_York"
    assert update.date_format == "MM-dd-yy"
    assert update.auto_expense_offset_days == 3


@pytest.mark.parametrize("invalid_value", [{}, [], "maybe"])
def test_budget_update_rejects_invalid_allow_overdraft_transactions(invalid_value):
    with pytest.raises(ValidationError) as exc_info:
        BudgetUpdate(allow_overdraft_transactions=invalid_value)

    assert "allow_overdraft_transactions" in str(exc_info.value)


def test_budget_update_rejects_negative_auto_expense_offset_days():
    with pytest.raises(ValidationError) as exc_info:
        BudgetUpdate(auto_expense_offset_days=-1)

    assert "auto_expense_offset_days" in str(exc_info.value)


@pytest.mark.parametrize("field,value", [
    ("locale", "not a locale"),
    ("locale", "fr-FR"),
    ("currency", "US"),
    ("currency", "ZZZ"),
    ("timezone", "Mars/Colony"),
    ("timezone", "Europe/Paris"),
    ("date_format", "yyyy-QQ-dd"),
])
def test_budget_update_rejects_invalid_localisation_preferences(field, value):
    with pytest.raises(ValidationError) as exc_info:
        BudgetUpdate(**{field: value})

    assert field in str(exc_info.value)


def test_budget_update_accepts_custom_date_format_patterns():
    update = BudgetUpdate(date_format="MMM-DD-YYYY")

    assert update.date_format == "MMM-dd-yyyy"


def test_budget_update_defaults_null_date_format_to_medium():
    update = BudgetUpdate(date_format=None)

    assert update.date_format == "medium"
