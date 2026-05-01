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

**Status:** Beta scope is complete. All items below are either shipped, reclassified as ongoing operational work, or deferred. The next milestone is **rc-1**.

### 1) Budget Health Metrics

Status: **Complete for beta.** Framework exists for future metric development.

Goals:

- ✅ expanded the available Budget Health metrics to a global code-based registry with six system metrics
- ⏸️ health trending / momentum — deferred to future. Metric executors exist; user-facing trending visualization is not blocking rc-1
- ✅ polish around health interpretation, metric evidence, and formula expression helpers

Notes:

- the canonical metric reference remains [BUDGET_HEALTH_METRIC_LIBRARY.md](/home/ubuntu/dosh/docs/BUDGET_HEALTH_METRIC_LIBRARY.md)
- new metrics will be added only when evidence + user-facing meaning are strong

### 2) UX / UI

Status: **Complete for beta.** Ad-hoc polish and bug fixes continue as ongoing operational work.

Goals:

- ✅ generalised area for bugs, UI inconsistencies, and UX improvements
- specific items tracked in [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)

### 3) Reporting Framework

Status: **Complete for beta.** Starter reports are shipped; drilldown and rich reporting are deferred to post-beta.

Goals:

- ✅ defined and implemented a lightweight reporting framework
- ✅ established common “starter” reports/graphs:
  - budget vs actual trend graphs
  - investment trend graphs
  - income allocation views (expenses vs investments as % of income)
- drilldown (budget → line → transaction) is deferred to post-beta

### 4) Scheduled Income

Status: **Deferred to future / post-beta.** Not blocking rc-1.

Goal:

- implement scheduled income (frequency + allocation modes) and optional automation, per:
  - [SCHEDULED_INCOME_AND_AUTO_CARRY_FORWARD_PLAN.md](/home/ubuntu/dosh/docs/plans/SCHEDULED_INCOME_AND_AUTO_CARRY_FORWARD_PLAN.md)

### 5) User Guides + Formula Library

Status: **External / out of scope of this project.** To be produced outside the engineering backlog.

Goals:

- beta user guides that explain the workflow in practical terms
- helpers that reduce "what does this mean?" friction at the moment of decision
- a maintained library of formula definitions (what we calculate, why, and where it shows up)

### 6) AI Insights

Status: **Shipped.**

Goals:

- ✅ optional LLM-powered insights for the current budget period
- ✅ user-controlled provider configuration (BYO API key)
- ✅ privacy-first design with encrypted storage and clear data-sharing warnings
- ✅ dynamic model selection via trusted vendor manifest (OpenRouter)
- ✅ tone-aware responses aligned with Budget Health engine

Reference plan:
- [AI_INSIGHTS_IMPLEMENTATION_PLAN.md](/home/ubuntu/dosh/docs/plans/AI_INSIGHTS_IMPLEMENTATION_PLAN.md)

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
