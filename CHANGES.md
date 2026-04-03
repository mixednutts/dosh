# Changes Log

This document captures the key product and implementation changes made during recent working sessions.

It is intended to complement [README.md](/home/ubuntu/dosh/README.md), not replace it.

## Purpose

This document is the running product and implementation history for Dosh.

Its purpose is to preserve decision-making context so future sessions can understand:

- what changed
- why it changed
- what constraints or product rules now exist
- what ideas were intentionally deferred rather than forgotten

For staged budget health metrics direction, also read [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/BUDGET_HEALTH_ADDENDUM.md).

For the detailed budget-cycle lifecycle and close-out plan that informed this session's implementation, read [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/BUDGET_CYCLE_LIFECYCLE_PLAN.md).

For the current consolidated testing approach and case inventory, read [TEST_STRATEGY.md](/home/ubuntu/dosh/TEST_STRATEGY.md).

## Latest Session: Test Harness Expansion And Initial End-To-End Lifecycle Coverage

This session moved the project from “testing strategy exists” to “the repo now has a usable multi-layer regression harness”.

Important direction now in place:

- Dosh now has a dedicated testing strategy reference in [TEST_STRATEGY.md](/home/ubuntu/dosh/TEST_STRATEGY.md) plus a separate forward-looking coverage roadmap in [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/TEST_EXPANSION_PLAN.md)
- backend `pytest` coverage now exists across lifecycle, close-out, continuity-aware deletion, ledger behavior, setup scenarios, and budget health
- frontend workflow coverage now exists across setup tabs, scenario-shaped setup states, close-out gating, closed-cycle behavior, paid or revised flows, and setup-to-generation handoff
- Playwright now runs local Chromium smoke flows for:
- create-budget to incomplete-setup gating
- minimum setup and first cycle generation
- first expense transaction and linked account movement
- close-out snapshot visibility and next-cycle activation
- the testing strategy now explicitly treats named user scenarios as a long-lived concept so future work does not silently assume only `1 transaction + 1 savings`
- the strategy now treats one-off transaction backfill as migration history rather than normal product behavior that needs recurring workflow coverage
- the repo is now in a test-with-change stage rather than a “build features first, add tests later” stage
- the new delete continuity tests exposed and helped fix a real schema bug in the `PeriodInvestmentTransaction` foreign key definition

Important user-facing product fix from this session:

- the budget-cycles empty state no longer says a budget is “ready to start using” when required setup is still incomplete; it now tells the user to complete setup first, and that corrected behavior is protected by tests

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
- User-facing health and warning copy should sound calm, supportive, and practical rather than formal or clinical.
- Prefer phrasing that sounds like a helpful check-in.
  Example: `This period is currently planning to spend more than it brings in, so it would be worth taking another look.`
- Functional clarity comes before visual polish.
- Workflow-driven design is preferred over isolated screens when the user is completing a setup process.
- Metaphorical naming ideas such as `Book` and `Chapter` have appeal, but are not yet adopted.
- Existing backend/API naming should remain stable unless there is a strong reason to change it.

## Latest Session: Budget Cycle Lifecycle Foundation

This session focused on turning period management into a more explicit budget-cycle workflow.

Important user-facing direction now in place:

- the UI is increasingly using `Budget Cycle` language where it improves clarity
- the periods summary page now uses `Details` rather than `Open`
- the period column itself now links into the detail view
- cycle close-out is now treated as a first-class workflow rather than an implied end-date state

Important implementation direction now in place:

- lifecycle is now modeled explicitly with `PLANNED`, `ACTIVE`, and `CLOSED`
- `islocked` remains a separate manual budget-edit lock and should not be treated as a lifecycle substitute
- close-out is the event that freezes a cycle for ordinary workflow use
- historical health and close-out context should be preserved as point-in-time snapshot data
- `Carried Forward` is a reserved system-managed income line, not a normal reusable income type
- delete protection now prefers guided options over generic rejection when continuity is at stake

### 1. Budget cycles now have explicit persisted lifecycle state

Financial periods now carry explicit lifecycle meaning rather than relying only on date-based grouping.

Current rule:

- cycles are modeled as `PLANNED`, `ACTIVE`, or `CLOSED`
- only one cycle should be `ACTIVE` for a budget
- `CLOSED` cycles are treated as historical and read-only through normal workflow paths

Important product meaning:

- cycle state is now part of the budgeting workflow, not just a display grouping
- close-out and future activation can now be reasoned about explicitly

### 2. Close-out snapshot data now exists as a dedicated historical record

Close-out data is not stored only as loose fields on the cycle itself.

Current design:

- core lifecycle markers stay on `financialperiods`
- detailed close-out artifact data is stored in a separate one-to-one snapshot record

Snapshot direction now includes:

- comments and observations
- goals for the next cycle
- carry-forward result
- health snapshot JSON
- totals snapshot JSON

Important product meaning:

- historical close-out review should show what the user saw at close time, not whatever current calculations would produce later

### 3. Investment lines now mirror expense lifecycle behavior

Investment lines were extended to follow the same workflow model already established for expenses.

Current behavior:

- investments can be `Current`, `Paid`, or `Revised`
- paid investments are treated as finalized
- revising a paid investment requires a comment
- close-out finalizes remaining open investment lines

Important product meaning:

- users now have one mental model for finalizing outflows across both expenses and investments

### 4. Budget-side totals now treat paid investments as finalized at actual amount

This mirrors the previously established expense rule.

Current rule:

- `Current` and `Revised` investments contribute their `budgeted_amount` to budget-side totals
- `Paid` investments contribute their `actualamount`

This affects:

- period detail totals
- period surplus calculations
- budget health calculations
- close-out previews

### 5. Carry-forward now has a concrete planning representation

Closing a cycle can now populate the next cycle with a system-managed `Carried Forward` income line.

Current rule:

- `Carried Forward` is populated in `budgetamount`
- actuals for that line remain user-entered later if needed
- the line should be protected from ordinary rename or delete paths

Important design constraint:

- carry-forward recalculation and opening-balance rebasing must be kept in sync so continuity does not drift

### 6. Guided delete behavior now protects continuity

Period deletion is no longer just a yes or no validation.

Current direction:

- `CLOSED` cycles should not be deletable
- `ACTIVE` cycles may be deletable only when they have no actuals or ledger-backed activity
- when deleting a cycle in the middle of the remaining chain would create a gap, the supported guided action is `Delete this and all upcoming cycles`

Important product meaning:

- continuity matters more than preserving a one-click delete path
- regeneration after deletion is preferred over leaving ambiguous chain state behind

### 7. Manual cycle locking is now a distinct budget setting

Locking and lifecycle are now separated more clearly.

Current rule:

- locking is a user-protection feature to avoid accidental budget-structure edits
- closing is the lifecycle event that freezes a cycle historically

Current lock intent:

- lock adding new income, expense, or investment lines
- lock editing budget amounts
- do not use lock state as a substitute for close-out state

### 8. Close-out now becomes a budget-health data source

Budget health is still primarily a live computed feature, but closed cycles now preserve the health payload shown at close time.

Important implication:

- later changes to personalisation settings should not rewrite the close-out story for historical cycles

### 9. Startup schema evolution is again handling current lifecycle additions

Although a previous cleanup removed broader startup migration processes, the current state now includes targeted startup schema evolution for the new lifecycle and snapshot-related columns.

Current implication:

- the app still needs a proper versioned migration strategy
- future sessions should treat startup `ALTER TABLE` behavior as transitional, not a finished long-term design

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

### 32. Budgets page now includes a dedicated current-period health check

The Budgets page now includes a specific `Health Check for Current Period` surface alongside the broader budget health summary.

Current behavior:

- the current-period card shows a traffic-light style result
- the card has its own details modal
- the old standalone current-period count card was removed
- the current-period card includes a direct link to the active period details page

Important product decision:

- active-period issues should be visible separately from the broader health pillars
- current-period health should still reuse the same underlying health engine rather than becoming a disconnected side feature

### 33. Budget health Phase 1 now returns current-period assessment data

The health service was extended so it now returns a `current_period_check` payload alongside the main pillars and momentum data.

Current behavior:

- current-period health evaluates live-period conditions separately from setup, discipline, and planning stability
- negative `Surplus (Budget)` is now treated as a meaningful active-period signal
- the current-period payload includes evidence for surplus values, expense tolerance, revision sensitivity, and timing preference

Important design decision:

- the health engine should expand in one coherent direction rather than splitting into unrelated rule systems

### 34. Budget setup now includes Personalisation above Settings

The budget setup page was reorganized so `Personalisation` now sits above `Settings` and has its own top-page navigation tab.

### 35. Overall budget health now explicitly includes current-period health

The overall budget health score was adjusted so the dedicated current-period assessment now feeds the main summary score rather than living only as a side check.

Current behavior:

- `current_period_check` now contributes directly to `overall_score`
- the scoring version moved from `phase1-v1` to `phase1-v2`
- the overall summary copy now reflects both active-period condition and broader budget patterns

Important product meaning:

- the overall score should feel anchored in the user's live period, not only in broader setup and trend factors
- the dedicated current-period check still remains its own surface, even though it now influences the main score

### 36. Budget summary now favors live balance visibility over future-period count

The old future planned periods summary card on the Budgets page was replaced with a current balance summary card.

Current behavior:

- the card lists each active-period account shown in the current period
- each row shows the account description and closing/current balance
- the card includes a total across all displayed account balances
- duplicate supporting links were removed so the card stays summary-focused

Important product meaning:

- current balances are more useful on the main budget surface than repeating future planning counts already visible elsewhere
- the budget overview should help users orient to live money position before they drill into details

### 37. Budget summary now avoids duplicate setup entry points

The Budgets page previously exposed more than one way to edit the same budget from the same summary surface.

Current behavior:

- the standalone `Open setup` link was removed from the budget summary card
- budget editing now relies on the existing edit action instead of repeating the path in text form

Important product meaning:

- summary surfaces should avoid duplicate calls to the same destination when one clear edit affordance already exists
- fewer competing actions makes the budget card easier to scan

### 38. Sidebar navigation was redesigned around active budget context

The left-hand navigation moved away from a deep all-budgets tree and toward a focused workflow sidebar.

Current behavior:

- `Budgets` remains the single global navigation item
- a compact budget list acts as the context switcher
- active budget navigation is shown through a focused `Current Budget` panel
- the panel prioritizes period management and trimmed period shortcuts instead of exposing every nested item at once
- the old sidebar `Setup` shortcut was removed after the budget summary page became the clearer edit entry point

Important product meaning:

- navigation should privilege the budget currently in use rather than asking users to parse the entire budget hierarchy at once
- setup should not compete with period workflow unless the user intentionally chooses to edit budget configuration

### 39. Sidebar shortcut overflow is now contextual and non-misleading

The shortened period lists in the sidebar gained a more deliberate overflow treatment.

Current behavior:

- there should only ever be one `Current` period
- only `Upcoming` and `Recent` can exceed the visible shortcut limit
- hidden periods are signaled with a small `More` affordance using breadcrumb-style chevrons
- when the user is already on that budget's period listing page, the `More` affordance becomes muted non-clickable text rather than an active link

Important product meaning:

- truncated navigation should indicate continuation without pretending to navigate somewhere new when the user is already there
- route affordances that appear to do nothing should be visually downgraded rather than left looking broken

### 40. Sidebar now supports a compact collapsible desktop mode

The left navigation was adjusted to give back more horizontal space during day-to-day use.

Current behavior:

- the expanded sidebar is narrower than before
- desktop users can collapse it into a compact icon-focused mode
- the collapse control was repositioned so it no longer reads as part of the Do$h banner
- the chevron direction now matches the action being offered
- collapse state is persisted across sessions

Important product meaning:

- navigation chrome should not take more space than the active financial work requires
- collapse and expand controls need to communicate action clearly and stay visually separate from branding

### 41. Dosh visual direction now separates brand accent from success meaning

The app moved away from the earlier saturated green-heavy treatment.

Current behavior:

- muted teal is now the main brand and navigation accent
- green is reserved for positive and success meaning
- dark mode surfaces use slate and ink tones instead of dark green fills
- prominent budget, period, and navigation surfaces were retuned to follow the new palette

Important product meaning:

- one color should not carry brand, active, positive, and status semantics all at once
- separating accent from financial meaning improves clarity in both dark and light modes

### 42. Period range formatting is now fixed for consistent table scanning

The period listing page no longer relies on browser wrapping behavior to decide how the period range appears.

Current behavior:

- period ranges are rendered intentionally across two lines
- the first line ends with the dash after the start date
- the second line begins with the end date
- the layout now stays stable across zoom levels

Important product meaning:

- critical tabular labels should not change shape based on zoom or incidental wrapping
- period summaries benefit from predictable, scannable rhythm

Current behavior:

- `Settings` remains the home for budget behavior switches
- `Personalisation` is the home for health-check preference inputs
- budget owner and description editing remain in `Budget Info`

Important product decision:

- keep operational settings separate from health-preference tuning
- put the more reflective budget-health section above lower-level settings

### 35. Health personalisation is now budget-specific and persistent

Budget records now store health preference inputs that influence scoring.

Current behavior:

- personalisation inputs save automatically after change
- percentage-based controls stay on percentage scales
- preference-weight controls use a 1-10 presentation
- a `Default` marker is shown on sliders
- manual text entry is available for slider values without spinner arrows

Current stored preferences include:

- acceptable expense overrun percentage
- deficit concern percentage threshold
- maximum deficit amount
- revision sensitivity
- savings priority
- period criticality bias

Important constraint:

- autosave should stay quiet by default and only surface feedback when saving fails

### 36. Deficit concern logic now supports percentage and dollar thresholds together

The deficit-related personalisation control was clarified and extended so it can use both a percentage threshold and an optional dollar limit.

Current behavior:

- entering a dollar value such as `50` means health issues escalate once `Surplus (Budget)` moves past `-50`
- when both a percentage deficit threshold and a dollar amount are set, the lower threshold is used
- the value is persisted on the budget as `maximum_deficit_amount`

Important product meaning:

- a zero-surplus budget can still be healthy
- concern is intended to begin when the budget moves into deficit beyond the user’s acceptable threshold
- one-off income spikes should not automatically make the deficit warning unrealistically loose

### 37. Budget health wording was deliberately softened and clarified

Several rounds of wording changes were made to keep health language supportive and precise.

Current decisions:

- avoid the word `judge` in user-facing health and personalisation copy
- prefer calm, practical phrasing over formal finance language
- use `budget health concern` where plain `concern` would be too ambiguous
- when a control is really about deficit tolerance, say `deficit` rather than leaning on vague `buffer` wording

Examples of adopted direction:

- `This period is currently planning to spend more than it brings in, so it would be worth taking another look.`
- `At what point will a budget deficit start raising a budget health concern?`
- `When in the budget cycle should health issues escalate?`

### 38. Budget edit flow now routes through the setup page

The old small edit modal from the Budgets page was removed from the main budget-edit path.

Current behavior:

- the pencil/edit action on the Budgets page now takes the user to budget setup
- owner and description are edited in the `Budget Info` section instead of the old modal
- `Budget Info` now autosaves quietly rather than using save/reset buttons

Important product meaning:

- budget editing should happen in the fuller setup context rather than a disconnected mini-form
- once a budget is in use, the main edit experience should align with the broader setup workflow

## Budget Setup Page Direction

The budget detail page was reworked away from isolated tab panes and toward a scrollable setup flow.

The top controls now act as navigation hooks to page sections rather than independent tab bodies.

Current section order:

1. Budget Info
2. Accounts
3. Income Types
4. Expense Items
5. Investments
6. Personalisation
7. Settings

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
- Keep health language warm and practical, but still precise about whether the value being discussed is surplus, deficit, tolerance, or threshold.
- Prefer autosave for lightweight tuning and inline setup edits when the behavior is predictable and validation is simple.

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
- Health personalisation may later benefit from a clearer grouped explanation of how percentage and dollar deficit thresholds interact.
- The current health timing preference may later benefit from even more intuitive labels or visuals if users still find the escalation curve hard to interpret.

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
- Keep refining naming so `Savings`, `Investment`, and `Primary investment line` are used consistently across setup, summaries, and period detail screens.
- Add tests around health personalisation, current-period scoring, and the combined percentage/dollar deficit threshold behavior.
- Replace startup schema mutation for the newer budget personalisation fields with a proper migration path once migrations are introduced.

## Technical Notes

- Backend startup currently performs lightweight SQLite schema migrations.
- A new `revision_comment` field now exists on period expenses.
- A centralized `periodtransactions` table now exists for period-level ledger activity.
- Active-period transaction reconciliation/backfill now runs during startup migration flow.
- A host-side SQLite backup was taken before the ledger migration for recovery safety.
- A budget-level `auto_add_surplus_to_investment` flag now exists.
- Budget records now also include multiple health personalisation fields, including `maximum_deficit_amount`.
- Investment items now have an `is_primary` flag with single-primary enforcement at the API layer.
- Period summary data now includes cumulative projected savings.
- Period generation now normalizes incoming dates before overlap checks.
- Budget PATCH handling now uses `exclude_unset=True` so optional fields such as `maximum_deficit_amount` can be explicitly cleared.

## Summary

This session pushed Dosh toward:

- clearer finalization rules for expenses
- better budget-side accounting after payment finalization
- stronger setup flow for building a budget
- period-first navigation for active budget work
- transaction-backed account movement and reconciliation
- more explainable balances through inline supporting details
- more actionable current-period health guidance
- more user-specific health interpretation through budget personalisation
- better preservation of product intent for future sessions

When making future suggestions, prioritize:

- practical budgeting workflow
- explicit state transitions
- plain language
- low-friction setup
- transaction explainability
- reconciliation-friendly financial history
- preserving the meaning of finalized financial actions
