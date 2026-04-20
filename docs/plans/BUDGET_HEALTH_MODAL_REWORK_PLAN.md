# Budget Health Modal Rework Plan

## Context

The current Budget Health Details modal and Current Period Check modal present metric evidence as flat strings (e.g. "Overrun amount: $120.00 (limit: $50.00)"). Users cannot easily see:
- The raw source values that drive a metric score
- How each metric score is weighted into the overall / current-period total
- The connection between source data, metric score, and aggregate score

Additionally, the Current Period Check modal uses a single flat evidence list, while the overall Budget Health modal uses per-metric "pillar" cards. The two surfaces should feel consistent, especially since some metrics apply to both scopes.

## Goals

1. **Structured evidence**: Backend metric executors return structured evidence objects that the frontend can render richly without string parsing.
2. **Consistent modal layout**: Both the overall Budget Health modal and the Current Period Check modal use per-metric cards (pillars) with score, status, summary, and evidence.
3. **Score interconnectivity**: Each metric card exposes an expandable "How this score is calculated" section showing raw values, tolerance, the formula / curve used, the metric's weight, and its weighted contribution to the total.
4. **No schema impact**: No database schema changes. Evidence is still stored as JSON in `evidence_json`; we only change the shape of the JSON objects inside.

## Out of Scope

- Changes to the scoring algorithms themselves (curve formulas stay the same)
- Changes to the Budget Health Tab (matrix configuration UI)
- Changes to the database schema or `PeriodHealthResult` model
- Drill-down navigation links (removed in 0.6.0-alpha, not being re-added here)

## Current Payload Shapes

### Overall Budget Health (`evaluate_budget_health` in `runner.py`)

```json
{
  "overall_score": 56,
  "overall_status": "Watch",
  "pillars": [
    {
      "name": "Setup Health",
      "score": 100,
      "status": "Strong",
      "summary": "Your budget setup looks solid...",
      "evidence": [
        {"label": "Setup Health", "value": "100"}
      ]
    }
  ],
  "current_period_check": {
    "score": 56,
    "status": "Watch",
    "summary": "Expense overrun exceeds configured limits.",
    "evidence": [
      {"label": "Budget vs Actual (Amount)", "value": "70"},
      {"label": "Budget vs Actual (Lines)", "value": "40"}
    ]
  }
}
```

Problems:
- Pillar evidence is a flat list of `{label, value}` with no structure
- `current_period_check.evidence` is also flat `{label, value}` — no status, no summary per metric
- No weight or contribution information is returned

## Proposed Payload Shapes

### Metric Evidence Item (structured)

Each executor returns `evidence` as a list of objects:

```json
{
  "label": "Overrun amount",
  "value": "$120.00",
  "raw_value": 120.00,
  "raw_unit": "currency",
  "limit": "$50.00",
  "raw_limit": 50.00,
  "detail": "Aggregate amount by which actual expenses exceed budgeted amounts."
}
```

For count-based metrics:

```json
{
  "label": "Over-budget lines",
  "value": "3",
  "raw_value": 3,
  "raw_unit": "count",
  "limit": "2",
  "raw_limit": 2,
  "detail": "Number of expense lines where actual > budget."
}
```

### Pillar / Current-Period Metric Card

```json
{
  "name": "Budget vs Actual (Amount)",
  "key": "budget_vs_actual_amount",
  "score": 70,
  "status": "Watch",
  "summary": "Expense overrun exceeds configured limits.",
  "weight": 0.30,
  "weighted_contribution": 21.0,
  "evidence": [
    {"label": "Overrun amount", "value": "$120.00", "raw_value": 120.00, ...}
  ]
}
```

### Overall Budget Health (revised)

```json
{
  "overall_score": 56,
  "overall_status": "Watch",
  "pillars": [
    {
      "name": "Setup Health",
      "key": "setup_health",
      "score": 100,
      "status": "Strong",
      "summary": "...",
      "weight": 0.40,
      "weighted_contribution": 40.0,
      "evidence": [...]
    }
  ],
  "current_period_check": {
    "score": 56,
    "status": "Watch",
    "summary": "Expense overrun exceeds configured limits.",
    "metrics": [
      {
        "name": "Budget vs Actual (Amount)",
        "key": "budget_vs_actual_amount",
        "score": 70,
        "status": "Watch",
        "summary": "...",
        "weight": 0.30,
        "weighted_contribution": 21.0,
        "evidence": [...]
      }
    ]
  }
}
```

Note: `current_period_check.evidence` is replaced by `current_period_check.metrics` for consistency with the pillar layout.

### Backward Compatibility

The frontend modals are the only consumers of `current_period_check` and `pillars`. The `PeriodHealthResult.evidence_json` column stores whatever the executor returns; since we still store JSON, there is no schema impact. Existing snapshot rows will contain the old string-array format, but they are historical and only displayed in close-out contexts where the evidence is not currently surfaced.

## Frontend Modal Changes

### BudgetHealthModal (`BudgetsPage.jsx`)

Current:
- One top-level score circle + summary
- A list of `pillar` sections, each with a flat evidence list

New:
- One top-level score circle + summary + **expandable "Score breakdown"** showing the weighted sum formula
- Each pillar card has:
  - Header: name + status dot + score
  - Summary text
  - Evidence grid/list with structured values (value vs limit comparison when applicable)
  - **Expandable "How this score is calculated"** section:
    - Raw source values (from evidence)
    - Scoring curve description (e.g. "Within tolerance = 100, linear decay to 70, then penalty")
    - Weight × Score = Contribution to total

### CurrentPeriodCheckModal (`BudgetsPage.jsx`)

Current:
- One top-level traffic light + summary + score circle
- A single "Current Period Check" section with a flat evidence list

New:
- One top-level traffic light + summary + score circle + **expandable "Score breakdown"**
- Per-metric cards (mirroring pillar cards) instead of a single flat list
- Each metric card has the same structure as a pillar card
- **Expandable "How this score is calculated"** in each card

## Implementation Steps

### 1. Backend: Structured Evidence in Executors

Update all six metric executors in `metric_executors.py` to return `evidence` as a list of structured dicts instead of strings.

Keep the same `summary`, `score`, `status` fields. Only `evidence` changes shape.

Example for `_budget_vs_actual_amount_executor`:

```python
evidence = [
    {
        "label": "Overrun amount",
        "value": f"${overrun:.2f}",
        "raw_value": float(overrun),
        "raw_unit": "currency",
        "limit": f"${upper_tolerance_amount:.2f}",
        "raw_limit": float(upper_tolerance_amount),
        "detail": "Aggregate amount by which actual expenses exceed budgeted amounts.",
    },
    {
        "label": "Overrun percentage limit",
        "value": f"{upper_tolerance_pct:.1f}%",
        "raw_value": float(upper_tolerance_pct),
        "raw_unit": "percentage",
        "detail": "Percentage of total budgeted expenses allowed as overrun.",
    },
]
if total_budgeted > 0:
    evidence.append({
        "label": "Budgeted expenses",
        "value": f"${total_budgeted:.2f}",
        "raw_value": float(total_budgeted),
        "raw_unit": "currency",
        "detail": "Total budgeted expense amount for the current period.",
    })
```

### 2. Backend: Runner Payload Enhancement

In `runner.py`, update:

- `evaluate_period_health` to include `metric_key` in each result
- `evaluate_budget_health` pillar building to include `key`, `weight`, and `weighted_contribution`
- `current_period_check` building to use a new `metrics` array with full card data instead of flat `evidence`

Pillar building:

```python
for r in overall_metrics:
    weight = r["weight"]
    contribution = r["score"] * weight
    pillars.append({
        "name": r["name"],
        "key": r["metric_key"],
        "score": r["score"],
        "status": r["status"],
        "summary": r["summary"],
        "weight": weight,
        "weighted_contribution": round(contribution, 2),
        "evidence": r["evidence"],
    })
```

Current period check:

```python
current_period_check = {
    "score": weighted_score,
    "status": _health_status(weighted_score),
    "summary": current_metrics[0]["summary"] if current_metrics else "...",
    "metrics": [
        {
            "name": m["name"],
            "key": m["metric_key"],
            "score": m["score"],
            "status": m["status"],
            "summary": m["summary"],
            "weight": m["weight"],
            "weighted_contribution": round(m["score"] * m["weight"], 2),
            "evidence": m["evidence"],
        }
        for m in current_metrics
    ],
}
```

### 3. Backend: Tests

Update `test_health_engine.py` assertions to expect structured evidence objects instead of strings.
Update `test_health_matrices.py` if it asserts on evidence shapes.
Update `test_lifecycle_and_health.py` if it checks pillar/current_period_check structure.

### 4. Frontend: BudgetHealthModal

- Replace flat evidence list with a structured evidence display
- Add `MetricCard` shared component (used by both modals) that renders:
  - Header with name, status dot, score
  - Summary
  - Evidence list (value vs limit where applicable, with subtle coloring when over limit)
  - Expandable "How this score is calculated" panel with:
    - Source data values
    - Scoring curve description (hardcoded per metric key or passed from backend)
    - Weight × Score = Contribution line

- Add top-level expandable "Score breakdown" in the modal header showing the overall weighted sum.

### 5. Frontend: CurrentPeriodCheckModal

- Replace the single flat evidence list with per-metric cards using the shared `MetricCard` component
- Structure matches `BudgetHealthModal` pillars
- Top-level score breakdown expandable

### 6. Frontend: Tests

- Update `BudgetsPage.test.jsx` mocks to return new payload shapes
- Add assertions for expandable sections and structured evidence rendering

## Files to Modify

| File | Change |
|------|--------|
| `backend/app/health_engine/metric_executors.py` | Return structured evidence dicts from all 6 executors |
| `backend/app/health_engine/runner.py` | Include `key`, `weight`, `weighted_contribution` in pillars and `current_period_check.metrics` |
| `backend/tests/test_health_engine.py` | Assert structured evidence shape |
| `backend/tests/test_health_matrices.py` | Update if evidence assertions exist |
| `backend/tests/test_lifecycle_and_health.py` | Update if pillar/current_period_check assertions exist |
| `frontend/src/pages/BudgetsPage.jsx` | Rework `BudgetHealthModal` and `CurrentPeriodCheckModal` |
| `frontend/src/__tests__/BudgetsPage.test.jsx` | Update mocks and assertions |

## UI Sketch

### BudgetHealthModal — Pillar Card

```
┌─────────────────────────────────────────────┐
│ Setup Health                    ●  Score 100 │
│ Your budget setup looks solid...            │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Income sources        3  (need ≥ 1)     │ │
│ │ Active expenses       5  (need ≥ 1)     │ │
│ │ Active investments    2  (need ≥ 1)     │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [+] How this score is calculated            │
│     Weight: 40%                             │
│     Contribution: 100 × 40% = 40 pts        │
│     Scoring: pass/fail per category         │
└─────────────────────────────────────────────┘
```

### CurrentPeriodCheckModal — Metric Card

```
┌─────────────────────────────────────────────┐
│ Budget vs Actual (Amount)       ●  Score 70 │
│ Expense overrun exceeds configured limits.  │
│                                             │
│ ┌─────────────────────────────────────────┐ │
│ │ Overrun amount      $120.00  / $50.00   │ │
│ │ Overrun % limit     5.0%                │ │
│ │ Budgeted expenses   $2,400.00           │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ [+] How this score is calculated            │
│     Weight: 30%                             │
│     Contribution: 70 × 30% = 21 pts         │
│     Curve: within tolerance → 100, decay    │
│            to 70, then penalty per $ over   │
└─────────────────────────────────────────────┘
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Old `evidence_json` snapshots contain string arrays, causing parse issues if surfaced | Snapshots are historical and not currently surfaced in detail modals; no impact |
| Frontend tests rely on old flat `{label, value}` evidence shape | Update mocks and assertions as part of the plan |
| Modal becomes too tall with many metrics + expandable sections | Use compact evidence rows and collapsed-by-default expandables |
| Adding `key` to pillar payload may break closeout preview if it reuses pillar shape | Closeout preview uses `preview.health` with `score`, `summary`, `status` only; no pillar reuse |

## Success Criteria

- [ ] All 6 metric executors return structured evidence objects
- [ ] `evaluate_budget_health` returns `key`, `weight`, `weighted_contribution` in pillars
- [ ] `current_period_check` returns a `metrics` array with full per-metric card data
- [ ] `BudgetHealthModal` renders per-metric cards with structured evidence
- [ ] `CurrentPeriodCheckModal` renders per-metric cards mirroring the overall modal
- [ ] Both modals have an expandable "How this score is calculated" section
- [ ] All backend tests pass
- [ ] All frontend tests pass
