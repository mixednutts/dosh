# Dosh Roadmap (Beta)

This document is the **high-level roadmap** for Dosh in beta.

- **Detailed execution backlog**: [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- **Release + migration policy**: [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md)
- **Pre-beta reference (archived)**: [docs/archive/ROADMAP-pre-beta-2026-04-23.md](/home/ubuntu/dosh/docs/archive/ROADMAP-pre-beta-2026-04-23.md)

## Roadmap Structure

- **Beta**: what we build next to expand real-world confidence and capability
- **Post-beta (Phase 2)**: bigger expansions we intentionally defer
- **Future opportunities**: keep visible without implying near-term commitment

## Beta (current focus)

### 1) Budget Health Metrics + UX

Goals:

- expand the available Budget Health metrics (beyond the current set)
- add health trending / momentum so users can see how current-cycle behavior changes overall budget health over time
- continue UX polish around health interpretation, metric evidence, and formula expression helpers

Notes:

- the canonical metric reference remains [BUDGET_HEALTH_METRIC_LIBRARY.md](/home/ubuntu/dosh/docs/BUDGET_HEALTH_METRIC_LIBRARY.md)

### 2) Reporting Framework

Goals:

- define and implement a lightweight but feature-rich reporting framework
- support drilldown where it helps (budget → line → transaction)
- establish common “starter” reports/graphs:
  - budget vs actual trend graphs
  - investment trend graphs
  - income allocation views (e.g. expenses vs investments vs savings/transfers)

### 3) Scheduled Income

Goal:

- implement scheduled income (frequency + allocation modes) and optional automation, per:
  - [SCHEDULED_INCOME_AND_AUTO_CARRY_FORWARD_PLAN.md](/home/ubuntu/dosh/docs/plans/SCHEDULED_INCOME_AND_AUTO_CARRY_FORWARD_PLAN.md)

### 4) User Guides + UX Helpers + Formula Library

Goals:

- beta user guides that explain the workflow in practical terms
- UX helpers that reduce “what does this mean?” friction at the moment of decision
- a maintained library of formula definitions (what we calculate, why, and where it shows up)

## Post-beta (Phase 2)

### Reconciliation (gated)

Reconciliation is intentionally post-beta because it depends on some form of:

- financial institution integration and/or
- bank statement ingestion (import/OCR)

The reconciliation roadmap should be revisited once statement ingestion has a credible path.

## Future opportunities

### Bank integration / statement ingestion

Potential scope:

- transaction import and categorization support
- statement ingestion (file import and/or OCR-assisted workflows)
- reconciliation support primitives once ingestion exists
