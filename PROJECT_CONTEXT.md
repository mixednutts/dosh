# Dosh Project Context

This document initializes a practical working context for new Dosh development.

It is a synthesis of the current Markdown sources in this repository:

- [README.md](/home/ubuntu/dosh/README.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/DEVELOPMENT_ACTIVITIES.md)
- [CHANGES.md](/home/ubuntu/dosh/CHANGES.md)
- [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/BUDGET_CYCLE_LIFECYCLE_PLAN.md)
- [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/BUDGET_HEALTH_ADDENDUM.md)
- [TEST_STRATEGY.md](/home/ubuntu/dosh/TEST_STRATEGY.md)
- [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/TEST_EXPANSION_PLAN.md)

Use this as the quick-start development handoff. Use the source documents above when deeper detail is needed.

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
- Create React App
- React Router
- React Query
- Tailwind CSS
- current route flow defined in [App.jsx](/home/ubuntu/dosh/frontend/src/App.jsx)

Operational note:

- the app still uses transitional startup schema patching in [main.py](/home/ubuntu/dosh/backend/app/main.py) via targeted `ALTER TABLE` checks
- proper versioned migrations remain a near-term engineering need
- backend tests now run against an isolated SQLite database per test case through [conftest.py](/home/ubuntu/dosh/backend/tests/conftest.py)
- Docker Compose remains the active deployment path, with the frontend exposed on port `3080`

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
- expense and investment workflows should remain aligned, including `Current`, `Paid`, and `Revised` behavior
- paid lines are treated as finalized unless intentionally revised through the supported workflow
- setup records already used by generated cycles or downstream activity should be protected from destructive edits

## Implemented User-Facing Areas

The repository already supports:

- budgets list, create, edit, delete
- guided budget setup across budget info, accounts, income, expenses, investments, personalisation, and settings
- setup-assessment summary state on the budget setup page, including blocking issues, warnings, and section-level readiness or protection badges
- budget cycle generation, listing, detail, lifecycle display, delete prevalidation, and close-out flow
- income, expense, account, and investment activity within a cycle
- transaction-backed expense and investment updates
- account balance viewing with transaction-based movement explanation
- current budget summary cards, current balance summary, and current-period health check
- historical close-out snapshot review for closed cycles

Current frontend wording trends toward `Budget Cycle` for user clarity while backend naming still uses `period` for stability.

## Active Product Streams

These are the clearest live development streams from the docs.

1. Reporting and analysis
2. Reconciliation
3. Period close-out hardening
4. Budget health Phase 2 preparation
5. Localisation and regional fit
6. Cash management workflow definition
7. Export and backup readiness
8. Migration strategy replacement for startup schema patching

If no other priority has been set, reporting and reconciliation are the most natural next feature directions.

## Near-Term Engineering Priorities

The most useful enabling work for future sessions is:

1. keep a test-with-change discipline for every workflow change
2. expand coverage around close-out, deletion continuity, ledger integrity, reconciliation, and setup consequences
3. replace transitional startup schema evolution with real versioned migrations
4. tighten deployment and build reliability
5. improve API and domain wording consistency while preserving backend stability
6. keep closed-cycle correction design aligned with reconciliation rather than reopening normal edit paths
7. harden deployment by addressing Node engine drift and startup deprecation warnings

## Testing Posture

Dosh now has a meaningful multi-layer regression baseline:

- backend `pytest`
- frontend Jest and React Testing Library
- Playwright smoke coverage for create-budget, setup gating, first-cycle generation, first expense activity, close-out snapshot visibility, and next-cycle activation

Testing emphasis should remain risk-based.

Highest-risk areas:

- lifecycle transitions
- close-out execution and historical integrity
- carry-forward and opening rebasing
- delete continuity
- transaction-backed balances and ledger trust
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
- do not weaken setup protection by reintroducing page-local readiness assumptions when centralized setup assessment already exists
- do not treat backend test isolation as optional now that mixed-area sessions depend on it

## Practical Starting Order For Future Sessions

Before starting a new feature or refactor:

1. read this file
2. check [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/DEVELOPMENT_ACTIVITIES.md) for active stream priority
3. check [CHANGES.md](/home/ubuntu/dosh/CHANGES.md) for product decisions that should not be accidentally undone
4. check [TEST_STRATEGY.md](/home/ubuntu/dosh/TEST_STRATEGY.md) and [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/TEST_EXPANSION_PLAN.md) for the expected coverage boundary
5. confirm whether the work touches lifecycle, close-out, carry-forward, ledger, or health rules before changing behavior

## Recommended First Targets

If the next development task is still open-ended, the best default candidates are:

1. reporting and period-comparison summaries built from the ledger-backed model
2. reconciliation summary and discrepancy surfaces by account
3. close-out and delete continuity hardening with deeper automated coverage
4. migration framework introduction to replace startup schema patching
5. deployment hardening and deprecation cleanup after the successful Compose baseline

## Source Of Truth

This file is intentionally concise.

For detailed product meaning:

- use [README.md](/home/ubuntu/dosh/README.md) for current-state overview
- use [CHANGES.md](/home/ubuntu/dosh/CHANGES.md) for product decisions and implementation history
- use [SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md](/home/ubuntu/dosh/SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md) for the current setup-validity and downstream-protection model
- use [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/BUDGET_CYCLE_LIFECYCLE_PLAN.md) for lifecycle, carry-forward, delete, and close-out rules
- use [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/BUDGET_HEALTH_ADDENDUM.md) for health direction
- use [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/DEVELOPMENT_ACTIVITIES.md) for roadmap and engineering priorities
- use [TEST_STRATEGY.md](/home/ubuntu/dosh/TEST_STRATEGY.md) and [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/TEST_EXPANSION_PLAN.md) for testing expectations
- use [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/TEST_RESULTS_SUMMARY.md) for recent verification outcomes
