# Dosh Project Context

This document initializes a practical working context for new Dosh development.

It is a synthesis of the current Markdown sources in this repository:

- [README.md](/home/ubuntu/dosh/README.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)
- [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md)
- [BUDGET_ADJUSTMENT_REVISION_HISTORY_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_ADJUSTMENT_REVISION_HISTORY_PLAN.md)
- [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/plans/BUDGET_HEALTH_ADDENDUM.md)
- [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md)
- [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/docs/tests/TEST_EXPANSION_PLAN.md)
- [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md)
- [INCOME_TRANSACTIONS_UNIFICATION_AND_LEGACY_LEDGER_CLEANUP_PLAN.md](/home/ubuntu/dosh/docs/plans/INCOME_TRANSACTIONS_UNIFICATION_AND_LEGACY_LEDGER_CLEANUP_PLAN.md)
- [INLINE_EXPRESSION_AMOUNT_INPUT_PLAN.md](/home/ubuntu/dosh/docs/plans/INLINE_EXPRESSION_AMOUNT_INPUT_PLAN.md)

Use this as the quick-start development handoff. Use the source documents above when deeper detail is needed.

## Project Guidelines

These guidelines apply across the project as a whole and should continue guiding future work.

### Documentation

- follow [DOCUMENTATION_FRAMEWORK.md](/home/ubuntu/dosh/docs/DOCUMENTATION_FRAMEWORK.md)
- use [README.md](/home/ubuntu/dosh/README.md) as the top-level entry point
- use this document as the operational handoff for new AI sessions
- maintain one primary source of truth per topic
- prefer cross-links over duplicating maintained content
- update [DOCUMENT_REGISTER.md](/home/ubuntu/dosh/docs/DOCUMENT_REGISTER.md) when managed documents are added, moved, renamed, or materially repurposed
- preserve meaning and context when reorganizing documentation

### Product and UX

- favor functional clarity over decorative redesign
- keep the product practical, supportive, and workflow-driven rather than corporate or accounting-heavy
- workflow meaning should take priority over isolated CRUD convenience
- user-facing wording may evolve for clarity, while stable backend or domain naming should only change when clearly justified
- preserve the compact or collapsible desktop mode as new features arrive
- avoid duplicate edit or setup entry points on the same screen unless they serve clearly different purposes
- keep budget-edit affordances visually attached to the budget amount they change rather than mixing them into transaction-action rails
- calculation-aided amount entry should keep the raw typed expression visible and avoid treating incomplete arithmetic input as a hard validation failure while the user is still typing
- lightweight onboarding or explainer copy in high-traffic flows should stay compact by default and expand for deeper detail only when the user asks for it

### Domain Integrity

- balance movement should remain transaction-derived and explainable from the ledger
- do not introduce shortcuts that weaken ledger trust
- actual-entry workflows should remain transaction-first unless a deliberate exception is designed
- preserve historical meaning rather than recomputing it from later settings when that would distort history

### Lifecycle and Continuity

- there should only ever be one active or current cycle per budget
- closed cycles should remain trustworthy historical records
- carry-forward and next-cycle opening rebasing must stay synchronized
- guided continuity should be preferred over ambiguous deletion behavior or retained gaps

### Setup and Protection

- centralized setup assessment must remain the source of truth for readiness and protection
- do not reintroduce scattered page-local readiness assumptions
- keep setup editable where safe, but protect records once downstream dependence exists
- setup revision numbers should map to stored history records rather than unsupported counter drift
- setup history should preserve both the current setup summary and the revision or adjustment timeline needed to explain changes

### Budget Health

- keep budget health supportive and explainable, not overly authoritative
- use practical language users can reasonably trust
- be explicit when the concept is deficit rather than surplus
- prefer event-backed planning-change evidence over duplicated status-change justification prompts
- do not let later personalisation rewrite the meaning of historical closed cycles

### Localisation

- treat localisation as explicit and centrally managed
- prefer display-layer regional variation over unnecessary internal domain renaming
- setup guidance and readiness messaging should respect the budget-level account naming preference rather than hard-coding `transaction` wording when a localized label such as `Everyday` or `Checking` is active

### Testing and Change Safety

- maintain a test-with-change discipline for meaningful workflow changes
- keep backend test isolation in place for mixed-area work
- treat high-risk workflow changes with extra care, especially around lifecycle, close-out, ledger behavior, and historical integrity
- treat SonarQube hotspots and coverage gaps as signals for thin risk areas, not as the definition of quality
- when expanding coverage for quality-gate follow-through, prefer tests that protect meaningful workflow behavior, financial integrity, historical correctness, or user-critical guidance rather than metric-only line execution
- when continuing SonarQube cleanup, re-pull the latest successful artifact and confirm the exact remaining issue list before planning the next pass, because the live residual count can differ from remembered summaries

### Operational Rules

- keep demo-budget import additive-only unless a separately designed reset workflow exists
- keep Docker Compose as the shared source of truth for `DEV_MODE`
- backend enforcement should continue even when the frontend hides dev-only controls

## Current Product Shape

Dosh is no longer an early CRUD prototype.

It is now a workflow-driven personal finance application with:

- FastAPI backend under [backend/app](/home/ubuntu/dosh/backend/app)
- React frontend under [frontend/src](/home/ubuntu/dosh/frontend/src)
- explicit budget-cycle lifecycle state
- transaction-backed balance movement
- savings and investment planning as normal workflow features
- budget health scoring with explainable evidence and budget-specific personalisation
- centralized setup assessment for budget-cycle readiness and downstream setup protection
- automated regression coverage across backend, frontend, and initial end-to-end flows

The product direction is practical, personal, and supportive rather than corporate or accounting-heavy. Functional clarity is preferred over decorative redesign.

Localisation and regional-fit work now has an initial live slice through budget-level account naming preferences, while the core domain model still stays terminology-stable underneath.

## Current Technical Shape

Backend:

- FastAPI
- SQLAlchemy
- SQLite
- lifecycle and continuity logic in [cycle_management.py](/home/ubuntu/dosh/backend/app/cycle_management.py)
- budgeting and generation logic in [period_logic.py](/home/ubuntu/dosh/backend/app/period_logic.py)
- budget health logic in [budget_health.py](/home/ubuntu/dosh/backend/app/budget_health.py)
- transaction-backed movement and ledger support in [transaction_ledger.py](/home/ubuntu/dosh/backend/app/transaction_ledger.py)

Frontend:

- React 18
- Vite
- standalone Jest plus React Testing Library
- React Router
- React Query
- Tailwind CSS
- `prop-types` is now part of the frontend baseline so shared and page-level React components can carry explicit prop contracts for SonarQube-backed maintainability
- period-detail modal amount expressions now use a small `jsep`-based parser plus a narrow arithmetic-only evaluator rather than a broader general-purpose math dependency
- current route flow defined in [App.jsx](/home/ubuntu/dosh/frontend/src/App.jsx)

Operational note:

- transitional startup schema patching is no longer the primary schema strategy, but one lightweight compatibility cleanup still exists in [main.py](/home/ubuntu/dosh/backend/app/main.py) to remove a legacy `incometypes.isfixed` column if that column is still present
- the repo now has an explicit transaction-ledger cutover script in [cutover_unified_transactions.py](/home/ubuntu/dosh/backend/scripts/cutover_unified_transactions.py) for the current schema baseline
- proper versioned migrations still remain a near-term engineering need from that new baseline
- backend tests now run against an isolated SQLite database per test case through [conftest.py](/home/ubuntu/dosh/backend/tests/conftest.py)
- Docker Compose remains the active deployment path, with the frontend exposed on port `3080`
- this repo also includes [docker-compose.override.yml](/home/ubuntu/dosh/docker-compose.override.yml) for Traefik-facing frontend deployment wiring, so deploys that need the public host path should include both compose files rather than the base file alone
- the frontend Docker build now uses Node 20 rather than the old Node 16 baseline
- Docker Compose `DEV_MODE` is now the shared control point for dev-only demo-budget behavior across frontend build visibility and backend runtime enforcement
- the backend router baseline now uses a shared [api_docs.py](/home/ubuntu/dosh/backend/app/api_docs.py) helper with `DbSession` and centralized `error_responses(...)` metadata for FastAPI endpoints
- the SonarQube workflow now exports a sanitized artifact summary even when the quality gate fails, and the repo includes [fetch_latest_sonar_artifact.sh](/home/ubuntu/dosh/scripts/fetch_latest_sonar_artifact.sh) so future sessions can inspect the latest successful artifact quickly
- failed-run Sonar artifacts now include explicit `failingQualityGateConditions` plus [sonar-component-metrics.json](/tmp/dosh-sonar-artifact/run-24018996530/sonar-summary-24018996530/sonar-component-metrics.json) for file-level new-code duplication or coverage hotspots
- the frontend entry HTML now links the shared public [icon.svg](/home/ubuntu/dosh/frontend/public/icon.svg) as the live favicon and touch icon
- the latest verified successful Sonar artifact [24058415746](/tmp/dosh-sonar-artifact/run-24058415746/sonar-summary.md) is green and followed a prior failed run where `new_coverage` had slipped to `79.5`, which means future sessions should treat coverage margin, not just threshold crossing, as the practical quality-gate concern
- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx) no longer appears as a file-level new-code duplication hotspot in the latest verified artifact after the shared transaction-workflow and action-rail refactor, but it still remains the largest concentration of residual medium-severity maintainability cleanup
- dedicated frontend regression suites now exist for [AmountCell.jsx](/home/ubuntu/dosh/frontend/src/components/AmountCell.jsx), [Dashboard.jsx](/home/ubuntu/dosh/frontend/src/pages/Dashboard.jsx), [PersonalisationTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/PersonalisationTab.jsx), and newer coverage-follow-through around [ExpenseItemsTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/ExpenseItemsTab.test.jsx), [BudgetPeriodsPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetPeriodsPage.test.jsx), and [BudgetDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetDetailPage.test.jsx) because those touched areas were highlighted as thin new-code coverage paths
- the latest local Sonar cleanup pass re-pulled successful artifact [24059573777](/tmp/dosh-sonar-artifact/run-24059573777/sonar-summary.json), confirmed the remaining issue list directly from [sonar-issues-full.json](/tmp/dosh-sonar-artifact/run-24059573777/sonar-issues-full.json), and targeted the small residual medium-issue cluster in [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx), [BalanceTypesTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/BalanceTypesTab.jsx), [ExpenseItemsTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/ExpenseItemsTab.jsx), and [budget_health.py](/home/ubuntu/dosh/backend/app/budget_health.py); a fresh workflow run is still required to confirm those resolutions remotely
- `PeriodTransaction` is now the sole live transaction store; older expense and investment transaction tables have been removed from the active schema
- the deployed database has already been manually aligned to the current post-session schema expectations, including budget-adjustment and transaction line-state fields
- the deployed database has since required another explicit live patch for setup-revision history support, including `periodtransactions.revisionnum` and the `setuprevisionevents` table, which reinforces that proper migrations remain an active engineering need
- the backend ledger helper baseline now includes a shared `PeriodTransactionContext` dataclass in [transaction_ledger.py](/home/ubuntu/dosh/backend/app/transaction_ledger.py), and future refactors should avoid assuming newer stdlib dataclass features such as `slots=True` are safe on the CI runner without first confirming the workflow Python baseline

## Core Domain Rules

These rules should be treated as current product invariants unless deliberately revisited.

- exactly one `ACTIVE` cycle should exist per budget
- cycle chains should remain continuous without overlaps or silent retained gaps
- lifecycle state is explicit persisted data: `PLANNED`, `ACTIVE`, `CLOSED`
- `islocked` is a separate manual structure-protection control, not a lifecycle substitute
- `CLOSED` cycles are historical and read-only through normal workflow paths
- close-out is the event that freezes the cycle, snapshots historical data, and activates the next cycle
- close-out history must be preserved as point-in-time snapshot data rather than recomputed from later settings
- `Carried Forward` is a reserved system-managed income line on the next cycle only
- carry-forward recalculation and next-cycle opening rebasing must stay synchronized
- guided delete continuity matters more than a simple one-click delete path
- generation readiness is now determined through centralized setup assessment rather than scattered page-level assumptions
- expense-driven setups require one active primary account before generation can proceed safely
- deleting a non-trailing planned or active cycle may require `Delete this and all upcoming cycles`
- balance movement is intended to be transaction-derived rather than freely edited
- `ACTIVE` plus `islocked=true` protects structural edits but should still allow actual-entry and transaction-recording workflows
- expense and investment workflows should remain aligned, including `Current`, `Paid`, and `Revised` behavior
- paid lines are treated as finalized unless intentionally revised through the supported workflow, which now allows direct `Paid` to `Revised` reopening without a required revision-reason modal
- setup records already used by generated cycles or downstream activity should be protected from destructive edits
- the active primary transaction account is a hard setup requirement for expense-driven workflows and setup should not allow edits or deletes that leave the budget without one
- income generation now uses the stored income-source amount directly; the retired `isfixed` concept should not be reintroduced casually
- carry-forward should only be created from close-out of the prior cycle, not from simple future-cycle generation
- budget adjustments for income, expense, and investment lines now live in `PeriodTransaction` as `BUDGETADJ` history and must stay excluded from actual and balance calculations
- the detailed workflow and history rules for this area are captured in [BUDGET_ADJUSTMENT_REVISION_HISTORY_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_ADJUSTMENT_REVISION_HISTORY_PLAN.md)

## Implemented User-Facing Areas

The repository already supports:

- budgets list, create, edit, delete
- dev-only demo budget creation from the create-budget modal when Compose `DEV_MODE` is enabled
- guided budget setup across budget info, accounts, income, expenses, investments, personalisation, and settings
- setup-assessment summary state on the budget setup page, including blocking issues, warnings, and section-level readiness or protection badges
- budget cycle generation, listing, detail, lifecycle display, delete prevalidation, and close-out flow
- income, expense, account, and investment activity within a cycle
- modal-driven budget adjustment for income, expense, and investment lines, with required notes and `current` or `future unlocked` scope
- transaction-backed income, expense, and investment updates
- inline arithmetic amount entry across period-detail transaction, budget-adjustment, add-income, and add-expense modals, with expression previews for valid calculations and muted in-progress summaries for incomplete arithmetic input
- account balance viewing with transaction-based movement explanation
- current budget summary cards, current balance summary, and current-period health check
- setup-level history review for income, expense, and investment items using the shared transaction history model
- setup-level history review for income, expense, and investment items now includes both direct setup-revision events and setup-affecting budget-adjustment revisions, while also restoring a current setup summary in the modal
- a compact budget-overview calendar card with month navigation, a full-calendar modal, clickable day details, and bounded 3-month lookahead into active and upcoming cycles
- historical close-out snapshot review for closed cycles
- seeded demo-budget creation with historical close-outs, a current cycle, upcoming cycles, and health-relevant activity
- budget-level primary-account display naming with `Transaction`, `Everyday`, and `Checking` as user-facing options while the stored account type remains `Transaction`
- setup-page collapsible `Personalisation` and `Settings` sections with session-persisted expand or collapse state
- budget-cycle grouping using `Current`, `Upcoming`, and `Historical`, with the budget cycles page now remembering both upcoming and historical section collapse state for the browser session
- period-detail summary cards that now include both `Projected Savings` and `Remaining Expenses`
- period-detail footer totals for investments and balances, while keeping balance movement read-only and intentionally not totaled
- period-detail budget edit affordances for income, expense, and investment rows now live in the budget column as icon actions beside the budget amount, while transaction and line-item actions remain grouped separately
- period-detail income action controls now use a fixed four-slot layout so rows with and without a delete affordance keep the budget, actual, variance, and action columns visually aligned
- a sidebar current-budget workspace that stays separate from the expanded budget list, uses explicit `View all ...` cycle links when more cycles exist, and avoids duplicating setup entry on the budget cycles page
- the `No budget cycles yet` state on the budget cycles page now offers direct budget deletion for abandoned or exploratory budgets
- add-income-from-period flow that can either reuse an existing setup item or create a brand-new income item inline
- shared components, setup tabs, and high-traffic budget pages now have explicit React props validation as part of the frontend quality baseline
- the browser entry HTML now includes a live Dosh favicon and touch icon sourced from the shared public brand asset
- the create-budget modal now includes a compact guidance card plus expandable `More about Budgets and Budget Cycles` help content instead of a permanently expanded explainer block
- budget creation now supports custom fixed-length cycles using `Every N Days`, with the create-budget form exposing that as a custom day-cycle option
- budget setup now supports renaming an income type through the setup edit flow when that item is not already protected by downstream use
- budget setup now uses `Income Source` wording in the touched setup flows, and new income sources default `Auto-include` to on
- period-detail expense and investment `View transactions` actions now open read-only details modals, while add-transaction actions remain explicit
- period-detail remaining and budget-surplus summaries now roll up from the same positive-remaining line logic used by the row-level expense and investment calculations

Current frontend wording trends toward `Budget Cycle` for user clarity while backend naming still uses `period` for stability.

Current budget-summary calendar behavior to preserve unless deliberately redesigned:

- budgeted income is represented on the cycle start date, which is currently treated as the practical income-receipt anchor for the cycle
- the overview card stays compact and uses indicator-level density rather than large event blocks
- the full calendar modal is the richer review surface, while the inline card stays summary-oriented
- calendar expansion is intentionally bounded to the current month plus the next 2 months to avoid unbounded event generation
- cycle-start timing is represented as its own calendar event and visual marker so users can distinguish the start of a new budget cycle from ordinary income or expense timing

## Active Product Streams

These are the clearest live development streams from the docs.

1. Reporting and analysis
2. Reconciliation
3. Period close-out hardening
4. Migration framework introduction from the new post-cutover schema baseline
5. Budget health Phase 2 preparation
6. Localisation and regional fit
7. Cash management workflow definition
8. Export and backup readiness

If no other priority has been set, reporting and reconciliation are the most natural next feature directions.

## Near-Term Engineering Priorities

The most useful enabling work for future sessions is:

1. keep a test-with-change discipline for every workflow change
2. expand coverage around close-out, deletion continuity, ledger integrity, income transaction behavior, reconciliation, and setup consequences
3. replace the current explicit cutover-style schema baseline with real versioned migrations
4. tighten deployment and build reliability
5. improve API and domain wording consistency while preserving backend stability
6. keep closed-cycle correction design aligned with reconciliation rather than reopening normal edit paths
7. harden deployment by addressing Node engine drift and startup deprecation warnings
8. continue improving summary and calendar usability without letting the budget overview become a dashboard clone
9. reduce the main frontend bundle by introducing route-level lazy loading for major pages in [App.jsx](/home/ubuntu/dosh/frontend/src/App.jsx)
10. continue SonarQube-driven cleanup by tackling the remaining frontend coverage and maintainability clusters after the confirmed [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx) duplication reduction, especially nested ternaries, form-label associations, and the still-undercovered new-code paths in the latest Sonar artifact
11. rerun SonarQube after the latest local medium-issue cleanup pass to confirm the remaining `MAJOR` clusters have actually cleared in CI, with special attention on [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx), [BudgetsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetsPage.jsx), [BudgetPeriodsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetPeriodsPage.jsx), and the small shared-component stragglers

## Testing Posture

Dosh now has a meaningful multi-layer regression baseline:

- backend `pytest`
- frontend Jest and React Testing Library on the Vite-based frontend, including a dedicated layout-navigation regression baseline for current sidebar behavior
- dedicated frontend regression suites for [AmountCell.jsx](/home/ubuntu/dosh/frontend/src/components/AmountCell.jsx), [Dashboard.jsx](/home/ubuntu/dosh/frontend/src/pages/Dashboard.jsx), [PersonalisationTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/PersonalisationTab.jsx), [AmountExpressionInput.jsx](/home/ubuntu/dosh/frontend/src/components/AmountExpressionInput.jsx), and [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)
- direct backend router-guard regression coverage for [periods.py](/home/ubuntu/dosh/backend/app/routers/periods.py) now also exists in [test_period_router_guards.py](/home/ubuntu/dosh/backend/tests/test_period_router_guards.py) for carried-forward removal blocking, recorded-activity delete guards, and invalid paid or revised status transitions
- Playwright smoke coverage for create-budget, setup gating, first-cycle generation, first expense activity, close-out snapshot visibility, and next-cycle activation

Testing emphasis should remain risk-based.

Highest-risk areas:

- lifecycle transitions
- close-out execution and historical integrity
- carry-forward and opening rebasing
- delete continuity
- transaction-backed balances and ledger trust
- income transaction history and actual sync behavior
- budget-adjustment history, revision-state capture, and their exclusion from balance and actual calculations
- setup-revision history, revision-number rebasing, and the linkage between setup-affecting `BUDGETADJ` entries and revision numbering
- expense and investment paid or revised behavior
- health scoring and personalised thresholds

Scenario coverage should continue expanding beyond the original personal setup assumption.

Named scenario set currently used in strategy:

- `Baseline Personal`
- `Single Account`
- `Multi Transaction`
- `Mixed Accounts`

## Guardrails For New Development

When making changes, preserve these working assumptions from the docs:

- do not treat migration-era ledger backfill as normal recurring product behavior
- do not weaken ledger trust by introducing manual balance-edit shortcuts
- do not let future health personalisation rewrite historical closed-cycle meaning
- do not overload the UI with scoring language users cannot reasonably trust
- do not assume there is always one transaction account plus one savings account
- do not let localisation work remain implicit through hard-coded `en-AU` formatting forever
- do not treat startup schema patching as a finished migration strategy
- do not reintroduce direct inline actual-edit shortcuts that bypass the ledger-backed transaction model for income
- do not weaken setup protection by reintroducing page-local readiness assumptions when centralized setup assessment already exists
- do not treat backend test isolation as optional now that mixed-area sessions depend on it
- prefer regional display-label preferences over renaming internal domain models when terminology variation is mostly user-facing
- do not let demo-budget import become destructive; it should remain additive-only unless a separately named reset workflow is intentionally designed
- do not duplicate setup entry points on the budget cycles sidebar when the page already provides the relevant setup action
- do not treat current sidebar navigation behavior as unowned presentation detail; update the layout regression baseline deliberately when navigation rules change

## Practical Starting Order For Future Sessions

Before starting a new feature or refactor:

1. read this file
2. check [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md) for active stream priority
3. check [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md) for product decisions that should not be accidentally undone
4. check [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) and [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/docs/tests/TEST_EXPANSION_PLAN.md) for the expected coverage boundary
5. confirm whether the work touches lifecycle, close-out, carry-forward, ledger, or health rules before changing behavior

## CI Operational Notes

The repository now has a workflow that exports sanitized SonarQube analysis artifacts so future sessions can inspect analysis output without needing direct access to the Sonar token.

These Sonar outputs are not committed files in the repository checkout. They are GitHub Actions run artifacts that must be downloaded from a completed workflow run before they can be inspected locally in a session.

- workflow name: `SonarQube`
- workflow file: [.github/workflows/sonarqube.yml](/home/ubuntu/dosh/.github/workflows/sonarqube.yml)
- helper script: [fetch_latest_sonar_artifact.sh](/home/ubuntu/dosh/scripts/fetch_latest_sonar_artifact.sh)
- artifact name pattern: `sonar-summary-<github-run-id>`
- exported files inside the artifact: `sonar-summary.md`, `sonar-summary.json`, `sonar-issues-summary.json`, `sonar-issues-full.json`, and `sonar-component-metrics.json`
- the artifact is now uploaded even when the Sonar scan step fails because the quality gate returns `ERROR`
- the export now includes both issue-driven hotspots and measure-driven failed-gate context such as `failingQualityGateConditions` and file-level new-code duplication or coverage hotspots
- the latest verified successful Sonar artifact reflects the recovered coverage gate and leaves residual maintainability cleanup as the main Sonar follow-through work, but future sessions should still watch for coverage-margin drift because the previous failed run only missed the threshold by `0.5`

Typical retrieval flow from a future session after pulling the latest repository docs:

1. if the target workflow run completed successfully, run [fetch_latest_sonar_artifact.sh](/home/ubuntu/dosh/scripts/fetch_latest_sonar_artifact.sh) from the repository root, optionally passing a branch name such as `./scripts/fetch_latest_sonar_artifact.sh main`
2. if the target workflow run failed its quality gate, use `gh run list --workflow sonarqube.yml --limit 10` to identify the run and then `gh run download <run-id> -D /tmp/dosh-sonar-artifact/run-<run-id>`
3. read the printed or downloaded artifact directory path
4. inspect `<artifact-directory>/sonar-summary.md` for a readable summary, including failed quality gate conditions
5. inspect `<artifact-directory>/sonar-issues-summary.json` for grouped issue hotspots and high-leverage fix candidates
6. inspect `<artifact-directory>/sonar-component-metrics.json` for file-level duplication or coverage hotspots behind measure-driven gate failures
7. inspect `<artifact-directory>/sonar-issues-full.json` for the complete sanitized issue list
8. use `<artifact-directory>/sonar-summary.json` when a compact machine-readable summary is enough

Manual fallback if the helper script cannot be used:

1. list recent workflow runs with `gh run list --workflow sonarqube.yml --limit 5`
2. identify the relevant run id for the target branch or push
3. download the artifact with `gh run download <run-id> -D /tmp/dosh-sonar-artifact`

The Sonar summary artifact should be treated as an operational CI output for that workflow run, not as a permanent repository document or long-term historical source of truth.

## Recommended First Targets

If the next development task is still open-ended, the best default candidates are:

1. reporting and period-comparison summaries built from the ledger-backed model
2. reconciliation summary and discrepancy surfaces by account
3. inspect the latest SonarQube artifact before choosing the next cleanup target so coverage hotspots and rule-cluster hotspots are not confused with the now-cleared [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx) duplication work or with already-local-only medium cleanup that still needs CI confirmation
4. close-out and delete continuity hardening with deeper automated coverage
5. migration framework introduction from the new post-cutover schema baseline

## Source Of Truth

This file is intentionally concise.

For detailed product meaning:

- use [README.md](/home/ubuntu/dosh/README.md) for current-state overview
- use [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md) for product decisions and implementation history
- use [SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md](/home/ubuntu/dosh/docs/plans/SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md) for the current setup-validity and downstream-protection model
- use [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md) for lifecycle, carry-forward, delete, and close-out rules
- use [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/plans/BUDGET_HEALTH_ADDENDUM.md) for health direction
- use [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md) for roadmap and engineering priorities
- use [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) and [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/docs/tests/TEST_EXPANSION_PLAN.md) for testing expectations
- use [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md) for recent verification outcomes
