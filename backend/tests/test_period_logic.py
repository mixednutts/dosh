from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from app.period_logic import calc_period_end, expense_occurs_in_period


def test_calc_period_end_for_monthly_returns_last_day_of_month():
    result = calc_period_end(datetime(2026, 2, 1), "Monthly")

    assert result == datetime(2026, 2, 28)


def test_calc_period_end_for_custom_day_cycle_uses_inclusive_length():
    result = calc_period_end(datetime(2026, 2, 1), "Every 10 Days")

    assert result == datetime(2026, 2, 10)


def test_expense_occurs_in_period_every_n_days_counts_multiple_occurrences():
    result = expense_occurs_in_period(
        freqtype="Every N Days",
        frequency_value=7,
        effectivedate=datetime(2026, 4, 1),
        period_start=datetime(2026, 4, 1),
        period_end=datetime(2026, 4, 30),
        expense_amount=Decimal("10.00"),
    )

    assert result == Decimal("50.00")
