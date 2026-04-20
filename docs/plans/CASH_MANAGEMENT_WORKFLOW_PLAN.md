# Cash Management Workflow Plan

## Overview

This plan defines the high-level implementation for supporting cash-management workflows in Dosh. It covers:
1. Generalising "Transfer from Savings" to "Transfer from Account" with balance validation
2. Allowing account selection when recording expense transactions
3. Ensuring investment transactions track their linked cash account consistently
4. Hardening budget-setup primary-account controls
5. Ensuring period summaries reconcile with transaction history per account
6. Backfilling existing transaction data and expanding test coverage

---

## 1. Transfer from Account (Generalised Transfer Income)

### Current State
- `AddIncomeLineModal.jsx` has a `"savings"` mode that calls `savingsTransfer()`
- Backend endpoint `POST /periods/{finperiodid}/savings-transfer` enforces `balance_type == 'Savings'`
- It creates a `PeriodIncome` row named `"Transfer from {balancedesc}"` and relies on `build_income_tx` (when the user later records actuals) to create a `PeriodTransaction` with `source="transfer"`, `affected_account_desc=primary_account`, and `related_account_desc={balancedesc}`

### Changes Required

#### Backend
1. **Rename/generalise endpoint**
   - Create `POST /periods/{finperiodid}/account-transfer` (or evolve the existing endpoint)
   - Remove the hard `balance_type == 'Savings'` check
   - Allow any **active** account belonging to the budget
   - Reject the transfer if a `"Transfer from {balancedesc}"` income line already exists for this period. **Rationale:** Once the line exists, the user should use the existing budget-cycle functionality to adjust it—either by recording additional transfer transactions (which increase `actualamount`) or by using the period-detail budget-adjustment workflow to change `budgetamount`. Creating a second transfer line for the same source account would fragment the ledger and break the 1:1 mapping between source account and transfer income line.
   - Create the `PeriodIncome` row exactly as before (the name `"Transfer from {balancedesc}"` can remain; it is already generic)

   **Transfer In vs Transfer Out Logic**
   
   The generalised transfer endpoint supports both directions of account-to-account movement using the same underlying `PeriodTransaction` model:
   
   - **Transfer In** (existing pattern, now source-generalised): Money moves from a non-primary account into the primary transaction account. Example: `Savings → Primary`.
     - `affected_account_desc` = Primary (destination)
     - `related_account_desc` = Savings (source)
   - **Transfer Out** (newly enabled): Money moves from the primary transaction account into another account. Example: `Primary → Cash` (e.g., user withdraws cash).
     - `affected_account_desc` = Cash (destination)
     - `related_account_desc` = Primary (source)
   - **Account-to-account transfer** (other pairs): Money moves directly between any two active accounts. Example: `Savings → Cash`.
     - `affected_account_desc` = Cash (destination)
     - `related_account_desc` = Savings (source)
   
   In all cases, the source account is debited and the destination account is credited. The `PeriodIncome` line name encodes both accounts (e.g., `"Transfer from {source} to {destination}"`) so the ledger intent is unambiguous.
   
   **Transfer Validation Analysis**
   
   Because a transfer may be created mid-cycle and later receive transactions, the validation must use the *committed* transfer amount, not simply the requested budget or a static balance check. The committed amount is derived from the `PeriodIncome` line state:
   
   - **If the line is `Paid`:** the transfer is finalized. Use `actualamount`.
   - **If the line is not `Paid`:** the committed amount is `max(budgetamount, actualamount)`.
     - When `actualamount > budgetamount`, more has already been transferred than originally budgeted, so the actual is the committed figure.
     - When `actualamount < budgetamount`, the full budgeted amount is still intended to be transferred, so the budget remains the committed figure.
   
   At **line-creation time**, validate that the source account's current period balance can absorb the requested budget amount (the initial commitment).
   
   At **transaction-recording time** (`build_income_tx` for transfer sources), validate that the source account can absorb the *incremental* transaction amount without the total committed transfer exceeding the source account's available balance. The source account's "available balance" for validation purposes is its `PeriodBalance.closing_amount` in the current period (or `opening_amount + movement_amount` excluding the new transaction).
   
   This validation logic should be extracted into a reusable helper (e.g., `validate_transfer_against_source_account`) so it can be called both when the income line is created and when additional transfer transactions are recorded.

2. **Update `build_income_tx`**
   - For `incomedesc.startswith(TRANSFER_PREFIX)`:
     - Parse both source account and destination account from the transfer line name or from stored metadata
     - `affected_account_desc` = **destination account** (the money lands there)
     - `related_account_desc` = **source account** (the money leaves from)
   - No new DB column needed — `PeriodTransaction` already stores both fields

3. **Update schemas**
   - Rename `SavingsTransferRequest` → `AccountTransferRequest` (no alias)
   - Add `source_account: str` and `destination_account: str` fields
   - Remove savings-specific validation

#### Frontend
1. **Update `AddIncomeLineModal.jsx`**
   - Rename mode `"savings"` → `"transfer"`
   - Rename tab label `"Transfer from Savings"` → `"Transfer from Account"`
   - Show two dropdowns:
     - **From Account** (source): all active accounts
     - **To Account** (destination): all active accounts, defaulting to the primary transaction account
   - Filter out combinations that already have a matching transfer income line in this period
   - The generated income line name should encode both accounts, e.g. `"Transfer from {source} to {destination}"`
   - Call the updated API endpoint

2. **API client**
   - Rename `savingsTransfer` → `accountTransfer`
   - Update URL to `/periods/${periodId}/account-transfer`
   - Update payload shape to include `source_account` and `destination_account`

---

## Circular Transfer Risk Assessment

### Question
What is the risk if a user creates multiple income transfer transactions that form a circular reference (e.g., transfer from Savings to Cash, then transfer from Cash back to Savings)?

### Assessment
**Risk Level: MEDIUM** under the revised plan.

Because both **source** and **destination** accounts are selectable, a user can now create transfer patterns that were previously impossible:
- "Transfer from Savings to Cash" → debits Savings, credits Cash
- "Transfer from Cash to Savings" → debits Cash, credits Savings
- This creates a genuine two-way flow between any pair of accounts.

**Circular reference risk**
A true circular reference (A → B → A within the same period) is theoretically possible but operationally unlikely:
- The user would need to create two opposing transfer lines in the same period.
- Each transfer line records against a distinct `PeriodIncome` row and creates its own `PeriodTransaction` rows.
- The ledger remains mathematically consistent: A loses X, B gains X, B loses X, A gains X. The period balances net out correctly.
- The main risk is **user confusion** or **inflated income reporting** if the user treats both legs as income rather than recognising they are offsetting movements.

**Self-referential transfer (A → A)**
- If source == destination, `account_delta_for_transaction` computes net-zero balance movement (+amount − amount = 0).
- However, the income `actualamount` would still increase, creating a meaningless ledger entry that inflates income without moving money.

**Mitigation**
1. **Block self-referential transfers:** Reject any transfer request where `source_account == destination_account`.
2. **No additional cycle blocking is required for Beta:** Because the committed-amount validation already ensures each source account has sufficient balance, a user cannot create an infinite or uncollateralised circular chain. The ledger math is sound.
3. **Future hardening:** If users report confusion from opposing transfer lines, consider adding a visual hint or grouping transfer income lines by account pair.

---

## 2. Expense Setup Default Account + Transaction Account Selection

### Current State
- `build_expense_tx()` always sets `affected_account_desc = get_primary_account_desc(budgetid, db)`
- Users have no way to route an expense to a non-primary transaction account at either setup time or transaction time
- `ExpenseItem` has no field to store a default account
- `ExpenseEntryCreate` schema has no `account_desc` field

### Changes Required

#### Backend — Setup-Level Default Account
1. **Model changes**
   - Add `default_account_desc: Optional[str] = None` to `ExpenseItem` model

2. **Schema changes**
   - Add `default_account_desc: Optional[str] = None` to `ExpenseItemBase`, `ExpenseItemCreate`, `ExpenseItemUpdate`, and `ExpenseItemOut`

3. **Generation logic**
   - When generating a period or adding an expense to a period, use `expense_item.default_account_desc` as the account for the expense line. If null, fall back to `get_primary_account_desc()`.
   - Update `build_expense_tx()` to accept an optional `account_desc` and use it; callers should pass `expense_item.default_account_desc` when available.
   - Auto-generated expenses via `auto_expense.py` should use the expense item's `default_account_desc` if set, otherwise primary.

4. **Validation**
   - When saving an expense item, if `default_account_desc` is provided, validate that the account exists, is active, belongs to the budget, and is a `Transaction` type account.

#### Backend — Transaction-Level Override
5. **Schema changes**
   - Add optional `account_desc: str | None = None` to `ExpenseEntryCreate`
   - Add `affected_account_desc: Optional[str]` to `ExpenseEntryOut` so the frontend can read back the account used

6. **Router changes (`expense_entries.py`)**
   - In `add_entry()`, if `payload.account_desc` is provided:
     - Validate that the account exists, is active, and belongs to the budget
     - Use it as `affected_account_desc` (overriding the setup default)
   - If not provided, fall back to the expense item's `default_account_desc`, then to `get_primary_account_desc()`

7. **`transaction_ledger.py`**
   - Extend `build_expense_tx()` signature to accept `account_desc: str | None = None`
   - Use the passed account or fall back as described above

#### Frontend — Budget Setup Expense Modals
1. **Update `ExpenseItemsTab.jsx`, `AddExpenseLineModal.jsx`, and any edit modal**
   - Add a checkbox labelled dynamically based on the budget's `account_naming_preference`:
     - `"Use Primary Transaction Account"` (default)
     - `"Use Primary Everyday Account"`
     - `"Use Primary Checking Account"`
   - The checkbox defaults to **checked** (`use_primary_account: true`)
   - When checked, `default_account_desc` is stored as `null` (falls back to whatever primary is at generation/transaction time)
   - When unchecked, show an account dropdown with all active `Transaction` type accounts
   - Persist the selected account as `default_account_desc`

#### Frontend — Transaction Entry
2. **Update `ExpenseEntriesModal.jsx`**
   - Fetch budget `balanceTypes` (active accounts)
   - Pass `accounts`, `selectedAccount`, and `setSelectedAccount` down to `TransactionEntryForm`
   - Default the selector to the expense item's `default_account_desc` if set, otherwise the primary account
   - Include `account_desc` in the mutation payload

3. **Update `TransactionEntryForm.jsx`**
   - Add an `Account` dropdown when `accounts` prop is provided
   - Display the account name in the form
   - Ensure the dropdown is disabled when `locked === true`

4. **Transaction list display**
   - In `TransactionWorkflowModal` / `TransactionListPanel`, show the `affected_account_desc` for each expense transaction

#### Frontend
1. **Update `ExpenseEntriesModal.jsx`**
   - Fetch budget `balanceTypes` (active accounts)
   - Pass `accounts`, `selectedAccount`, and `setSelectedAccount` down to `TransactionEntryForm`
   - Default the selector to the primary account (or the first active account)
   - Include `account_desc` in the mutation payload

2. **Update `TransactionEntryForm.jsx`**
   - Add an `Account` dropdown when `accounts` prop is provided
   - Display the account name in the form (above or beside the amount/note fields)
   - Ensure the dropdown is disabled when `locked === true`

3. **Transaction list display**
   - In `TransactionWorkflowModal` / `TransactionListPanel`, show the `affected_account_desc` for each expense transaction so users can see which account was debited

---

## 3. Investment Transaction Account Tracking

### Current State
- `InvestmentItem` has `linked_account_desc` (optional)
- `build_investment_tx()` uses `item.linked_account_desc` as `affected_account_desc`
- `InvestmentTxOut` does **not** currently expose `affected_account_desc`

### Changes Required

#### Backend
1. **Schema changes**
   - Add `affected_account_desc: Optional[str]` to `InvestmentTxOut`
   - Add `linked_account_desc` to `PeriodInvestmentOut` (it appears to already be present per schema line 694)

2. **Router changes (`investment_transactions.py`)**
   - In `_to_investment_tx_out`, map `tx.affected_account_desc` into the response

#### Frontend
1. **Update `InvestmentTxModal.jsx`**
   - Read `affected_account_desc` from transactions and display it in the transaction list (reuse the same list-panel enhancement as expenses)
   - **No account override is permitted.** The investment account is determined entirely by `InvestmentItem.linked_account_desc` at budget setup. The transaction modal remains display-only for account information.

---

## 4. Budget Setup Primary Account Controls

### Current State
- `balance_types.py` already enforces:
  - One active primary `Transaction` account must exist
  - Cannot delete/deactivate the last active primary without designating another
  - `is_primary` is scoped per `balance_type`

### Review Actions
1. Verify that `Cash` balance types can also have a primary designation without conflicting with `Transaction` primary rules
2. Confirm that `Savings` primary behaves the same way (scoped, non-blocking)
3. Check that `balance_type == null` accounts do not accidentally bypass primary checks
4. No code changes expected unless review reveals a gap

---

## 5. Summary Calculation Reconciliation

### Current State
- `sync_period_state()` recalculates `PeriodBalance.movement_amount` by iterating all `PeriodTransaction` rows and calling `account_delta_for_transaction()`
- `account_delta_for_transaction` already respects `affected_account_desc` and `related_account_desc`

### Verification Steps
1. After implementing expense account selection, run a manual/integration test:
   - Create a budget with two transaction accounts (A primary, B secondary)
   - Record an expense against B
   - Assert that `PeriodBalance` for B reflects the debit and A remains unchanged
2. Do the same for investment contributions against a linked cash account
3. Do the same for a transfer from a non-savings account
4. Verify that period-detail totals (income, expense, investment, surplus) remain correct regardless of which account is used for individual transactions

---

## 6. Migration: Backfill Existing Transaction Data

### Scope
- Existing `ExpenseItem` rows need `default_account_desc` set to the current primary transaction account so that existing expenses continue to behave as before
- Existing `PeriodTransaction` rows where `source == 'expense'` and `affected_account_desc IS NULL` need to be backfilled with the primary transaction account that existed at the time of the transaction
- For `source == 'transfer'` and `affected_account_desc IS NULL`, backfill with the primary transaction account
- For `source == 'investment'` and `affected_account_desc IS NULL`, backfill with `InvestmentItem.linked_account_desc` (if available) or primary transaction account

### Approach
1. Create an Alembic migration (e.g., `backfill_transaction_accounts_and_expense_defaults`)
2. In the migration:
   - **ExpenseItem backfill:** For each budget with a primary transaction account, update all `ExpenseItem` rows where `default_account_desc IS NULL` to the primary account desc
   - **PeriodTransaction backfill:** Query all `PeriodTransaction` rows with `affected_account_desc IS NULL`
   - For each budget, determine the current primary transaction account
   - Update the transaction rows in batches
3. Add a `NOT NULL` constraint on `affected_account_desc` **only if** we are confident there are no edge cases (e.g., historical budgets with no transaction account). Given the hard control about production data, this migration will be designed to run safely and idempotently.

---

## 7. Testing Plan

### Backend Unit / Integration Tests
1. **Account transfer endpoint**
   - Happy path: transfer from a Cash account succeeds
   - Rejection: transfer from inactive account fails
   - Rejection: initial transfer budget exceeds source account available balance fails
   - Rejection: duplicate transfer line for same period fails
   - Validation logic: `Paid` line uses `actualamount` as committed; non-paid line uses `max(budget, actual)` as committed
   - Mid-cycle scenario: adding a transfer transaction when actual already exceeds budget validates against actual, not budget
   - Mid-cycle scenario: adding a transfer transaction when budget exceeds actual validates against budget
   - Manual adjustment: increasing a transfer line's budget via period-detail budget adjustment is allowed and updates the committed amount
   - Manual adjustment: recording additional transfer transactions on an existing line updates actualamount and re-validates against source account balance

2. **Expense entry with selected account**
   - Happy path: expense debits the selected non-primary account
   - Fallback: expense without `account_desc` debits the primary account
   - Rejection: expense with unknown/inactive account fails
   - Verification: `sync_period_state` updates the correct `PeriodBalance`

3. **Auto expense**
   - Auto-generated expenses continue to debit the primary account

4. **Investment transaction display**
   - `affected_account_desc` is returned in `InvestmentTxOut`

### Frontend Component Tests
1. `AddIncomeLineModal` — `"Transfer from Account"` tab shows all active accounts
2. `TransactionEntryForm` — account selector appears for expenses and submits the right `account_desc`
3. `ExpenseEntriesModal` — transaction list shows the account name for each entry
4. `BalanceTransactionsModal` — labels remain correct after transfer generalisation

### End-to-End Tests (Playwright)
1. **Baseline Personal with account transfer**
   - Create budget → add Transaction + Savings accounts → generate cycle
   - Record a transfer from Savings → verify primary account balance increases and savings decreases
   - Close cycle → verify balances carry forward correctly

2. **Multi Transaction with expense routing**
   - Create budget → add two Transaction accounts (A primary, B secondary)
   - Generate cycle → record expense against B
   - Verify B's movement reflects the expense and A does not
   - Close cycle → verify next cycle opening balances are correct

3. **Investment linked to cash account**
   - Create budget → add Transaction account + Investment linked to it
   - Generate cycle → record investment transaction
   - Verify investment closing value and linked account balance both update

---

## 8. Gap Analysis (Post-Implementation)

After the code changes are complete, run the following checks before declaring the feature done:

1. **Budget Setup Anomalies**
   - Query for budgets with >1 primary `Transaction` account
   - Query for budgets with 0 active primary `Transaction` accounts but existing generated periods

2. **Orphaned Transactions**
   - Query `PeriodTransaction` where `affected_account_desc` references a `BalanceType` that is deleted or inactive
   - Query `PeriodTransaction` where `related_account_desc` references a deleted/inactive account

3. **Balance / Summary Reconciliation**
   - For each period in the demo budget, compare:
     - `PeriodBalance.closing_amount` vs `opening_amount + movement_amount`
     - `movement_amount` vs sum of `account_delta_for_transaction` for all period transactions
     - `PeriodExpense.actualamount` vs sum of expense transactions
     - `PeriodIncome.actualamount` vs sum of income/transfer transactions
     - `PeriodInvestment.closing_value` vs `opening_value + actualamount`

4. **Close-Out Integrity**
   - Close a cycle that has expenses on multiple accounts
   - Verify the snapshot stores correct totals and the next cycle's opening balances match

---

## Implementation Sequence

1. **Backend schemas & router updates** (account transfer, expense account_desc, investment out schema)
2. **`transaction_ledger.py` changes** (build_expense_tx signature, build_income_tx for generalised transfers)
3. **Frontend API client & AddIncomeLineModal** (generalise transfer)
4. **Frontend ExpenseEntriesModal + TransactionEntryForm** (account selector)
5. **Frontend InvestmentTxModal** (display affected account)
6. **Alembic migration** (backfill existing transactions)
7. **Backend tests** (transfer validation, expense routing, sync_period_state)
8. **Frontend tests** (modal behavior, account selector)
9. **E2E tests** (full workflow across account shapes)
10. **Gap analysis & reconciliation verification**

---

## Rollback and Recovery Plan

If the cash management changes prove to have serious negative effects and require a complete redesign or reversal, the following rollback process should be executed.

### 1. Schema Rollback
- **Alembic downgrade:** Run `alembic downgrade -1` (or to the revision prior to `backfill_transaction_accounts_and_expense_defaults`) to remove the `default_account_desc` column from `ExpenseItem` and any schema constraints added.
- **Data preservation:** Before downgrading, export a snapshot of `PeriodTransaction` and `ExpenseItem` tables for the affected budgets so that manually re-entered data can be reconciled later if needed.

### 2. Data Recovery
- **Transaction account restoration:** If the backfill migration set `affected_account_desc` on historical transactions, the downgraded schema does not remove the column data (SQLite is permissive). The column simply reverts to optional/nullable. Existing transactions will continue to carry the backfilled value without breaking older code paths.
- **ExpenseItem defaults:** After downgrade, `default_account_desc` disappears. All expenses revert to implicit primary-account behavior, which is backward-compatible with pre-feature logic.

### 3. Docker-Aware Code Reversion and Redeployment
- **Local-first workflow:** All changes are developed and validated in the local Docker environment first (per AGENTS.md and MIGRATION_AND_RELEASE_MANAGEMENT.md). Rollback follows the same path.
- **Code reversion:** Revert backend routers, `transaction_ledger.py`, and frontend components to pre-feature versions using `git checkout -- <paths>` or `git revert`.
- **Image rebuild and deploy using the established script:**
  - Use `scripts/release_with_migrations.sh` exactly as in normal deployments. This script performs the canonical sequence: build images → back up the database → run migrations → restart containers.
  - Ensure `docker-compose.override.yml` is present and loaded, because the local environment's network, Traefik labels, and `DEV_MODE` gating depend on it.
  - After code reversion, running `scripts/release_with_migrations.sh` will build rolled-back images and redeploy the containers with the override applied.
- **Migration downgrades inside the container:** If the feature migration was applied inside the Docker volume, the downgrade must also run **inside the container** (`docker exec dosh alembic downgrade -1`) or via the migration step inside `release_with_migrations.sh`. Do not downgrade against a local filesystem SQLite file.
- **Volume integrity:** The production SQLite database lives in the Docker volume, not the local `dosh.db` file. Any rollback validation must target the containerised app, not the local file.

### 4. Validation After Rollback
- Run the full backend test suite (`pytest`) locally against an isolated test database.
- Run the full frontend test suite (`npm test`) locally.
- Deploy the rolled-back code to the local Docker environment via `scripts/release_with_migrations.sh` (with override) and verify that:
  - Existing budgets and periods load without error
  - Period balances reconcile correctly
  - Transfer, expense, and investment workflows behave as before
- Confirm that the in-app release notes and version display are unaffected.

### 5. Recovery If Rollback Itself Fails
- **Database restore:** If the Alembic downgrade corrupts data or fails, restore the pre-migration SQLite backup from the Docker volume (per MIGRATION_AND_RELEASE_MANAGEMENT.md). Use `docker cp` to extract the backup file and restore it to the container volume if needed.
- **Container restore:** If deployment fails after rollback, stop containers, rebuild images from the last known good commit, and redeploy using `scripts/release_with_migrations.sh` with the override file.
- **Never copy local files into the Docker volume:** As per Hard Control #7 and the documented data-loss incident, never use `cp` or `rsync` to overwrite the production database in the Docker volume with a local file.
- **Feature-flag fallback (future):** If this feature set is revisited, consider implementing it behind a budget-level feature flag so it can be toggled off without a code deployment.

---

## Risk Notes

- **Hard Control #6 (No workarounds):** Any balance discrepancies found during gap analysis must be fixed at the root cause (ledger calculation or missing transaction field), not patched in the UI.
- **Hard Control #7 (No production data changes without approval):** The Alembic migration will be designed to be safe and reversible, but must be explicitly approved by the user before running against the production Docker volume.
- Existing `PeriodTransaction` rows already have `affected_account_desc` populated for many records (transfers and income with linked accounts). The migration should only touch rows where it is null.
