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

- [ROADMAP.md](/home/ubuntu/dosh/docs/ROADMAP.md) for the release-shaped overall delivery path across beta, Phase 2, and longer-view opportunities
- [README.md](/home/ubuntu/dosh/README.md) for current-state product and technical overview
- [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md) for recorded product decisions and recent implementation history
- [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/plans/BUDGET_HEALTH_ADDENDUM.md) for staged budget health direction
- [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md) for the detailed cycle lifecycle and close-out plan that is now partially implemented
- [LOCALISATION_SUPPORT_PLAN.md](/home/ubuntu/dosh/docs/plans/LOCALISATION_SUPPORT_PLAN.md) for the implemented regional formatting, numeric masked amount input, operator-triggered calculator behavior, and preference-resolution boundaries
- [BUDGET_ADJUSTMENT_REVISION_HISTORY_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_ADJUSTMENT_REVISION_HISTORY_PLAN.md) for the budget-adjustment, revision-history, and setup-history rules implemented this session
- [SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md](/home/ubuntu/dosh/docs/plans/SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md) for the centralized setup-validity and downstream-protection model implemented this session
- [AUTO_EXPENSE_PLAN.md](/home/ubuntu/dosh/docs/plans/AUTO_EXPENSE_PLAN.md) for the implemented Auto Expense rules, scheduler behavior, AUTO/MANUAL eligibility, and migration expectations
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
- budget settings and period-detail now include the first Auto Expense automation slice for scheduled expenses, including budget-level enablement, offset timing, AUTO/MANUAL controls, and manual run support
- budget setup now has a centralized setup assessment model rather than scattered readiness assumptions
- setup records now become explicitly protected when downstream cycles or transactions depend on them
- the budget setup page now shows section-level assessment state and protected downstream usage
- account terminology now has an initial budget-level display preference, allowing `Transaction`, `Everyday`, or `Checking` while preserving one internal model
- account primary handling now distinguishes per-type primary designation from the budget’s required primary `Transaction` account, and in-use accounts can still update primary flags when their structure is unchanged
- the budget setup page now uses in-card section headers, default-collapsed optional sections, and session-persisted expand or collapse state
- the budget cycles list and sidebar now use the aligned stage order `Current`, `Planned`, `Pending Closure`, and `Historic`, with session-persisted expand or collapse state
- budget-cycle lifecycle hardening now distinguishes explicit persisted lifecycle state from derived user-facing stage, allowing multiple overdue `Pending Closure` cycles while preserving one `Current` cycle
- the demo seed now includes rolling-window `Closed`, `Pending Closure`, `Current`, and `Planned` scenarios plus transaction-direction and budget-adjustment examples for walkthroughs
- the period-detail page now surfaces `Projected Savings` and `Remaining Expenses` in a single 8-card summary grid
- backend tests now run against an isolated SQLite database per test case, making mixed-area sessions much safer
- Docker Compose deployment was rebuilt and verified successfully from the current working tree
- income actual entry in the period detail page now uses a dedicated transaction modal instead of inline actual overrides
- locked active cycles now preserve actual-entry and transaction flows while still guarding structural edits
- `PeriodTransaction` is now the sole live transaction store after removal of obsolete legacy expense and investment transaction tables
- backend startup schema patching has been removed in favor of an explicit cutover script for the current baseline
- backend migration verification now includes a reusable Alembic harness for both clean upgrade and upgrade from a pre-feature SQLite snapshot
- the frontend now uses Vite plus standalone Jest rather than Create React App
- the frontend Docker image now uses Node 20 and the frontend dependency tree is currently clean on `npm audit`
- a dev-only `Create Demo Budget` flow now exists from the budget-create modal and is controlled through shared Docker Compose `DEV_MODE` gating across frontend and backend
- the seeded demo budget now includes historical close-outs, a live current cycle, upcoming cycles, linked savings and investment setup, and budget-health-relevant activity rather than neutral placeholder transactions
- account transfers are now generalised: any active account can be a transfer source or destination, with committed-amount balance validation and self-referential transfer blocking
- expense items now support a `default_account_desc` for routing, with transaction-level account override and fallback to the primary account
- investment transactions now expose and display their linked cash account (`affected_account_desc`)
- two Alembic migrations backfill existing expense defaults and transaction account data safely and idempotently

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

- `Idea`: worth capturing, but still exploratory and not yet shaped into near-term implementation work
- `Active`: already underway or the clearest live continuation area
- `Next`: not yet active, but a strong near-term candidate
- `Later`: worth tracking, but not a current near-term priority
- `Completed`: finished and intentionally retained here until the roadmap is next regrouped

## Relationship To The Roadmap

[ROADMAP.md](/home/ubuntu/dosh/docs/ROADMAP.md) is now the release-shaped roadmap for Dosh.

This document remains the detailed implementation and activity backlog that supports that roadmap.

Interpretation rules:

- use [ROADMAP.md](/home/ubuntu/dosh/docs/ROADMAP.md) to decide whether work belongs to `Beta Release`, `Phase 2`, or `Future Opportunities`
- use this document to identify the actual implementation streams, activity groups, and likely next tasks inside those roadmap stages
- when an activity here appears broader than the current beta scope, treat the roadmap as the release-boundary authority
- when a roadmap item does not yet have a stable implementation breakdown here, keep it defined in [ROADMAP.md](/home/ubuntu/dosh/docs/ROADMAP.md) until the activity stream is ready to be managed in this document

Roadmap-to-activity mapping:

- `Beta Release > Close Out Process` is currently implemented through `Period Close Out`, plus supporting `Setup Assessment And Protected Configuration` and `Quality > Test Coverage`
- `Beta Release > Cash Management` is currently implemented through `Cash Management`, with supporting work expected from `Quality > UX/UI` and `Quality > Test Coverage`
- `Beta Release > Localisation` is implemented for app-wide regional formatting, amount input, supported-option governance, and non-translation best-practice hardening through `Localisation and Regional Fit`; full text translation remains outside beta scope
- `Beta Release > Budget Health Engine` is currently implemented through `Budget Health`, with supporting work from `Quality > Test Coverage` and demo-data maintenance
- `Beta Release > Maintainability` is currently implemented primarily through `Quality > Reliability`, `Quality > Consistency`, and the release and migration policy documents
- `Phase 2 > Reconciliation Module` is currently implemented through `Reconciliation`
- `Phase 2 > Reporting Module` is currently implemented through `Reporting and Analysis`
- `Phase 2 > Full Budget File Export` and `Phase 2 > Backup And Restore` are currently implemented through `Export and Backup`
- `Future Opportunities > Bank Integration` is roadmap-only for now and does not yet have a stable activity home in this document

## Roadmap Areas

### 1. Reporting and Analysis

Roadmap alignment:

- `Phase 2 > Reporting Module`

This remains the clearest next feature stream.

#### Activity Group: Reporting Foundations

Status:

- `Active`

- add a period comparison summary endpoint
- add reporting cards on the budget summary page
- build account movement summaries grouped by source
- build on the newly implemented single-cycle export surface instead of designing reporting output from scratch again
- move period-detail summary-card rollups onto canonical backend-calculated summary values so the API, not the frontend page, owns the mixed budget, actual, and remaining calculations

#### Activity Group: Trend and Variance Visibility

Status:

- `Later`

- add surplus trend and planned-vs-actual trend views
- improve explanations of surplus changes over time
- improve savings and investment trend visibility
- add a `Forecast Remaining Position` summary card to period details so users can compare the live mixed remaining position with the existing budget and actual summary values

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

Roadmap alignment:

- `Phase 2 > Reconciliation Module`

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

#### Activity Group: Transaction Correction and Reversal Handling

Status:

- `Idea`

- consider whether deleting a recorded transaction from income, expense, or investment modals should create a reversal transaction rather than hard-deleting the original row

Notes:

- current behavior hard-deletes the transaction while the cycle remains open, then recomputes derived state from the remaining ledger rows
- reversal-style correction would better match stronger financial audit methodology and preserve a visible correction trail
- hard delete is currently simpler for end-user understanding, especially in an open-cycle budgeting workflow that is not yet presenting itself as a full accounting ledger
- any future change should distinguish clearly between open-cycle usability, closed-cycle historical integrity, and whether users are allowed to void, reverse, or fully remove erroneous entries

Cross-links:

- Period Close Out
- Quality > Enhancements

### 3. Period Close Out

Roadmap alignment:

- `Beta Release > Close Out Process`

This is now an active implementation stream rather than just a future milestone.

Reference:

- [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md)

#### Activity Group: Lifecycle Hardening

Status:

- `Completed`

- validate and harden the explicit lifecycle rules
- ensure carry-forward and opening rebasing stay aligned after delete and regenerate flows
- strengthen the handoff from `ACTIVE` to `CLOSED` to next `ACTIVE`
- `Completed`: distinguish stored lifecycle state from derived user-facing cycle stage so `Pending Closure` can exist without weakening close-out integrity
- `Completed`: allow multiple overdue open cycles while preserving a single `Current` cycle and aligned carry-forward continuity

#### Activity Group: Close-Out Experience

Status:

- `Active`

- finish the end-of-cycle review experience so it feels complete and trustworthy
- refine the close-out modal and summary surfaces
- decide which historical views should show close-out comments, goals, and snapshotted health data
- keep the new `Pending Closure` affordances, direct close-out shortcuts, and compact budget-summary prompts aligned across the budgets page, sidebar, and cycle list

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

Roadmap alignment:

- supports `Beta Release > Close Out Process`
- supports `Phase 2 > Reconciliation Module`

This is an implemented foundation and should be treated as an active maintenance area rather than a speculative idea.

Reference:

- [SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md](/home/ubuntu/dosh/docs/plans/SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md)

#### Activity Group: Generation Readiness

Status:

- `Active`

- keep centralized setup assessment as the source of truth for generation readiness
- avoid reintroducing one-off page-level readiness logic
- `Completed`: revise setup-assessment summary and section wording so it stays informative, supportive, and guiding without referring to downstream activities users may not have encountered yet

#### Activity Group: Protected Configuration

Status:

- `Active`

- extend protection reasoning only when it improves downstream safety and user understanding
- keep setup editable where safe while blocking destructive changes once downstream dependence exists
- `Completed`: scope account primary designation per balance type so `Savings` and `Cash` primaries no longer replace the required primary `Transaction` account
- `Completed`: allow in-use accounts to change non-structural flags such as `is_primary` without tripping structure-lock enforcement when `balance_type` and `opening_balance` are unchanged
- `Completed`: confirm that the current one-line-per-savings-account transfer model remains balance-safe, with later additions expected through transactions on that existing line
- add stronger explanation surfaces for why a setup item is protected

#### Activity Group: Consequence Visibility

Status:

- `Next`

- extend consequence messaging for reconciliation or correction paths after setup becomes in use

Cross-links:

- Reconciliation
- Quality > Consistency

### 5. Budget Health

Roadmap alignment:

- `Beta Release > Budget Health Engine`

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

- `Completed`: shift current-period planning stability away from required revision-comment capture by recording transaction line state and using off-plan activity history in budget health
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

- `Completed`: update the demo seed to match the lighter revision workflow and the newer transaction-backed planning-history model
- keep development and demo data realistic enough that health surfaces remain meaningful during walkthroughs and regression checks
- keep the demo seed aligned with later budget-health scoring changes so walkthrough data does not become misleading or stale
- `Completed`: update the rolling demo seed so new walkthroughs include `Closed`, multiple `Pending Closure`, `Current`, and `Planned` cycle stages together with transaction-direction and budget-adjustment examples
- expand the demo seed to include expense items with varied types and recurrence patterns so calendar, timing, and workflow walkthroughs better reflect real use
- consider whether more than one demo seed profile is needed later, such as `healthy`, `under pressure`, or `recovery`, without weakening the current additive-only demo import behavior

Cross-links:

- Period Close Out
- Quality > Test Coverage
- Quality > UX/UI

### 6. Localisation and Regional Fit

Roadmap alignment:

- `Beta Release > Localisation`

Dosh now treats localisation as a deliberate product capability for regional formatting and amount entry.

Current implemented slice:

- account naming now has a budget-level display preference for `Transaction`, `Everyday`, and `Checking`
- this should be treated as the reference pattern for terminology preferences that are display-layer only
- the data model should stay stable underneath unless a deeper domain reason appears
- budget records now carry `locale`, `currency`, `timezone`, and `date_format` preferences, defaulting to `en-AU`, `AUD`, `Australia/Sydney`, and `medium`
- frontend display formatting now flows through shared localisation helpers built on `Intl.NumberFormat` and `Intl.DateTimeFormat`
- normal money entry now uses localized numeric masks without currency symbols or codes inside editable fields, while deliberate arithmetic is triggered by simple operators or the still-supported leading `=` and still submits normalized decimal values
- backend storage, API payloads, ledger calculations, migrations, and machine-readable exports remain locale-neutral
- the implemented rules and boundaries are captured in [LOCALISATION_SUPPORT_PLAN.md](/home/ubuntu/dosh/docs/plans/LOCALISATION_SUPPORT_PLAN.md)
- the beta non-translation hardening slice is now complete; full text translation and broader country-specific behavior remain outside beta scope

#### Activity Group: Formatting Foundations

Status:

- `Completed`

- `Completed`: introduce a shared expense-flow date field with consistent day-only `DD MMM YYYY` display for effective dates, while keeping stored values normalized and leaving broader locale and currency preference work for a later dedicated localisation pass
- `Completed`: move locale, currency, percent, number, date, time, date-range, and timezone-aware today formatting out of hard-coded UI assumptions and into shared frontend localisation utilities
- `Completed`: replace app-surface hard-coded regional display strings across dashboard, budget overview, budget cycles, period detail, setup tabs, history modals, amount previews, and settings while preserving normalized backend/API values
- `Completed`: add regression coverage around locale-sensitive display, masked amount input, calculator previews, and budget preference validation

#### Activity Group: Preferences and Resolution

Status:

- `Completed`

- `Completed`: add budget-level `locale`, `currency`, `timezone`, and `date_format` preferences with backend validation, settings controls, and frontend resolution from the active budget
- `Completed`: add Alembic migrations `9b7f3c2d1a4e` and `c4d8e6f1a2b3` for the budget localisation preferences and include them in the migration test harness

#### Activity Group: Localisation Best-Practice Hardening

Status:

- `Completed`

Roadmap assignment:

- `Beta Release > Localisation`

Purpose:

- preserve the non-translation best-practice hardening completed after the `0.3.0-alpha` localisation release
- keep the current “regional formatting, not translation” scope explicit for future sessions
- preserve normalized backend/API values and numeric-only editable amount fields unless a future product decision explicitly changes that contract

Completed hardening:

- `Completed`: backend-provided supported-option governance now covers locales, currencies, timezones, and date formats through `/api/budgets/localisation-options`
- `Completed`: backend validation now uses supported sets for locale, currency, and timezone rather than broad shape-only acceptance
- `Completed`: `date_format` treats explicit `null` as `medium` and supports the selected custom token formats `MM-dd-yy` and `MMM-dd-yyyy` through the normal dropdown list
- `Completed`: date-range formatting uses `Intl.DateTimeFormat.prototype.formatRange` where available, with a tested fallback
- `Completed`: [DateField.jsx](/home/ubuntu/dosh/frontend/src/components/DateField.jsx) passes the active budget locale into `react-datepicker`
- `Completed`: formatter caching now avoids repeated `Intl.NumberFormat` and `Intl.DateTimeFormat` construction on shared helper paths
- `Completed`: localized amount parsing now uses string-based decimal normalization for pasted/grouped values, comma-decimal locales, non-breaking spaces, invalid mixed separators, and current negative-value rejection
- `Completed`: AutoNumeric was removed and the custom numeric input helper contract was renamed to match the implemented component behavior
- `Completed`: formula/calculator scope is documented as non-localized arithmetic; calculator mode is now triggered by simple arithmetic operators or the still-supported leading `=`
- `Completed`: reviewed export labels and affordances; beta export remains machine-readable CSV/JSON and does not promise localized or human-readable output

Remaining explicit constraints:

- full text translation remains outside beta scope
- non-Latin digit locales are out of scope for Dosh beta
- localized or human-readable export should be introduced only as a separate explicit export mode
- negative amount entry remains blocked in current amount fields; transaction reversals continue through the existing credit/refund direction model

Suggested regression coverage:

- keep representative utility tests for `en-AU/AUD`, `en-US/USD`, `en-GB/GBP`, and `de-DE/EUR`
- keep amount input tests for focus/unfocus formatting, paste, partial decimal entry, negative-value policy, grouped values, comma-decimal values, and invalid mixed separators
- keep formula tests confirming operator-triggered calculator mode, numeric-only normal entry, localized preview display, and normalized decimal submission
- keep date tests for selected date-format presets, custom date formats, timezone boundary behavior, date-range formatting fallback, and date-picker display behavior
- keep backend tests for supported locale/currency/timezone/date-format acceptance and rejection, explicit null-to-`medium` date-format behavior, and migration coverage for preference defaults

Out of beta scope:

- full text translation and translation-framework adoption remain outside this beta hardening group
- country-specific legal, tax, or banking rules remain outside this group
- backend domain model renaming remains outside this group

#### Activity Group: Terminology and Regional Behavior

Status:

- `Later`

- support regional budgeting cadence and terminology without fragmenting the core model
- `Completed`: support custom budget and pay-cycle cadences defined by a fixed number of days, such as a 10-day cycle, without weakening the existing lifecycle and generation rules
- make health language, labels, and helper copy adaptable by locale
- prepare for country-specific conventions such as fortnightly budgeting, date ordering, and currency display
- identify user-facing finance terminology that may need regional variants
- decide cautiously whether period naming should follow the same preference pattern later; it was discussed this session and intentionally deferred
- document which localisation decisions belong in product copy versus data model behavior
- identify backend responses that should stay neutral versus pre-formatted for display
- `Completed`: keep the current localisation pass scoped to regional formatting and input masking, not full text translation or backend domain-model renaming

Cross-links:

- Budget Health
- Quality > Consistency
- Quality > Test Coverage

### 7. Cash Management

Roadmap alignment:

- `Beta Release > Cash Management`

Dosh tracks balances and transactions already, but the product still needs an explicit cash management workflow that helps users decide what cash is available, what is committed, and what needs attention next.

#### Activity Group: Cash Model Definition

Status:

- `Completed`

- `Completed`: generalise the savings-transfer endpoint to `account-transfer`, allowing any active account as source or destination
- `Completed`: add committed-amount transfer validation using `max(budget, actual)` for non-paid lines and `actual` for paid lines
- `Completed`: block self-referential transfers at the API level
- define what Dosh means by available cash, committed cash, and reserved cash
- clarify the relationship between account balances, planned spending, savings transfers, and investment allocations

#### Activity Group: Cash Summary and Review Surfaces

Status:

- `Completed`

- `Completed`: add `default_account_desc` to `ExpenseItem` so setup can define which account an expense debits by default
- `Completed`: add transaction-level `account_desc` override for expense entries so users can route individual transactions to the correct account
- `Completed`: expose `affected_account_desc` on investment transactions so users can see which cash account was debited
- define a cash management summary model for current-period use
- add views for available cash, committed outflows, and near-term obligations
- design the first cash management review surface before adding more balance-related UI fragments

#### Activity Group: Cash Pressure Signals and Validation

Status:

- `Active`

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

Roadmap alignment:

- `Phase 2 > Full Budget File Export`
- `Phase 2 > Backup And Restore`

As Dosh becomes more trustworthy for day-to-day finance use, users will eventually expect straightforward ways to export their data and keep independent backups.

Reference:

- [BUDGET_CYCLE_EXPORT_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_EXPORT_PLAN.md)

#### Activity Group: Export Scope and Format

Status:

- `Active`

- `Completed`: add budget-cycle detail export from the period-detail header with user-selected flat `CSV` or grouped `JSON` download
- keep the current flat CSV spreadsheet-friendly for Excel and Google Sheets while preserving line-to-transaction reconciliation
- decide whether the next export slice should expand to budget-level, multi-cycle, account-level, or reconciliation-oriented reporting
- make future export additions useful for both human review and machine-readable portability without weakening ledger explainability

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
- continue expanding validation around export completeness now that the first flat CSV and JSON slice exists

### 9. Quality

Roadmap alignment:

- primarily supports `Beta Release > Maintainability`
- also supports `Beta Release > Close Out Process`, `Beta Release > Cash Management`, `Beta Release > Localisation`, and `Beta Release > Budget Health Engine`

This roadmap area exists for work that improves trust, usability, consistency, and delivery quality across multiple feature areas.

#### Activity Group: UX/UI

Status:

- `Next`

- `Completed`: consolidate Budget Setup and Period Detail add-expense scheduling onto a shared field set based on the Period Detail flow, standardize `Effective Date` wording, keep period-only note and include controls out of Budget Setup, and finish the accepted date-picker, fixed-day guidance, quick-fill, and neutral action-button polish in the touched expense workflows
- `Completed`: extend the release-notes modal so newly available versions can expand inline for details without losing the current-version focus
- `Completed`: make the "N newer release available" badge in the release-notes modal clickable so it scrolls directly to the Available Updates section
- provide clear definitions and calculation explanations for the period-detail summary cards, likely through hover helper text or another suitable method, with implementation approach to be confirmed before work starts
- `Completed`: align the budget-setup account table headings and values, separate add-account helper copy more clearly, and tighten primary-account affordances so the setup flow explains what is active, what is primary, and why
- `Completed`: rename budget-setup income wording from `Income Type` to `Income Source` across the relevant setup surfaces
- `Completed`: make expense and investment `View transactions` behave as read-only details modals so they match the movement-details pattern instead of showing add-transaction controls
- `Completed`: move the expense status filter inline with the period-detail status column header
- `Completed`: tighten period-detail UI polish around totals and status affordances, especially for the income, investment, and balance sections
- `Completed`: add period-detail totals for investments and balances while keeping movement read-only and avoiding a meaningless movement total
- `Completed`: continue navigation and information architecture cleanup so the sidebar stays centered on one active budget context at a time
- `Completed`: replace the `Edit` text label on the budget cycle details page with a more appropriate icon-based affordance where that action is already visually established elsewhere
- `Completed`: align the `+`, `-`, and details affordances properly in the income section of the budget cycle details page so row actions read as one intentional control set
- `Completed`: add a delete-current-budget action to the `No budget cycles yet` card so an abandoned or exploratory budget can be removed directly from that empty state
- `Completed`: identify the next summary card that best complements current balance and health without duplicating period-listing data, which was implemented as the calendar-style budget overview card
- `Completed`: add a calendar-style view of income timing and expense due dates to the budget overview page, replacing the historical `# periods` summary card
- `Completed`: restore current setup-line visibility inside the budget setup history modal while keeping revision and adjustment history visible alongside it
- `Completed`: stabilize income-table action-column alignment on the budget-cycle detail page so delete-availability does not shift the numeric columns
- `Completed`: add create-budget modal header copy that explains what a budget is and what the setup flow will help the user define
- hide `Current Only` budget adjustment entries from the budget setup history modal so setup history stays focused on setup-level meaning
- add revision and active-status columns to budget setup sections where that state is currently missing
- add summary information to the budget cycles list page section headers, with the exact summary content still to be defined

#### Activity Group: Bugs

Status:

- `Active`

- `Completed`: fix shared add-expense scheduling and transaction-entry inconsistencies including the expense modal icon mismatch, native-date-control replacement, clickable calendar icon behavior, fixed-day `31` rollover handling, and shared quick-fill rule drift across income, expense, and investment directions
- `Completed`: fix `Surplus (Budget)` so current mixed-actual periods and untouched future periods both roll up correctly from line-level budget, actual, and remaining values rather than relying on one top-level actual-based shortcut
- `Completed`: prevent account-setup edits or deletes from leaving the budget with no active primary transaction account, while defaulting the first transaction account to primary and warning before switching primary status
- `Completed`: protect account opening balances from edits once downstream budget-cycle use exists and explain the lock reason in the setup UI
- `Completed`: remove the retired income `isfixed` behavior so generated cycles now use the income source amount directly and new income sources default to auto-include unless the user unchecks it
- `Completed`: correct period-detail remaining-expense, remaining-investment, and surplus rollups so deficit lines stay visible at the row level without distorting top-level remaining or budget-surplus totals
- `Completed`: hide `Add Remaining` in credit or refund transaction-entry views and only show it when there is a real positive remaining obligation to add
- `Completed`: fix the empty visual artifact at the end of the total income line on the period detail page
- `Completed`: align the investment spent pill wording and behavior with the expense spent pill so both outflow workflows feel consistent
- `Completed`: ensure `Surplus (Budget)` reflects deficit on expense lines even when the affected expense line is already in `Paid` state
- `Completed`: fix the sidebar budget chevron behavior so collapsing a budget in the navigation panel also collapses its budget cycles reliably
- `Completed`: fix the `Go to budget cycles` action from Setup Assessment on the project setup page, which currently results in a blank screen
- `Completed`: fix the `Add New Income Item` modal so it supports creating a brand-new income line inline, matching the supported `Add New Expense Item` modal workflow
- `Completed`: resolve the dominant SonarQube frontend issue cluster by adding explicit React props validation across shared components, setup tabs, and high-traffic budget pages
- `Completed`: fix the account setup section header alignment so the headings line up cleanly with the displayed column values
- `Completed`: fix the inability to edit an income line from budget setup
- `Completed`: fix budget deletion so attempting to remove a budget does not fail with a SQLite `FOREIGN KEY constraint failed` error in the backend ASGI path once setup revision history exists
- `Completed`: add the missing webpage favicon so browser tabs and installed shortcuts show the app identity correctly
- `Completed`: recover the budget setup sections after the live setup-history schema mismatch temporarily made income, expense, and investment lines appear missing
- `Completed`: fix scheduled expense period applicability so "Every N Days" and "Fixed Day of Month" expenses with a future effective date no longer create zero-budget rows in cycles where they do not occur
- `Completed`: fix browser autofill overlapping the Effective Date calendar picker in the add-expense modal
- `Completed`: fix misleading delete messaging for the last budget cycle so trailing cycles show "This budget cycle will be deleted." instead of "Delete this cycle and all upcoming cycles (1)"
- `Completed`: hide Setup Assessment messaging on the Budget Setup page once any budget cycle exists for the budget
- `Completed`: fix newly added active accounts not appearing in existing budget cycle details by backfilling `PeriodBalance` rows for current and future periods when an active account is created (closed and pending-closure periods are intentionally skipped)
- `Completed`: fix transfer income line prefix so new transfers use `Transfer: {source} to {destination}` and legacy `Transfer from ` descriptions continue to parse correctly for backward compatibility

#### Activity Group: Enhancements

Status:

- `Next`

- `Completed`: move budget editing for income, expense, and investment lines onto a shared modal-driven adjustment workflow with note capture and current-or-future-unlocked scope
- `Completed`: add setup-level history review for income, expense, and investment items using the shared `PeriodTransaction` and `BUDGETADJ` model
- `Completed`: allow the add-income modal to create a brand-new income setup item inline, matching the supported expense workflow more closely
- `Completed`: extend setup-item history so revision-number increases can show the actual changed setup fields, not only `BUDGETADJ` entries
- `Completed`: align setup revision numbers with real stored history records and link setup-affecting future budget adjustments into that revision sequence
- `Completed`: add inline arithmetic amount entry to period-detail transaction, budget-adjustment, add-income, and add-expense modals, with resolved previews for valid calculations and in-progress summaries for incomplete arithmetic input
- `Completed`: revise amount entry so normal money fields use localized masking and arithmetic is entered deliberately through simple operators or the still-supported leading `=` trigger, with localized result previews and normalized decimal submission
- `Completed`: add an expense status filter to the period-detail expenses table and align the control with the existing status column rather than introducing a separate toolbar
- `Completed`: add a `View previous releases` option to the in-app release-notes modal by extending the backend payload and revealing older released versions on demand
- provide an activation workflow for income lines in budget setup and align that workflow consistently across income, investment, and expense setup sections
- `Completed`: change modal transaction quick-fill wording so `Add Remaining` appears only when expense or investment workflows have a true positive remaining amount, while credit or refund views continue using full-amount entry
- `Completed`: implement Auto Expense so eligible scheduled expenses can run as `AUTO` or `MANUAL`, budget settings now control automation and offset timing, the period-detail page can run Auto Expense manually and switch scheduled lines between `AUTO` and `MANUAL`, and the backend now blocks `MANUAL -> AUTO` once recorded expense activity exists; use [AUTO_EXPENSE_PLAN.md](/home/ubuntu/dosh/docs/plans/AUTO_EXPENSE_PLAN.md) as the canonical rules reference

#### Activity Group: Test Coverage

Status:

- `Active`

- `Completed`: add regression coverage for budget-adjustment history, carry-forward-on-close-out timing, and direct paid-to-revised workflow behavior
- `Completed`: add dedicated frontend regression coverage for dashboard current-cycle summaries, personalisation autosave and validation behavior, and inline amount-cell edit behavior after Sonar coverage surfaced those areas as under-tested
- `Completed`: extend SonarQube follow-through coverage in `PeriodDetailPage.test.jsx`, `AmountExpressionInput.test.jsx`, and the new backend router suite [test_period_router_guards.py](/home/ubuntu/dosh/backend/tests/test_period_router_guards.py) while keeping the work behavior-first rather than metric-only
- keep new feature work under a test-with-change discipline rather than treating testing as a later cleanup phase
- extend Playwright from the current happy-path lifecycle smoke into reconciliation, correction, and broader scenario-shaped flows
- continue expanding setup-shape consequence coverage where technically valid configuration changes can still weaken later workflows
- deepen ledger and reconciliation coverage without treating one-off migration backfill as normal product behavior
- continue broadening budget health coverage as scoring and reporting evolve
- extend backend and frontend coverage around close-out, carry-forward, and delete continuity
- `Completed`: add dedicated migration coverage for clean Alembic upgrade and upgrade from a pre-feature SQLite snapshot, alongside focused Auto Expense backend and period-detail frontend regression coverage
- `Completed`: add localisation regression coverage for budget preference validation, `Intl`-based formatting across representative locales, masked amount input, calculator behavior, and touched high-traffic surfaces
- `Completed`: add backend regression coverage for generalised account-transfer validation, including committed-amount logic for paid and non-paid lines (`test_account_transfer_validation.py`)
- `Completed`: add backend regression coverage for expense entry account routing, including default-account fallback and transaction-level override (`test_expense_entry_account_routing.py`)
- future setup and workflow testing should expand beyond the original `1 transaction + 1 savings` assumption
- bookmark named scenarios such as `Single Account` and `Multi Transaction` so future sessions can deliberately test differing account shapes rather than relying on one default personal setup model
- consider adding a richer demo-validation checklist or smoke flow once more reporting and reconciliation surfaces exist
- add tests and cleanup around health personalisation and current-period threshold behavior

#### Activity Group: Reliability

Status:

- `Active`

- `Completed`: align the deployed SQLite schema to the new budget-adjustment and transaction-line-state code after deployment exposed the gap
- `Completed`: align the live SQLite schema again after setup-history revision support exposed the missing `periodtransactions.revisionnum` column and `setuprevisionevents` table
- `Completed`: pin frontend install behavior more reliably by keeping the Vite toolchain on a patched release and restoring a clean `npm audit` baseline
- keep the Node 20 frontend Docker baseline healthy and revisit newer LTS adoption only when the toolchain is ready
- verify compose assumptions around networks and Traefik usage
- document expected production vs local deployment differences
- confirm build and startup paths remain clean as the app grows
- `Completed`: introduce route-level lazy loading for major pages in [App.jsx](/home/ubuntu/dosh/frontend/src/App.jsx) so the frontend stops shipping one oversized initial Vite chunk
- clean up startup and timestamp deprecation warnings that appear during test and deployment runs
- `Completed`: formalize the database migration strategy by introducing proper versioned migrations through Alembic from the current aligned baseline
- `Completed`: turn the current explicit cutover-script baseline into a real migration history
- make schema evolution safer and more observable than ad hoc one-time scripts
- `Completed`: separate one-time migration work from normal app startup permanently for the current baseline
- `Completed`: capture the unified-ledger baseline, close-out schema, and setup-assessment schema in the real migration path
- `Completed`: align the backend container and GitHub workflow runtime baseline on Python 3.12 after deployment exposed that the current backend typing syntax is not Python 3.9-safe
- `Completed`: harden the SonarQube workflow so failed quality-gate runs still upload sanitized artifacts with explicit failed-condition context and file-level measure hotspots
- `Completed`: harden backend release-notes parsing by replacing the regex-based header parser with bounded string parsing and dedicated regression coverage after the regex DoS exposure was flagged
- `Completed`: align Dosh to a GitHub-managed release-tagging and release-publishing workflow that creates official Git tags from validated version bumps on `main`, publishes GitHub Releases from validated repo release content, and feeds the in-app release-notes view through the backend GitHub Releases client; the repository workflows, protected `main` SonarQube gate, first remote `v0.1.3-alpha` tag, and first published GitHub Release are now in place, and the app now resolves `current_release` successfully from the published GitHub Release; use [GITHUB_RELEASE_MANAGEMENT_WORKFLOW_PLAN.md](/home/ubuntu/dosh/docs/plans/GITHUB_RELEASE_MANAGEMENT_WORKFLOW_PLAN.md) and [GITHUB_RELEASE_RUNBOOK.md](/home/ubuntu/dosh/docs/GITHUB_RELEASE_RUNBOOK.md) as the current references
- `Completed`: deploy the schema-changing localisation release through the migration-aware Compose script, verify live schema revisions `9b7f3c2d1a4e` and `c4d8e6f1a2b3`, then fix and redeploy the post-deploy budgets-page refresh crash caused by a missing `formatDateRange` dependency in the pending-closure list; follow-up date-format migration `c4d8e6f1a2b3` is part of the same `0.3.0-alpha` release scope

#### Activity Group: Consistency

Status:

- `Next`

- `Completed`: simplify paid-to-revised reopening by removing the separate revision-reason modal and relying on transaction-backed history instead
- `Completed`: reduce the dominant backend SonarQube router noise by switching FastAPI endpoints to a shared `DbSession` dependency alias and centralized documented error responses
- `Completed`: clear the active SonarQube new-code duplication hotspot in `PeriodDetailPage.jsx`; the verified follow-up run now shows duplication below the quality-gate threshold, shifting the remaining quality work toward coverage and residual frontend maintainability findings instead
- `Completed`: complete three-phase modularization of `PeriodDetailPage.jsx` (2,911 lines → 642 lines, 78% reduction); extracted 15 components to organized directories and 3 utility modules
- `Completed`: cleared the modularization-induced unused-import spike (`javascript:S1128`) and related unused-variable warnings (`S1481`/`S1854`) from `PeriodDetailPage.jsx`, `BudgetPeriodsPage.jsx`, `transactionHelpers.js`, and `periods.py`; SonarQube issue count reduced from 159 back toward the pre-modularization baseline
- continue reducing SonarQube noise by addressing the next concentrated frontend rule clusters after props validation and the completed FastAPI router cleanup, especially nested ternaries, form-label associations, and residual maintainability findings in `PeriodDetailPage.jsx` and related high-traffic frontend files now that the duplication hotspot is resolved
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
4. Cash Management > Cash Model Definition and Cash Summary And Review Surfaces: define the workflow and first summary model for available, committed, and reserved cash.
5. Budget Health > Personalisation and Evidence Language plus Quality > Test Coverage: refine health personalisation and add supporting tests.
6. Quality > Reliability: clean up deployment or deprecation warnings and address the outstanding `axios` audit advisory.
7. Quality > UX/UI and Bugs: review period-detail, sidebar, and budget-summary polish after real use and close the small remaining UI defects.
8. Export and Backup > Export Scope and Format plus Backup and Restore Design: define the first export and backup scope, including format and restore expectations.

## Implementation Notes To Preserve

- Docker Compose is now the active control point for `DEV_MODE`; future work should avoid drifting back to a separate checked-in frontend-only flag for demo gating.
- Demo-budget creation is intentionally additive only. It should keep creating a new budget rather than overwriting or deleting existing budgets.
- Because the frontend is built with Vite and served as static assets, changes to frontend dev-mode visibility require a rebuild, not only a container restart.
- Backend enforcement should continue to exist even when the frontend hides the control, so dev-only workflows are not protected by UI state alone.

## Canonical Near-Term References

To avoid duplicating the canonical roadmap entries above, use these sections as the main near-term reference points after first checking [ROADMAP.md](/home/ubuntu/dosh/docs/ROADMAP.md) for release-stage scope:

- `Reconciliation > Closed-Cycle Reconciliation Handoff`
- `Reporting and Analysis > Reporting Foundations`
- `Localisation and Regional Fit > Terminology and Regional Behavior`
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
4. Define the cash management workflow and the first summary model for available, committed, and reserved cash.
5. Add tests and cleanup around health personalisation and current-period threshold behavior.
6. Clean up remaining deployment and backend deprecation warnings from startup hooks and timestamp usage.
7. Address the outstanding `axios` audit advisory deliberately rather than bundling it into unrelated feature work.
8. Review sidebar and budget-summary polish after real use, especially around future first-class sections.
9. Define the first export and backup scope, including format and restore expectations.
10. Revisit summary-card customization only after the current period-detail card set feels stable in real use.

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
- there should only ever be one `Current` cycle for a budget, while multiple overdue open cycles may remain visible as `Pending Closure`
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
- [ROADMAP.md](/home/ubuntu/dosh/docs/ROADMAP.md)
- [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)

That combination should be enough to understand:

- which release stage the work belongs to
- where the product is today
- what decisions are already intentional
- what the next sensible development activities are
