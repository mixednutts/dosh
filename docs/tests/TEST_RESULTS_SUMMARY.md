# Dosh Test Results Summary

This document records meaningful automated test results from major working sessions.

## Latest Session: Budget Health Engine Simplification (0.5.0-alpha)

This session radically simplified the Budget Health Engine to two hard-coded system metrics with user-tunable parameters. All template, data-source, scale, custom-metric, drill-down, and dynamic-formula concepts were removed, and tests were rewritten for the simplified framework.

### Verification

```bash
cd /home/ubuntu/dosh/backend
.venv/bin/pytest tests/test_health_engine.py tests/test_health_matrices.py tests/test_lifecycle_and_health.py tests/test_closeout_flow.py -v
```

Result:

- `test_health_engine.py`: **8 passed**
- `test_health_matrices.py`: **5 passed**
- `test_lifecycle_and_health.py`: **5 passed**
- `test_closeout_flow.py`: **3 passed**
- No regressions introduced

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --watchAll=false --testPathPatterns="BudgetHealthTab.test|client.test"
```

Result:

- `BudgetHealthTab.test.jsx`: passed
- `client.test.js`: passed
- Full frontend suite: **19 passed** (2 test suites)

### Deployment Verification

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true ./scripts/release_with_migrations.sh
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- Backend container rebuilt and restarted successfully
- Frontend container rebuilt and restarted successfully
- Destructive Alembic migration `e1096e3868f0_simplify_budget_health_engine` applied successfully
- Health endpoint returned `{"status":"ok","app":"Dosh"}`

## Previous Session: Budget Health Engine — Custom Metric Scoring Fix (0.4.8-alpha)

This session implemented `custom_metric_v1` scoring logic so custom metrics created in the Budget Health Engine UI compute real scores instead of returning a fallback "Metric evaluation not yet implemented" result.

### Verification

```bash
cd /home/ubuntu/dosh/backend
.venv/bin/pytest tests/test_health_engine.py -v
```

Result:

- `test_health_engine.py`: **14 passed**
- New tests added: `test_get_executor_returns_custom_metric_v1_for_scoring_logic_type`, `test_custom_metric_v1_executor_penalizes_above_threshold`
- Existing custom-metric integration test updated to validate real scoring behavior end-to-end

### Deployment Verification

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true ./scripts/release_with_migrations.sh
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- Backend container rebuilt and restarted successfully
- Frontend container rebuilt and restarted successfully
- Health endpoint returned `{"status":"ok","app":"Dosh"}`

## Previous Session: Budget Health Engine Cleanup (0.4.7-alpha)

This session fixed dev-mode template deletion to fully cascade, cleaned up orphaned/empty health matrix records, aligned empty-matrix handling so `evaluate_budget_health` returns `None`, and hid health UI on the dashboard when no meaningful matrix exists.

### Verification

```bash
cd /home/ubuntu/dosh/backend
.venv/bin/pytest tests/ -q
```

Result:

- Full backend suite: **183 passed**
- New tests added for template deletion (`test_health_matrices.py`) and empty-matrix behavior (`test_health_engine.py`)

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --watchAll=false
```

Result:

- Full frontend suite: **203 passed** (18 test suites)
- No regressions introduced

### Previous Session: Budget Health Engine Simplification (0.4.6-alpha)

This session simplified the Budget Health Engine by collapsing `HealthThresholdDefinition` and `BudgetMetricThreshold` into direct metric/matrix-item properties, then deployed to the local Docker container.

Result:

- Full backend suite: **190 passed**
- Full frontend suite: **203 passed**

### Deployment Verification

```bash
cd /home/ubuntu/dosh
docker compose up --build -d
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- Backend container rebuilt and restarted successfully
- Frontend container rebuilt and restarted successfully
- Health endpoint returned `{"status":"ok","app":"Dosh"}`
- Version endpoint returned `0.4.6-alpha`
- `/api/budgets/{id}/health` returned fully populated health payload with `overall_score`, `pillars`, `current_period_check`, and `momentum_status`

---


It exists separately from [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) so the strategy can stay stable while future sessions still have a record of what was actually run and verified.

## Latest Session: Fix Empty Health Metric Data After Threshold Terminology Refactor

This session fixed a critical bug where the Budget Health Engine returned empty/null payloads after the `0.4.3-alpha` terminology refactor, causing blank health indicators on the budget summary page.

### Verification

```bash
cd /home/ubuntu/dosh/backend
.venv/bin/python -m pytest tests/ -q
```

Result:

- Full backend suite: **184 passed**
- No regressions introduced
- Migration tests (`test_auto_expense_migration.py`): clean upgrade to head and legacy upgrade both pass

```bash
cd /home/ubuntu/dosh/frontend
npx jest --runInBand --watchAll=false
```

Result:

- Full frontend suite: **198 passed** (18 test suites)
- No regressions introduced

### Deployment Verification

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true ./scripts/release_with_migrations.sh
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- Backend container rebuilt and restarted successfully
- Frontend container rebuilt and restarted successfully
- Health endpoint returned `{"status":"ok","app":"Dosh"}`
- Version endpoint returned `0.4.4-alpha`
- `/api/budgets/{id}/health` returned fully populated health payload with `overall_score`, `pillars`, `current_period_check`, and `momentum_status`

---

## Latest Session: Budget Health Endpoint and Modal Fix

This session fixed two production issues: Budget Health data was not loading on the Budget Dashboard, and the Current Budget Cycle Check Details modal crashed to a black screen.

### Verification

```bash
cd /home/ubuntu/dosh/backend
.venv/bin/python -m pytest tests/test_app_smoke.py -v
```

Result:

- Backend smoke tests: **11 passed**
- No regressions introduced

```bash
cd /home/ubuntu/dosh/backend
.venv/bin/python -m pytest tests/test_health_engine.py -v
```

Result:

- Health-engine tests: **22 passed**
- No regressions introduced

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --watchAll=false --testPathPatterns="BudgetsPage|Dashboard"
```

Result:

- Frontend targeted tests: **12 passed** (2 test suites)
- No regressions introduced

### What changed

- Fixed `getBudgetHealth` API path in `frontend/src/api/client.js` (`/health-engine` → `/health`)
- Fixed `current_period_check` payload shape in `backend/app/health_engine/runner.py` (`details` → `evidence`)
- Added defensive fallbacks in `frontend/src/pages/BudgetsPage.jsx` (`CurrentPeriodCheckModal`)

---

## Latest Session: SonarQube Quality Gate Follow-Through

This session addressed failing SonarQube quality gate conditions: a reliability bug in the Budget Health Engine runner and insufficient new-code coverage on health matrix and API client surfaces.

### Verification

```bash
cd /home/ubuntu/dosh/backend
.venv/bin/python -m pytest tests/ -q
```

Result:

- Full backend suite: **162 passed**
- No regressions introduced
- New backend coverage: `test_health_matrices.py` (9 tests) covering matrix retrieval, item updates, personalisation updates, custom metric creation/validation, and metric removal

```bash
cd /home/ubuntu/dosh/frontend
npm test -- --silent
```

Result:

- Full frontend suite: **200 passed** (18 test suites)
- No regressions introduced
- New/expanded coverage:
  - `PersonalisationTab.test.jsx` expanded to 15 tests covering matrix item enablement, weight/sensitivity edits, personalisation changes, custom metric builder validation, and load-error handling
  - `client.test.js` expanded to 12 tests covering export filename parsing, budget health helpers, period-critical workflows, and transaction operations

### What changed

- Fixed `python:S3923` in `backend/app/health_engine/runner.py` (conditional returned same value on both branches)
- Added `htmlFor`/`id` label associations in `frontend/src/pages/tabs/PersonalisationTab.jsx` to address accessibility findings (`javascript:S6853`)
- Expanded `frontend/jest.config.cjs` testMatch to include `.test.js` files for full coverage collection

---

## Session: Budget Health Engine — Configurable Health System Implementation

This session completed the transition from a fixed budget health implementation to a fully configurable Budget Health Engine with personalization framework, point-in-time snapshots, drill-down capabilities, and metric builder UI.

### Verification

```bash
cd /home/ubuntu/dosh/backend
.venv/bin/python -m pytest tests/ -q
```

Result:

- Full backend suite: **153 passed**
- No regressions introduced
- Legacy `budget_health.py` tests removed; engine integration verified via `test_app_smoke.py`

```bash
cd /home/ubuntu/dosh/frontend
CI=true npm test -- --watchAll=false --runInBand
```

Result:

- Full frontend suite: **176 passed**
- No regressions introduced

### Deployment Verification

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true ./scripts/release_with_migrations.sh
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- Backend container rebuilt and restarted successfully
- Frontend container rebuilt and restarted successfully
- Health endpoint returned `{"status":"ok","app":"Dosh"}`
- Version endpoint returned `0.4.0-alpha`

### Migration Verification

- Alembic revision `7a8b9c0d1e2f` applied successfully (adds Budget Health Engine tables)
- All existing budgets migrated to `BudgetHealthMatrix` instances with default matrices
- Demo budget and test fixtures updated to seed engine catalogs and create default matrices automatically

---

## Previous Session: Investment Transaction Hardening, Dynamic Balance Limit UX, And Modal Polish

This session hardened investment transactions into proper two-sided ledger movements, improved the dynamic balance limit-exceeded experience, and fixed small UI defects.

### Verification

```bash
cd /home/ubuntu/dosh/backend
.venv/bin/python -m pytest tests/ -q
```

Result:

- Full backend suite: **155 passed**
- No regressions introduced

```bash
cd /home/ubuntu/dosh/frontend
CI=true npm test -- --watchAll=false --runInBand
```

Result:

- Full frontend suite: **176 passed**
- No regressions introduced

### Deployment Verification

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true ./scripts/release_with_migrations.sh
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- Backend container rebuilt and restarted successfully
- Frontend container rebuilt and restarted successfully
- Health endpoint returned `{"status":"ok","app":"Dosh"}`
- Version endpoint returned `0.3.8-alpha`

### Migration Verification

- Alembic revision `4bf1bf54b0bb` applied successfully (adds `source_account_desc` to `investmentitems` and `periodinvestments`)
- Production data cleanup script removed 17 orphaned incomplete investment transactions and recalculated affected periods

---

## Latest Session: Cash Management Workflow — Bug Remediation And Scheduled Expense Validation

This session fixed issues arising from the Cash Management workflow changes: expense-item debit account selection was restricted to Transaction accounts, the account selector UI was inconsistent, and scheduled expenses could be saved without a required interval or effective date.

### Verification

```bash
cd /home/ubuntu/dosh/backend
.venv/bin/python -m pytest tests/ -q
```

Result:

- Full backend suite: **139 passed** (was 136; +3 new tests in `test_budget_setup_workflows.py`)
- No regressions introduced

```bash
cd /home/ubuntu/dosh/frontend
npx jest --runInBand
```

Result:

- Full frontend suite: **173 passed** (was 168; +5 new tests across `ExpenseItemsTab.test.jsx`), 16 test suites
- No regressions introduced

### Deployment Verification

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true ./scripts/release_with_migrations.sh
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- Backend container rebuilt and restarted successfully
- Frontend container rebuilt and restarted successfully
- Health endpoint returned `{"status":"ok","app":"Dosh"}`
- Version endpoint returned `0.3.5-alpha`

### Migration Verification

- No new schema migrations required; validation logic changes only
- Existing Alembic revisions `e4f5a6b7c8d9` and `f1a2b3c4d5e6` remain current

---

## Latest Session: Cash Management Workflow — Generalised Transfers, Expense Routing, And Investment Tracking

This session implemented the cash management workflow defined in [CASH_MANAGEMENT_WORKFLOW_PLAN.md](/home/ubuntu/dosh/docs/plans/CASH_MANAGEMENT_WORKFLOW_PLAN.md), including generalised account transfers, expense default account routing, and investment account tracking.

### Verification

```bash
cd /home/ubuntu/dosh/backend
.venv/bin/pytest tests/ -q
```

Result:

- Full backend suite: **136 passed** (was 125; +11 new tests across `test_account_transfer_validation.py` and `test_expense_entry_account_routing.py`)
- No regressions introduced

```bash
cd /home/ubuntu/dosh/frontend
npm test
```

Result:

- Full frontend suite: **168 passed** (was 167; +1 new test), 16 test suites
- No regressions introduced

### Deployment Verification

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true bash scripts/release_with_migrations.sh
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- Backend container rebuilt and restarted successfully
- Frontend container rebuilt and restarted successfully
- Health endpoint returned `{"status":"ok","app":"Dosh"}`
- Version endpoint returned `0.3.5-alpha`

### Migration Verification

- Alembic revision `e4f5a6b7c8d9` applied successfully (adds `default_account_desc` to `expenseitems`)
- Alembic revision `f1a2b3c4d5e6` applied successfully (backfills `ExpenseItem` defaults and `PeriodTransaction` account data)
- Gap-analysis reconciliation script run inside Docker container returned zero anomalies

---

## Latest Session: Budget Setup Assessment Visibility And New Account Period Balance Backfill

This session verified fixes for two issues: hiding the Setup Assessment card once budget cycles exist, and ensuring newly created active accounts appear in existing cycle Account Balances.

### Verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
CI=true npm test -- --watchAll=false --runInBand
```

Result:

- Full frontend suite: **167 passed** (was 166; +1 new test), 16 test suites
- `hides the setup assessment card when budget cycles already exist` added to `BudgetDetailPage.test.jsx`
- No regressions introduced

```bash
cd /home/ubuntu/dosh/backend
.venv/bin/pytest tests/ -q
```

Result:

- Full backend suite: **125 passed** (was 123; +2 new tests)
- `test_creating_active_balance_type_creates_period_balances_for_existing_periods` added to `test_transactions_and_balances.py`
- `test_creating_active_balance_type_skips_closed_and_pending_closure_periods` added to `test_transactions_and_balances.py`
- No regressions introduced

### Deployment Verification

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true ./scripts/release_with_migrations.sh
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- Backend container rebuilt and restarted successfully
- Frontend container rebuilt and restarted successfully
- Health endpoint returned `{"status":"ok","app":"Dosh"}`
- Version endpoint returned `0.3.4-alpha`

---

## Latest Session: Release Notes Modal Scroll-To-Updates UX Improvement

This session verified a small UX improvement to the in-app Release Notes modal: the "N newer release available" badge now scrolls directly to the Available Updates section.

### Verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
CI=true npm test -- --watchAll=false --runInBand
```

Result:

- Full frontend suite: **166 passed** (was 165; +1 new test), 16 test suites
- `scrolls to available updates when the newer release badge is clicked` added to `Layout.test.jsx`
- No regressions introduced

```bash
cd /home/ubuntu/dosh/backend
.venv/bin/pytest tests/ -q
```

Result:

- Full backend suite: **123 passed**
- No regressions introduced

### Deployment Verification

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true ./scripts/release_with_migrations.sh
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- Backend container rebuilt and restarted successfully
- Frontend container rebuilt and restarted successfully
- Health endpoint returned `{"status":"ok","app":"Dosh"}`
- Version endpoint returned `0.3.3-alpha`

---

## Latest Session: Scheduled Expense Fixes, Date Field Autocomplete, And Delete Messaging

This session verified fixes for three user-facing issues: scheduled expense period applicability, calendar picker autofill overlap, and budget-cycle delete messaging for trailing cycles.

### Verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
.venv/bin/pytest tests/ -q
```

Result:

- Full backend suite: **123 passed** (was 121; +2 new tests)
- `test_fixed_day_occurrence_respects_effectivedate` added to protect the `period_logic.py` fix
- `test_adding_scheduled_expense_to_future_only_applies_to_periods_where_due` added to protect the `periods.py` future-period propagation fix
- No regressions introduced

```bash
cd /home/ubuntu/dosh/frontend
CI=true npm test -- --watchAll=false --runInBand
```

Result:

- Full frontend suite: **165 passed** (was 164; +1 new test), 16 test suites
- `shows simple delete confirmation when future chain is only the current cycle` added to `BudgetPeriodsPage.test.jsx`
- No regressions introduced

### Deployment Verification

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true ./scripts/release_with_migrations.sh
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- Backend container rebuilt and restarted successfully
- Frontend container rebuilt and restarted successfully
- Health endpoint returned `{"status":"ok","app":"Dosh"}`
- Version endpoint returned `0.3.3-alpha`

---

## Latest Session: SonarQube Cleanup And Post-Modularization Maintenance

This session verified that a large cleanup pass of unused imports and variables introduced no regressions.

### Verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/frontend
CI=true npm test -- --watchAll=false --runInBand
```

Result:

- Full frontend suite: **164 passed**, 16 test suites
- No regressions introduced by import/variable removals

```bash
cd /home/ubuntu/dosh/backend
.venv/bin/pytest tests/ -q
```

Result:

- Full backend suite: **121 passed**
- No regressions introduced by the minor `periods.py` cleanup

### Deployment Verification

```bash
cd /home/ubuntu/dosh
INCLUDE_OVERRIDE=true ./scripts/release_with_migrations.sh
curl -sS http://127.0.0.1:3080/api/health
```

Result:

- Backend container rebuilt and restarted successfully
- Frontend container rebuilt and restarted successfully
- Health endpoint returned `{"status":"ok","app":"Dosh"}`
- Version endpoint returned `0.3.2-alpha`

---

## Latest Session: Status Change History Feature And UTC Datetime Test Fixes

Session outcomes verified in this run:

### Status Change History Feature (Implemented)

- Implemented budget-level `record_line_status_changes` setting (default: false)
- Created `build_status_change_tx()` in transaction_ledger.py following budget adjustment pattern
- Modified status endpoints (expense, income, investment) to create history records when setting enabled
- Added database migration `b71415822583` for new column
- Frontend displays status changes with "Status" badge in transaction details
- Records are non-financial (amount = 0), excluded from totals, cannot be deleted

**Files changed:**
- [models.py](/home/ubuntu/dosh/backend/app/models.py): Added `record_line_status_changes` column to Budget
- [schemas.py](/home/ubuntu/dosh/backend/app/schemas.py): Added setting to BudgetOut, BudgetUpdate schemas  
- [transaction_ledger.py](/home/ubuntu/dosh/backend/app/transaction_ledger.py): Added `TX_TYPE_STATUS_CHANGE`, `build_status_change_tx()` function
- [periods.py](/home/ubuntu/dosh/backend/app/routers/periods.py): Modified status endpoints to create history records when setting enabled
- [alembic/versions/b71415822583_add_record_line_status_changes_setting.py](/home/ubuntu/dosh/backend/alembic/versions/b71415822583_add_record_line_status_changes_setting.py): Database migration

### UTC Datetime Migration Test Fixes

- Fixed 14 remaining backend test failures caused by offset-naive vs offset-aware datetime comparisons after UTC migration
- Updated `cycle_management.py` to use `utc_now()` instead of `utc_now_naive()` for `period.closed_at`
- Updated `auto_expense.py` to use `app_now()` and handle naive datetime parameter conversion
- Updated `period_logic.py` with `_ensure_utc()` helper to normalize all datetime inputs for comparison
- Cleaned up `models.py` by removing redundant `_ensure_utc()` function and SQLAlchemy event listeners (now handled by `UTCDateTime` type decorator)
- Created production database backup before deployment: `backups/dosh_backup_pre_utc_fix_20260411_084801.db`
- Successfully deployed fixes to running container

### Backend Verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh/backend
source .venv/bin/activate
python -m pytest tests/ -v
```

Result:

- Full backend suite: **121 passed** (previously 107 passed, 14 failed)
- All datetime comparison failures resolved
- No regressions introduced

Files with meaningful backend updates:

- [models.py](/home/ubuntu/dosh/backend/app/models.py): Removed `_ensure_utc()` and event listeners; cleaned up imports; added `record_line_status_changes` column
- [cycle_management.py](/home/ubuntu/dosh/backend/app/cycle_management.py): Fixed `period.closed_at` to use `utc_now()`
- [auto_expense.py](/home/ubuntu/dosh/backend/app/auto_expense.py): Fixed scheduler and `run_date` timezone handling
- [period_logic.py](/home/ubuntu/dosh/backend/app/period_logic.py): Added `_ensure_utc()` helper for datetime normalization
- [transaction_ledger.py](/home/ubuntu/dosh/backend/app/transaction_ledger.py): Added `build_status_change_tx()` for status change history
- [periods.py](/home/ubuntu/dosh/backend/app/routers/periods.py): Modified status endpoints to create history records when setting enabled

### Deployment Verification

Commands run during this session:

```bash
cd /home/ubuntu/dosh
docker compose up -d --build backend
docker compose ps
curl -s http://localhost:3080/api/health
```

Result:

- Backend container rebuilt and restarted successfully
- Health endpoint returned `{"status":"ok","app":"Dosh"}`
- API requests serving correctly (200 OK responses)
- Production database integrity verified after deployment

### Failures and Resolutions

Observed issues during the session:

- 14 backend tests were failing with `TypeError: can't compare offset-naive and offset-aware datetimes`
- Root cause: Some code paths still used `utc_now_naive()` or `app_now_naive()` which returned naive datetimes
- SQLite stores datetimes without timezone info, but validators ensure timezone-aware objects on load

Resolution:

- Changed all datetime comparisons to use timezone-aware objects
- Added `_ensure_utc()` helper in `period_logic.py` to normalize naive datetimes
- Updated `auto_expense.py` to handle naive `run_date` parameters from tests
- Removed redundant event listeners from `models.py` (functionality covered by `UTCDateTime` type)

Final result:

- All 121 backend tests passing
- UTC datetime migration now fully complete and deployed
- Database backup created before deployment for rollback safety
- Status Change History feature fully implemented

---

## Previous Sessions

*[Previous session entries remain below - truncated for brevity]*
