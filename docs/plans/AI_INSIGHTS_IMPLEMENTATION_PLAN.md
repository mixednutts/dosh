# AI Insights Implementation Plan

## Overview

Implement an **AI Insights** feature that allows users to optionally generate LLM-powered financial insights for their budget periods. The feature is **opt-in**, **privacy-first**, and **user-configured** (BYO API key).

Key design decisions:
- **Budget-level settings** — AI configuration lives on the `Budget` model (consistent with all other Dosh settings; the app is single-user-per-budget).
- **No server-side API key storage in plaintext** — API keys are stored encrypted at rest using Fernet symmetric encryption with a key derived from an environment variable.
- **Dynamic vendor manifest** — Fetched at runtime from the well-known [OpenRouter API](https://openrouter.ai/docs#api) (a trusted, widely-used LLM aggregator) to provide current models, pricing, and vendor metadata. OpenRouter also acts as the default unified API gateway, eliminating per-vendor client code.
- **OpenAI-compatible fallback** — Users can configure a custom base URL + model name for any OpenAI-compatible provider (local Ollama, Azure, etc.).
- **Tone-aware** — Reuses the existing `health_tone` budget setting (`supportive`/`factual`/`friendly`) to shape the LLM prompt.
- **Current Period focus** — The insight is generated from the current period's financial data (income, expenses, investments, balances, health metrics) and is accessible from the Period Detail page and Budget Summary Health Details modal.
- **Insight persistence (hybrid)** — Current-period generation is **transient** (displayed and discarded). Close-out generation is **persisted** in the close-out snapshot, making it a historical artifact of the closed cycle.
- **Close-out integration** — The user generates the AI insight **before** confirming close-out, reviews it in the modal, and it is saved with the close-out snapshot if they proceed.

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
| `ai_insights_on_closeout` | `Boolean` | `False` | Legacy toggle (retained in schema) |

Also add a computed property:

```python
@property
def ai_api_key_configured(self) -> bool:
    return self.ai_api_key_encrypted is not None
```

### 1.2 Extend `PeriodCloseoutSnapshot` for AI Insight Persistence

**File:** `backend/app/models.py`

Add one column to `PeriodCloseoutSnapshot`:

```python
ai_insight_text = Column(Text, nullable=True)
```

**Rationale:** Close-out is the natural archival boundary for a budget cycle. The close-out snapshot already stores `comments`, `goals`, `health_snapshot_json`, and `totals_snapshot_json` as point-in-time historical artifacts. The AI insight generated at close-out belongs in this same snapshot — it is a reflection on the closed cycle that should be preserved alongside the other close-out data.

Current-period generation (user presses "Generate Insight" on an active cycle) is **transient** — the response is returned to the frontend, displayed in the modal, and not persisted. The user can copy it to clipboard if they wish to keep it.

### 1.3 Update Schemas

**File:** `backend/app/schemas.py`

- Add fields to `BudgetUpdate`:
  - `ai_insights_enabled: Optional[bool] = None`
  - `ai_provider: Optional[str] = None`
  - `ai_model: Optional[str] = None`
  - `ai_base_url: Optional[str] = None`
  - `ai_custom_model: Optional[str] = None`
  - `ai_system_prompt: Optional[str] = None`
  - `ai_insights_on_closeout: Optional[bool] = None`
  - `ai_api_key: Optional[str] = None`  # write-only; encrypted on backend
- Add validator for `ai_provider`: allowed values `{"openrouter", "openai_compatible", None}`
- `BudgetOut` gets all AI fields with defaults; **never expose `ai_api_key_encrypted` in responses** — instead expose a boolean `ai_api_key_configured: bool`

Update `PeriodCloseoutSnapshotOut`:
```python
class PeriodCloseoutSnapshotOut(BaseModel):
    comments: Optional[str] = None
    goals: Optional[str] = None
    carry_forward_amount: Decimal = Decimal("0")
    carry_forward_applied: bool = False
    health_snapshot_json: str
    totals_snapshot_json: str
    ai_insight_text: Optional[str] = None
    created_at: datetime
```

Update `PeriodCloseoutRequest`:
```python
class PeriodCloseoutRequest(BaseModel):
    create_next_cycle: bool = False
    carry_forward: bool = False
    comments: Optional[str] = None
    goals: Optional[str] = None
    ai_insight_text: Optional[str] = None  # insight to save with snapshot
```

### 1.4 Encryption Infrastructure

**File:** `backend/app/encryption.py`

```python
"""Lightweight Fernet encryption for sensitive budget-level settings."""

import logging
import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

logger = logging.getLogger(__name__)
_ENCRYPTION_KEY = os.environ.get("DOSH_ENCRYPTION_SECRET", "").strip()


def encryption_ready() -> bool:
    """Return True if the encryption secret is configured and operational."""
    return bool(_ENCRYPTION_KEY)


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
        return None  # graceful fallback; callers check encryption_ready()
    return fernet.encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str | None) -> str | None:
    if ciphertext is None:
        return None
    fernet = _get_fernet()
    if not fernet:
        return None  # graceful fallback; callers check encryption_ready()
    return fernet.decrypt(ciphertext.encode()).decode()
```

**Add to `backend/requirements.txt`:**
```
cryptography
httpx
```

> **Trade-off:** Using a static salt means identical passwords produce identical ciphertexts, but since each budget stores its own key and the threat model is casual plaintext exposure (not targeted attack), this is acceptable. A per-budget salt would require additional schema complexity. If the user prefers per-budget salt, we can add `ai_api_key_salt` column.

> **Graceful handling:** `encrypt_value()` and `decrypt_value()` return `None` silently when `DOSH_ENCRYPTION_SECRET` is not configured. Callers pre-check with `encryption_ready()` and return HTTP 503 with a clear message. No stack traces are logged.

### 1.5 Alembic Migration

**File:** `backend/alembic/versions/5a87833110e0_add_ai_insights_settings.py`

- Add 8 columns to `budgets` table. All new columns are nullable with safe defaults.
- Add `ai_insight_text` column to `periodcloseouts` table (nullable Text).

---

## Phase 2: Backend — Vendor Manifest and AI Service

### 2.1 Vendor Manifest Service

**File:** `backend/app/ai_vendor_manifest.py`

Fetches model list from OpenRouter `/api/v1/models`. Returns simplified records with `id`, `name`, `description`, `context_length`, and `pricing`.

**API endpoint:** `GET /api/ai-vendors/manifest` — returns the manifest payload.

### 2.2 AI Insights Service

**File:** `backend/app/ai_insights.py`

This module:
1. Builds a structured financial payload from the current period
2. Constructs a tone-aware system prompt
3. Calls the configured LLM API
4. Returns the insight text (for transient use) or persists it to the close-out snapshot

**Payload builder:**

The payload is intentionally **summarized and aggregated** — never raw transaction dumps. The goal is to give the LLM enough context to produce a specific, evidence-based insight without sending excessive data.

**Payload design rules:**

| Rule | Rationale |
|------|-----------|
| **No raw transactions** | Transaction history is voluminous and noisy. Aggregated line-item summaries are sufficient |
| **No account identifiers** | Bank account numbers, IDs, or internal keys are never sent |
| **No personal identifiers** | Budget owner names, emails, or other PII are excluded |
| **Summarized health** | Only the overall score, status, momentum, and metric summaries — not raw evidence arrays |
| **Close-out context included only when relevant** | `closeout_comments` and `closeout_goals` are passed when generating at close-out time |
| **Line counts** | Quick stats (paid/revised/current counts) help the LLM understand cycle maturity |
| **Currency amounts as numbers** | Clean JSON numbers, not formatted strings, so the LLM can reason arithmetically |
| **Tone passed in prompt, not payload** | The `health_tone` is included in budget metadata so the LLM knows the user's preference, but the actual tone shaping happens in the system prompt |

**LLM caller:**

```python
def generate_insight(
    budget: Budget,
    period_detail: dict,
    health: dict | None,
    closeout_comments: str | None = None,
    closeout_goals: str | None = None,
) -> dict:
    """Generate AI insight for the current period.

    Returns a dict with:
        insight: str
        model_used: str
        prompt_tokens: int
        completion_tokens: int
    """
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

**File:** `backend/app/routers/ai_insights.py`

Endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/ai-vendors/manifest` | Dynamic vendor/model manifest |
| `GET` | `/api/ai-config/status` | Global AI config status (encryption_ready) |
| `POST` | `/api/budgets/{budgetid}/periods/{finperiodid}/ai-insight` | Generate transient insight for a period |
| `POST` | `/api/budgets/{budgetid}/ai-insight/verify-key` | Verify API key works |

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

**Verify-key request body (JSON):**
```json
{
  "api_key": "string (optional — falls back to stored key)",
  "provider": "string (optional — falls back to stored provider)",
  "model": "string (optional)",
  "base_url": "string (optional)",
  "custom_model": "string (optional)"
}
```

**Error handling:**
- 400 if AI not enabled or no API key configured
- 401 from provider → translated to 402 with message: "Invalid API key or authentication failed. Check your key and provider settings. (provider detail)"
- 503 if `DOSH_ENCRYPTION_SECRET` is not configured
- 500 for unexpected errors

---

## Phase 3: Frontend — Settings UI

### 3.1 Extend `BudgetHealthTab.jsx`

**File:** `frontend/src/pages/tabs/BudgetHealthTab.jsx`

Add a new **"AI Insights"** section between the **Health Tone** selector and the **Health Metrics** matrix card.

**UI Flow:**

1. **Encryption secret gating** — If `DOSH_ENCRYPTION_SECRET` is not configured:
   - Red banner: "AI Insights unavailable. The server administrator has not configured the encryption secret (DOSH_ENCRYPTION_SECRET). Contact your administrator to enable AI features."
   - "Enable AI Insights" checkbox is **disabled** and visually dimmed

2. **Enablement toggle** — checkbox "Enable AI Insights"
   - When unchecked, all other AI fields are hidden/disabled
   - Shows a warning banner: "Your financial data will be sent to a third-party AI provider. Review the provider's privacy policy before enabling."

3. **Provider selector** — dropdown:
   - "OpenRouter (recommended)"
   - "OpenAI-compatible (custom)"

4. **If OpenRouter selected:**
   - Fetch manifest via `GET /api/ai-vendors/manifest`
   - Show model selector dropdown (sorted alphabetically by `name`)
   - Show "Get API Key" link button → opens `https://openrouter.ai/keys` in new tab
   - API Key input (password type, with reveal toggle)
   - "Verify Key" button (calls verify-key endpoint with current form values)
   - Verify result shows full provider error detail (e.g., "Invalid API key or authentication failed...")

5. **If OpenAI-compatible selected:**
   - Base URL input (placeholder: `http://localhost:11434/v1`)
   - Custom Model Name input
   - API Key input (password type)

6. **System Prompt** — textarea
   - Pre-filled with default prompt
   - Character counter (max 2000)
   - "Reset to default" link

7. **Close-out integration toggle** — checkbox "Generate AI Insight on Close Out"
   - Only visible when AI Insights is enabled and an API key is configured
   - When enabled, the close-out modal will show the AI insight generation UI

8. **Save behavior** — all AI settings save via the existing `updateBudget` mutation
   - API key is sent in the PATCH body; backend encrypts it before storage
   - On successful save, `ai_api_key_configured` becomes true in the budget object

**New API client functions** (`frontend/src/api/client.js`):
```javascript
export const getAIVendorManifest = () => api.get('/ai-vendors/manifest').then(r => r.data)
export const getAIConfigStatus = () => api.get('/ai-config/status').then(r => r.data)
export const generateAIInsight = (budgetId, periodId, data) =>
  api.post(`/budgets/${budgetId}/periods/${periodId}/ai-insight`, data).then(r => r.data)
export const verifyAIKey = (budgetId, data) =>
  api.post(`/budgets/${budgetId}/ai-insight/verify-key`, data).then(r => r.data)
```

---

## Phase 4: Frontend — Period Detail "Generate AI Insights" Button & Modal

### 4.1 "Generate AI Insights" Button on Period Detail

**File:** `frontend/src/pages/PeriodDetailPage.jsx`

Add a **"Generate AI Insights"** button in the header action bar (next to "Export" / "Close Out"), **only when:**
- `budget?.ai_insights_enabled === true`
- `budget?.ai_api_key_configured === true`
- The period is the **current** period (not closed, not planned)

Button style: `btn-secondary` with a sparkle/robot icon.

### 4.2 AI Insight Modal

Inline modal in `PeriodDetailPage`:
1. **Loading state** — spinner while generating
2. **Error state** — show error with retry button
3. **Success state** — display the insight text in a styled card
   - Show model used and token usage in small gray text
   - "Regenerate" button (re-calls API)
   - "Copy to clipboard" button

**No persistence** — the insight is displayed and discarded when the modal closes. The user can copy it to clipboard if they want to keep it.

---

## Phase 5: Backend — Update Budget Router for Encryption

**File:** `backend/app/routers/budgets.py`

In `update_budget()`, intercept `ai_api_key` from the payload:
- If present and non-empty: encrypt via `encrypt_value()` and store in `ai_api_key_encrypted`
- If present and empty string: clear `ai_api_key_encrypted` (user removed key)
- If `encrypt_value()` returns `None` (encryption not ready) and a key was provided: return HTTP 503
- Never return the encrypted key in `BudgetOut` — only `ai_api_key_configured: bool`

---

## Phase 6: Close-Out AI Insight Integration

### 6.1 Close-Out Modal — Generate Before Close

**File:** `frontend/src/components/modals/CloseoutModal.jsx`

When `budget?.ai_insights_enabled && budget?.ai_api_key_configured`:
- Show an **AI Insight** section in the close-out modal with a **"Generate Insight"** button
- When clicked, calls `generateAIInsight()` with the current period and any close-out comments
- Displays the generated insight with **"Regenerate"** option
- If generation fails, shows error but **does not block** close-out

The user reviews the insight (or skips it), then clicks **"Close Out Cycle"**. The insight text (if generated) is passed to the close-out request.

### 6.2 Backend Close-Out — Save Insight from Request

**File:** `backend/app/routers/periods.py`

In `close_out_period()`:
- `close_cycle()` runs first (the core close-out transaction)
- After close-out succeeds, if `payload.ai_insight_text` is provided and the snapshot exists:
  - Save `payload.ai_insight_text` to `period.closeout_snapshot.ai_insight_text`
  - Commit
- Close-out **never fails** because of AI insight issues
- The old fire-and-forget generation logic has been removed — the insight is now generated client-side and passed in the request

### 6.3 Frontend Closed Period Detail — View Persisted Insight

**File:** `frontend/src/pages/PeriodDetailPage.jsx`

When viewing a closed period that has a close-out snapshot with `ai_insight_text`:
- Render the persisted AI insight in the "Close Out Details" section
- Show a label "AI Insight" with the insight text in a styled card

### 6.4 Budget Summary Health Details — On-Demand AI Insight

**File:** `frontend/src/pages/BudgetsPage.jsx`

In `CurrentPeriodCheckModal`:
- When `budget?.ai_insights_enabled && budget?.ai_api_key_configured`:
  - Show **"Generate Insight"** button in the modal
  - Fetches current period dynamically and generates on-demand insight
  - Same loading/error/success states as close-out modal
  - Error does not block viewing health details

---

## Phase 7: Testing

### Backend Tests
**File:** `backend/tests/test_ai_insights.py` (to be created)

- Test payload builder produces expected shape
- Test prompt builder respects tone and custom prompt
- Test encryption round-trip
- Test manifest fetch (mock httpx)
- Test insight generation endpoint with mocked LLM response
- Test 400 when AI not enabled
- Test budget update encrypts API key
- Test BudgetOut never exposes encrypted key
- Test close-out persists insight when `ai_insight_text` provided in request
- Test close-out succeeds even when AI insight is not provided
- Test 503 when encryption secret not configured

### Frontend Tests
**File:** `frontend/src/__tests__/AIInsights.test.jsx` (to be created)

- Test BudgetHealthTab AI section renders between Tone and Metrics
- Test provider selector toggles fields
- Test API key input is password type
- Test "Generate AI Insights" button appears only when enabled + configured
- Test AI insight modal loading/success/error states
- Test copy-to-clipboard functionality
- Test close-out modal shows Generate Insight button when AI enabled
- Test closed period detail renders persisted AI insight from close-out snapshot
- Test verify-key shows provider error detail
- Test encryption-not-configured banner disables AI checkbox

---

## Phase 8: Wiring and Registration

### 8.1 Register Router

**File:** `backend/app/main.py`

Add import and include:
```python
from .routers import ai_insights
app.include_router(ai_insights.router, prefix="/api")
```

### 8.2 Environment Variable

Add to `.env.example`:
```bash
# -----------------------------------------------------------------------------
# Encryption secret for AI API keys
# -----------------------------------------------------------------------------
# This secret is used to encrypt AI provider API keys before they are stored
# in the database. It should be a long, random string (32+ characters).
# 
# To generate a secure secret, run one of these commands in your terminal:
#   openssl rand -hex 32
#   python3 -c "import secrets; print(secrets.token_hex(32))"
#
# IMPORTANT: If this secret is lost or changed, any previously stored API keys
# will become unreadable and users will need to re-enter them.
# -----------------------------------------------------------------------------
DOSH_ENCRYPTION_SECRET=
```

### 8.3 Docker Compose

No changes required — the encryption secret is optional. If not set, AI features that require key storage will return 503 with a clear error message.

---

## Files to Create

| File | Purpose |
|------|---------|
| `backend/app/encryption.py` | Fernet encryption for API keys |
| `backend/app/ai_vendor_manifest.py` | OpenRouter manifest fetcher |
| `backend/app/ai_insights.py` | Payload builder, prompt builder, LLM caller |
| `backend/app/routers/ai_insights.py` | API endpoints for manifest, config status, transient insight generation, and key verification |
| `backend/alembic/versions/5a87833110e0_add_ai_insights_settings.py` | Schema migration (budget columns + closeout snapshot column) |
| `backend/tests/test_ai_insights.py` | Backend tests |
| `frontend/src/__tests__/AIInsights.test.jsx` | Frontend tests |

## Files to Modify

| File | Changes |
|------|---------|
| `backend/app/models.py` | Add 8 AI columns to `Budget`; add `ai_insight_text` to `PeriodCloseoutSnapshot`; add `ai_api_key_configured` property |
| `backend/app/schemas.py` | Add AI fields to `BudgetUpdate`, `BudgetOut`; add `ai_insight_text` to `PeriodCloseoutSnapshotOut`; add `ai_insight_text` to `PeriodCloseoutRequest` |
| `backend/app/routers/budgets.py` | Encrypt `ai_api_key` on update; expose `ai_api_key_configured`; return 503 if encryption not ready |
| `backend/app/routers/periods.py` | Save `ai_insight_text` from close-out request to snapshot; remove fire-and-forget generation |
| `backend/app/main.py` | Include `ai_insights` router |
| `backend/requirements.txt` | Add `cryptography`, `httpx` |
| `frontend/src/api/client.js` | Add `getAIVendorManifest`, `getAIConfigStatus`, `generateAIInsight`, `verifyAIKey` |
| `frontend/src/pages/tabs/BudgetHealthTab.jsx` | Add AI Insights configuration section with encryption gating, verify-key with error detail, sorted model dropdown |
| `frontend/src/pages/PeriodDetailPage.jsx` | Add "Generate AI Insights" button and modal; render persisted close-out insight; pass `budget` to `CloseoutModal` |
| `frontend/src/components/modals/CloseoutModal.jsx` | Add AI insight generation UI (generate/regenerate/error) before close-out; pass insight in close-out request |
| `frontend/src/pages/BudgetsPage.jsx` | Add on-demand AI insight generation to `CurrentPeriodCheckModal` |
| `.env.example` | Add `DOSH_ENCRYPTION_SECRET` with detailed comments |

---

## Decisions Log

| # | Question | Decision |
|---|----------|----------|
| 1 | Settings placement | AI Insights settings live in `BudgetHealthTab.jsx`, between the **Health Tone** selector and the **Health Metrics** matrix — keeping all health/insight configuration in one place |
| 2 | Button label | "Generate AI Insights" (not "AI Insight") to clearly signal an action that initiates AI activities |
| 3 | `.env.example` | Detailed comments explaining what the secret does, how to generate it, and the consequences of losing it |
| 4 | **Insight persistence** | **Hybrid**: Current-period generation is **transient** (displayed in modal, not stored). Close-out generation is **persisted** in `PeriodCloseoutSnapshot.ai_insight_text` as a historical artifact of the closed cycle |
| 5 | Close-out integration | User generates and **reviews** the AI insight **before** confirming close-out. The insight is passed in the close-out request and saved to the snapshot. Close-out never fails because of AI |
| 6 | Why not extend `PeriodHealthResult` | `PeriodHealthResult` stores computed metric snapshots (score, status, evidence) tied to a health matrix. AI insights are externally generated text with different metadata (model, tokens) and a different lifecycle. A dedicated column on `PeriodCloseoutSnapshot` is simpler and semantically correct |
| 7 | Why not a dedicated `PeriodAIInsight` table | Historical value of multiple AI insights per period is low. Insights are transient opinions on current data, not facts. Users can copy anything worth keeping. Close-out is the only context where persistence has clear value |
| 8 | Encryption salt strategy | Static salt (`dosh-static-salt-v1`) for simplicity. Per-budget salt deferred unless security requirements change |
| 9 | Encryption secret missing | `encrypt_value()` and `decrypt_value()` return `None` silently. Callers check `encryption_ready()` and return HTTP 503. No stack traces in logs |
| 10 | Verify-key form data vs JSON | Changed from `Form()` fields to JSON body (`VerifyKeyPayload`) for reliability. Axios sends plain objects naturally |
| 11 | Verify-key error detail | Full provider response body is extracted and returned in HTTP 402 detail. Frontend displays it in a red detail box below the status |
| 12 | Model dropdown sorting | Models are sorted alphabetically by `name` using `localeCompare` for easier discovery |
| 13 | `ai_api_key_configured` | Implemented as a SQLAlchemy computed property (`@property`) on the `Budget` model, reading from `ai_api_key_encrypted is not None`. Schema includes it as a boolean field |
| 14 | Health Details modal AI | `CurrentPeriodCheckModal` in `BudgetsPage.jsx` also supports on-demand AI insight generation, keeping the experience consistent across the app |
