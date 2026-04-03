# Dosh Development Activities

This document is a working view of the current development activity areas for Dosh.

## Purpose

This document is the practical continuation guide for likely next work.

Its purpose is to help future sessions quickly identify:

- what we are actively building toward
- what engineering work is most likely next
- what supporting foundation work is still missing
- where future sessions should pick up

It complements:

- [README.md](/home/ubuntu/dosh/README.md) for current-state product and technical overview
- [CHANGES.md](/home/ubuntu/dosh/CHANGES.md) for recorded product decisions and recent implementation history
- [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/BUDGET_HEALTH_ADDENDUM.md) for staged budget health direction

## Current Product Stage

Dosh is beyond initial scaffolding. It already has a working FastAPI backend, React frontend, budget setup flow, period management, transaction-backed balance movement, investment planning, and a first explainable budget health release.

The project is now in the stage where the biggest wins are less about adding isolated CRUD and more about making the financial workflow feel complete, trustworthy, and reviewable.

Recent progress worth carrying forward:

- the Budgets page now includes a dedicated current-period health check with its own detail modal and direct link into the active period
- budget setup now has a `Personalisation` section above `Settings`
- budget health can now be tuned per budget through persistent personalisation values
- deficit concern logic now supports both a percentage threshold and an optional dollar threshold
- budget info and personalisation now autosave quietly instead of relying on save buttons

## Active Development Streams

### 1. Reporting and Analysis

This is the clearest next feature stream.

Focus areas:

- ledger-backed reporting across periods
- richer budget summary views
- clearer explanations of surplus changes over time
- savings and investment trend visibility
- better answers to "what changed and why?"

Suggested implementation slices:

- period comparison summary endpoint
- reporting cards on the budget summary page
- account movement summaries grouped by source
- surplus trend and planned-vs-actual trend views
- filters for historical transaction reporting

### 2. Reconciliation

The centralized transaction ledger is already in place, so the next step is turning that foundation into a user-facing reconciliation workflow.

Focus areas:

- account-by-account reconciliation screens
- running totals and discrepancy detection
- better transaction filtering and source grouping
- visibility into unmatched or system-generated adjustments
- possible statement import later, only if reliability is strong enough

Suggested implementation slices:

- reconciliation summary for each balance type
- grouped ledger view by account and transaction source
- variance indicator between movement and explained transactions
- system-adjustment review surface

### 3. Period Close Out

This is the most workflow-oriented milestone and likely the one that will make the app feel most complete in daily use.

Focus areas:

- explicit end-of-period review flow
- close-out metrics and completion state
- final commentary on the period
- stronger use of revision comments in reporting
- clearer handoff from active period to historical record

Suggested implementation slices:

- close-out checklist and completion status
- end-of-period summary card or modal
- close-out notes/commentary field
- close-out metrics feeding later health scoring

### 4. Budget Health Phase 2 Preparation

Budget health exists today, but it is intentionally an early slice rather than a finished scoring system.

Focus areas:

- improve trend credibility
- connect future corrective action to visible momentum
- refine current-period warning signals
- prepare for close-out metrics integration
- continue refining evidence language

Suggested implementation slices:

- better momentum logic across completed periods
- more direct explanation of score movement
- health detail links into supporting records
- tests and refinement around personalised threshold behavior
- continued copy refinement so health evidence reads naturally in budget terms

## Near-Term Engineering Work

These activities are not necessarily flashy product milestones, but they are the most obvious engineering tasks that would reduce friction for future development.

### 1. Add Basic Automated Tests

The repo currently does not show a real test harness for backend or frontend workflows.

Priority areas:

- period generation rules
- ledger migration/backfill behavior
- expense paid/revised workflow
- investment budget and surplus calculations
- budget health scoring and evidence payloads
- personalisation threshold combinations, especially percentage-plus-dollar deficit logic

### 2. Formalize Database Migration Strategy

The backend currently applies schema changes during startup with raw `ALTER TABLE` statements and exception swallowing.

That approach has helped the project move quickly, but it will become fragile as schema work grows.

Priority areas:

- introduce proper versioned migrations
- make startup behavior safer and more observable
- separate one-time migration work from normal app startup

### 3. Tighten Deployment and Build Reliability

The Docker setup works as a local deployment path, but the repo notes already call out operational gaps.

Priority areas:

- pin frontend install behavior more reliably
- verify compose assumptions around networks and Traefik usage
- document expected production vs local deployment differences
- confirm build and startup paths remain clean as the app grows

### 4. Improve API and Domain Consistency

The product direction is getting more workflow-driven, so consistency matters more now.

Priority areas:

- standardize terminology around savings and investments
- standardize health terminology around surplus, deficit, tolerance, threshold, and escalation
- preserve backend naming stability while refining frontend wording
- keep balance movement read-only and transaction-derived
- avoid introducing edit paths that weaken ledger trust

### 5. Refine Budget Health Personalisation Experience

The first personalisation pass is implemented, but it still needs usability refinement from real use.

Priority areas:

- make the interaction between deficit percentage and maximum deficit amount clearer
- check whether any remaining slider labels or helper text still feel abstract
- decide whether some health evidence lines should mirror the personalisation wording more closely
- align the overall budget health detail view with the dedicated current-period health check so the active-period story does not conflict between the two surfaces
- keep the section lightweight rather than turning it into an intimidating settings panel

## Recommended Session Backlog

If we want a practical order of work rather than just a thematic roadmap, this is the strongest current sequence:

1. Add backend tests around ledger, period, and surplus rules.
2. Add a reporting summary endpoint that rolls up period and ledger data.
3. Surface a budget-level reporting card set in the frontend.
4. Add tests and cleanup around health personalisation and current-period threshold behavior.
5. Design the first reconciliation screen around account movement explanation.
6. Introduce a period close-out model and basic close-out status flow.
7. Replace ad hoc startup migrations with a proper migration system.

## Guardrails For Future Work

These project rules already emerge clearly from the existing docs and implementation and should continue guiding development:

- functional clarity matters more than decorative redesign
- workflow meaning should take priority over isolated CRUD convenience
- balance movement should remain explainable from transactions
- paid expenses should stay protected until explicitly revised
- budget health should stay supportive and explainable, not overly authoritative
- user-facing health and warning messages should use warm, practical, reassuring language rather than clinical finance wording
- when health preferences assess deficit risk, the wording should say `deficit` clearly rather than implying that zero surplus is itself a problem
- autosave is preferred for lightweight setup and personalisation edits when validation is simple and failures can be surfaced clearly
- backend and database naming should remain stable unless a change is clearly worth the cost

## What Future Sessions Should Check First

Before proposing major changes, review:

- [README.md](/home/ubuntu/dosh/README.md)
- [CHANGES.md](/home/ubuntu/dosh/CHANGES.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/DEVELOPMENT_ACTIVITIES.md)

That combination should be enough to understand:

- where the product is today
- what decisions are already intentional
- what the next sensible development activities are
