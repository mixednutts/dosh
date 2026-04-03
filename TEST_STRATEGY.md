# Dosh Testing Strategy

This document captures the intended automated testing strategy for Dosh as the project moves from feature growth into workflow hardening.

Its purpose is to give future sessions a stable reference for:

- what kinds of tests Dosh should have
- which business rules are most important to protect
- how to stage test coverage pragmatically
- where current risk is highest
- how test work should relate to the existing roadmap and product decisions

Read this alongside:

- [README.md](/home/ubuntu/dosh/README.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/DEVELOPMENT_ACTIVITIES.md)
- [CHANGES.md](/home/ubuntu/dosh/CHANGES.md)
- [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/BUDGET_CYCLE_LIFECYCLE_PLAN.md)
- [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/TEST_EXPANSION_PLAN.md)

## Current Situation

The repository now has real backend, frontend, and end-to-end test harnesses in place.

Observed current state:

- backend now includes a `pytest` harness under [backend/tests](/home/ubuntu/dosh/backend/tests)
- backend test dependencies are listed in [backend/requirements-dev.txt](/home/ubuntu/dosh/backend/requirements-dev.txt)
- backend test configuration is defined in [backend/pytest.ini](/home/ubuntu/dosh/backend/pytest.ini)
- frontend has Create React App test tooling available through Jest, and now includes initial user-facing workflow coverage
- frontend also now has a Playwright end-to-end harness under [frontend/e2e](/home/ubuntu/dosh/frontend/e2e)
- the project now has a credible regression foundation for controlled enhancement work
- coverage is still selective rather than exhaustive, so new behavior should continue to be added together with tests

This matters because Dosh is no longer mostly CRUD. It now contains workflow rules where subtle regressions would reduce trust:

- budget-cycle lifecycle state transitions
- close-out and historical snapshots
- carry-forward and opening rebasing
- guided delete continuity rules
- transaction-backed totals and balances
- expense and investment status workflows
- budget health scoring and personalised thresholds

Important scope note:

- migration-era ledger backfill was a one-off alignment activity for older data, not a normal recurring workflow feature
- ongoing test emphasis should stay on live transaction behavior, balance movement, continuity, and historical integrity rather than repeatedly treating one-time migration backfill as product behavior

## User Scenarios

Dosh should no longer be treated as if there is only one meaningful account shape.

The original design center was a personal use case with:

- 1 transaction account
- 1 savings account

That remains a valid baseline scenario, but future work should explicitly account for other user shapes where the app should still behave clearly and safely.

This should become a named scenario concept for both product thinking and test design.

Initial scenario set to expand over time:

- `Baseline Personal`: 1 transaction account, 1 savings account
- `Single Account`: 1 transaction account, no savings account
- `Multi Transaction`: multiple transaction accounts, no dedicated savings account required
- `Mixed Accounts`: multiple transaction accounts plus one or more savings accounts

Why this matters:

- setup assumptions affect downstream period generation and transaction behavior
- linked-account and primary-account logic can behave differently across account shapes
- savings-transfer expectations are different when no savings account exists
- balance movement explanations become more important when multiple transaction accounts exist
- tests should protect against silently assuming reference data that is not present for a given user shape

Scenario guidance for future tests:

- every major workflow should continue to pass for `Baseline Personal`
- setup and transaction tests should gradually be expanded to cover `Single Account` and `Multi Transaction`
- where a feature depends on optional setup data, tests should verify both behavior when the reference data exists and failure or fallback behavior when it does not
- new scenario coverage should be added intentionally rather than assuming one default account model forever

## Testing Principles

- Protect financial workflow trust before broad UI polish.
- Prefer testing behavior and invariants over implementation details.
- Put most weight on backend tests because the backend currently owns the financial rules.
- Keep pure logic testable without requiring full app startup where possible.
- Use API integration tests for workflows that cross multiple tables and helper functions.
- Add frontend tests mainly around user-critical flows and conditional states, not cosmetic markup.
- Keep end-to-end tests small and high-value once the lower layers are in place.
- Whenever a product rule is documented in an MD file, it should usually have a corresponding test case or explicit testing note.
- Prefer documenting new test scope and remaining gaps back into this file so future sessions do not have to rediscover the current boundary.

## Recommended Test Pyramid

### 1. Backend unit tests

Use these for pure or mostly pure functions where fast, narrow coverage is valuable.

Best candidates:

- period date calculation
- period overlap detection
- expense scheduling rules
- selected budget health helper calculations
- carry-forward amount calculation
- small invariant helpers around lifecycle grouping and status interpretation

Primary targets in the current codebase:

- [period_logic.py](/home/ubuntu/dosh/backend/app/period_logic.py)
- [budget_health.py](/home/ubuntu/dosh/backend/app/budget_health.py)
- [cycle_management.py](/home/ubuntu/dosh/backend/app/cycle_management.py)

### 2. Backend integration and API tests

This should be the main investment.

Use these to validate the real workflow through database-backed state changes and API responses.

Best candidates:

- period generation
- lifecycle assignment
- close-out preview
- close-out execution
- carry-forward recalculation
- deletion eligibility and continuity options
- transaction-backed balance movement
- expense and investment paid or revised behavior
- historical snapshot readback

Primary targets in the current codebase:

- [main.py](/home/ubuntu/dosh/backend/app/main.py)
- [routers/periods.py](/home/ubuntu/dosh/backend/app/routers/periods.py)
- [routers/expense_entries.py](/home/ubuntu/dosh/backend/app/routers/expense_entries.py)
- [routers/investment_transactions.py](/home/ubuntu/dosh/backend/app/routers/investment_transactions.py)
- [transaction_ledger.py](/home/ubuntu/dosh/backend/app/transaction_ledger.py)
- [models.py](/home/ubuntu/dosh/backend/app/models.py)

### 3. Frontend component and workflow tests

Keep these focused on rendering and interaction states that matter to user decisions.

Best candidates:

- period detail read-only behavior for closed cycles
- close-out modal preview and submit flow
- delete option presentation for single delete versus future-chain delete
- paid or revised controls for expenses and investments
- key summaries that distinguish budget totals from actual totals

Primary targets in the current codebase:

- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)
- [BudgetPeriodsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetPeriodsPage.jsx)
- [BudgetsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetsPage.jsx)
- [client.js](/home/ubuntu/dosh/frontend/src/api/client.js)

### 4. End-to-end smoke tests

Add these only after the backend and frontend harnesses exist.

Keep them intentionally small:

- create budget and setup minimum required data
- generate a cycle
- enter activity
- close out the cycle
- confirm next cycle activation and snapshot visibility

Initial end-to-end scaffold now present:

- Playwright config in [playwright.config.js](/home/ubuntu/dosh/frontend/playwright.config.js)
- first smoke spec in [budget-smoke.spec.js](/home/ubuntu/dosh/frontend/e2e/budget-smoke.spec.js)
- frontend `test:e2e` script in [package.json](/home/ubuntu/dosh/frontend/package.json)

Current first smoke scope:

- open the app
- create a budget
- land on setup
- confirm incomplete setup guidance
- navigate to the budget cycles page
- confirm generation remains blocked until setup is complete
- complete minimum setup with one account, one income type, and one expense item
- generate the first budget cycle
- confirm the first cycle appears as the active current cycle
- open the generated cycle detail page
- record an expense transaction
- confirm both expense actuals and linked account movement update
- close out the active cycle with automatic next-cycle creation
- confirm the closed-cycle snapshot is shown
- confirm the next cycle becomes the active cycle

## Current Harness Status

Backend scaffold now present:

- shared pytest fixtures in [backend/tests/conftest.py](/home/ubuntu/dosh/backend/tests/conftest.py)
- reusable data helpers in [backend/tests/factories.py](/home/ubuntu/dosh/backend/tests/factories.py)
- initial smoke and pure-logic tests in [backend/tests/test_app_smoke.py](/home/ubuntu/dosh/backend/tests/test_app_smoke.py) and [backend/tests/test_period_logic.py](/home/ubuntu/dosh/backend/tests/test_period_logic.py)
- first Priority 1 workflow coverage in [backend/tests/test_closeout_flow.py](/home/ubuntu/dosh/backend/tests/test_closeout_flow.py), [backend/tests/test_delete_continuity.py](/home/ubuntu/dosh/backend/tests/test_delete_continuity.py), and [backend/tests/test_status_workflows.py](/home/ubuntu/dosh/backend/tests/test_status_workflows.py)
- additional Priority 1 edge coverage in [backend/tests/test_closed_cycle_guards.py](/home/ubuntu/dosh/backend/tests/test_closed_cycle_guards.py) and [backend/tests/test_lifecycle_and_health.py](/home/ubuntu/dosh/backend/tests/test_lifecycle_and_health.py)
- initial reconciliation and health-matrix coverage in [backend/tests/test_transactions_and_balances.py](/home/ubuntu/dosh/backend/tests/test_transactions_and_balances.py) and [backend/tests/test_budget_health_matrix.py](/home/ubuntu/dosh/backend/tests/test_budget_health_matrix.py)
- additional live-ledger and advanced health coverage in [backend/tests/test_live_ledger_behavior.py](/home/ubuntu/dosh/backend/tests/test_live_ledger_behavior.py) and [backend/tests/test_budget_health_advanced.py](/home/ubuntu/dosh/backend/tests/test_budget_health_advanced.py)
- initial setup and scenario coverage in [backend/tests/test_budget_setup_workflows.py](/home/ubuntu/dosh/backend/tests/test_budget_setup_workflows.py)
- initial frontend workflow coverage in [BudgetPeriodsPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetPeriodsPage.test.jsx), [PeriodDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/PeriodDetailPage.test.jsx), and [BudgetDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetDetailPage.test.jsx), with shared render utilities in [testUtils.jsx](/home/ubuntu/dosh/frontend/src/testUtils.jsx)
  This now includes delete continuity messaging, non-deletable delete-state gating, closed-cycle read-only rendering, close-out modal confirmation gating, expense and investment paid-confirmation flows, expense and investment revise-comment workflows, locked-cycle guardrail messaging, settings guidance for primary investment allocation, manual cycle lock setting changes, account primary-selection setup plus edit, deactivation, and delete behavior, income setup auto-include behavior plus linked-account removal through edit, investment setup with and without linked accounts, investment primary/edit/deactivation/delete behavior, backend coverage for primary-investment reassignment affecting future auto-surplus generation, setup-shape visibility for richer account configurations, setup states where accounts exist but no primary account is selected, setup-to-generation readiness gating, successful generation handoff with suggested next start date, generate failure feedback, and setup guidance when account foundations are missing.
- initial Playwright end-to-end scaffold in [playwright.config.js](/home/ubuntu/dosh/frontend/playwright.config.js) and [budget-smoke.spec.js](/home/ubuntu/dosh/frontend/e2e/budget-smoke.spec.js)
  The current smoke paths now run successfully in Chromium locally, covering blocked setup handoff, minimum-setup first-cycle generation, first expense-transaction activity with linked account movement, and close-out into the next active cycle.

Current backend run command:

```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

Current frontend run command:

```bash
cd frontend
CI=true npm test -- --watchAll=false --runInBand
```

Current end-to-end run command:

```bash
cd frontend
npx playwright test
```

Current backend scaffold proves:

- the app can boot under an isolated SQLite test database
- tests can drive API requests through FastAPI `TestClient`
- tests can seed reusable domain fixtures without touching the real app database
- the repository now has a stable place to add lifecycle, close-out, and continuity regression tests
- the repository now has initial regression coverage for close-out transitions, carry-forward persistence, continuity-aware deletion, regeneration, paid or revised status guards, closed-cycle write rejection, delete blockers after recorded activity, lifecycle normalization, historical health snapshot preservation, live ledger-driven balance movement, system-generated transaction rows, early health-scoring matrix behavior, and setup-driven scenario assumptions

Current limitation:

- Priority 1 coverage is now present but still partial, and should next be expanded into deeper live transaction-ledger reconciliation scenarios, broader budget health scoring combinations, and broader frontend workflow coverage across setup, delete, and paid or revised edge states
- the initial Playwright smoke layer is intentionally small and currently covers only the earliest setup, generation, first-transaction, and close-out happy paths, not richer multi-line activity, reconciliation, or broader scenario-shape permutations

## Coverage Readiness

The current coverage is suitable for continued enhancement work, with some clear limits.

What this means in practice:

- the project now has a credible regression harness around its highest-risk financial workflows
- continued feature work is reasonable, provided new or changed behavior is accompanied by test changes
- lifecycle, close-out, continuity, setup-shape assumptions, and ledger-trust behavior should still be treated as especially sensitive

What this does not mean:

- coverage is not yet exhaustive
- the current end-to-end layer is still intentionally narrow
- valid setup changes can still have downstream consequences that deserve more explicit consequence-oriented tests

## Harness Recommendation

### Backend

Recommended stack:

- `pytest`
- FastAPI `TestClient`
- SQLite test database per test or per module
- dependency override for `get_db`
- reusable fixtures for seeded budgets and generated periods

Recommended backend structure:

```text
backend/
└── tests/
    ├── conftest.py
    ├── factories.py
    ├── test_period_logic.py
    ├── test_lifecycle_api.py
    ├── test_closeout_flow.py
    ├── test_delete_continuity.py
    ├── test_transactions_and_balances.py
    └── test_budget_health.py
```

Recommended fixture layers:

- empty database
- seeded reference data
- minimal valid budget
- budget with accounts, expenses, income, and investments
- generated one-period and multi-period chains

### Frontend

Recommended stack:

- CRA Jest runner
- React Testing Library
- mocked API module at [client.js](/home/ubuntu/dosh/frontend/src/api/client.js)

Current frontend test dependency:

- [frontend/package.json](/home/ubuntu/dosh/frontend/package.json) now includes `@testing-library/react`

Recommended frontend structure:

```text
frontend/src/
└── __tests__/
    ├── PeriodDetailPage.test.jsx
    ├── BudgetPeriodsPage.test.jsx
    └── BudgetsPage.test.jsx
```

Recommended test approach:

- mock network calls at the API client layer
- prefer testing visible user behavior over internal state
- keep formatting assertions lightweight unless a formatting bug is the actual risk

## Coverage Priorities

### Priority 1: Workflow-critical backend coverage

These tests should come first because they protect the financial rules most likely to break trust.

- period generation prerequisites and overlap handling
- lifecycle state assignment and one-active-cycle behavior
- close-out preview totals and health payload shape
- close-out execution transitions and snapshot persistence
- carry-forward creation and update in the next cycle
- continuity recalculation after delete and regenerate
- expense paid and revised restrictions
- investment paid and revised restrictions

### Priority 2: Historical integrity and ledger confidence

- closed cycles reject ordinary workflow edits
- changing health personalisation later does not rewrite stored close-out history
- transaction-backed account movement matches ledger-derived explanations
- expense entry and investment transaction changes sync actuals and balances correctly
- multi-account scenarios do not break balance movement and transaction-account expectations

### Priority 3: Frontend user-safety flows

- destructive options are labeled correctly
- closed-cycle views become read-only in the right places
- close-out surfaces communicate the next-cycle consequences correctly
- period summaries show the expected lifecycle state and action availability

### Priority 4: Broader health and reporting confidence

- budget health score stability around personalised thresholds
- deficit logic using percentage-plus-dollar preferences
- current-period weighting behavior
- summary and reporting calculations across completed periods
- scenario-specific behavior remains coherent when optional setup data such as savings accounts or investment lines is absent

## Risk-Based Test Matrix

### Highest risk

- close-out changes multiple tables and states in one action
- carry-forward and opening rebasing can drift if recalculation order breaks
- deletion and regeneration can create continuity gaps
- lifecycle state bugs can cause more than one active cycle or accidental closure

### Medium risk

- paid or revised state handling across expenses and investments
- health snapshot persistence versus live recomputation
- account movement explanation logic
- hidden assumptions about account shape or missing reference data

### Lower risk

- static presentation and formatting details
- simple CRUD paths already constrained by straightforward validation

## Initial Test Case Inventory

### Period generation and lifecycle

- generating a period fails when a budget has no income types
- generating a period fails when a budget has no active expense items
- generating a period succeeds with valid minimum setup
- generated periods populate incomes, expenses, balances, and investments
- generated periods reject overlaps with existing periods
- lifecycle assignment results in at most one `ACTIVE` cycle per budget
- past unclosed periods do not remain incorrectly `PLANNED`
- future periods remain `PLANNED`

### Close-out

- close-out preview returns totals, health, carry-forward, and next-cycle status
- close-out can create the next cycle when missing and allowed
- close-out fails when the next cycle is missing and auto-create is not allowed
- close-out marks current cycle `CLOSED`
- close-out marks next cycle `ACTIVE`
- close-out locks the closed cycle
- close-out finalises open expense lines to `Paid`
- close-out finalises open investment lines to `Paid`
- close-out stores comments and goals in the snapshot table
- close-out stores health and totals as point-in-time snapshot JSON

### Carry-forward and chain recalculation

- closing a cycle creates `Carried Forward` in the next cycle
- `Carried Forward` updates `budgetamount` only
- `Carried Forward` leaves `actualamount` user-driven
- first cycle in a chain does not keep a carried-forward line
- deleting and regenerating the next cycle recomputes `Carried Forward`
- rebasing openings after predecessor changes stays aligned with carry-forward updates

### Delete continuity

- closed cycles cannot be deleted
- active cycles with actuals cannot be deleted
- active cycles with ledger transactions cannot be deleted
- active cycles without actuals or transactions can be deleted when trailing
- deleting a middle cycle requires deleting it and all upcoming cycles
- deleting a future chain preserves a valid remaining lifecycle sequence

### Expense workflow

- paid expenses cannot be edited directly
- paid expenses cannot receive new transactions
- revising a paid expense requires a comment
- revised expenses become editable again
- paid expenses contribute actuals to budget-side totals
- current and revised expenses contribute budget values to budget-side totals

### Investment workflow

- paid investments cannot be edited directly
- paid investments cannot receive new transactions
- revising a paid investment requires a comment
- revised investments become editable again
- paid investments contribute actuals to budget-side totals
- current and revised investments contribute budgeted values to budget-side totals

### Transactions and balances

- adding an expense entry updates expense actuals
- deleting an expense entry recomputes expense actuals
- investment transactions update investment actuals and closing values
- linked investment transactions affect related account movement where intended
- balance movement detail returns transactions that reconcile with movement totals
- system-generated transaction rows remain distinguishable from user-entered rows
- single-account setups behave safely without savings-account assumptions
- multi-transaction-account setups keep movement explanations tied to the right account

### Setup and scenario coverage

- fixed income setup enforces autoinclude behavior
- primary account selection keeps only one primary transaction account
- primary investment selection keeps only one primary investment line
- generation works when there is no investment line, unless a later workflow explicitly depends on one
- setup-dependent actions fail clearly when assumed reference data is missing
- savings-transfer behavior fails clearly when no savings account exists
- setup scenarios should gradually cover `Baseline Personal`, `Single Account`, and `Multi Transaction`

Current initial backend coverage now includes:

- fixed-income autoinclude enforcement
- unique primary balance and investment selection
- generation without investment lines even when surplus auto-allocation is enabled
- `Single Account` savings-transfer rejection when no savings account exists
- `Multi Transaction` primary-account use for expense movement
- `Mixed Accounts` movement routing across transaction, savings, and linked investment accounts
- clear downstream failure when period investment reference data is missing

### Budget health

- current-period totals treat paid expenses and investments as finalised at actuals
- historical discipline uses historical outflow metrics correctly
- personalised threshold validation rejects invalid values
- percentage and dollar deficit settings interact as intended
- close-out health snapshots remain unchanged after later budget personalisation edits

### Frontend workflow

- closed cycles hide or disable ordinary edit actions
- close-out modal shows carry-forward and warning language
- delete modal or action area shows future-chain delete when continuity requires it
- period detail shows paid and revised controls consistently for expenses and investments
- summary surfaces display lifecycle state clearly

## Suggested Implementation Order

1. Add backend test tooling and fixtures.
2. Cover pure period logic functions.
3. Add lifecycle and close-out API tests.
4. Add carry-forward and delete continuity tests.
5. Add transaction and balance integration tests.
6. Add budget health tests around snapshot integrity and thresholds.
7. Add frontend workflow tests for period detail and close-out.
8. Add one or two end-to-end smoke tests when the lower layers are stable.

## Definition Of Good Coverage For This Stage

Coverage is good enough for the current phase when:

- the lifecycle and close-out workflows are strongly protected by integration tests
- continuity recalculation is covered through delete, close, and regenerate scenarios
- historical snapshot integrity has explicit regression coverage
- the expense and investment status models are tested in parallel
- the frontend has enough tests to protect read-only and destructive workflow behavior

Good coverage does not yet require exhaustive frontend snapshot tests or broad end-to-end suites.

## Maintenance Notes

- Update this document when new workflow rules are added or when testing priorities change.
- When a new rule is added to [CHANGES.md](/home/ubuntu/dosh/CHANGES.md) or [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/BUDGET_CYCLE_LIFECYCLE_PLAN.md), add or revise the corresponding test case entry here.
- If the migration strategy changes, update the backend harness guidance to reflect how test databases should be prepared.
- If the frontend moves away from Create React App, revisit the recommended frontend test tooling section.
- If new user-account shapes become important, add them to the named scenario list here and expand setup and workflow tests accordingly.
