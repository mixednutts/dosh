"""AI Insights router — manifest and insight generation endpoints."""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Form, HTTPException
from pydantic import BaseModel

from ..ai_insights import generate_insight
from ..ai_vendor_manifest import get_manifest
from ..api_docs import DbSession, error_responses
from ..encryption import decrypt_value, encryption_ready
from ..models import Budget
from ..schemas import PeriodDetailOut

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ai_insights"])


@router.get("/ai-vendors/manifest")
def get_ai_vendor_manifest() -> dict[str, Any]:
    """Return the current LLM vendor/model manifest from OpenRouter."""
    return get_manifest()


@router.get("/ai-config/status")
def get_ai_config_status() -> dict[str, Any]:
    """Return the global AI configuration status (encryption secret, etc.)."""
    return {
        "encryption_ready": encryption_ready(),
    }


@router.post(
    "/budgets/{budgetid}/periods/{finperiodid}/ai-insight",
    responses=error_responses(400, 402, 404, 422, 500),
)
def generate_period_ai_insight(
    budgetid: int,
    finperiodid: int,
    db: DbSession,
    custom_prompt: Annotated[str | None, Form()] = None,
) -> dict[str, Any]:
    """Generate a transient AI insight for the specified period."""
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    if not budget.ai_insights_enabled:
        raise HTTPException(400, "AI insights are not enabled for this budget")

    if not budget.ai_api_key_encrypted:
        raise HTTPException(400, "No API key configured for this budget")

    # Import here to avoid circular imports
    from ..routers.periods import get_period_detail

    period_detail = get_period_detail(budgetid, finperiodid, db)

    # Evaluate health if available
    from ..health_engine import evaluate_budget_health

    health = evaluate_budget_health(db, budgetid)

    try:
        result = generate_insight(
            budget=budget,
            period_detail=period_detail.model_dump(),
            health=health,
            closeout_comments=None,
            closeout_goals=None,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        logger.warning("AI insight generation failed: %s", exc)
        raise HTTPException(500, "Failed to generate AI insight") from exc

    return result


class VerifyKeyPayload(BaseModel):
    api_key: str | None = None
    provider: str | None = None
    model: str | None = None
    base_url: str | None = None
    custom_model: str | None = None


@router.post(
    "/budgets/{budgetid}/ai-insight/verify-key",
    responses=error_responses(400, 402, 404, 422, 500),
)
def verify_ai_key(
    budgetid: int,
    db: DbSession,
    payload: VerifyKeyPayload,
) -> dict[str, Any]:
    """Verify that the configured (or provided) API key is valid by making a minimal test request."""
    budget = db.get(Budget, budgetid)
    if not budget:
        raise HTTPException(404, "Budget not found")

    if not encryption_ready():
        raise HTTPException(503, "DOSH_ENCRYPTION_SECRET is not configured on the server")

    # Use provided provider/settings if given, otherwise fall back to stored budget settings
    test_provider = payload.provider or budget.ai_provider
    test_model = payload.model or budget.ai_model
    test_base_url = payload.base_url or budget.ai_base_url
    test_custom_model = payload.custom_model or budget.ai_custom_model

    # Use provided key if given, otherwise fall back to stored encrypted key
    if payload.api_key:
        key_to_test = payload.api_key
    elif budget.ai_api_key_encrypted:
        key_to_test = decrypt_value(budget.ai_api_key_encrypted)
    else:
        key_to_test = None

    if not key_to_test:
        raise HTTPException(400, "No API key provided. Enter a key above and try again.")

    if test_provider == "openrouter":
        test_base_url = "https://openrouter.ai/api/v1/chat/completions"
        model_id = test_model or "openai/gpt-3.5-turbo"
    elif test_provider == "openai_compatible":
        test_base_url = test_base_url or ""
        model_id = test_custom_model or ""
    else:
        raise HTTPException(400, f"Unsupported AI provider: {test_provider}")

    if not test_base_url:
        raise HTTPException(400, "AI provider base URL is not configured")

    import httpx

    headers = {
        "Authorization": f"Bearer {key_to_test}",
        "Content-Type": "application/json",
    }
    if test_provider == "openrouter":
        headers["HTTP-Referer"] = "https://dosh.mixednutts.ddns.net"

    request_body = {
        "model": model_id,
        "messages": [{"role": "user", "content": "Say 'ok' and nothing else."}],
        "max_tokens": 5,
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(test_base_url, headers=headers, json=request_body)
            response.raise_for_status()
            data = response.json()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        try:
            body = exc.response.json()
            if isinstance(body, dict):
                detail = body.get("error", {}).get("message", str(body))
            else:
                detail = str(body)[:200]
        except Exception:
            detail = exc.response.text[:200] or f"HTTP {status}"
        logger.warning("API key verification failed: %s - %s", status, detail)
        if status == 401:
            detail = f"Invalid API key or authentication failed. Check your key and provider settings. ({detail})"
        raise HTTPException(402, detail) from exc
    except Exception as exc:
        logger.warning("API key verification request failed: %s", exc)
        raise HTTPException(500, f"Failed to verify API key: {exc}") from exc

    return {"status": "valid", "model_used": data.get("model", model_id)}
