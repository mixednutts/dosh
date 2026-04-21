from __future__ import annotations

import logging
import os
from io import StringIO

import pytest

from app.logging_config import configure_logging, IsoUtcFormatter


class TestIsoUtcFormatter:
    def test_outputs_plain_text(self) -> None:
        stream = StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(IsoUtcFormatter())
        logger = logging.getLogger("test.plain")
        logger.handlers.clear()
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)

        logger.info("Hello plain text")
        raw = stream.getvalue().strip()

        assert raw.startswith("20")
        assert "[INFO]" in raw
        assert "test.plain:" in raw
        assert "Hello plain text" in raw

    def test_timestamp_format(self) -> None:
        import datetime

        formatter = IsoUtcFormatter()
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
        ts = formatter.formatTime(record)
        assert ts == "2026-04-21T12:00:00.000Z"

    def test_extra_fields(self) -> None:
        stream = StringIO()
        handler = logging.StreamHandler(stream)
        handler.setFormatter(IsoUtcFormatter())
        logger = logging.getLogger("test.extra")
        logger.handlers.clear()
        logger.addHandler(handler)
        logger.setLevel(logging.DEBUG)

        logger.info("Started", extra={"version": "1.0.0", "schema_revision": "abc123"})
        raw = stream.getvalue().strip()

        assert "version=1.0.0" in raw
        assert "schema_revision=abc123" in raw


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
