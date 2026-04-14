from __future__ import annotations

import os

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from . import database


APP_VERSION = os.getenv("APP_VERSION", "0.4.0-alpha")


def get_display_version(version: str | None = None) -> str:
    return f"v{version or APP_VERSION}"


def get_schema_revision() -> str | None:
    try:
        with database.engine.connect() as connection:
            row = connection.execute(text("SELECT version_num FROM alembic_version LIMIT 1")).first()
    except SQLAlchemyError:
        return None
    return row[0] if row else None
