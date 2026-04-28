# Plan Review: Cash-Only Budget Shape — Implementation Plan

## Executive Summary

The plan correctly identifies the root cause and proposes a sound high-level approach: make the primary account resolver type-agnostic and enforce **exactly one primary per budget** (not one per balance type). However, the plan has **significant gaps** in frontend helper logic, test coverage for the "one primary total" constraint, and UI copy that will become misleading after the change.

**Verdict: Implementable with amendments.** The backend changes are well-scoped. The frontend changes need expansion. The test delta is larger than described.

---

## Detailed Assessment by File

### Backend Changes

#### 1. `backend/app/transaction_ledger.py` — `get_primary_account_desc()` (line 278)
**Plan:** Remove `balance_type == "Transaction"` filter.
**Assessment:** Correct. This is the canonical resolver. Making it type-agnostic propagates the fix to all 13 call sites automatically.
**Risk:** Low. The fallback to `None` is preserved; downstream callers already handle `None`.

#### 2. `backend/app/setup_assessment.py` — `budget_setup_assessment()` (lines 252–273)
**Plan:** Remove `balance_type == "Transaction"` from `primary_account` lookup; reword blocking issue.
**Assessment:** Correct. The `active_expense_items` guard on line 272 correctly preserves the requirement that a primary is only required when there are active expenses. This means a budget with no expenses and only a Savings primary will still be generatable.
**Risk:** Low.

#### 3. `backend/app/routers/balance_types.py`
**Plan:**
- `_clear_primary()` (lines 38–43): remove `balance_type` filter so it demotes **any** existing primary.
- `_assert_active_primary_will_remain()` (lines 64–103): generalise to one active primary total.
- `_assert_delete_wont_remove_required_primary()` (lines 106–139): generalise similarly.

**Assessment:** Directionally correct, but incomplete.

**Gap in `_clear_primary()`:**
The plan shows the function still accepting a `balance_type: str | None` parameter that becomes unused. The signature should be simplified to `_clear_primary(budgetid: int, db: Session)` and the caller on line 149 should drop the second argument.

**Gap in `_assert_active_primary_will_remain()`:**
The plan does not address line 85:
```python
updates.get("balance_type", bt.balance_type) == "Transaction" and will_be_active
```
Under the new model, this should become `will_be_active` (any active account counts, not just Transaction).

Also, `active_transaction_accounts_exist` (line 74) should become `active_accounts_exist` and drop the `balance_type == "Transaction"` filter. The variable rename is cosmetic but important for maintainability.

**Gap in `_assert_delete_wont_remove_required_primary()`:**
Line 111 checks `bt.balance_type == "Transaction"`. Under the new model this should check only `bt.active and bt.is_primary` (any type). The `other_active_transaction` query (line 114) should become `other_active_account` and also drop the `balance_type` filter.

**Risk:** Medium. These guard functions prevent users from leaving a budget without a primary. Getting the logic wrong could allow deletion/deactivation that breaks expense workflows.

#### 4. `backend/app/routers/periods.py` — `_assert_primary_account_configured()` (lines 131–135)
**Plan:** No direct change required.
**Assessment:** Correct. It chains through `budget_setup_assessment` and `get_primary_account_desc`.
**Risk:** None.

#### 5. `backend/app/auto_expense.py` — `process_auto_expenses()` (lines 121–124)
**Plan:** No direct change required.
**Assessment:** Correct.
**Risk:** None.

---

### Frontend Changes

#### 6. `frontend/src/components/transaction/ExpenseEntriesModal.jsx` (line 54)
**Plan:** Remove `bt.balance_type === 'Transaction'` filter.
**Assessment:** Correct.
**Risk:** Low.

#### 7. `frontend/src/pages/tabs/BalanceTypesTab.jsx` — Multiple gaps
**Plan:** Mentions `canDeleteAccount`, `getDeleteDisabledReason`, `hasActivePrimary` rename, form validation, and `getPrimaryAccountName`.
**Assessment:** Incomplete. Several helper functions and UI copy are missed.

**Missed — `getPrimaryAccountName()` (lines 19–27):**
```javascript
function getPrimaryAccountName(accounts, balanceType, currentDesc = null) {
  return accounts.find(
    account =>
      account.balance_type === balanceType &&  // <-- MUST drop this filter
      account.is_primary &&
      account.active &&
      account.balancedesc !== currentDesc
  )?.balancedesc ?? null
}
```
Under the single-primary model, this should find the **single primary across all types**, not just matching `balanceType`. The caller on line 124 passes `nextForm.balance_type`, which would fail to find a Cash primary when editing a new Transaction account.

**Missed — `hasAnyActivePrimary()` (lines 49–52):**
```javascript
function hasAnyActivePrimary(accounts, balanceType, currentDesc = null, nextForm = null) {
  return buildSimulatedAccounts(accounts, currentDesc, nextForm)
    .some(account => account.active && account.is_primary && account.balance_type === balanceType)
}
```
This still filters by `balanceType`. Under the new model, the primary is global, so this filter must be dropped. The caller on line 125 passes `'Transaction'`, which would incorrectly report no primary when a Cash primary exists.

**Missed — Default `is_primary` on create (lines 311–312, 447):**
```javascript
const hasTransactionAccount = types.some(type => type.balance_type === 'Transaction')
const hasActiveTransactionPrimary = types.some(type => type.active && type.is_primary && type.balance_type === 'Transaction')
// ...
is_primary: !hasActiveTransactionPrimary && !hasTransactionAccount,
```
Under the new model, the first account created for a budget should default to primary if **no active primary of any type** exists. These checks should become:
```javascript
const hasActivePrimary = types.some(type => type.active && type.is_primary)
// ...
is_primary: !hasActivePrimary,
```

**Missed — Primary checkbox label (lines 182–188):**
```javascript
<span className="block font-medium text-gray-800 dark:text-gray-100">Primary {primaryAccountLabel} account</span>
<span className="block text-xs text-gray-500 dark:text-gray-400">
  {form.balance_type === 'Transaction'
    ? 'Expenses are deducted from this account by default.'
    : 'Use this as the primary account for this account type.'}
</span>
```
Under the single-primary model, expenses are deducted from **whatever account is primary**, regardless of type. The conditional copy is misleading: if a Cash account is primary, expenses are still deducted from it by default, but the label will say "Use this as the primary account for this account type."

The label should be unified: **"Primary account — expenses are deducted from this account by default"** for all types.

**Missed — Missing-primary confirmation copy (line 229):**
```javascript
An active primary {transactionAccountLabel} account is required so expense deductions have a default account.
```
This is Transaction-centric. Should read: **"An active primary account is required so expense deductions have a default account."**

**Missed — `canDeleteAccount()` logic (lines 59–83):**
The plan says to remove `balance_type === 'Transaction'`. The current logic is:
1. If not an active primary Transaction account → deletable.
2. If no other active Transaction accounts → deletable.
3. Otherwise, require another primary.

Under the new model, it should be:
1. If not an active primary (any type) → deletable.
2. If no other active accounts at all → deletable (deleting the only account should be allowed; setup assessment will just block generation).
3. Otherwise, require another primary.

The plan's direction is right but the exact code change is more involved.

**Risk:** Medium-High. The `BalanceTypesTab` is the main account management UI. Getting the primary-switching, delete-guard, or form-validation logic wrong will produce confusing UX or allow invalid states.

#### 8. `frontend/src/pages/BudgetDetailPage.jsx` (lines 304–308)
**Plan:** Already type-agnostic — no change needed.
**Assessment:** **Incorrect.** While `primaryAccount = accounts.find(account => account.is_primary)` is type-agnostic, the **helper text** on line 308 is not:
```javascript
`Choose one account as the primary ${preferredTransactionLabel.toLowerCase()} account, this allow expenses to know which account to deduct from by default.`
```
If the naming preference is "Transaction" but the primary is a Cash account, this text is misleading. It should read:
```javascript
`Choose one account as the primary account, so expenses know which account to deduct from by default.`
```
(Also note the existing grammatical error "this allow" should be "so expenses know.")

**Risk:** Low — cosmetic but confusing for cash-only budgets.

---

## Test Changes — Larger Delta Than Described

### Backend Tests

#### `backend/tests/test_setup_assessment.py`
**Plan mentions:**
- Update `test_setup_assessment_ignores_non_transaction_primary_accounts` to expect `can_generate = True`.
- Add Cash-only + expenses → `can_generate = True`.
- Add `get_primary_account_desc` resolves Cash primary.
- Add `_clear_primary` demotes cross-type primary.

**Missing:**
- `test_setup_assessment_reports_blocking_primary_account_gap` (line 10): Currently asserts `"primary transaction account"` in blocking issues. Must be updated to `"primary account"`.
- `test_balance_type_primary_is_scoped_per_account_type` (line 49): This test **explicitly validates that two primaries can coexist** (Transaction + Savings both `is_primary = true`). Under the new single-primary model, creating a second primary **must demote the first**. This test will fail and must be rewritten to assert the demotion behavior, not coexistence.

**Critical:** The plan does not mention updating `test_balance_type_primary_is_scoped_per_account_type`. This is a breaking behavioral change.

#### `backend/tests/test_balance_types.py`
**Plan:** Mentions delete-guard and edit-guard tests.
**Assessment:** Correct that these need updates, but there is no `test_balance_types.py` file in the codebase. The relevant tests appear to be in `test_setup_assessment.py` (lines 216–254 for delete/deactivate guards). The plan should clarify where these tests live.

### Frontend Tests

#### `frontend/src/__tests__/BalanceTypesTab.test.jsx`
**Plan:** Mentions updating for type-agnostic primary logic.
**Missing:**
- Tests that create a Savings account as primary when a Transaction primary exists must now expect the Transaction primary to be **demoted**.
- The test `test_balance_type_primary_is_scoped_per_account_type` behavior (if there's a frontend equivalent) needs updating.

#### `frontend/src/__tests__/BudgetDetailPage.test.jsx`
**Plan:** Mentions updating if assertions depend on Transaction-specific messaging.
**Assessment:** Several tests assert the exact blocking issue text `"Choose one active account as the primary transaction account so expense entries have a default home."` (lines 66, 75, 80, 181, 190). All must be updated to the new generic text.

#### `frontend/src/__tests__/BudgetPeriodsPage.test.jsx`
**Plan:** Not mentioned.
**Assessment:** Lines 273, 284, 287 assert the same Transaction-specific blocking text. Must be updated.

---

## Downstream Impacts

| Area | Impact | Severity |
|------|--------|----------|
| **Budget Setup Assessment** | Cash/Savings primaries now satisfy `can_generate` if expenses exist. | Positive — enables cash-only budgets. |
| **Cycle Generation** | No change in generation logic; primary account used for carry-forward and opening balances. | Neutral. |
| **Expense Recording** | Expense entries default to the primary account regardless of type. | Positive — cash-only budgets work. |
| **Auto-Expenses** | Auto-expenses now run for Cash-primary budgets. | Positive. |
| **Account Transfers** | Transfer logic already uses explicit `from`/`to` accounts; unaffected. | None. |
| **Investment Workflows** | Investment `source_account_desc` and `linked_account_desc` are explicit; unaffected. | None. |
| **Balance Chain Recalculation** | `recalculate_budget_chain` uses all accounts; unaffected by primary type. | None. |
| **Health Engine** | Setup health metric uses `budget_setup_assessment`; will now score cash-only budgets correctly. | Positive. |
| **Multi-type budgets** | Budgets with Transaction + Savings + Cash can now only have **one** primary total. Previously could have one per type. | **Breaking** — users with multi-type multi-primary setups will see one primary demoted. |

### Multi-Type Budget Breaking Change
The plan does not address the breaking nature of this change for existing budgets that may have multiple primaries (e.g., one Transaction primary and one Savings primary). Under the new model:
- Editing either account will trigger `_clear_primary` on the other type.
- The backend will enforce a single primary.

**Migration / Data Integrity:** The plan states "no database migrations required," which is true for schema. However, a **data migration** should be considered: if any existing budget has multiple primaries, the application should deterministically pick one (e.g., the Transaction primary, or the first created) and demote the rest. Without this, the UI will behave unpredictably when users edit accounts.

---

## Risk Analysis

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Allowing budget with no expenses to generate without any primary** | Low | Medium | The `active_expense_items` guard on line 272 preserves this: no expenses → primary not required. |
| **User deletes/deactivates the only primary and breaks expense workflow** | Low | High | Backend guards in `balance_types.py` prevent this. Frontend `canDeleteAccount` also guards. |
| **Existing multi-primary budgets enter inconsistent state** | Medium | High | Add a data migration or startup check that demotes all but one primary per budget. |
| **Frontend `getPrimaryAccountName` still filters by `balanceType`, causing primary-switch confirmation to fail** | High | Medium | Must fix `getPrimaryAccountName` and `hasAnyActivePrimary` as described above. |
| **Test `test_balance_type_primary_is_scoped_per_account_type` fails** | Certain | Low | Rewrite test to assert single-primary demotion behavior. |
| **UI copy still says "transaction account" in helper text** | Certain | Low | Update `BudgetDetailPage.jsx` helper and `BalanceTypesTab` checkbox label/confirmation copy. |
| **Expense modal `default_account_desc` fallback** | Low | Medium | `ExpenseItemsTab.jsx` already falls back to `activeAccounts[0]` if no primary; this may mask the issue but is acceptable. |

---

## Recommendations

1. **Fix `getPrimaryAccountName` and `hasAnyActivePrimary`** in `BalanceTypesTab.jsx` to be truly type-agnostic before implementing.
2. **Update the default `is_primary` logic** on account creation to use `!hasActivePrimary` instead of Transaction-specific checks.
3. **Unify the primary checkbox label** to say "Expenses are deducted from this account by default" for all balance types.
4. **Update ALL frontend test files** that assert "primary transaction account" text: `BudgetDetailPage.test.jsx`, `BudgetPeriodsPage.test.jsx`, `BalanceTypesTab.test.jsx`.
5. **Rewrite backend test** `test_balance_type_primary_is_scoped_per_account_type` to assert cross-type demotion.
6. **Consider a data reconciliation** for existing multi-primary budgets. While no schema migration is needed, a one-time data fix or at least a runtime warning would prevent confusion.
7. **Fix grammatical error** in `BudgetDetailPage.jsx` helper text ("this allow" → "so expenses know").
8. **Simplify `_clear_primary` signature** by removing the unused `balance_type` parameter.

---

## Verification Steps — Amended

1. Build and restart the dev container.
2. Navigate to Budget 2 ("bud1") → Setup.
3. Confirm the blocking issue is gone and `can_generate` is true.
4. Generate the first budget cycle — must succeed.
5. Open the new cycle and record an expense entry — must default debit account to `cas1`.
6. **Add a Transaction account and mark it primary — confirm the Cash primary is demoted.**
7. **Delete the Transaction account — confirm the Cash account can be re-promoted to primary.**
8. Run backend test suite — all tests pass.
9. Run frontend test suite — all tests pass.
