# Dosh Test Results Summary

This document records meaningful automated test results from major working sessions.

It exists separately from [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) so the strategy can stay stable while future sessions still have a record of what was actually run and verified.

## Latest Session: Localisation Beta Hardening, Operator-Triggered Calculator Entry, Date-Format Cleanup, And Redeploy

Session outcomes verified in this run:

- backend-supported localisation options now feed Settings for locale, currency, timezone, and date-format choices
- backend localisation validation now rejects unsupported locale/currency/timezone values and resolves explicit `date_format: null` to `medium`
- Settings date format selection is a normal dropdown again and includes `MM-dd-yy` and `MMM-dd-yyyy`
- date picker display and calendar chrome now use the active budget locale
- date-range formatting uses `Intl.DateTimeFormat.prototype.formatRange` where available, with fallback coverage
- localized amount normalization now uses string-based decimal handling for the money-entry boundary
- non-Latin digit locales are out of scope for beta, and current amount fields continue rejecting negative values
- AutoNumeric was removed in favor of the implemented custom numeric input contract
- calculator mode is triggered by simple arithmetic operators or the still-supported leading `=`, without adding an `Adjust` button
- add-transaction shared modal now focuses the amount input
- export labels and affordances were reviewed and did not imply localized or human-readable export for beta

### Verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --runInBand SettingsTab.test.jsx DateField.test.jsx localisation.test.jsx AmountExpressionInput.test.jsx
npm test -- --runInBand SettingsTab.test.jsx DateField.test.jsx localisation.test.jsx

cd /home/ubuntu/dosh
backend/.venv/bin/pytest backend/tests/test_budget_schema_validation.py backend/tests/test_app_smoke.py -q
git diff --check
```

Result:

- frontend targeted localisation and amount-entry batch passed with `35 passed`
- backend targeted localisation and smoke batch passed with `27 passed`
- follow-up frontend date-format dropdown batch passed with `14 passed`
- follow-up backend null-date-format/default batch passed with `28 passed`
- `git diff --check` passed cleanly

Failures and resolutions:

- the first backend follow-up run showed that `BudgetUpdate(date_format=None)` still remained `None` because the optional field validator was not running before optional handling
- the validator was changed to run in `mode="before"`, and the backend batch then passed with `28 passed`
- an earlier screenshot showed an alert for an unknown `mod_date` column, but no current code or live SQLite schema references to `mod_date` were found; the user should capture fresh logs if it appears after the latest redeploy

Deployment verification:

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true ./scripts/release_with_migrations.sh
docker compose -f docker-compose.yml -f docker-compose.override.yml ps
curl -sS http://127.0.0.1:3080/api/health
curl -sS http://127.0.0.1:3080/api/info
curl -sS http://127.0.0.1:3080/api/budgets/localisation-options
curl -sS -I http://127.0.0.1:3080/
```

Result:

- `dosh-backend` and `dosh-frontend` were running
- `/api/health` returned `{"status":"ok","app":"Dosh"}`
- `/api/info` returned `{"app":"Dosh","version":"0.3.0-alpha","schema_revision":"c4d8e6f1a2b3"}`
- `/api/budgets/localisation-options` returned the supported options including `MM-dd-yy` and `MMM-dd-yyyy`
- frontend root returned `HTTP/1.1 200 OK`

Versioning:

- no version bump was made; this is recorded as unreleased follow-up work after `0.3.0-alpha`

## Latest Session: SonarQube Test Warning Fix For PersonalisationTab

Session outcome verified in this run:

- resolved the React testing warning about updates not wrapped in `act(...)` during `PersonalisationTab` test teardown

### Verification

Command run:

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --runInBand src/__tests__/PersonalisationTab.test.jsx
```

Result:

- suite passed with `1 passed`
- tests passed with `3 passed`

Failure and resolution:

- warning source: `afterEach` in [PersonalisationTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/PersonalisationTab.test.jsx) called `jest.runOnlyPendingTimers()` outside `act(...)`, which can trigger React Query notifications outside React’s test boundary
- fix: wrap pending timer flush in `act(() => { jest.runOnlyPendingTimers() })`

## Latest Session: PeriodDetail Quick-Fill Focused-Value Regression Fix

Session outcome verified in this run:

- restored quick-fill visibility in focused amount fields after the shared transaction amount input started auto-focusing by default

### Verification

Command run:

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --runInBand src/__tests__/PeriodDetailPage.test.jsx
```

Result:

- suite passed with `1 passed`
- tests passed with `51 passed`

Failure and resolution:

- initial failure: quick-fill buttons wrote state but the focused amount input still rendered stale empty text in `PeriodDetailPage` tests
- root cause: [LocalizedAmountInput.jsx](/home/ubuntu/dosh/frontend/src/components/LocalizedAmountInput.jsx) skipped prop-to-draft sync while focused
- fix: allow focused input draft to sync from external value changes using focused-edit formatting
- follow-up failure: test expectations still asserted formatted values (`700.00`, `375.00`, `2,000.00`) while the focused field contract now intentionally shows plain editable values (`700`, `375`, `2000`)
- fix: updated `PeriodDetailPage` assertions to match the focused-edit behavior

## Latest Session: Localisation Date Format, Version-Bump Reassessment, And Regression Sweep

Session outcomes verified in this run:

- budget-level `date_format` was added alongside existing localisation preferences, defaulting to `medium`
- Settings now exposes a date-format selector and shared localisation helpers apply the selected default date format through `Intl.DateTimeFormat`
- [DateField.jsx](/home/ubuntu/dosh/frontend/src/components/DateField.jsx) now maps the selected budget date format into the date-picker display format while still submitting normalized `yyyy-MM-dd` values
- release policy was clarified so “intentionally chosen” does not block a version bump once release scope is clear
- version `0.3.0-alpha` was selected for the localisation release and the release notes were converted from `Unreleased` into a released entry dated `2026-04-10`
- Alembic head moved to `c4d8e6f1a2b3`

### Verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
./.venv/bin/pytest tests/test_budget_schema_validation.py tests/test_auto_expense_migration.py tests/test_app_smoke.py
./.venv/bin/pytest

cd /home/ubuntu/dosh/frontend
npm test -- --runTestsByPath src/__tests__/localisation.test.jsx src/__tests__/SettingsTab.test.jsx src/__tests__/Layout.test.jsx --silent
npm run build
npm test -- --silent

cd /home/ubuntu/dosh
python3 scripts/release_management.py validate --ref WORKTREE --require-release-entry
```

Result:

- focused backend batch passed with `24 passed`
- full backend suite passed with `114 passed`
- focused frontend batch passed with `17 passed`
- Vite production build passed
- full frontend suite passed with `150 passed`
- release validation confirmed all required version touchpoints aligned at `0.3.0-alpha` and found the matching released entry
- migration-aware deployment completed successfully and live `/api/info` returned version `0.3.0-alpha` with schema revision `c4d8e6f1a2b3`

Failures and resolutions:

- the first full frontend run found stale regression expectations that quick-fill and personalisation amount fields should include `$` inside editable value inputs
- those tests were corrected to preserve the current product contract: display labels may show currency symbols, but editable value fields stay numeric-only

Deployment verification:

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true ./scripts/release_with_migrations.sh
curl -sS http://127.0.0.1:3080/api/health
curl -sS http://127.0.0.1:3080/api/info
curl -I http://127.0.0.1:3080
docker compose -f docker-compose.yml -f docker-compose.override.yml ps
```

Result:

- Alembic upgraded the deployed database from `9b7f3c2d1a4e` to `c4d8e6f1a2b3`
- `/api/health` returned `ok`
- `/api/info` returned `{"app":"Dosh","version":"0.3.0-alpha","schema_revision":"c4d8e6f1a2b3"}`
- the frontend root returned `HTTP/1.1 200 OK`
- `dosh-backend` and `dosh-frontend` were both running, with the frontend exposed on `3080`

## Latest Session: Full Localisation Support, Masked Amount Input, Formula Mode, And Deployment Refresh Fix

Session outcomes verified in this run:

- budget-level `locale`, `currency`, and `timezone` preferences were added with backend validation and Alembic migration coverage
- shared frontend localisation helpers now cover currency, number, percent, date, time, date-time, date-range, storage date keys, timezone-aware today, localized amount parsing, and custom numeric input options
- normal amount entry now uses localized numeric masked inputs without currency symbols or codes inside editable fields, while calculator mode activates only with simple arithmetic operators or the still-supported leading `=`
- touched high-traffic surfaces now use shared localisation helpers rather than hard-coded `en-AU`, `AUD`, raw percent strings, or browser-local timestamp assumptions
- the migration-aware deployment upgraded the live schema to `9b7f3c2d1a4e`
- a post-deploy `/budgets` refresh crash was reproduced, fixed, rebuilt, redeployed, and verified with Playwright

### Backend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
./.venv/bin/pytest
```

Result:

- backend full suite passed with `113 passed`
- migration helper head revision was updated to `c4d8e6f1a2b3`
- budget preference schema validation and migration upgrade coverage passed as part of the suite

### Frontend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --silent
npm run build
npm test -- --runTestsByPath src/__tests__/BudgetsPage.test.jsx --silent
```

Result:

- frontend full Jest suite passed with `142 tests passed`
- Vite production build passed
- targeted Budgets page regression passed after fixing the pending-closure refresh crash

### Deployment verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true ./scripts/release_with_migrations.sh
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build frontend
curl http://127.0.0.1:8000/api/health
curl http://127.0.0.1:8000/api/info
```

Result:

- the migration-aware release script built the images, backed up SQLite as `dosh-20260410-070948.db`, ran Alembic upgrade, and restarted the stack
- `/api/health` returned `ok`
- `/api/info` returned version `0.3.0-alpha` with schema revision `9b7f3c2d1a4e` before the follow-up date-format migration was added
- after the post-deploy fix and frontend redeploy, Playwright refreshed `http://127.0.0.1:3080/budgets` with no console or page errors and confirmed the page rendered

### Failures and resolutions

Observed issues during the session:

- post-deploy refresh of the budgets page flashed, then rendered black/blank because `PendingClosureList` called `formatPeriodRange(period)` without passing the required `formatDateRange` helper
- `npm audit --audit-level=critical` still reports a critical advisory for `axios <1.15.0`, with a fix available through `npm audit fix`

Resolution:

- updated [BudgetsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetsPage.jsx) so `PendingClosureList` resolves `formatDateRange` from localisation context and passes it into `formatPeriodRange`
- rebuilt and redeployed the frontend after the fix
- left the `axios` advisory unresolved because it was outside the localisation implementation scope and should be handled as a deliberate dependency-maintenance task

Final result:

- full localisation support for regional formatting and numeric masked amount input is implemented, tested, migrated, and deployed
- the post-deploy budgets-page refresh crash is fixed and verified
- version `0.3.0-alpha` was selected after reassessing the release policy; release notes now carry the localisation scope as a released entry dated `2026-04-10`

## Latest Session: Account Primary-Per-Type Fix, In-Use Account Edit Guard Repair, And Transfer-Balance Verification

Session outcomes verified in this run:

- account setup now scopes primary designation per balance type, so a primary `Savings` or `Cash` account no longer clears the required primary `Transaction` account
- the transaction-ledger and setup-assessment paths now consistently treat the active primary `Transaction` account as the default expense-driven account without conflating it with other account-type primaries
- in-use account editing now allows primary-flag changes when the submitted `balance_type` and `opening_balance` values are unchanged, avoiding false structure-lock failures during ordinary primary reassignment
- the live transfer model remains intentionally single-line-per-savings-account per cycle, with additional transfer movement expected to be added through transactions on that existing line
- focused transfer and balance tests confirmed that transfer activity still affects both the selected savings account and the receiving account through ledger-backed balance movement
- the stack was redeployed twice through the override-aware Compose path after the account fixes, and the final frontend verification returned `200 OK`

### Backend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
./.venv/bin/pytest tests/test_setup_assessment.py
./.venv/bin/pytest tests/test_transactions_and_balances.py tests/test_budget_setup_workflows.py -k "transfer or balance"
```

Result:

- the setup-assessment suite passed after adding coverage for per-type primary handling and in-use primary-flag edits
- the focused transfer and balance batch passed, confirming that savings-transfer movement still reconciles through the ledger-backed account views

### Frontend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --runTestsByPath src/__tests__/BalanceTypesTab.test.jsx
npm test -- --runTestsByPath src/__tests__/PeriodDetailPage.test.jsx -t "transfer|balance movement"
```

Result:

- the account-setup regression suite passed after the primary-label and switching-flow updates
- the focused period-detail transfer and balance-movement tests passed on the current UI

### Deployment verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.override.yml ps
curl -I http://127.0.0.1:3080
```

Result:

- both `dosh-backend` and `dosh-frontend` came up successfully after each redeploy
- the first frontend probe after each recreate briefly landed during the nginx restart window, then the final check returned `HTTP/1.1 200 OK`

### Failures and resolutions

Observed issues during the session:

- the original account-primary fix exposed a second guard bug: editing an in-use account’s primary flag still failed because the frontend submitted unchanged `balance_type` and `opening_balance` fields, which the backend interpreted as a structural edit
- a later review of the `Transfer from Savings` modal looked like another savings-account selection bug, but the current behavior was confirmed to be intentional because one transfer line per savings account per cycle is the designed model

Resolution:

- updated [balance_types.py](/home/ubuntu/dosh/backend/app/routers/balance_types.py) so structure-lock enforcement only triggers when `balance_type` or `opening_balance` actually change value
- retained the existing one-line-per-savings-account transfer model and verified the downstream balance movement path instead of widening the modal logic unnecessarily

Final result:

- the account primary-per-type fix is complete
- in-use savings accounts can now be marked primary without displacing the transaction primary or tripping a false structure-lock error
- transfer activity remains ledger-backed and balance-safe under the current modal and transaction model

## Latest Session: Budget-Cycle Stage Model, Pending-Closure Navigation, Demo Seed Expansion, And Follow-Up UI Polish

Session outcomes verified in this run:

- budget-cycle lifecycle presentation now distinguishes explicit stored lifecycle status from derived user-facing stage, allowing `Pending Closure` to remain visible when a cycle has expired but close-out is still outstanding
- the sidebar, budget cycles page, and budget summary now use the aligned order `Current`, `Planned`, `Pending Closure`, `Historic`
- pending-closure periods now have direct close-out shortcuts from the summary surfaces, and the period-detail page supports deep-link opening of the close-out modal
- the demo budget seed now behaves as a rolling window with `Closed`, two `Pending Closure`, one `Current`, and multiple `Planned` cycles, alongside transfer-style movement, transaction-direction edge cases, and budget-adjustment examples
- the stack was redeployed repeatedly through the override-aware Compose path after the lifecycle, demo, and UI changes, and the final live verification returned `200 OK` from the frontend

### Backend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
./.venv/bin/pytest tests/test_lifecycle_and_health.py tests/test_closeout_flow.py tests/test_closed_cycle_guards.py
./.venv/bin/pytest tests/test_app_smoke.py tests/test_lifecycle_and_health.py tests/test_closeout_flow.py
```

Result:

- the focused lifecycle, close-out, and closed-cycle guard suites passed after the stage-model refactor
- the smoke and lifecycle batch passed after the rolling demo-seed updates and pending-closure support

### Frontend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --runTestsByPath src/__tests__/Dashboard.test.jsx src/__tests__/BudgetPeriodsPage.test.jsx src/__tests__/BudgetsPage.test.jsx src/__tests__/Layout.test.jsx src/__tests__/PeriodDetailPage.test.jsx
npm test -- --runTestsByPath src/__tests__/BudgetPeriodsPage.test.jsx src/__tests__/Layout.test.jsx
npm test -- --runTestsByPath src/__tests__/BudgetsPage.test.jsx src/__tests__/Dashboard.test.jsx
npm test -- --runTestsByPath src/__tests__/BudgetPeriodsPage.test.jsx
```

Result:

- the touched stage-grouping, navigation, budget-summary, and close-out deep-link suites passed after the wording and layout changes
- the focused budget-cycles suite continued to pass through the pending-closure badge color and alignment refinements

### Deployment verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh
docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.override.yml ps
curl -I http://127.0.0.1:3080
```

Result:

- both `dosh-backend` and `dosh-frontend` came up successfully
- frontend verification returned `HTTP/1.1 200 OK`
- brief frontend `502` responses were observed during backend recreation, then cleared once the new backend finished starting

### Failures and resolutions

Observed issues during the session:

- the first backend test attempt used a shell environment without the backend virtual environment, which failed because `sqlalchemy` was not available on the default `pytest` path
- the original lifecycle assumptions and user-facing wording no longer matched the desired `Pending Closure` concept, because expired open cycles had previously been normalized away
- the first pending-closure status pill style used a brown background that did not fit the surrounding section styling

Resolution:

- standardized backend verification on the repository virtual environment at [backend/.venv](/home/ubuntu/dosh/backend/.venv)
- updated lifecycle handling so stored status and displayed stage are now distinct concerns, allowing multiple overdue open cycles while preserving close-out semantics
- refined the pending-closure badge styling to use the same neutral background family as the other status chips

Final result:

- lifecycle hardening for the new stage model is complete
- close-out-related roadmap work remains active in experience, reporting, health, and reconciliation follow-through
- the final override-aware deployment is live and the updated stage model is visible in the app

## Latest Session: Shared Expense Scheduling, Fixed-Day Rollover, Transaction-Modal Consistency, And Release-Notes Expansion

Session outcomes verified in this run:

- Budget Setup and Period Detail now share one expense-scheduling field set, with `Effective Date` as the consistent day-based label where fixed-day and every-x-days scheduling needs it
- the touched expense date inputs now use a shared date-picker control with a clickable calendar icon, full-width layout normalization, dark-mode styling, and `DD MMM YYYY` display for day-based effective dates
- fixed-day scheduling now rolls missing dates such as day `31` onto the next day after month end, with matching backend logic and frontend helper guidance
- transaction-modal quick fill is now intentionally centralized across income, expense, and investment, with category differences reduced to direction rather than separate modal behaviors
- transaction submit buttons in the shared modal are now neutral rather than red or category-colored, while category pills remain unchanged
- the release-notes modal now supports expanding newer available versions for details
- the stack was redeployed repeatedly through the override-aware Compose path after the frontend and scheduling refinements, and the final live health check passed

### Frontend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --runTestsByPath src/__tests__/PeriodDetailPage.test.jsx src/__tests__/ExpenseItemsTab.test.jsx
npm test -- --runTestsByPath src/__tests__/Layout.test.jsx
npm test -- --runTestsByPath src/__tests__/PeriodDetailPage.test.jsx
npm run build
```

Result:

- the focused period-detail regression suite passed repeatedly through the quick-fill, icon-color, neutral-button, and shared-modal consistency changes
- the focused expense-setup regression suite passed after the shared scheduling-field and effective-date alignment work
- the layout regression covering release-notes expansion passed
- the production frontend build passed after the shared date-field and styling changes

Files with meaningful frontend updates in this session:

- [DateField.jsx](/home/ubuntu/dosh/frontend/src/components/DateField.jsx)
- [ExpenseItemSchedulingFields.jsx](/home/ubuntu/dosh/frontend/src/components/ExpenseItemSchedulingFields.jsx)
- [ReleaseNotesModal.jsx](/home/ubuntu/dosh/frontend/src/components/ReleaseNotesModal.jsx)
- [SetupItemHistoryModal.jsx](/home/ubuntu/dosh/frontend/src/components/SetupItemHistoryModal.jsx)
- [index.css](/home/ubuntu/dosh/frontend/src/index.css)
- [BudgetsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetsPage.jsx)
- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)
- [ExpenseItemsTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/ExpenseItemsTab.jsx)
- [fixedDayScheduling.js](/home/ubuntu/dosh/frontend/src/utils/fixedDayScheduling.js)
- [PeriodDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/PeriodDetailPage.test.jsx)
- [ExpenseItemsTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/ExpenseItemsTab.test.jsx)
- [Layout.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/Layout.test.jsx)

### Backend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
./.venv/bin/pytest tests/test_period_logic.py tests/test_auto_expense.py
```

Result:

- the focused backend scheduling suites passed after the fixed-day rollover changes
- shared fixed-day logic now has direct coverage at both the period-logic and Auto Expense layers

Files with meaningful backend updates in this session:

- [period_logic.py](/home/ubuntu/dosh/backend/app/period_logic.py)
- [auto_expense.py](/home/ubuntu/dosh/backend/app/auto_expense.py)
- [test_period_logic.py](/home/ubuntu/dosh/backend/tests/test_period_logic.py)
- [test_auto_expense.py](/home/ubuntu/dosh/backend/tests/test_auto_expense.py)

### Failures and resolutions

Observed issues during the session:

- one deploy initially used only the base Compose file, which omitted the environment-specific [docker-compose.override.yml](/home/ubuntu/dosh/docker-compose.override.yml) behavior needed by the shared deployment path
- the first shared date-field pass left the calendar icon as a passive visual affordance, and layout differences between flows made the icon placement look inconsistent
- transaction-modal inconsistencies persisted after the first shared-modal pass because some visual and quick-fill rules were still coming from per-category config rather than one shared policy

Resolution:

- standardized deployment and later redeploys on `docker compose -f docker-compose.yml -f docker-compose.override.yml up -d --build`
- updated [DateField.jsx](/home/ubuntu/dosh/frontend/src/components/DateField.jsx) and [index.css](/home/ubuntu/dosh/frontend/src/index.css) so the icon is inside the field boundary, acts as a real calendar trigger, and the wrapper and input container stay full width
- moved the touched quick-fill and submit-button behavior back onto centralized shared-modal rules in [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx), leaving only transaction direction as the intended category differentiator

Final result:

- the shared expense add modal, the accepted fixed-day `31` rollover behavior, and the transaction quick-fill and button-color changes all received user acceptance during the session
- the final override-aware deploy completed successfully and the live health endpoint returned `{\"status\":\"ok\",\"app\":\"Dosh\"}`

## Latest Session: Auto Expense Implementation, Migration Harness Coverage, Runtime Baseline Repair, And Feedback-Modal Polish

Session outcomes verified in this run:

- Auto Expense is now implemented as a budget-level optional automation for scheduled expenses
- budget settings now include Auto Expense enablement and offset-day controls
- scheduled expense AUTO/MANUAL switching is now backend-enforced and blocks `MANUAL -> AUTO` once recorded expense activity exists
- the period-detail page now supports manual Auto Expense execution and shows blocked pay-type changes in a dedicated warning modal
- the backend now has dedicated migration coverage for both clean Alembic upgrade and upgrade from a pre-feature SQLite snapshot
- the backend deploy/runtime baseline was corrected from Python 3.9 to Python 3.12 after deployment exposed an incompatibility with the codebase's typing syntax
- the Auto Expense migration was corrected to remain SQLite-safe after the initial deploy attempt exposed unsupported `ALTER COLUMN ... DROP DEFAULT` behavior
- the stack was redeployed repeatedly through the override-aware Compose path after backend runtime, migration, and period-detail UI refinements

### Backend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
../backend/.venv/bin/python -m pytest tests/test_auto_expense_migration.py -q
../backend/.venv/bin/python -m pytest tests/test_auto_expense.py tests/test_budget_schema_validation.py -q
../backend/.venv/bin/python -m pytest tests/test_budget_setup_workflows.py -k expense -q
python3 -m py_compile app/main.py app/models.py app/schemas.py app/auto_expense.py app/routers/expense_items.py app/routers/periods.py
```

Result:

- the dedicated migration harness passed for both clean upgrade and pre-feature upgrade coverage
- the focused Auto Expense and schema-validation suites passed
- the focused expense workflow slice in `test_budget_setup_workflows.py` passed
- backend compile checks passed after the Python 3.9-incompatible annotation issue was removed from the deploy path

Files with meaningful backend updates in this session:

- [auto_expense.py](/home/ubuntu/dosh/backend/app/auto_expense.py)
- [expense_items.py](/home/ubuntu/dosh/backend/app/routers/expense_items.py)
- [periods.py](/home/ubuntu/dosh/backend/app/routers/periods.py)
- [models.py](/home/ubuntu/dosh/backend/app/models.py)
- [schemas.py](/home/ubuntu/dosh/backend/app/schemas.py)
- [2ef0f1a2f1ba_add_auto_expense_settings.py](/home/ubuntu/dosh/backend/alembic/versions/2ef0f1a2f1ba_add_auto_expense_settings.py)
- [migration_helpers.py](/home/ubuntu/dosh/backend/tests/migration_helpers.py)
- [test_auto_expense.py](/home/ubuntu/dosh/backend/tests/test_auto_expense.py)
- [test_auto_expense_migration.py](/home/ubuntu/dosh/backend/tests/test_auto_expense_migration.py)

### Frontend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --runTestsByPath src/__tests__/SettingsTab.test.jsx src/__tests__/ExpenseItemsTab.test.jsx src/__tests__/PeriodDetailPage.test.jsx --runInBand
npm test -- --runTestsByPath src/__tests__/PeriodDetailPage.test.jsx --runInBand
```

Result:

- the focused Auto Expense frontend batch passed with settings, setup, and period-detail coverage
- the period-detail regression suite continued passing after the Auto Expense result banner restyle, inline row-feedback experiment, warning-modal change, and final minimal modal polish

Files with meaningful frontend updates in this session:

- [SettingsTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/SettingsTab.jsx)
- [ExpenseItemsTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/ExpenseItemsTab.jsx)
- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)
- [client.js](/home/ubuntu/dosh/frontend/src/api/client.js)
- [SettingsTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/SettingsTab.test.jsx)
- [ExpenseItemsTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/ExpenseItemsTab.test.jsx)
- [PeriodDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/PeriodDetailPage.test.jsx)

### Deployment failures and resolutions

Initial failures:

- the first backend deploy failed because the running backend image still used Python 3.9 while the codebase already relied on Python 3.10+ union-type syntax
- after the backend image was corrected, the Auto Expense Alembic revision failed on SQLite because the migration attempted `ALTER COLUMN ... DROP DEFAULT`
- one deployment pass initially used only the base compose file, which would have broken the public Traefik-facing route even though localhost access still worked

Resolution:

- updated [backend/Dockerfile](/home/ubuntu/dosh/backend/Dockerfile) to Python 3.12
- aligned the GitHub workflow Python baselines to Python 3.12
- removed the SQLite-incompatible default-dropping step from [2ef0f1a2f1ba_add_auto_expense_settings.py](/home/ubuntu/dosh/backend/alembic/versions/2ef0f1a2f1ba_add_auto_expense_settings.py)
- redeployed through [release_with_migrations.sh](/home/ubuntu/dosh/scripts/release_with_migrations.sh) with `INCLUDE_OVERRIDE=true`

Final result:

- the app now deploys successfully through the override-aware release path
- the live health endpoint continued returning `{"status":"ok","app":"Dosh"}`
- the frontend remained attached to the Traefik-facing external `frontend` network with the expected labels

## Latest Session: Budget-Cycle Export, Export Ordering Validation, Playwright Harness Migration, And Repeated Deployment Verification

Session outcomes verified in this run:

- budget-cycle export is now implemented from the period-detail header with user-selected flat `CSV` and grouped `JSON` download
- the backend period router now exposes a dedicated export endpoint that reuses current period-detail and ledger-backed values so export rows reconcile to the detail page
- flat CSV export now uses the implemented `budget_only`, `transaction`, and `budget_adjustment` row kinds
- flat export ordering was refined so rows with empty `transaction_date` appear first, followed by dated rows in ascending order
- the Playwright harness now migrates a fresh SQLite e2e database with Alembic before backend startup, which resolved the earlier `no such table: paytypes` harness failure
- the existing smoke selectors were refreshed to match current setup wording, and the end-to-end suite now validates the downloaded export output directly
- the Compose stack was redeployed repeatedly after the export implementation and later ordering refinements

### Frontend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
npx jest --runInBand src/__tests__/PeriodDetailPage.test.jsx src/__tests__/client.test.js
npx playwright test e2e/budget-smoke.spec.js
```

Result:

- the focused frontend Jest batch passed with the new export modal and download-helper coverage
- the Playwright smoke suite passed with 5 tests after the harness migration and selector refresh
- the new end-to-end export test now validates the downloaded flat CSV, including `budget_only` rows and the current blank-date-first then ascending-date ordering rule

Files with meaningful frontend updates in this session:

- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)
- [client.js](/home/ubuntu/dosh/frontend/src/api/client.js)
- [PeriodDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/PeriodDetailPage.test.jsx)
- [client.test.js](/home/ubuntu/dosh/frontend/src/__tests__/client.test.js)
- [budget-smoke.spec.js](/home/ubuntu/dosh/frontend/e2e/budget-smoke.spec.js)
- [playwright.config.js](/home/ubuntu/dosh/frontend/playwright.config.js)

### Backend verification

Commands run during this session:

```bash
python3 -m py_compile /home/ubuntu/dosh/backend/app/routers/periods.py /home/ubuntu/dosh/backend/tests/test_period_export.py
```

Attempted but unavailable in this shell environment:

```bash
pytest /home/ubuntu/dosh/backend/tests/test_period_export.py
python3 -m pytest /home/ubuntu/dosh/backend/tests/test_period_export.py
```

Result:

- the new backend export route and focused backend export test file compiled successfully
- direct backend `pytest` execution could not be completed in this shell environment because `pytest` was not installed on the path or as an available Python module
- the exported behavior still received indirect end-to-end validation through the passing Playwright download scenario

Files with meaningful backend updates in this session:

- [periods.py](/home/ubuntu/dosh/backend/app/routers/periods.py)
- [test_period_export.py](/home/ubuntu/dosh/backend/tests/test_period_export.py)

### Playwright harness failure and resolution

Initial failure:

- the first Playwright rerun failed before browser assertions because the backend test server started against a brand-new SQLite file without the baseline schema and hit `sqlite3.OperationalError: no such table: paytypes`
- after that was fixed conceptually, the next run still failed because the previous config referenced `/tmp/dosh-test-venv/bin/alembic`, which did not exist
- once the backend boot path was corrected, the smoke suite still reflected outdated `Primary transaction account` selectors from older UI copy

Resolution:

- updated [playwright.config.js](/home/ubuntu/dosh/frontend/playwright.config.js) to run `../backend/.venv/bin/alembic upgrade head` before backend startup
- switched the config to use the repository backend virtual environment for both Alembic and Uvicorn
- refreshed the smoke selectors in [budget-smoke.spec.js](/home/ubuntu/dosh/frontend/e2e/budget-smoke.spec.js) to match current setup wording

Final result:

- no unresolved Playwright failures remained at the end of the session

### Deployment verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh
docker compose up -d --build
docker compose ps
curl -I http://localhost:3080
docker logs --tail 40 dosh-backend
docker logs --tail 40 dosh-frontend
```

Result:

- the stack rebuilt and restarted successfully after the export implementation and again after the export-ordering refinements
- the frontend responded with `HTTP/1.1 200 OK` on `http://localhost:3080`
- backend logs showed normal startup with Uvicorn listening on port `80`

## Latest Session: GitHub Release Automation, GitHub-Backed Release Info, And Version Alignment

Session outcomes verified in this run:

- the repository now has a push-to-`main` workflow that validates version alignment and creates official release tags
- the repository now has a tag-triggered workflow that creates or updates GitHub Releases from validated repo release content
- the backend `/api/release-notes` implementation now reads published GitHub Releases with safe fallback behavior for private-repo auth gaps or GitHub API failures
- the release baseline was bumped from `0.1.2-alpha` to `0.1.3-alpha`
- the release-management docs now include a high-level operator runbook and private-repo override-token guidance
- the stack was redeployed successfully with the new runtime path, and the live release-notes endpoint safely returned an empty published-release payload because `v0.1.3-alpha` has not yet been published to GitHub
- after the first manual GitHub Release backfill for `v0.1.3-alpha`, the live release-notes endpoint returned a populated `current_release` from GitHub as intended

### Backend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
../backend/.venv/bin/python -m pytest tests/test_release_notes.py tests/test_app_smoke.py
```

Result:

- the focused backend verification passed after the GitHub-backed release-notes implementation replaced the old file-based runtime source
- the parser and payload suite now protects GitHub release-body parsing plus safe fallback behavior

### Frontend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --runInBand src/__tests__/Layout.test.jsx
```

Result:

- the focused layout regression passed after the visible app-version baseline moved to `v0.1.3-alpha`
- no frontend contract changes were required beyond the version touchpoint update

### Workflow and tooling verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh
python scripts/release_management.py validate --ref HEAD --require-release-entry
python scripts/release_management.py release-body --ref HEAD --version 0.1.3-alpha
```

Result:

- the shared validation script confirmed the required version touchpoints aligned at `0.1.3-alpha`
- the release-body renderer produced publishable GitHub Release content from the repo-managed release entry
- the first remote workflow exercise also clarified that tags pushed with the repository `GITHUB_TOKEN` do not trigger a second workflow run, so release publication was moved into the same post-merge workflow and the separate tag workflow was retained only as a manual repair path

### Deployment verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true ./scripts/release_with_migrations.sh
curl -sS http://127.0.0.1:3080/api/health
curl -sS http://127.0.0.1:3080/api/info
curl -sS http://127.0.0.1:3080/api/release-notes
docker compose -f docker-compose.yml -f docker-compose.override.yml exec backend sh -lc 'echo "${GITHUB_RELEASES_TOKEN:+set}"'
```

Result:

- the stack rebuilt and restarted successfully on `0.1.3-alpha`
- the live health endpoint returned `{\"status\":\"ok\",\"app\":\"Dosh\"}`
- the live info endpoint returned `0.1.3-alpha`
- the runtime backend token was present in the container
- before the first GitHub Release existed, the live release-notes endpoint returned a safe empty published-release payload with `current_release: null`
- after the `v0.1.3-alpha` GitHub Release was published, the live release-notes endpoint returned the expected `current_release` payload from GitHub

### Remote release verification

Manual outcomes confirmed after the initial sync:

- `main` branch protection was added with the `SonarQube` required check
- the `v0.1.3-alpha` Git tag exists remotely
- the first GitHub Release for `v0.1.3-alpha` was published successfully
- the live `/api/release-notes` endpoint now resolves the running release from the published GitHub Release

## Latest Session: Previous Release Visibility, Release Workflow Planning, And Deployment Verification

Session outcomes verified in this run:

- the backend release-notes payload now includes previous released versions in addition to the running release and any newer updates
- the in-app release-notes modal now offers a `View previous releases` option so older released versions can be revealed on demand
- the release baseline was bumped from `0.1.1-alpha` to `0.1.2-alpha` as a small backward-compatible user-facing enhancement
- a GitHub-centered release-tagging workflow plan was documented for future work, but no GitHub release automation was implemented in this session
- the app was redeployed successfully after the release-notes enhancement and version alignment

### Backend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
../backend/.venv/bin/python -m pytest tests/test_release_notes.py tests/test_app_smoke.py
```

Result:

- the focused backend verification passed with 15 tests
- the parser-focused suite now also protects the previous-releases payload shape
- the backend verification still emits the existing FastAPI `on_event` and `datetime.utcnow()` deprecation warnings, which remain follow-up cleanup rather than session regressions

Files with meaningful backend updates in this session:

- [release_notes.py](/home/ubuntu/dosh/backend/app/release_notes.py)
- [schemas.py](/home/ubuntu/dosh/backend/app/schemas.py)
- [version.py](/home/ubuntu/dosh/backend/app/version.py)
- [test_release_notes.py](/home/ubuntu/dosh/backend/tests/test_release_notes.py)
- [test_app_smoke.py](/home/ubuntu/dosh/backend/tests/test_app_smoke.py)

### Frontend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --runInBand src/__tests__/Layout.test.jsx
```

Result:

- the focused layout regression passed with 7 tests after the previous-releases modal interaction was added and the visible version baseline moved to `v0.1.2-alpha`

Files with meaningful frontend updates in this session:

- [ReleaseNotesModal.jsx](/home/ubuntu/dosh/frontend/src/components/ReleaseNotesModal.jsx)
- [Layout.jsx](/home/ubuntu/dosh/frontend/src/components/Layout.jsx)
- [Layout.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/Layout.test.jsx)
- [package.json](/home/ubuntu/dosh/frontend/package.json)
- [package-lock.json](/home/ubuntu/dosh/frontend/package-lock.json)

### Deployment verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true ./scripts/release_with_migrations.sh
curl -sS http://127.0.0.1:3080/api/health
curl -sS http://127.0.0.1:3080/api/release-notes
```

Result:

- the stack rebuilt and restarted successfully after the release-notes enhancement
- the live health endpoint returned `{\"status\":\"ok\",\"app\":\"Dosh\"}`
- the live release-notes endpoint returned `0.1.2-alpha` as the current version and included the new `previous_release_count` plus `previous_releases` fields

### Test failures and resolution notes

- no unresolved automated test failures remained at the end of the session
- no additional plan document was required because this session did not run in a separate plan-only mode, but a normal implementation plan was added for future GitHub release workflow work

## Latest Session: Release-Notes Parser Hardening, Patch Release Alignment, And Deployment Verification

Session outcomes verified in this run:

- the backend release-notes parser no longer uses a regex-based entry-header path in the runtime `/api/release-notes` flow
- dedicated backend regression coverage now protects release-note header parsing, summary and section extraction, prerelease ordering, and unreleased-entry filtering
- the release baseline was bumped from `0.1.0-alpha` to `0.1.1-alpha` as a backward-compatible security hardening patch
- the app-facing release notes and bundled backend release-notes copy were aligned to the new patch release
- the stack was redeployed successfully after the parser hardening and version-alignment pass

### Backend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
../backend/.venv/bin/python -m pytest tests/test_release_notes.py tests/test_app_smoke.py
```

Result:

- the focused backend verification passed with 15 tests
- the new parser-focused suite passed alongside the existing release-notes smoke coverage
- the backend verification still emits the previously known FastAPI `on_event` and `datetime.utcnow()` deprecation warnings, which remain follow-up cleanup rather than session regressions

Files with meaningful backend updates in this session:

- [release_notes.py](/home/ubuntu/dosh/backend/app/release_notes.py)
- [version.py](/home/ubuntu/dosh/backend/app/version.py)
- [test_release_notes.py](/home/ubuntu/dosh/backend/tests/test_release_notes.py)
- [test_app_smoke.py](/home/ubuntu/dosh/backend/tests/test_app_smoke.py)

### Frontend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --runInBand src/__tests__/Layout.test.jsx
```

Result:

- the focused layout regression passed after the visible app-version baseline moved to `v0.1.1-alpha`
- no additional frontend behavior changes were required beyond version-alignment touchpoints

Files with meaningful frontend updates in this session:

- [Layout.jsx](/home/ubuntu/dosh/frontend/src/components/Layout.jsx)
- [Layout.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/Layout.test.jsx)
- [package.json](/home/ubuntu/dosh/frontend/package.json)
- [package-lock.json](/home/ubuntu/dosh/frontend/package-lock.json)

### Deployment verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh
./scripts/release_with_migrations.sh
curl -sS http://127.0.0.1:3080/api/health
curl -sS http://127.0.0.1:3080/api/release-notes
```

Result:

- the shared Compose release script rebuilt the backend and frontend images, performed the migration/bootstrap step, and restarted both containers successfully
- the live health endpoint returned `{\"status\":\"ok\",\"app\":\"Dosh\"}`
- the live release-notes endpoint returned the expected `0.1.1-alpha` payload after deployment

### Test failures and resolution notes

- no unresolved automated test failures remained at the end of the session
- no additional plan document was required because this session did not run in a separate plan-only mode

## Latest Session: Release Management Foundation, In-App Release Notes, Frontend Bundle Cleanup, And Deployment Verification

Session outcomes verified in this run:

- Dosh now has a canonical runtime app version of `0.1.0-alpha`, displayed in the UI as `v0.1.0-alpha`
- the backend now exposes runtime release metadata through `/api/info`, including the current schema revision
- Alembic was introduced as the managed schema migration path, with a baseline revision representing the current aligned schema and a Compose-friendly release script that handles backup, migration or baseline stamping, and restart
- the legacy `AppInfo` database version row was removed so runtime versioning no longer depends on mutable database content
- the app now has repo-managed in-app release notes sourced from [RELEASE_NOTES.md](/home/ubuntu/dosh/docs/RELEASE_NOTES.md) and exposed through `/api/release-notes`
- the sidebar version label now opens release notes for the running version and can indicate newer released-but-unapplied updates when such entries exist
- the frontend Vite dependency was patched to `6.4.2`, clearing the previously reported `npm audit` high-severity issue
- major frontend pages now lazy-load from [App.jsx](/home/ubuntu/dosh/frontend/src/App.jsx), reducing the main bundle from the earlier `535.72 kB` warning state to roughly `304 kB` minified in the final build
- the stack was redeployed successfully after the release-management foundation, version-display, frontend bundle, and in-app release-notes changes

### Backend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
DATABASE_URL=sqlite:////tmp/dosh-migrate-verify.sqlite3 ./.venv/bin/alembic upgrade head
./.venv/bin/python -m pytest tests/test_app_smoke.py
./.venv/bin/python - <<'PY'
from app.release_notes import release_notes_payload
print(release_notes_payload())
PY
```

Result:

- the Alembic baseline migration applied successfully to a fresh SQLite database
- the focused backend smoke batch passed with 10 tests after the versioning and release-notes endpoints were introduced
- the local release-notes payload check confirmed the current-version release data was parsed correctly from the managed Markdown source
- backend verification still emits the known FastAPI `on_event` and `datetime.utcnow()` deprecation warnings, which remain follow-up cleanup rather than session regressions

Files with meaningful backend updates in this session:

- [main.py](/home/ubuntu/dosh/backend/app/main.py)
- [version.py](/home/ubuntu/dosh/backend/app/version.py)
- [release_notes.py](/home/ubuntu/dosh/backend/app/release_notes.py)
- [models.py](/home/ubuntu/dosh/backend/app/models.py)
- [schemas.py](/home/ubuntu/dosh/backend/app/schemas.py)
- [test_app_smoke.py](/home/ubuntu/dosh/backend/tests/test_app_smoke.py)
- [alembic.ini](/home/ubuntu/dosh/backend/alembic.ini)
- [env.py](/home/ubuntu/dosh/backend/alembic/env.py)
- [abfa823847b9_baseline_current_schema.py](/home/ubuntu/dosh/backend/alembic/versions/abfa823847b9_baseline_current_schema.py)

### Frontend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --runInBand src/__tests__/Layout.test.jsx
npm audit --json
npm run build
```

Result:

- the focused layout regression batch passed with 6 tests after the runtime version display, version-label placement, and release-notes modal work
- `npm audit` returned zero vulnerabilities after upgrading Vite to `6.4.2`
- the production build passed after route-level lazy loading was introduced
- the final Vite build no longer produced the previous oversized-main-chunk warning; the main entry chunk landed at about `303.79 kB` minified and `96.79 kB` gzip in the final verified build

Files with meaningful frontend updates in this session:

- [App.jsx](/home/ubuntu/dosh/frontend/src/App.jsx)
- [Layout.jsx](/home/ubuntu/dosh/frontend/src/components/Layout.jsx)
- [ReleaseNotesModal.jsx](/home/ubuntu/dosh/frontend/src/components/ReleaseNotesModal.jsx)
- [client.js](/home/ubuntu/dosh/frontend/src/api/client.js)
- [Layout.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/Layout.test.jsx)
- [package.json](/home/ubuntu/dosh/frontend/package.json)
- [package-lock.json](/home/ubuntu/dosh/frontend/package-lock.json)

### Deployment verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true ./scripts/release_with_migrations.sh
curl -sS http://127.0.0.1:3080/api/health
curl -sS http://127.0.0.1:3080/api/info
curl -sS http://127.0.0.1:3080/api/release-notes
```

Result:

- the first deployment under the new release model stamped the existing aligned SQLite database to the Alembic baseline revision instead of trying to replay historical schema changes
- the final deployed app reported `{\"app\":\"Dosh\",\"version\":\"0.1.0-alpha\",\"schema_revision\":\"abfa823847b9\"}` from `/api/info`
- the live health endpoint returned `{\"status\":\"ok\",\"app\":\"Dosh\"}`
- the final `/api/release-notes` call returned the expected current release-notes payload from the managed repo content

### Test failures and resolution notes

- the first backend smoke rerun failed because the tests still monkeypatched `main.engine` after a local cleanup removed that attribute; reintroducing the module-level engine import restored the expected test seam
- the first version-label layout regression assumed both expanded and collapsed labels were visible at once; the test was corrected to verify each state explicitly
- the first deployed `/api/release-notes` call failed because the backend container did not include the repo `docs/` path; a runtime-safe bundled copy at [backend/release_notes/RELEASE_NOTES.md](/home/ubuntu/dosh/backend/release_notes/RELEASE_NOTES.md) and a fallback path check in [release_notes.py](/home/ubuntu/dosh/backend/app/release_notes.py) resolved the issue
- no unresolved automated test failures remained at the end of the session
- no additional plan document was required because this session did not run in a separate plan-only mode

## Latest Session: Budget-Setup Protection, Income-Source Cleanup, Period-Detail Rollups, And Deployment Verification

Session outcomes verified in this run:

- budget setup now guards the active primary transaction-account requirement more directly, including first-account defaults, primary-switch confirmation, and protection against edit or delete paths that would leave no active primary account
- account opening balances now become read-only once downstream budget-cycle usage exists, with regression coverage for the protected edit behavior
- setup wording now uses `Income Source` across the touched setup surfaces
- the legacy income `isfixed` behavior was removed from frontend, backend, factories, smoke coverage, and focused regressions; generated cycles now use the current stored income-source amount directly whenever the source is auto-included
- period-detail remaining-expense and remaining-investment totals now roll up from the same lowest-level positive-remaining logic
- `Surplus (Budget)` now uses a line-level mixed model that preserves the `-30` current-period case while also returning the correct planned result for untouched future periods
- expense and investment `View transactions` actions now open read-only details modals, and transaction quick-fill wording now uses `Add Remaining` only when a real positive remaining amount exists
- all accepted changes were deployed through the shared Docker Compose path, and the live health endpoint returned `{\"status\":\"ok\",\"app\":\"Dosh\"}` after each final rollout

### Backend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
../backend/.venv/bin/python -m pytest tests/test_budget_setup_workflows.py
../backend/.venv/bin/python -m pytest tests/test_budget_setup_workflows.py tests/test_app_smoke.py
```

Result:

- the focused budget-setup regression batch passed after the account-protection, primary-account, and opening-balance changes
- the focused backend income-source cleanup and smoke batch passed after removing `isfixed` from the model and generation logic
- backend startup now performs a one-time compatibility drop of the legacy `incometypes.isfixed` column when present, but this session did not introduce a full migration framework

Files with meaningful backend updates in this session:

- [models.py](/home/ubuntu/dosh/backend/app/models.py)
- [schemas.py](/home/ubuntu/dosh/backend/app/schemas.py)
- [main.py](/home/ubuntu/dosh/backend/app/main.py)
- [balance_types.py](/home/ubuntu/dosh/backend/app/routers/balance_types.py)
- [income_types.py](/home/ubuntu/dosh/backend/app/routers/income_types.py)
- [periods.py](/home/ubuntu/dosh/backend/app/routers/periods.py)
- [cycle_management.py](/home/ubuntu/dosh/backend/app/cycle_management.py)
- [setup_history.py](/home/ubuntu/dosh/backend/app/setup_history.py)
- [test_budget_setup_workflows.py](/home/ubuntu/dosh/backend/tests/test_budget_setup_workflows.py)
- [test_app_smoke.py](/home/ubuntu/dosh/backend/tests/test_app_smoke.py)

### Frontend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --runInBand src/__tests__/BalanceTypesTab.test.jsx src/__tests__/IncomeTypesTab.test.jsx src/__tests__/ExpenseItemsTab.test.jsx src/__tests__/PeriodDetailPage.test.jsx
npm test -- --runInBand src/__tests__/BudgetDetailPage.test.jsx
npm test -- --runInBand src/__tests__/IncomeTypesTab.test.jsx src/__tests__/PeriodDetailPage.test.jsx src/__tests__/BudgetDetailPage.test.jsx src/__tests__/BudgetPeriodsPage.test.jsx src/__tests__/BudgetsPage.test.jsx src/__tests__/Layout.test.jsx
npm test -- --runInBand src/__tests__/PeriodDetailPage.test.jsx
npm test -- --runInBand src/__tests__/BalanceTypesTab.test.jsx
npm test -- --runInBand src/__tests__/PeriodDetailPage.test.jsx
```

Result:

- the focused setup and period-detail frontend regressions passed after the initial remediation changes
- the setup-page heading change from `Income Types` to `Income Sources` passed in its focused regression rerun
- the income-source cleanup batch passed after removing `Fixed amount` from the product-facing setup and period-detail flows
- the later focused reruns for period-detail summary logic, read-only details modals, inline status-filter placement, and `Add Remaining` transaction-entry behavior all passed
- the final focused rerun passed after tightening `Surplus (Budget)` so it handles both mixed-actual current periods and untouched future periods correctly

Files with meaningful frontend updates in this session:

- [BalanceTypesTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/BalanceTypesTab.jsx)
- [IncomeTypesTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/IncomeTypesTab.jsx)
- [ExpenseItemsTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/ExpenseItemsTab.jsx)
- [BudgetDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetDetailPage.jsx)
- [BudgetsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetsPage.jsx)
- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)
- [SetupItemHistoryModal.jsx](/home/ubuntu/dosh/frontend/src/components/SetupItemHistoryModal.jsx)
- [BalanceTypesTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BalanceTypesTab.test.jsx)
- [IncomeTypesTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/IncomeTypesTab.test.jsx)
- [ExpenseItemsTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/ExpenseItemsTab.test.jsx)
- [BudgetDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetDetailPage.test.jsx)
- [BudgetPeriodsPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetPeriodsPage.test.jsx)
- [BudgetsPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetsPage.test.jsx)
- [Layout.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/Layout.test.jsx)
- [PeriodDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/PeriodDetailPage.test.jsx)
- [budget-smoke.spec.js](/home/ubuntu/dosh/frontend/e2e/budget-smoke.spec.js)

### Deployment verification

Commands run during this session:

```bash
docker compose -f /home/ubuntu/dosh/docker-compose.yml -f /home/ubuntu/dosh/docker-compose.override.yml up -d --build
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- the stack was rebuilt and redeployed repeatedly as accepted fixes landed
- final health verification returned `{\"status\":\"ok\",\"app\":\"Dosh\"}`

### Test failures and resolution notes

- no unresolved automated test failures remained at the end of the session
- the first attempt at the future-period `Surplus (Budget)` fix applied the same contribution rule to both income and outflow lines, which broke the existing mixed-actual `-30` case; the final fix split income and outflow contribution rules and the focused rerun passed
- the future-period surplus assertion also needed a card-scoped matcher because `$0.00` appears in several places on the page; the final regression now asserts against the `Surplus (Budget)` card specifically
- no additional plan document was required because this session did not run in a separate plan-only mode

## Latest Session: Sonar Coverage Recovery, Medium-Issue Cleanup Verification, And CI Compatibility Resolution

Session outcomes verified in this run:

- the latest failed SonarQube artifact showed `new_coverage` at `79.5`, confirming the project was sitting too close to the `80` gate threshold to absorb routine feature edits comfortably
- focused behavior-first coverage was added in the undercovered touched areas rather than by adding metric-only tests
- the follow-up workflow returned green, and the latest successful Sonar artifact showed `new_coverage` at `81.5`
- the latest successful artifact was then used to identify the remaining `MAJOR` issue clusters, which were concentrated in [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx), [BudgetsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetsPage.jsx), [BudgetPeriodsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetPeriodsPage.jsx), and small shared-component or backend-ledger helpers
- a single cleanup pass was applied across those files, and focused frontend and backend verification passed locally
- the first version of the backend ledger cleanup introduced `@dataclass(slots=True)`, which failed in CI during import; the helper was corrected to plain `@dataclass`, and the backend verification reran successfully

### Sonar artifact verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh
gh run list --workflow SonarQube --limit 5 --json databaseId,headSha,headBranch,status,conclusion,createdAt,updatedAt,displayTitle
gh api repos/mixednutts/dosh/actions/runs/24058415746/artifacts
gh run download 24058415746 -n sonar-summary-24058415746 -D /tmp/dosh-sonar-artifact/run-24058415746
jq '[.issues[] | select(.severity=="MAJOR")] | length' /tmp/dosh-sonar-artifact/run-24058415746/sonar-issues-full.json
```

Result:

- the latest successful run was `24058415746`
- the latest successful artifact showed the gate green and left `56` medium (`MAJOR`) issues concentrated mostly in the main period and budget pages
- the medium issue distribution confirmed that a grouped cleanup pass was a better next step than another scattered low-yield Sonar sweep

### Frontend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --runInBand src/__tests__/ExpenseItemsTab.test.jsx src/__tests__/BudgetPeriodsPage.test.jsx src/__tests__/BudgetDetailPage.test.jsx
npm test -- --runInBand --coverage --collectCoverageFrom=src/pages/tabs/ExpenseItemsTab.jsx --collectCoverageFrom=src/pages/BudgetPeriodsPage.jsx --collectCoverageFrom=src/pages/BudgetDetailPage.jsx src/__tests__/ExpenseItemsTab.test.jsx src/__tests__/BudgetPeriodsPage.test.jsx src/__tests__/BudgetDetailPage.test.jsx
npm test -- --runInBand src/__tests__/BudgetsPage.test.jsx src/__tests__/BudgetPeriodsPage.test.jsx src/__tests__/PeriodDetailPage.test.jsx src/__tests__/AmountCell.test.jsx src/__tests__/InvestmentItemsTab.test.jsx
```

Result:

- the focused coverage-lift batch passed with 3 suites and 23 tests
- the focused coverage spot check reported:
  - [BudgetDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetDetailPage.jsx) at `85.47%` lines
  - [BudgetPeriodsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetPeriodsPage.jsx) at `94.11%` lines
  - [ExpenseItemsTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/ExpenseItemsTab.jsx) at `91.07%` lines
- the focused Sonar-cleanup frontend batch then passed with 5 suites and 50 tests

Files with meaningful frontend test or cleanup updates in this session:

- [ExpenseItemsTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/ExpenseItemsTab.test.jsx)
- [BudgetPeriodsPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetPeriodsPage.test.jsx)
- [BudgetDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetDetailPage.test.jsx)
- [BudgetsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetsPage.jsx)
- [BudgetPeriodsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetPeriodsPage.jsx)
- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)
- [Layout.jsx](/home/ubuntu/dosh/frontend/src/components/Layout.jsx)
- [AmountCell.jsx](/home/ubuntu/dosh/frontend/src/components/AmountCell.jsx)
- [SetupItemHistoryModal.jsx](/home/ubuntu/dosh/frontend/src/components/SetupItemHistoryModal.jsx)
- [InvestmentItemsTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/InvestmentItemsTab.jsx)

### Backend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh
backend/.venv/bin/python -m pytest backend/tests/test_setup_assessment.py backend/tests/test_budget_schema_validation.py
cd /home/ubuntu/dosh/backend
../backend/.venv/bin/python -m pytest tests/test_delete_continuity.py tests/test_budget_setup_workflows.py tests/test_period_logic.py tests/test_app_smoke.py
```

Result:

- the focused setup-assessment and schema-validation batch passed with 20 tests
- the focused backend cleanup and continuity batch passed with 29 tests
- the rerun after removing `slots=True` from the dataclass also passed with the same 29 tests
- backend verification still emits the known FastAPI `on_event` and `datetime.utcnow()` deprecation warnings, which remain follow-up cleanup rather than session regressions

Files with meaningful backend updates in this session:

- [test_setup_assessment.py](/home/ubuntu/dosh/backend/tests/test_setup_assessment.py)
- [test_budget_schema_validation.py](/home/ubuntu/dosh/backend/tests/test_budget_schema_validation.py)
- [transaction_ledger.py](/home/ubuntu/dosh/backend/app/transaction_ledger.py)
- [periods.py](/home/ubuntu/dosh/backend/app/routers/periods.py)
- [demo_budget.py](/home/ubuntu/dosh/backend/app/demo_budget.py)
- [test_delete_continuity.py](/home/ubuntu/dosh/backend/tests/test_delete_continuity.py)

### Test failures and resolution notes

- the first local coverage spot check showed that [ExpenseItemsTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/ExpenseItemsTab.jsx) still needed one more meaningful scenario, so a next-due and delete-confirmation path was added before the final rerun
- the first medium-issue backend refactor used `@dataclass(slots=True)` in [transaction_ledger.py](/home/ubuntu/dosh/backend/app/transaction_ledger.py); the GitHub Actions workflow failed during import because the runner Python version rejected that keyword argument, so the helper was changed to plain `@dataclass`
- no automated test failures remained at the end of the session after the compatibility fix
- no additional plan document was required because this session did not run in a separate plan-only mode

## Latest Session: Final Sonar Medium-Issue Cleanup Verification

Session outcomes verified in this run:

- the latest successful SonarQube artifact was re-pulled and the exact remaining `MAJOR` issue list was confirmed directly from the artifact rather than inferred from earlier summaries
- the actual remaining medium issues were limited to 8 findings across [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx), [BalanceTypesTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/BalanceTypesTab.jsx), [ExpenseItemsTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/ExpenseItemsTab.jsx), and [budget_health.py](/home/ubuntu/dosh/backend/app/budget_health.py)
- the frontend cleanup batch passed after the helper extraction and render-structure changes
- the backend cleanup batch also passed after the budget-health timing-factor logic was preserved through a helper-based refactor
- a fresh Sonar workflow is still required to confirm the remote issue count falls as expected after these local changes

### Sonar artifact verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh
gh run list --workflow SonarQube --limit 5 --json databaseId,headSha,headBranch,status,conclusion,createdAt,updatedAt,displayTitle
gh run download 24059573777 -n sonar-summary-24059573777 -D /tmp/dosh-sonar-artifact/run-24059573777
jq '[.issues[] | select(.severity=="MAJOR")] | length' /tmp/dosh-sonar-artifact/run-24059573777/sonar-issues-full.json
```

Result:

- the latest successful Sonar run inspected in this session was `24059573777`
- the downloaded artifact confirmed that `8` medium (`MAJOR`) issues remained at the start of this cleanup pass
- those issues were concentrated enough to address in one local pass without a broader refactor campaign

### Frontend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --runInBand src/__tests__/PeriodDetailPage.test.jsx src/__tests__/BalanceTypesTab.test.jsx src/__tests__/ExpenseItemsTab.test.jsx
```

Result:

- the focused frontend cleanup batch passed with 3 suites and 33 tests
- the passing frontend run gives direct regression coverage for the files where the remaining Sonar issues were cleared

Files with meaningful frontend updates in this session:

- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)
- [BalanceTypesTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/BalanceTypesTab.jsx)
- [ExpenseItemsTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/ExpenseItemsTab.jsx)

### Backend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
../backend/.venv/bin/python -m pytest tests/test_app_smoke.py tests/test_delete_continuity.py tests/test_period_logic.py
```

Result:

- the focused backend cleanup batch passed with 14 tests
- the first rerun in this session exposed a `NameError` after an over-aggressive local cleanup removed the live `timing_factor` input from [budget_health.py](/home/ubuntu/dosh/backend/app/budget_health.py)
- that regression was resolved by extracting the timing-factor calculation into a helper while preserving the original scoring path, and the rerun then passed

Files with meaningful backend updates in this session:

- [budget_health.py](/home/ubuntu/dosh/backend/app/budget_health.py)

### Test failures and resolution notes

- the first backend attempt to satisfy the Sonar unused-assignment rule removed the `timing_factor` value entirely, which caused a local `NameError` during the smoke-path budget-health calculation
- the final fix restored the live scoring input through a dedicated helper instead of deleting the value
- no automated test failures remained at the end of the session
- no additional plan document was required because this session did not run in a separate plan-only mode

## Latest Session: Create-Budget Walkthrough Hardening, Setup-Copy Localisation, And Repeated Deployment Verification

Session outcomes verified in this run:

- the create-budget modal now includes lighter walkthrough guidance plus an expandable `More about Budgets and Budget Cycles` help surface instead of a permanently expanded onboarding block
- Dosh now supports custom budget cycles in the create-budget flow using `Every N Days`, and period-end generation logic now supports those fixed-length cycles in the backend
- the custom day-cycle field was corrected after an interaction bug where entering `10` could be forced through `2` and then become `20`; it now accepts normal typing and only clamps to the valid range on blur
- budget setup helper copy and setup-assessment wording were refreshed to be more supportive, and setup-page account terminology now respects the budget’s preferred account naming instead of always rendering `transaction`
- the budget-setup income-type edit flow now supports renaming an income line when it is not already in downstream use
- the account setup table header alignment was refined, and the create-budget helper-link spacing and visual treatment were iterated several times before the final deployed state
- focused frontend and backend regression checks passed, the Playwright walkthrough smoke suite passed, and the stack was redeployed successfully after each meaningful iteration

### Frontend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --runInBand BudgetsPage.test.jsx BudgetDetailPage.test.jsx BudgetPeriodsPage.test.jsx BalanceTypesTab.test.jsx IncomeTypesTab.test.jsx
npm test -- --runInBand BudgetsPage.test.jsx
npm test -- --runInBand BudgetDetailPage.test.jsx
npm run test:e2e -- budget-smoke.spec.js
```

Result:

- the focused create-budget and setup-related Jest batch passed with 5 suites and 32 tests
- the create-budget suite was rerun repeatedly as copy, spacing, and input-behavior changes were refined, and it finished passing with 7 tests
- the focused budget-setup suite passed after the helper copy and account-naming localisation changes
- the Playwright smoke run passed with 4 tests, covering create budget, minimum setup, first-cycle generation, expense activity, and close-out into the next active cycle

Files with meaningful frontend updates in this session:

- [BudgetsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetsPage.jsx)
- [BudgetDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetDetailPage.jsx)
- [BalanceTypesTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/BalanceTypesTab.jsx)
- [BudgetsPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetsPage.test.jsx)
- [BudgetDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetDetailPage.test.jsx)
- [BudgetPeriodsPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetPeriodsPage.test.jsx)
- [IncomeTypesTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/IncomeTypesTab.test.jsx)
- [budget-smoke.spec.js](/home/ubuntu/dosh/frontend/e2e/budget-smoke.spec.js)

### Backend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
./.venv/bin/python -m pytest /home/ubuntu/dosh/backend/tests/test_period_logic.py /home/ubuntu/dosh/backend/tests/test_app_smoke.py /home/ubuntu/dosh/backend/tests/test_budget_setup_workflows.py /home/ubuntu/dosh/backend/tests/test_setup_assessment.py
```

Result:

- the focused backend batch passed with 35 tests
- backend verification confirmed custom day-cycle support, the income-type rename fix, and setup-assessment behavior after the copy changes
- the backend run still emitted the known FastAPI `on_event` and `datetime.utcnow()` deprecation warnings, which remain follow-up cleanup rather than new regressions

Files with meaningful backend updates in this session:

- [period_logic.py](/home/ubuntu/dosh/backend/app/period_logic.py)
- [schemas.py](/home/ubuntu/dosh/backend/app/schemas.py)
- [setup_assessment.py](/home/ubuntu/dosh/backend/app/setup_assessment.py)
- [income_types.py](/home/ubuntu/dosh/backend/app/routers/income_types.py)
- [test_period_logic.py](/home/ubuntu/dosh/backend/tests/test_period_logic.py)
- [test_app_smoke.py](/home/ubuntu/dosh/backend/tests/test_app_smoke.py)
- [test_budget_setup_workflows.py](/home/ubuntu/dosh/backend/tests/test_budget_setup_workflows.py)
- [test_setup_assessment.py](/home/ubuntu/dosh/backend/tests/test_setup_assessment.py)

### Deployment verification

Commands run during this session:

```bash
docker compose -f /home/ubuntu/dosh/docker-compose.yml -f /home/ubuntu/dosh/docker-compose.override.yml up -d --build
docker compose -f /home/ubuntu/dosh/docker-compose.yml -f /home/ubuntu/dosh/docker-compose.override.yml ps
curl -fsS http://localhost:3080/api/health
curl -fsS http://localhost:3080 | head -n 5
```

Result:

- backend and frontend containers rebuilt and restarted successfully through the override-aware compose path after each deployment iteration
- the live health endpoint consistently returned `{"status":"ok","app":"Dosh"}`
- the served root HTML remained reachable after each rollout

### Test failures and resolution notes

- the first version of the new setup-copy backend test expectations still assumed the old primary-account wording; the assertion was updated to the new localized transaction-account text
- the first version of the custom day-cycle frontend test asserted directly against the React Query mutation wrapper rather than the mutation payload, so it was corrected to inspect the first call argument
- the first version of the custom day-cycle input behavior clamped on every keystroke, which made entering `10` jump through `2` and then become `20`; the input was reworked to accept normal typing and clamp only on blur
- several create-budget spacing and presentation refinements required repeated focused frontend reruns, but no automated test failures remained at the end of the session
- no additional plan document was required because this session did not run in a separate plan-only mode

## Latest Session: Budget Deletion Foreign-Key Fix And Deployment Verification

Session outcomes verified in this run:

- deleting a budget no longer fails when setup revision history exists for that budget
- [Budget](/home/ubuntu/dosh/backend/app/models.py) now owns [SetupRevisionEvent](/home/ubuntu/dosh/backend/app/models.py) rows through an explicit cascading relationship so budget deletion removes setup-history children safely
- backend regression coverage now includes deleting a budget after a direct setup revision has been recorded
- the stack was rebuilt and redeployed successfully after the fix, and the live health endpoint remained healthy

### Backend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh
./backend/.venv/bin/pytest -q backend/tests/test_app_smoke.py -k 'budget_can_be_deleted_after_setup_revision_history_exists or budget_account_naming_preference_can_be_saved'
./backend/.venv/bin/pytest -q backend/tests/test_budget_adjustments.py -k 'setup_amount_change_creates_setup_revision_history_event or history_merges_setup_revision_events_with_budget_adjustments'
```

Result:

- the focused budget-delete regression check passed with 2 selected tests
- the focused setup-history regression check passed with 3 selected tests
- the targeted verification confirmed both the delete-path fix and that setup-history behavior still works after the model relationship change
- plain `pytest` remained unavailable in the base shell, so the project virtualenv under [backend/.venv](/home/ubuntu/dosh/backend/.venv) remained the correct execution path

### Deployment verification

Commands run during this session:

```bash
docker compose -f /home/ubuntu/dosh/docker-compose.yml -f /home/ubuntu/dosh/docker-compose.override.yml up -d --build
docker compose -f /home/ubuntu/dosh/docker-compose.yml -f /home/ubuntu/dosh/docker-compose.override.yml ps
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- backend and frontend images rebuilt successfully
- both containers restarted successfully through the override-aware compose path
- the live health endpoint returned `{"status":"ok","app":"Dosh"}`

### Test failures and resolution notes

- the first version of the new delete-budget regression test failed after the API delete succeeded because the test tried to read the deleted ORM instance after session expiration; the test was corrected to capture the integer `budgetid` before deletion and then assert against fresh session lookups instead
- no automated test failures remained at the end of the session
- no additional plan document was required because this session did not run in a separate plan-only mode

## Latest Session: Sonar Coverage Follow-Through, New Frontend Regression Suites, Full Suite Verification, And Redeployment

Session outcomes verified in this run:

- the latest downloaded Sonar artifact [sonar-summary-24020210275](/tmp/dosh-sonar-artifact/run-24020210275/sonar-summary-24020210275/sonar-summary.md) confirms that `new_duplicated_lines_density` is no longer a failed quality-gate condition
- the remaining failed SonarQube gate condition is now `new_coverage`, with the largest frontend coverage hotspots reported in [PersonalisationTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/PersonalisationTab.jsx), [Dashboard.jsx](/home/ubuntu/dosh/frontend/src/pages/Dashboard.jsx), [AmountCell.jsx](/home/ubuntu/dosh/frontend/src/components/AmountCell.jsx), and [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)
- dedicated frontend regression suites now exist for [AmountCell.jsx](/home/ubuntu/dosh/frontend/src/components/AmountCell.jsx), [Dashboard.jsx](/home/ubuntu/dosh/frontend/src/pages/Dashboard.jsx), and [PersonalisationTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/PersonalisationTab.jsx)
- the full frontend suite, the full backend suite, and the frontend production build all passed in the final verified state
- the stack was rebuilt and redeployed successfully through the override-aware Docker Compose path after the test and coverage work completed

### Sonar artifact verification

Commands run during this session:

```bash
gh run view 24020210275 --repo mixednutts/dosh --json databaseId,workflowName,headBranch,status,conclusion,createdAt,updatedAt,url,name,displayTitle
gh api repos/mixednutts/dosh/actions/runs/24020210275/artifacts
gh run download 24020210275 --repo mixednutts/dosh -D /tmp/dosh-sonar-artifact/run-24020210275
```

Result:

- run `24020210275` completed on `main` with conclusion `failure`
- the downloaded artifact confirmed that the active failed gate condition is now only `new_coverage`
- file-level duplication hotspots were no longer returned by the Sonar API for new code
- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx) dropped to `2.3182297154899896%` duplicated lines on new code with `22` duplicated lines, which is below the previous gate threshold

### Frontend verification

Commands run during this session:

```bash
cd frontend
npm test -- --runInBand --watchAll=false src/__tests__/AmountCell.test.jsx src/__tests__/Dashboard.test.jsx src/__tests__/PersonalisationTab.test.jsx
npm test -- --runInBand --watchAll=false src/__tests__/AmountCell.test.jsx src/__tests__/Dashboard.test.jsx src/__tests__/PersonalisationTab.test.jsx src/__tests__/PeriodDetailPage.test.jsx
npm test -- --runInBand --watchAll=false
npm run build
```

Result:

- the new focused frontend coverage batch passed with 3 suites and 10 tests
- the expanded focused frontend coverage batch passed with 4 suites and 30 tests
- the full frontend Jest suite passed with 14 suites and 86 tests
- the frontend production build passed after the new regression suites were added
- the Vite build still reports a large post-minification main chunk warning, which remains a performance follow-up rather than a correctness failure

Files with meaningful frontend updates in this session:

- [AmountCell.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/AmountCell.test.jsx)
- [Dashboard.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/Dashboard.test.jsx)
- [PersonalisationTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/PersonalisationTab.test.jsx)

### Backend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
./.venv/bin/python -m pytest
```

Result:

- the full backend suite passed with 63 tests
- plain `pytest` was still unavailable in the base shell, so the project venv remained the correct execution path
- backend warnings still include FastAPI `on_event` deprecation in [main.py](/home/ubuntu/dosh/backend/app/main.py) and `datetime.utcnow()` deprecation in [transaction_ledger.py](/home/ubuntu/dosh/backend/app/transaction_ledger.py)

### Deployment verification

Commands run:

```bash
docker compose -f /home/ubuntu/dosh/docker-compose.yml -f /home/ubuntu/dosh/docker-compose.override.yml up -d --build frontend
docker compose -f /home/ubuntu/dosh/docker-compose.yml -f /home/ubuntu/dosh/docker-compose.override.yml ps
curl -sS http://127.0.0.1:3080/
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- backend and frontend containers rebuilt and restarted successfully through the override-aware compose path
- the first health check briefly raced the backend restart and returned a connection-reset response, but the follow-up check succeeded
- the live health endpoint returned `{"status":"ok","app":"Dosh"}`
- the served root HTML referenced the fresh built assets and still included the favicon and theme-color wiring

### Test failures and resolution notes

- the first version of [Dashboard.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/Dashboard.test.jsx) asserted totals before the nested period-detail query had resolved; the test was corrected to wait for the active-cycle totals to render before asserting the computed values
- no automated test failures remained at the end of the session
- no additional plan document was required because this session did not run in a separate plan-only mode

## Latest Session: Sonar Coverage Hotspot Follow-Through And Behavior-First Regression Expansion

Session outcomes verified in this run:

- focused coverage expansion was added for the three SonarQube hotspot files shown in the current follow-up prompt: [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx), [AmountExpressionInput.jsx](/home/ubuntu/dosh/frontend/src/components/AmountExpressionInput.jsx), and [periods.py](/home/ubuntu/dosh/backend/app/routers/periods.py)
- frontend regression coverage was extended in [AmountExpressionInput.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/AmountExpressionInput.test.jsx) and [PeriodDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/PeriodDetailPage.test.jsx)
- a new backend router-guard suite now exists at [test_period_router_guards.py](/home/ubuntu/dosh/backend/tests/test_period_router_guards.py) for carried-forward removal blocking, delete blockers after recorded activity, and invalid expense or investment status transitions
- the session explicitly reaffirmed the testing rule that SonarQube hotspots should be treated as signals for thin risk areas, not as the definition of quality, and that coverage work should still protect meaningful workflow behavior rather than only executing lines once
- no SonarQube workflow run was executed in this session, so the new tests are locally verified but not yet represented in a fresh CI-generated coverage artifact

### Frontend verification

Commands run during this session:

```bash
cd frontend
npm test -- --runInBand src/__tests__/AmountExpressionInput.test.jsx src/__tests__/PeriodDetailPage.test.jsx
```

Result:

- the focused frontend verification passed with 2 suites and 30 tests
- new frontend coverage in this session includes blank-input, unary-negative, divide-by-zero, and duplicate-notification behavior for [AmountExpressionInput.jsx](/home/ubuntu/dosh/frontend/src/components/AmountExpressionInput.jsx)
- period-detail regression coverage now also includes the balance movement details modal for transfer, expense, and system-supported transaction rendering

### Backend verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh
./backend/.venv/bin/pytest -q backend/tests/test_period_router_guards.py
```

Result:

- the new backend router-guard suite passed with 4 tests
- plain `pytest` was still unavailable in the base shell, so the project virtualenv remained the correct execution path for backend verification
- backend warnings still include the existing FastAPI `on_event` deprecation in [main.py](/home/ubuntu/dosh/backend/app/main.py) and `datetime.utcnow()` deprecation in [transaction_ledger.py](/home/ubuntu/dosh/backend/app/transaction_ledger.py)

### Test failures and resolution notes

- the first version of the new balance-movement frontend test asserted transfer labels too directly against the rendered DOM and failed even though the modal behavior itself was working; the test was tightened to assert stable rendered notes, totals, and system markers instead
- no automated test failures remained at the end of the session
- no additional plan document was required because this session did not run in a separate plan-only mode

## Latest Session: PeriodDetail Sonar Duplication Reduction, Favicon Wiring, And Override-Aware Redeployment

Session outcomes verified in this run:

- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx) now consolidates the repeated transaction-modal summary, transaction-list, transaction-entry, status-pill, and paid-confirmation UI into shared local components to reduce the duplication hotspot behind the failed SonarQube gate
- the period-detail regression baseline still passes after that refactor
- the frontend entry HTML now declares the existing branded [icon.svg](/home/ubuntu/dosh/frontend/public/icon.svg) as the webpage favicon and touch icon so browser tabs and installed shortcuts show app identity correctly
- the stack was rebuilt and redeployed successfully through the override-aware Docker Compose path, and the live served HTML now includes the favicon links
- the SonarQube quality gate itself was not rerun during this session, so the duplication cleanup is locally verified but not yet CI-confirmed

### Frontend verification

Commands run during this session:

```bash
cd frontend
npm test -- --runInBand --watchAll=false src/__tests__/PeriodDetailPage.test.jsx
npm run build
```

Result:

- focused period-detail coverage passed after the duplication-reduction refactor
- 1 frontend suite passed
- 20 focused frontend tests passed in the verified local state
- the frontend production build passed after both the Sonar cleanup and favicon wiring changes
- the Vite build still reports a large post-minification main chunk warning, which remains follow-up performance work rather than a correctness failure

Files with meaningful frontend updates in this session:

- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)
- [index.html](/home/ubuntu/dosh/frontend/index.html)

### Deployment verification

Commands run:

```bash
docker compose -f /home/ubuntu/dosh/docker-compose.yml -f /home/ubuntu/dosh/docker-compose.override.yml up -d --build frontend
docker compose -f /home/ubuntu/dosh/docker-compose.yml -f /home/ubuntu/dosh/docker-compose.override.yml ps
curl -sS http://127.0.0.1:3080/
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- backend and frontend containers rebuilt and restarted successfully through the override-aware compose path
- the live health endpoint returned `{"status":"ok","app":"Dosh"}`
- the served root HTML now includes favicon and touch-icon links for `/icon.svg`
- the frontend remained reachable on port `3080` after deployment

### Test failures and resolution notes

- no automated test failures remained at the end of the session
- no dedicated favicon test file was added because the change is static entry HTML wiring rather than runtime workflow logic
- no fresh SonarQube workflow run was executed in this session, so the remaining quality-gate risk is verification debt rather than a known local regression

## Latest Session: FastAPI Router Sonar Cleanup And Failed-Gate Artifact Verification

Session outcomes verified in this run:

- backend FastAPI routers now use a shared `DbSession` dependency alias and centralized documented error responses
- the backend router cleanup compiled cleanly and passed the full backend test suite
- the SonarQube workflow now exports a usable artifact even when the quality gate fails
- the exported artifact now includes failed gate conditions and file-level metric hotspots for measure-driven failures
- the current failed quality gate is now verifiably tied to duplicated lines on new code in [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)

### Backend verification

Commands run during this session:

```bash
python3 -m compileall /home/ubuntu/dosh/backend/app
cd /home/ubuntu/dosh/backend
./.venv/bin/python -m pytest
```

Result:

- backend modules compiled successfully after the router dependency and response-doc cleanup
- the full backend test suite passed in the final verified state
- 63 backend tests passed

Files with meaningful backend updates in this session:

- [api_docs.py](/home/ubuntu/dosh/backend/app/api_docs.py)
- [budgets.py](/home/ubuntu/dosh/backend/app/routers/budgets.py)
- [investments.py](/home/ubuntu/dosh/backend/app/routers/investments.py)
- [balance_types.py](/home/ubuntu/dosh/backend/app/routers/balance_types.py)
- [expense_items.py](/home/ubuntu/dosh/backend/app/routers/expense_items.py)
- [expense_entries.py](/home/ubuntu/dosh/backend/app/routers/expense_entries.py)
- [income_types.py](/home/ubuntu/dosh/backend/app/routers/income_types.py)
- [income_transactions.py](/home/ubuntu/dosh/backend/app/routers/income_transactions.py)
- [investment_transactions.py](/home/ubuntu/dosh/backend/app/routers/investment_transactions.py)
- [period_transactions.py](/home/ubuntu/dosh/backend/app/routers/period_transactions.py)
- [periods.py](/home/ubuntu/dosh/backend/app/routers/periods.py)

### Workflow and artifact verification

Commands run during this session:

```bash
./scripts/fetch_latest_sonar_artifact.sh main
gh run list --workflow sonarqube.yml --limit 10
gh run download 24018002554 -D /tmp/dosh-sonar-artifact/run-24018002554
gh run download 24018405094 -D /tmp/dosh-sonar-artifact/run-24018405094
gh run download 24018565817 -D /tmp/dosh-sonar-artifact/run-24018565817
gh run download 24018996530 -D /tmp/dosh-sonar-artifact/run-24018996530
```

Result:

- the first failed-run artifact after the workflow hardening change confirmed that artifacts were uploaded even when the quality gate failed
- the next failed-run artifacts exposed a gap where measure-based gate failures were recorded but file-level hotspots were empty
- direct inspection of Sonar API output showed that `new_*` file metrics are returned under `periods[0].value`, not only under top-level `value`
- after correcting the export parser, artifact [sonar-summary-24018996530](/tmp/dosh-sonar-artifact/run-24018996530/sonar-summary-24018996530) successfully reported the failed gate condition and the duplication hotspot file
- the verified hotspot is [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx) with `19.62264150943396%` duplicated lines on new code and `52` duplicated lines

### Test failures and resolution notes

- plain `pytest` was not available in the base shell, but the project venv under [backend/.venv](/home/ubuntu/dosh/backend/.venv) worked and was used for the final backend verification
- the first workflow revision exported failed quality gate conditions but still missed the file-level duplication contributor because the file metrics parser only read top-level `value`
- a second workflow revision changed the file traversal, but the hotspot export still remained empty until the parser was updated to read `periods[0].value`
- no unresolved backend test failures remained at the end of the session
- no unresolved artifact-export failures remained at the end of the session for the verified failed-run case

## Latest Session: Inline Arithmetic Amount Entry, Parser Right-Sizing, Focused Modal Coverage, And Override-Aware Redeployment

Session outcomes verified in this run:

- period-detail amount-entry modals now support inline arithmetic expressions while keeping the raw typed expression visible
- valid arithmetic expressions now show a resolved preview and incomplete arithmetic input now shows an in-progress summary line instead of an immediate validation error
- the final parser choice for this feature is `jsep` plus a narrow arithmetic-only evaluator rather than a deprecated parser package or the heavier `mathjs` dependency
- focused frontend coverage now protects both the shared amount-expression input and the affected period-detail modal workflows
- the stack was rebuilt and redeployed successfully after correcting an initial deploy mistake that bypassed `docker-compose.override.yml`

### Frontend verification

Commands run during this session:

```bash
cd frontend
npm test -- --runInBand --watchAll=false src/__tests__/AmountExpressionInput.test.jsx
npm test -- --runInBand --watchAll=false src/__tests__/PeriodDetailPage.test.jsx
npm test -- --runInBand --watchAll=false src/__tests__/AmountExpressionInput.test.jsx src/__tests__/PeriodDetailPage.test.jsx
npm run build
```

Result:

- focused amount-expression component coverage passed
- focused period-detail coverage passed after the modal integration and the in-progress-summary UX refinement
- the final combined verification result was 2 passing frontend suites and 27 passing focused frontend tests
- the frontend production build passed after the parser swap to `jsep`
- the Vite build still reports a slightly oversized main production chunk, but that remains follow-up performance work rather than a correctness failure

Files with meaningful frontend test or harness updates in this session:

- [AmountExpressionInput.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/AmountExpressionInput.test.jsx)
- [PeriodDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/PeriodDetailPage.test.jsx)
- [AmountExpressionInput.jsx](/home/ubuntu/dosh/frontend/src/components/AmountExpressionInput.jsx)
- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)

### Deployment verification

Commands run:

```bash
docker compose -f /home/ubuntu/dosh/docker-compose.yml up -d --build frontend
docker compose -f /home/ubuntu/dosh/docker-compose.yml ps
curl -I http://localhost:3080
curl -i http://localhost:3080/
curl -i http://localhost:3080/budgets
curl -i http://localhost:3080/api/budgets/
docker compose -f /home/ubuntu/dosh/docker-compose.yml -f /home/ubuntu/dosh/docker-compose.override.yml up -d --build frontend
docker compose -f /home/ubuntu/dosh/docker-compose.yml -f /home/ubuntu/dosh/docker-compose.override.yml ps
docker inspect dosh-frontend --format '{{json .NetworkSettings.Networks}}'
docker inspect dosh-frontend --format '{{json .Config.Labels}}'
```

Result:

- the first deployment pass rebuilt successfully but used only the base compose file, which meant the frontend lost the override-provided external `frontend` network and Traefik labels
- local access on `localhost:3080` still worked in that state, which helped confirm the regression was deployment-shape-specific rather than a broken frontend build
- the corrected deployment pass used both compose files and restored the frontend's external network attachment and Traefik labels
- the final deployed frontend remained reachable on port `3080`, and the backend API remained reachable through the frontend proxy path

### Test failures and resolution notes

- the first implementation of `AmountExpressionInput` triggered a render loop because it re-emitted resolved state on every parent render; the component was corrected to notify only when the evaluation state actually changes
- older modal tests initially failed because the new expression input replaced numeric `spinbutton` fields with labeled text inputs; the tests were updated to target the new accessible controls
- one deployment pass initially omitted [docker-compose.override.yml](/home/ubuntu/dosh/docker-compose.override.yml), which would have broken the public Traefik-facing route even though localhost access still worked; the stack was redeployed with both compose files
- no unresolved automated test failures remained at the end of the session

## Latest Session: SonarQube Root-Cluster Cleanup, Frontend Props Validation Baseline, And Deployment Verification

Session outcomes verified in this run:

- the latest successful SonarQube artifact was fetched locally and used to identify the dominant root cluster before code changes were made
- the dominant frontend SonarQube cluster, `javascript:S6774` missing props validation, was addressed across shared components, setup tabs, and high-traffic page components
- the frontend now includes the `prop-types` dependency and explicit prop contracts for the affected React components
- the full frontend Jest suite passed after the cleanup
- the stack rebuilt and restarted successfully through Docker Compose, and the live health endpoint remained healthy after deployment

### Frontend verification

Commands run during this session:

```bash
cd frontend
npm test -- --runInBand --watchAll=false
```

Result:

- the full frontend Jest suite passed after the props-validation cleanup
- 10 frontend suites passed
- 63 frontend tests passed in the latest verified state

Files with meaningful frontend updates in this session:

- [package.json](/home/ubuntu/dosh/frontend/package.json)
- [Layout.jsx](/home/ubuntu/dosh/frontend/src/components/Layout.jsx)
- [Modal.jsx](/home/ubuntu/dosh/frontend/src/components/Modal.jsx)
- [SetupItemHistoryModal.jsx](/home/ubuntu/dosh/frontend/src/components/SetupItemHistoryModal.jsx)
- [BudgetsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetsPage.jsx)
- [BudgetPeriodsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetPeriodsPage.jsx)
- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)

### Deployment verification

Commands run:

```bash
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- backend and frontend containers rebuilt and restarted successfully
- frontend remained available on port `3080`
- the live health endpoint returned `{"status":"ok","app":"Dosh"}`
- the frontend production build completed successfully during deployment, but Vite reported a large post-minification main chunk warning

### Test failures and resolution notes

- no automated test failures remained at the end of the session
- no additional frontend test files were required because the props-validation cleanup did not change user-facing workflow behavior
- the main follow-up note from deployment is bundle-size review, not a correctness regression

## Latest Session: Setup-Revision History Expansion, Revision-Number Alignment, Live Schema Recovery, And Follow-Up UI Regression Fixes

Session outcomes verified in this run:

- setup-item history now includes direct setup-revision events with changed-field detail instead of relying only on `BUDGETADJ` rows
- setup-item revision numbers now map to real stored history records, including setup-affecting future budget adjustments
- the setup history modal now restores a current setup summary above the revision and adjustment timeline
- the live deployment required an additional SQLite schema patch for `periodtransactions.revisionnum` and the new `setuprevisionevents` table before the budget setup sections could load again
- the income action rail on the budget-cycle detail page now uses a fixed slot layout so delete availability no longer shifts the visual column alignment

### Backend verification

Commands run during this session:

```bash
cd backend
/tmp/dosh-test-venv/bin/python -m pytest /home/ubuntu/dosh/backend/tests/test_budget_adjustments.py -q
```

Result:

- focused backend coverage passed for setup-revision history creation, revision-number rebasing, and revision-linked future budget adjustments
- 1 focused backend suite passed
- 8 focused backend tests passed in the latest verified state

Files with meaningful backend test or harness updates in this session:

- [test_budget_adjustments.py](/home/ubuntu/dosh/backend/tests/test_budget_adjustments.py)

### Frontend verification

Commands run during this session:

```bash
cd frontend
npm test -- --runInBand --watchAll=false src/__tests__/ExpenseItemsTab.test.jsx src/__tests__/IncomeTypesTab.test.jsx src/__tests__/InvestmentItemsTab.test.jsx
npm test -- --runInBand --watchAll=false src/__tests__/PeriodDetailPage.test.jsx
```

Result:

- focused setup-tab coverage passed after restoring the current setup summary inside the history modal
- focused period-detail coverage passed after fixing the income action-slot alignment drift
- 4 focused frontend suites passed across the final verified state
- 31 focused frontend tests passed across those suites in the latest verified state

Files with meaningful frontend test or harness updates in this session:

- [ExpenseItemsTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/ExpenseItemsTab.test.jsx)
- [PeriodDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/PeriodDetailPage.test.jsx)
- [SetupItemHistoryModal.jsx](/home/ubuntu/dosh/frontend/src/components/SetupItemHistoryModal.jsx)
- [ExpenseItemsTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/ExpenseItemsTab.jsx)
- [IncomeTypesTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/IncomeTypesTab.jsx)
- [InvestmentItemsTab.jsx](/home/ubuntu/dosh/frontend/src/pages/tabs/InvestmentItemsTab.jsx)
- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)

### Deployment verification

Commands run:

```bash
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
curl -sS http://127.0.0.1:3080/api/health
curl -sS http://127.0.0.1:3080/api/budgets/1/income-types/
curl -sS http://127.0.0.1:3080/api/budgets/1/expense-items/
curl -sS http://127.0.0.1:3080/api/budgets/1/investment-items/
```

Result:

- backend and frontend containers rebuilt and restarted successfully across the session’s deploy passes
- the live health endpoint continued returning `{"status":"ok","app":"Dosh"}`
- the first live deploy of setup-revision history support exposed a schema mismatch that caused the budget setup sections to fail with `500` and appear empty in the UI
- the live SQLite database was backed up and patched in place, after which the income, expense, and investment setup endpoints resumed returning live data
- the final deployed state includes the restored setup summary in the history modal and the fixed-slot income action rail alignment

### Test failures and resolution notes

- the first live deployment of setup-revision history support failed because the live database did not yet have `periodtransactions.revisionnum`
- the same live recovery also required the new `setuprevisionevents` table before the merged setup-history path could operate safely
- after the live schema patch, a follow-up UI regression remained where the setup history modal had lost current setup-line visibility; the modal was updated to show a `Current Setup` summary again
- a second UI regression then left the income-table action rail visually misaligned when delete availability differed by row; the action rail was corrected to use a fixed four-slot layout with a reserved placeholder slot
- no unresolved automated test failures remained at the end of the session

## Latest Session: Income-Modal Remediation, Budget-Column Edit-Affordance Refinement, Empty-State Budget Delete, And Deployment Verification

Session outcomes verified in this run:

- the add-income-from-period modal now correctly supports creating a brand-new income line inline, including linked-account selection
- period-detail budget editing for income, expense, and investment rows now uses icon affordances in the budget column rather than text `Edit` labels or action-rail placement
- the income row action rail now keeps transaction and remove actions separate from budget editing
- the budget cycles empty state now offers direct budget deletion for abandoned or exploratory budgets
- the stack was rebuilt and redeployed twice during the session, including one follow-up deployment after user review clarified the desired edit-icon placement

### Frontend verification

Commands run during this session:

```bash
cd frontend
npm test -- --runInBand --watchAll=false src/__tests__/PeriodDetailPage.test.jsx -t "allows creating a new income type directly from the add income modal"
npm test -- --runInBand --watchAll=false src/__tests__/PeriodDetailPage.test.jsx
npm test -- --runInBand --watchAll=false src/__tests__/BudgetPeriodsPage.test.jsx
```

Result:

- focused period-detail coverage passed after the income-modal remediation and the budget-column edit-affordance correction
- focused budget-cycles coverage passed after adding the empty-state budget-delete action
- 2 focused frontend suites passed
- 22 focused frontend tests passed across the two touched suites in the latest verified state

Files with meaningful frontend test or harness updates in this session:

- [PeriodDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/PeriodDetailPage.test.jsx)
- [BudgetPeriodsPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetPeriodsPage.test.jsx)
- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)
- [BudgetPeriodsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetPeriodsPage.jsx)

### Deployment verification

Commands run:

```bash
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
curl -sS http://127.0.0.1:3080/api/health
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- backend and frontend containers rebuilt and restarted successfully in both deploy passes
- frontend remained available on port `3080`
- backend health checks returned `{"status":"ok","app":"Dosh"}`
- the final deployed state reflects the corrected budget-column edit-icon placement rather than the earlier action-rail placement

### Test failures and resolution notes

- the first income-modal regression test enhancement initially failed because linked-account options load asynchronously when switching the modal into `New income` mode
- the test was updated to wait for the account option before selecting it, and the modal markup was improved with explicit label-control associations
- the first icon-affordance implementation placed the income edit icon in the transaction action rail instead of beside the budget amount
- the UI was then corrected across income, expense, and investment rows so budget editing sits in the budget column, and the stack was redeployed
- no unresolved automated test failures remained at the end of the session

## Latest Session: Budget Adjustment History, Revision Workflow Simplification, Carry-Forward Timing Fix, And Backend Cleanup Deployment

Session outcomes verified in this run:

- budget editing for income, expense, and investment lines moved onto a shared modal-driven workflow backed by explicit `BUDGETADJ` transaction history
- setup-level history views for income, expense, and investment now reuse the shared transaction model
- direct `Paid` to `Revised` reopening now works without a revision-reason modal
- current-period planning stability now uses off-plan activity and transaction line-state capture rather than revision-comment prompts
- carry-forward is now created on close-out rather than during simple future-period generation
- delete continuity was corrected so `BUDGETADJ` planning rows do not block deletion of upcoming cycles
- the live database was cleaned up and aligned to the deployed schema, including removal of obsolete stored revision comments and addition of transaction `line_status`

### Backend verification

Commands run during this session:

```bash
cd backend
/tmp/dosh-test-venv/bin/python -m pytest backend/tests/test_budget_adjustments.py backend/tests/test_budget_health_advanced.py backend/tests/test_status_workflows.py -q
/tmp/dosh-test-venv/bin/python -m pytest backend/tests/test_closeout_flow.py backend/tests/test_delete_continuity.py backend/tests/test_income_transactions.py -q
```

Result:

- focused backend coverage passed for budget adjustments, health interpretation, paid-to-revised workflow, carry-forward timing, delete continuity, and income transaction behavior
- the combined verified result across those focused runs was 14 passing backend tests
- no unresolved backend test failures remained at the end of the session

Files with meaningful backend test updates in this session:

- [test_budget_adjustments.py](/home/ubuntu/dosh/backend/tests/test_budget_adjustments.py)
- [test_budget_health_advanced.py](/home/ubuntu/dosh/backend/tests/test_budget_health_advanced.py)
- [test_status_workflows.py](/home/ubuntu/dosh/backend/tests/test_status_workflows.py)
- [test_closeout_flow.py](/home/ubuntu/dosh/backend/tests/test_closeout_flow.py)

### Frontend verification

Commands run during this session:

```bash
cd frontend
npm test -- --runInBand --watchAll=false src/__tests__/PeriodDetailPage.test.jsx
```

Result:

- focused period-detail coverage passed after the new budget-adjustment flow, inline income-item creation path, and direct paid-to-revised interaction changes
- 1 focused frontend suite passed
- 12 focused frontend tests passed in the latest verified state

Files with meaningful frontend test or harness updates in this session:

- [PeriodDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/PeriodDetailPage.test.jsx)
- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)

### Live cleanup and deployment verification

Commands run:

```bash
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
curl -sS http://127.0.0.1:3080/api/health
curl -sS http://127.0.0.1:3080/api/budgets/1/health
```

Result:

- the first deployment exposed a live schema mismatch introduced by the new implementation
- the live SQLite database was then backed up and patched in place so the deployed code and schema matched
- obsolete stored `revision_comment` values were cleared from live expense and investment rows
- `periodtransactions.line_status` was added and backfilled for existing relevant history rows
- the final deployed backend passed health checks and the live budget health endpoint returned the updated planning-stability wording using `Plan lines reviewed` and `Off-plan activity`

### Test failures and resolution notes

- the initial deployment left period-detail endpoints failing because the live database had not yet been aligned to the new schema introduced by this session
- the issue was resolved by explicitly patching the live database schema and then redeploying the corrected backend
- deletion of upcoming periods also regressed briefly because delete continuity treated `BUDGETADJ` rows like real financial activity
- continuity logic was updated to ignore budget-adjustment history for deletion eligibility, and focused regression coverage was added
- no unresolved automated test failures remained at the end of the session

## Latest Session: Budget Overview Calendar Expansion, Interaction Polish, And Repeated Deployment Verification

Session outcomes verified in this run:

- the old historical `# periods` summary on the Budgets page was replaced by a compact month-view calendar card
- the calendar now includes a full-calendar modal, month navigation, clickable day details, and a dedicated cycle-start marker
- calendar visibility now includes active and upcoming periods within a bounded 3-month window
- the compact summary card was iterated repeatedly to reduce visual weight, remove redundant copy, compress day cells, and keep the richer detail in the modal instead
- the earlier Budgets page test warning caused by demo-budget navigation to an unmatched route was removed cleanly by mocking navigation directly
- the stack was rebuilt and redeployed repeatedly during the session as calendar behavior and layout were refined through review

### Frontend verification

Commands run during this session:

```bash
cd frontend
npm test -- --runInBand --watchAll=false src/__tests__/BudgetsPage.test.jsx
npm run build
```

Result:

- focused Budgets page coverage passed repeatedly as the calendar interaction model evolved
- the Budgets page suite now protects compact summary rendering, full-calendar behavior, bounded 3-month lookahead, day-event modal behavior, and cycle-start event rendering
- the demo-budget test warning about unmatched `/budgets/88` navigation was resolved without broadening the shared test harness
- frontend production builds passed after the calendar card, modal, and event-model refinements
- 1 focused frontend suite passed
- 6 focused frontend tests passed in the latest verified state

Files with meaningful frontend test or harness updates in this session:

- [BudgetsPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetsPage.test.jsx)
- [BudgetsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetsPage.jsx)

### Deployment verification

Commands run:

```bash
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- backend container rebuilt and restarted successfully
- frontend container rebuilt and restarted successfully
- frontend remained available on port `3080`
- backend health endpoint returned `{"status":"ok","app":"Dosh"}`
- the final deployed state includes the compact summary calendar, full-calendar modal, day-event interactions, and cycle-start marker

### Test failures and resolution notes

- the initial Budgets page test emitted a React Router warning because the demo-budget workflow navigated to `/budgets/88` while the test harness only mounted `/budgets`
- the warning was resolved by mocking `useNavigate` and asserting the navigation call directly instead of widening the route harness
- no unresolved automated test failures remained at the end of the session

## Latest Session: Period-Detail Workflow Polish, Sidebar Navigation Baseline Coverage, And Deployment Verification

Session outcomes verified in this run:

- the period detail page now has corrected footer behavior for the total income row, section totals for investments and balances, and a more consistent investment spent-pill workflow
- the budget cycles and sidebar navigation surfaces were refined to keep the current budget context clearer, align `Historical` wording, and make extra-cycle navigation more explicit
- the budget cycles page now preserves the `Upcoming` section collapse state for the browser session
- the sidebar no longer duplicates setup entry on the budget cycles page, and current-budget navigation behavior now has a dedicated Jest regression baseline
- the stack was rebuilt and redeployed multiple times during the session as the period-detail and sidebar refinements were iterated through user testing

### Frontend verification

Commands run during this session:

```bash
cd frontend
npm test -- --runInBand --watchAll=false src/__tests__/PeriodDetailPage.test.jsx
npm test -- --runInBand --watchAll=false src/__tests__/Layout.test.jsx
npm run build
```

Result:

- focused period-detail coverage passed after the totals-row and investment-status fixes
- the new dedicated layout-navigation regression suite passed and now captures the current sidebar hierarchy, setup-link baseline, and `View all ...` cycle-link behavior
- frontend production builds passed after the budget cycles page and sidebar layout changes
- 2 focused frontend suites were run successfully during the session
- 14 focused frontend tests passed across the two touched suites

Files with meaningful frontend test or harness updates in this session:

- [PeriodDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/PeriodDetailPage.test.jsx)
- [Layout.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/Layout.test.jsx)
- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)
- [Layout.jsx](/home/ubuntu/dosh/frontend/src/components/Layout.jsx)
- [BudgetPeriodsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetPeriodsPage.jsx)

### Deployment verification

Commands run:

```bash
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- backend container rebuilt and restarted successfully
- frontend container rebuilt and restarted successfully
- frontend remained available on port `3080`
- backend health endpoint returned `{"status":"ok","app":"Dosh"}`
- the final deployed state includes the latest period-detail fixes, sidebar navigation refinements, and navigation regression coverage in the working tree

### Test failures and resolution notes

- the first version of the new layout-navigation test assumed a sidebar `Setup` link would still appear when setup needed attention, but the current live UI intentionally keeps setup actions off the sidebar baseline in those routed contexts
- the test was updated to reflect the actual current behavior rather than an earlier design assumption
- no unresolved automated test failures remained at the end of the session

## Latest Session: Demo Budget Workflow, Shared Dev-Mode Gating, Health-Relevant Demo Activity, And Deployment Verification

Session outcomes verified in this run:

- stale current-state CRA references were removed from [README.md](/home/ubuntu/dosh/README.md)
- the create-budget modal now supports a dev-only `Create Demo Budget` action
- demo-budget creation is now controlled through shared Docker Compose `DEV_MODE` handling rather than a checked-in frontend `.env`
- the backend now enforces the same dev-mode gate before allowing `/api/budgets/demo`
- demo import creates additive seeded data only and does not overwrite or delete existing budgets
- the seeded demo budget now includes historical close-outs, a live current cycle, several upcoming cycles, linked savings and investment setup, and activity that meaningfully affects budget health output
- the Docker deployment was rebuilt twice during the session: once for the initial shared demo-mode flow and once again after tuning demo activity to better influence budget health

### Frontend verification

Commands run during this session:

```bash
cd frontend
npm test -- --runTestsByPath /home/ubuntu/dosh/frontend/src/__tests__/BudgetsPage.test.jsx
npm run build
```

Result:

- focused Budgets page coverage passed for dev-mode visibility and demo-budget action behavior
- frontend production builds passed after moving the demo-mode control away from a checked-in `.env` and onto Docker Compose build arguments

Files with meaningful frontend test or harness updates in this session:

- [BudgetsPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetsPage.test.jsx)
- [BudgetsPage.jsx](/home/ubuntu/dosh/frontend/src/pages/BudgetsPage.jsx)
- [client.js](/home/ubuntu/dosh/frontend/src/api/client.js)
- [vite.config.js](/home/ubuntu/dosh/frontend/vite.config.js)
- [Dockerfile](/home/ubuntu/dosh/frontend/Dockerfile)
- [jest.setup.js](/home/ubuntu/dosh/frontend/jest.setup.js)

### Backend verification

Command run:

```bash
cd backend
/tmp/dosh-test-venv/bin/python -m pytest /home/ubuntu/dosh/backend/tests/test_app_smoke.py -q
```

Result:

- backend smoke coverage passed for both demo-mode states
- the demo endpoint correctly returned `404` when `DEV_MODE` was not enabled
- the seeded demo-budget path passed with historical, current, and upcoming cycle coverage
- the seeded demo budget now also passed targeted health assertions showing visible pressure signals and non-trivial planning-stability output
- 6 backend smoke tests passed

Files with meaningful backend test updates in this session:

- [test_app_smoke.py](/home/ubuntu/dosh/backend/tests/test_app_smoke.py)
- [demo_budget.py](/home/ubuntu/dosh/backend/app/demo_budget.py)
- [runtime_settings.py](/home/ubuntu/dosh/backend/app/runtime_settings.py)
- [budgets.py](/home/ubuntu/dosh/backend/app/routers/budgets.py)

### Deployment verification

Commands run:

```bash
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- backend container rebuilt and restarted successfully
- frontend container rebuilt and restarted successfully
- frontend remained available on port `3080`
- backend health endpoint returned `{"status":"ok","app":"Dosh"}`
- the final deployed state includes the updated demo budget with health-relevant seeded activity

### Test failures and resolution notes

- The initial demo-budget implementation produced a structurally valid demo budget, but the seeded activity did not yet put enough visible pressure on budget-health surfaces to make demos especially useful.
- The demo seed was revised to include a clearer historical discipline pattern, revised current expense state, over-budget lines, and negative actual surplus pressure.
- Focused backend smoke verification was rerun after the seed adjustment and passed.
- No unresolved test failures remained at the end of the session.

## Latest Session: Income Transactions, Unified Ledger Cleanup, Vite Migration, Vulnerability Remediation, And Deploy Verification

Session outcomes verified in this run:

- period-detail income actual entry was moved from inline editing to a dedicated transaction modal
- locked active cycles were corrected so they still allow actual recording and transaction entry
- dedicated backend income transaction routes were added over the unified `periodtransactions` ledger
- obsolete legacy expense and investment transaction tables were removed from the active schema after taking a database backup and running the explicit cutover script
- backend startup schema patching was removed
- the frontend was migrated from CRA to Vite while keeping Jest and Playwright coverage working
- the frontend Docker image moved to Node 20
- frontend dependency vulnerabilities were reduced to zero reported findings
- stale CRA artifacts and selectors were cleaned up, including Playwright wording drift and unused frontend entry files

### Frontend verification

Commands run during this session:

```bash
cd frontend
npm test -- --runInBand --watchAll=false PeriodDetailPage.test.jsx
npm test -- --watchAll=false
npm run build
npm run test:e2e
npm audit --json
```

Result:

- focused period-detail tests passed after the income transaction and locking changes
- full frontend Jest suite passed
- 8 suites passed
- 43 tests passed
- Vite production build completed successfully
- Playwright smoke suite passed after selector updates
- 4 end-to-end tests passed
- `npm audit` reported `0` vulnerabilities

Files with meaningful frontend test or harness updates in this session:

- [PeriodDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/PeriodDetailPage.test.jsx)
- [budget-smoke.spec.js](/home/ubuntu/dosh/frontend/e2e/budget-smoke.spec.js)
- [playwright.config.js](/home/ubuntu/dosh/frontend/playwright.config.js)
- [package.json](/home/ubuntu/dosh/frontend/package.json)
- [vite.config.js](/home/ubuntu/dosh/frontend/vite.config.js)
- [jest.config.cjs](/home/ubuntu/dosh/frontend/jest.config.cjs)
- [babel.config.cjs](/home/ubuntu/dosh/frontend/babel.config.cjs)
- [jest.setup.js](/home/ubuntu/dosh/frontend/jest.setup.js)

### Backend verification

Commands run:

```bash
cd backend
./.venv/bin/python -m pytest tests/test_transactions_and_balances.py -q
./.venv/bin/python -m pytest tests/test_income_transactions.py tests/test_transactions_and_balances.py tests/test_live_ledger_behavior.py -q
./.venv/bin/python -m pytest -q
```

Result:

- focused locking and ledger tests passed
- dedicated income transaction backend tests passed
- full backend suite passed
- 49 backend tests passed

Files with meaningful backend test updates in this session:

- [test_income_transactions.py](/home/ubuntu/dosh/backend/tests/test_income_transactions.py)
- [test_transactions_and_balances.py](/home/ubuntu/dosh/backend/tests/test_transactions_and_balances.py)

### Database cutover verification

Command run:

```bash
python backend/scripts/cutover_unified_transactions.py
```

Operational steps recorded:

- a timestamped SQLite backup was created under [backend/db_backups](/home/ubuntu/dosh/backend/db_backups) before schema mutation
- the cutover script removed obsolete legacy expense and investment transaction tables from the active schema
- backend imports and tests were run against the post-cutover code and schema state

### Deployment verification

Commands run:

```bash
docker compose -f docker-compose.yml up --build -d
docker compose -f docker-compose.yml up --build -d frontend
```

Runtime checks:

```bash
docker compose -f docker-compose.yml ps
curl http://127.0.0.1:3080/
docker exec dosh-backend python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:80/api/health').read().decode())"
```

Result:

- backend container started successfully
- frontend container started successfully
- frontend served on port `3080`
- backend health endpoint returned `{"status":"ok","app":"Dosh"}`

### Test failures and resolution notes

- The initial full Playwright run failed in 3 smoke cases because the specs still expected the old `Primary account` wording.
- The selectors and expected helper copy were updated to the current `Primary transaction account` wording in [budget-smoke.spec.js](/home/ubuntu/dosh/frontend/e2e/budget-smoke.spec.js).
- The first Vite-based frontend Docker rebuild failed because [Dockerfile](/home/ubuntu/dosh/frontend/Dockerfile) still copied CRA output from `/app/build`.
- The Dockerfile was updated to copy Vite output from `/app/dist`, after which the frontend image rebuilt and deployed successfully.
- No unresolved test failures remained at the end of the session.

## Latest Session: Setup UX Refinement, Account Naming Localisation, And Period Summary Expansion

Session outcomes verified in this run:

- account type naming changed from `Bank` to `Transaction`, including existing data alignment
- budget-level account naming preference was introduced with `Transaction`, `Everyday`, and `Checking`
- the budget setup page was refined with clearer setup-assessment wording, session-persisted optional-section collapse state, and chevron-first section headers
- the budget cycles list now uses `Upcoming` grouping language and remembers the historical section expand or collapse state for the browser session
- the period detail page now includes both `Projected Savings` and `Remaining Expenses` in the top summary-card grid
- Docker deployment was rebuilt and revalidated from the current working tree as the session progressed

### Frontend verification

Commands run during this session:

```bash
cd frontend
npm test -- --runInBand --watch=false src/__tests__/BalanceTypesTab.test.jsx src/__tests__/IncomeTypesTab.test.jsx src/__tests__/InvestmentItemsTab.test.jsx
npm test -- --runInBand --watch=false src/__tests__/BudgetPeriodsPage.test.jsx
npm test -- --runInBand --watch=false src/__tests__/BudgetDetailPage.test.jsx
npm test -- --runInBand --watch=false src/__tests__/PeriodDetailPage.test.jsx
npm run build
```

Result:

- focused frontend tests passed for the touched workflow areas
- account-naming preference coverage passed across settings, account setup, income linked-account rendering, and investment linked-account rendering
- budget setup and budget cycles page coverage passed after the session-persistence and wording changes
- period detail page coverage passed after the new summary-card additions
- production builds completed successfully before deployment

Files with meaningful test updates in this session:

- [BudgetDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetDetailPage.test.jsx)
- [BudgetPeriodsPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetPeriodsPage.test.jsx)
- [PeriodDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/PeriodDetailPage.test.jsx)
- [BalanceTypesTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BalanceTypesTab.test.jsx)
- [IncomeTypesTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/IncomeTypesTab.test.jsx)
- [InvestmentItemsTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/InvestmentItemsTab.test.jsx)
- [SettingsTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/SettingsTab.test.jsx)

### Backend verification

Command run:

```bash
cd backend
. .venv/bin/activate
pytest tests/test_app_smoke.py -q
```

Result:

- backend smoke tests passed
- 4 tests passed
- the newer API and schema changes for account-naming preference and period-detail summary payloads did not break the app smoke layer

### Deployment verification

Command run:

```bash
docker compose up -d --build
```

Runtime checks:

```bash
docker compose ps
curl http://127.0.0.1:3080/
docker exec dosh-frontend wget -qO- http://backend:80/api/health
```

Result:

- backend container started successfully
- frontend container started successfully
- frontend served on port `3080`
- backend health endpoint returned `{"status":"ok","app":"Dosh"}`

### Test failures and resolution notes

- No unresolved test failures remained at the end of the session.
- The only notable follow-up from the backend test run was the already-known FastAPI startup deprecation warning around `on_event`, which did not block verification.

## Latest Session: Setup Assessment Hardening, Harness Isolation, And Deployment Verification

Session outcomes verified in this run:

- centralized backend setup assessment and setup-protection rules
- budget setup page assessment-state UI
- protected setup-tab behavior for accounts, income types, expense items, and investment lines
- backend test harness reworked to use an isolated SQLite database per test case
- Docker deployment rebuilt and started from the current working tree

### Frontend verification

Commands run:

```bash
cd frontend
npm test -- --runInBand --watch=false
npm run build
```

Result:

- frontend tests passed
- 8 test suites passed
- 36 tests passed
- production build completed successfully

Focused setup-assessment UI coverage also passed for:

- [BudgetDetailPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetDetailPage.test.jsx)
- [BudgetPeriodsPage.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BudgetPeriodsPage.test.jsx)
- [BalanceTypesTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/BalanceTypesTab.test.jsx)
- [IncomeTypesTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/IncomeTypesTab.test.jsx)
- [ExpenseItemsTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/ExpenseItemsTab.test.jsx)
- [InvestmentItemsTab.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/InvestmentItemsTab.test.jsx)

### Backend verification

Commands run:

```bash
cd backend
python3 -m venv .venv
./.venv/bin/python -m pip install -r requirements-dev.txt
./.venv/bin/python -m pytest -q
```

Result:

- backend tests passed
- 43 tests passed
- per-test isolated SQLite harness is now working across mixed functional areas

Harness-specific outcome:

- backend tests no longer depend on a shared SQLite file across multiple functional areas
- the earlier order-dependent failures around missing tables and shared state were resolved by moving to an isolated database per test case in [conftest.py](/home/ubuntu/dosh/backend/tests/conftest.py)

### Deployment verification

Command run:

```bash
docker compose up -d --build
```

Runtime checks:

```bash
docker compose ps
curl http://127.0.0.1:3080/
docker exec dosh-frontend wget -qO- http://backend:80/api/health
```

Result:

- backend container started successfully
- frontend container started successfully
- frontend served on port `3080`
- backend health endpoint returned `{"status":"ok","app":"Dosh"}`

### Notable warnings

These are not currently blocking, but should remain visible for future maintenance:

- FastAPI `on_event` deprecation warnings from startup hooks
- `datetime.utcnow()` deprecation warnings in transaction and schema timestamp paths
- frontend Docker build still uses Node 16 and emits engine warnings because some dev dependencies now expect Node 18+

### Current confidence statement

At the end of this session:

- setup-assessment and protection work is covered in backend and frontend tests
- the backend harness is stable enough for multi-area sessions
- the repo builds and deploys successfully with Docker Compose from the current working tree
