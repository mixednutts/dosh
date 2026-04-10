import os
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


APP_TIMEZONE = os.getenv("TZ", "Australia/Sydney")


def utc_now() -> datetime:
    """Return current time in UTC (timezone-aware). Use for database storage."""
    return datetime.now(timezone.utc)


def utc_now_naive() -> datetime:
    """Return current UTC time as naive datetime (for backwards compatibility)."""
    return utc_now().replace(tzinfo=None)


def app_now() -> datetime:
    """Return current time in app's configured timezone. Use for display/UI logic only."""
    return datetime.now(ZoneInfo(APP_TIMEZONE))


def app_now_naive() -> datetime:
    """Return current app timezone time as naive datetime."""
    return app_now().replace(tzinfo=None)
