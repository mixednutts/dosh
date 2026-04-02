# Changes Log

This document captures the key product and implementation changes made during recent working sessions.

It is intended to complement [README.md](/home/ubuntu/dosh/README.md), not replace it.

For staged budget health metrics direction, also read [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/BUDGET_HEALTH_ADDENDUM.md).

Use this file in future sessions to understand:

- what changed
- why it changed
- what constraints or product rules now exist
- what design direction the project is leaning toward
- what ideas are intentionally deferred

## How To Use This File

- Read this alongside `README.md` before proposing major changes.
- Prefer preserving decisions recorded here unless the user explicitly wants to revisit them.
- Treat this as a product-context file, not just a technical changelog.
- When in doubt, bias toward functional clarity and low-friction workflow over decorative redesign.

## Current Product Direction

Dosh is evolving from a simple budget tracker into a more guided personal finance workflow tool.

Important product flavor and direction:

- The app should feel practical and personal, not overly corporate or accounting-heavy.
- Plain language is preferred over technical shorthand.
  Example: prefer `page layout` over `UI`.
- Functional clarity comes before visual polish.
- Workflow-driven design is preferred over isolated screens when the user is completing a setup process.
- Metaphorical naming ideas such as `Book` and `Chapter` have appeal, but are not yet adopted.
- Existing backend/API naming should remain stable unless there is a strong reason to change it.

## Key Functional Changes

### 1. Investment budget now affects budget surplus

Period-level and dashboard-level budget surplus calculations were updated so investment budget allocations are included in budget-side surplus.

Implication:

- `Surplus (Budget)` now subtracts both expense budget and investment budget.

### 2. Investment transactions aligned with expense transaction behavior

The investment transaction modal on the period page was adjusted to follow the same pattern as expenses:

- add
- subtract
- full allocation shortcut

Important constraint:

- investment transaction logic should affect actuals only
- the earlier attempt to also sync linked savings income actuals was intentionally reverted

### 3. Dashboard budget surplus now matches period logic

The dashboard view was updated so `Surplus (B)` follows the same budget-side calculation rules as the period detail page.

### 4. Expense status area redesigned

The old status text treatment in the expense `Status / Txns` area on the period page was replaced with a more visual progress-style pill.

Current behavior:

- non-paid expenses show a compact spend/progress indicator
- hover text gives precise values
- paid expenses show a distinct pill
- paid pills are green when actual is within budget
- paid pills are red when actual is over budget

Copy choice:

- `Spent` was chosen over alternatives like `Used`

### 5. Paid expenses are now treated as finalized

Expense status now has stronger workflow meaning.

Important rule:

- `Paid` means finalized and protected from further edits

Current behavior:

- paid expenses cannot be edited directly
- paid expenses cannot have new expense transactions added
- paid expenses cannot be deleted
- paid expenses cannot have notes or budget values edited
- paid expenses must be explicitly revised before further changes

### 6. Revising a paid expense now requires a comment

The `Revised` state now has a specific purpose:

- it is used to reopen a paid expense for editing
- it requires a revision comment

This is an important foundation for future reporting.

Current behavior:

- user marks an expense `Paid`
- if later changes are needed, user clicks the paid pill
- a revise modal appears
- a revision comment is required
- once revised, the line can be edited again

Important note:

- revision comments are intended for future end-of-period reporting work

### 7. Paid warnings now appear when a balance remains

When a user marks an expense as `Paid` and the line still has unused budget or is over budget, the app now shows a concise confirmation modal.

Current behavior:

- under budget: warns that remaining balance still exists
- over budget: warns that the line is over budget
- helper text: `Paid expenses are locked until revised.`

### 8. Budget-side expense totals now treat paid lines as finalized at actual amount

This is a key accounting/workflow rule introduced in this session.

Current rule:

- `Current` and `Revised` expenses contribute their `budgetamount` to budget-side totals
- `Paid` expenses contribute their `actualamount` to budget-side totals

This means:

- when a paid expense comes in under budget, unused budget is released
- the row remaining becomes zero
- budget surplus increases by the released amount

This rule is now applied in:

- period detail totals
- period detail budget surplus
- dashboard budget expense totals
- dashboard budget surplus

### 9. Budget navigation now leads to period management first

The main budget click path was changed so budget selection now lands on a budget-specific periods page rather than dropping directly into setup.

Current behavior:

- clicking a budget in the left navigation opens that budget's periods view
- the budget periods view shows existing periods, setup readiness, and new period generation
- budget setup still exists, but now lives behind a separate setup route and button

Important product decision:

- period management is a primary activity and should not be hidden behind setup
- setup is still important, but should be secondary once a budget is already in use

### 10. Left-hand budget drilldown now shows grouped periods

The budget drilldown in the left navigation now exposes periods directly under each budget.

Current behavior:

- periods are grouped with `Current` first and `Historical` second
- each group is ordered earliest to latest
- historical periods are limited to the most recent 10 historical entries

Important note:

- in the current implementation, `Current` effectively means non-historical periods, so future periods may also appear in that group

### 11. Balance movement is now read-only

The manual edit path for account movement on the period balances section was removed.

Current rule:

- balance movement must be derived from transactions
- users should not directly type a movement value

Current behavior:

- the movement column is read-only in the period balances table
- the old direct patch route was intentionally blocked

Important product meaning:

- account movement should be explainable from financial activity
- balance changes should not feel like arbitrary bookkeeping edits

### 12. Centralized period transaction ledger introduced

A major backend change introduced a centralized period transaction ledger intended to become the single source of truth for period transaction activity.

Current direction:

- expense transactions, investment transactions, direct actual adjustments, and transfers are now represented through a central ledger model
- transaction types now include:
  - `CREDIT`
  - `DEBIT`
  - `ADJUST`
  - `TRANSFER`
- transaction rows snapshot source and account context so later setup changes do not rewrite history

Important design decision:

- historical fidelity is preserved where possible by migrating existing source transactions
- when historical activity cannot be reconstructed exactly, explicit system-generated rows are preferred over guessing

### 13. Active periods are now backfilled to reconcile through transactions

The migration work for the centralized ledger includes reconciliation logic for existing active periods.

Current behavior:

- existing expense and investment transaction rows are migrated into the central ledger
- active periods with actuals or balance movement that cannot be explained by migrated rows receive explicit system-generated rows
- ledger totals are then used to recompute period actuals, investment totals, and balance movement

Important constraint:

- active periods should be reconcilable from transactions alone after migration
- system backfill rows are acceptable when older activity was previously stored only as rolled-up values

### 14. Balance movement details can now be inspected from the period page

The balances section on the period detail page now includes a details action that opens a ledger-backed movement breakdown.

Current behavior:

- each account row has a details/list action
- clicking it opens a modal showing the supporting transaction rows for that account in the current period
- the modal shows source label, transaction type, system flag, note/reason, timestamp, and signed contribution to movement
- transfer rows are presented in an account-aware way so the displayed signed amount matches the selected account's movement

Important product decision:

- movement explanation should be visible where the movement is shown
- the feature is intended for transparency and trust, not editing

### 15. Sidebar period drilldown now separates future periods from current ones

The left-hand budget drilldown no longer treats all non-historical periods as `Current`.

Current behavior:

- `Current` only includes periods whose date range includes today
- `Future` includes periods that have not started yet
- `Historical` still includes completed periods and remains limited to the most recent 10 entries

Important product meaning:

- the sidebar now reflects whether a period is active versus merely scheduled
- future planning is visible without blurring the meaning of `Current`

### 16. Database backup is now a required pre-migration safety step

Before the ledger migration was applied, a full file-level backup of the live SQLite database was taken from the Docker-managed data volume.

Important rule for future high-impact work:

- back up the live SQLite database before any schema or data migration that could affect financial history
- treat backup as a hard gate, not a nice-to-have

Current backup pattern:

- use a timestamped host-side file outside the container lifecycle
- example naming: `dosh-pre-ledger-migration-YYYYMMDD-HHMMSS.db`

### 17. Period summaries now live under the sidebar Periods entry

The sidebar budget drilldown now uses the `Periods` row as the direct entry point to the period summary listing for that budget.

Current behavior:

- clicking a budget name opens budget setup
- clicking `Periods` opens the summary listing for that budget
- the listing now shows period-level financial summary values instead of plain navigation cards

Important product meaning:

- setup and period management now have clearer, separate entry points
- the navigation better matches how people move between configuration and active budget work

### 18. Future periods can be deleted from the summary listing

Period deletion is now exposed from the period summary page, but only for future periods that have not recorded actual values.

Current behavior:

- current periods cannot be deleted
- historical periods cannot be deleted
- future locked periods cannot be deleted
- future periods with recorded actuals cannot be deleted from the summary view

Important product meaning:

- planned periods can be cleaned up without risking active or historical finance history
- destructive actions remain blocked once a period has become meaningful financial record

### 19. Period summaries now include projected savings

The period summary listing now shows a projected savings amount based on per-period savings/investment allocations.

Current behavior:

- projected savings is cumulative across the period timeline
- historical periods add savings/investment actuals into the running total
- future periods add savings/investment budget into the running total
- current periods add one of these values into the running total:
- savings/investment budget when there are no actuals yet
- remaining savings/investment budget when actuals exist but are still below budget
- savings/investment actuals once actuals meet or exceed budget

Important note:

- looking ahead to a future period now includes prior historical savings plus projected savings from intervening periods

### 20. Budgets can now auto-allocate surplus to savings investments

Budget settings now include a control for automatically assigning newly created period surplus to a savings investment budget.

Current behavior:

- the setting is stored on the budget
- when enabled, new periods calculate starting budget surplus during generation
- positive surplus is added to the active primary investment line
- if there is no active primary investment line, nothing is auto-assigned

Important product meaning:

- future periods can show planned savings contributions without requiring manual investment budget entry each time
- the feature is intended to improve forward visibility, not to rewrite historical periods

### 21. Investment lines can now be marked as primary

Investment setup now supports a primary flag so automatic savings allocation has an explicit destination.

Current behavior:

- only active investment lines can be primary
- setting one investment line as primary clears the primary flag from any other investment line in the same budget
- deactivating an investment line removes its primary flag

Important product meaning:

- automatic surplus allocation no longer relies on line ordering or naming assumptions
- savings planning now has a clearer single target within each budget

### 22. Budget settings now explain primary-line allocation directly

The automatic surplus allocation setting now includes an inline help cue so the targeting rule is visible where the setting is changed.

Current behavior:

- a small question-mark tooltip appears next to the setting label
- the tooltip explains that automatic allocation only goes to the primary investment line

Important product meaning:

- the rule is discoverable without adding a large block of explanatory text
- the setting is less likely to be misunderstood during budget setup

### 23. Period generation date handling was corrected

Period generation hit a timezone mismatch bug when creating a new period from the frontend date picker.

Current behavior:

- the frontend now sends the chosen start date without converting it to UTC
- the backend normalizes incoming period start dates before overlap checks
- period generation no longer fails because of offset-aware versus offset-naive datetime comparison

Important note:

- this was a functional bug fix, not a product-rule change
- the selected date should now stay aligned with the date the user actually chose

### 24. Surplus auto-allocation now uses generated expense totals correctly

An error in period generation caused new future periods to allocate the full fixed income amount to the primary investment line instead of only the true surplus.

Correct rule:

- starting surplus for a new period is `fixed income budget - generated expense budget`
- only the positive remainder should be assigned to the primary investment line

Current behavior:

- the generator now totals the new period expense budget explicitly before assigning surplus
- an already-generated live period was corrected from `1135` down to `330` investment budget after the bug was identified

Important product meaning:

- projected savings now reflects actual planned surplus rather than raw income
- future period planning is more trustworthy because the investment allocation follows the same budget logic shown in the summaries

### 25. Budgets page is now the main landing page

The app no longer treats the old dashboard as the primary entry point.

Current behavior:

- the root route now lands on the Budgets page
- the old `/dashboard` path redirects to `/budgets`
- clicking the Do$h brand mark also returns to the Budgets page
- the standalone Dashboard navigation item was removed

Important product meaning:

- the main landing experience is now budget-centric rather than app-centric
- budget overviews should carry the practical summary value users need first

### 26. Budget list now carries budget-level summary cards

The Budgets page now acts as the high-level summary surface for each budget instead of being a plain list.

Current behavior:

- each budget shows current period range when available
- each budget shows days remaining in the active period
- each budget shows counts for current, future, and historical periods

Important product meaning:

- users should be able to understand budget state before drilling into periods
- overview information should feel useful without recreating a separate dashboard concept

### 27. Period summaries were redesigned into grouped tables

The budget period summary page moved away from stacked cards and toward grouped tabular sections.

Current behavior:

- periods are grouped into `Current`, `Future`, and `Historical`
- `Future` and `Historical` are collapsed by default
- groupings mirror the sidebar classification logic
- summary rows now use a denser table layout with category headers for income, expenses, and investments

Important product meaning:

- period summaries should favor readable comparison and scanning over card-style presentation
- the meaning of `Current`, `Future`, and `Historical` should stay consistent across navigation and summary views

### 28. Budget health metrics Phase 1 is now implemented

The first budget health implementation was added as a real product feature backed by current finance workflow data.

Current behavior:

- a backend metrics service computes budget health from current data
- the API exposes budget health via `/api/budgets/{budgetid}/health`
- current pillars are:
  - `Setup Health`
  - `Budget Discipline`
  - `Planning Stability`
- the response includes an overall score, momentum direction, explanatory summaries, and evidence items for inspection
- the Budgets page shows a compact budget health visualization and a details modal

Important product meaning:

- budget health must be explainable from real product data
- visible results should feel like guided indicators, not hidden magic scoring
- development phase terminology belongs in docs, not in user-facing UI

### 29. Budget health now uses a compact score-circle visualization

The budget health presentation was refined from a text-heavy status block into a more compact visual indicator.

Current behavior:

- the budget health card now sits alongside the other budget summary cards
- the main score is shown inside a large colored circle
- a smaller overlapping circle shows the improvement/decline figure
- momentum uses directional arrows and a signed delta instead of only text labels
- visible `Strong`/`Watch`/`Needs Attention` labels were removed from the compact UI treatment

Important product meaning:

- the compact summary should feel motivating and immediately readable
- detailed interpretation still belongs in the health details modal

### 30. Timezone handling now aligns visible data with the app’s intended local time

The app previously displayed some visible times using UTC-oriented behavior that did not match the intended local experience.

Current behavior:

- Docker services now set `TZ=Australia/Sydney`
- budget health evaluation timestamps are generated using the app timezone
- budget health details display local time rather than UTC
- period status logic for summary grouping now uses app-local current time instead of `utcnow`

Important product meaning:

- visible time information should match the user’s expected local finance context
- future/current/historical classification should not drift because of server-default UTC assumptions

### 31. Focused Docker ignore files were added

The repo now avoids sending unnecessary local files into Docker build contexts.

Current behavior:

- `frontend/.dockerignore` excludes `node_modules`, `build`, and other local noise
- `backend/.dockerignore` excludes cache and environment artifacts
- rebuilds now send much smaller contexts to Docker

Important product meaning:

- deploys should avoid unnecessary work where possible
- local development artifacts should not influence container build performance

## Budget Setup Page Direction

The budget detail page was reworked away from isolated tab panes and toward a scrollable setup flow.

The top controls now act as navigation hooks to page sections rather than independent tab bodies.

Current section order:

1. Budget Info
2. Accounts
3. Income Types
4. Expense Items
5. Investments
6. Settings

Important decisions:

- `Periods` were intentionally removed from the budget detail page
- periods are managed from the main Budgets page
- settings remain visible and expanded at the bottom
- settings copy should use plain language

Approved settings description:

`Optional controls that adjust budget behaviour and page layout.`

### Rationale for setup order

The intended setup logic is:

1. create accounts first
2. then define income types
3. then define expense items
4. then define investments

This is based on the idea that accounts are foundational for later setup and linked behavior.

Additional nuance:

- use of auto/manual flags on expenditure lines still needs further development
- some account dependencies are still partially conceptual rather than fully enforced everywhere

### Return-to-top behavior

The new scrollable budget setup page includes a return-to-top button once the user scrolls down.

## Sidebar / Navigation Notes

The left navigation was explored and redesigned briefly, then intentionally rolled back.

Important decision:

- do not spend too much time polishing navigation while higher-value functional areas still need attention

What was kept:

- the simpler sidebar structure
- the app subtitle under `Dosh`

Current sidebar subtitle formatting:

- one word per line:
  - `Personal`
  - `Finance`
  - `Management`

The browser title in `frontend/public/index.html` was also updated to:

- `Dosh | Personal Finance Management`

## Naming Direction (Deferred)

There is interest in potentially renaming:

- `Budget` -> `Book`
- `Period` -> `Chapter`

Current recommendation:

- if adopted, do it first as a user-facing/frontend language change
- keep backend/API/database naming stable initially
- retain core finance terms like `budget`, `actual`, `surplus`, `income`, and `expense`

This idea is recorded as a future to-do, not an active implementation.

## Design and Suggestion Constraints For Future Sessions

Future suggestions should respect the following:

- Avoid jargon and unexplained acronyms in user-facing text.
- Prefer guided workflow over fragmented navigation when users are setting up a budget.
- Prefer transaction-backed financial explanation over opaque derived numbers wherever practical.
- Prefer concise, purposeful copy over over-explaining obvious actions.
- Use warnings and confirmations when state transitions become meaningfully final.
- Avoid introducing decorative redesigns that distract from core financial workflow.
- Keep a clear rollback path when changing app structure.
- Treat `Paid` as a meaningful finalized state, not just a cosmetic label.
- Treat revision comments as important future reporting data.
- Treat balance movement as an explainable outcome of transactions, not a freeform editable field.
- Do not guess the destination of automatic savings allocation; it should be explicit through the primary investment line.
- When changing date handling, be careful about timezone-aware versus timezone-naive values because period generation depends on exact date boundaries.
- Keep savings and investment language deliberate and consistent; avoid letting the two concepts drift interchangeably without explanation.

## Future Development Ideas And Thought Process

These are active ideas or partially formed directions that may matter in later sessions:

- Budget health metrics are now a tracked initiative. Phase 1 implementation exists today, while later close-out integration and settings-driven rule work are recorded in `BUDGET_HEALTH_ADDENDUM.md`.
- When referring to budget health in future sessions, distinguish between the broader roadmap item `Budget Health Metrics` and the currently shipped `Phase 1` implementation.

- The next major roadmap milestones should be treated as:
  - Reporting & Analysis
  - Reconciliation
  - Period Close Out
- The centralized ledger should likely become the canonical transaction reporting surface across the app, not just a backend support structure.
- Expense and investment detail views may eventually converge on the centralized transaction model instead of feeling like separate subsystems.
- Balance details could evolve into a richer audit/reconciliation experience with running totals and source filtering.
- The current `Current` vs `Historical` period grouping in the sidebar may later split future periods into their own explicit group if that becomes useful.
- End-of-period reporting should eventually include revision comments and revision reasoning.
- The current automatic surplus allocation only looks at fixed income budget and generated expense budget; future sessions may want to decide whether other budgeted inflows or allocations should participate.
- Projected savings now leans on investment allocations; future design work should decide whether that is the permanent canonical meaning or whether savings should become its own clearer first-class concept.
- Expense auto/manual flag behavior still needs deeper development and may influence later account logic.
- Revising an expense may later benefit from a reason code pick list in addition to free-text comments, especially for reporting and close-out analysis.
- Settings are expected to become a place for user-selected behavior flags and page layout preferences.
- Settings should remain visible rather than hidden, even if they stay lower priority than core setup steps.

### Roadmap Milestone Notes

#### Reporting & Analysis

This milestone should focus on making the financial story of each period and budget easier to read, compare, and trust.

Useful directions:

- promote the centralized ledger into a clearer reporting surface
- expand summaries beyond raw totals into more useful analysis
- show how budget, actual, savings, and investment performance evolve over time

#### Reconciliation

This milestone should turn transaction-backed explanation into a fuller reconciliation workflow.

Useful directions:

- richer account movement audit views
- running totals and discrepancy detection
- filtering by transaction source and type
- possible bank statement import or OCR-assisted matching if reliability is good enough

Important caution:

- OCR features should only be pursued if they improve trust and reduce manual effort without creating ambiguous financial history

#### Period Close Out

This milestone should support deliberate end-of-period review rather than leaving periods as passive records.

Useful directions:

- close-out performance metrics
- end-of-period review and sign-off flow
- commentary and reflection fields
- use of revision comments and finalized status changes in later reporting
- Navigation/sidebar polish should happen later, after core functional flows stabilize.
- Naming refinement remains a possible future branding move once workflow and structure are more settled.

## Outstanding Tasks

- Review existing future periods for any stale investment budgets produced before the corrected surplus-allocation fix.
- Consider adding validation or migration help for budgets that enable automatic surplus allocation but do not yet have an active primary investment line.
- Add a `.dockerignore` to reduce Docker build context and speed up deploys.
- Clean up the known frontend lint warnings in `Dashboard.jsx` and `PeriodDetailPage.jsx` when convenient.
- Keep refining naming so `Savings`, `Investment`, and `Primary investment line` are used consistently across setup, summaries, and period detail screens.

## Technical Notes

- Backend startup currently performs lightweight SQLite schema migrations.
- A new `revision_comment` field now exists on period expenses.
- A centralized `periodtransactions` table now exists for period-level ledger activity.
- Active-period transaction reconciliation/backfill now runs during startup migration flow.
- A host-side SQLite backup was taken before the ledger migration for recovery safety.
- A budget-level `auto_add_surplus_to_investment` flag now exists.
- Investment items now have an `is_primary` flag with single-primary enforcement at the API layer.
- Period summary data now includes cumulative projected savings.
- Period generation now normalizes incoming dates before overlap checks.
- Frontend builds currently succeed with some non-blocking lint warnings in unrelated files.
- Those warnings are not currently blocking deployment, but can be cleaned up later.

## Summary

This session pushed Dosh toward:

- clearer finalization rules for expenses
- better budget-side accounting after payment finalization
- stronger setup flow for building a budget
- period-first navigation for active budget work
- transaction-backed account movement and reconciliation
- more explainable balances through inline supporting details
- better preservation of product intent for future sessions

When making future suggestions, prioritize:

- practical budgeting workflow
- explicit state transitions
- plain language
- low-friction setup
- transaction explainability
- reconciliation-friendly financial history
- preserving the meaning of finalized financial actions
