# Budget Shapes Matrix

This document defines the canonical budget shapes supported by Dosh. A **budget shape** is the combination of accounts (by type and role), investments, and expense configuration that defines how a budget operates.

## Shape Summary

| Shape ID | Name | Accounts | Investments | Expenses | Primary Account | Supported | Demo? |
|----------|------|----------|-------------|----------|-----------------|-----------|-------|
| `S1` | Traditional Banking | 1+ Banking (spend), 1+ Banking (savings) | 1+ linked to savings account | Required | Banking (spend) | **Yes** | **Yes** |
| `S2` | Cash-Only | 1+ Cash (spend), optionally 1+ Cash (savings) | 0+ (linked to savings Cash if present) | Optional | Cash (spend) | **Yes** | No |
| `S3` | Banking-Only | 1+ Banking (spend), no savings | 0+ (must debit from spend) | Required | Banking (spend) | **Yes** | No |
| `S4` | Savings-Only | 1+ Banking (savings) OR 1+ Cash (savings) | 1+ linked to savings account | Optional | Any savings account | **Yes** | No |
| `S5` | Mixed Banking + Cash | 1+ Banking, 1+ Cash | 0+ | Required | Any active | **Yes** | No |
| `S6` | No-Expense Tracking | 1+ any account | 0+ | None | Any active | **Yes** | No |

## Shape Detail Definitions

### S1 — Traditional Banking

- **Accounts:** At least one Banking account designated for spending (`is_savings=false`), optionally one or more Banking accounts designated for savings (`is_savings=true`).
- **Investment:** Linked to a savings Banking account (`linked_account_desc` points to `is_savings=true` account).
- **Expense default:** Debits the primary Banking (spend) account.
- **Demo seed:** Everyday Account (Banking, spend, primary) + Rainy Day Savings (Banking, savings) + Emergency Fund → Rainy Day Savings.

### S2 — Cash-Only

- **Accounts:** One or more Cash accounts. At least one must be designated for spending (`is_savings=false`). Optionally one or more Cash accounts can be designated for savings (`is_savings=true`) — e.g. "Cash in Wallet" (spend) and "Cash under Mattress" (savings).
- **Investment:** Linked to a savings Cash account (`linked_account_desc` points to `is_savings=true` Cash account). If no savings Cash account exists, investments cannot be created (requires source + target accounts).
- **Expense default:** Debits the primary Cash (spend) account.
- **Key question resolved:** Cash accounts can be savings accounts. No contra transactions needed — two Cash accounts (spend + savings) provide the same two-sided transaction model as Banking.

### S3 — Banking-Only

- **Accounts:** One or more Banking accounts, all `is_savings=false`.
- **Investment:** If present, must debit from a spend Banking account and credit to another Banking account.
- **Expense default:** Primary Banking account.

### S4 — Savings-Only

- **Accounts:** One or more accounts, all `is_savings=true`. Can be Banking savings accounts, Cash savings accounts, or a mix.
- **Investment:** Linked to any savings account (Banking or Cash).
- **Expense default:** Primary savings account (expenses deduct from savings).

### S5 — Mixed Banking + Cash

- **Accounts:** Combination of Banking and Cash accounts.
- **Primary:** Any active account regardless of type.
- **Investment:** Can link to Banking (savings) or be cash-only.

### S6 — No-Expense Tracking

- **Accounts:** Any active account.
- **No expense items.** Budget used purely for income tracking, investment tracking, and account balance monitoring.
- **Setup assessment:** Must not require expenses or primary account for generation (already supported — primary only required when expenses exist).

## Account Type Model

### Current Model

| Field | Type | Purpose |
|-------|------|---------|
| `BalanceType.balancedesc` | `String` | Account name/description (e.g. "Everyday Account", "Cash Under Mattress") |
| `BalanceType.balance_type` | `String` | Distinguishes bank-tracked accounts from cash/physical accounts. Values: `Banking`, `Cash` |
| `BalanceType.is_savings` | `Boolean` | Marks this account as a savings/investment-holding account, regardless of whether it is `Banking` or `Cash` |

### Valid Account Combinations

| `balance_type` | `is_savings` | Example Name | Use Case |
|---------------|-------------|--------------|----------|
| `Banking` | `false` | Everyday Account | Primary spending account |
| `Banking` | `true` | Rainy Day Savings | Bank savings / investment target |
| `Cash` | `false` | Wallet / Petty Cash | Physical cash for spending |
| `Cash` | `true` | Cash Under Mattress | Physical cash savings / investment target |

## Validation Rules

1. **Creating an investment line:** `linked_account_desc` (target) must be an active account with `is_savings=true`. This applies to both Banking and Cash accounts.
2. **Creating a Cash account:** The `is_savings` checkbox is available for all account types. Users can mark any Cash account as a savings account.
3. **Cash-only budget with investments:** Requires at least one Cash account with `is_savings=false` (source) and one with `is_savings=true` (target).
4. **Income with `issavings=true`:** The `linked_account` must be an active account with `is_savings=true` (Banking or Cash).

## Related Settings

### `allow_overdraft_transactions`

Controls whether manual transactions are allowed to overdraw accounts.

| Value | Behavior |
|-------|----------|
| `false` (default) | All manual transactions (expense, investment, transfer) that would overdraw the debit account are blocked with HTTP 422 |
| `true` | Transactions proceed regardless of available balance |

**Note:** Auto-expense operates as if `allow_overdraft_transactions` is always `true`. It will create expense transactions regardless of available balance. This is explained in the Settings UI.

## Migration Notes

### From Pre-0.10.0 Account Types

| Old `balance_type` | New `balance_type` | New `is_savings` |
|--------------------|-------------------|------------------|
| `Transaction` | `Banking` | `false` |
| `Savings` | `Banking` | `true` |
| `Cash` | `Cash` | User-defined (default `false`) |

The Alembic migration `d91762a97794_restructure_account_types_add_is_.py` automatically backfills existing data.

### Removed Fields

- `Budget.account_naming_preference` — Removed entirely. Account naming is now handled via `balancedesc` (user-defined name).

## Testing Matrix

| Test Scenario | Shape | Test Location |
|--------------|-------|---------------|
| Cash-only budget can generate | S2 | `backend/tests/test_setup_assessment.py` |
| Cash-only investment creates two transactions | S2 | `backend/tests/test_investment_transactions.py` |
| `get_primary_account_desc` resolves Cash primary | S2 | `backend/tests/test_setup_assessment.py` |
| Cross-type primary demotion on update | S1+S5 | `backend/tests/test_balance_types.py` |
| Savings-only budget generation | S4 | `backend/tests/test_setup_assessment.py` |
| No-expense budget generation | S6 | `backend/tests/test_setup_assessment.py` |
