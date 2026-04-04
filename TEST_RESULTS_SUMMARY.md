# Dosh Test Results Summary

This document records meaningful automated test results from major working sessions.

It exists separately from [TEST_STRATEGY.md](/home/ubuntu/dosh/TEST_STRATEGY.md) so the strategy can stay stable while future sessions still have a record of what was actually run and verified.

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
