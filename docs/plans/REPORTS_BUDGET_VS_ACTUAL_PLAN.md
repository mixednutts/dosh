# Recharts Reporting Integration Plan

## Context

Dosh is a consolidated single-container application (FastAPI backend + React SPA frontend). The ROADMAP identifies a **Reporting Framework** as a beta priority, with three starter reports. For this initial phase, only **Budget vs Actual** is implemented to assess the reporting feature set. Income Allocation and Investment Trends remain on the roadmap for future work.

The user wants reporting accessed via a new "Reporting" button in the left sidebar, implemented using **Recharts** within the existing React SPA. Reports follow a sub-navigation pattern similar to Budget Cycles → Budget Details: a landing page at `/reports` with cards linking to individual report pages (e.g. `/reports/budget-vs-actual`).

Filtering is cycle-based and defaults to the **last 12 months**.

---

## Architecture

### High-Level Design

```
React SPA ──► FastAPI ──► SQLite DB
     │
     │ /reports/:budgetId?
     │ /reports/budget-vs-actual?budgetId=...
     ▼
Recharts pages (within React Router)
     │
     ▼
GET /api/reports/budgets/{id}/trends/budget-vs-actual
```

All reporting is internal to the existing SPA. No new containers, no Traefik changes, no external services.

### File Structure

```
dosh/
├── backend/app/
│   └── routers/
│       └── reports.py              # NEW: reporting endpoints
├── frontend/src/
│   ├── components/
│   │   ├── Layout.jsx              # Add Reporting nav button
│   │   ├── reports/
│   │   │   ├── BudgetVsActualChart.jsx
│   │   │   └── CycleFilter.jsx     # Cycle-based date range filter
│   ├── pages/
│   │   ├── ReportsLandingPage.jsx  # NEW: report selection landing
│   │   └── BudgetVsActualPage.jsx  # NEW: single report page
│   └── api/
│       └── client.js               # Add report endpoint wrappers
├── frontend/package.json           # Add recharts dependency
└── frontend/src/App.jsx            # Add /reports routes
```

---

## Backend: New Reporting Endpoints

New router `backend/app/routers/reports.py` mounted at `/api/reports`. All endpoints budget-scoped and read-only. Reuse existing SQLAlchemy queries — no new business logic, only aggregation.

| Endpoint | Description |
|----------|-------------|
| `GET /api/reports/budgets/{budget_id}/trends/budget-vs-actual` | Time-series across periods: income/expense/investment budget + actual |
| `GET /api/reports/budgets/{budget_id}/summary` | High-level aggregated summary for report landing page |

Income Allocation and Investment Trends endpoints are deferred to a future phase.

### Endpoint Detail: Budget vs Actual Trends

Query params:
- `from_date` (optional): ISO date string. Default = 12 months before latest period end.
- `to_date` (optional): ISO date string. Default = latest period end.
- `include_surplus` (optional, default `true`): whether to include surplus budget/actual lines.

Returns array of period objects:
```json
{
  "periods": [
    {
      "finperiodid": 1,
      "startdate": "2026-04-01",
      "enddate": "2026-04-14",
      "label": "Apr 1–14",
      "income_budget": 5000.00,
      "income_actual": 4800.00,
      "expense_budget": 3000.00,
      "expense_actual": 2900.00,
      "investment_budget": 1000.00,
      "investment_actual": 1000.00,
      "surplus_budget": 1000.00,
      "surplus_actual": 900.00
    }
  ]
}
```
Implementation: reuse `list_period_summaries_for_budget` aggregation logic, extend with actuals from `current_period_totals`. Filter periods by `startdate >= from_date` and `enddate <= to_date`. Default 12-month window computed from the budget's most recent period.

---

## Frontend: Recharts Integration

### Dependency
Add `recharts` to `frontend/package.json` (v2.x, compatible with React 18).

### Dark Mode Support
Recharts supports theming via `styled` components or inline `color` props. Dosh's dark mode is toggled via a class on `<html>`. Strategy:
- A `useChartTheme()` hook reads `document.documentElement.classList.contains('dark')`
- Returns a palette object: `{ grid: '#334155', text: '#94a3b8', line1: '#14b8a6', ... }`
- All chart components consume this hook for colors, stroke, fill

### Chart Components

**`BudgetVsActualChart.jsx`**
- `LineChart` with multiple `Line` elements inside `ResponsiveContainer`
- XAxis: period labels (e.g. "Apr 1–14")
- YAxis: currency values
- Tooltip: custom formatter showing `$X,XXX.XX`
- Legend: toggle lines on/off
- 6 Lines: Income Budget, Income Actual, Expense Budget, Expense Actual, Investment Budget, Investment Actual
- Optional 2 Lines: Surplus Budget, Surplus Actual (controlled by prop)
- All colors sourced from `useChartTheme`

**`CycleFilter.jsx`**
- Budget cycle-based date range selector
- Two `DateField` inputs (from / to) or preset buttons: "Last 12 Months", "Last 6 Months", "All Time"
- Default: "Last 12 Months" computed from the budget's latest period end date
- Emits `{ fromDate, toDate }` to parent on change
- Validation: `fromDate` must be <= `toDate`

### Reports Landing Page (`ReportsLandingPage.jsx`)
- Route: `/reports` and `/reports/:budgetId`
- If no `budgetId`, show budget selector card grid (reuses `BudgetsPage` card pattern)
- If `budgetId` present, show budget context header with breadcrumb: Budgets → {budgetName} → Reports
- Report cards grid (one card for now):
  - **Budget vs Actual** — description, thumbnail/preview icon, link to `/reports/budget-vs-actual?budgetId=...`
  - **Income Allocation** — grayed out "Coming soon" card
  - **Investment Trends** — grayed out "Coming soon" card
- Mobile: cards stack vertically

### Budget vs Actual Report Page (`BudgetVsActualPage.jsx`)
- Route: `/reports/budget-vs-actual?budgetId=...`
- Breadcrumb: Budgets → {budgetName} → Reports → Budget vs Actual
- Header with budget context switcher dropdown
- `CycleFilter` component above chart (default last 12 months)
- `BudgetVsActualChart` card below filter
- Loading and empty states ("No periods in selected date range")
- Mobile: full-width chart, filter stacks vertically

### Sidebar Integration (`Layout.jsx`)
- Add "Reporting" `NavLink` below "Budgets" in Workspace section
- Icon: `PresentationChartBarIcon` from `@heroicons/react/24/outline`
- When budget active: links to `/reports/${budgetId}`
- When no budget active: links to `/reports`
- Collapsed sidebar: icon-only with `title` tooltip
- Active state styling matches Budgets button

### Routing (`App.jsx`)
```jsx
<Route path="reports" element={<ReportsLandingPage />} />
<Route path="reports/:budgetId" element={<ReportsLandingPage />} />
<Route path="reports/budget-vs-actual" element={<BudgetVsActualPage />} />
```
Protected by same layout, no auth changes needed.

---

## Implementation Phases

### Phase 1: Infrastructure & Wiring
1. Add `recharts` to `frontend/package.json`
2. Run `npm install` in frontend
3. Create `backend/app/routers/reports.py` skeleton with router registration
4. Wire `reports` router into `backend/app/main.py`
5. Add `GET /api/reports/budgets/{budget_id}/summary` skeleton
6. Update `frontend/src/App.jsx` with `/reports`, `/reports/:budgetId`, and `/reports/budget-vs-actual` routes
7. Update `frontend/src/components/Layout.jsx` with Reporting button
8. Create empty `frontend/src/pages/ReportsLandingPage.jsx` and `frontend/src/pages/BudgetVsActualPage.jsx`
9. Build and verify no compile/runtime errors

### Phase 2: Backend Reporting Endpoints
1. Implement `GET /api/reports/budgets/{id}/trends/budget-vs-actual`
   - Accept `from_date`, `to_date`, `include_surplus` query params
   - Default 12-month window from latest period
   - Reuse `list_period_summaries_for_budget` + `current_period_totals`
2. Implement `GET /api/reports/budgets/{id}/summary`
   - Return budget metadata + period count + date range
3. Add backend tests:
   - Default 12-month filter behavior
   - Custom date range filtering
   - Empty budget (no periods)
   - Single period
   - Multi-period aggregation
   - Invalid budget ID (404)
4. Verify endpoints with curl / Swagger

### Phase 3: Chart Components & Filter
1. Create `frontend/src/hooks/useChartTheme.js`
2. Create `frontend/src/components/reports/BudgetVsActualChart.jsx`
   - ResponsiveContainer + LineChart
   - 6 Lines (income/expense/investment × budget/actual)
   - Optional surplus lines via prop
   - Dark-mode-aware colors from `useChartTheme`
3. Create `frontend/src/components/reports/CycleFilter.jsx`
   - Preset buttons: "Last 12 Months", "Last 6 Months", "All Time"
   - Custom date range inputs
   - Default to "Last 12 Months"
4. Add chart component tests (render without crash, prop validation)

### Phase 4: Report Pages
1. Implement `frontend/src/pages/ReportsLandingPage.jsx`
   - Budget selector when no `budgetId`
   - Report cards grid: Budget vs Actual (active), Income Allocation (coming soon), Investment Trends (coming soon)
   - Breadcrumb navigation
2. Implement `frontend/src/pages/BudgetVsActualPage.jsx`
   - Breadcrumb: Budgets → {budgetName} → Reports → Budget vs Actual
   - Budget context switcher dropdown
   - `CycleFilter` above chart
   - `BudgetVsActualChart` card
   - Loading and empty states
3. Wire up `useQuery` hooks to new API client methods
4. Mobile responsive layout (stack vertically)
5. Add page-level tests:
   - Landing renders budget selector when no budgetId
   - Landing renders report cards when budgetId present
   - Budget vs Actual renders chart when data loaded

### Phase 5: Polish & Integration
1. Add API wrappers to `frontend/src/api/client.js`
2. Ensure Reporting button active state works for `/reports` and `/reports/*` paths
3. Verify dark mode transitions update chart colors
4. Verify mobile layout
5. Full backend test suite: 339+ tests pass
6. Full frontend test suite: 364+ tests pass
7. Local Docker Compose build and validation
8. Update `scripts/bump_version.py` if needed
9. Update RELEASE_NOTES.md

---

## Design Decisions (No Longer Open)

| Decision | Option Chosen | Rationale |
|----------|--------------|-----------|
| Charting library | **Recharts** | User directive; React-native, composable, responsive |
| Visual integration | **Native React pages** | Seamless with existing SPA, no iframe/context switch |
| Data access | **FastAPI endpoints** | Clean separation, no SQLite concurrency risk, DRY |
| Container strategy | **No change** | Single container preserved; no new infrastructure |
| Budget scoping | **Budget-scoped** | Dosh is budget-centric; landing page shows selector if no budgetId |
| Dark mode | **useChartTheme hook** | Reads `html.dark` class, returns palette for Recharts |
| Report scope (this phase) | **Budget vs Actual only** | User directive; assess reporting infra with one report |
| Navigation pattern | **Sub-navigation** | Landing page → individual report pages, like Budget Cycles → Details |
| Filtering | **Cycle-based, default last 12 months** | User directive; preset + custom date range |
| Deferred reports | **Income Allocation, Investment Trends** | On roadmap for future phase |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Recharts bundle size | Medium | Tree-shake imports (`import { LineChart } from 'recharts'`). Monitor Vite chunk size. |
| Chart color drift from LOOK_AND_FEEL.md | Low | Centralize palette in `useChartTheme.js`; map to canonical tones |
| Data aggregation performance | Low | Endpoints reuse existing queries; add DB indexes later if needed |
| Mobile chart readability | Medium | Use `ResponsiveContainer`; reduce tick count on narrow screens |
| Test coverage gap | Low | Chart components tested for render; page tested for data integration |

---

## Alternatives Considered

### Streamlit
- **Pros:** Rapid prototyping, rich Python analytics
- **Cons:** Visual discontinuity, separate container/service, auth complexity, breaks single-container model
- **Verdict:** Rejected per user preference for Recharts.

### Chart.js / react-chartjs-2
- **Pros:** Mature, canvas-based (faster for large datasets)
- **Cons:** Imperative API, harder to make responsive and React-idiomatic
- **Verdict:** Rejected; Recharts is more declarative and fits React better.

### Victory
- **Pros:** Powerful, animation support
- **Cons:** Steeper learning curve, larger bundle
- **Verdict:** Rejected; Recharts covers the three starter reports with lower overhead.

---

## Clarifying Questions (All Answered)

1. **Report layout:** Sub-navigation pattern. Landing page at `/reports` with cards linking to individual reports (`/reports/budget-vs-actual`). Only Budget vs Actual implemented now; others deferred. ✅
2. **Date range filtering:** Cycle-based filtering with presets (Last 12 Months, Last 6 Months, All Time) + custom range. Default to last 12 months. ✅
3. **Investment trends granularity:** Deferred to future phase. ✅

---

## Success Criteria

- [ ] "Reporting" button visible in Dosh sidebar, linking to `/reports` and `/reports/:budgetId`
- [ ] `recharts` installed and tree-shakeable imports working
- [ ] Backend `GET /api/reports/budgets/{id}/trends/budget-vs-actual` returns correct time-series data
- [ ] Backend endpoint supports `from_date`, `to_date`, `include_surplus` query params
- [ ] Backend endpoint defaults to last 12 months when no date range provided
- [ ] Budget vs Actual chart renders multi-line trend with budget/actual pairs
- [ ] Chart respects dark mode via `useChartTheme`
- [ ] Reports landing page shows budget selector when no budgetId in URL
- [ ] Reports landing page shows report cards (Budget vs Actual active, others "Coming soon")
- [ ] Budget vs Actual report page shows cycle filter defaulting to last 12 months
- [ ] Budget vs Actual report page shows breadcrumb navigation
- [ ] Mobile layout stacks filter and chart vertically without overflow
- [ ] Backend tests for reporting endpoint (filtering, defaults, empty budget, invalid ID)
- [ ] Frontend tests for ReportsLandingPage, BudgetVsActualPage, and chart components
- [ ] Full test suites pass (339+ backend, 364+ frontend)
- [ ] Local Docker Compose build succeeds
- [ ] No regression in existing functionality
