import os
from datetime import datetime
from zoneinfo import ZoneInfo


APP_TIMEZONE = os.getenv("TZ", "Australia/Sydney")


def app_now() -> datetime:
    return datetime.now(ZoneInfo(APP_TIMEZONE))


def app_now_naive() -> datetime:
    return app_now().replace(tzinfo=None)
