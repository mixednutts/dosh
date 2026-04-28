# Plan: Distinguish Spendable vs Saved Account Balances

## Problem

With the cash-only budget shape (and mixed-type budgets in general), the **Account Balances** table on the Period Detail page and the **Current Balance** summary on the Dashboard present all accounts in a flat list. Users cannot quickly see:

- How much is **spendable** (Transaction, Cash, Bank, Checking, Everyday accounts)
- How much is **saved / invested** (Savings accounts)

The `balance_type` column already carries this information, but it is not surfaced in a way that supports rapid mental accounting.

## Scope

This is a **frontend-only** change. The backend already returns `balance_type` on `PeriodBalanceOut`. No API or schema changes are required.

Files to modify:
- `frontend/src/components/period-sections/BalanceSection.jsx`
- `frontend/src/pages/BudgetsPage.jsx` (`BalanceSummaryCard`)

## Option 1: Grouped Table with Section Subtotals (Recommended)

Split the BalanceSection table into two visually distinct groups, each with its own subtotal.

### Changes

**`BalanceSection.jsx`**
- Categorise each balance as `spendable` (`balance_type` in `{'Transaction','Bank','Cash'}`) or `saved` (`balance_type === 'Savings'`).
- Render two `<tbody>` sections (or grouped row blocks):
  1. **Spendable Accounts** — header row with section label, then rows for spendable accounts, then a subtotal row showing "Total Spendable".
  2. **Saved Accounts** — header row with section label, then rows for savings accounts, then a subtotal row showing "Total Saved".
- If a section has no accounts, omit the section entirely (or render a muted "None" row).
- Keep the existing grand total in `<tfoot>`.
- Apply the same grouping logic to the `MobileTableCards` rendering: render two card groups with section headers and subtotals.

**`BudgetsPage.jsx` (`BalanceSummaryCard`)**
- Replace the single "Current Balance" total with two stacked figures:
  - **Spendable:** sum of spendable account closings
  - **Saved:** sum of savings account closings
  - (Optional) keep a smaller "Total" line below

### Pros
- Most directly solves "hard to identify" — physical grouping makes the distinction immediate.
- Subtotals give users the key numbers without mental arithmetic.
- Consistent with the existing table-heavy design language.

### Cons
- More DOM/layout changes than Option 2.
- Empty sections need conditional rendering logic.

---

## Option 2: Summary Cards Above the Table

Leave the flat table unchanged. Add two compact summary cards above the BalanceSection table.

### Changes

**`BalanceSection.jsx`**
- Add a small summary bar above the table (two cards or a two-column grid):
  - **Total Spendable** — sum of non-Savings closing balances, with a green/blue accent.
  - **Total Saved** — sum of Savings closing balances, with a green accent.
- The existing table, mobile cards, and footer stay exactly as they are.

**`BudgetsPage.jsx` (`BalanceSummaryCard`)**
- Same as Option 1: show Spendable vs Saved breakdown.

### Pros
- Minimal changes to the table layout — very low regression risk.
- Quick to implement.
- The detailed account-level data remains unobstructed.

### Cons
- Less immediately scannable than grouped rows — users still have to cross-reference the summary cards with the table.
- Doesn't help mobile as much as Option 1 (mobile already shows cards; summary cards would add vertical space).

---

## Verification

1. Open a budget with Transaction + Savings + Cash accounts.
2. On Period Detail, confirm the BalanceSection clearly separates Spendable and Saved.
3. On the Dashboard, confirm the Current Balance card shows the breakdown.
4. Test with a cash-only budget (no Savings) — confirm the Saved section is hidden cleanly.
5. Test with a savings-only budget — confirm the Spendable section is hidden cleanly.
6. Full frontend test suite passes.
