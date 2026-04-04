# Dosh Development Activities

This document is a working view of the current development activity areas for Dosh.

## Purpose

This document is the practical continuation guide for likely next work.

Its purpose is to help future sessions quickly identify:

- what we are actively building toward
- what engineering work is most likely next
- what supporting foundation work is still missing
- where future sessions should pick up
- the current single-source-of-truth backlog for outstanding follow-up work

It complements:

- [README.md](/home/ubuntu/dosh/README.md) for current-state product and technical overview
- [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md) for recorded product decisions and recent implementation history
- [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/plans/BUDGET_HEALTH_ADDENDUM.md) for staged budget health direction
- [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md) for the detailed cycle lifecycle and close-out plan that is now partially implemented
- [SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md](/home/ubuntu/dosh/docs/plans/SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md) for the centralized setup-validity and downstream-protection model implemented this session
- [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) for the current proposed testing approach, priorities, and case inventory
- [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/docs/tests/TEST_EXPANSION_PLAN.md) for the current testing follow-up plan and next coverage slices
- [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md) for the latest recorded verification outcomes

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
- budget cycles now have explicit persisted lifecycle state with `PLANNED`, `ACTIVE`, and `CLOSED`
- close-out workflow foundations now exist, including preview, historical snapshot storage, and carry-forward handling
- investment lines now mirror expense lifecycle status with `Current`, `Paid`, and `Revised`
- period deletion now has guided continuity-aware options, including `Delete this and all upcoming cycles`
- budget settings now include a dedicated manual cycle-lock control separate from lifecycle state
- the repository now has a credible automated regression harness across backend, frontend, and initial Playwright end-to-end lifecycle smoke flows
- budget setup now has a centralized setup assessment model rather than scattered readiness assumptions
- setup records now become explicitly protected when downstream cycles or transactions depend on them
- the budget setup page now shows section-level assessment state and protected downstream usage
- account terminology now has an initial budget-level display preference, allowing `Transaction`, `Everyday`, or `Checking` while preserving one internal model
- the budget setup page now uses in-card section headers, default-collapsed optional sections, and session-persisted expand or collapse state
- the budget cycles list now uses `Upcoming` group wording and remembers the historical section expand or collapse state for the browser session
- the period-detail page now surfaces `Projected Savings` and `Remaining Expenses` in a single 8-card summary grid
- backend tests now run against an isolated SQLite database per test case, making mixed-area sessions much safer
- Docker Compose deployment was rebuilt and verified successfully from the current working tree
- income actual entry in the period detail page now uses a dedicated transaction modal instead of inline actual overrides
- locked active cycles now preserve actual-entry and transaction flows while still guarding structural edits
- `PeriodTransaction` is now the sole live transaction store after removal of obsolete legacy expense and investment transaction tables
- backend startup schema patching has been removed in favor of an explicit cutover script for the current baseline
- the frontend now uses Vite plus standalone Jest rather than Create React App
- the frontend Docker image now uses Node 20 and the frontend dependency tree is currently clean on `npm audit`
- a dev-only `Create Demo Budget` flow now exists from the budget-create modal and is controlled through shared Docker Compose `DEV_MODE` gating across frontend and backend
- the seeded demo budget now includes historical close-outs, a live current cycle, upcoming cycles, linked savings and investment setup, and budget-health-relevant activity rather than neutral placeholder transactions

## Activity Model

This document now uses the project activity model defined in the documentation framework:

- `Roadmap Area`
- `Activity Group`
- `Activity`

Working rules for this document:

- each activity should have one canonical home
- when an activity affects another roadmap area, capture that through notes in the relevant section rather than duplicating the item
- `Quality` is a first-class roadmap area for UX/UI, bugs, test coverage, reliability, consistency, and polish work
- roadmap areas are the strategic buckets; activity groups are the operational buckets inside them

Status convention used in this document:

- `Active`: already underway or the clearest live continuation area
- `Next`: not yet active, but a strong near-term candidate
- `Later`: worth tracking, but not a current near-term priority
- `Completed`: finished and intentionally retained here until the roadmap is next regrouped

## Roadmap Areas

### 1. Reporting and Analysis

This remains the clearest next feature stream.

#### Activity Group: Reporting Foundations

Status:

- `Next`

- add a period comparison summary endpoint
- add reporting cards on the budget summary page
- build account movement summaries grouped by source

#### Activity Group: Trend and Variance Visibility

Status:

- `Later`

- add surplus trend and planned-vs-actual trend views
- improve explanations of surplus changes over time
- improve savings and investment trend visibility

#### Activity Group: Historical Reporting Usability

Status:

- `Later`

- add filters for historical transaction reporting
- keep building better answers to "what changed and why?"

Notes:

- reporting should continue to use the ledger-backed model as the explanation source
- reporting surfaces for closed cycles should prefer stored close-out snapshots where that preserves historical meaning

Cross-links:

- Period Close Out
- Reconciliation
- Quality > UX/UI

### 2. Reconciliation

The centralized transaction ledger is already in place, so the next step is turning that foundation into a user-facing reconciliation workflow.

#### Activity Group: Reconciliation Workflow

Status:

- `Next`

- add account-by-account reconciliation screens
- add running totals and discrepancy detection
- add reconciliation summary views for each balance type

#### Activity Group: Ledger Review and Adjustment Visibility

Status:

- `Next`

- add grouped ledger views by account and transaction source
- add visibility into unmatched or system-generated adjustments
- add variance indicators between movement and explained transactions
- add a system-adjustment review surface

#### Activity Group: Closed-Cycle Reconciliation Handoff

Status:

- `Active`

- define the reconciliation workflow for fixing issues discovered after a cycle is closed
- align setup-protection and reconciliation messaging so blocked setup edits explain the downstream consequence path clearly
- consider statement import only after reliability is strong enough

Cross-links:

- Period Close Out
- Setup Assessment And Protected Configuration
- Quality > Test Coverage

### 3. Period Close Out

This is now an active implementation stream rather than just a future milestone.

Reference:

- [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md)

#### Activity Group: Lifecycle Hardening

Status:

- `Active`

- validate and harden the explicit lifecycle rules
- ensure carry-forward and opening rebasing stay aligned after delete and regenerate flows
- strengthen the handoff from `ACTIVE` to `CLOSED` to next `ACTIVE`

#### Activity Group: Close-Out Experience

Status:

- `Next`

- finish the end-of-cycle review experience so it feels complete and trustworthy
- refine the close-out modal and summary surfaces
- decide which historical views should show close-out comments, goals, and snapshotted health data

#### Activity Group: Historical Integrity and Read-Only Behavior

Status:

- `Active`

- make closed-cycle read-only behavior consistent across remaining write paths
- add clearer read-only and reconciliation messaging on closed cycles
- extend end-to-end coverage from the close-out happy path into post-close correction and reconciliation workflows
- determine whether additional sign-off or audit fields are needed once user identity exists

Cross-links:

- Reconciliation
- Reporting and Analysis
- Quality > Test Coverage
- Quality > Bugs

### 4. Setup Assessment And Protected Configuration

This is an implemented foundation and should be treated as an active maintenance area rather than a speculative idea.

Reference:

- [SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md](/home/ubuntu/dosh/docs/plans/SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md)

#### Activity Group: Generation Readiness

Status:

- `Active`

- keep centralized setup assessment as the source of truth for generation readiness
- avoid reintroducing one-off page-level readiness logic
- improve setup-summary visibility before users reach cycle generation

#### Activity Group: Protected Configuration

Status:

- `Active`

- extend protection reasoning only when it improves downstream safety and user understanding
- keep setup editable where safe while blocking destructive changes once downstream dependence exists
- add stronger explanation surfaces for why a setup item is protected

#### Activity Group: Consequence Visibility

Status:

- `Next`

- extend consequence messaging for reconciliation or correction paths after setup becomes in use

Cross-links:

- Reconciliation
- Quality > Consistency

### 5. Budget Health

Budget health exists today, but it is intentionally an early slice rather than a finished scoring system.

Reference:

- [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/plans/BUDGET_HEALTH_ADDENDUM.md)

#### Activity Group: Scoring and Momentum

Status:

- `Later`

- improve trend credibility
- connect future corrective action to visible momentum
- validate whether the current-period weighting inside the overall score feels proportionate in real use
- build better momentum logic across completed periods
- explain score movement more directly

#### Activity Group: Current-Period Interpretation

Status:

- `Next`

- refine current-period warning signals
- prepare for close-out metrics integration
- align the overall budget health detail view with the dedicated current-period health check so the active-period story does not conflict between the two surfaces

#### Activity Group: Personalisation and Evidence Language

Status:

- `Next`

- refine evidence language so it reads naturally in budget terms
- test and refine personalised threshold behavior
- make the interaction between deficit percentage and maximum deficit amount clearer
- check whether remaining slider labels or helper text still feel abstract
- decide whether some health evidence lines should mirror the personalisation wording more closely
- keep the personalisation section lightweight rather than turning it into an intimidating settings panel

#### Activity Group: Demo Data Alignment

Status:

- `Active`

- keep development and demo data realistic enough that health surfaces remain meaningful during walkthroughs and regression checks
- keep the demo seed aligned with later budget-health scoring changes so walkthrough data does not become misleading or stale
- consider whether more than one demo seed profile is needed later, such as `healthy`, `under pressure`, or `recovery`, without weakening the current additive-only demo import behavior

Cross-links:

- Period Close Out
- Quality > Test Coverage
- Quality > UX/UI

### 6. Localisation and Regional Fit

Dosh already shows signs of regional fit, but localisation is not yet being treated as a deliberate product capability.

Current implemented slice:

- account naming now has a budget-level display preference for `Transaction`, `Everyday`, and `Checking`
- this should be treated as the reference pattern for terminology preferences that are display-layer only
- the data model should stay stable underneath unless a deeper domain reason appears

#### Activity Group: Formatting Foundations

Status:

- `Next`

- move locale, currency, and date formatting out of hard-coded UI assumptions
- introduce shared frontend formatting utilities for currency, number, and date presentation
- add tests around locale-sensitive display and period-boundary assumptions where practical

#### Activity Group: Preferences and Resolution

Status:

- `Next`

- add budget-level or user-level locale and currency preferences
- decide where locale, timezone, and currency preferences are stored and resolved

#### Activity Group: Terminology and Regional Behavior

Status:

- `Later`

- support regional budgeting cadence and terminology without fragmenting the core model
- make health language, labels, and helper copy adaptable by locale
- prepare for country-specific conventions such as fortnightly budgeting, date ordering, and currency display
- identify user-facing finance terminology that may need regional variants
- decide cautiously whether period naming should follow the same preference pattern later; it was discussed this session and intentionally deferred
- document which localisation decisions belong in product copy versus data model behavior
- identify backend responses that should stay neutral versus pre-formatted for display

Cross-links:

- Budget Health
- Quality > Consistency
- Quality > Test Coverage

### 7. Cash Management

Dosh tracks balances and transactions already, but the product still needs an explicit cash management workflow that helps users decide what cash is available, what is committed, and what needs attention next.

#### Activity Group: Cash Model Definition

Status:

- `Next`

- define how cash position should be reviewed during an active period
- define what Dosh means by available cash, committed cash, and reserved cash
- clarify the relationship between account balances, planned spending, savings transfers, and investment allocations

#### Activity Group: Cash Summary and Review Surfaces

Status:

- `Next`

- define a cash management summary model for current-period use
- add views for available cash, committed outflows, and near-term obligations
- design the first cash management review surface before adding more balance-related UI fragments

#### Activity Group: Cash Pressure Signals and Validation

Status:

- `Later`

- make it easier to see which money is free to use versus already spoken for
- identify the practical actions a user should take when cash pressure appears
- surface warnings for low available cash, upcoming large expenses, or transfer timing pressure
- map how savings transfers and investment contributions should affect the user's perceived cash position
- decide which calculations belong in backend summary endpoints versus frontend presentation
- identify which existing balance and transaction data can support cash position summaries without duplicating logic
- add tests around cash-position calculations once the workflow definition is settled
- document the intended review loop for checking cash, adjusting plan, and closing out the period

Cross-links:

- Reporting and Analysis
- Quality > UX/UI
- Quality > Test Coverage

### 8. Export and Backup

As Dosh becomes more trustworthy for day-to-day finance use, users will eventually expect straightforward ways to export their data and keep independent backups.

#### Activity Group: Export Scope and Format

Status:

- `Later`

- define what data should be exportable for user trust, portability, and support
- define initial export scope for budgets, periods, transactions, balances, and investments
- decide on export formats such as CSV for review and JSON for structured backup
- make export useful for both human review and machine-readable portability

#### Activity Group: Backup and Restore Design

Status:

- `Later`

- decide how backup should work without weakening data integrity or leaking implementation details
- support practical recovery paths for self-hosted or manually managed deployments
- document what a complete backup must include beyond the primary database file
- design import or restore expectations separately from simple export download
- decide whether backups are database-level, app-level, or both
- identify which metadata, settings, and reference tables must be included for useful restore
- document restore expectations and what level of compatibility Dosh intends to maintain across versions

#### Activity Group: Trust, Privacy, and Validation

Status:

- `Later`

- keep export and backup aligned with the ledger-backed model so restored data stays explainable
- identify privacy and security expectations around exported financial data
- define stable export shapes for the most important financial records
- add tests or validation around export completeness once the first format is defined

### 9. Quality

This roadmap area exists for work that improves trust, usability, consistency, and delivery quality across multiple feature areas.

#### Activity Group: UX/UI

Status:

- `Next`

- `Completed`: tighten period-detail UI polish around totals and status affordances, especially for the income, investment, and balance sections
- `Completed`: add period-detail totals for investments and balances while keeping movement read-only and avoiding a meaningless movement total
- continue navigation and information architecture cleanup so the sidebar stays centered on one active budget context at a time
- preserve the compact or collapsible desktop mode as new features arrive
- keep overflow affordances honest when the user is already on the destination page
- avoid duplicate edit or setup entry points on the same screen unless they serve clearly different purposes
- add a delete-current-budget action to the `No budget cycles yet` card so an abandoned or exploratory budget can be removed directly from that empty state
- preserve the cleanup that removed duplicate budget detail text from the `Current Budget` panel and moved utility controls away from the banner collision area
- expand budget summary reporting value without turning the page into a dashboard clone
- identify the next summary card that best complements current balance and health without duplicating period-listing data
- keep the period-detail summary card set under review before introducing user-controlled drag-and-drop ordering
- review sidebar and budget-summary polish after real use, especially around future first-class sections
- revisit summary-card customization only after the current period-detail card set feels stable in real use

#### Activity Group: Bugs

Status:

- `Completed`

- fix the empty visual artifact at the end of the total income line on the period detail page
- align the investment spent pill wording and behavior with the expense spent pill so both outflow workflows feel consistent

#### Activity Group: Test Coverage

Status:

- `Active`

- keep new feature work under a test-with-change discipline rather than treating testing as a later cleanup phase
- extend Playwright from the current happy-path lifecycle smoke into reconciliation, correction, and broader scenario-shaped flows
- continue expanding setup-shape consequence coverage where technically valid configuration changes can still weaken later workflows
- deepen ledger and reconciliation coverage without treating one-off migration backfill as normal product behavior
- continue broadening budget health coverage as scoring and reporting evolve
- extend backend and frontend coverage around close-out, carry-forward, and delete continuity
- future setup and workflow testing should expand beyond the original `1 transaction + 1 savings` assumption
- bookmark named scenarios such as `Single Account` and `Multi Transaction` so future sessions can deliberately test differing account shapes rather than relying on one default personal setup model
- consider adding a richer demo-validation checklist or smoke flow once more reporting and reconciliation surfaces exist
- add tests and cleanup around health personalisation and current-period threshold behavior

#### Activity Group: Reliability

Status:

- `Active`

- pin frontend install behavior more reliably
- keep the Node 20 frontend Docker baseline healthy and revisit newer LTS adoption only when the toolchain is ready
- verify compose assumptions around networks and Traefik usage
- document expected production vs local deployment differences
- confirm build and startup paths remain clean as the app grows
- clean up startup and timestamp deprecation warnings that appear during test and deployment runs
- formalize the database migration strategy by introducing proper versioned migrations
- turn the current explicit cutover-script baseline into a real migration history
- make schema evolution safer and more observable than ad hoc one-time scripts
- separate one-time migration work from normal app startup permanently
- capture the unified-ledger baseline, close-out schema, and setup-assessment schema in the real migration path

#### Activity Group: Consistency

Status:

- `Next`

- standardize terminology around savings and investments
- standardize where the UI says `Budget Cycle` while backend and API continue using `period`
- standardize health terminology around surplus, deficit, tolerance, threshold, and escalation
- preserve backend naming stability while refining frontend wording
- keep balance movement read-only and transaction-derived
- avoid introducing edit paths that weaken ledger trust
- keep actual-entry workflows transaction-first across income, expenses, and investments unless a deliberate exception is introduced

#### Activity Group: Polish

Status:

- `Later`

- decide whether repeated demo imports should eventually gain clearer naming, timestamps, or lightweight duplicate-management affordances

## Recommended Session Backlog

If we want a practical order of work rather than just a thematic roadmap, this is the strongest current sequence:

1. Reconciliation > Closed-Cycle Reconciliation Handoff: design the correction path for closed cycles and close remaining write-path gaps.
2. Reporting and Analysis > Reporting Foundations: add a reporting summary endpoint that rolls up period and ledger data.
3. Reporting and Analysis > Reporting Foundations: surface a budget-level reporting card set in the frontend.
4. Localisation and Regional Fit > Formatting Foundations and Preferences And Resolution: introduce shared localisation utilities and decide how locale, currency, and timezone preferences are stored.
5. Cash Management > Cash Model Definition and Cash Summary And Review Surfaces: define the workflow and first summary model for available, committed, and reserved cash.
6. Budget Health > Personalisation and Evidence Language plus Quality > Test Coverage: refine health personalisation and add supporting tests.
7. Quality > Reliability: replace ad hoc startup migrations with a proper migration system and clean up deployment or deprecation warnings.
8. Quality > UX/UI and Bugs: review period-detail, sidebar, and budget-summary polish after real use and close the small remaining UI defects.
9. Export and Backup > Export Scope and Format plus Backup and Restore Design: define the first export and backup scope, including format and restore expectations.

## Implementation Notes To Preserve

- Docker Compose is now the active control point for `DEV_MODE`; future work should avoid drifting back to a separate checked-in frontend-only flag for demo gating.
- Demo-budget creation is intentionally additive only. It should keep creating a new budget rather than overwriting or deleting existing budgets.
- Because the frontend is built with Vite and served as static assets, changes to frontend dev-mode visibility require a rebuild, not only a container restart.
- Backend enforcement should continue to exist even when the frontend hides the control, so dev-only workflows are not protected by UI state alone.

## Canonical Near-Term References

To avoid duplicating the canonical roadmap entries above, use these sections as the main near-term reference points:

- `Reconciliation > Closed-Cycle Reconciliation Handoff`
- `Reporting and Analysis > Reporting Foundations`
- `Localisation and Regional Fit > Formatting Foundations`
- `Localisation and Regional Fit > Preferences and Resolution`
- `Cash Management > Cash Model Definition`
- `Cash Management > Cash Summary and Review Surfaces`
- `Budget Health > Personalisation and Evidence Language`
- `Budget Health > Demo Data Alignment`
- `Quality > UX/UI`
- `Quality > Bugs`
- `Quality > Test Coverage`
- `Quality > Reliability`
- `Quality > Consistency`
- `Quality > Polish`

Supporting validation material for near-term engineering work:

- [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md)
- [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/docs/tests/TEST_EXPANSION_PLAN.md)
- [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md)

## Recommended Session Backlog

If we want a practical order of work rather than just a thematic roadmap, this is the strongest current sequence:

1. Design the reconciliation handoff for closed cycles and close remaining write-path gaps.
2. Add a reporting summary endpoint that rolls up period and ledger data.
3. Surface a budget-level reporting card set in the frontend.
4. Introduce shared localisation utilities and decide how locale, currency, and timezone preferences are stored.
5. Define the cash management workflow and the first summary model for available, committed, and reserved cash.
6. Add tests and cleanup around health personalisation and current-period threshold behavior.
7. Replace ad hoc startup migrations with a proper migration system.
8. Clean up remaining deployment and backend deprecation warnings from startup hooks and timestamp usage.
9. Review sidebar and budget-summary polish after real use, especially around future first-class sections.
10. Define the first export and backup scope, including format and restore expectations.
11. Revisit summary-card customization only after the current period-detail card set feels stable in real use.

## Guardrails For Future Work

These project rules already emerge clearly from the existing docs and implementation and should continue guiding development:

- functional clarity matters more than decorative redesign
- workflow meaning should take priority over isolated CRUD convenience
- balance movement should remain explainable from transactions
- paid expenses should stay protected until explicitly revised
- paid investments should follow the same protection and revision model as paid expenses
- budget health should stay supportive and explainable, not overly authoritative
- user-facing health and warning messages should use warm, practical, reassuring language rather than clinical finance wording
- when health preferences assess deficit risk, the wording should say `deficit` clearly rather than implying that zero surplus is itself a problem
- autosave is preferred for lightweight setup and personalisation edits when validation is simple and failures can be surfaced clearly
- backend and database naming should remain stable unless a change is clearly worth the cost
- user-facing `Budget Cycle` wording can evolve independently of backend `period` naming when that improves clarity
- setup validity and downstream protection should be centralized, not rebuilt ad hoc in each page
- localisation should be explicit and centrally managed rather than emerging from scattered hard-coded formatting choices
- cash management views should reflect trustworthy underlying money movement rather than introducing separate shadow balances
- export and backup should preserve user trust by being understandable, complete enough to be useful, and compatible with ledger integrity
- there should only ever be one active or current cycle for a budget
- closing a cycle should create a trustworthy point-in-time historical record, not a view that can drift later
- carry-forward and next-cycle opening rebasing should be recalculated together so continuity does not drift or double count
- deleting a cycle must not leave retained gaps; guided delete-and-regenerate is preferred over ambiguous continuity
- tests should continue using isolated databases per case whenever backend work spans multiple functional areas
- if a sidebar affordance points to the page the user is already viewing, it should be muted or otherwise downgraded rather than appearing broken
- the main budget summary page should avoid duplicate edit/setup actions when one clear path already exists
- brand accent color and positive/success color should remain distinct so navigation and financial meaning do not blur together

## What Future Sessions Should Check First

Before proposing major changes, review:

- [README.md](/home/ubuntu/dosh/README.md)
- [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)

That combination should be enough to understand:

- where the product is today
- what decisions are already intentional
- what the next sensible development activities are
