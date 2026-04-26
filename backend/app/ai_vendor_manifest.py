"""Dynamic LLM vendor/model manifest fetched from OpenRouter.

OpenRouter (https://openrouter.ai) is a well-known, trusted aggregator of
LLM providers. Its /api/v1/models endpoint returns a public list of available
models with metadata. We use it as the canonical source for:
- model id
- provider name
- pricing hints
- context length
"""

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

logger = logging.getLogger(__name__)

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"


def fetch_openrouter_manifest() -> list[dict[str, Any]]:
    """Fetch current model list from OpenRouter. Returns simplified model records."""
    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.get(OPENROUTER_MODELS_URL)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        logger.warning("Failed to fetch OpenRouter manifest: %s", exc)
        return []

    models = data.get("data", [])
    result = []
    for m in models:
        result.append({
            "id": m.get("id"),
            "name": m.get("name"),
            "description": m.get("description"),
            "context_length": m.get("context_length"),
            "pricing": {
                "prompt": m.get("pricing", {}).get("prompt"),
                "completion": m.get("pricing", {}).get("completion"),
            },
        })
    return result


def get_manifest() -> dict[str, Any]:
    """Return manifest payload for the frontend."""
    models = fetch_openrouter_manifest()
    return {
        "source": "openrouter",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "models": models,
    }
