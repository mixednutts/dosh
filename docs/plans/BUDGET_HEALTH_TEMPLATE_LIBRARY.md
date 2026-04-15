# Budget Health Engine — Template & Data Source Library

> **Working Document:** This document catalogs the current matrix templates, metric templates, data sources, threshold definitions, and scoring logic that power the Budget Health Engine. Use this as the reference when refining existing templates or designing new ones.

## Purpose

- Provide a single, discoverable reference for all current health engine templates and data sources
- Document calculation logic, real-world examples, and threshold interactions in one place
- Support future template design and refinement with a clear checklist and file map

## Scope

- Current data source executors and their parameters
- Current threshold definitions, scales, and metric mappings
- Current metric templates (`setup_health`, `budget_discipline`, `planning_stability`, `current_period_check`)
- Current matrix template (`standard_budget_health`)
- Design checklist for new templates

## Related Documents

- [BUDGET_HEALTH_ENGINE_PLAN.md](./BUDGET_HEALTH_ENGINE_PLAN.md) — Canonical design reference for the engine architecture and data models
- [AGENTS.md](../../AGENTS.md) — Operational constraints and current project state
- [DEVELOPMENT_ACTIVITIES.md](../DEVELOPMENT_ACTIVITIES.md) — Health-related roadmap work

---

## 1. How the Engine Works (Integration Flow)

```
Data Sources  →  Formula  →  Threshold  →  Metric Executor  →  Score + Evidence
     ↑                                               ↓
HealthScale / HealthThresholdDefinition      Matrix Weighting  →  Overall Health
```

1. **Data Sources** are code-backed functions that pull live values from the database (e.g. total budgeted income for a period).
2. **Formulas** combine data sources using safe arithmetic (`+`, `-`, `*`, `/`, parentheses).
3. **Thresholds** provide user-tunable benchmarks (e.g. "acceptable expense overrun = 10%").
4. **Metric Executors** take the `formula_result`, threshold value, and `scoring_sensitivity` (0-100) and produce a **score** (0-100), **status** (`Strong` / `Watch` / `Needs Attention`), and **evidence** lines.
5. **Matrix Templates** group metrics with weights. The weighted average becomes the **overall health score**.

---

## 2. Data Sources Catalog

| Key | Name | Parameters | Return Type | Calculation Logic | Real-World Example |
|-----|------|------------|-------------|-------------------|--------------------|
| `total_budgeted_income` | Total Budgeted Income | `finperiodid` (int, required) | `decimal` | `SUM(periodincome.budgetamount)` for the given period. | A user budgets $5,000 income for May → returns `5000.00`. |
| `total_budgeted_expenses` | Total Budgeted Expenses | `finperiodid` (int, required) | `decimal` | `SUM(periodexpenses.budgetamount)` for the given period. | May budget has $3,200 in expenses → returns `3200.00`. |
| `total_actual_expenses` | Total Actual Expenses | `finperiodid` (int, required) | `decimal` | `SUM(periodexpenses.actualamount)` for the given period. | By mid-May, $1,450 has been spent → returns `1450.00`. |
| `income_source_count` | Income Source Count | `budgetid` (int, required) | `count` | `COUNT(incometypes)` configured for the budget. | User has salary + side hustle + partner income → returns `3`. |
| `active_expense_count` | Active Expense Count | `budgetid` (int, required) | `count` | `COUNT(expenseitems)` where `active = TRUE`. | 12 active bills/subscriptions tracked → returns `12`. |
| `future_period_count` | Future Period Count | `budgetid` (int, required) | `count` | `COUNT(financialperiods)` where `startdate > NOW(UTC)`. | 6 future months already generated → returns `6`. |
| `historical_overrun_ratio` | Historical Overrun Ratio | `budgetid` (int, required) | `decimal` | For closed (`enddate < NOW`) **and locked** periods: average of `(actual / budgeted) - 1`. Returns `0` if no history. | Past 3 locked periods averaged 8% over budget → returns `0.08`. |
| `revised_line_count` | Revised Line Count | `finperiodid` (int, required) | `count` | Count of `PeriodExpense` + `PeriodIncome` rows with `status = 'Revised'`. | 2 expenses and 1 income line revised this period → returns `3`. |
| `live_period_surplus` | Live Period Surplus | `finperiodid` (int, required) | `decimal` | `total_budgeted_income - total_budgeted_expenses - total_budgeted_investments`. | $5,000 income - $3,200 expenses - $800 investments → returns `1000.00`. |
| `period_progress_ratio` | Period Progress Ratio | `finperiodid` (int, required) | `decimal` | Elapsed seconds / total seconds in the period, clamped `0.0` to `1.0`. | 15th of 30-day month → returns `~0.50`. |

### 2.1 Data Source Implementation Notes
- Executors live in [`../../backend/app/health_engine_data_sources.py`](../../backend/app/health_engine_data_sources.py).
- Formulas reference data sources by their `source_key`. The runner auto-injects the required parameters (`finperiodid` or `budgetid`) based on evaluation context.
- Return types are used for display hinting only; all formula evaluation treats values as decimals internally.

---

## 3. Threshold Definitions Catalog

Thresholds are user-tunable benchmarks stored in `healththresholddefinitions`. Each metric can be linked to **one** threshold value via `budgetmetricthresholds`.

| Key | Name | Scale | Default | What It Controls |
|-----|------|-------|---------|------------------|
| `acceptable_expense_overrun_pct` | Acceptable Expense Overrun | `percentage_0_100` (0-100%, step 1) | `10` | How much historical overspending is tolerated before `budget_discipline` score drops. |
| `comfortable_surplus_buffer_pct` | Comfortable Surplus Buffer | `percentage_0_100` (0-100%, step 1) | `5` | Minimum surplus % that feels safe (available for future metric templates). |
| `maximum_deficit_amount` | Maximum Deficit Amount | `dollar_amount` ($0+, step $0.01) | `null` | Largest deficit tolerated in the current period before `current_period_check` score drops sharply. When `null`, the executor defaults to `MAX(income × 10%, $50)`. |
| `revision_sensitivity` | Revision Sensitivity | `ten_scale_1_10` (1-10, step 1) | `5` | How strongly revisions impact `planning_stability`. Higher sensitivity = fewer allowed revisions before penalty. |
| `savings_priority` | Savings Priority | `ten_scale_1_10` (1-10, step 1) | `5` | Importance placed on savings contributions in overall health (available for future metric templates). |
| `period_criticality_bias` | Period Criticality Bias | `ten_scale_1_10` (1-10, step 1) | `5` | How much timing within the period amplifies health concerns (available for future metric templates). |

### 3.1 Scale Types
- **`percentage_0_100`** — Integer 0-100, typically used for tolerance percentages.
- **`ten_scale_1_10`** — Integer 1-10, used for sensitivity/priority dials.
- **`dollar_amount`** — Numeric with 2 decimal places, used for absolute financial thresholds.
- **`severity_low_med_high`** — Enum (`low`, `medium`, `high`) reserved for future severity-based metrics.

### 3.2 Threshold → Metric Mapping (Current)
| Metric Template | Linked Threshold | Fallback When Missing |
|-----------------|------------------|-----------------------|
| `setup_health` | None | N/A (no threshold used) |
| `budget_discipline` | `acceptable_expense_overrun_pct` | `10%` |
| `planning_stability` | `revision_sensitivity` | `5` |
| `current_period_check` | `maximum_deficit_amount` | `MAX(income × 10%, $50)` |

---

## 4. Metric Templates Catalog

### 4.1 `setup_health` — Setup Health

| Attribute | Value |
|-----------|-------|
| **Scope** | `OVERALL` |
| **Formula** | `income_source_count + active_expense_count + future_period_count` |
| **Threshold** | None |
| **Drill-down** | Disabled |

**Scoring Logic** (from [`../../backend/app/health_engine/metric_executors.py`](../../backend/app/health_engine/metric_executors.py)):
- `+35` points if `income_source_count > 0`
- `+35` points if `active_expense_count > 0`
- `+30` points if `future_period_count >= 1`
- Max `100`

**Evidence Examples:**
- Strong: "3 income source(s) configured", "12 active expense(s) configured", "6 future period(s) generated"
- Attention: "No income sources configured", "No active expenses configured", "No future periods generated"

**Tone-aware Summaries:**
- Supportive: "Your budget setup looks solid with the current income, expenses, and period coverage."
- Factual: "Income sources, active expenses, and future period counts are within expected ranges."
- Friendly: "Looks like your budget is set up nicely — income, expenses, and periods are all in order!"

**Real-World Example:**
> Sarah just created her first budget. She added her salary and a rental income source, set up 8 active expenses (rent, groceries, utilities, etc.), and generated the next 12 periods. Her Setup Health score is `100` (Strong).

---

### 4.2 `budget_discipline` — Budget Discipline

| Attribute | Value |
|-----------|-------|
| **Scope** | `OVERALL` |
| **Formula** | `historical_overrun_ratio` |
| **Threshold** | `acceptable_expense_overrun_pct` |
| **Drill-down** | Enabled |

**Scoring Logic:**
1. Convert ratio to percentage: `overrun_pct = formula_result × 100`.
2. `threshold = acceptable_expense_overrun_pct` (default `10`).
3. `sensitivity_factor = scoring_sensitivity / 50` (1.0 at midpoint).
4. If `overrun_pct <= 0`: score = `100`.
5. If `overrun_pct <= threshold`: linear decay, lose up to `20` points.
6. If `overrun_pct > threshold`: steeper penalty — `80 - (excess × sensitivity_factor × 3)`.
7. Clamp `0-100`.

**Evidence Examples:**
- "Average historical overrun: 4.5%"
- "Acceptable threshold: 10%"

**Real-World Example:**
> Tom's historical overrun is `14%` and his threshold is `10%` with normal sensitivity (`50`). His excess is `4%`, so the penalty is `4 × 1.0 × 3 = 12` points. Score = `80 - 12 = 68` (`Watch`). The evidence tells him he's averaging 14% over budget — time to review discretionary spending.

---

### 4.3 `planning_stability` — Planning Stability

| Attribute | Value |
|-----------|-------|
| **Scope** | `BOTH` (overall + current period views) |
| **Formula** | `revised_line_count` |
| **Threshold** | `revision_sensitivity` |
| **Drill-down** | Enabled |

**Scoring Logic:**
1. `sensitivity_factor = scoring_sensitivity / 50`.
2. `base_tolerance = max(1, int(3 / sensitivity_factor))`.
   - Normal sensitivity (`50`) → tolerance = `3` revisions.
   - High sensitivity (`100`) → tolerance = `1` revision.
3. `0` revisions → `100`.
4. `<= base_tolerance` → `100 - (revisions × 10)`.
5. `> base_tolerance` → `70 - (excess × 15 × sensitivity_factor)`.
6. Clamp `0-100`.

**Evidence Examples:**
- "Revised line count: 1"
- "Revision sensitivity: 5"

**Real-World Example:**
> Emma has revised 5 lines this month and her sensitivity is set to `8` (fairly strict). `base_tolerance = max(1, int(3 / 1.6)) = 1`. Excess = `4`. Penalty = `4 × 15 × 1.6 = 96`. Score = `70 - 96 = 0` (clamped), giving her `Needs Attention`. The friendly tone says: "5 changes so far — staying flexible!" but the score encourages her to lock the plan.

---

### 4.4 `current_period_check` — Current Period Check

| Attribute | Value |
|-----------|-------|
| **Scope** | `CURRENT_PERIOD` |
| **Formula** | `live_period_surplus + total_budgeted_income * 0` |
| **Threshold** | `maximum_deficit_amount` |
| **Drill-down** | Enabled (lists over-budget expenses) |

**Scoring Logic:**
1. `surplus = formula_result` (can be negative = deficit).
2. `max_deficit = threshold_value` or fallback `MAX(total_income × 10%, $50)`.
3. `sensitivity_factor = scoring_sensitivity / 50`.
4. If `surplus >= 0`: score = `100`.
5. If `abs(surplus) <= max_deficit`: `100 - (ratio × 30)` (lose up to 30 points).
6. If `abs(surplus) > max_deficit`: `70 - (excess × sensitivity_factor × 2)`.
7. Clamp `0-100`.

**Drill-Down Output:**
When any `periodexpenses.actualamount > budgetamount`, the executor emits drill-down entries:
```json
{
  "type": "period_expense",
  "label": "Over budget: Groceries",
  "finperiodid": 42,
  "expensedesc": "Groceries"
}
```

**Evidence Examples:**
- "Period surplus: $450.00"
- "Budgeted income: $5,000.00"
- "Budgeted expenses: $3,750.00"

**Real-World Example:**
> Alex is running a `-$120.00` surplus this fortnight. His budgeted income is `$2,500`, so the fallback max deficit is `max($250, $50) = $250`. Because `$120` is within tolerance, the ratio is `120/250 = 0.48`. Score = `100 - (0.48 × 30) = 86` (`Strong`). The evidence shows he's slightly underwater but still within the safety zone.

---

## 5. Matrix Templates Catalog

### 5.1 `standard_budget_health` — Standard Budget Health

| Attribute | Value |
|-----------|-------|
| **System** | `true` |
| **Description** | Default health matrix covering setup, discipline, stability, and current period. |

**Composition:**

| Metric Template | Weight | Display Order | Rationale |
|-----------------|--------|---------------|-----------|
| `setup_health` | `25%` | 1 | Foundation matters — without setup, nothing else is meaningful. |
| `budget_discipline` | `25%` | 2 | Historical behavior is a strong predictor of future health. |
| `planning_stability` | `20%` | 3 | Revisions signal plan drift; weighted slightly lower than history. |
| `current_period_check` | `30%` | 4 | The here-and-now gets the highest weight because it's actionable. |

**Overall Score Calculation:**
```
overall_score = Σ(metric_score × weight)
```
Each metric score is `0-100`. Weights sum to `1.0` (100%).

**Status Mapping:**
- `score >= 80` → `Strong`
- `score >= 55` → `Watch`
- `score < 55` → `Needs Attention`

**Real-World Example:**
> Jordan's budget scores:
> - Setup Health: `100`
> - Budget Discipline: `72`
> - Planning Stability: `90`
> - Current Period Check: `60`
>
> Overall = `(100×0.25) + (72×0.25) + (90×0.20) + (60×0.30)` = `25 + 18 + 18 + 18 = 79` → `Watch`.
> The matrix tells Jordan his setup is great and his plan is stable, but his current period is tight and historical discipline is slipping.

---

## 6. Designing New Templates — Checklist

When proposing a new metric or matrix template, document the following:

1. **Data Sources** — Which existing sources does it use? Are new executors needed in `health_engine_data_sources.py`?
2. **Formula** — Write the arithmetic expression. Verify all referenced source keys exist.
3. **Threshold** — Does it need a tunable threshold? If so, define the `HealthThresholdDefinition` (scale, default, rationale).
4. **Scoring Logic** — How does `formula_result` map to a `0-100` score? What is the fallback if the threshold is missing?
5. **Evidence & Tone** — Write factual, supportive, and friendly evidence strings. Keep them concise.
6. **Scope** — `OVERALL`, `CURRENT_PERIOD`, or `BOTH`?
7. **Matrix Weight** — If part of a matrix, justify the weight relative to user actionability.

---

## 7. Quick Reference: File Locations

| Concept | File |
|---------|------|
| Data source executors | [`../../backend/app/health_engine_data_sources.py`](../../backend/app/health_engine_data_sources.py) |
| Metric scoring executors | [`../../backend/app/health_engine/metric_executors.py`](../../backend/app/health_engine/metric_executors.py) |
| Engine runner (formula evaluator) | [`../../backend/app/health_engine/runner.py`](../../backend/app/health_engine/runner.py) |
| Seed / template definitions | [`../../backend/app/health_engine_seed.py`](../../backend/app/health_engine_seed.py) |
| SQLAlchemy models | [`../../backend/app/models.py`](../../backend/app/models.py) |
| API endpoints (matrices & thresholds) | [`../../backend/app/routers/health_matrices.py`](../../backend/app/routers/health_matrices.py) |

**Last Updated:** 2026-04-15
