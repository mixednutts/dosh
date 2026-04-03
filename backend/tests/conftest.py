from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

TEST_DB_PATH = Path("/tmp") / "dosh-backend-pytest.sqlite3"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ.setdefault("TZ", "Australia/Sydney")

from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine, get_db
from app.main import app
from app.models import AppInfo, PayType


def _seed_reference_rows() -> None:
    with SessionLocal() as db:
        for paytype in ("AUTO", "MANUAL"):
            if not db.get(PayType, paytype):
                db.add(PayType(paytype=paytype))
        if not db.query(AppInfo).first():
            db.add(AppInfo(versionnum="1.0.0"))
        db.commit()


@pytest.fixture(autouse=True)
def reset_database():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    _seed_reference_rows()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def client():
    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
