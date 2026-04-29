# Budget Setup Restructuring for Multi-Shape Support

## Executive Summary

This plan restructures the budget setup layer to support multiple budget shapes through a simplified account model, an "Add Investment Line" modal in budget cycle details, transaction-level balance validation, and a documented budget-shapes matrix. The current three account types (`Transaction`, `Savings`, `Cash`) collapse to two (`Banking`, `Cash`) with an `is_savings` qualifier available on both types. The cosmetic `account_naming_preference` setting is removed. A new user setting controls whether manual transactions can overdraw accounts. Auto-expense operates independently and will create transactions regardless of available balance, with a visible note in Settings explaining this behaviour.

---

## 1. Budget Shapes Matrix

A **budget shape** is the combination of accounts (by type and role), investments, and expense configuration that defines how a budget operates. The matrix below documents every shape the app must support. This matrix becomes the canonical reference for future development and regression testing.

| Shape ID | Name | Accounts | Investments | Expenses | Primary Account | Supported | Demo? |
|----------|------|----------|-------------|----------|-----------------|-----------|-------|
| `S1` | Traditional Banking | 1+ Banking (spend), 1+ Banking (savings) | 1+ linked to savings account | Required | Banking (spend) | **Yes** | **Yes** |
| `S2` | Cash-Only | 1+ Cash (spend), optionally 1+ Cash (savings) | 0+ (linked to savings Cash if present) | Optional | Cash (spend) | **Yes** | No |
| `S3` | Banking-Only | 1+ Banking (spend), no savings | 0+ (must debit from spend) | Required | Banking (spend) | **Yes** | No |
| `S4` | Savings-Only | 1+ Banking (savings) OR 1+ Cash (savings) | 1+ linked to savings account | Optional | Any savings account | **Yes** | No |
| `S5` | Mixed Banking + Cash | 1+ Banking, 1+ Cash | 0+ | Required | Any active | **Yes** | No |
| `S6` | No-Expense Tracking | 1+ any account | 0+ | None | Any active | **Yes** | No |

### Shape Detail Definitions

#### S1 — Traditional Banking
- **Accounts:** At least one Banking account designated for spending (`is_savings=false`), optionally one or more Banking accounts designated for savings (`is_savings=true`).
- **Investment:** Linked to a savings Banking account (`linked_account_desc` points to `is_savings=true` account).
- **Expense default:** Debits the primary Banking (spend) account.
- **Demo seed:** Everyday Account (Banking, spend, primary) + Rainy Day Savings (Banking, savings) + Emergency Fund → Rainy Day Savings.

#### S2 — Cash-Only
- **Accounts:** One or more Cash accounts. At least one must be designated for spending (`is_savings=false`). Optionally one or more Cash accounts can be designated for savings (`is_savings=true`) — e.g. "Cash in Wallet" (spend) and "Cash under Mattress" (savings).
- **Investment:** Linked to a savings Cash account (`linked_account_desc` points to `is_savings=true` Cash account). If no savings Cash account exists, investments cannot be created (requires source + target accounts).
- **Expense default:** Debits the primary Cash (spend) account.
- **Key question resolved:** Cash accounts can be savings accounts. No contra transactions needed — two Cash accounts (spend + savings) provide the same two-sided transaction model as Banking.

#### S3 — Banking-Only
- **Accounts:** One or more Banking accounts, all `is_savings=false`.
- **Investment:** If present, must debit from a spend Banking account and credit to another Banking account.
- **Expense default:** Primary Banking account.

#### S4 — Savings-Only
- **Accounts:** One or more accounts, all `is_savings=true`. Can be Banking savings accounts, Cash savings accounts, or a mix.
- **Investment:** Linked to any savings account (Banking or Cash).
- **Expense default:** Primary savings account (expenses deduct from savings).

#### S5 — Mixed Banking + Cash
- **Accounts:** Combination of Banking and Cash accounts.
- **Primary:** Any active account regardless of type.
- **Investment:** Can link to Banking (savings) or be cash-only.

#### S6 — No-Expense Tracking
- **Accounts:** Any active account.
- **No expense items.** Budget used purely for income tracking, investment tracking, and account balance monitoring.
- **Setup assessment:** Must not require expenses or primary account for generation (already supported — primary only required when expenses exist).

---

## 2. Account Type Restructuring

### 2.1 Current State

| Field | Current Values | Usage |
|-------|---------------|-------|
| `BalanceType.balancedesc` | User-defined string | Account name/description (e.g. "Everyday Account", "Cash Under Mattress") |
| `BalanceType.balance_type` | `Transaction`, `Savings`, `Cash` | Determines UI badge, naming preference mapping, and some routing logic |
| `Budget.account_naming_preference` | `Transaction`, `Everyday`, `Checking` | Cosmetic — renames "Transaction" to user preference in UI |
| `IncomeType.issavings` | `true`/`false` | Marks income as pre-allocated to savings (excluded from surplus) |

### 2.2 Proposed New Model

| Field | New Values | Purpose |
|-------|-----------|---------|
| `BalanceType.balancedesc` | User-defined string | **Unchanged.** Account name/description entered by the user (e.g. "Everyday Account", "Cash Under Mattress") |
| `BalanceType.balance_type` | `Banking`, `Cash` | Distinguishes bank-tracked accounts from cash/physical accounts |
| `BalanceType.is_savings` | `true`/`false` | Marks this account as a savings/investment-holding account, regardless of whether it is `Banking` or `Cash` |
| `Budget.account_naming_preference` | **Removed** | No longer needed — user names accounts via `balancedesc` |

### 2.3 Mapping from Current to New

| Current `balance_type` | New `balance_type` | New `is_savings` |
|------------------------|-------------------|------------------|
| `Transaction` | `Banking` | `false` |
| `Savings` | `Banking` | `true` |
| `Cash` | `Cash` | User-defined (default `false`, can be set to `true`) |

### 2.4 Do We Need `balance_type` at All?

**Question:** If `is_savings` is available on all accounts, could we eliminate `balance_type` entirely and rely on `is_savings` plus account naming?

**Analysis:**

| Area | Impact of Removing `balance_type` |
|------|----------------------------------|
| **UI Badges** | Would lose color-coded type badges. Could replace with combined `balance_type` + `is_savings` badge ("Banking — Savings", "Banking — Spend", "Cash — Savings", "Cash — Spend"). |
| **Primary Account Resolution** | Already type-agnostic since v0.9.1-beta. No impact. |
| **Expense Default Routing** | Falls back to primary account. No impact. |
| **Investment Linked Account** | Would need `is_savings=true` to validate that investments link to savings-capable accounts. Applies to both Banking and Cash savings accounts. |
| **Cash-Only Investment Detection** | Currently uses `linked_account_desc IS NULL`. No direct dependency on `balance_type`. Cash savings accounts enable cash-only investments without contra logic. |
| **Balance Delta Calculation** | `transaction_ledger.py` delta logic is source-based, not type-based. No impact. |
| **Transfer Validation** | Already uses explicit account pairs. No impact. |
| **Income `issavings`** | Income marked `issavings=true` should route to an account with `is_savings=true` (Banking or Cash). Validation needed. |
| **Demo Budget Seeding** | `demo_budget.py` hardcodes `balance_type="Transaction"` and `balance_type="Savings"`. Would need migration. |
| **Database Queries Filtering by Type** | `BalanceType.balance_type == "Transaction"` no longer appears in backend (removed in v0.9.1-beta). `BalanceType.balance_type == "Cash"` appears in tests only. |

**User Decision:** Retain `balance_type` with values `Banking` and `Cash`.

**Rationale:**
1. UI presentation — users need to distinguish bank-tracked accounts from cash/physical accounts.
2. Future features — cash reconciliation and cash-only workflows depend on this distinction.
3. The `is_savings` flag provides the savings/spend role independently of the banking/cash medium, giving four valid combinations that cover all user scenarios including "cash under the mattress" savings.

**Valid account combinations:**

| `balance_type` | `is_savings` | Example Name | Use Case |
|---------------|-------------|--------------|----------|
| `Banking` | `false` | Everyday Account | Primary spending account |
| `Banking` | `true` | Rainy Day Savings | Bank savings / investment target |
| `Cash` | `false` | Wallet / Petty Cash | Physical cash for spending |
| `Cash` | `true` | Cash Under Mattress | Physical cash savings / investment target |

### 2.5 Downstream Impacts of Type Collapse

| File / Area | Change Required |
|-------------|-----------------|
| `backend/app/models.py` | `BalanceType.balance_type` stays `String`; add `BalanceType.is_savings` `Boolean` column |
| `backend/app/schemas.py` | Update `BalanceTypeBase`, `BalanceTypeCreate`, `BalanceTypeOut`, `BalanceTypeUpdate` |
| `backend/app/demo_budget.py` | Map `Transaction` → `Banking`/`is_savings=false`; `Savings` → `Banking`/`is_savings=true` |
| `backend/app/routers/balance_types.py` | Update `_assert_active_primary_will_remain()` and `_assert_delete_wont_remove_required_primary()` — no longer need `balance_type` checks |
| `frontend/src/pages/tabs/BalanceTypesTab.jsx` | Replace `BALANCE_TYPE_OPTIONS` with `['Banking', 'Cash']`; add `is_savings` checkbox (available for both types); remove `accountNamingPreference` prop usage |
| `frontend/src/utils/accountNaming.js` | **Delete file** — no longer needed |
| `frontend/src/pages/tabs/InvestmentItemsTab.jsx` | Remove `accountNamingPreference` usage; source account dropdown no longer needs type labels |
| `frontend/src/pages/tabs/IncomeTypesTab.jsx` | Remove `accountNamingPreference` usage |
| `frontend/src/pages/tabs/ExpenseItemsTab.jsx` | Remove `accountNamingPreference` usage |
| `frontend/src/pages/tabs/SettingsTab.jsx` | Remove `account_naming_preference` field entirely |
| `frontend/src/pages/BudgetDetailPage.jsx` | Remove `getPreferredTransactionLabel` usage |
| `frontend/src/components/transaction/ExpenseEntriesModal.jsx` | Remove `accountNamingPreference` usage if any |
| `backend/app/routers/budgets.py` | Remove `account_naming_preference` from `BudgetUpdate` handling |
| `backend/tests/test_budget_schema_validation.py` | Remove `account_naming_preference` tests |
| `backend/tests/test_backup_restore.py` | Update backup/restore payload to exclude `account_naming_preference` |
| `backend/tests/test_app_smoke.py` | Remove `account_naming_preference` smoke test |
| `backend/tests/test_setup_assessment.py` | Update tests that assert `balance_type` values |
| `backend/tests/test_balance_types.py` | If exists, update; otherwise tests in `test_setup_assessment.py` |
| `frontend/src/__tests__/BalanceTypesTab.test.jsx` | Update for new type options, `is_savings` field, removed naming preference |
| `frontend/src/__tests__/SettingsTab.test.jsx` | Remove `account_naming_preference` tests |
| `frontend/src/__tests__/BudgetDetailPage.test.jsx` | Update for generic primary account text |
| `frontend/src/__tests__/InvestmentItemsTab.test.jsx` | Remove naming preference mock |
| `frontend/src/__tests__/ExpenseItemsTab.test.jsx` | Remove naming preference mock |
| `frontend/src/__tests__/IncomeTypesTab.test.jsx` | Remove naming preference mock |
| `frontend/src/__tests__/BudgetPeriodsPage.test.jsx` | Update for generic primary account text |

### 2.6 Schema Migration

A destructive Alembic migration is required:

1. Add `is_savings` column to `balancetypes` with default `false`.
2. Backfill: `UPDATE balancetypes SET balance_type = 'Banking', is_savings = true WHERE balance_type = 'Savings'`.
3. Backfill: `UPDATE balancetypes SET balance_type = 'Banking', is_savings = false WHERE balance_type = 'Transaction'`.
4. Backfill: `UPDATE balancetypes SET balance_type = 'Cash' WHERE balance_type = 'Cash'`.
5. Drop `account_naming_preference` column from `budgets`.

**Backward compatibility:** Restore service already handles missing fields gracefully via Pydantic `exclude_unset=True` on `BudgetCreate`. For backups created before this change, the restore payload may contain `account_naming_preference`; it will be ignored by the schema. No compatibility shim needed.

---

## 3. Add Investment Line to Budget Cycle Details

### 3.1 Problem

Investment lines behave differently from expense lines. When created in Budget Setup, they only appear in cycles generated **after** their creation. Unlike expenses, there is no way to add an investment line to the current cycle from the Period Detail page. Users who create a new investment in setup cannot record transactions against it until the next cycle is generated.

### 3.2 Proposed Solution: `AddInvestmentLineModal`

Create an "Add Investment Line" modal in the Period Detail page, modelled on the existing `AddExpenseLineModal`. This gives users direct control over which investments appear in the current and future cycles they are actively working on.

**Modal Design (mirrors AddExpenseLineModal):**

| Element | Behavior |
|---------|----------|
| **Mode toggle** | `Existing item` / `New item` |
| **Existing item mode** | Dropdown of active `InvestmentItem` rows not already in this period. Auto-populates `planned_amount`, `initial_value`, `linked_account_desc`, `source_account_desc`. |
| **New item mode** | Inline form: Description, Initial/Seed Value, Planned Contribution, Effective Date, Source Account (debit), Target Account (credit), Primary checkbox. |
| **Scope** | `This budget cycle only` / `This + future unlocked budget cycles` |

### 3.3 Critical Difference from Expenses: Investment Continuity

Investment lines have **opening_value / closing_value continuity** across periods. This creates a complexity that expenses do not have:

**Scenario — Gap in Investment Coverage:**
1. Cycle 1 has "Emergency Fund" → closing_value = $600
2. Cycle 2 does NOT have "Emergency Fund" (was inactive or not added)
3. Cycle 3 re-adds "Emergency Fund" → what is the `opening_value`?

**Options:**

| Option | Behavior | Risk |
|--------|----------|------|
| A. Use `InvestmentItem.initial_value` | Opening resets to seed value; loses growth history | **High** — breaks investment tracking |
| B. Search backward for last period with this investment | Carry forward from most recent closing_value | Medium — requires backward query; may find very old value |
| C. Use most recent `PeriodInvestment.closing_value` regardless of gap | Same as B but broader search | Medium — same as B |
| D. Disallow scope="future" for new inline investments | Only allow adding to current cycle; future cycles get investment through normal generation | **Low** — simplest, preserves continuity |

**Recommendation:** Adopt a **hybrid approach** to manage complexity:

1. **Existing investment mode:** Always allowed. Adds the existing `InvestmentItem` to the current period's `PeriodInvestment` table. Opening value is computed by looking backward to the most recent period that contained this investment and using its `closing_value`. If none exists, falls back to `InvestmentItem.initial_value`.

2. **New item mode:** Allowed, but with restrictions:
   - **Scope "oneoff":** Creates `InvestmentItem` in setup (active=false by default) + `PeriodInvestment` in current cycle only. Future cycles do NOT get this investment automatically. This is for ad-hoc tracking.
   - **Scope "future":** Creates `InvestmentItem` in setup (active=true) + `PeriodInvestment` in current cycle. Future unlocked cycles also get the investment proactively. This is the equivalent of "add to setup and include now."

3. **Never silently skip periods:** If a user adds an investment with scope="future" but some unlocked periods between now and the end already exist without this investment, those periods must be backfilled to maintain continuity.

### 3.4 Backend Endpoint

New endpoint: `POST /budgets/{budgetid}/periods/{finperiodid}/add-investment`

Request schema (`AddInvestmentToPeriodRequest`):
```json
{
  "budgetid": 1,
  "investmentdesc": "Emergency Fund",
  "opening_value": 500.00,
  "budgeted_amount": 550.00,
  "scope": "oneoff" | "future",
  "note": "optional"
}
```

For **existing item** mode:
- Lookup `InvestmentItem` by `investmentdesc`
- Compute `opening_value` by querying backward for most recent `PeriodInvestment` with this `investmentdesc`
- Create `PeriodInvestment` for current period
- If scope="future", also create `PeriodInvestment` for all future unlocked periods, carrying forward closing values

For **new item** mode:
- First create `InvestmentItem` via existing `POST /budgets/{budgetid}/investment-items` logic
- Then proceed as existing item mode

### 3.5 Complexity Assessment

| Aspect | Risk Level | Rationale |
|--------|-----------|-----------|
| **Backward carry-forward query** | Medium | Must query across periods to find last closing value. Edge case: investment existed in a closed cycle that was since deleted. |
| **Gap backfilling (scope=future)** | Medium-High | If period N has investment, period N+1 doesn't, and user adds to N+2 with scope=future, N+1 must be backfilled or the carry-forward chain breaks. |
| **UI parity with AddExpenseLineModal** | Low | Pattern is proven; modal structure is well understood. |
| **Close-out with one-off investments** | Medium | One-off investments in a cycle won't exist in the next cycle. Close-out carry-forward must handle missing target investment. |

**Verdict:** Implementable with careful attention to the carry-forward logic. The backward query and gap backfilling are the highest-risk areas. A simpler v1 could restrict scope="future" to only backfill forward from the current period (no mid-gap filling), and let generation handle future cycles naturally.

### 3.6 Simplified v1 Recommendation

To reduce risk for the initial implementation:

1. **Existing item mode only** — no inline creation in the modal. Direct users to Budget Setup for creating new investments.
2. **Scope "oneoff" only** — adds investment to current cycle only. Future cycles get the investment through normal generation (if active in setup) or manual re-add.
3. **Opening value** — computed from most recent period with this investment (backward query across ALL periods, not just the immediate predecessor). Falls back to `InvestmentItem.initial_value`.
4. **No proactive backfilling** — if there's a gap, the backward query bridges it.

**Important side effect:** The backward query in v1 also fixes an existing gap bug in cycle generation. Currently, `_populate_period_investments` and `create_next_cycle` only check the immediately preceding period for `closing_value`. If an investment is missing from that period, the opening value resets to `initial_value`, silently losing growth history. The backward query used by `AddInvestmentLineModal` (and ideally applied to generation as well) searches across all periods to find the most recent closing value, correctly bridging gaps.

### 3.7 Files to Change

| File | Change |
|------|--------|
| `frontend/src/components/period-lines/AddInvestmentLineModal.jsx` | **New component** — mirrors AddExpenseLineModal, existing-item mode only, oneoff scope only |
| `frontend/src/components/period-lines/index.js` | Export new component |
| `frontend/src/pages/PeriodDetailPage.jsx` | Add modal trigger in InvestmentSection; pass `existingInvestmentDescs` |
| `frontend/src/components/period-lines/InvestmentSection.jsx` | Add `onAddInvestment` callback prop |
| `backend/app/routers/periods.py` | Add `POST /{finperiodid}/add-investment` endpoint |
| `backend/app/schemas.py` | Add `AddInvestmentToPeriodRequest` schema |
| `backend/app/period_logic.py` | Add `_compute_investment_opening_value(budgetid, investmentdesc, current_period, db)` helper |
| `frontend/src/api/client.js` | Add `addInvestmentToPeriod` API function |

---

## 4. Investment Default Source and Target Accounts

### 4.1 Current State

- `InvestmentItem.source_account_desc` (debit account) — visible in setup form, used as default in transaction modal.
- `InvestmentItem.linked_account_desc` (credit/target account) — **removed from UI in v0.8.5-beta** but still stored in DB and used by backend.
- Backend `build_investment_tx` uses `item.linked_account_desc` as `affected_account_desc` (credited) and `item.source_account_desc` as `related_account_desc` (debited, overridable via `account_desc` param).

### 4.2 Required Changes

1. **Restore `linked_account_desc` to the setup form:**
   - Add "Target Account" (credit) dropdown to `InvestmentForm` in `InvestmentItemsTab.jsx`.
   - Populate with active accounts where `is_savings=true` (Banking or Cash savings accounts).
   - Require a target account for all investments — cash-only budgets use a Cash savings account as the target.

2. **Display both accounts in the Add/Refund Investment modal:**
   - `InvestmentTxModal.jsx` currently shows only the debit account dropdown.
   - Add a read-only or editable "Target Account" field showing `linked_account_desc`.
   - If editable, allow changing to another valid account; validate that the new target exists and is active.

3. **Backend validation:**
   - `_assert_account_exists` already validates `linked_account_desc` and `source_account_desc`.
   - Ensure `linked_account_desc` is accepted as `null` for cash-only investments (if supported).

### 4.3 Downstream Impacts

| File | Change |
|------|--------|
| `frontend/src/pages/tabs/InvestmentItemsTab.jsx` | Add `linked_account_desc` dropdown to form; update `emptyForm` |
| `frontend/src/components/transaction/InvestmentTxModal.jsx` | Add target account display/selector |
| `backend/app/routers/investments.py` | `_assert_account_exists` already handles validation; ensure `null` is allowed for `linked_account_desc` |
| `backend/app/transaction_ledger.py` | `build_investment_tx` already uses `item.linked_account_desc`; no change needed |
| `backend/app/schemas.py` | Ensure `InvestmentItemCreate` and `InvestmentItemUpdate` allow `linked_account_desc: Optional[str]` |

---

## 5. Cash-Only Investment Design Decision

### 5.1 Resolved: Cash Accounts Can Be Savings Accounts

With `is_savings` available on **both** `Banking` and `Cash` accounts, the cash-only investment problem is resolved naturally:

- A cash-only budget can have a **Cash spend account** (`is_savings=false`, e.g. "Wallet") and a **Cash savings account** (`is_savings=true`, e.g. "Cash Under Mattress").
- Investment transactions debit the Cash spend account and credit the Cash savings account.
- The two-sided transaction model works identically to Banking accounts — no contra transactions needed.
- This aligns with the user's intent: "money stuffed in the pillow" is a legitimate savings approach.

### 5.2 Validation Rules

1. **Creating an investment line:** `linked_account_desc` (target) must be an active account with `is_savings=true`. This applies to both Banking and Cash accounts.
2. **Creating a Cash account:** The `is_savings` checkbox is available for all account types. Users can mark any Cash account as a savings account.
3. **Cash-only budget with investments:** Requires at least one Cash account with `is_savings=false` (source) and one with `is_savings=true` (target).

### 5.3 Budget Shape S2 Updated

| Shape ID | Investment Support | Requirement |
|----------|-------------------|-------------|
| S2 (Cash-Only) | Yes | Minimum 2 Cash accounts: 1 spend (`is_savings=false`) + 1 savings (`is_savings=true`) |

This is identical to the Banking model — the only difference is `balance_type="Cash"` instead of `balance_type="Banking"`.

---

## 6. Transaction Balance Sufficiency Validation

### 6.1 User Setting: `allow_overdraft_transactions`

Add a new budget setting that controls whether transactions are allowed to debit an account beyond its available balance.

| Setting | Type | Default | Behavior |
|---------|------|---------|----------|
| `allow_overdraft_transactions` | `Boolean` | `false` | When `false`, all manual transactions (expense, investment, transfer) that would overdraw the debit account are blocked with HTTP 422. When `true`, transactions proceed regardless of balance (current behavior). |

**UI Placement:** Settings tab, under its own heading above or adjacent to the Auto Expense section. The Auto Expense toggle must have a persistent visible note beneath it clarifying that auto-expense ignores this setting and will create transactions regardless of available balance.

**Backend:** Add column to `Budget` model. Include in `BudgetUpdate` schema.

### 6.2 Manual Transaction Validation

When `allow_overdraft_transactions == false`:

For **all** transaction types except income, before recording a transaction that debits an account, verify the account has sufficient committed balance.

**"Committed balance" definition:** The account's closing balance minus any already-committed outgoing amounts for the current period.

**Existing helper:** `validate_transfer_against_source_account` in `transaction_ledger.py` already implements this logic using `compute_dynamic_period_balances`.

| Transaction Type | Endpoint / Builder | Debit Account Field | Action |
|-----------------|-------------------|---------------------|--------|
| Expense | `build_expense_tx` | `account_desc` or primary account | Add sufficiency check |
| Investment | `build_investment_tx` | `account_desc` or `item.source_account_desc` | Add sufficiency check |
| Transfer | Already validated | — | No change |
| Balance adjustment | `build_balance_adjustment_tx` | N/A (system) | Skip |
| Income | `build_income_tx` | No debit | Skip |

**Implementation:** Extract a reusable `validate_account_has_sufficient_balance(finperiodid, budgetid, account_desc, required_amount, db)` from the existing transfer validation logic. Call it from `build_expense_tx` and `build_investment_tx` before `add_period_transaction`, gated by the budget setting.

**Error response:** HTTP 422 with message `"Account '{name}' does not have sufficient balance for this transaction. Available: $X, Required: $Y."`

**Special cases:**
- Zero-amount transactions: skip validation.
- Credit transactions (refunds): skip validation — adding money to an account never requires sufficiency.

### 6.3 Auto-Expense Behaviour

Auto-expense operates as if `allow_overdraft_transactions` is always `true`. It will create expense transactions regardless of available balance. This is intentional — auto-expense is a convenience feature that automates payment, and users who enable it accept that their account may go into overdraft.

**No funds check in auto-expense.** The `validate_account_has_sufficient_balance` helper is **not** called during `process_auto_expenses_for_period`.

**UI Note in Settings:** The Auto Expense section must display a visible, persistent note:
> "Auto Expense will create transactions even if the debit account has insufficient funds. This feature is not restricted by the 'Allow overdraft transactions' setting above."

This note sits directly beneath or adjacent to the Auto Expense enable toggle, so the user is always aware of this behaviour when turning the feature on.

### 6.4 Frontend Impact

- **Transaction modals:** Already show error messages from API failures. No changes needed.
- **Settings tab:** Add `allow_overdraft_transactions` toggle with explanatory copy. Add persistent visible note under Auto Expense toggle explaining that auto-expense ignores this setting.

---

## 7. Engineering Tasks

### Phase 1: Schema and Data Migration

| # | Task | Files | Effort |
|---|------|-------|--------|
| 1.1 | Add `is_savings` to `BalanceType` model | `backend/app/models.py` | Small |
| 1.2 | Update BalanceType schemas | `backend/app/schemas.py` | Small |
| 1.3 | Create Alembic migration: add `is_savings`, remap `balance_type`, drop `account_naming_preference` | `backend/alembic/versions/` | Medium |
| 1.4 | Backfill existing data in migration | Migration file | Small |
| 1.5 | Remove `account_naming_preference` from `Budget` model | `backend/app/models.py` | Small |
| 1.6 | Update `Budget` schemas to remove `account_naming_preference` | `backend/app/schemas.py` | Small |

### Phase 2: Backend Routers and Business Logic

| # | Task | Files | Effort |
|---|------|-------|--------|
| 2.1 | Update balance_types router for new type model | `backend/app/routers/balance_types.py` | Medium |
| 2.2 | Update setup assessment for new type model | `backend/app/setup_assessment.py` | Small |
| 2.3 | Update demo budget seed data | `backend/app/demo_budget.py` | Small |
| 2.4 | Remove `account_naming_preference` from budgets router | `backend/app/routers/budgets.py` | Small |
| 2.5 | Add `allow_overdraft_transactions` to `Budget` model and schemas | `backend/app/models.py`, `backend/app/schemas.py` | Small |
| 2.6 | Add `POST /periods/{id}/add-investment` endpoint | `backend/app/routers/periods.py` | Medium |
| 2.7 | Implement `_compute_investment_opening_value` backward query | `backend/app/period_logic.py` | Medium |
| 2.8 | Restore `linked_account_desc` validation in investment router | `backend/app/routers/investments.py` | Small |
| 2.9 | Extract `validate_account_has_sufficient_balance` helper | `backend/app/transaction_ledger.py` | Medium |
| 2.10 | Add sufficiency validation to `build_expense_tx` | `backend/app/transaction_ledger.py` | Small |
| 2.11 | Add sufficiency validation to `build_investment_tx` | `backend/app/transaction_ledger.py` | Small |
| 2.12 | Update backup/restore for removed `account_naming_preference` | `backend/app/backup_service.py`, `restore_service.py` | Small |
| 2.13 | Update `IncomeType.issavings` validation to check target account is `is_savings=true` | `backend/app/routers/income_types.py` | Small |

### Phase 3: Frontend Components

| # | Task | Files | Effort |
|---|------|-------|--------|
| 3.1 | Delete `accountNaming.js` utility | `frontend/src/utils/accountNaming.js` | Small |
| 3.2 | Update `BalanceTypesTab` for new types and `is_savings` | `frontend/src/pages/tabs/BalanceTypesTab.jsx` | Medium |
| 3.3 | Update `InvestmentItemsTab` to show `linked_account_desc` and remove naming preference | `frontend/src/pages/tabs/InvestmentItemsTab.jsx` | Medium |
| 3.4 | Update `InvestmentTxModal` to display target account | `frontend/src/components/transaction/InvestmentTxModal.jsx` | Medium |
| 3.5 | Create `AddInvestmentLineModal` component | `frontend/src/components/period-lines/AddInvestmentLineModal.jsx` | Medium |
| 3.6 | Export new component from `period-lines/index.js` | `frontend/src/components/period-lines/index.js` | Small |
| 3.7 | Integrate AddInvestmentLineModal into `PeriodDetailPage` | `frontend/src/pages/PeriodDetailPage.jsx` | Small |
| 3.8 | Add `onAddInvestment` callback to `InvestmentSection` | `frontend/src/components/period-lines/InvestmentSection.jsx` | Small |
| 3.9 | Remove `account_naming_preference` from `SettingsTab` | `frontend/src/pages/tabs/SettingsTab.jsx` | Small |
| 3.10 | Add `allow_overdraft_transactions` toggle to `SettingsTab` | `frontend/src/pages/tabs/SettingsTab.jsx` | Small |
| 3.11 | Add auto-expense overdraft note to `SettingsTab` | `frontend/src/pages/tabs/SettingsTab.jsx` | Small |
| 3.12 | Remove `account_naming_preference` from `BudgetDetailPage` | `frontend/src/pages/BudgetDetailPage.jsx` | Small |
| 3.13 | Remove `account_naming_preference` from `IncomeTypesTab` | `frontend/src/pages/tabs/IncomeTypesTab.jsx` | Small |
| 3.14 | Remove `account_naming_preference` from `ExpenseItemsTab` | `frontend/src/pages/tabs/ExpenseItemsTab.jsx` | Small |
| 3.15 | Update type badge mapping | `frontend/src/pages/tabs/BalanceTypesTab.jsx` | Small |
| 3.16 | Update API client for new endpoints | `frontend/src/api/client.js` | Small |

### Phase 4: Tests

| # | Task | Files | Effort |
|---|------|-------|--------|
| 4.1 | Update backend balance type tests for new model | `backend/tests/test_setup_assessment.py` | Medium |
| 4.2 | Update backend budget schema validation tests | `backend/tests/test_budget_schema_validation.py` | Small |
| 4.3 | Update backend backup/restore tests | `backend/tests/test_backup_restore.py` | Medium |
| 4.4 | Update backend smoke tests | `backend/tests/test_app_smoke.py` | Small |
| 4.5 | Add backend tests for `add-investment` endpoint | `backend/tests/test_periods.py` or new file | Medium |
| 4.6 | Add backend tests for investment gap / backward carry-forward | `backend/tests/test_periods.py` or new file | Medium |
| 4.7 | Add backend tests for balance sufficiency validation | `backend/tests/test_transaction_ledger.py` or new file | Medium |
| 4.8 | Add backend tests for expense sufficiency validation | `backend/tests/test_expense_transactions.py` | Medium |
| 4.9 | Add backend tests for `allow_overdraft_transactions` gate | `backend/tests/test_auto_expense.py` or new file | Small |
| 4.9 | Add backend tests for new budget shapes | `backend/tests/test_setup_assessment.py` | Medium |
| 4.10 | Update frontend `BalanceTypesTab` tests | `frontend/src/__tests__/BalanceTypesTab.test.jsx` | Medium |
| 4.11 | Update frontend `SettingsTab` tests | `frontend/src/__tests__/SettingsTab.test.jsx` | Small |
| 4.12 | Update frontend `InvestmentItemsTab` tests | `frontend/src/__tests__/InvestmentItemsTab.test.jsx` | Medium |
| 4.13 | Update frontend `BudgetDetailPage` tests | `frontend/src/__tests__/BudgetDetailPage.test.jsx` | Small |
| 4.14 | Update frontend `InvestmentTxModal` tests | New or existing test file | Medium |
| 4.15 | Add frontend tests for `AddInvestmentLineModal` | `frontend/src/__tests__/AddInvestmentLineModal.test.jsx` | Medium |
| 4.16 | Update frontend `ExpenseEntriesModal` tests for sufficiency | Existing test file | Small |
| 4.17 | Add frontend tests for auto-expense overdraft note in SettingsTab | `frontend/src/__tests__/SettingsTab.test.jsx` | Small |

### Phase 5: Documentation

| # | Task | Files | Effort |
|---|------|-------|--------|
| 5.1 | Create Budget Shapes Matrix document | `docs/BUDGET_SHAPES_MATRIX.md` | Medium |
| 5.2 | Update `DOCUMENT_REGISTER.md` | `docs/DOCUMENT_REGISTER.md` | Small |
| 5.3 | Update `DEVELOPMENT_ACTIVITIES.md` | `docs/DEVELOPMENT_ACTIVITIES.md` | Small |

---

## 8. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Breaking existing budgets with `balance_type = 'Transaction'` or `'Savings'`** | Certain | High | Migration backfills all existing data. Test migration on demo budget and production-like backup. |
| **Frontend tests broadly fail due to `accountNaming.js` deletion** | High | Medium | The utility is imported across many files. Update all imports before deleting. Run full frontend test suite after each file change. |
| **AddInvestmentLineModal creates `PeriodInvestment` with incorrect opening_value** | Medium | High | Implement backward query for most recent closing value. Fallback to `initial_value`. Test gap scenarios thoroughly. |
| **Balance sufficiency validation blocks legitimate transactions** | Medium | High | Use `compute_dynamic_period_balances` for accurate closing. Exclude credit transactions (refunds). Allow override via manual balance adjustment (future). |
| **Removing `account_naming_preference` breaks backup/restore of older backups** | Low | Low | Restore service uses Pydantic `exclude_unset=True`; extra fields in backup payload are ignored. No shim needed. |
| **Cash-only budgets with single account cannot create investments** | Low | Low | Cash savings accounts resolve this. Minimum 2 Cash accounts still required (1 spend + 1 savings), but both are natural in a cash-only budget. |
| **Multi-primary budgets from pre-v0.9.1 era** | Low | Medium | Already handled by v0.9.1 single-primary enforcement. No new risk. |
| **Income `issavings=true` routed to non-savings account** | Medium | Medium | Add validation in `create_income_type` and `update_income_type`: if `issavings=true`, `linked_account` must be an active account with `is_savings=true` (Banking or Cash). |

---

## 9. Gaps Identified

| Gap | Severity | Action |
|-----|----------|--------|
| **No validation when an investment is missing from a cycle but exists before/after** | **High** | Currently `_populate_period_investments` and `create_next_cycle` only look at the immediate previous period. If the investment is missing there, opening value silently resets to `initial_value`, losing growth history. No tests cover this. The backward query introduced by `AddInvestmentLineModal` resolves this. Consider applying the same backward query to generation logic. |
| **AddInvestmentLineModal v1 only supports existing items** | Low | v1 restriction to reduce risk. Inline creation deferred to future iteration. |
| **No visual distinction between spend and savings accounts in account list** | Low | Add combined `balance_type` + `is_savings` badge in `BalanceTypesTab` table (e.g. "Banking — Spend", "Cash — Savings"). |
| **`issavings` on `IncomeType` overlaps semantically with `is_savings` on `BalanceType`** | Low | Clarify: `IncomeType.issavings` means "this income is pre-allocated to savings and excluded from surplus." `BalanceType.is_savings` means "this account holds savings/investment value." They are related but distinct. Both can apply to Banking and Cash accounts. |
| **No budget shape validation during setup** | Low | Future enhancement: warn user if their shape is unusual (e.g., no expenses but investments exist). |
| **`linked_account_desc` was removed from UI in v0.8.5-beta; users may have data with null target** | Medium | Migration should handle existing null `linked_account_desc` gracefully. For existing investments without target, require user to set one before new transactions (or default to source account). |
| **Balance sufficiency validation may conflict with scheduled/auto expenses** | Low | Auto-expenses don't record transactions until processed. Validation only applies to manual transaction recording. |

---

## 10. Acceptance Criteria

1. **Account Types:** `BalanceType.balance_type` accepts only `Banking` and `Cash`. `BalanceType.is_savings` is a boolean available on **all** accounts (Banking and Cash). All existing data is migrated.
2. **Account Naming Removed:** `account_naming_preference` is removed from `Budget` model, settings UI, and all frontend components. No references remain in codebase.
3. **Add Investment Line Modal:** Period Detail page has an "Add Investment Line" button that opens a modal. Users can select an existing setup investment and add it to the current cycle. Opening value is computed from the most recent period that contained this investment (backward query across all periods, not just the immediate predecessor).
4. **Investment Target Account:** The setup form shows both source (debit) and target (credit) account dropdowns. The transaction modal shows both and allows changing the debit account.
5. **Balance Sufficiency:** When `allow_overdraft_transactions=false`, recording an expense or investment transaction that would overdraw the debit account returns HTTP 422 with a clear message. Income transactions are exempt. When `true`, transactions proceed without balance checks.
6. **Budget Shapes Document:** `docs/BUDGET_SHAPES_MATRIX.md` exists and documents all six shapes with requirements and demo mappings.
7. **Auto-Expense Overdraft Note:** The Auto Expense section in Settings displays a persistent visible note explaining that auto-expense will create transactions regardless of available funds.
8. **Tests:** All existing backend and frontend tests pass. New tests cover migration, add-investment endpoint, investment gap/backward carry-forward, sufficiency validation, new budget shapes, and auto-expense overdraft note.
9. **Demo Budget:** Demo seed data uses the new model (`Banking`/`Cash` + `is_savings`) and produces a valid `S1` shape.

---

## 11. Decisions Log

| # | Topic | Decision |
|---|-------|----------|
| 1 | **Retain `balance_type`** | Retained with values `Banking` and `Cash`. User confirmed. |
| 2 | **Drop `account_naming_preference`** | Drop the DB column. Restore service handles missing fields gracefully. |
| 3 | **Investment line in cycle details** | Implement `AddInvestmentLineModal` in Period Detail. v1: existing-item mode only, one-off scope only, backward carry-forward for opening value. Inline creation and future scope deferred to reduce complexity. |
| 4 | **Balance sufficiency strictness** | User setting `allow_overdraft_transactions` (default `false`). Auto-expense always proceeds regardless of balance; a visible note in Settings explains this behaviour. |
| 5 | **Expense item propagation** | Out of scope. Can be revisited after investment modal pattern is proven. |
