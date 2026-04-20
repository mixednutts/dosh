# Plan: Dynamic Account Balance Calculation from Last Closed Cycle

## 1. AGENTS.md Compliance & Pre-Implementation Checklist

**Hard Controls Applied:**
- **#1 No Commits:** All changes will be made via file edits only; user will commit manually.
- **#6 Root-Cause Fix:** This change addresses the root cause (stored opening balances in open cycles become stale when earlier cycles receive transactions) by making the period-detail API compute balances dynamically from the last closed cycle rather than relying on stale stored values.
- **#7 Production Data Protection:** No production data modifications without explicit user approval. Any backfill or migration will be proposed but not executed without confirmation.
- **Plan Execution Guardrails (Enacted 2026-04-12):** Before implementation begins, the agent MUST create a complete `SetTodoList` mapping 1:1 to every section and acceptance criterion below. Implementation is blocked until the checklist is visible.

**Pre-Implementation TODO List (to be created in agent session):**
- [ ] **AGENTS.md Compliance Check:** Agent reads `AGENTS.md`, confirms understanding of Hard Controls #1 (no commits), #6 (root-cause fixes only), #7 (no production data without approval), and the Plan Execution Guardrails. Agent explicitly states compliance before proceeding.
- [ ] **Create `SetTodoList`** containing the following exact items:
  1. Implement `compute_dynamic_period_balances()` helper with forward-cycle limit check.
  2. Implement `propagate_balance_changes_from_period()` and wire into `sync_period_state()`.
  3. Add `max_forward_balance_cycles` column to `Budget` model and create Alembic migration.
  4. Update `Budget` schemas (Base/Update/Out) with validation for `max_forward_balance_cycles` (1–50).
  5. Integrate dynamic calculation into `GET /api/periods/{finperiodid}` endpoint; return 204 for limit-exceeded.
  6. Integrate dynamic calculation into `GET /api/periods/{finperiodid}/balances` endpoint; return 204 for limit-exceeded.
  7. Update `build_closeout_preview()` to use fresh/dynamic balances for open cycles.
  8. Add stale-data guard to `validate_transfer_against_source_account()`.
  9. Add Budget Settings UI input for `max_forward_balance_cycles`.
  10. Update `BalanceSection` to show banner on 204 response.
  11. Update `PeriodDetailPage` to handle 204 from balances endpoint.
  12. Write backend tests: no closed cycles fallback.
  13. Write backend tests: transaction in first open cycle propagates to second.
  14. Write backend tests: anchor to most recent closed cycle.
  15. Write backend tests: transfers reconcile correctly.
  16. Write backend tests: propagation after income actual update/add.
  17. Write backend tests: propagation after expense entry/actual update.
  18. Write backend tests: propagation after investment transaction.
  19. Write backend tests: transfer validation uses fresh closing amount.
  20. Write backend tests: transfer validation defensive guard catches stale data.
  21. Write backend tests: all transaction entry points leave no stale balances.
  22. Write backend tests: forward limit returns 204 No Content.
  23. Write backend tests: forward limit allows within limit (200 OK).
  24. Write backend tests: forward limit respects custom budget setting.
  25. Write frontend tests: BalanceSection banner on limit exceeded.
  26. Execute gap-analysis reconciliation test (zero anomalies).
  27. Run full backend test suite and ensure all pass.
  28. Run full frontend test suite and ensure all pass.
  29. Perform manual verification: 2 open cycles, income in cycle 1 updates cycle 2 UI.
  30. Perform manual verification: close cycle 1, income in cycle 2 updates cycle 3 but cycle 1 stays frozen.
  31. Review `git diff` for unintended changes.
  32. Verify no commits made by agent.
  33. **Move this plan document** from `/home/ubuntu/.kimi/plans/spectrum-hal-jordan-iceman.md` to the dosh project plans folder per `DOCUMENTATION_FRAMEWORK.md` and update `DOCUMENT_REGISTER.md`.

---

## 2. Problem Analysis & Design Decision

### Current Behavior
- `PeriodBalance` stores `opening_amount`, `movement_amount`, and `closing_amount` per period per account.
- When transactions are recorded in period *N*, `sync_period_state` updates period *N*'s `movement_amount` and `closing_amount`, but it does **not** propagate the new closing balance to periods *N+1, N+2, ...*.
- `recalculate_budget_chain` (which propagates openings) is only called after generation, closeout, and deletion—not after routine transactions.
- The frontend `BalanceSection` displays the stored `PeriodBalance` values directly, so later open cycles show stale opening/closing balances.

### Target Behavior
- **Closed cycles** are immutable snapshots. Their stored `closing_amount` is the absolute truth and serves as the calculation base **when one exists**.
- **Open cycles** (Current, Pending Closure, Planned) must show dynamically calculated balances:
  1. Find the most recent `CLOSED` cycle before the target period. **If no closed cycle exists, use `BalanceType.opening_balance` per active account as the starting base.**
  2. Use that closed cycle's `closing_amount` per account as the starting base (or `BalanceType.opening_balance` if no closed cycle exists).
  3. Walk forward chronologically through all subsequent open cycles up to the target period.
  4. For each open cycle:  
     `opening = previous_cycle_computed_closing`  
     `movement = sum(transaction deltas for this cycle and account)`  
     `closing = opening + movement`
  5. Return the computed values for the target period in period detail and balance list endpoints.

### Design Decision: Hybrid Approach with Configurable Forward-Calculation Limit
1. **Frozen Stored Values for Expired Cycles:** `CLOSED` and `PENDING_CLOSURE` cycles are considered expired/frozen. Their `PeriodBalance` rows are physically stored and never dynamically recalculated—they serve as immutable anchors.
2. **Dynamic Read Layer with Limit:** Create a backend helper `compute_dynamic_period_balances(finperiodid, db, max_forward_cycles)` that performs the walk-from-last-closed calculation **only** for `PLANNED` and `CURRENT` cycles, and only up to a configurable maximum number of forward-looking cycles from the most recent frozen anchor.
3. **Configurable Limit Setting:** Add a new budget setting `max_forward_balance_cycles` (default: 10, min: 1, max: 50) exposed in Budget Settings. This controls how many cycles the dynamic balance calculation will traverse before returning a "limit exceeded" state.
4. **Limit Exceeded UX:** If the target period is more than `max_forward_balance_cycles` ahead of the last frozen anchor, the backend returns a flag `balances_limit_exceeded: true`. The frontend `BalanceSection` renders an informational banner instead of the balance table: *"The Planned budget cycles exceeds allowed limits for forward calculation."*
5. **Stored-Value Propagation Fix:** After `sync_period_state` runs for any period, trigger a targeted rebalance of **all later open periods up to the configured limit** so that stored `PeriodBalance` rows (used by transfer validation, health checks, etc.) remain consistent with the dynamically computed truth within the allowed window.
   - This avoids a display-vs-storage split that would break `validate_transfer_against_source_account` and other balance-dependent logic.

---

## 3. Validity Assessment Strategy

Before code changes are deployed, the following validation checks must be executed and passed:

### 3.1 Mathematical Correctness
- **Budget Shape: Single open cycle, no closed cycles**  
  Dynamic calculation should fall back to `BalanceType.opening_balance` as the base. `opening + movement = closing` must hold.
- **Budget Shape: One closed cycle + multiple open cycles within limit**  
  After adding transactions to the first open cycle, the second and third open cycles must reflect the updated closing balance in their `opening_amount`.
- **Budget Shape: Forward cycles exceed configured limit**  
  When the number of open cycles from the last frozen anchor exceeds `max_forward_balance_cycles`, the API must return `balances_limit_exceeded: true` and the frontend must display the banner instead of the balance table.
- **Budget Shape: Multiple closed cycles**  
  Calculation must anchor to the *most recent* closed cycle, not the first closed cycle.
- **Budget Shape: Account added mid-chain**  
  New accounts that lack `PeriodBalance` rows in early closed cycles should still compute correctly from their first appearance onward.

### 3.2 Transaction Reconciliation
- For each test budget shape, record a mix of:
  - Income credits (positive to linked account)
  - Expense debits (negative from linked account)
  - Investment credits/debits
  - Account transfers (source ↓, destination ↑)
- Verify that `movement_amount` for each account equals the net sum of its linked transactions in that period.
- Verify that cross-period chaining yields identical closing balances whether computed dynamically or by calling `recalculate_budget_chain`.

### 3.3 API Consistency Audit
- `GET /api/periods/{id}` and `GET /api/periods/{id}/balances` must return identical `opening_amount`, `movement_amount`, and `closing_amount` for the same period.
- `POST /api/periods/{id}/account-transfer` validation (which reads `pb.closing_amount`) must use the freshly propagated stored value, not a stale one.
- `GET /api/periods/{id}/closeout-preview` must also reflect dynamically computed balances if the cycle is open.

### 3.4 Regression Checks
- Existing backend tests (`test_transactions_and_balances.py`, `test_account_transfer_validation.py`, `test_budget_setup_workflows.py`) must continue to pass.
- Frontend tests for `BalanceSection` must pass (no breaking schema changes).

---

## 4. Implementation Steps

### Step 4.1 — Backend: Dynamic Balance Computation Helper
**File:** `backend/app/transaction_ledger.py` (or new `backend/app/balance_engine.py` if the agent determines a new module is cleaner)

Create `compute_dynamic_period_balances(finperiodid: int, db: Session, max_forward_cycles: int = 10) -> dict` returning either `{"balances": list[PeriodBalanceOut]}` or `{"limit_exceeded": true}`:
1. Load the target period and all budget periods ordered by `startdate`.
2. Find the index of the target period.
3. Scan backward from the target to find the most recent frozen anchor (`CLOSED` or `PENDING_CLOSURE`). **If none exists, this is expected for new budgets—proceed with `BalanceType.opening_balance` as the base.**
4. Count the number of cycles from the anchor (exclusive) to the target period (inclusive). If this count exceeds `max_forward_cycles`, return `{"limit_exceeded": true}` immediately.
5. Build a dict of base balances:
   - **If a frozen anchor exists:** use its stored `PeriodBalance.closing_amount` per account.
   - **If no frozen anchor exists:** use `BalanceType.opening_balance` per active account. **Also handle inactive accounts that still have `PeriodBalance` rows in open cycles.**
6. Walk forward from the anchor (or from the first period) through all periods up to and including the target:
   - For each period, load all `PeriodTransaction` with `entry_kind == "movement"`.
   - For each account, compute `movement = sum(account_delta_for_transaction(tx, account))`.
   - Set `opening = base[account]`, `closing = opening + movement`, then update `base[account] = closing`.
7. Return `{"balances": [...]}` with `PeriodBalanceOut` objects for the target period, enriched with `balance_type`.

### Step 4.2 — Backend: Propagate Stored Values After Transactions
**File:** `backend/app/transaction_ledger.py`

Create `propagate_balance_changes_from_period(finperiodid: int, db: Session, max_forward_cycles: int = 10) -> None`:
1. Load all later periods for the same budget where `cycle_stage` is `CURRENT` or `PLANNED`, ordered by `startdate`.
2. **Enforce the forward limit:** stop propagation after `max_forward_cycles` periods.
3. For each later period within the limit, update `PeriodBalance.opening_amount` to the previous period's stored `closing_amount`.
4. Re-run `sync_period_state` for each affected later period (or at minimum recompute `movement_amount` and `closing_amount` using the same transaction logic).

Modify `sync_period_state` to call `propagate_balance_changes_from_period(finperiodid, db)` at the end of its execution, reading the budget's `max_forward_balance_cycles` setting.

### Step 4.3 — Backend: New Setting Schema & Migration
**Files:**
- `backend/app/models.py` — add `max_forward_balance_cycles` column to `Budget` (Integer, nullable=False, default=10).
- `backend/app/schemas.py` — add `max_forward_balance_cycles` to `BudgetBase`, `BudgetUpdate`, and `BudgetOut` with validator ensuring value is between 1 and 50.
- `backend/alembic/versions/` — create a new Alembic migration to add the column with default 10.

### Step 4.4 — Backend: Integrate Dynamic Calculation into API Endpoints
**Files:**
- `backend/app/routers/periods.py` — `_load_period_detail_components`
- `backend/app/routers/balance_types.py` — `list_period_balances`

Replace the direct `db.query(PeriodBalance)` loading with a call to `compute_dynamic_period_balances` when the target period is **not** `CLOSED`. For `CLOSED` periods, continue returning stored values (the immutable snapshot rule).

Modify the existing `GET /api/periods/{finperiodid}/balances` endpoint:
- If the target period is within `max_forward_balance_cycles` of the last frozen anchor, return HTTP 200 with the computed `list[PeriodBalanceOut]` as before.
- **If the forward limit is exceeded, return HTTP 204 No Content.**
- The frontend interprets a 204 response on the balances endpoint as "limit exceeded" and renders the informational banner in place of the balance table. This avoids deprecated endpoints, wrapper objects, and schema-breaking changes.

### Step 4.5 — Backend: Ensure Closeout Preview Uses Dynamic Values
**File:** `backend/app/cycle_management.py`

In `build_closeout_preview`, before computing totals/health, ensure the period's balances are freshly computed (or that `recalculate_budget_chain` has been called). If the period is open, the preview should reflect the true current state.

### Step 4.6 — Frontend: Settings UI for New Limit
**File:** `frontend/src/pages/tabs/BudgetSettingsTab.jsx` (or equivalent settings component)

Add a numeric input for "Maximum forward balance calculation cycles" with:
- Label and help text explaining that large numbers of planned cycles may impact performance.
- Min 1, Max 50.
- Default value 10.

### Step 4.7 — Frontend: BalanceSection Limit Banner
**File:** `frontend/src/components/period-sections/BalanceSection.jsx`

- Accept a new prop `limitExceeded: bool`.
- If `limitExceeded` is true, render an informational banner instead of the table:
  ```jsx
  <div className="card">
    <div className="px-4 py-6 text-center text-sm text-gray-600 dark:text-gray-400">
      The Planned budget cycles exceeds allowed limits for forward calculation.
      <br />
      <span className="text-xs text-gray-500">
        Adjust the limit in Budget Settings if needed.
      </span>
    </div>
  </div>
  ```
- Update `PeriodDetailPage` to call the new `balances-computed` endpoint and pass `limitExceeded` to `BalanceSection`.

### Step 4.8 — Backend Tests
**File:** `backend/tests/test_dynamic_account_balances.py` (new)

Add tests covering:
1. `test_dynamic_balances_with_no_closed_cycles` — **explicitly tests the no-closed-cycle case**; verifies fallback to `BalanceType.opening_balance` and correct chaining across multiple open cycles.
2. `test_dynamic_balances_after_transaction_in_first_open_cycle` — second open cycle picks up new closing.
3. `test_dynamic_balances_anchor_to_most_recent_closed_cycle` — multiple closed cycles exist.
4. `test_dynamic_balances_with_transfers` — transfer out of savings, both accounts reconcile.
5. `test_stored_values_propagate_after_income_actual_update` — verify `GET /balances` on later period matches after `sync_period_state` propagation.
6. `test_stored_values_propagate_after_expense_entry` — same for expense entries.
7. `test_stored_values_propagate_after_investment_transaction` — same for investment transactions.
8. `test_stored_values_propagate_after_expense_actual_set` — same for direct expense actual updates.
9. `test_stored_values_propagate_after_income_actual_add` — same for additive income actual updates.
10. `test_transfer_validation_uses_fresh_closing_amount` — ensure transfer against a later period validates against propagated balance.
11. `test_transfer_validation_defensive_guard_catches_stale_data` — intentionally bypass propagation in a test-only hook and verify the defensive guard in `validate_transfer_against_source_account` still rejects the transfer based on the true computed balance.
12. `test_all_transaction_entry_points_leave_no_stale_balances` — parameterized or sequential test that exercises every public transaction endpoint (income set/add, expense set/add, expense entries, investment transactions, account transfer) and asserts that **all** later open periods have stored values matching dynamically computed values.
13. `test_forward_limit_returns_204_no_content` — generate 15 open cycles with default limit 10; request cycle 12 and assert HTTP 204 with empty body.
14. `test_forward_limit_allows_within_limit` — request cycle 10 and assert HTTP 200 with balances array.
15. `test_forward_limit_respects_custom_budget_setting` — set `max_forward_balance_cycles = 5`, generate 7 cycles, request cycle 6, assert `limit_exceeded: true`.

### Step 4.9 — Frontend Verification
**Files:**
- `frontend/src/components/period-sections/BalanceSection.jsx`
- `frontend/src/pages/PeriodDetailPage.jsx` (or equivalent)

Verify that:
- `BalanceSection` correctly displays `opening_amount`, `movement_amount`, and the computed `closing_amount` when `limitExceeded` is false.
- `BalanceSection` renders the banner when `limitExceeded` is true.
- `PeriodDetailPage` handles the 204 response from the existing balances endpoint and passes `limitExceeded=true` to `BalanceSection`.
- Run existing frontend tests (`BalanceSection` related tests, `PeriodDetailPage` tests) to confirm no regressions.
- Add a frontend test for the limit-exceeded banner state.

### Step 4.10 — Gap Analysis & Reconciliation
Execute SQL-style reconciliation queries (via test assertions or a dedicated script) to ensure zero anomalies:

```sql
-- For every non-CLOSED period within the budget's max_forward_balance_cycles window,
-- compare stored closing_amount vs dynamically computed closing_amount.
-- Anomaly count must be 0 after the propagation fix is applied.
```

Implement this as a backend test that deliberately creates stale data, then calls the propagation helper, then asserts all stored values match dynamically computed values within the allowed window.

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation | Residual Likelihood | Residual Impact |
|------|------------|--------|------------|---------------------|-----------------|
| **Performance degradation on period detail load** | Medium | Medium | The dynamic calculation is capped at `max_forward_balance_cycles` (default 10). Frozen cycles (`CLOSED`/`PENDING_CLOSURE`) use stored values and are never recalculated. Only open cycles within the limit are computed. The limit is user-configurable (1–50) in Budget Settings; bulk-load transactions for the limited window in a single query. | Low | Low |
| **Transfer validation uses stale stored values** | High | High | (1) Add propagation as a mandatory post-step inside `sync_period_state` so no caller can forget it. (2) Add an explicit stale-data guard in `validate_transfer_against_source_account` that dynamically recomputes the source account's true closing balance if the stored value disagrees with a quick dynamic check. (3) Create a comprehensive "all entry points" test suite that records every transaction type and immediately asserts that stored values in all later open periods are fresh. (4) Add a nightly/CI audit test that randomly generates transactions and verifies zero stale-balance anomalies across the chain. | Low | Low |
| **Closeout snapshot inconsistency** | Medium | High | Ensure `recalculate_budget_chain` is called inside `close_cycle` before the snapshot is taken (it already is, but verify). | Low | Low |
| **Frontend tests break due to unexpected decimal precision** | Low | Low | Dynamic calculation uses `_rounded()`; ensure all paths quantize to 2 decimal places. | Very Low | Very Low |
| **Data migration needed for existing stale balances** | Low | Medium | Existing production budgets may have stale `PeriodBalance` rows for open cycles. After deployment, run `recalculate_budget_chain` for each budget (can be done via an Alembic data-migration or a one-off management command). **Requires user approval per Hard Control #7.** | Low | Low |
| **New account added after closed cycles gets wrong opening** | Low | High | Explicit test for this scenario; default to `BalanceType.opening_balance` when no prior row exists. | Very Low | Low |
| **Display vs. storage divergence confuses debugging** | Medium | Medium | Add a code comment/docstring on `compute_dynamic_period_balances` explaining that open cycles are dynamically derived; keep stored values in sync via propagation to minimize divergence. | Low | Low |

---

## 6. Rollback & Recovery Procedures

Given that this environment uses `scripts/release_with_migrations.sh` for local Docker deployment and the container carries production data, the following rollback procedures must be understood **before** any deployment:

### 6.1 Pre-Deployment Safety Steps
1. **Verify Git Working Tree is Clean** before starting implementation: `git status` should show no uncommitted changes.
2. **Note the Current Alembic Head** before creating any new migration: run `docker exec dosh alembic current` and record the revision hash.
3. **No Production Data Modification Without Approval:** If a data backfill or migration is required, the user must explicitly approve it per Hard Control #7.

### 6.2 Code-Only Rollback (Before Docker Deployment)
If the user decides to abort before running `scripts/release_with_migrations.sh`:
- Revert all modified files: `git checkout -- <files>` or `git reset --hard HEAD` (user executes manually).
- Delete any new test files: `rm backend/tests/test_dynamic_account_balances.py`.
- Remove any new Alembic migration file if one was generated.
- Run backend and frontend tests to confirm the codebase is back to the known-good state.

### 6.3 Post-Deployment Rollback (After `release_with_migrations.sh`)
If the new code has been deployed to the local Docker container and the user wants to revert:

#### Step A: Stop the New Container
```bash
# User executes manually
cd /home/ubuntu/dosh
docker compose stop dosh
```

#### Step B: Alembic Downgrade (If a New Migration Was Applied)
If the deployment included a new Alembic migration (e.g., adding `max_forward_balance_cycles` to the `Budget` table), it must be downgraded **inside the container** before reverting the image:
```bash
# User executes manually
docker exec dosh alembic downgrade -1
```
- Verify the downgrade succeeded: `docker exec dosh alembic current` should show the pre-change revision.
- **CRITICAL:** Do NOT downgrade if doing so would lose data the user cares about. If the migration added a column, downgrading is generally safe. If it performed a data backfill, the user must explicitly approve the downgrade per Hard Control #7.

#### Step C: Revert Docker Images
`scripts/release_with_migrations.sh` builds new images tagged with the current version. To roll back:
1. Identify the previous working image tag: `docker images | grep dosh`.
2. Update `docker-compose.yml` (or an override) to point the `dosh` service to the previous image tag.
3. Alternatively, if the previous images were untagged but still present, the user can rebuild from the pre-change Git commit:
   ```bash
   git stash
   git checkout HEAD~1  # or the known-good commit
   scripts/release_with_migrations.sh
   ```
   - **Note:** If rolling back via `release_with_migrations.sh` from an older commit, ensure the Alembic state in the database matches what that commit expects.

#### Step D: Restart with Previous Code
```bash
docker compose up -d dosh
```

#### Step E: Verify Rollback
- Check application health: `docker logs dosh` should show no errors.
- Run smoke tests: `pytest backend/tests/test_app_smoke.py -v`.
- Verify the UI loads correctly and account balances display as they did before the change.
- Confirm the database schema matches the running code's expectations.

### 6.4 Emergency Recovery (If Rollback Fails)
If the container fails to start after rollback:
1. **Do NOT copy local files into Docker volumes.**
2. Inspect logs: `docker logs dosh`.
3. If the issue is an Alembic version mismatch, manually align the database by running the appropriate `alembic upgrade` or `alembic downgrade` command inside the container.
4. If the database is in an inconsistent state, report it to the user with evidence and **ask for explicit approval** before running any repair commands.

### 6.5 Rollback Checklist
- [ ] User confirms rollback is desired.
- [ ] Alembic current revision is recorded before any downgrade.
- [ ] Any new migration is downgraded (if safe and approved).
- [ ] Docker images are reverted to the pre-change version.
- [ ] Container starts successfully with no schema errors.
- [ ] Smoke tests pass.
- [ ] UI account balances display correctly.

---

## 7. Post-Implementation Verification Checklist

Before declaring the work complete and before any deployment script is run:

- [ ] All 139+ backend tests pass.
- [ ] All 54+ frontend tests pass.
- [ ] New backend tests in `test_dynamic_account_balances.py` pass.
- [ ] Gap-analysis test confirms zero anomalies between stored and computed values.
- [ ] Manual verification: create a budget with 2 open cycles, add income to cycle 1, verify cycle 2's opening balance updates in the UI.
- [ ] Manual verification: close cycle 1, add income to cycle 2 (now first open cycle), verify cycle 3's opening balance updates but cycle 1's closing balance remains unchanged.
- [ ] `git diff` reviewed for unintended changes.
- [ ] No commits made by agent (user commits manually).
