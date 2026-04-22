# Scheduled Income and Auto Carry-Forward Plan

This document defines the architecture, rules, and implementation plan for untethering the income cycle from the budget cycle by introducing scheduled income lines, income allocation modes, and automated carry-forward behavior.

---

## Purpose

A core assumption in the original Dosh design was that a budget cycle would match the income cycle (e.g., pay date = start of budget cycle). This plan removes that assumption by allowing income to follow its own schedule independent of the budget period frequency.

Supported budget shapes:
- Monthly budget with weekly income stream
- Weekly budget with monthly income stream
- Any combination of budget frequency and income schedule

---

## Scope

This plan covers:
- Schema changes to `incometypes` and `budgets` tables (no new tables)
- Generalized occurrence logic shared between income and expenses
- Income allocation modes for distributing income across budget periods
- Period generation proration for scheduled income
- Auto-income scheduler mirroring the existing auto-expense scheduler
- Auto-carry-forward of surplus for `PENDING_CLOSURE` periods
- Close-out behavior for income lines
- Frontend setup, settings, and detail-view changes

Out of scope:
- Custom weighted allocation (reserved for future)
- Changes to the core budget cycle lifecycle workflow (`PLANNED` → `ACTIVE` → `PENDING_CLOSURE` → `CLOSED`)

---

## Definitions

| Term | Definition |
|------|------------|
| **Simple Mode** | Budget-level setting `income_scheduling_mode = simple`. Hides all scheduling and allocation UI. Legacy flat-amount behavior: every auto-included income gets its full amount in every period. |
| **Advanced Mode** | Budget-level setting `income_scheduling_mode = advanced`. Unlocks scheduling fields and allocation mode selection per income type. |
| **Scheduled Income** | An `IncomeType` with `freqtype`, `frequency_value`, `effectivedate`, and `paytype` populated. Only available in advanced mode. |
| **Flat Income** | An `IncomeType` with `freqtype = 'Always'` or no schedule. Behaves as legacy income: flat amount in every period. Available in both simple and advanced modes. |
| **Auto Income** | Scheduled income where `paytype = AUTO`. The daily scheduler creates credit transactions on due dates. |
| **Auto Carry-Forward** | A budget-level setting that automatically propagates surplus from `PENDING_CLOSURE` periods into their successor as a `Carried Forward` line, without requiring manual close-out. |
| **Income Cycle Window** | The time range over which a scheduled income amount is available to be budgeted. For a single occurrence: `[due_date, next_due_date - 1 day]`. |
| **Allocation Mode** | Determines how a scheduled income amount is distributed across budget periods overlapping its income cycle window. |

---

## Rules and Constraints

### Schema
- Only new columns on existing tables. No new tables.
- Migration must backfill existing budgets as `income_scheduling_mode = 'simple'`.
- Migration must backfill existing `IncomeType` rows as `freqtype = 'Always'`, `paytype = 'MANUAL'`, `allocation_mode = 'occurrence'` to preserve exact legacy behavior.

### Simple vs Advanced Mode
- **Simple mode** (default for all existing budgets): scheduling UI is completely hidden. Income setup shows only description, amount, linked account, and auto-include. Period generation injects flat amount per income into every period.
- **Advanced mode**: scheduling and allocation controls are visible. Income can be configured as flat or scheduled. Period generation applies the selected allocation mode.
- Mode can be changed by the user at any time. Switching from advanced to simple does not delete scheduling data; it simply hides the UI and treats all income as flat.

### Scheduling
- Income reuses the same frequency patterns as expenses: `Always`, `Fixed Day of Month`, `Every N Days`.
- `AUTO` paytype is only valid when a complete schedule is present (`freqtype`, `frequency_value`, `effectivedate`).
- `Always` income must use `MANUAL` paytype (no schedule = no automation).

### Allocation Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `occurrence` (default) | Income is budgeted in the period(s) containing its due date(s). Multiple due dates in one period are summed. | Weekly income in monthly budget. Monthly income in monthly budget. |
| `prorate_equal` | Income amount is divided equally across all budget periods overlapping the income cycle window. | Monthly income in weekly budget: $5000 split across ~4-5 weeks = ~$1000 per week. |
| `first_period` | Full income amount is budgeted in the first budget period overlapping the income cycle window. | Monthly income in weekly budget: the first week of the monthly cycle gets all $5000. |
| `next_period` | Full income amount is budgeted in the budget period immediately after the period containing the due date. | Monthly income paid on 15th: budget it for the next period, not the current one. |
| `current_and_next_prorate` | Income amount is split between the period containing the due date and the next period. | Monthly income paid on 15th: split between current and next period for smoother planning. |

### Budget Amount Semantics
- `PeriodIncome.budgetamount` represents the **allocated amount for that period** according to the income type's allocation mode.
- For `occurrence` mode: sum of all occurrences within the period.
- For `prorate_equal` mode: `IncomeType.amount / count_of_overlapping_periods`.
- For `first_period`, `next_period`: full amount or 0 depending on period position.
- For `current_and_next_prorate`: prorated share based on overlap or 50/50 split.
- This preserves existing surplus and variance math without changes to `sync_period_state()` or close-out calculations.

### Actual Amount Integrity
- When an income type is `AUTO`, direct `actualamount` patches on `PeriodIncome` are rejected. Users must record transactions through the transaction modal.
- Manual income (`MANUAL`) continues to allow direct actual patches.

### Carry-Forward
- `auto_carry_forward_enabled` is a budget-level boolean (default `false`).
- When enabled, the daily scheduler processes `PENDING_CLOSURE` periods in chronological order and upserts a `Carried Forward` line on the successor period.
- If a manual close-out has already snapshot the period (`PeriodCloseoutSnapshot` exists), auto-carry-forward skips it to avoid double-counting.
- Multiple `PENDING_CLOSURE` periods are supported; each is processed sequentially.

### Close-Out
- `close_cycle()` marks all non-system `PeriodIncome` lines as `PAID`, matching existing expense and investment freeze behavior.
- Future-due AUTO income that has not yet occurred simply has no transactions; it does not artificially inflate surplus because `actualamount` is transaction-derived.

---

## Target Behavior

### Period Generation

#### Example 1: Monthly budget, weekly income ($500 every Friday)
- `occurrence` mode: Monthly period gets 4 × $500 = $2000 (or 5 × $500 = $2500).
- `prorate_equal` mode: Not applicable (income cycle < budget cycle). Falls back to `occurrence`.

#### Example 2: Weekly budget, monthly income ($5000 on the 15th)
- `occurrence` mode: The week containing the 15th gets $5000. Other weeks get $0.
- `prorate_equal` mode: Monthly income cycle window [15th, next 14th] overlaps ~4-5 weeks. Each week gets $5000 / 5 = $1000.
- `first_period` mode: The first week of the monthly cycle gets $5000. Other weeks get $0.
- `next_period` mode: The week AFTER the 15th gets $5000. Week of 15th gets $0.
- `current_and_next_prorate` mode: Week of 15th gets $2500, next week gets $2500.

#### Example 3: Monthly budget, monthly income ($5000 on the 15th)
- `occurrence` mode: Monthly period gets $5000.
- `next_period` mode: Next monthly period gets $5000. Current period gets $0.
- `current_and_next_prorate` mode: Current period gets $2500, next period gets $2500.

### Auto Income Scheduler
1. Daily at scheduler tick, for each `ACTIVE` period where `budget.auto_income_enabled == true`:
   2. For each `AUTO` income type:
      3. Compute due dates within the period.
      4. For each due date where `due_date + offset_days <= today`:
         5. Create a `CREDIT` `PeriodTransaction` via `build_income_tx()`.
         6. Deduplicate by `auto-income:{finperiodid}:{incomedesc}:{due_date}`.

### Auto Carry-Forward Scheduler
1. Daily at scheduler tick, for each budget where `auto_carry_forward_enabled == true`:
   2. Find all `PENDING_CLOSURE` periods ordered by `startdate`.
   3. For each, compute `surplus_actual` from `current_period_totals()`.
   4. Call `upsert_carried_forward_line()` on the successor period.
   5. Skip if successor already has a `Carried Forward` line.

---

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| Income due date falls exactly on period boundary | Included if `period_start <= due_date <= period_end` (inclusive). |
| Month boundary splits a weekly occurrence | The occurrence is credited in the period that contains its due date. |
| User manually closes a cycle after auto-carry-forward already ran | Close-out preview reflects the already-applied carry-forward. The `Carried Forward` line is present; surplus math is consistent. |
| Direct actual patch attempted on AUTO income | Rejected with 422. User must use transaction entry. |
| `AUTO` set on income with incomplete schedule | Rejected at setup time with validation error. |
| Budget disabled (`auto_income_enabled = false`) | Scheduler skips the budget entirely. Manual transaction entry still works. |
| `prorate_equal` with income cycle shorter than budget cycle | Falls back to `occurrence` mode (no splitting needed). |
| Budget switched from advanced to simple | Scheduling data is preserved but hidden. Period generation treats all income as flat. |
| Zero overlapping periods for income cycle window | Income is not included in any period. Setup assessment warns. |

---

## Implementation Implications

### Backend Modules Modified
- `backend/app/models.py` — add columns to `IncomeType` and `Budget`
- `backend/app/schemas.py` — update `IncomeType*` and `Budget*` Pydantic models
- `backend/app/period_logic.py` — generalize `expense_occurs_in_period()` into shared occurrence logic; add income cycle window calculation
- `backend/app/routers/income_types.py` — accept and persist scheduling and allocation fields
- `backend/app/routers/periods.py` — apply allocation mode during generation; add `run-auto-income` endpoint; block direct actual patches for AUTO income
- `backend/app/routers/budgets.py` — accept new budget settings
- `backend/app/cycle_management.py` — mark income as Paid on close-out
- `backend/app/setup_assessment.py` — warn on scheduled income without `linked_account`; warn on shape mismatches
- `backend/app/backup_service.py` and `restore_service.py` — include new fields
- `backend/app/demo_budget.py` — optionally showcase a scheduled income in advanced mode

### New Backend Module
- `backend/app/auto_income.py` — mirrors `auto_expense.py` for income scheduling and transaction creation

### Frontend Components Modified
- `frontend/src/pages/tabs/IncomeTypesTab.jsx` — conditionally show scheduling and allocation controls based on `income_scheduling_mode`
- `frontend/src/components/period-lines/AddIncomeLineModal.jsx` — allow schedule setup for new income when budget is advanced
- `frontend/src/pages/tabs/SettingsTab.jsx` — add `income_scheduling_mode`, `auto_income_enabled`, `auto_income_offset_days`, `auto_carry_forward_enabled`
- `frontend/src/components/period-sections/IncomeSection.jsx` — show due-date hints and allocation mode badges for scheduled AUTO income
- `frontend/src/api/client.js` — add `runPeriodAutoIncome`

### Migration
- `backend/alembic/versions/..._add_scheduled_income_and_auto_carry_forward.py`
- Backfill existing `budgets` with `income_scheduling_mode = 'simple'`, `auto_income_enabled = false`, `auto_income_offset_days = 0`, `auto_carry_forward_enabled = false`
- Backfill existing `incometypes` with `freqtype = 'Always'`, `paytype = 'MANUAL'`, `allocation_mode = 'occurrence'`

### Tests
- `backend/tests/test_auto_income.py`
- `backend/tests/test_income_scheduling.py`
- `backend/tests/test_income_allocation.py`
- `backend/tests/test_auto_carry_forward.py`
- `backend/tests/test_closeout_income_paid.py`
- `backend/tests/test_auto_income_migration.py`
- Frontend tests for `IncomeTypesTab` conditional scheduling UI
- Frontend tests for `SettingsTab` mode toggle

---

## Related Documents

- [AUTO_EXPENSE_PLAN.md](/home/ubuntu/dosh/docs/plans/AUTO_EXPENSE_PLAN.md) — the pattern this plan mirrors
- [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md) — lifecycle rules that must remain consistent
- [CASH_MANAGEMENT_WORKFLOW_PLAN.md](/home/ubuntu/dosh/docs/plans/CASH_MANAGEMENT_WORKFLOW_PLAN.md) — account balance and transfer validation rules
- [SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md](/home/ubuntu/dosh/docs/plans/SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md) — setup readiness and protection behavior
