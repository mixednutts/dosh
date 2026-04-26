# Dosh Development Activities (Beta)

This is the **beta execution backlog** for Dosh.

- **High-level roadmap**: [ROADMAP.md](/home/ubuntu/dosh/docs/ROADMAP.md)
- **Pre-beta reference (archived)**: [docs/archive/DEVELOPMENT_ACTIVITIES-pre-beta-2026-04-23.md](/home/ubuntu/dosh/docs/archive/DEVELOPMENT_ACTIVITIES-pre-beta-2026-04-23.md)

## Now / Next / Later

### Now
- Reporting foundations (first useful reports + first drilldown slice)
- Budget health trending / momentum (initial user-visible impact of current cycle)

### Next
- Scheduled income (phase 1: schema + generation allocation with safe defaults)
- User guides + formula library (tight scope, high leverage)

### Later
- Metric library expansion (new metrics only when evidence + meaning are strong)
- Rich reporting (graphs, comparisons, historical filters, more drilldowns)

## Activity Model

This document uses the project activity model:

- `Roadmap Area`
- `Activity Group`
- `Activity`

Status convention:

- `Idea`
- `Active`
- `Next`
- `Later`
- `Completed`

## Roadmap Areas (Beta)

### 1) Budget Health Metrics

#### Activity Group: Expand Metrics

Status:
- `Next`

Activities:
- add new metrics only when they have clear evidence + user-facing meaning
- keep [BUDGET_HEALTH_METRIC_LIBRARY.md](/home/ubuntu/dosh/docs/BUDGET_HEALTH_METRIC_LIBRARY.md) updated as metrics evolve

#### Activity Group: Health Trending / Momentum

Status:
- `Active`

Activities:
- define "trend" semantics (what changes, over what window, and why users should care)
- add an initial trending visualization on budget summary (minimal but trustworthy)

### 2) UX / UI

A generalised area for bugs, UI inconsistencies, and UX improvements. Specific items are tracked below; ad-hoc bugs and UI tweaks should reference this roadmap area from the development activities document.

#### Activity Group: Budget Cycle Detail Header Polish

Status:
- `Completed` (2026-04-23)

Activities:
- redesigned the Budget Cycle Details page header for improved visual hierarchy and clearer cycle status communication
- enhanced breadcrumb navigation with hover transitions and truncation for long budget names
- promoted cycle stage to a visual badge: filled brand-color pill with pulse indicator for Current cycles, bordered badges for Closed/Upcoming
- improved metadata presentation with icon-enhanced frequency display and vertical divider pattern
- deliverable: updated `PeriodDetailPage.jsx` header section (lines 302-347)

#### Activity Group: Release Notes Previous Version Badge Fix

Status:
- `Completed` (2026-04-23)

Activities:
- fixed the in-app Release Notes modal showing "Current Version" badge against older/previous releases
- added a new `tone="previous"` variant to the `ReleaseCard` component with neutral gray styling and "Previous Release" label
- previous releases now render with distinct visual treatment instead of incorrectly reusing the current-release styling
- deliverable: updated `ReleaseNotesModal.jsx` (`ReleaseCard` tone logic and previous-releases map at line 218)

#### Activity Group: Mobile Presentation Layer Improvements

Status:
- `Completed` (2026-04-24)

Activities:
- improved mobile usability across the app through touch-target sizing, card-based table views, and responsive layout polish
- increased all interactive elements to 44px minimum touch target on mobile while preserving exact desktop sizing via Tailwind responsive breakpoints
- replaced horizontal-scrolling detail tables with stacked card views on mobile for Income, Expense, Investment, and Balance sections in period detail
- replaced setup tables with card-based mobile views for IncomeTypesTab, ExpenseItemsTab, and BalanceTypesTab
- added scrollable overflow containers to BudgetPeriodsPage and Dashboard summary tables for edge-to-edge mobile scrolling
- made modals full-screen on mobile with fixed headers, scrollable bodies, and sticky footers; desktop modal sizes unchanged
- made BudgetDetailPage sticky nav horizontally scrollable on mobile without wrapping
- added responsive grid stacking to TransactionEntryForm so fields arrange vertically on narrow screens
- deliverable: new `MobileTableCards.jsx` reusable component; responsive changes across 13 frontend files; 6 new component tests

#### Activity Group: Current Period URL Shortcut

Status:
- `Completed` (2026-04-25)

Activities:
- added `/budgets/:budgetId/periods/current` frontend route that redirects to the actual current period for a given budget
- added backend `GET /budgets/{budgetid}/periods/current` endpoint returning full `PeriodDetailOut` for the current cycle
- fallback redirects to `/budgets/:budgetId` when no current period exists
- deliverable: `CurrentPeriodRedirect.jsx`, `periods.py` endpoint, `api/client.js` helper; 4 backend tests + 4 frontend tests

#### Activity Group: AI Insights

Status:
- `Completed` (2026-04-26)

Activities:
- implemented optional LLM-powered financial insights for budget periods
- budget-level settings for provider selection (OpenRouter / OpenAI-compatible), model, API key, and system prompt
- encrypted API key storage at rest using Fernet with `DOSH_ENCRYPTION_SECRET`
- dynamic vendor/model manifest fetched from OpenRouter API (355 models), sorted alphabetically
- tone-aware prompt generation using existing `health_tone` setting
- AI Insight generation on Period Detail page (current period only) with modal display
- AI Insight preview in Close-out modal — user generates and reviews before confirming close-out
- AI Insight persisted in `PeriodCloseoutSnapshot.ai_insight_text` when included in close-out request
- on-demand AI Insight generation in Budget Summary Health Details modal (`CurrentPeriodCheckModal`)
- encryption secret gating — AI checkbox disabled with explanatory banner when `DOSH_ENCRYPTION_SECRET` not configured
- verify-key endpoint accepts current form values (JSON body) so users can test keys before saving
- verify-key returns full provider error detail (e.g., "Invalid API key or authentication failed...")
- graceful encryption handling — returns `None` silently when secret missing, callers return HTTP 503
- reference plan: [AI_INSIGHTS_IMPLEMENTATION_PLAN.md](/home/ubuntu/dosh/docs/plans/AI_INSIGHTS_IMPLEMENTATION_PLAN.md)

#### Activity Group: Formula Expression Helpers

Status:
- `Active`

Activities:
- improve discoverability and guidance for expression entry where it exists (without weakening numeric-only normal entry)
- consolidate "what operators are supported" into a single user-facing help surface

#### Activity Group: Mid-Cycle Expense Provisioning

Status:
- `Idea`

Activities:
- define behaviour when adding new expenses mid-budget cycle via a provision setting: `Provision Mid Cycle Expenses as zero budget value?`
- when enabled, newly added mid-cycle expenses receive a zero budget value, preserving a realistic view of what was originally budgeted for the period
- when disabled, new expenses receive their generated budget value as usual
- ensure the setting is budget-level and defaults to disabled for backward compatibility
- update period detail UI to reflect zero-budget mid-cycle lines without breaking budget-vs-actual calculations

### 3) Reporting Framework

#### Activity Group: Reporting Foundations

Status:
- `Active`

Activities:
- define the canonical report payload shapes (backend-owned calculations)
- ship the first reporting card set on budget summary
- add the first drilldown slice (budget -> line -> transactions) where it materially helps trust

#### Activity Group: Starter Reports / Graphs

Status:
- `Next`

Activities:
- budget vs actual trend graphs
- investment trend graphs
- income allocation breakdown (expenses vs investments vs transfers)

### 4) Scheduled Income

Reference plan:
- [SCHEDULED_INCOME_AND_AUTO_CARRY_FORWARD_PLAN.md](/home/ubuntu/dosh/docs/plans/SCHEDULED_INCOME_AND_AUTO_CARRY_FORWARD_PLAN.md)

#### Activity Group: Mode + Schema + Safe Defaults

Status:
- `Next`

Activities:
- implement `simple` vs `advanced` mode boundaries
- add scheduling + allocation fields (migration with safe backfill)
- implement generation behavior for `occurrence` (and one additional allocation mode if needed)

#### Activity Group: Automation (Auto Income / Auto Carry-Forward)

Status:
- `Later`

Activities:
- mirror auto-expense patterns for auto-income
- add auto carry-forward for `PENDING_CLOSURE` only when it does not conflict with close-out snapshots

### 5) User Guides + Formula Library

#### Activity Group: Beta User Guides

Status:
- `Next`

Activities:
- "getting started" guide for beta users (workflow, what is safe, what is read-only)
- short "common questions" guide for cycle states, health score meaning, and exports

#### Activity Group: Formula Library

Status:
- `Next`

Activities:
- create/maintain a single "formula definitions" document (what we compute, where it appears, and what it implies)
- link from UI helpers and reporting cards instead of duplicating prose

### 6) Quality

#### Activity Group: SonarQube Coverage Gate Remediation

Status:
- `Active`

Activities:
- close the remaining ~0.9% gap to reach SonarQube 80% new_coverage threshold
- highest-value remaining targets: `client.js` API wrappers, `PeriodDetailPage.jsx` conditional branches, `BackupRestoreModal.jsx` tab states
- continue following TEST_STRATEGY.md principles: behavior over implementation, backend priority, avoid coverage theater

#### Activity Group: Frontend Test Hardening

Status:
- `Active`

Activities:
- add mobile-path coverage for components gated by `process.env.NODE_ENV !== 'test'` (Dashboard, period-sections)
- verify drag/drop reordering behavior for expense line items
- expand coverage for status filter changes and paytype toggle edge cases

#### Activity Group: Security Vulnerability Remediation (SonarQube)

Status:
- `Completed` (2026-04-26)

Activities:
- fixed predictable salt vulnerability (`python:S2053`) in `backend/app/encryption.py` — replaced hardcoded salt with random 16-byte salt per encryption operation
- fixed SSRF vulnerability (`pythonsecurity:S5144`) in AI Insights router and service — added `validate_external_url()` in new `backend/app/url_security.py` to block private IPs, localhost, and non-http/https schemes
- added backward-compatible legacy ciphertext fallback in `decrypt_value()` so existing encrypted API keys continue to work
- added 13 URL security tests and 5 encryption/SSRF tests in `test_url_security.py` and `test_ai_insights.py`
- deliverable: `url_security.py`, `test_url_security.py`, updated `encryption.py`, `ai_insights.py`, `routers/ai_insights.py`

#### Activity Group: SSRF Taint-Analysis Hardening (SonarQube S5144 follow-up)

Status:
- `Completed` (2026-04-26)

Activities:
- restructured `verify_ai_key()` in `backend/app/routers/ai_insights.py` to use `_verified_url` — hardcoded for openrouter, validated-then-assigned for openai_compatible — breaking the taint chain to `httpx.post()`
- restructured `generate_insight()` in `backend/app/ai_insights.py` with same `_verified_url` pattern
- runtime SSRF protection via `validate_external_url()` remains unchanged
- no new tests needed — existing SSRF tests in `test_ai_insights.py` and `test_url_security.py` continue to cover the behavior
- version bump: `0.8.1-beta` → `0.8.2-beta`

#### Activity Group: Migration Chain Reordering Incident (v0.8.0-beta)

Status:
- `Completed` (2026-04-26)

Activities:
- identified critical production startup failure caused by Alembic migration chain reordering in v0.8.0-beta commit
- restored original `down_revision` pointers for `8e182dad69ad` and `z1_drop_legacy_transaction_tables`
- appended new `5a87833110e0` migration to original head (`z1`) instead of inserting between existing migrations
- verified upgrade paths: fresh database, v0.7.0-beta (`z1` head) → fixed v0.8.0, and `8e18` intermediate → head
- added Hard Control #9 to AGENTS.md: NEVER reorder existing Alembic migrations
- recorded full incident report in AGENTS.md with root cause, fix, and prevention rules

## Post-beta note

- Reconciliation is intentionally post-beta because it depends on bank integration / statement ingestion (import/OCR). See [ROADMAP.md](/home/ubuntu/dosh/docs/ROADMAP.md).

