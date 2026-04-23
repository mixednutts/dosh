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

### 1) Budget Health Metrics + UX

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
- define “trend” semantics (what changes, over what window, and why users should care)
- add an initial trending visualization on budget summary (minimal but trustworthy)

#### Activity Group: Formula Expression Helpers (UX)

Status:
- `Active`

Activities:
- improve discoverability and guidance for expression entry where it exists (without weakening numeric-only normal entry)
- consolidate “what operators are supported” into a single user-facing help surface

### 2) Reporting Framework

#### Activity Group: Reporting Foundations

Status:
- `Active`

Activities:
- define the canonical report payload shapes (backend-owned calculations)
- ship the first reporting card set on budget summary
- add the first drilldown slice (budget → line → transactions) where it materially helps trust

#### Activity Group: Starter Reports / Graphs

Status:
- `Next`

Activities:
- budget vs actual trend graphs
- investment trend graphs
- income allocation breakdown (expenses vs investments vs transfers)

### 3) Scheduled Income

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

### 4) User Guides + UX Helpers + Formula Library

#### Activity Group: Beta User Guides

Status:
- `Next`

Activities:
- “getting started” guide for beta users (workflow, what is safe, what is read-only)
- short “common questions” guide for cycle states, health score meaning, and exports

#### Activity Group: Formula Library

Status:
- `Next`

Activities:
- create/maintain a single “formula definitions” document (what we compute, where it appears, and what it implies)
- link from UI helpers and reporting cards instead of duplicating prose

## Post-beta note

- Reconciliation is intentionally post-beta because it depends on bank integration / statement ingestion (import/OCR). See [ROADMAP.md](/home/ubuntu/dosh/docs/ROADMAP.md).

