# AI Insights Implementation Plan

## Overview

Implement an **AI Insights** feature that allows users to optionally generate LLM-powered financial insights for their current budget period. The feature is **opt-in**, **privacy-first**, and **user-configured** (BYO API key).

Key design decisions:
- **Budget-level settings** — AI configuration lives on the `Budget` model (consistent with all other Dosh settings; the app is single-user-per-budget).
- **No server-side API key storage in plaintext** — API keys are stored encrypted at rest using Fernet symmetric encryption with a key derived from an environment variable.
- **Dynamic vendor manifest** — Fetched at runtime from the well-known [OpenRouter API](https://openrouter.ai/docs#api) (a trusted, widely-used LLM aggregator) to provide current models, pricing, and vendor metadata. OpenRouter also acts as the default unified API gateway, eliminating per-vendor client code.
- **OpenAI-compatible fallback** — Users can configure a custom base URL + model name for any OpenAI-compatible provider (local Ollama, Azure, etc.).
- **Tone-aware** — Reuses the existing `health_tone` budget setting (`supportive`/`factual`/`friendly`) to shape the LLM prompt.
- **Current Period focus** — The insight is generated from the current period's financial data (income, expenses, investments, balances, health metrics) and is accessible from the Period Detail page.

---

## Phase 1: Backend — Schema, Models, and Encryption

### 1.1 Add AI Settings Columns to `Budget` Model

**File:** `backend/app/models.py`

Add the following columns to the `Budget` model (after `health_tone`):

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `ai_insights_enabled` | `Boolean` | `False` | Master toggle |
| `ai_provider` | `String` | `None` | `"openrouter"`, `"openai_compatible"`, or `None` |
| `ai_model` | `String` | `None` | Selected model ID from manifest |
| `ai_api_key_encrypted` | `String` | `None` | Fernet-encrypted API key |
| `ai_base_url` | `String` | `None` | For OpenAI-compatible custom provider |
| `ai_custom_model` | `String` | `None` | For OpenAI-compatible custom model name |
| `ai_system_prompt` | `Text` | `None` | User-editable prompt override |

### 1.2 Update Schemas

**File:** `backend/app/schemas.py`

- Add fields to `BudgetBase` (or just `BudgetOut`/`BudgetUpdate` since these are settings, not creation-time fields):
  - `ai_insights_enabled: bool = False`
  - `ai_provider: Optional[str] = None`
  - `ai_model: Optional[str] = None`
  - `ai_base_url: Optional[str] = None`
  - `ai_custom_model: Optional[str] = None`
  - `ai_system_prompt: Optional[str] = None`
- Add validator for `ai_provider`: allowed values `{"openrouter", "openai_compatible", None}`
- `BudgetUpdate` gets all optional AI fields
- `BudgetOut` gets all AI fields with defaults; **never expose `ai_api_key_encrypted` in responses** — instead expose a boolean `ai_api_key_configured: bool`

### 1.3 Encryption Infrastructure

**New file:** `backend/app/encryption.py`

```python
"""Lightweight Fernet encryption for sensitive budget-level settings."""

import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

_ENCRYPTION_KEY = os.environ.get("DOSH_ENCRYPTION_SECRET", "").strip()


def _get_fernet() -> Fernet | None:
    if not _ENCRYPTION_KEY:
        return None
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"dosh-static-salt-v1",  # salt is not secret; key material is
        iterations=480_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(_ENCRYPTION_KEY.encode()))
    return Fernet(key)


def encrypt_value(plaintext: str | None) -> str | None:
    if plaintext is None:
        return None
    fernet = _get_fernet()
    if not fernet:
        raise RuntimeError("DOSH_ENCRYPTION_SECRET is not configured")
    return fernet.encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str | None) -> str | None:
    if ciphertext is None:
        return None
    fernet = _get_fernet()
    if not fernet:
        raise RuntimeError("DOSH_ENCRYPTION_SECRET is not configured")
    return fernet.decrypt(ciphertext.encode()).decode()
```

**Add to `backend/requirements.txt`:**
```
cryptography
httpx
```

> **Trade-off:** Using a static salt means identical passwords produce identical ciphertexts, but since each budget stores its own key and the threat model is casual plaintext exposure (not targeted attack), this is acceptable. A per-budget salt would require additional schema complexity. If the user prefers per-budget salt, we can add `ai_api_key_salt` column.

### 1.4 Alembic Migration

**New file:** `backend/alembic/versions/xxxx_add_ai_insights_settings.py`

Add columns to `budgets` table. All new columns are nullable with safe defaults.

---

## Phase 2: Backend — Vendor Manifest and AI Service

### 2.1 Vendor Manifest Service

**New file:** `backend/app/ai_vendor_manifest.py`

```python
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
```

**API endpoint:** `GET /api/ai-vendors/manifest` — returns the manifest payload. Cached in-memory for 5 minutes to avoid hammering OpenRouter.

### 2.2 AI Insights Service

**New file:** `backend/app/ai_insights.py`

This module:
1. Builds a structured financial payload from the current period
2. Constructs a tone-aware system prompt
3. Calls the configured LLM API
4. Returns the insight text

**Payload builder:**
```python
def build_period_payload(period_detail: dict, health: dict | None, budget: Budget) -> dict:
    """Build a concise, LLM-friendly payload from period detail."""
    # Summarize incomes, expenses, investments, balances
    # Include health score and metric summaries if available
    # Include budget metadata (frequency, currency, dates)
    # Exclude raw transaction history — use aggregated totals
```

**Prompt builder:**
```python
DEFAULT_SYSTEM_PROMPT = (
    "You are a personal finance advisor. Review the provided budget period data "
    "and offer a concise, constructive insight. Lead with what is going well, "
    "then mention any watchouts. Keep the tone {tone}. Be specific and evidence-based. "
    "Avoid generic praise. Respond in plain text, no markdown."
)

def build_prompt(payload: dict, tone: str, user_prompt: str | None) -> str:
    system = (user_prompt or DEFAULT_SYSTEM_PROMPT).format(tone=tone)
    data_json = json.dumps(payload, indent=2, default=str)
    return f"{system}\n\nBudget Period Data:\n{data_json}"
```

**LLM caller:**
```python
async def generate_insight(
    budget: Budget,
    period_detail: dict,
    health: dict | None,
) -> str:
    """Generate AI insight for the current period."""
    # Decrypt API key
    # Resolve provider config (OpenRouter vs OpenAI-compatible)
    # Build payload + prompt
    # POST to LLM endpoint
    # Return response text
```

**OpenRouter integration:**
- Base URL: `https://openrouter.ai/api/v1/chat/completions`
- Headers include `Authorization: Bearer <key>` and `HTTP-Referer` (app URL)
- Model ID from `budget.ai_model`

**OpenAI-compatible integration:**
- Base URL from `budget.ai_base_url` (e.g., `http://localhost:11434/v1` for Ollama)
- Model name from `budget.ai_custom_model`
- Same chat completions schema

### 2.3 AI Insights Router

**New file:** `backend/app/routers/ai_insights.py`

Endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ai-vendors/manifest` | Dynamic vendor/model manifest |
| `POST` | `/api/budgets/{budgetid}/periods/{finperiodid}/ai-insight` | Generate insight for a period |
| `POST` | `/api/budgets/{budgetid}/ai-insight/verify-key` | Verify API key works (optional) |

**Request body for generate:**
```json
{
  "custom_prompt": "optional override prompt"
}
```

**Response:**
```json
{
  "insight": "string",
  "model_used": "string",
  "prompt_tokens": 123,
  "completion_tokens": 45
}
```

**Error handling:**
- 400 if AI not enabled or no API key configured
- 402/422 if LLM API returns error
- 500 for unexpected errors

---

## Phase 3: Frontend — Settings UI

### 3.1 Extend `SettingsTab.jsx`

**File:** `frontend/src/pages/tabs/SettingsTab.jsx`

Add a new **"AI Insights"** section at the bottom of the settings card (before the error banner).

**UI Flow:**

1. **Enablement toggle** — checkbox "Enable AI Insights"
   - When unchecked, all other AI fields are hidden/disabled
   - Shows a warning banner: "Your financial data will be sent to a third-party AI provider. Review the provider's privacy policy before enabling."

2. **Provider selector** — dropdown:
   - "OpenRouter (recommended)"
   - "OpenAI-compatible (custom)"

3. **If OpenRouter selected:**
   - Fetch manifest via `GET /api/ai-vendors/manifest`
   - Show model selector dropdown (grouped by provider if possible, or simple searchable list)
   - Show "Get API Key" link button → opens `https://openrouter.ai/keys` in new tab
   - API Key input (password type, with reveal toggle)
   - "Verify Key" button (optional, calls verify-key endpoint)

4. **If OpenAI-compatible selected:**
   - Base URL input (placeholder: `http://localhost:11434/v1`)
   - Custom Model Name input
   - API Key input (password type)

5. **System Prompt** — textarea
   - Pre-filled with default prompt
   - Character counter (max 2000)
   - "Reset to default" link

6. **Save behavior** — all AI settings save via the existing `updateBudget` mutation
   - API key is sent in the PATCH body; backend encrypts it before storage
   - On successful save, `ai_api_key_configured` becomes true in the budget object

**New API client functions** (`frontend/src/api/client.js`):
```javascript
export const getAIVendorManifest = () => api.get('/ai-vendors/manifest').then(r => r.data)
export const generateAIInsight = (budgetId, periodId, data) =>
  api.post(`/budgets/${budgetId}/periods/${periodId}/ai-insight`, data).then(r => r.data)
export const verifyAIKey = (budgetId, data) =>
  api.post(`/budgets/${budgetId}/ai-insight/verify-key`, data).then(r => r.data)
```

---

## Phase 4: Frontend — Period Detail AI Insights Button & Modal

### 4.1 AI Insights Button on Period Detail

**File:** `frontend/src/pages/PeriodDetailPage.jsx`

Add an **"AI Insight"** button in the header action bar (next to "Export" / "Close Out"), **only when:**
- `budget?.ai_insights_enabled === true`
- `budget?.ai_api_key_configured === true`
- The period is the **current** period (not closed, not planned)

Button style: `btn-secondary` with a sparkle/robot icon (use Heroicons `SparklesIcon` or `ChatBubbleLeftRightIcon`).

### 4.2 AI Insight Modal

**New file:** `frontend/src/components/modals/AIInsightModal.jsx`

Modal content:
1. **Loading state** — spinner while generating
2. **Error state** — show error with retry button
3. **Success state** — display the insight text in a styled card
   - Show model used and token usage in small gray text
   - "Regenerate" button (re-calls API)
   - "Copy to clipboard" button
   - Optional: show the raw payload that was sent (collapsible "What was sent?" section)

4. **Custom prompt override** — small textarea at bottom of modal allowing the user to tweak the prompt for this specific request without saving it to settings

**Integration in `PeriodDetailPage`:**
```jsx
const [aiInsightModal, setAiInsightModal] = useState(null)

// In header buttons:
{aiEnabled && (
  <button className="btn-secondary" onClick={() => setAiInsightModal({ periodId: id })}>
    <SparklesIcon className="w-4 h-4" /> AI Insight
  </button>
)}

// In modal render:
{aiInsightModal && (
  <Modal title="AI Insight" onClose={() => setAiInsightModal(null)} size="lg">
    <AIInsightModal budgetId={budgetid} periodId={id} budget={budget} periodDetail={data} />
  </Modal>
)}
```

---

## Phase 5: Backend — Update Budget Router for Encryption

**File:** `backend/app/routers/budgets.py`

In `update_budget()`, intercept `ai_api_key` from the payload:
- If present and non-empty: encrypt via `encrypt_value()` and store in `ai_api_key_encrypted`
- If present and empty string: clear `ai_api_key_encrypted` (user removed key)
- Never return the encrypted key in `BudgetOut` — only `ai_api_key_configured: bool`

---

## Phase 6: Testing

### Backend Tests
**New file:** `backend/tests/test_ai_insights.py`

- Test payload builder produces expected shape
- Test prompt builder respects tone and custom prompt
- Test encryption round-trip
- Test manifest fetch (mock httpx)
- Test insight generation endpoint with mocked LLM response
- Test 400 when AI not enabled
- Test budget update encrypts API key
- Test BudgetOut never exposes encrypted key

### Frontend Tests
**New file:** `frontend/src/__tests__/AIInsights.test.jsx`

- Test SettingsTab AI section renders when enabled
- Test provider selector toggles fields
- Test API key input is password type
- Test AI button appears only when enabled + configured
- Test AIInsightModal loading/success/error states
- Test copy-to-clipboard functionality

---

## Phase 7: Wiring and Registration

### 7.1 Register Router

**File:** `backend/app/main.py`

Add import and include:
```python
from .routers import ai_insights
app.include_router(ai_insights.router, prefix="/api")
```

### 7.2 Environment Variable

Add to `.env.example`:
```bash
# Encryption secret for AI API keys (32+ characters recommended)
DOSH_ENCRYPTION_SECRET=
```

### 7.3 Docker Compose

No changes required — the encryption secret is optional. If not set, AI features that require key storage will return 500 with a clear error message.

---

## Files to Create

| File | Purpose |
|------|---------|
| `backend/app/encryption.py` | Fernet encryption for API keys |
| `backend/app/ai_vendor_manifest.py` | OpenRouter manifest fetcher |
| `backend/app/ai_insights.py` | Payload builder, prompt builder, LLM caller |
| `backend/app/routers/ai_insights.py` | API endpoints for manifest and insight generation |
| `backend/alembic/versions/xxxx_add_ai_insights_settings.py` | Schema migration |
| `backend/tests/test_ai_insights.py` | Backend tests |
| `frontend/src/components/modals/AIInsightModal.jsx` | Insight display modal |
| `frontend/src/__tests__/AIInsights.test.jsx` | Frontend tests |

## Files to Modify

| File | Changes |
|------|---------|
| `backend/app/models.py` | Add 7 AI columns to `Budget` |
| `backend/app/schemas.py` | Add AI fields to `BudgetUpdate`, `BudgetOut`; add `ai_api_key_configured` |
| `backend/app/routers/budgets.py` | Encrypt `ai_api_key` on update; expose `ai_api_key_configured` |
| `backend/app/main.py` | Include `ai_insights` router |
| `backend/requirements.txt` | Add `cryptography`, `httpx` |
| `frontend/src/api/client.js` | Add `getAIVendorManifest`, `generateAIInsight`, `verifyAIKey` |
| `frontend/src/pages/tabs/SettingsTab.jsx` | Add AI Insights configuration section |
| `frontend/src/pages/PeriodDetailPage.jsx` | Add AI Insight button and modal |
| `.env.example` | Add `DOSH_ENCRYPTION_SECRET` |

---

## Open Questions / Decisions for User

1. **Encryption salt strategy:** The plan uses a static salt for simplicity. Would you prefer a per-budget salt (adds `ai_api_key_salt` column) for marginally better security?

2. **Insight persistence:** Should generated insights be stored in the database (e.g., attached to the period) so they can be viewed later, or treated as purely transient?

3. **Scope of insight:** The plan targets the **current period** on the Period Detail page. Should we also add AI insight to the **close-out modal** (as explored in the existing `AI_INSIGHT_ON_CLOSEOUT_PLAN.md`) as a follow-up, or replace the current-period focus with close-out?
