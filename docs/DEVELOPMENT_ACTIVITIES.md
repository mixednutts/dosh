# Dosh Development Activities (Beta)

This is the **beta execution backlog** for Dosh.

- **High-level roadmap**: [ROADMAP.md](/home/ubuntu/dosh/docs/ROADMAP.md)
- **Pre-beta reference (archived)**: [docs/archive/DEVELOPMENT_ACTIVITIES-pre-beta-2026-04-23.md](/home/ubuntu/dosh/docs/archive/DEVELOPMENT_ACTIVITIES-pre-beta-2026-04-23.md)

## Now / Next / Later

### Now
- Beta backlog is cleared. No discrete feature work remains before rc-1.

### Next
- None. All beta-scope items are either shipped, reclassified as ongoing operational work, or deferred.

### Later
- Scheduled income (phase 1: schema + generation allocation with safe defaults) — future feature, not blocking rc-1
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
- `Completed` (2026-05-02) — framework exists for future metric development

Activities:
- metric library is established in `backend/app/health_engine/system_metrics.py`
- new metrics will be added only when they have clear evidence + user-facing meaning
- keep [BUDGET_HEALTH_METRIC_LIBRARY.md](/home/ubuntu/dosh/docs/BUDGET_HEALTH_METRIC_LIBRARY.md) updated as metrics evolve

#### Activity Group: Health Trending / Momentum

Status:
- `Completed` (2026-05-02)

Activities:
- shipped the `period_trend` metric as an `OVERALL`-scoped system metric that compares the current period's composite health score against the average of recent closed periods
- configurable `lookback_periods` (default 3) and `tolerance_points` (default 5) parameters
- backend executor queries `PeriodHealthResult` snapshots with `is_snapshot=True` for historical periods
- momentum summary derives from `period_trend` when enabled; falls back to historical `_compute_momentum` when disabled
- frontend `TrendBadge` component renders a small inner circle on the overall health score with arrow icon + delta value, only when `period_trend` is present in `pillars`
- momentum text is hidden entirely when `period_trend` is disabled (no fallback text rendered)
- deliverable: `backend/app/health_engine/system_metrics.py`, `backend/app/health_engine/metric_executors.py`, `backend/app/health_engine/runner.py`, `frontend/src/pages/BudgetsPage.jsx`

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

#### Activity Group: Editable Transaction Date/Time and Date Validation

Status:
- `Completed` (2026-04-28)

Activities:
- replaced read-only transaction date display in all three transaction modals with an editable manual text input supporting 14 common `date-fns` parse formats
- implemented `tryParseDateTime()` helper and period-aware validation on blur and form submit using native browser validity APIs
- implemented period-aware default dates: modals open with today's date when inside the period, or the period start date when outside
- aligned investment setup date picker with expense scheduling by replacing native `<input type="date">` with the shared `DateField` component
- removed `"long"` date format option from frontend and backend `DATE_FORMAT_OPTIONS`
- fixed FastAPI startup deprecation by replacing `@app.on_event("startup")` with `lifespan` context manager
- cleaned up orphaned `DateField.jsx` props and unused dropdown CSS from earlier date-picker experiments
- deliverable: `TransactionEntryForm.jsx`, `transactionHelpers.js`, three modal wrappers, `InvestmentItemsTab.jsx`, `DateField.jsx`, `index.css`; 3 backend tests + 8 frontend tests

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

#### Activity Group: Cash-Only Budget Shape — Type-Agnostic Primary Account

Status:
- `Completed` (2026-04-29)

Activities:
- made the primary account resolver type-agnostic across backend and frontend
- `get_primary_account_desc()` no longer filters by `balance_type == "Transaction"`
- `budget_setup_assessment()` accepts any active primary for generation readiness
- `balance_types.py` router enforces exactly one active primary per budget globally
- frontend helpers (`getPrimaryAccountName`, `hasAnyActivePrimary`, `canDeleteAccount`, `getDeleteDisabledReason`) operate globally across types
- unified primary checkbox label and confirmation copy to generic "Primary account" wording
- added backend regression tests for cash-only generation, Cash primary resolution, and cross-type demotion
- updated frontend tests for new generic copy
- version bump: `0.9.0-beta` → `0.9.1-beta`

#### Activity Group: Formula Expression Helpers

Status:
- `Completed` (2026-05-02) — shipped as UX polish, not a discrete feature blocker

Activities:
- improved discoverability and guidance for expression entry where it exists (without weakening numeric-only normal entry)
- consolidated "what operators are supported" into a single user-facing help surface

#### Activity Group: Setup Assessment Design Standardisation and AlertBanner Component

Status:
- `Completed` (2026-04-30)

Activities:
- created `docs/LOOK_AND_FEEL.md` as the canonical design standard for semantic colour usage, alert surfaces, badge rules, and dark-mode constraints
- created reusable `AlertBanner` component (`frontend/src/components/AlertBanner.jsx`) with `info`, `success`, `warning`, and `error` tones, each paired with the correct Heroicon
- refactored Setup Assessment panel in `BudgetDetailPage.jsx` from muddy amber warning styling to clean slate `info` tone (or `success` when ready)
- refactored BudgetInfoForm save-error and blank-owner validation messages to use `AlertBanner`
- changed section helper pills in `SectionShell` from amber to slate for neutral guidance
- changed "No active accounts" helper text in `ExpenseItemsTab.jsx` and `AddExpenseLineModal.jsx` from amber to slate
- added `AlertBanner.test.jsx` with 7 component tests
- all frontend tests pass (364 tests); deployed to local Docker and verified
- no version bump — design standardisation and component extraction

#### Activity Group: UI/UX Consistency and Hover Hint Polish

Status:
- `Completed` (2026-04-30)

Activities:
- defined canonical **Question Mark Click-to-Reveal Hint** pattern in `LOOK_AND_FEEL.md` and applied it consistently across all 4 question-mark helpers (Settings, Expense modal, Income modal, Budget Setup)
- changed all **"In Use" badges** from `badge-amber` (warning tone) to `badge-blue` (informational tone) in `BalanceTypesTab`, `ExpenseItemsTab`, `IncomeTypesTab`, and `InvestmentItemsTab` for both mobile and desktop views
- added **disabled opacity styling** (`disabled:opacity-50 disabled:cursor-not-allowed`) to delete buttons when `can_delete === false` across all setup tabs
- changed **Budget Setup banner** on `BudgetPeriodsPage` from inline amber `div` to `AlertBanner tone="info"`
- added **click-to-reveal question mark hints** to Surplus (Budget) and Surplus (Actual) summary cards on `PeriodDetailPage`
- added **cog icon button** to `PeriodDetailPage` header linking to Budget Setup; changed budget-card edit icon on `BudgetsPage` from pencil to cog for consistency
- maintained **breadcrumb context** when entering Budget Setup from a cycle details page by passing `fromPeriodId` via React Router `location.state`
- no version bump — pure UI/UX polish and design-standard compliance

#### Activity Group: Close Account

Status:
- `Completed` (2026-04-30)

Activities:
- replaced account deletion with a formal Close Account workflow in Budget Setup
- created `POST /budgets/{budgetid}/balance-types/{balancedesc}/close` endpoint that handles balance transfer to another active account, primary account reassignment, and automatic re-linking of expense items to the new primary
- created `GET /budgets/{budgetid}/balance-types/{balancedesc}/close-preview` endpoint returning current balance, primary status, and candidate accounts for transfer/nomination
- closed accounts are removed from all planned (future) budget periods by deleting their `PeriodBalance` rows; `list_period_balances` filters inactive accounts from non-current period dynamic balances
- new `CloseAccountModal` in frontend shows current balance, transfer destination selector (when non-zero), new primary selector (when closing the primary account), and an info banner explaining expense item re-linking
- removed the "Active" checkbox from the Add/Edit Account modal; new accounts are implicitly active and closing is the only way to deactivate
- disabled the edit icon for closed accounts in both desktop and mobile table views
- added backend tests: `test_close_account.py` (7 tests covering preview, zero-balance close, primary requirement, balance transfer, same-account rejection, already-closed rejection, and future-period cleanup)
- updated frontend tests: `BalanceTypesTab.test.jsx` — replaced delete tests with close-modal tests, added edit-disabled assertion for closed accounts
- version bump: `0.9.3-beta` → `0.9.4-beta`

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
- `Completed` (2026-04-30)

Activities:
- defined canonical report payload shapes (`GET /api/reports/budgets/{id}/summary`, `GET /api/reports/budgets/{id}/trends/budget-vs-actual`)
- shipped the first reporting card set on the Reports landing page (Budget vs Actual active, Income Allocation and Investment Trends as "Coming soon")
- added sidebar Reporting navigation with expand/collapse budget list
- delivered: `backend/app/routers/reports.py`, `frontend/src/pages/ReportsLandingPage.jsx`, `frontend/src/components/Layout.jsx`

#### Activity Group: Starter Reports / Graphs

Status:
- `Completed` (2026-05-02)

Activities:
- budget vs actual trend graphs — **shipped** in `frontend/src/components/reports/BudgetVsActualChart.jsx` with Recharts, dark mode support, cycle-based filtering, and surplus toggle
- income allocation trend graph — **shipped** in `frontend/src/components/reports/IncomeAllocationChart.jsx` with stacked area chart, percentage toggle (expenses + investments as % of income), and total income tooltip
- investment trends graph — **shipped** in `frontend/src/components/reports/InvestmentTrendsChart.jsx` with forward-looking projected vs actual cumulative growth lines
- removed budget selector from Reports landing page; `/reports` now auto-redirects to first available budget
- removed budget dropdown from all report pages; budget is sourced from sidebar navigation
- CycleFilter renamed "Periods" → "Cycles", added "Last 3 Cycles" preset, removed From/To date selector, hidden number input spinners
- renamed "Exclude current" toggle to "Current Cycle" with inverted semantics (on = include current cycle)
- added "Range" and "Filters" headings above the two control groups
- Y-axis padding (`{ top: 30, bottom: 10 }`) added to all three report charts to prevent data touching boundaries
- deliverable: `backend/app/routers/reports.py` (3 endpoints), 5 new frontend components/pages, 8 new test files

#### Activity Group: Reporting Sidebar Navigation

Status:
- `Completed` (2026-05-02)

Activities:
- expanded Reporting sidebar section to show Available Reports panel when expanded
- panel lists three active reports with icons and active state: Budget vs Actual, Income Allocation, Investment Trends
- report links automatically include `budgetId` query parameter from current budget context
- fixed `Layout` route matching so report sub-pages (`/reports/budget-vs-actual`, etc.) correctly resolve the current budget from query params
- fixed `useMatch('/reports/:budgetId')` incorrectly matching non-numeric paths (e.g. `/reports/budget-vs-actual`) by adding numeric validation
- reduced Historic cycle shortcuts from 4 to 2 most recent, matching Upcoming cycles behaviour
- updated `Layout.test.jsx` for new shortcut count
- deliverable: `frontend/src/components/Layout.jsx`, `frontend/src/__tests__/Layout.test.jsx`

#### Activity Group: Demo Budget Expansion and Cycle Filter Period-Based Filtering

Status:
- `Completed` (2026-04-30)

Activities:
- expanded demo budget seed data from 3 historical periods to 15 (18 total: 15 historical closed + 1 current + 2 planned)
- start date shifted back 15 months; close-out loop closes all 15 historical periods with varied spending patterns
- added 15 realistic historical patterns showing spending progression, side-hustle variance, utility spikes, and recovery months
- remapped demo features (transfers, edge cases, budget adjustments) across selected historical periods
- updated `test_app_smoke.py` assertions for new period counts (18 periods, 15 closed, 2 planned, 15 snapshots)
- removed unused `_prepare_closeout_target` helper and stale `ACTIVE`/`PLANNED` imports from `demo_budget.py`
- changed Budget vs Actual `CycleFilter` from month-based to period-based filtering
- presets renamed: "Last 12 Months" → "Last 12 Periods", "Last 6 Months" → "Last 6 Periods", "All Time" → "All Periods"
- added custom "Last # periods" number input alongside presets; typing a value dynamically filters to that many most-recent periods
- `computePresetRange` now derives date bounds by slicing the last N entries from `budgetPeriods` instead of using `subMonths`
- `useEffect` dependency updated from `latestDate` to `budgetPeriods.length` so presets re-apply when the budget changes
- updated `CycleFilter.test.jsx` with 8-period mock dataset, tests for custom period count and over-limit capping
- all backend tests pass (349), all frontend tests pass (400)

### 4) Scheduled Income

Reference plan:
- [SCHEDULED_INCOME_AND_AUTO_CARRY_FORWARD_PLAN.md](/home/ubuntu/dosh/docs/plans/SCHEDULED_INCOME_AND_AUTO_CARRY_FORWARD_PLAN.md)

#### Activity Group: Mode + Schema + Safe Defaults

Status:
- `Later` — future feature, not blocking rc-1

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
- `Completed` (external / out of scope of this project)

Activities:
- "getting started" guide for beta users (workflow, what is safe, what is read-only) — to be produced externally
- short "common questions" guide for cycle states, health score meaning, and exports — to be produced externally

#### Activity Group: Formula Library

Status:
- `Completed` (external / out of scope of this project)

Activities:
- "formula definitions" document (what we compute, where it appears, and what it implies) — to be produced externally
- link from UI helpers and reporting cards instead of duplicating prose — to be produced externally

### 6) Quality

#### Activity Group: Backup and Health Metric Patch Fixes

Status:
- `Completed` (2026-04-28)

Activities:
- added datetime stamp (`YYYYMMDDHH24MISS`) to backup filenames so multiple backups are unique and sortable
- fixed "Revisions made on Paid Expenses" health metric counting all expense status changes instead of only actual revisions
- metric now filters by `system_reason = "Line marked Revised"`, `source = "expense"`, and `entrydate > period.startdate`
- renamed metric to "In Cycle Expense Revisions" to better reflect what it measures
- updated `system_metrics.py` name/description, frontend tests, and `BUDGET_HEALTH_METRIC_LIBRARY.md`
- deliverable: `budgets.py` backup router, `metric_executors.py`, `system_metrics.py`, `test_backup_restore.py`, `test_health_engine.py`

#### Activity Group: Cash-Only Investment Contra Transactions, Invested Amount Display, and Balance Stale-Data Fix

Status:
- `Completed` (2026-04-29)
- `Withdrawn` (2026-04-29) — superseded by v0.9.3-beta revert

Activities:
- `build_investment_tx` creates primary+contra transaction pairs for cash-only investments (no `linked_account_desc`)
- investment transaction list endpoint filters out contras; delete endpoint cascades to linked contra
- fixed refund direction for negative cash-only investment amounts (contra credits instead of debits)
- added `invested_amount` to `PeriodBalanceOut` schema; `BalanceSection` renders as blue badge pill
- fixed `balanceTransactionDelta` to check both affected and related accounts for investment source
- fixed stale balance-transactions data by invalidating `balance-transactions` query key across all period-balance mutations
- added backend and frontend regression tests for cash-only investment behavior
- version bump: `0.9.1-beta` → `0.9.2-beta`

#### Activity Group: Revert Cash-Only Investment Contra Transactions (v0.9.2-beta → v0.9.3-beta)

Status:
- `Completed` (2026-04-29)

Activities:
- reverted v0.9.2-beta cash-only investment changes: contra transaction logic, `invested_amount` display, and balance stale-data fixes
- removed `ENTRY_KIND_CONTRA`, `_invested_amounts_for_period`, and two-transaction cash-only investment logic from `transaction_ledger.py`
- removed `invested_amount` from `PeriodBalanceOut` schema and all backend/frontend balance enrichment paths
- removed contra filtering from investment transaction list endpoint and contra cascade deletion from delete endpoint
- restored `build_investment_tx` to single-transaction behavior (affected = linked account, related = source account)
- re-added the "Destination Account" field to the Add/Edit Investment modal in Budget Setup
- added backend validation to require `linked_account_desc` and disallow `linked_account_desc == source_account_desc`
- updated tests: removed cash-only investment tests, added validation tests for same-account rejection
- all backend tests pass (305), all frontend tests pass (342)
- version bump: `0.9.2-beta` → `0.9.3-beta`

#### Activity Group: SonarQube Coverage Gate Remediation

Status:
- `Completed` (2026-04-30)

Activities:
- closed the remaining ~0.6% gap to reach SonarQube 80% new_coverage threshold
- added 27 frontend tests across four new test files targeting the Reporting Framework components that had 0% coverage on new code
  - `BudgetVsActualPage.test.jsx` (8 tests): budget selector, breadcrumbs, loading/empty states, chart rendering, surplus toggle, API query params
  - `CycleFilter.test.jsx` (7 tests): preset selection, custom date range, from/to validation
  - `BudgetVsActualChart.test.jsx` (6 tests): line rendering, dashed vs solid strokes, surplus visibility, tooltip
  - `useChartTheme.test.js` (4 tests): light/dark palette, MutationObserver reactivity
- local coverage on previously 0% files: `BudgetVsActualPage.jsx` 89.65%, `CycleFilter.jsx` 95.83%, `BudgetVsActualChart.jsx` 75%, `useChartTheme.js` 100%
- all backend tests pass (349), all frontend tests pass (393)
- followed TESTING_STRATEGY.md principles: behavior over implementation, avoid coverage theater

#### Activity Group: Patch/Maintenance — Budget vs Actual Timezone Fix

Status:
- `Completed` (2026-05-01)

Activities:
- fixed a timezone mismatch in the Budget vs Actual report where the frontend formatted cycle filter dates using the browser's local timezone while the backend compared against UTC date extractions
- for timezones east of UTC (e.g. Australia/Sydney), this caused the earliest period in a selected range to be incorrectly excluded server-side
- replaced local-timezone `format(date, 'yyyy-MM-dd')` with a UTC-aware `formatUTCDate()` helper in `BudgetVsActualPage.jsx`
- no version bump — ad-hoc bug fix on top of `0.9.5-beta`
- deliverable: `frontend/src/pages/BudgetVsActualPage.jsx`

#### Activity Group: Frontend Test Hardening

Status:
- `Completed` (2026-05-02) — test coverage framework is in place; hardening is now an ongoing operational activity

Activities:
- mobile-path coverage for components gated by `process.env.NODE_ENV !== 'test'` (Dashboard, period-sections)
- drag/drop reordering behavior for expense line items
- status filter changes and paytype toggle edge cases

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

#### Activity Group: Direct-to-Investment Income Surplus Fix

Status:
- `Completed` (2026-04-27)

Activities:
- fixed surplus calculations incorrectly including income routed directly to an investment/savings account (via `IncomeType.linked_account` matching `InvestmentItem.linked_account_desc`)
- treated direct-to-investment income as pre-allocated to investment, excluding it from `surplus_actual` and `surplus_budget` across close-out preview, period summaries, period detail, dashboard, and AI insights payload
- updated `auto_add_surplus_to_investment` generation logic so `auto_surplus_amount` excludes direct-to-investment income
- fixed pre-existing Dashboard bug where `surplusActual` omitted `investmentBudget` subtraction
- added regression test `test_closeout_excludes_direct_to_investment_income_from_surplus`
- version bump: `0.8.3-beta` → `0.8.4-beta`

#### Activity Group: Health Engine Current Period Date Boundary Fix

Status:
- `Completed` (2026-04-27)

Activities:
- fixed Budget Health Engine `evaluate_budget_health()` in `runner.py` using raw `enddate >= now` query that disagreed with canonical `cycle_stage()` logic
- a period is current through `enddate + 1 day`, but the health engine stopped matching it exactly at `enddate`, causing "No current period to evaluate" on the last day of a budget cycle
- replaced raw SQL query with `ordered_budget_periods` + `cycle_stage` to align health engine current-period resolution with the rest of the app
- added regression test `test_evaluate_budget_health_finds_current_period_on_last_day` covering the end-of-cycle boundary
- version bump: `0.8.2-beta` → `0.8.3-beta`

#### Activity Group: Income Remaining Display Fix

Status:
- `Completed` (2026-04-28)

Activities:
- fixed income "Remaining" column showing variance (`actual - budget`) instead of true remaining (`max(0, budget - actual)`)
- aligned income remaining behavior with expense remaining: positive when under budget, zero when actual meets or exceeds budget
- updated `IncomeSection.jsx` (per-row, table footer, mobile footer), `PeriodDetailPage.jsx` mark-as-paid check, `ConfirmPaidModal.jsx`, and `ProgressStatusPill.jsx`
- updated `IncomeSection.test.jsx` expectations to match new behavior
- version bump: `0.8.4-beta` → `0.8.5-beta`

#### Activity Group: Investment Transaction UX Hardening

Status:
- `Completed` (2026-04-28)

Activities:
- removed obsolete backend 422 validation in `investment_transactions.py` that blocked transactions when no default debit account was configured on the investment item; the modal already allows inline debit account selection
- removed the "Destination Account" dropdown from the Add/Edit Investment modal in Budget Setup to reduce confusion; existing `linked_account_desc` values are preserved for backward compatibility
- prevented self-referential investment transactions by filtering the investment's own `linked_account_desc` out of the debit account selector in `InvestmentTxModal.jsx`
- updated `test_investment_transactions.py` and `InvestmentItemsTab.test.jsx`

#### Activity Group: Close-Out UX Polish and Remaining Calculation Consistency

Status:
- `Completed` (2026-04-28)

Activities:
- removed the collapsible score-breakdown section from `CurrentPeriodCheckPanel` and `BudgetHealthModal` because metric details already provide the same information
- moved the budget cycle summary cards (Income Budget, Income Actual, Expense Budget, etc.) above the Close Out Details block on the period detail page for better information hierarchy
- aligned the "Close Out Details" heading style with the "Income" section heading for visual consistency
- fixed expense status pill showing amber at exactly 100% budget usage; now shows green when actual equals budget
- fixed investment status pill showing positive/green variance when actual was below budget; now shows negative/red shortfall consistent with under-budget semantics
- fixed zero-budget expense lines incorrectly showing a green paid pill when actual > 0; now correctly shows red
- fixed income total remaining not matching the sum of per-line remaining values; total remaining now sums `max(0, budget - actual)` for each line
- fixed investment per-line and total remaining to use the same clamped logic as income (`max(0, budget - actual)`) instead of displaying backend negative remainings
- fixed income and investment status pills showing red when actual > budget; over-performance is now shown in green
- over-budget investments can now be marked as paid directly without confirmation since remaining is clamped to zero
- added tests verifying income and investment footer totals match the sum of per-line clamped remainings
- version bump: `0.8.5-beta` → `0.8.6-beta`

#### Activity Group: Budget Cycles Table Header Restructure and Upcoming Tooltip UX

Status:
- `Completed` (2026-04-28)

Activities:
- restructured Budget Cycles Summary table column grouping so the "Investments" heading spans Budget, Actual, and Projected Investment columns
- added a "Tracking" heading that groups Surplus Budget and Surplus Actual columns for clearer information hierarchy
- added days-until-start tooltip to "Upcoming" badges on both Budget Cycles Summary and Budget Cycle Details pages
- tooltip shows "Days until - n" on hover, calculated from the budget timezone for accuracy
- added `cursor-help` to Upcoming badges so users can discover the tooltip affordance
- changed locked-cycle banner dismiss persistence from `sessionStorage` to `localStorage` so the dismiss state survives browser reloads and hard refreshes
- deliverable: `BudgetPeriodsPage.jsx` (table headers, mobile/desktop badge tooltips), `PeriodDetailPage.jsx` (badge tooltip, localStorage dismiss)

#### Activity Group: Budget Setup Restructuring for Multi-Shape Support

Status:
- `Completed` (2026-04-29)

Activities:
- collapsed three account types (`Transaction`/`Savings`/`Cash`) into two (`Banking`/`Cash`) with an `is_savings` boolean qualifier on all accounts
- created destructive Alembic migration `d91762a97794` to backfill `balance_type` values and drop `account_naming_preference` from `Budget`
- removed `account_naming_preference` from `Budget` model, settings UI, and all frontend components
- added `allow_overdraft_transactions` budget setting (default `false`) with balance sufficiency validation for manual expense and investment transactions
- extracted reusable `validate_account_has_sufficient_balance()` in `transaction_ledger.py`; applied to `build_expense_tx` and `build_investment_tx` for non-system transactions
- auto-expense operates independently of the overdraft setting; added persistent visible note in Settings explaining this behaviour
- created `AddInvestmentLineModal` in Period Detail (existing-item mode, one-off scope) with backward carry-forward for opening value
- implemented `_compute_investment_opening_value()` in `period_logic.py` to search across all periods for the most recent closing value
- restored `linked_account_desc` (target account) to the investment setup form and transaction modal display
- created `docs/BUDGET_SHAPES_MATRIX.md` documenting all six supported shapes (S1–S6)
- relaxed setup assessment and generation endpoints to not require expense items, enabling S4 (Savings-Only) and S6 (No-Expense Tracking) shapes
- added backend tests: add-investment endpoint, backward carry-forward, balance sufficiency gate, overdraft toggle, S2–S6 shape validation
- added frontend tests: `AddInvestmentLineModal`, Settings auto-expense overdraft note, `TransactionEntryForm` destination account display
- deliverable: `models.py`, `schemas.py`, `balance_types.py`, `transaction_ledger.py`, `period_logic.py`, `periods.py`, `setup_assessment.py`, `demo_budget.py`, 10+ frontend files, new migration, `BUDGET_SHAPES_MATRIX.md`

#### Activity Group: Investment Movement Delta Fix and Same-Account Validation

Status:
- `Completed` (2026-04-29)

Activities:
- fixed `balanceTransactionDelta` in `transactionHelpers.js` to correctly compute delta for investment debit accounts (`related_account_desc`), not just credit accounts (`affected_account_desc`)
- the fix aligns frontend balance display with backend `_delta_from_account_pair` logic used by `account_delta_for_transaction`
- added `_assert_accounts_are_distinct()` in `investments.py` to reject investment create/update when `source_account_desc == linked_account_desc`
- relaxed `_assert_primary_account_configured()` in `periods.py` to skip the primary check when the budget has no active expense items
- removed hard expense-item requirement from `budget_setup_assessment()`, enabling S4 (Savings-Only) and S6 (No-Expense Tracking) shapes to generate
- added frontend regression tests: `transactionHelpers.test.jsx` (8 tests)
- added backend regression tests: `test_investment_transactions.py` (3 tests for same-account create/update rejection and different-account success)
- deliverable: `transactionHelpers.js`, `investments.py`, `setup_assessment.py`, `periods.py`

## Post-beta note

- Reconciliation is intentionally post-beta because it depends on bank integration / statement ingestion (import/OCR). See [ROADMAP.md](/home/ubuntu/dosh/docs/ROADMAP.md).

