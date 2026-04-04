# Dosh Test Results Summary

This document records meaningful automated test results from major working sessions.

It exists separately from [TEST_STRATEGY.md](/home/ubuntu/dosh/TEST_STRATEGY.md) so the strategy can stay stable while future sessions still have a record of what was actually run and verified.

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
