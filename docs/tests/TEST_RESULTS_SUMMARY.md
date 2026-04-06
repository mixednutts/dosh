# Dosh Test Results Summary

This document records meaningful automated test results from major working sessions.

It exists separately from [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) so the strategy can stay stable while future sessions still have a record of what was actually run and verified.

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
