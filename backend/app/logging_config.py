from __future__ import annotations

import logging
import os
import sys
from typing import Any

from pythonjsonlogger import jsonlogger


class SyslogJsonFormatter(jsonlogger.JsonFormatter):
    """JSON formatter that uses syslog-style severity names and ISO timestamps."""

    def add_fields(
        self,
        log_record: dict[str, Any],
        record: logging.LogRecord,
        message_dict: dict[str, Any],
    ) -> None:
        super().add_fields(log_record, record, message_dict)
        log_record["timestamp"] = self.formatTime(record)
        log_record["level"] = record.levelname
        log_record["logger"] = record.name

    def formatTime(self, record: logging.LogRecord, datefmt: str | None = None) -> str:
        from datetime import datetime, timezone

        dt = datetime.fromtimestamp(record.created, tz=timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def configure_logging() -> None:
    """Configure structured JSON logging for the application."""
    log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    valid_levels = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
    if log_level_name not in valid_levels:
        logging.basicConfig(
            stream=sys.stdout,
            level=logging.INFO,
            format="%(message)s",
        )
        logging.getLogger(__name__).warning(
            "Invalid LOG_LEVEL %r; falling back to INFO.",
            log_level_name,
        )
        log_level = logging.INFO
    else:
        log_level = getattr(logging, log_level_name)

    handler = logging.StreamHandler(sys.stdout)
    formatter = SyslogJsonFormatter(
        fmt="%(timestamp)s %(level)s %(logger)s %(message)s",
        rename_fields={"timestamp": "timestamp", "level": "level", "logger": "logger"},
    )
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    # Remove existing handlers to avoid duplicates on re-import/reload
    root_logger.handlers.clear()
    root_logger.addHandler(handler)

    # Tune third-party loggers to reduce noise
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("alembic").setLevel(logging.INFO)
