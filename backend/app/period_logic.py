"""
Period generation and expense scheduling logic.
"""
from datetime import datetime, timedelta
from decimal import Decimal
import re
from typing import Optional
from dateutil.relativedelta import relativedelta


FREQ_DAYS = {
    "Weekly": 7,
    "Fortnightly": 14,
}

CUSTOM_FREQUENCY_PATTERN = re.compile(r"^Every (?P<days>\d+) Days$")


def parse_budget_frequency_days(budget_frequency: str) -> Optional[int]:
    match = CUSTOM_FREQUENCY_PATTERN.fullmatch(budget_frequency)
    if not match:
        return None
    return int(match.group("days"))


def calc_period_end(startdate: datetime, budget_frequency: str) -> datetime:
    """Return the inclusive end date for a period given start + frequency."""
    if budget_frequency == "Weekly":
        return startdate + timedelta(days=6)
    elif budget_frequency == "Fortnightly":
        return startdate + timedelta(days=13)
    elif budget_frequency == "Monthly":
        # end = last day of the same month as startdate
        next_month = startdate + relativedelta(months=1)
        return next_month.replace(day=1) - timedelta(days=1)
    custom_days = parse_budget_frequency_days(budget_frequency)
    if custom_days is not None:
        return startdate + timedelta(days=custom_days - 1)
    raise ValueError(f"Unknown budget_frequency: {budget_frequency}")


def periods_overlap(start1: datetime, end1: datetime, start2: datetime, end2: datetime) -> bool:
    """Return True if [start1, end1] overlaps with [start2, end2] (inclusive)."""
    return start1 <= end2 and start2 <= end1


def expense_occurs_in_period(
    freqtype: str,
    frequency_value: int,
    effectivedate: datetime,
    period_start: datetime,
    period_end: datetime,
    expense_amount: Decimal,
) -> Optional[Decimal]:
    """
    Return the total budgeted amount for an expense within a period,
    or None if it does not occur.

    Always: always included once per period.

    Fixed Day of Month: frequency_value = day-of-month (1–31).
        Checks every month within [period_start, period_end] to see if
        that day-of-month falls within the range.

    Every N Days: frequency_value = interval in days.
        Starting from effectivedate, find all occurrences within the period.
    """
    if freqtype == "Always":
        return expense_amount

    if freqtype == "Fixed Day of Month":
        day = frequency_value
        count = 0
        # Walk month by month covering the period
        cursor = period_start.replace(day=1)
        while cursor <= period_end:
            try:
                candidate = cursor.replace(day=day)
            except ValueError:
                # Day doesn't exist in this month (e.g. Feb 30)
                cursor = (cursor + relativedelta(months=1)).replace(day=1)
                continue
            if period_start <= candidate <= period_end:
                count += 1
            cursor = (cursor + relativedelta(months=1)).replace(day=1)
        if count == 0:
            return None
        return expense_amount * count

    elif freqtype == "Every N Days":
        if frequency_value <= 0:
            return None
        if effectivedate > period_end:
            return None
        if effectivedate < period_start:
            delta = (period_start - effectivedate).days
            steps = (delta + frequency_value - 1) // frequency_value
            first_in_period = effectivedate + timedelta(days=steps * frequency_value)
        else:
            first_in_period = effectivedate

        if first_in_period > period_end:
            return None

        count = 0
        current = first_in_period
        while current <= period_end:
            count += 1
            current += timedelta(days=frequency_value)

        return expense_amount * count

    return None
