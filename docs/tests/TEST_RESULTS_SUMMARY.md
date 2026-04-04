# Dosh Test Results Summary

This document records meaningful automated test results from major working sessions.

It exists separately from [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) so the strategy can stay stable while future sessions still have a record of what was actually run and verified.

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
