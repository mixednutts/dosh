"""
Period generation and expense scheduling logic.
"""
from calendar import monthrange
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import re
from typing import Optional
from dateutil.relativedelta import relativedelta


def _ensure_utc(value: datetime) -> datetime:
    """Ensure a datetime has UTC timezone."""
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def normalize_budget_date(value: datetime | None, budget_timezone: str) -> datetime | None:
    """Interpret a naive datetime as local midnight in the budget timezone, returning UTC."""
    from zoneinfo import ZoneInfo
    if value is None:
        return None
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc)
    local = value.replace(tzinfo=ZoneInfo(budget_timezone))
    return local.astimezone(timezone.utc)


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


def calc_period_end(startdate: datetime, budget_frequency: str, budget_timezone: str = "UTC") -> datetime:
    """Return the inclusive end date for a period given start + frequency.

    The returned datetime is local midnight in the budget timezone, expressed as UTC.
    """
    from zoneinfo import ZoneInfo
    tz = ZoneInfo(budget_timezone)
    if startdate.tzinfo is None:
        local_start = startdate.replace(tzinfo=tz)
    else:
        local_start = startdate.astimezone(tz)
    local_start = local_start.replace(hour=0, minute=0, second=0, microsecond=0)

    if budget_frequency == "Weekly":
        local_end = local_start + timedelta(days=6)
    elif budget_frequency == "Fortnightly":
        local_end = local_start + timedelta(days=13)
    elif budget_frequency == "Monthly":
        next_month = local_start + relativedelta(months=1)
        local_end = next_month.replace(day=1) - timedelta(days=1)
    else:
        custom_days = parse_budget_frequency_days(budget_frequency)
        if custom_days is not None:
            local_end = local_start + timedelta(days=custom_days - 1)
        else:
            raise ValueError(f"Unknown budget_frequency: {budget_frequency}")

    return local_end.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)


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
    # Normalize all datetime inputs to UTC for consistent comparison
    period_start = _ensure_utc(period_start)
    period_end = _ensure_utc(period_end)
    
    if freqtype == "Always":
        return expense_amount

    if freqtype == "Fixed Day of Month":
        effectivedate = _ensure_utc(effectivedate)
        if effectivedate > period_end:
            return None
        day = frequency_value
        count = 0
        # Walk month by month, including the previous month because an
        # overflowed fixed-day occurrence can land on day 1 of the current month.
        cursor = (period_start.replace(day=1) - timedelta(days=1)).replace(day=1)
        while cursor <= period_end:
            candidate = fixed_day_occurrence_for_month(cursor, day)
            if period_start <= candidate <= period_end:
                count += 1
            cursor = (cursor + relativedelta(months=1)).replace(day=1)
        if count == 0:
            return None
        return expense_amount * count

    elif freqtype == "Every N Days":
        if frequency_value <= 0:
            return None
        # Normalize effectivedate to UTC for comparison with period dates
        effectivedate = _ensure_utc(effectivedate)
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


def fixed_day_occurrence_for_month(month_start: datetime, day: int) -> datetime:
    last_day = monthrange(month_start.year, month_start.month)[1]
    if day <= last_day:
        return month_start.replace(day=day)
    return month_start.replace(day=last_day) + timedelta(days=1)


def _compute_investment_opening_value(
    budgetid: int,
    investmentdesc: str,
    current_period_id: int,
    db,
) -> Decimal:
    """Compute opening value for an investment by looking backward across all periods.

    Finds the most recent period (before current_period_id) that contains this
    investment and returns its closing_value. Falls back to InvestmentItem.initial_value
    if no prior period has the investment.
    """
    from sqlalchemy.orm import Session
    from .models import FinancialPeriod, PeriodInvestment, InvestmentItem

    session: Session = db

    # Find the most recent period before current that has this investment
    prior_pi = (
        session.query(PeriodInvestment)
        .join(FinancialPeriod, PeriodInvestment.finperiodid == FinancialPeriod.finperiodid)
        .filter(
            FinancialPeriod.budgetid == budgetid,
            PeriodInvestment.investmentdesc == investmentdesc,
            FinancialPeriod.finperiodid != current_period_id,
        )
        .order_by(FinancialPeriod.startdate.desc(), FinancialPeriod.finperiodid.desc())
        .first()
    )

    if prior_pi is not None:
        return Decimal(str(prior_pi.closing_value or 0))

    # Fallback to initial value
    item = session.get(InvestmentItem, (budgetid, investmentdesc))
    if item is not None:
        return Decimal(str(item.initial_value or 0))

    return Decimal("0.00")
