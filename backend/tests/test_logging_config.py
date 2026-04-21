from __future__ import annotations

import json
import logging
import os
from io import StringIO

import pytest

from app.logging_config import configure_logging, SyslogJsonFormatter


class TestSyslogJsonFormatter:
    def test_outputs_valid_json(self) -> None:
        stream = StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(
            SyslogJsonFormatter(
                fmt="%(timestamp)s %(level)s %(logger)s %(message)s"
            )
        )
        logger = logging.getLogger("test.json")
        logger.handlers.clear()
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)

        logger.info("Hello JSON")
        raw = stream.getvalue().strip()
        record = json.loads(raw)

        assert record["level"] == "INFO"
        assert record["logger"] == "test.json"
        assert record["message"] == "Hello JSON"
        assert "timestamp" in record
        assert record["timestamp"].endswith("Z")

    def test_timestamp_format(self) -> None:
        import datetime

        formatter = SyslogJsonFormatter(
            fmt="%(timestamp)s %(level)s %(logger)s %(message)s"
        )
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="msg",
            args=(),
            exc_info=None,
        )
        record.created = datetime.datetime(2026, 4, 21, 12, 0, 0, tzinfo=datetime.timezone.utc).timestamp()
        log_dict = {}
        formatter.add_fields(log_dict, record, {})
        assert log_dict["timestamp"] == "2026-04-21T12:00:00.000Z"


class TestConfigureLogging:
    def test_does_not_raise(self) -> None:
        configure_logging()

    def test_info_level_by_default(self) -> None:
        configure_logging()
        root = logging.getLogger()
        assert root.level == logging.INFO

    def test_debug_level_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("LOG_LEVEL", "DEBUG")
        configure_logging()
        root = logging.getLogger()
        assert root.level == logging.DEBUG

    def test_invalid_level_falls_back_to_info(self, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture) -> None:
        monkeypatch.setenv("LOG_LEVEL", "SILLY")
        caplog.set_level(logging.WARNING)
        configure_logging()
        root = logging.getLogger()
        assert root.level == logging.INFO
        assert "Invalid LOG_LEVEL" in caplog.text

    def test_uvicorn_access_set_to_warning(self) -> None:
        configure_logging()
        assert logging.getLogger("uvicorn.access").level == logging.WARNING

    def test_sqlalchemy_engine_set_to_warning(self) -> None:
        configure_logging()
        assert logging.getLogger("sqlalchemy.engine").level == logging.WARNING
