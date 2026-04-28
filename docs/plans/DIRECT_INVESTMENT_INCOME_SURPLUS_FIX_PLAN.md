# Fix: Direct-to-Investment Income Counted in Surplus

## Problem
Income that is routed directly to an investment/savings account (via `IncomeType.linked_account` matching `InvestmentItem.linked_account_desc`) is currently included in the surplus calculation. This money is not available to spend in the period — it sits in the investment account — yet it inflates `surplus_actual` and `surplus_budget`, causing incorrect carry-forward amounts in close-out and misleading surplus displays across the app.

User's concrete example: $10 interest credited to "Test Savings Account" (linked to the "Savings" investment line) produces a $10 carry-forward even though the cash never entered the spendable pool.

## Root Cause
The surplus formula `income - expenses - investments` assumes all income lands in a spendable transaction account and investments are explicit transfers *from* that account. When income bypasses the transaction account and goes straight to an investment account, it is counted as available surplus even though it is not.

## Fix Approach
Treat income whose `linked_account` matches any `InvestmentItem.linked_account_desc` for the same budget as **pre-allocated to investment**. Exclude it from the income side of surplus calculations (mathematically equivalent to adding it to the investment side).

### Files to change

**Backend**
1. `backend/app/cycle_management.py`
   - Add `_direct_investment_income_for_period(period, db)` helper
   - Update `current_period_totals()` to subtract direct-to-investment amounts from `surplus_actual` and `surplus_budget`
   - `carry_forward_amount_for_period()` will automatically inherit the fix

2. `backend/app/routers/periods.py`
   - Update `_load_period_detail_components()` to subtract direct-to-investment amounts from `surplus_actual` and `surplus_budget` in `PeriodSummaryOut`
   - Update period generation (`generate_period` / bulk generate) so `auto_add_surplus_to_investment` excludes direct-to-investment income from `auto_surplus_amount`

3. `backend/app/ai_insights.py`
   - Update surplus calculation in `_build_ai_payload()` to exclude direct-to-investment income

**Frontend**
4. `frontend/src/pages/PeriodDetailPage.jsx`
   - Compute `directInvestmentIncome` from incomes where `linked_account` matches an investment's `linked_account_desc`
   - Subtract from `surplusActual` and `surplusBudget`

5. `frontend/src/pages/Dashboard.jsx`
   - Subtract direct-to-investment income from `surplusBudget` and `surplusActual` in both the summary-card block and the table block
   - **Also fix pre-existing bug**: both blocks currently calculate `surplusActual = incomeActual - expenseActual` (missing investment subtraction). Correct to `incomeActual - expenseActual - investmentActual - directInvestmentIncome`.

**Tests**
6. `backend/tests/test_closeout_flow.py`
   - Add/update test verifying carry-forward is $0 when income goes direct to investment

7. `frontend/src/__tests__/Dashboard.test.jsx`
   - Update expected surplus values to reflect corrected formula (investment subtraction + direct-to-investment exclusion)

8. `frontend/src/__tests__/BudgetPeriodsPage.test.jsx`
   - Update expected `surplus_actual` / `surplus_budget` values where investments are present

## Testing Strategy
- Backend: run full pytest suite (`python -m pytest tests/ -q`) after changes
- Frontend: run full jest suite (`npm test -- --coverage=false`) after changes
- Manual verification: load the user's budget into the dev environment and confirm Period 9 close-out preview shows carry-forward = $0 instead of $10

## Risks & Mitigations
- **Risk**: Changing `PeriodSummaryOut` values affects `BudgetPeriodsPage` and any other consumers of the summary list.
  - *Mitigation*: `BudgetPeriodsPage` consumes `summary.surplus_actual` / `summary.surplus_budget` directly from the backend, so fixing the backend calculation fixes it automatically with no frontend changes.
- **Risk**: `auto_add_surplus_to_investment` generation logic change affects future periods.
  - *Mitigation*: The change is conceptually correct — direct-to-investment income was never spendable, so it should not be part of auto-surplus. Existing periods are snapshots and unaffected.
