# Dosh Development Activities (Beta)

This is the **beta execution backlog** for Dosh.

- **High-level roadmap**: [ROADMAP.md](/home/ubuntu/dosh/docs/ROADMAP.md)
- **Pre-beta reference (archived)**: [docs/archive/DEVELOPMENT_ACTIVITIES-pre-beta-2026-04-23.md](/home/ubuntu/dosh/docs/archive/DEVELOPMENT_ACTIVITIES-pre-beta-2026-04-23.md)

## Now / Next / Later

### Now
- Reporting foundations (first useful reports + first drilldown slice)
- Budget health trending / momentum (initial user-visible impact of current cycle)

### Next
- Scheduled income (phase 1: schema + generation allocation with safe defaults)
- User guides + formula library (tight scope, high leverage)

### Later
- Metric library expansion (new metrics only when evidence + meaning are strong)
- Rich reporting (graphs, comparisons, historical filters, more drilldowns)

## Activity Model

This document uses the project activity model:

- `Roadmap Area`
- `Activity Group`
- `Activity`

Status convention:

- `Idea`
- `Active`
- `Next`
- `Later`
- `Completed`

## Roadmap Areas (Beta)

### 1) Budget Health Metrics

#### Activity Group: Expand Metrics

Status:
- `Next`

Activities:
- add new metrics only when they have clear evidence + user-facing meaning
- keep [BUDGET_HEALTH_METRIC_LIBRARY.md](/home/ubuntu/dosh/docs/BUDGET_HEALTH_METRIC_LIBRARY.md) updated as metrics evolve

#### Activity Group: Health Trending / Momentum

Status:
- `Active`

Activities:
- define "trend" semantics (what changes, over what window, and why users should care)
- add an initial trending visualization on budget summary (minimal but trustworthy)

### 2) UX / UI

A generalised area for bugs, UI inconsistencies, and UX improvements. Specific items are tracked below; ad-hoc bugs and UI tweaks should reference this roadmap area from the development activities document.

#### Activity Group: Budget Cycle Detail Header Polish

Status:
- `Completed` (2026-04-23)

Activities:
- redesigned the Budget Cycle Details page header for improved visual hierarchy and clearer cycle status communication
- enhanced breadcrumb navigation with hover transitions and truncation for long budget names
- promoted cycle stage to a visual badge: filled brand-color pill with pulse indicator for Current cycles, bordered badges for Closed/Upcoming
- improved metadata presentation with icon-enhanced frequency display and vertical divider pattern
- deliverable: updated `PeriodDetailPage.jsx` header section (lines 302-347)

#### Activity Group: Release Notes Previous Version Badge Fix

Status:
- `Completed` (2026-04-23)

Activities:
- fixed the in-app Release Notes modal showing "Current Version" badge against older/previous releases
- added a new `tone="previous"` variant to the `ReleaseCard` component with neutral gray styling and "Previous Release" label
- previous releases now render with distinct visual treatment instead of incorrectly reusing the current-release styling
- deliverable: updated `ReleaseNotesModal.jsx` (`ReleaseCard` tone logic and previous-releases map at line 218)

#### Activity Group: Mobile Presentation Layer Improvements

Status:
- `Completed` (2026-04-24)

Activities:
- improved mobile usability across the app through touch-target sizing, card-based table views, and responsive layout polish
- increased all interactive elements to 44px minimum touch target on mobile while preserving exact desktop sizing via Tailwind responsive breakpoints
- replaced horizontal-scrolling detail tables with stacked card views on mobile for Income, Expense, Investment, and Balance sections in period detail
- replaced setup tables with card-based mobile views for IncomeTypesTab, ExpenseItemsTab, and BalanceTypesTab
- added scrollable overflow containers to BudgetPeriodsPage and Dashboard summary tables for edge-to-edge mobile scrolling
- made modals full-screen on mobile with fixed headers, scrollable bodies, and sticky footers; desktop modal sizes unchanged
- made BudgetDetailPage sticky nav horizontally scrollable on mobile without wrapping
- added responsive grid stacking to TransactionEntryForm so fields arrange vertically on narrow screens
- deliverable: new `MobileTableCards.jsx` reusable component; responsive changes across 13 frontend files; 6 new component tests

#### Activity Group: Formula Expression Helpers

Status:
- `Active`

Activities:
- improve discoverability and guidance for expression entry where it exists (without weakening numeric-only normal entry)
- consolidate "what operators are supported" into a single user-facing help surface

#### Activity Group: Mid-Cycle Expense Provisioning

Status:
- `Idea`

Activities:
- define behaviour when adding new expenses mid-budget cycle via a provision setting: `Provision Mid Cycle Expenses as zero budget value?`
- when enabled, newly added mid-cycle expenses receive a zero budget value, preserving a realistic view of what was originally budgeted for the period
- when disabled, new expenses receive their generated budget value as usual
- ensure the setting is budget-level and defaults to disabled for backward compatibility
- update period detail UI to reflect zero-budget mid-cycle lines without breaking budget-vs-actual calculations

### 3) Reporting Framework

#### Activity Group: Reporting Foundations

Status:
- `Active`

Activities:
- define the canonical report payload shapes (backend-owned calculations)
- ship the first reporting card set on budget summary
- add the first drilldown slice (budget -> line -> transactions) where it materially helps trust

#### Activity Group: Starter Reports / Graphs

Status:
- `Next`

Activities:
- budget vs actual trend graphs
- investment trend graphs
- income allocation breakdown (expenses vs investments vs transfers)

### 4) Scheduled Income

Reference plan:
- [SCHEDULED_INCOME_AND_AUTO_CARRY_FORWARD_PLAN.md](/home/ubuntu/dosh/docs/plans/SCHEDULED_INCOME_AND_AUTO_CARRY_FORWARD_PLAN.md)

#### Activity Group: Mode + Schema + Safe Defaults

Status:
- `Next`

Activities:
- implement `simple` vs `advanced` mode boundaries
- add scheduling + allocation fields (migration with safe backfill)
- implement generation behavior for `occurrence` (and one additional allocation mode if needed)

#### Activity Group: Automation (Auto Income / Auto Carry-Forward)

Status:
- `Later`

Activities:
- mirror auto-expense patterns for auto-income
- add auto carry-forward for `PENDING_CLOSURE` only when it does not conflict with close-out snapshots

### 5) User Guides + Formula Library

#### Activity Group: Beta User Guides

Status:
- `Next`

Activities:
- "getting started" guide for beta users (workflow, what is safe, what is read-only)
- short "common questions" guide for cycle states, health score meaning, and exports

#### Activity Group: Formula Library

Status:
- `Next`

Activities:
- create/maintain a single "formula definitions" document (what we compute, where it appears, and what it implies)
- link from UI helpers and reporting cards instead of duplicating prose

## Post-beta note

- Reconciliation is intentionally post-beta because it depends on bank integration / statement ingestion (import/OCR). See [ROADMAP.md](/home/ubuntu/dosh/docs/ROADMAP.md).

