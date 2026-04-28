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
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)
- [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md)
- [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/docs/tests/TEST_EXPANSION_PLAN.md)
- [SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md](/home/ubuntu/dosh/docs/plans/SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md)
- [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md)

## Current Situation

The repository now has real backend, frontend, and end-to-end test harnesses in place.

Observed current state:

- backend now includes a `pytest` harness under [backend/tests](/home/ubuntu/dosh/backend/tests)
- backend harness now uses an isolated SQLite database per test case rather than a shared file-backed test database
- backend maintenance coverage now also includes a dedicated Alembic migration harness for clean upgrades and upgrade from a pre-feature SQLite snapshot
- backend test dependencies are listed in [backend/requirements-dev.txt](/home/ubuntu/dosh/backend/requirements-dev.txt)
- backend test configuration is defined in [backend/pytest.ini](/home/ubuntu/dosh/backend/pytest.ini)
- backend tests run in a Python virtual environment at `backend/.venv/` with pytest available at `backend/.venv/bin/pytest`
- frontend now uses a Vite build with standalone Jest plus React Testing Library, and includes user-facing workflow coverage
- frontend Jest coverage now also includes a dedicated layout-navigation baseline for current sidebar hierarchy, setup-link visibility, and cycle-shortcut affordances
- frontend Jest coverage now also includes Budgets page calendar behavior, including compact summary rendering, full-calendar interaction, bounded 3-month lookahead, and day-event modal behavior
- frontend Jest coverage now includes localisation utility, masked amount input, and operator-triggered calculator regressions across representative regional preferences
- frontend also now has a Playwright end-to-end harness under [frontend/e2e](/home/ubuntu/dosh/frontend/e2e)
- the project now has a credible regression foundation for controlled enhancement work
- coverage is still selective rather than exhaustive, so new behavior should continue to be added together with tests
- the latest recorded backend, frontend, and deployment verification outcomes live in [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md)
- frontend coverage is approaching the SonarQube 80% new_coverage threshold (currently 79.1% statements, 82.8% lines); remaining gaps are concentrated in `client.js`, `Dashboard.jsx` mobile paths, `PeriodDetailPage.jsx` conditional branches, and `BackupRestoreModal.jsx` tab states
- the latest localisation session left a critical `npm audit` advisory for `axios <1.15.0` unresolved because it was outside the scoped localisation change; future dependency maintenance should review and resolve it deliberately
- the GitHub workflow and backend container baseline now align on Python 3.12, so backend CI and deploy verification should treat that as the supported runtime

This matters because Dosh is no longer mostly CRUD. It now contains workflow rules where subtle regressions would reduce trust:

- budget-cycle lifecycle state transitions
- close-out and historical snapshots
- carry-forward and opening rebasing
- guided delete continuity rules
- transaction-backed totals and balances
- expense and investment status workflows
- budget health scoring and personalised thresholds
- budget-adjustment history, transaction line-state capture, and planning-stability interpretation that now relies on off-plan activity rather than revision-comment prompts

Important scope note:

- migration-era ledger backfill was a one-off alignment activity for older data, not a normal recurring workflow feature
- ongoing test emphasis should stay on live transaction behavior, balance movement, continuity, and historical integrity rather than repeatedly treating one-time migration backfill as product behavior
- dev-only demo-budget seeding is now a documented workflow and should be tested as additive environment-scoped setup support rather than as a replacement for ordinary user setup flows

## Testing Context Snapshot

This section is the quick-start project context for testing work.

It consolidates the testing-relevant product meaning currently spread across:

- [README.md](/home/ubuntu/dosh/README.md)
- [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md)
- [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/archive/BUDGET_HEALTH_ADDENDUM.md)
- [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/docs/tests/TEST_EXPANSION_PLAN.md)

### Product shape under test

Dosh is now a workflow-driven personal finance application rather than a collection of isolated CRUD screens.

The highest-value test context is:

- budgets have setup dependencies that determine whether downstream generation and activity are valid
- budget cycles have explicit lifecycle state: `PLANNED`, `ACTIVE`, `CLOSED`
- close-out is a first-class workflow that freezes historical state and activates the next cycle
- account balances and movement explanations are intended to be transaction-derived rather than freely edited
- savings and investment planning are part of normal cycle behavior, not optional side experiments
- budget health is an explainable indicator built from real product data, with per-budget personalisation that changes interpretation

### Core financial invariants

The most important business rules to preserve are:

- exactly one `ACTIVE` cycle should exist per budget
- cycle chains should remain continuous with no overlaps and no silent retained gaps
- `CLOSED` cycles are historical and read-only through ordinary workflow paths
- close-out must preserve point-in-time snapshot data rather than recomputing history from later settings
- carry-forward and next-cycle opening rebasing must stay synchronized
- guided delete behavior must protect continuity, especially for non-trailing cycles
- expense and investment lifecycle behavior should remain aligned
- `islocked=true` on an `ACTIVE` cycle protects structural edits, but must not block recording actuals or transactions
- paid lines should be treated as finalized unless explicitly revised through the supported workflow, which now allows direct `Paid` to `Revised` reopening without a required justification modal
- balance movement trust should come from ledger-backed transactions, not manual drift
- `BUDGETADJ` rows should remain reviewable in shared history while staying excluded from balance movement and actual calculations

### Testing-sensitive feature areas

These areas deserve extra caution whenever product work touches them:

- cycle generation and lifecycle assignment
- close-out preview, completion, and next-cycle activation
- `Carried Forward` creation, protection, and recalculation after delete or regenerate flows
- delete continuity options such as `Delete this and all upcoming cycles`
- transaction-backed expense, balance, and investment behavior
- transaction-backed income behavior, including dedicated income transaction history rather than inline actual overrides
- modal-driven budget adjustment behavior across income, expense, and investment, including setup-history readback through the shared transaction model
- period-detail modal amount-expression behavior, including raw-expression visibility, valid-expression preview, incomplete-expression in-progress summary behavior, and resolved-value submission across income, expense, investment, add-line, and budget-adjustment flows
- transaction date entry and validation, including manual text parsing, multi-format fallback, period-boundary enforcement, and native validity API behavior across income, expense, and investment modals
- localisation behavior, including budget-level locale/currency/timezone/date-format preference validation, shared `Intl` display helpers, masked amount input normalization, operator-triggered calculator mode, timezone-aware labels, and date-picker locale behavior
- setup-revision history behavior, including field-level change capture, revision-number rebasing, and the distinction between setup-affecting future budget adjustments and current-only period adjustments
- post-paid revise flows and read-only guards on closed cycles
- budget-level Auto Expense automation, including scheduler-safe eligibility rules, AUTO/MANUAL protection, period-detail manual run behavior, and migration normalization of legacy invalid AUTO rows
- transaction line-state capture and budget-health off-plan interpretation
- health scoring, evidence payloads, and historical snapshot integrity
- setup edits whose consequences show up only in later workflows
- demo-mode gating and seeded demo-budget behavior, especially additive-only import safety and health-signal credibility
- sidebar current-budget navigation behavior, especially empty-state actions, same-destination affordances, and explicit `View all ...` deep-link behavior when the compact cycle preview is incomplete
- budget-summary calendar behavior, especially cycle-start markers, bounded future lookahead, and compact-cell event affordances that must stay aligned with day-detail modal content
- setup history and period-detail table layouts where missing or conditional action affordances can shift column alignment and weaken readability

### Budget health context for tests

Budget health should be tested as guided, explainable scoring, not as absolute financial truth.

Tests should preserve these expectations:

- visible results should be backed by inspectable evidence payloads
- current-period health is a distinct live layer and also contributes to the overall score
- planning-stability interpretation should reflect real off-plan activity from current line state and transaction history rather than depending on a separate revision-comment requirement
- personalisation changes should affect future interpretation without rewriting closed-cycle history
- timestamps, date-sensitive classification, and rendered evidence should stay aligned with intended local timezone behavior

### Active engineering direction that should influence testing

Current development direction makes the following test emphasis especially useful:

- reporting and reconciliation are likely to expand next, so ledger integrity and discrepancy behavior should stay well protected
- close-out and reconciliation handoff still need hardening, so correction-after-close expectations remain a live risk area
- localisation and regional-fit formatting is now implemented, so tests should use shared formatting expectations or representative locale fixtures instead of reintroducing hard-coded regional assumptions where possible
- startup no longer applies transitional schema mutation during app boot, so tests should focus on runtime workflow behavior and treat explicit cutover or migration flows as separate maintenance concerns

## Test-by-Change Discipline

Dosh follows a **test-by-change** discipline: meaningful workflow changes should include tests that protect the new behavior.

### When to add tests

- **New features**: Any new workflow or API endpoint should have regression coverage
- **Bug fixes**: Include a test that would have caught the bug
- **Behavior changes**: Update or add tests when intentional behavior changes
- **Refactors**: Ensure existing tests pass; add tests if coverage gaps are exposed

### When tests can be deferred

- Pure UI styling changes without behavior impact
- Documentation-only changes
- Configuration changes that don't affect code paths

### Local test execution

Backend tests run in a virtual environment to ensure isolation and reproducibility.

**Setup (one-time):**
```bash
cd /home/ubuntu/dosh/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt -r requirements-dev.txt
```

**Running tests:**
```bash
# All tests
cd /home/ubuntu/dosh/backend
.venv/bin/pytest tests/ -v

# Specific test file
.venv/bin/pytest tests/test_status_workflows.py -v

# Specific test
.venv/bin/pytest tests/test_status_workflows.py::test_paid_income_requires_revision_before_more_changes -v

# With coverage report
.venv/bin/pytest tests/ --cov=app --cov-report=xml:coverage.xml
```

**Frontend tests:**
```bash
cd /home/ubuntu/dosh/frontend
npm test

# Specific test file
npm test -- PeriodDetailPage.test.jsx
```

### CI vs local testing

- **Local (venv)**: Fast iteration, targeted test runs during development
- **CI (GitHub Actions)**: Full suite with coverage, SonarQube analysis, multi-environment validation

Always run targeted local tests before pushing. The CI will run the full suite including backend pytest with coverage reporting.

### Practical rule for future sessions

If a behavior is described in the Markdown docs as a user-facing workflow rule, continuity rule, or historical-integrity constraint, it should either:

- already be covered by an automated test, or
- be called out explicitly here as a known remaining gap

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

### Current setup-shape coverage matrix

The following setup-shape combinations are currently covered by automated tests.

| Setup shape | Accounts shape | Coverage focus | Current coverage |
| --- | --- | --- | --- |
| `No Accounts` | no accounts, no income, no expenses, no investments | setup guidance and blocked first-cycle generation | frontend |
| `Single Account` | 1 primary transaction account, no savings account | valid setup rendering without false missing-account guidance | frontend |
| `Single Account` | 1 primary transaction account, no savings account | reject savings-transfer behavior that depends on a real savings account | backend |
| `Cash-Only` | 1 primary Cash account, no transaction account | valid generation and expense entry routing when primary is non-Transaction | backend + frontend |
| `Accounts Present, No Primary` | accounts exist but none selected as primary | centralized setup assessment should block generation and reject downstream expense activity until setup is repaired | frontend + backend |
| `Accounts In Use` | generated cycles or linked references already depend on the account setup | protect account structure from delete, deactivate, or unsafe structural edits while still allowing safe reassignment paths | frontend + backend |
| `Income Types In Use` | generated cycles or recorded activity already depend on the income setup | protect income setup from destructive edits or deletion once downstream cycles depend on it | frontend + backend |
| `Expense Items In Use` | generated cycles or recorded activity already depend on the expense setup | protect expense setup from deletion or deactivation while preserving supported revision-style updates | frontend + backend |
| `Investment Lines In Use` | generated cycles or recorded activity already depend on the investment setup | protect investment setup from destructive edits or deletion once downstream cycles depend on it | frontend + backend |
| `Multi Transaction` | 2 transaction accounts with 1 primary | route expense activity to the primary account by default | backend |
| `Multi Transaction With Linked Income` | 2 transaction accounts with income linked to a non-primary account | route income movement to the linked account rather than the primary account | backend |
| `Multi Transaction After Primary Reassignment` | 2 transaction accounts with primary changed after setup | route later expense activity to the newly primary account | backend |
| `Mixed Accounts` | multiple transaction accounts plus savings account | reflect richer setup summary without no-account guidance | frontend |
| `Mixed Accounts With Savings Transfer` | transaction account plus savings account | support savings-transfer activity and route movement correctly | backend |
| `Mixed Accounts With Linked Investment` | transaction accounts plus savings account plus linked investment account | route income, investment, and savings-transfer movement to the correct accounts | backend |
| `No Investment Lines With Auto-Surplus Enabled` | valid generation setup with no investments present | still allow cycle generation without failing surplus-allocation logic | backend |
| `Multiple Investment Lines` | more than one investment with exactly one primary | keep primary selection unique and allocate auto-surplus only to the primary line | backend |
| `Primary Investment Reassigned` | multiple investments with primary line changed before generation | route future auto-surplus allocation to the new primary investment | backend |
| `Missing Period Investment Reference` | no generated period investment line for attempted downstream activity | fail clearly when dependent investment activity is attempted | backend |
| `Multi Transaction With Expense Routing` | 2 transaction accounts with expense item default set to non-primary | route expense transactions to the selected account and fall back to primary when unset | backend + frontend |
| `Generalised Account Transfer` | any two active accounts (including non-savings) as source and destination | create transfer income lines, validate against source balance, block self-referential transfers, and record transfer transactions with correct account pair | backend + frontend |
| `Investment Linked Account Display` | investment item with `linked_account_desc` set | return and display `affected_account_desc` on investment transactions | backend + frontend |
| `Demo Seeded Budget` | baseline personal setup with linked savings and primary investment plus historical, current, and upcoming cycles | dev-only seeded budget creation stays additive, remains gated by shared dev mode, and produces meaningful budget-health signals | backend + frontend |

Notes:

- `frontend` means the setup state, guidance, or page-level rendering is covered in React tests.
- `backend` means the downstream financial behavior, routing, or validation consequence is covered in API tests.
- some shapes are intentionally covered in more than one row because the setup itself is valid, but different downstream consequences need separate protection

## Testing Principles

- Protect financial workflow trust before broad UI polish.
- Prefer testing behavior and invariants over implementation details.
- Put most weight on backend tests because the backend currently owns the financial rules.
- Keep pure logic testable without requiring full app startup where possible.
- Use API integration tests for workflows that cross multiple tables and helper functions.
- Add frontend tests mainly around user-critical flows and conditional states, not cosmetic markup.
- Keep end-to-end tests small and high-value once the lower layers are in place.
- Use coverage and SonarQube hotspots as signals for thin risk areas, not as the definition of quality.
- When adding coverage to satisfy a quality gate, prefer tests that protect meaningful workflow behavior, financial integrity, historical correctness, or user-critical guidance rather than tests that only execute lines once.
- Avoid coverage theater: do not add brittle or low-value tests whose main purpose is to increase a metric without improving trust in the product.
- Whenever a product rule is documented in an MD file, it should usually have a corresponding test case or explicit testing note.
- Prefer documenting new test scope and remaining gaps back into this file so future sessions do not have to rediscover the current boundary.

## Test Integrity

Tests must verify **user-visible behavior**, not implementation details. When a code change causes a test to fail, evaluate whether the test or the code is wrong—do not restructure the test just to produce a pass.

### Core principles

1. **Tests should verify user-visible behavior, not implementation details**
   - Assertions should check what the user actually sees or experiences
   - Avoid testing internal state, private methods, or intermediate calculations unless they are explicit user-facing outputs

2. **Assertions should be specific and deterministic**
   - When the test controls the inputs, the expected output should be known exactly
   - Use specific matchers that would fail if the output format changes unexpectedly
   - Avoid overly flexible matchers (regex wildcards, function matchers that accept anything) that would pass with incorrect output

3. **Mock external dependencies; don't weaken assertions**
   - It is valid to mock external dependencies (APIs, localization settings, date/time) to make tests deterministic
   - It is NOT valid to weaken assertions so they'd pass regardless of the actual output
   - If a dependency change affects output, either fix the code or update the expected value—not the matcher flexibility

4. **Evaluate failures honestly**
   - If a code change causes a test to fail, ask: is the new behavior correct?
   - If yes: update the test's expected values to match the new correct behavior
   - If no: fix the code
   - Never alter tests just to make them pass when the product behavior is wrong

### Examples

**Bad practice—making assertions vague to force a pass:**

```javascript
// Original: specific, deterministic assertion
expect(screen.getByText('30 June 26')).toBeTruthy()

// Bad: weakened to pass with any format containing "30"
expect(screen.getByText(/30/)).toBeTruthy()

// Bad: function matcher that accepts anything with the right characters
expect(screen.getByText((content) => 
  content.includes('30') && content.includes('2026')
)).toBeTruthy()
```

These weakened assertions would pass even if dates were formatted incorrectly (e.g., "30-06-2026", "June 30 2026", or even corrupted output like "30 ERROR 2026").

**Good practice—controlling inputs to make output predictable:**

```javascript
// Control the localization context so output is deterministic
renderWithProviders(<BudgetPeriodsPage />, {
  route: '/budgets/1',
  path: '/budgets/:budgetId',
  budget: { 
    locale: 'en-AU', 
    currency: 'AUD', 
    timezone: 'Australia/Sydney', 
    date_format: 'short'  // Explicit format: "30 June 26"
  },
})

// Assert on the exact user-visible string
expect(screen.getByText('30 June 26')).toBeTruthy()
```

This approach:
- Verifies the exact user-visible format
- Would fail if the format logic changed unexpectedly
- Makes the test's assumptions explicit (short date format, en-AU locale)
- Remains a valid functional test of user-visible behavior

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
- period detail distinction between locked active cycles and closed cycles
- close-out modal preview and submit flow
- delete option presentation for single delete versus future-chain delete
- paid or revised controls for expenses and investments
- income transaction modal behavior for standard income, transfer-backed income, and `Carried Forward`
- period-detail amount-expression input behavior across transaction, add-line, and budget-adjustment modals
- key summaries that distinguish budget totals from actual totals
- session-persisted expand or collapse behavior where setup or history panels intentionally remember user preference for the browser session

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
- export the viewed cycle as flat CSV
- validate that empty transaction dates sort first and dated transaction rows then sort ascending in the downloaded file

## Current Harness Status

Backend scaffold now present:

- shared pytest fixtures in [backend/tests/conftest.py](/home/ubuntu/dosh/backend/tests/conftest.py)
- shared pytest fixtures now create an isolated SQLite database per test case and patch the app onto that engine before the case runs
- reusable data helpers in [backend/tests/factories.py](/home/ubuntu/dosh/backend/tests/factories.py)
- initial smoke and pure-logic tests in [backend/tests/test_app_smoke.py](/home/ubuntu/dosh/backend/tests/test_app_smoke.py) and [backend/tests/test_period_logic.py](/home/ubuntu/dosh/backend/tests/test_period_logic.py)
- first Priority 1 workflow coverage in [backend/tests/test_closeout_flow.py](/home/ubuntu/dosh/backend/tests/test_closeout_flow.py), [backend/tests/test_delete_continuity.py](/home/ubuntu/dosh/backend/tests/test_delete_continuity.py), and [backend/tests/test_status_workflows.py](/home/ubuntu/dosh/backend/tests/test_status_workflows.py)
- additional Priority 1 edge coverage in [backend/tests/test_closed_cycle_guards.py](/home/ubuntu/dosh/backend/tests/test_closed_cycle_guards.py) and [backend/tests/test_lifecycle_and_health.py](/home/ubuntu/dosh/backend/tests/test_lifecycle_and_health.py)
- initial reconciliation and health-matrix coverage in [backend/tests/test_transactions_and_balances.py](/home/ubuntu/dosh/backend/tests/test_transactions_and_balances.py) and [backend/tests/test_budget_health_matrix.py](/home/ubuntu/dosh/backend/tests/test_budget_health_matrix.py)
- additional live-ledger and advanced health coverage in [backend/tests/test_live_ledger_behavior.py](/home/ubuntu/dosh/backend/tests/test_live_ledger_behavior.py) and [backend/tests/test_budget_health_advanced.py](/home/ubuntu/dosh/backend/tests/test_budget_health_advanced.py)
- initial setup and scenario coverage in [backend/tests/test_budget_setup_workflows.py](/home/ubuntu/dosh/backend/tests/test_budget_setup_workflows.py)
- centralized setup-assessment and downstream-protection coverage in [backend/tests/test_setup_assessment.py](/home/ubuntu/dosh/backend/tests/test_setup_assessment.py)
- initial frontend workflow coverage in [BudgetPeriodsPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetPeriodsPage.test.jsx), [PeriodDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/PeriodDetailPage.test.jsx), [BudgetDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetDetailPage.test.jsx), [BalanceTypesTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BalanceTypesTab.test.jsx), [IncomeTypesTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/IncomeTypesTab.test.jsx), [InvestmentItemsTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/InvestmentItemsTab.test.jsx), and [SettingsTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/SettingsTab.test.jsx), with shared render utilities in [testUtils.jsx](/home/ubuntu/dosh/frontend/src/testUtils.jsx)
  This now includes delete continuity messaging, non-deletable delete-state gating, closed-cycle read-only rendering, close-out modal confirmation gating, expense and investment paid-confirmation flows, expense and investment revise-comment workflows, locked-cycle guardrail messaging, settings guidance for primary investment allocation, manual cycle lock setting changes, account primary-selection setup plus edit, deactivation, and delete behavior, income setup auto-include behavior plus linked-account removal through edit, investment setup with and without linked accounts, investment primary/edit/deactivation/delete behavior, backend coverage for primary-investment reassignment affecting future auto-surplus generation, setup-shape visibility for richer account configurations, setup states where accounts exist but no primary account is selected, valid single-account setup states without false missing-account warnings, setup-to-generation readiness gating, successful generation handoff with suggested next start date, generate failure feedback, setup guidance when account foundations are missing, setup-assessment summary state on the budget setup page, and protected setup-item rendering across all relevant setup tabs.
  Recent additions in this session include:
  - account-naming preference persistence plus display-label rendering across settings, account setup, income linked-account copy, and investment linked-account copy
  - ordered setup-assessment blocking issues and ready-state linking on the budget setup page
  - session-persisted collapse state for optional setup sections and the historical budget-cycle section
  - `Upcoming` grouping wording on the budget cycles list
  - `Projected Savings` and `Remaining Expenses` summary-card visibility on the period detail page
  More recent additions now in place:
  - locked active cycles continue to allow actual recording and transaction entry while still protecting structural edits
  - period-detail income actual entry now uses a dedicated income transaction modal rather than inline set or add controls
  - income transaction UI coverage now exists alongside expense and investment transaction coverage
  - removed the orphaned `backend/app/health_engine/closeout_health.py` module (legacy closeout preview logic now lives in `cycle_management.py` and the health engine runner)
  - added frontend component coverage for `CloseoutModal`, `TransactionListPanel`, `periodCalculations`, and `AddIncomeLineModal` in dedicated test files under `frontend/src/__tests__`
- initial Playwright end-to-end scaffold in [playwright.config.js](/home/ubuntu/dosh/frontend/playwright.config.js) and [budget-smoke.spec.js](/home/ubuntu/dosh/frontend/e2e/budget-smoke.spec.js)
  The current smoke paths now run successfully in Chromium locally, covering blocked setup handoff, minimum-setup first-cycle generation, first expense-transaction activity with linked account movement, close-out into the next active cycle, and budget-cycle export download validation.
  The current Playwright backend harness now runs `alembic upgrade head` against a fresh SQLite database before booting the backend server, so end-to-end flows exercise a migrated schema instead of an uninitialized file.
  The current smoke path selectors have also been updated to match the newer `Primary transaction account` wording so the suite reflects current UI copy.

Current backend run command:

```bash
cd backend
python3 -m venv .venv
./.venv/bin/python -m pip install -r requirements-dev.txt
./.venv/bin/python -m pytest -q
```

Current frontend run command:

```bash
cd frontend
CI=true npm test -- --watchAll=false --runInBand
```

Current test counts:
- Backend: 305 tests
- Frontend: 342 tests

Current end-to-end run command:

```bash
cd frontend
npx playwright test
```

Current backend scaffold proves:

- the app can boot under an isolated SQLite test database
- the app can boot under an isolated SQLite test database per test case rather than a shared suite database
- tests can drive API requests through FastAPI `TestClient`
- tests can seed reusable domain fixtures without touching the real app database
- the repository now has a stable place to add lifecycle, close-out, and continuity regression tests
- the repository now has initial regression coverage for close-out transitions, carry-forward persistence, continuity-aware deletion, regeneration, paid or revised status guards, closed-cycle write rejection, delete blockers after recorded activity, lifecycle normalization, historical health snapshot preservation, live ledger-driven balance movement, system-generated transaction rows, early health-scoring matrix behavior, setup-driven scenario assumptions including non-primary linked-income routing, primary-account reassignment effects on later expense activity, mixed-account movement routing, and centralized setup assessment plus in-use setup protection

Current limitation:

- Priority 1 coverage is now present but still partial, and should next be expanded into deeper live transaction-ledger reconciliation scenarios, broader budget health scoring combinations, and broader frontend workflow coverage across setup, delete, and paid or revised edge states
- the initial Playwright smoke layer is intentionally small and currently covers only the earliest setup, generation, first-transaction, and close-out happy paths, not richer multi-line activity, reconciliation, or broader scenario-shape permutations
- the current Playwright export coverage validates a real downloaded CSV and its row-ordering rules, but it still does not cover richer JSON assertions, larger multi-line export combinations, or broader reconciliation workflows

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
- isolated SQLite test database per test case
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

- Vite for build and local dev
- standalone Jest runner
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
- income transaction add, delete, and correction flows sync actuals and balances correctly
- multi-account scenarios do not break balance movement and transaction-account expectations

### Priority 3: Frontend user-safety flows

- destructive options are labeled correctly
- closed-cycle views become read-only in the right places
- close-out surfaces communicate the next-cycle consequences correctly
- period summaries show the expected lifecycle state and action availability
- locked active cycles continue to expose actual-entry paths that closed cycles block

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
- centralized setup-assessment blocking and setup protection once downstream cycles depend on setup records
- `Single Account` savings-transfer rejection when no savings account exists
- `Multi Transaction` primary-account use for expense movement
- `Mixed Accounts` movement routing across transaction, savings, and linked investment accounts
- clear downstream failure when period investment reference data is missing
- structured JSON logging configuration: formatter validity, ISO timestamp format, default INFO level, DEBUG override via env, invalid-level fallback to INFO, and third-party logger tuning (uvicorn.access, sqlalchemy.engine)

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
- When a new rule is added to [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md) or [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md), add or revise the corresponding test case entry here.
- If the migration strategy changes, update the backend harness guidance to reflect how test databases should be prepared.
- If the frontend toolchain changes again from the current Vite plus Jest baseline, revisit the recommended frontend test tooling section.
- If new user-account shapes become important, add them to the named scenario list here and expand setup and workflow tests accordingly.
