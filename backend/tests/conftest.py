from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("TZ", "Australia/Sydney")

from fastapi.testclient import TestClient

from app import models as _models  # noqa: F401 - ensure all models are registered
from app import database as database
from app import main as main
from app.database import Base, get_db
from app.models import PayType
from .migration_helpers import build_pre_feature_database

app = main.app


def _seed_reference_rows(session_local) -> None:
    with session_local() as db:
        for paytype in ("AUTO", "MANUAL"):
            if not db.get(PayType, paytype):
                db.add(PayType(paytype=paytype))
        db.commit()


@pytest.fixture(autouse=True)
def isolated_database(tmp_path, monkeypatch):
    db_path = tmp_path / "dosh-backend-pytest.sqlite3"
    test_engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )

    @event.listens_for(test_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    monkeypatch.setattr(database, "engine", test_engine)
    monkeypatch.setattr(database, "SessionLocal", testing_session_local)
    monkeypatch.setattr(main, "engine", test_engine)

    Base.metadata.create_all(bind=test_engine)
    _seed_reference_rows(testing_session_local)
    yield
    app.dependency_overrides.clear()
    test_engine.dispose()


@pytest.fixture
def db_session(isolated_database):
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client(isolated_database):
    def override_get_db():
        db = database.SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def build_pre_feature_db(tmp_path):
    def _build(name: str = "dosh-pre-feature.sqlite3"):
        db_path = tmp_path / name
        return build_pre_feature_database(db_path)

    return _build
