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
        account_naming_preference="Checking",
        auto_expense_offset_days=3,
    )

    assert update.budget_frequency == "Every 30 Days"
    assert update.maximum_deficit_amount == Decimal("12.34")
    assert update.account_naming_preference == "Checking"
    assert update.auto_expense_offset_days == 3


@pytest.mark.parametrize("invalid_value", ["Current", "Spending"])
def test_budget_update_rejects_unknown_account_naming_preference(invalid_value):
    with pytest.raises(ValidationError) as exc_info:
        BudgetUpdate(account_naming_preference=invalid_value)

    assert "account_naming_preference" in str(exc_info.value)


def test_budget_update_rejects_negative_auto_expense_offset_days():
    with pytest.raises(ValidationError) as exc_info:
        BudgetUpdate(auto_expense_offset_days=-1)

    assert "auto_expense_offset_days" in str(exc_info.value)
