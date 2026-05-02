# Budget Health Metric Library

> **Canonical Reference:** This document defines the current system metrics, their calculations, parameters, and evidence strings for the Budget Health Engine.

## Scope

- Global metric registry (`backend/app/health_engine/system_metrics.py`)
- Metric executor implementations (`backend/app/health_engine/metric_executors.py`)
- Default matrix composition and weights
- Parameter keys and default values
- Tone-aware evidence strings
- Structured evidence shape and calculation traces

## Architecture

Metrics are defined **globally in code**, not per-budget in the database.
Each budget owns a `BudgetHealthMatrix` that contains `BudgetHealthMatrixItem` rows keyed by `metric_key`.
The per-budget items store tunable `weight`, `scoring_sensitivity`, `is_enabled`, and `health_metric_parameters`.

## Default Matrix Composition

| Metric Key | Scope | Default Weight | Sensitivity | Display Order |
|------------|-------|----------------|-------------|---------------|
| `setup_health` | `OVERALL` | `40%` | `50` | `0` |
| `budget_cycles_pending_closeout` | `OVERALL` | `60%` | `50` | `1` |
| `period_trend` | `OVERALL` | `30%` | `50` | `6` |
| `budget_vs_actual_amount` | `CURRENT_PERIOD` | `30%` | `50` | `2` |
| `budget_vs_actual_lines` | `CURRENT_PERIOD` | `25%` | `50` | `3` |
| `in_cycle_budget_adjustments` | `CURRENT_PERIOD` | `25%` | `50` | `4` |
| `revisions_on_paid_expenses` | `CURRENT_PERIOD` | `20%` | `50` | `5` |

**Note:** Weights within `OVERALL` and `CURRENT_PERIOD` groups are normalised by the engine when computing scores.

---

## Metric Definitions

### `setup_health` — Setup Health

| Attribute | Value |
|-----------|-------|
| **Scope** | `OVERALL` |
| **Description** | Checks whether the budget has the minimum required setup lines. |

**Calculation:**
- Count `IncomeType` rows for the budget.
- Count `ExpenseItem` rows where `active = TRUE`.
- Count `InvestmentItem` rows where `active = TRUE`.
- Score = `(checks_passed / 3) * 100`, adjusted by sensitivity.

**Parameters:**
- `min_income_lines` (int, default `1`)
- `min_expense_lines` (int, default `1`)
- `min_investment_lines` (int, default `1`)

**Evidence Examples:**
- `{ label: "Income sources", value: "3", raw_value: 3, raw_unit: "count", limit: "1", raw_limit: 1, detail: "Number of income types configured for this budget." }`
- `{ label: "Active expenses", value: "0", raw_value: 0, raw_unit: "count", limit: "1", raw_limit: 1, detail: "Number of active expense items configured for this budget." }`

**Calculation Trace Example:**
- "Checks passed = 3/3. Score = 100."

---

### `budget_vs_actual_amount` — Budget vs Actual (Amount)

| Attribute | Value |
|-----------|-------|
| **Scope** | `CURRENT_PERIOD` |
| **Description** | Expense line actual amount exceeds the budget amount (aggregate overrun). |

**Calculation:**
- `overrun = SUM(actualamount - budgetamount)` for all `PeriodExpense` rows in the current period where `actual > budget`.
- Tolerance is the lower of `upper_tolerance_amount` and `(total_budgeted_expenses * upper_tolerance_pct / 100)`.
- If `overrun <= 0` → `100`
- If `overrun <= tolerance` → linear decay to `70`
- Beyond tolerance → `70 - (excess * sensitivity * 2)`

**Parameters:**
- `upper_tolerance_amount` (int, default `50`)
- `upper_tolerance_pct` (int, default `5`)

**Evidence Examples:**
- `{ label: "Overrun amount", value: "$0.00", raw_value: 0.00, raw_unit: "currency", limit: "$50.00", raw_limit: 50.00, detail: "Aggregate amount by which actual expenses exceed budgeted amounts." }`
- `{ label: "Overrun limit", value: "5.0%", raw_value: 5.0, raw_unit: "percentage", limit: "$50.00", raw_limit: 50.00, detail: "Tolerance is the lower of the dollar limit and the percentage of total budgeted expenses." }`

**Calculation Trace Example:**
- "Overrun = $0.00. Tolerance = $50.00. Ratio = 0.0000. Score = 100."
- "Overrun = $120.00. Tolerance = $50.00. Ratio = 2.4000. Score = 100 - (2.4000 × 30) = 70."

---

### `budget_vs_actual_lines` — Budget vs Actual (Lines)

| Attribute | Value |
|-----------|-------|
| **Scope** | `CURRENT_PERIOD` |
| **Description** | Number of expense lines where actual amount exceeds the budget amount. |

**Calculation:**
- Count `PeriodExpense` rows in the current period where `actualamount > budgetamount`.
- Tolerance is the lower of `upper_tolerance_instances` and `(total_lines * upper_tolerance_pct / 100)`.
- Same scoring curve as Amount metric.

**Parameters:**
- `upper_tolerance_instances` (int, default `2`)
- `upper_tolerance_pct` (int, default `10`)

**Evidence Examples:**
- `{ label: "Over-budget lines", value: "1", raw_value: 1, raw_unit: "count", limit: "2", raw_limit: 2, detail: "Number of expense lines where actual amount exceeds budgeted amount." }`
- `{ label: "Total expense lines", value: "12", raw_value: 12, raw_unit: "count", detail: "Total number of expense lines in the current period." }`

**Calculation Trace Example:**
- "Over-budget lines = 1. Tolerance = 2. Ratio = 0.5000. Score = 100 - (0.5000 × 30) = 85."

---

### `in_cycle_budget_adjustments` — In Cycle Budget Adjustments

| Attribute | Value |
|-----------|-------|
| **Scope** | `CURRENT_PERIOD` |
| **Description** | Change made to budget amount since the period started. |

**Calculation:**
- Count `PeriodTransaction` rows where `entry_kind = "budget_adjustment"` and `entrydate > period.startdate`.
- If `count == 0` → `100`
- If `count <= upper_tolerance_instances` → `100 - (count * 15)`
- Beyond tolerance → `70 - (excess * 20 * sensitivity)`

**Parameters:**
- `upper_tolerance_instances` (int, default `1`)

**Evidence Examples:**
- `{ label: "Budget adjustments", value: "0", raw_value: 0, raw_unit: "count", limit: "1", raw_limit: 1, detail: "Number of budget adjustments recorded after the period started." }`
- `{ label: "Budget adjustments", value: "3", raw_value: 3, raw_unit: "count", limit: "1", raw_limit: 1, detail: "Number of budget adjustments recorded after the period started." }`

**Calculation Trace Example:**
- "Adjustments = 0. Tolerance = 1. Score = 100."
- "Adjustments = 3. Tolerance = 1. Score = 70 - (2 × 20 × 0.50) = 50."

---

### `revisions_on_paid_expenses` — In Cycle Expense Revisions

| Attribute | Value |
|-----------|-------|
| **Scope** | `CURRENT_PERIOD` |
| **Description** | Number of expense revision transactions recorded after the period started. |

**Calculation:**
- Count `PeriodTransaction` rows where `entry_kind = "status_change"`, `source = "expense"`, `system_reason = "Line marked Revised"`, and `entrydate > period.startdate`.
- Same scoring curve as In Cycle Budget Adjustments.
- If `record_line_status_changes` is disabled, count is naturally zero.

**Parameters:**
- `upper_tolerance_instances` (int, default `2`)

**Evidence Examples:**
- `{ label: "Paid expense revisions", value: "0", raw_value: 0, raw_unit: "count", limit: "2", raw_limit: 2, detail: "Number of status-change revisions recorded on paid expense lines." }`
- `{ label: "Paid expense revisions", value: "4", raw_value: 4, raw_unit: "count", limit: "2", raw_limit: 2, detail: "Number of status-change revisions recorded on paid expense lines." }`

**Calculation Trace Example:**
- "Revisions = 0. Tolerance = 2. Score = 100."
- "Revisions = 4. Tolerance = 2. Score = 70 - (2 × 25 × 0.50) = 45."

---

### `period_trend` — Period Trend

| Attribute | Value |
|-----------|-------|
| **Scope** | `OVERALL` |
| **Description** | Compares the current period's health score against recent historical periods to identify improvement or decline. |

**Calculation:**
- Pre-compute the current period's composite score as the weighted average of all `CURRENT_PERIOD` metric scores.
- Query the last `lookback_periods` closed `FinancialPeriod` rows for the budget.
- For each historical period, retrieve `PeriodHealthResult` snapshots filtered to `CURRENT_PERIOD` scoped metrics and compute the unweighted average.
- `delta = current_period_composite_score - historical_average`
- If `delta >= -tolerance_points` → `100`
- Beyond tolerance → `100 - (excess × sensitivity_factor × 1.5)`
- `sensitivity_factor = scoring_sensitivity / 50.0`

**Parameters:**
- `lookback_periods` (int, default `3`) — Number of previous closed periods to include in the trend calculation.
- `tolerance_points` (int, default `5`) — Points of decline that are acceptable before the score begins to drop.

**Evidence Examples:**
- `{ label: "Current period score", value: "75", raw_value: 75, raw_unit: "score", detail: "Weighted composite score of current-period metrics for this period." }`
- `{ label: "Historical average", value: "82.0", raw_value: 82.0, raw_unit: "score", detail: "Average current-period score across the last 3 closed period(s)." }`
- `{ label: "Trend", value: "Declining", raw_value: "Declining", raw_unit: "status", detail: "Delta = -7.0 points vs historical average." }`

**Calculation Trace Example:**
- "Current = 75. Historical avg (3 periods) = 82.0. Delta = -7.0. Tolerance = 5. Excess = 2.0. Score = 100 - (2.0 × 1.0 × 1.5) = 97."
- "Current = 60. Historical avg (3 periods) = 85.0. Delta = -25.0. Tolerance = 5. Excess = 20.0. Sensitivity = 1.0. Score = 100 - (20.0 × 1.0 × 1.5) = 70."

**Additional Return Fields:**
- `delta` (int) — Difference between current period composite score and historical average.
- `trend` (str) — "Improving" | "Stable" | "Declining" derived from the delta.

---

### `budget_cycles_pending_closeout` — Budget Cycles Pending Close-Out

| Attribute | Value |
|-----------|-------|
| **Scope** | `OVERALL` |
| **Description** | The number of budget cycles that are awaiting close-out. |

**Calculation:**
- Count `FinancialPeriod` rows where `enddate < now` and `cycle_status != CLOSED`.
- If `count == 0` → `100`
- If `count <= upper_tolerance_instances` → `100 - (count * 20)`
- Beyond tolerance → `70 - (excess * 25 * sensitivity)`

**Parameters:**
- `upper_tolerance_instances` (int, default `0`)

**Evidence Examples:**
- `{ label: "Pending close-out cycles", value: "0", raw_value: 0, raw_unit: "count", limit: "0", raw_limit: 0, detail: "Number of budget cycles past their end date that are not yet closed." }`
- `{ label: "Pending close-out cycles", value: "2", raw_value: 2, raw_unit: "count", limit: "0", raw_limit: 0, detail: "Number of budget cycles past their end date that are not yet closed." }`

**Calculation Trace Example:**
- "Pending cycles = 0. Tolerance = 0. Score = 100."
- "Pending cycles = 2. Tolerance = 0. Score = 70 - (2 × 25 × 0.50) = 45."

---

## File Map

| Concept | File |
|---------|------|
| Global metric registry | `backend/app/health_engine/system_metrics.py` |
| Metric scoring executors | `backend/app/health_engine/metric_executors.py` |
| Engine runner | `backend/app/health_engine/runner.py` |
| Seed / default matrices | `backend/app/health_engine_seed.py` |
| SQLAlchemy models | `backend/app/models.py` |
| API endpoints | `backend/app/routers/health_matrices.py` |
| Frontend health tab | `frontend/src/pages/tabs/BudgetHealthTab.jsx` |
| Budget summary & health modals | `frontend/src/pages/BudgetsPage.jsx` |
| Close-out modal | `frontend/src/components/modals/CloseoutModal.jsx` |

**Last Updated:** 2026-05-02
