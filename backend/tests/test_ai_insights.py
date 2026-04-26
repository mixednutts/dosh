"""Tests for AI Insights feature — encryption, payload builder, prompt builder, router endpoints."""

from __future__ import annotations

import json
from decimal import Decimal
from unittest.mock import patch

import pytest

from app import encryption
from app.ai_insights import build_period_payload, build_prompt, generate_insight
from app.models import Budget

from .factories import create_budget, create_minimum_budget_setup, iso_date


# ── Encryption Tests ──────────────────────────────────────────────────────────

class TestEncryption:
    def test_encryption_ready_when_secret_set(self, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "a-very-long-secret-key-32-chars!!")
        assert encryption.encryption_ready() is True

    def test_encryption_ready_when_secret_missing(self, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "")
        assert encryption.encryption_ready() is False

    def test_encrypt_value_roundtrip(self, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "a-very-long-secret-key-32-chars!!")
        plaintext = "my-api-key-12345"
        ciphertext = encryption.encrypt_value(plaintext)
        assert ciphertext is not None
        assert ciphertext != plaintext
        decrypted = encryption.decrypt_value(ciphertext)
        assert decrypted == plaintext

    def test_encrypt_value_returns_none_when_secret_missing(self, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "")
        assert encryption.encrypt_value("test") is None

    def test_decrypt_value_returns_none_when_secret_missing(self, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "")
        assert encryption.decrypt_value("some-ciphertext") is None

    def test_encrypt_value_returns_none_for_none_input(self, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "a-very-long-secret-key-32-chars!!")
        assert encryption.encrypt_value(None) is None

    def test_decrypt_value_returns_none_for_none_input(self, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "a-very-long-secret-key-32-chars!!")
        assert encryption.decrypt_value(None) is None


# ── Payload Builder Tests ─────────────────────────────────────────────────────

class TestPayloadBuilder:
    def test_build_period_payload_structure(self, db_session):
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]

        period_detail = {
            "period": {
                "cycle_stage": "Current",
                "startdate": "2026-04-01",
                "enddate": "2026-04-30",
                "islocked": False,
            },
            "incomes": [
                {"incomedesc": "Salary", "budgetamount": Decimal("2500.00"), "actualamount": Decimal("2500.00"), "status": "Paid", "is_system": False},
            ],
            "expenses": [
                {"expensedesc": "Rent", "budgetamount": Decimal("1200.00"), "actualamount": Decimal("1200.00"), "remaining_amount": Decimal("0.00"), "status": "Paid", "paytype": "AUTO", "freqtype": "Monthly"},
            ],
            "investments": [
                {"investmentdesc": "Emergency Fund", "budgeted_amount": Decimal("250.00"), "actualamount": Decimal("250.00"), "status": "Paid"},
            ],
            "balances": [
                {"balancedesc": "Main Account", "balance_type": "Transaction", "opening_amount": Decimal("1000.00"), "movement_amount": Decimal("-1200.00"), "closing_amount": Decimal("-200.00")},
            ],
        }

        payload = build_period_payload(period_detail, None, budget)

        assert payload["budget"]["description"] == budget.description
        assert payload["budget"]["frequency"] == budget.budget_frequency
        assert payload["budget"]["health_tone"] == budget.health_tone
        assert payload["period"]["cycle_stage"] == "Current"
        assert payload["totals"]["income_budget"] == 2500.0
        assert payload["totals"]["expense_actual"] == 1200.0
        assert payload["totals"]["investment_budget"] == 250.0
        assert len(payload["income_lines"]) == 1
        assert len(payload["expense_lines"]) == 1
        assert len(payload["investment_lines"]) == 1
        assert len(payload["balances"]) == 1
        assert payload["line_counts"]["income_total"] == 1
        assert payload["line_counts"]["expense_paid"] == 1
        assert payload["line_counts"]["expense_current"] == 0

    def test_build_period_payload_with_health(self, db_session):
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]

        health = {
            "overall_score": 78,
            "overall_status": "Steady",
            "momentum_status": "improving",
            "momentum_delta": 5,
            "current_period_check": {
                "score": 82,
                "status": "Good",
                "summary": "Income is on track.",
                "metrics": [
                    {"name": "Budget vs Actual", "score": 85, "status": "Good", "summary": "Within tolerance."},
                ],
            },
        }

        payload = build_period_payload({"period": {}, "incomes": [], "expenses": [], "investments": [], "balances": []}, health, budget)

        assert payload["health"]["overall_score"] == 78
        assert payload["health"]["current_period_check"]["score"] == 82
        assert len(payload["health"]["metrics"]) == 1

    def test_build_period_payload_with_closeout_context(self, db_session):
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]

        payload = build_period_payload(
            {"period": {}, "incomes": [], "expenses": [], "investments": [], "balances": []},
            None,
            budget,
            closeout_comments="Good month.",
            closeout_goals="Save more.",
        )

        assert payload["closeout_context"]["comments"] == "Good month."
        assert payload["closeout_context"]["goals"] == "Save more."

    def test_build_period_payload_no_closeout_context_when_empty(self, db_session):
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]

        payload = build_period_payload(
            {"period": {}, "incomes": [], "expenses": [], "investments": [], "balances": []},
            None,
            budget,
        )

        assert "closeout_context" not in payload


# ── Prompt Builder Tests ──────────────────────────────────────────────────────

class TestPromptBuilder:
    def test_build_prompt_uses_default_system_prompt(self):
        payload = {"budget": {"description": "Test"}}
        prompt = build_prompt(payload, "supportive", None)

        assert "personal finance advisor" in prompt
        assert "supportive" in prompt
        assert "Budget Period Data:" in prompt
        assert json.dumps(payload, indent=2, default=str) in prompt

    def test_build_prompt_uses_custom_user_prompt(self):
        payload = {"budget": {"description": "Test"}}
        custom = "Be very brief. Tone: {tone}."
        prompt = build_prompt(payload, "direct", custom)

        assert "Be very brief. Tone: direct." in prompt

    def test_build_prompt_formats_tone_placeholder(self):
        payload = {"budget": {"description": "Test"}}
        prompt = build_prompt(payload, "friendly", None)

        assert "friendly" in prompt
        assert "{tone}" not in prompt


# ── Router Endpoint Tests ─────────────────────────────────────────────────────

class TestAIVendorManifest:
    def test_manifest_endpoint_returns_models_list(self, client):
        with patch("app.routers.ai_insights.get_manifest") as mock_manifest:
            mock_manifest.return_value = {
                "source": "openrouter",
                "fetched_at": "2026-04-26T00:00:00Z",
                "models": [{"id": "openai/gpt-4", "name": "GPT-4"}],
            }
            response = client.get("/api/ai-vendors/manifest")

        assert response.status_code == 200
        payload = response.json()
        assert payload["source"] == "openrouter"
        assert len(payload["models"]) == 1
        assert payload["models"][0]["id"] == "openai/gpt-4"


class TestAIConfigStatus:
    def test_ai_config_status_returns_encryption_ready(self, client, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "a-very-long-secret-key-32-chars!!")
        response = client.get("/api/ai-config/status")

        assert response.status_code == 200
        assert response.json()["encryption_ready"] is True

    def test_ai_config_status_returns_encryption_not_ready(self, client, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "")
        response = client.get("/api/ai-config/status")

        assert response.status_code == 200
        assert response.json()["encryption_ready"] is False


class TestGeneratePeriodAIInsight:
    def test_generate_insight_returns_400_when_ai_not_enabled(self, client, db_session):
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]
        budget.ai_insights_enabled = False
        db_session.commit()

        response = client.post(f"/api/budgets/{budget.budgetid}/periods/1/ai-insight")
        assert response.status_code == 400
        assert "not enabled" in response.json()["detail"]

    def test_generate_insight_returns_400_when_no_api_key(self, client, db_session, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "a-very-long-secret-key-32-chars!!")
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]
        budget.ai_insights_enabled = True
        budget.ai_provider = "openrouter"
        budget.ai_model = "openai/gpt-3.5-turbo"
        budget.ai_api_key_encrypted = None
        db_session.commit()

        response = client.post(f"/api/budgets/{budget.budgetid}/periods/1/ai-insight")
        assert response.status_code == 400
        assert "No API key" in response.json()["detail"]

    def test_generate_insight_returns_404_when_budget_not_found(self, client):
        response = client.post("/api/budgets/99999/periods/1/ai-insight")
        assert response.status_code == 404

    def test_generate_insight_with_mocked_llm(self, client, db_session, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "a-very-long-secret-key-32-chars!!")
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]
        budget.ai_insights_enabled = True
        budget.ai_provider = "openrouter"
        budget.ai_model = "openai/gpt-3.5-turbo"
        budget.ai_api_key_encrypted = encryption.encrypt_value("sk-test-key")
        db_session.commit()

        # Generate a period first
        from app.time_utils import utc_now
        startdate = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
        gen_response = client.post(
            f"/api/budgets/{budget.budgetid}/periods/generate",
            json={"budgetid": budget.budgetid, "startdate": iso_date(startdate), "count": 1},
        )
        assert gen_response.status_code == 201
        period_id = gen_response.json()["finperiodid"]

        with patch("app.ai_insights.httpx.Client") as mock_client_class:
            mock_client = mock_client_class.return_value.__enter__.return_value
            mock_client.post.return_value.json.return_value = {
                "choices": [{"message": {"content": "  Your budget looks solid.  "}}],
                "model": "openai/gpt-3.5-turbo",
                "usage": {"prompt_tokens": 100, "completion_tokens": 20},
            }
            mock_client.post.return_value.raise_for_status = lambda: None

            response = client.post(f"/api/budgets/{budget.budgetid}/periods/{period_id}/ai-insight")

        assert response.status_code == 200
        payload = response.json()
        assert payload["insight"] == "Your budget looks solid."
        assert payload["model_used"] == "openai/gpt-3.5-turbo"
        assert payload["prompt_tokens"] == 100
        assert payload["completion_tokens"] == 20


class TestVerifyAIKey:
    def test_verify_key_returns_503_when_encryption_not_ready(self, client, db_session, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "")
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]

        response = client.post(f"/api/budgets/{budget.budgetid}/ai-insight/verify-key", json={})
        assert response.status_code == 503
        assert "not configured" in response.json()["detail"]

    def test_verify_key_returns_400_when_no_key_provided(self, client, db_session, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "a-very-long-secret-key-32-chars!!")
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]
        budget.ai_api_key_encrypted = None
        db_session.commit()

        response = client.post(f"/api/budgets/{budget.budgetid}/ai-insight/verify-key", json={})
        assert response.status_code == 400
        assert "No API key" in response.json()["detail"]

    def test_verify_key_returns_valid_with_provided_key(self, client, db_session, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "a-very-long-secret-key-32-chars!!")
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]

        with patch("httpx.Client") as mock_client_class:
            mock_client = mock_client_class.return_value.__enter__.return_value
            mock_response = mock_client.post.return_value
            mock_response.json.return_value = {
                "choices": [{"message": {"content": "ok"}}],
                "model": "openai/gpt-3.5-turbo",
            }
            mock_response.raise_for_status = lambda: None

            response = client.post(
                f"/api/budgets/{budget.budgetid}/ai-insight/verify-key",
                json={"api_key": "sk-test-key", "provider": "openrouter", "model": "openai/gpt-3.5-turbo"},
            )

        assert response.status_code == 200
        assert response.json()["status"] == "valid"

    def test_verify_key_returns_402_on_401_from_provider(self, client, db_session, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "a-very-long-secret-key-32-chars!!")
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]

        import httpx
        with patch("httpx.Client") as mock_client_class:
            mock_client = mock_client_class.return_value.__enter__.return_value
            mock_response = mock_client.post.return_value
            mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
                "401 Unauthorized", request=None, response=mock_response
            )
            mock_response.status_code = 401
            mock_response.json.return_value = {"error": {"message": "Missing Authentication header"}}
            mock_response.text = '{"error":{"message":"Missing Authentication header"}}'

            response = client.post(
                f"/api/budgets/{budget.budgetid}/ai-insight/verify-key",
                json={"api_key": "bad-key", "provider": "openrouter", "model": "openai/gpt-3.5-turbo"},
            )

        assert response.status_code == 402
        detail = response.json()["detail"]
        assert "Invalid API key" in detail or "Missing Authentication" in detail


# ── Budget Update Encryption Tests ────────────────────────────────────────────

class TestBudgetUpdateEncryptsAPIKey:
    def test_update_budget_encrypts_api_key(self, client, db_session, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "a-very-long-secret-key-32-chars!!")
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]

        response = client.patch(
            f"/api/budgets/{budget.budgetid}",
            json={"ai_api_key": "sk-secret-key-123"},
        )

        assert response.status_code == 200
        assert response.json()["ai_api_key_configured"] is True

        # Verify the key was actually encrypted in the DB
        db_session.refresh(budget)
        assert budget.ai_api_key_encrypted is not None
        assert budget.ai_api_key_encrypted != "sk-secret-key-123"
        decrypted = encryption.decrypt_value(budget.ai_api_key_encrypted)
        assert decrypted == "sk-secret-key-123"

    def test_update_budget_clears_api_key_with_empty_string(self, client, db_session, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "a-very-long-secret-key-32-chars!!")
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]
        budget.ai_api_key_encrypted = encryption.encrypt_value("old-key")
        db_session.commit()

        response = client.patch(
            f"/api/budgets/{budget.budgetid}",
            json={"ai_api_key": ""},
        )

        assert response.status_code == 200
        assert response.json()["ai_api_key_configured"] is False

    def test_update_budget_returns_503_when_encryption_not_ready(self, client, db_session, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "")
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]

        response = client.patch(
            f"/api/budgets/{budget.budgetid}",
            json={"ai_api_key": "sk-secret-key"},
        )

        assert response.status_code == 503
        assert "not configured" in response.json()["detail"]

    def test_budget_out_never_exposes_encrypted_key(self, client, db_session, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "a-very-long-secret-key-32-chars!!")
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]
        budget.ai_api_key_encrypted = encryption.encrypt_value("secret")
        db_session.commit()

        response = client.get(f"/api/budgets/{budget.budgetid}")

        assert response.status_code == 200
        payload = response.json()
        assert "ai_api_key_encrypted" not in payload
        assert "ai_api_key" not in payload
        assert payload["ai_api_key_configured"] is True


# ── Close-Out Insight Persistence Tests ───────────────────────────────────────

class TestCloseoutInsightPersistence:
    def test_closeout_saves_ai_insight_text(self, client, db_session, monkeypatch):
        monkeypatch.setattr(encryption, "_ENCRYPTION_KEY", "a-very-long-secret-key-32-chars!!")
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]

        from app.time_utils import utc_now
        startdate = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
        gen_response = client.post(
            f"/api/budgets/{budget.budgetid}/periods/generate",
            json={"budgetid": budget.budgetid, "startdate": iso_date(startdate), "count": 2},
        )
        assert gen_response.status_code == 201
        periods_response = client.get(f"/api/budgets/{budget.budgetid}/periods")
        periods = periods_response.json()
        active_period = [p for p in periods if p["cycle_status"] == "ACTIVE"][0]
        period_id = active_period["finperiodid"]

        # Close out with an AI insight
        response = client.post(
            f"/api/budgets/{budget.budgetid}/periods/{period_id}/closeout",
            json={
                "create_next_cycle": True,
                "carry_forward": False,
                "comments": "Good month.",
                "goals": "",
                "ai_insight_text": "This was a solid month with controlled expenses.",
            },
        )

        assert response.status_code == 200
        detail = response.json()
        assert detail["closeout_snapshot"] is not None
        assert detail["closeout_snapshot"]["ai_insight_text"] == "This was a solid month with controlled expenses."

    def test_closeout_succeeds_without_ai_insight_text(self, client, db_session):
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]

        from app.time_utils import utc_now
        startdate = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
        gen_response = client.post(
            f"/api/budgets/{budget.budgetid}/periods/generate",
            json={"budgetid": budget.budgetid, "startdate": iso_date(startdate), "count": 2},
        )
        assert gen_response.status_code == 201
        periods_response = client.get(f"/api/budgets/{budget.budgetid}/periods")
        periods = periods_response.json()
        active_period = [p for p in periods if p["cycle_status"] == "ACTIVE"][0]
        period_id = active_period["finperiodid"]

        response = client.post(
            f"/api/budgets/{budget.budgetid}/periods/{period_id}/closeout",
            json={"create_next_cycle": True, "carry_forward": False, "comments": "", "goals": ""},
        )

        assert response.status_code == 200
        detail = response.json()
        assert detail["closeout_snapshot"] is not None
        assert detail["closeout_snapshot"].get("ai_insight_text") is None

    def test_closeout_succeeds_when_ai_insight_text_is_null(self, client, db_session):
        setup = create_minimum_budget_setup(db_session)
        budget = setup["budget"]

        from app.time_utils import utc_now
        startdate = utc_now().replace(hour=0, minute=0, second=0, microsecond=0)
        gen_response = client.post(
            f"/api/budgets/{budget.budgetid}/periods/generate",
            json={"budgetid": budget.budgetid, "startdate": iso_date(startdate), "count": 2},
        )
        assert gen_response.status_code == 201
        periods_response = client.get(f"/api/budgets/{budget.budgetid}/periods")
        periods = periods_response.json()
        active_period = [p for p in periods if p["cycle_status"] == "ACTIVE"][0]
        period_id = active_period["finperiodid"]

        response = client.post(
            f"/api/budgets/{budget.budgetid}/periods/{period_id}/closeout",
            json={"create_next_cycle": True, "carry_forward": False, "comments": "", "goals": "", "ai_insight_text": None},
        )

        assert response.status_code == 200
