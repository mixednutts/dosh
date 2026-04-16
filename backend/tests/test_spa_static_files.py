from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import SPAStaticFiles


def _app_with_spaf(directory: str) -> FastAPI:
    app = FastAPI()
    app.mount("/", SPAStaticFiles(directory=directory, html=True), name="static")
    return app


def test_spastaticfiles_falls_back_to_index_html_for_spa_routes(tmp_path: Path):
    index = tmp_path / "index.html"
    index.write_text("<!doctype html><html lang=\"en\"></html>")
    app = _app_with_spaf(str(tmp_path))
    client = TestClient(app)

    response = client.get("/budgets/1")
    assert response.status_code == 200
    assert "<!doctype html>" in response.text


def test_spastaticfiles_falls_back_to_index_html_for_nested_spa_routes(tmp_path: Path):
    index = tmp_path / "index.html"
    index.write_text("<!doctype html><html lang=\"en\"></html>")
    app = _app_with_spaf(str(tmp_path))
    client = TestClient(app)

    response = client.get("/budgets/2/periods/23")
    assert response.status_code == 200
    assert "<!doctype html>" in response.text


def test_spastaticfiles_preserves_api_404(tmp_path: Path):
    index = tmp_path / "index.html"
    index.write_text("<!doctype html><html lang=\"en\"></html>")
    app = _app_with_spaf(str(tmp_path))
    client = TestClient(app)

    response = client.get("/api/budgets/99")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}
