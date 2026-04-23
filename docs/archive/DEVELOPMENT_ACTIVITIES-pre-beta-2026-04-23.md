# ARCHIVED (pre-beta snapshot)

This document is archived as part of the beta roadmap reset on **2026-04-23**.

- **Status**: archived (historical reference only)
- **Replaced by**: [`docs/DEVELOPMENT_ACTIVITIES.md`](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- **Companion snapshot**: [`docs/archive/ROADMAP-pre-beta-2026-04-23.md`](/home/ubuntu/dosh/docs/archive/ROADMAP-pre-beta-2026-04-23.md)

---

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
- [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/archive/BUDGET_HEALTH_ADDENDUM.md) for staged budget health direction
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
- budget setup now has `Thresholds & Tolerances` above `Settings`
- budget health can now be tuned per budget through persistent threshold values
- deficit concern logic now supports both a percentage threshold and an optional dollar threshold
- budget info and thresholds now autosave quietly instead of relying on save buttons
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
- the period-detail page now surfaces `Projected Investment` and `Remaining Expenses` in a single 8-card summary grid
- backend tests now run against an isolated SQLite database per test case, making mixed-area sessions much safer
- Docker Compose deployment was rebuilt and verified successfully from the current working tree
- income actual entry in the period detail page now uses a dedicated transaction modal instead of inline actual overrides
- locked active cycles now preserve actual-entry and transaction flows while still guarding structural edits
- `PeriodTransaction` is now the sole live transaction store after removal of obsolete legacy expense and investment transaction tables
- backend startup schema patching has been removed in favor of an explicit cutover script for the current baseline
- backend migration verification now includes a reusable Alembic harness for both clean upgrade and upgrade from a pre-feature SQLite snapshot
- the frontend now uses Vite plus standalone Jest rather than Create React App
- the frontend Docker image now uses Node 20 and the frontend dependency tree is currently clean on `npm audit`
- the seeded demo budget now includes historical close-outs, a live current cycle, upcoming cycles, linked savings and investment setup, and budget-health-relevant activity rather than neutral placeholder transactions
- account transfers are now generalised: any active account can be a transfer source or destination, with committed-amount balance validation and self-referential transfer blocking
- expense items now support a `default_account_desc` for routing, with transaction-level account override and fallback to the primary account
- investment transactions now expose and display their linked cash account (`affected_account_desc`)
- two Alembic migrations backfill existing expense defaults and transaction account data safely and idempotently
- dynamic account balance calculation now computes balances from the last frozen anchor (closed or pending-closure cycle) for open cycles, with a configurable `max_forward_balance_cycles` limit (default 10, range 1-50) and a 204 response when the limit is exceeded
- balance propagation now triggers automatically after transaction recording and syncs stored values for cycles within the forward limit
- period start and end dates are now stored as local midnight in the budget timezone (expressed as UTC), fixing boundary issues where cycles expired early for positive-offset timezones
- `effectivedate` on expense and investment items follows the same timezone-aware midnight rule

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
- `Beta Release > Cash Management` is complete for beta
- `Beta Release > Localisation` is implemented for app-wide regional formatting, amount input, supported-option governance, and non-translation best-practice hardening through `Localisation and Regional Fit`; full text translation remains outside beta scope
- `Beta Release > Budget Health Engine` is currently implemented through `Budget Health`, with supporting work from `Quality > Test Coverage` and demo-data maintenance
- `Beta Release > Maintainability` is currently implemented primarily through `Quality > Reliability`, `Quality > Consistency`, and the release and migration policy documents
- `Phase 2 > Reconciliation Module` is currently implemented through `Reconciliation`
- `Phase 2 > Reporting Module` is currently implemented through `Reporting and Analysis`
- `Phase 2 > Full Budget File Export` and `Phase 2 > Backup And Restore` are currently implemented through `Export and Backup`
- `Future Opportunities > Bank Integration` is roadmap-only for now and does not yet have a stable activity home in this document

## Roadmap Areas

(Verbatim content continues in the canonical file as of the archive date.)

