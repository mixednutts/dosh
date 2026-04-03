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
- the overall budget score now explicitly includes the current-period health assessment
- the Budgets page now shows a current balance summary card with per-account closing balances and total
- the sidebar is now a focused current-budget workflow nav with compact and collapsible desktop behavior
- the visual direction has shifted to muted teal branding with separate green success semantics

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
- validate whether the current-period weighting inside the overall score feels proportionate in real use
- prepare for close-out metrics integration
- continue refining evidence language

Suggested implementation slices:

- better momentum logic across completed periods
- more direct explanation of score movement
- health detail links into supporting records
- test the new overall-score weighting so current-period influence is visible but not overly volatile
- tests and refinement around personalised threshold behavior
- continued copy refinement so health evidence reads naturally in budget terms

### 5. Localisation and Regional Fit

Dosh already shows signs of regional fit, but localisation is not yet being treated as a deliberate product capability.

Focus areas:

- move locale, currency, and date formatting out of hard-coded UI assumptions
- support regional budgeting cadence and terminology without fragmenting the core model
- make health language, labels, and helper copy adaptable by locale
- prepare for country-specific conventions such as fortnightly budgeting, date ordering, and currency display
- keep localisation practical and product-led rather than introducing translation plumbing with no user-facing value

Suggested implementation slices:

- introduce shared frontend formatting utilities for currency, number, and date presentation
- add budget-level or user-level locale and currency preferences
- audit hard-coded `en-AU` assumptions and replace them with explicit formatting settings
- identify user-facing finance terminology that may need regional variants
- document which localisation decisions belong in product copy versus data model behavior

### 6. Cash Management Workflow Definition

Dosh tracks balances and transactions already, but the product still needs an explicit cash management workflow that helps users decide what cash is available, what is committed, and what needs attention next.

Focus areas:

- define how cash position should be reviewed during an active period
- clarify the relationship between account balances, planned spending, savings transfers, and investment allocations
- make it easier to see which money is free to use versus already spoken for
- identify the practical actions a user should take when cash pressure appears
- keep the workflow grounded in real household cash management rather than generic dashboard metrics

Suggested implementation slices:

- define a cash management summary model for current-period use
- add views for available cash, committed outflows, and near-term obligations
- surface warnings for low available cash, upcoming large expenses, or transfer timing pressure
- map how savings transfers and investment contributions should affect the user's perceived cash position
- document the intended review loop for checking cash, adjusting plan, and closing out the period

### 7. Export and Backup Readiness

As Dosh becomes more trustworthy for day-to-day finance use, users will eventually expect straightforward ways to export their data and keep independent backups.

Focus areas:

- define what data should be exportable for user trust, portability, and support
- decide how backup should work without weakening data integrity or leaking implementation details
- support practical recovery paths for self-hosted or manually managed deployments
- make export useful for both human review and machine-readable portability
- keep export and backup aligned with the ledger-backed model so restored data stays explainable

Suggested implementation slices:

- define initial export scope for budgets, periods, transactions, balances, and investments
- decide on export formats such as CSV for review and JSON for structured backup
- document what a complete backup must include beyond the primary database file
- design import or restore expectations separately from simple export download
- identify privacy and security expectations around exported financial data

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

### 6. Continue Navigation And Information Architecture Cleanup

The sidebar redesign has created a much stronger structure, but it also established some navigation rules that future work should preserve.

Priority areas:

- keep the sidebar centered on one active budget context at a time
- add new first-class sections carefully so the nav does not grow back into a crowded tree
- preserve the compact/collapsible desktop mode as new features arrive
- keep overflow affordances honest when the user is already on the destination page
- avoid duplicate edit or setup entry points on the same screen unless they serve clearly different purposes

### 7. Expand Budget Summary Reporting Value

The Budgets page is now the main landing surface and already carries health and current balance context, so it is a strong candidate for the first reporting-oriented summaries.

Priority areas:

- add richer historical and trend summaries without turning the page into a dashboard clone
- continue favoring live money position and practical status over repeated setup actions
- identify the next summary card that best complements current balance and health without duplicating period-listing data

### 8. Establish Localisation Foundations

The product already carries regional assumptions in formatting and cadence, so localisation should become an explicit engineering concern before those assumptions spread further.

Priority areas:

- centralize frontend currency, date, and number formatting
- decide where locale, timezone, and currency preferences are stored and resolved
- separate copy decisions from calculation rules wherever regional behavior may differ
- identify backend responses that should stay neutral versus pre-formatted for display
- add tests around locale-sensitive display and period-boundary assumptions where practical

### 9. Define Cash Management Foundations

Balances, transfers, and planned outflows already exist in the model, but the app still needs a clear foundation for turning those records into a trustworthy cash management workflow.

Priority areas:

- define what Dosh means by available cash, committed cash, and reserved cash
- decide which calculations belong in backend summary endpoints versus frontend presentation
- identify which existing balance and transaction data can support cash position summaries without duplicating logic
- design the first cash management review surface before adding more balance-related UI fragments
- add tests around cash-position calculations once the workflow definition is settled

### 10. Prepare Export and Backup Foundations

Export and backup do not need to be immediate release blockers, but they should be planned before the data model and operational assumptions become harder to untangle.

Priority areas:

- define stable export shapes for the most important financial records
- decide whether backups are database-level, app-level, or both
- identify which metadata, settings, and reference tables must be included for useful restore
- document restore expectations and what level of compatibility Dosh intends to maintain across versions
- add tests or validation around export completeness once the first format is defined

## Recommended Session Backlog

If we want a practical order of work rather than just a thematic roadmap, this is the strongest current sequence:

1. Add backend tests around ledger, period, and surplus rules.
2. Add a reporting summary endpoint that rolls up period and ledger data.
3. Surface a budget-level reporting card set in the frontend.
4. Introduce shared localisation utilities and decide how locale, currency, and timezone preferences are stored.
5. Define the cash management workflow and the first summary model for available, committed, and reserved cash.
6. Add tests and cleanup around health personalisation and current-period threshold behavior.
7. Design the first reconciliation screen around account movement explanation.
8. Review sidebar and budget-summary polish after real use, especially around future first-class sections.
9. Introduce a period close-out model and basic close-out status flow.
10. Replace ad hoc startup migrations with a proper migration system.
11. Define the first export and backup scope, including format and restore expectations.

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
- localisation should be explicit and centrally managed rather than emerging from scattered hard-coded formatting choices
- cash management views should reflect trustworthy underlying money movement rather than introducing separate shadow balances
- export and backup should preserve user trust by being understandable, complete enough to be useful, and compatible with ledger integrity
- there should only ever be one `Current` period for a budget; overflow patterns belong only to `Future` and `Historical`
- if a sidebar affordance points to the page the user is already viewing, it should be muted or otherwise downgraded rather than appearing broken
- the main budget summary page should avoid duplicate edit/setup actions when one clear path already exists
- brand accent color and positive/success color should remain distinct so navigation and financial meaning do not blur together

## What Future Sessions Should Check First

Before proposing major changes, review:

- [README.md](/home/ubuntu/dosh/README.md)
- [CHANGES.md](/home/ubuntu/dosh/CHANGES.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/DEVELOPMENT_ACTIVITIES.md)

That combination should be enough to understand:

- where the product is today
- what decisions are already intentional
- what the next sensible development activities are
