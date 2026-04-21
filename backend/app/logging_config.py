from __future__ import annotations

import logging
import os
import sys


class IsoUtcFormatter(logging.Formatter):
    """Plain-text formatter that uses ISO-8601 UTC timestamps and syslog-style severity names."""

    def formatTime(self, record: logging.LogRecord, datefmt: str | None = None) -> str:
        from datetime import datetime, timezone

        dt = datetime.fromtimestamp(record.created, tz=timezone.utc)
        return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    def format(self, record: logging.LogRecord) -> str:
        timestamp = self.formatTime(record)
        level = record.levelname
        logger_name = record.name
        message = record.getMessage()
        extra_parts = []
        for key, value in record.__dict__.items():
            if key not in {
                "args",
                "asctime",
                "created",
                "exc_info",
                "exc_text",
                "filename",
                "funcName",
                "levelname",
                "levelno",
                "lineno",
                "message",
                "module",
                "msecs",
                "msg",
                "name",
                "pathname",
                "process",
                "processName",
                "relativeCreated",
                "stack_info",
                "taskName",
                "thread",
                "threadName",
            }:
                extra_parts.append(f"{key}={value}")
        if extra_parts:
            message = f"{message}  ({', '.join(extra_parts)})"
        return f"{timestamp} [{level}] {logger_name}: {message}"


def configure_logging() -> None:
    """Configure plain-text logging for the application."""
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
    formatter = IsoUtcFormatter()
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
