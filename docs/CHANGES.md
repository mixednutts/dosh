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

For staged budget health metrics direction, also read [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/plans/BUDGET_HEALTH_ADDENDUM.md).

For the detailed budget-cycle lifecycle and close-out plan that informed this session's implementation, read [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md).

For the current consolidated testing approach and case inventory, read [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md).

For the current setup-assessment and downstream-protection model introduced this session, read [SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md](/home/ubuntu/dosh/docs/plans/SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md).

For recent concrete verification outcomes, read [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md).

For the dedicated implementation plan that drove the income transaction unification and legacy-ledger cleanup work in this session, read [INCOME_TRANSACTIONS_UNIFICATION_AND_LEGACY_LEDGER_CLEANUP_PLAN.md](/home/ubuntu/dosh/docs/plans/INCOME_TRANSACTIONS_UNIFICATION_AND_LEGACY_LEDGER_CLEANUP_PLAN.md).

For the dedicated workflow plan that now owns budget-adjustment, revision-history, and setup-history rules in this area, read [BUDGET_ADJUSTMENT_REVISION_HISTORY_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_ADJUSTMENT_REVISION_HISTORY_PLAN.md).

For the implemented amount-entry plan that now defines inline arithmetic scope, preview behavior, and parser boundaries for period-detail modals, read [INLINE_EXPRESSION_AMOUNT_INPUT_PLAN.md](/home/ubuntu/dosh/docs/plans/INLINE_EXPRESSION_AMOUNT_INPUT_PLAN.md).

## Latest Session: FastAPI Sonar Cleanup, Quality-Gate Artifact Hardening, And Measure-Driven Hotspot Export

This session focused on reducing the dominant backend SonarQube router noise, making failed SonarQube workflow runs still produce usable artifacts, and then extending the artifact export so measure-driven quality-gate failures can be diagnosed from local session context instead of only from the Sonar UI.

Important direction now in place:

- the backend routers now use a shared `DbSession` dependency alias plus centralized `error_responses(...)` metadata, which materially reduces the FastAPI `Annotated` and documented-response rule clusters
- the SonarQube GitHub Actions workflow now uploads its sanitized artifact even when the scan step fails because the quality gate returns `ERROR`
- the Sonar export now records failed quality gate conditions explicitly rather than only showing issue counts
- the Sonar export now includes file-level component metrics in [sonar-component-metrics.json](/tmp/dosh-sonar-artifact/run-24018996530/sonar-summary-24018996530/sonar-component-metrics.json), including duplication and coverage on new code where available
- the export logic had to be corrected twice during the session: first to query file descendants, then to read Sonar's `new_*` metric values from `periods[0].value` rather than only top-level `value`
- the current failed quality gate example is now captured directly in the artifact and points to [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx) as the duplication hotspot driving `new_duplicated_lines_density`

### 1. Backend FastAPI router cleanup now has a reusable baseline

This session addressed the major backend SonarQube router clusters around FastAPI dependency annotations and undocumented `HTTPException` statuses.

Current behavior:

- router functions now use a shared `DbSession` alias from [api_docs.py](/home/ubuntu/dosh/backend/app/api_docs.py) instead of repeating `Session = Depends(get_db)` inline
- reusable `error_responses(...)` metadata now documents the common `404`, `405`, `409`, `422`, and `423` statuses where those endpoints can raise `HTTPException`
- the cleanup was applied across the main router set, including [periods.py](/home/ubuntu/dosh/backend/app/routers/periods.py), [budgets.py](/home/ubuntu/dosh/backend/app/routers/budgets.py), [investments.py](/home/ubuntu/dosh/backend/app/routers/investments.py), and the related transaction and setup routers

Important engineering meaning:

- future router work should continue using the shared `DbSession` and `error_responses(...)` helpers rather than reintroducing endpoint-local dependency and response boilerplate
- FastAPI response documentation should stay aligned with actual raised status codes, especially for lock, close-out, validation, and workflow-state protections

### 2. Failed Sonar quality-gate runs now preserve actionable artifacts

Before this session, a failing Sonar scan step stopped the workflow before the sanitized export could run, which made the most relevant failure context unavailable in the very runs where it was needed most.

Current behavior:

- the Sonar scan step now uses `continue-on-error: true`
- the sanitized export and artifact upload steps now run under `always()`
- the workflow still ends in failure after artifact upload when the Sonar scan or quality gate fails, preserving the red CI signal while keeping diagnostics available

Important engineering meaning:

- future Sonar-guided cleanup work can start from the exact failed run artifact rather than inferring the problem from the GitHub Actions log alone
- sessions should still remember that [fetch_latest_sonar_artifact.sh](/home/ubuntu/dosh/scripts/fetch_latest_sonar_artifact.sh) currently targets successful runs only; failed-gate runs still need manual `gh run download` unless that helper is expanded later

### 3. Measure-driven gate failures are now exported, not just issue-driven ones

The Sonar UI showed that the failed gate was being driven by duplicated lines on new code, but that information was not present in the earlier artifact because it is measure-based rather than issue-based.

Current behavior:

- the export now records `qualityGateConditions` and `failingQualityGateConditions`
- the artifact now includes [sonar-component-metrics.json](/tmp/dosh-sonar-artifact/run-24018996530/sonar-summary-24018996530/sonar-component-metrics.json) with file-level metrics for `new_coverage`, `new_duplicated_lines_density`, `new_duplicated_lines`, and related supporting values
- the current verified failed-run artifact [sonar-summary-24018996530](/tmp/dosh-sonar-artifact/run-24018996530/sonar-summary-24018996530) now reports:
- failed condition `new_duplicated_lines_density`
- actual value `3.3`
- threshold `3`
- hotspot file [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx) with `19.62264150943396%` duplicated lines on new code and `52` duplicated lines

Important engineering meaning:

- measure-driven quality gate failures such as new-code duplication and new-code coverage should now be diagnosable from the exported artifact without opening SonarCloud first
- if future metric exports look unexpectedly empty, check whether Sonar is returning the values under `periods[0].value` rather than top-level `value`, because that response shape was the root cause of the missing hotspot data in this session

### 4. The next quality target is now clearer

With the backend FastAPI router cluster materially reduced and the artifact export improved, the next cleanup direction is more grounded in current evidence.

Current behavior:

- the current failed gate is duplication on new code rather than backend router documentation
- [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx) is now explicitly identified as the duplication hotspot behind the failed gate
- the largest remaining issue cluster is still frontend `javascript:S3358` nested ternaries, with related maintainability work still concentrated in [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx) and [SetupItemHistoryModal.jsx](/home/ubuntu/dosh/frontend/src/components/SetupItemHistoryModal.jsx)

Important engineering meaning:

- future frontend cleanup should start from the now-exported duplication hotspot and the remaining concentrated frontend issue clusters rather than returning to the completed FastAPI annotation work
- the quality gate can now fail for reasons not represented in the issue list alone, so future sessions should check both `failingQualityGateConditions` and the issue clusters before choosing the next target

## Latest Session: Inline Arithmetic Amount Entry, Parser Right-Sizing, Focused Modal Coverage, And Override-Aware Redeployment

This session focused on improving amount entry across period-detail modal workflows, preserving the design decisions from the planning pass, and then correcting a deployment mistake that temporarily bypassed the repo's Traefik override wiring.

Important direction now in place:

- period-detail modal amount fields now support inline arithmetic expressions such as `1000/4+25` while keeping the raw expression visible
- valid expressions now show a muted resolved preview, while incomplete arithmetic input such as `100+` shows an in-progress summary line instead of an immediate error
- the implementation intentionally stays narrow and finance-oriented: only digits, decimals, whitespace, parentheses, and `+ - * /` are supported
- the parser choice was refined during the session from a deprecated parser package, through `mathjs`, and finally to a smaller `jsep`-based parser plus a tiny arithmetic-only evaluator
- focused regression coverage now protects both the shared amount-expression input and the affected period-detail modal flows
- a first deployment pass used only the base compose file, which worked locally on port `3080` but bypassed the Traefik-facing override configuration; the stack was then redeployed correctly with both compose files
- Vite still reports a slightly oversized main frontend chunk after the feature work, and route-level lazy loading in [App.jsx](/home/ubuntu/dosh/frontend/src/App.jsx) is now the recorded follow-up direction

### 1. Period-detail modals now support inline arithmetic amount entry

The user-facing change in this session was a workflow refinement rather than a new domain model.

Current behavior:

- transaction, budget-adjustment, add-income, and add-expense modals on the period-detail page now accept inline arithmetic expressions for amount entry
- valid calculations show a muted preview line such as `= $275.00`
- plain numeric literals still behave like ordinary amount entry and do not show the extra preview line
- incomplete arithmetic input now stays gentle while typing by showing an in-progress summary instead of flashing a hard validation error
- backend APIs remain unchanged because the frontend resolves the final numeric value before submit

Important product meaning:

- amount-entry help should remain practical and low-friction rather than introducing a calculator-heavy or accounting-heavy interaction model
- incomplete arithmetic input should be treated as in-progress user work, not as an immediate correctness failure

### 2. The final parser choice is intentionally small and narrow

The session explicitly explored parser size and package health rather than stopping at the first working dependency.

Current behavior:

- the final implementation uses `jsep` plus a custom arithmetic-only AST evaluator
- deprecated or heavier intermediate parser choices were intentionally replaced before wrap-up
- supported syntax remains intentionally smaller than full mathematical or JavaScript-like expressions

Important engineering meaning:

- future expression-input work should preserve the narrow allowed syntax unless a broader product decision is made deliberately
- if setup-tab amount inputs later adopt the same component, they should reuse the same parser boundary instead of reintroducing richer evaluation features ad hoc

### 3. Deployment needed an override-aware correction

The first deployment pass surfaced an operational detail that future sessions should not have to rediscover.

Current behavior:

- the repo uses [docker-compose.override.yml](/home/ubuntu/dosh/docker-compose.override.yml) to add the external `frontend` network and Traefik labels for the frontend service
- deploying with only the base compose file recreated the stack without that override wiring
- local access through `localhost:3080` still worked, but the public host path would not route correctly through Traefik in that state
- the stack was then redeployed with both compose files, restoring the external network attachment and router labels

Important engineering meaning:

- future public-facing deployments in this repo should include both compose files rather than relying on the base file alone
- local success on port `3080` is not enough to prove the Traefik-facing deployment shape is intact

## Latest Session: SonarQube Root-Cluster Cleanup, Frontend Props Validation Baseline, Documentation Alignment, And Deployment Verification

This session focused on understanding the latest SonarQube analysis state, fixing the dominant root cluster rather than isolated findings, and then aligning the project handoff, history, activity, and testing documents to that new baseline.

Important direction now in place:

- the latest successful SonarQube artifact is now a practical session-starting input for quality cleanup work rather than a hidden CI-only detail
- the dominant frontend SonarQube cluster was `javascript:S6774` missing props validation, and that cluster has now been addressed across shared components, setup tabs, and the highest-traffic budget pages
- the frontend now carries an explicit `prop-types` dependency and component-level prop contracts instead of relying on implicit props shape assumptions
- the full frontend Jest suite passed after the props-validation cleanup, and the stack was rebuilt and redeployed successfully through Docker Compose
- the frontend production build still completes successfully, but Vite now reports a large main production chunk, which should be treated as follow-up quality work rather than a deployment blocker

### 1. SonarQube triage now has a clearer practical entry point

This session began by tracing the current handoff path from README through the project context, roadmap, history, and testing docs, then grounding the quality work in the latest exported SonarQube artifact rather than working from stale assumptions.

Current behavior:

- the repo includes a SonarQube workflow, scanner configuration, and a fetch script for the latest sanitized artifact
- the latest successful artifact was pulled locally and used to identify the highest-leverage rule and file clusters before making changes
- future sessions can continue using the exported summary and issue JSON as the first pass for Sonar-guided cleanup

Important engineering meaning:

- future quality cleanup should continue to target concentrated rule clusters rather than scattering effort across unrelated low-volume findings
- the latest SonarQube artifact is now part of the practical operational toolset for Dosh quality work

### 2. The frontend now has an explicit props-validation baseline

The largest open SonarQube cluster was missing props validation across React components.

Current behavior:

- `prop-types` is now installed in the frontend dependency tree
- shared components, setup tabs, and high-traffic page components now define explicit `propTypes`
- the props-validation pass covered the main files where the cluster was concentrated, including layout, budget overview, budget cycles, period detail, setup history, dashboard, and setup tabs

Important product meaning:

- future sessions should preserve explicit prop contracts when new presentational or page-level components are added
- SonarQube-driven frontend cleanup should now move on to the next concentrated rules rather than revisiting missing props validation as a recurring baseline issue

### 3. Verification and deployment both passed after the cleanup

This session did not stop at static code cleanup; it also verified and deployed the result.

Current behavior:

- the full frontend Jest suite passed after adding the prop contracts
- backend and frontend images rebuilt successfully through Docker Compose
- the live health endpoint continued returning `{"status":"ok","app":"Dosh"}`
- the frontend production build completed successfully, though Vite reported a large production chunk warning

Important engineering meaning:

- the props-validation cleanup is now reflected in the deployed stack rather than existing only as an unverified local change
- bundle-size follow-up is useful future quality work, but it is not currently blocking deployment or basic runtime health

## Latest Session: Setup-Revision History Expansion, Revision-Number Alignment, Live Schema Recovery, And Income-Table Alignment Repair

This session focused on making setup-item history trustworthy, aligning revision numbering to real stored history records, recovering the live setup pages after a schema mismatch, and correcting follow-on UI regressions introduced during that work.

Important direction now in place:

- setup-item history no longer relies only on `BUDGETADJ` entries; direct setup edits now create dedicated setup-revision history records with field-level before or after detail
- setup-item `revisionnum` is now intended to reflect actual stored revision history, not unsupported legacy increments with no backing history record
- future-scope budget adjustments that update setup now carry a linked revision number, while current-only budget adjustments remain ordinary period-level planning changes rather than setup revisions
- the setup history modal now restores visibility of the current setup-line summary alongside revision and adjustment history instead of replacing setup context with history-only content
- the live deployment exposed another schema-alignment gap, this time for `periodtransactions.revisionnum` and the new `setuprevisionevents` table, and the live SQLite database was patched in place so the budget setup pages could load again
- the income section action rail on the budget-cycle detail page now uses a fixed four-slot layout so rows with and without delete affordances keep the numeric columns aligned

### 1. Setup-item revision history now preserves actual setup changes

The prior history modal showed only budget-adjustment transactions, which made revision numbers difficult to trust when the underlying change was a setup-field edit such as scheduling, amount, or account linkage.

Current behavior:

- direct setup edits for income, expense, and investment items now write a dedicated setup-revision history event
- setup-revision history captures changed fields only, with field-level before and after payloads
- budget setup history endpoints now merge setup-revision events with `BUDGETADJ` history into one ordered history surface
- the modal now shows a `Current Setup` summary block above the combined revision and adjustment timeline

Important product meaning:

- future sessions should treat setup revision history as a first-class product concept rather than as a side effect of period-level transactions
- setup history should continue to answer both questions clearly:
- what is this line configured as right now?
- what changed over time and why?

### 2. Revision numbers now map to stored history instead of unsupported increments

The old revision number could drift away from the real recorded history because some increments had no stored history record to support them.

Current behavior:

- direct setup edits allocate the next supported revision number and create a matching setup-revision event
- future-scope budget adjustments that change setup allocate the next supported revision number and stamp it onto the related `BUDGETADJ` rows
- current-only budget adjustments do not create a setup revision number because they do not change setup
- setup-item reads and setup-history reads now rebase stale stored `revisionnum` values back to the highest revision number that is actually backed by stored history

Important engineering meaning:

- later work should not reintroduce revision increments that are not backed by either a setup-revision event or a setup-affecting `BUDGETADJ`
- if new setup-affecting workflows are introduced, they should participate in this shared revision sequence deliberately

### 3. Live recovery required another explicit schema patch

After deployment, the budget setup page appeared to lose line data, but the underlying issue was that the new code expected schema elements the live SQLite database did not yet have.

Current behavior:

- setup list endpoints initially failed with `500` because `periodtransactions.revisionnum` did not exist in the live database
- the setup pages also required the new `setuprevisionevents` table to exist for the merged history path
- the live SQLite database was backed up and then patched in place to add the missing column and table
- once patched, the budget setup sections resumed returning income, expense, and investment line data correctly

Important engineering meaning:

- schema evolution is still a live operational risk until Dosh has real versioned migrations
- future sessions should verify live schema compatibility before assuming a UI regression means the underlying setup data has disappeared

### 4. UI follow-up fixes restored setup context and stabilized row alignment

The session did not stop at the backend history model; it also corrected two follow-on frontend regressions.

Current behavior:

- the setup history modal now shows the current setup-line details again instead of history alone
- the income table in the period-detail page now uses a fixed action-slot layout so rows with or without delete affordances no longer shift the visual alignment of the numeric columns

Important product meaning:

- history improvements should not hide the current setup meaning users still need in order to interpret that history
- action affordance availability should not change the visual alignment of financial columns in review-heavy tables

## Latest Session: Income-Modal Remediation, Period-Detail Budget-Affordance Refinement, Empty-State Budget Delete, Documentation Alignment, And Deployment Verification

This session focused on finishing and correcting a few active workflow and UI items rather than introducing a new large feature slice.

Important direction now in place:

- the add-income-from-period modal now correctly supports creating a brand-new income line inline, including linked-account selection, matching the intended expense-side workflow more closely
- the period-detail page now uses icon-based budget edit affordances in the budget column for income, expense, and investment rows rather than mixing budget editing into the transaction action rail
- income row action grouping was tightened so budget editing stays attached to the budget amount while transaction and remove actions remain in their own rail
- the `No budget cycles yet` state on the budget cycles page now includes a direct `Delete Budget` action for abandoned or exploratory budgets
- the related development activities for these items were confirmed complete and the project handoff, history, and test-result documents were aligned to the live state

### 1. Add-income inline creation now matches the intended supported workflow

The session began by correcting a mismatch between the recorded product state and the actual current UI behavior.

Current behavior:

- the `Add New Income Item` modal now loads account choices when creating a brand-new income line
- new inline-created income lines can now capture linked-account selection before being added to the current cycle
- the modal pending state now covers both setup-item creation and adding the line to the cycle

Important product meaning:

- future sessions should treat inline creation of a new income line from the period-detail flow as supported current behavior rather than an unfinished idea
- the income-side workflow should stay aligned with the supported expense-side creation path where that improves predictability

### 2. Budget editing now lives visually with budget values instead of the transaction rail

The initial icon-based edit pass solved the wording problem but placed the edit affordance in the wrong visual group.

Current behavior:

- income, expense, and investment rows now show their budget edit affordance in the budget column beside the budget amount
- budget values still read as a consistent right-aligned numeric column
- transaction add, correction, view, status, and remove controls remain grouped in their own action area

Important product meaning:

- budget editing should read as a change to the plan, not as just another transaction action
- future UI refinements in these tables should preserve the visual separation between plan-editing controls and transaction-entry controls

### 3. Empty-state budget management now supports direct cleanup

The budget cycles page now gives users a cleaner way to discard a budget that never progressed into generated cycles.

Current behavior:

- the `No budget cycles yet` card now includes a `Delete Budget` action with confirmation
- successful deletion routes the user back to the budgets list

Important product meaning:

- empty states should support the realistic cleanup path for exploratory or abandoned budgets rather than forcing users through unrelated screens

## Latest Session: Budget Adjustment History, Revision-Workflow Simplification, Setup History Review, Close-Out Carry-Forward Fix, And Live Schema Alignment

This session focused on turning budget-line changes into first-class revision history, simplifying the paid-to-revised workflow, and tightening the current-period meaning that budget health derives from those events.

Important direction now in place:

- income, expense, and investment budget changes now use a shared modal-driven workflow and are recorded as explicit `BUDGETADJ` entries in `PeriodTransaction`
- `BUDGETADJ` entries are intentionally part of the shared history model, but they are excluded from actual calculations, balance movement, and investment closing-value movement
- setup-level history for income, expense, and investment items now reuses the same underlying transaction history model rather than introducing a second history store
- direct `Paid` to `Revised` reopening is now allowed without a dedicated revision-reason modal
- planning-change context now comes from event history and transaction line-state capture rather than duplicated revision-comment prompts
- carry-forward creation is now tied to prior-cycle close-out, not to simple future-cycle generation
- the deployed database was manually aligned to the new schema expectations after deployment exposed the schema gap

### 1. Budget adjustments are now first-class history events

Budget changes across income, expense, and investment lines were moved onto one shared model.

Current behavior:

- budget edits now open an `Edit Line Budget` modal rather than relying on mixed inline patterns
- the modal captures the target amount, scope, and a required note
- supported scope is either current period only or current plus future unlocked periods
- the underlying history is stored in `PeriodTransaction` using explicit `BUDGETADJ` rows
- line-item setup history can now be reviewed from budget setup using the same transaction-backed history source

Important engineering meaning:

- future history or reporting work should extend the shared transaction history model rather than creating a parallel note store for budget adjustments
- any calculation that represents real movement, actuals, or closing-value change must continue to exclude `BUDGETADJ`

### 2. Revision workflow and planning-stability interpretation were simplified together

This session removed unnecessary duplication between state-change prompts and actual history capture.

Current behavior:

- expense and investment lines can now move directly from `Paid` to `Revised`
- the old revision-reason requirement was removed from the supported workflow
- transaction history now stores the current line state on relevant rows so later interpretation does not depend on free-text comments
- planning stability in budget health now reads as off-plan activity rather than revision-comment capture

Important product meaning:

- `Paid` and `Revised` still matter as workflow signals that a line is finished or has been reopened
- explanatory context should stay attached to the event that changed the plan or recorded the actual, not be duplicated in a separate mandatory modal

### 3. Carry-forward timing and delete continuity were tightened

The session also corrected lifecycle behavior that had drifted from the intended close-out model.

Current behavior:

- `Carried Forward` is no longer created just because a future cycle exists
- carry-forward is now created only when the previous cycle is actually closed out
- delete continuity logic now ignores `BUDGETADJ` planning history so upcoming cycle deletion does not get blocked by non-movement history rows

Important domain meaning:

- close-out remains the event that freezes one cycle and establishes the next cycle's opening state
- planning history should stay reviewable without being mistaken for financial movement or continuity-breaking activity

### 4. Live deployment required explicit schema alignment

The implementation introduced new schema expectations and the deployment path surfaced that mismatch clearly.

Current behavior:

- the app was deployed with the new budget-adjustment and transaction-line-state code
- the live SQLite database then required a manual schema patch so the deployed code and live schema matched
- older stored `revision_comment` values on expense and investment rows were cleaned up after the workflow simplification

Important engineering meaning:

- there was no old pending migration backlog behind this work; the schema drift was created by this new implementation
- Dosh still needs a proper versioned migration path, but the current deployed database is now aligned to the post-session schema expectations

## Latest Session: Budget Overview Calendar Expansion, Interaction Polish, Demo-Data Follow-Up, And Deployment Verification

This session focused on replacing the old historical-count summary on the Budgets page with a practical calendar view, then tightening the interaction model and compactness through repeated review-driven refinement.

Important direction now in place:

- the Budgets page now uses a calendar-style summary card in place of the historical `# periods` stat
- the calendar reflects month-view timing with previous and next navigation, a compact inline summary, and a larger modal review surface
- calendar behavior is intentionally bounded to the current month plus the next 2 months so active and upcoming cycle timing remains visible without unbounded future expansion
- budgeted income is currently anchored to cycle start because the product assumption for now is that users generally align their budget cycle with when income is received
- the start of a budget cycle is now represented as its own event and visual marker rather than being implied only through income timing
- clicking a day with events now opens a day-detail modal, and hover or title affordances stay aligned with the same event model
- the demo-data roadmap now explicitly calls for more varied expense types and recurrence patterns so calendar walkthroughs stay realistic

### 1. The budget overview now has a dedicated calendar surface

The old historical-count summary card on the Budgets page was replaced with a calendar-oriented summary.

Current behavior:

- the budget overview shows a compact month grid rather than a simple historical count
- the inline card stays intentionally dense and compact rather than growing into a large dashboard panel
- the richer review surface lives in a full-calendar modal opened from the card header
- the modal title now uses the budget name directly

Important product meaning:

- the budget summary page now answers timing questions more directly, especially around income arrival and due-date clustering
- the inline card should remain useful as a glanceable timing surface rather than competing with full reporting views

### 2. Calendar events now use one shared interaction model

This session moved the calendar away from passive decoration and into a reusable event-based view.

Current behavior:

- income, expenses, and budget-cycle start are all represented as calendar events
- compact cells use indicator-level density rather than stacking repeated event blocks
- days with events are clickable and open a day-detail modal
- hover and title text use the same underlying event information as the day-detail modal

Important engineering meaning:

- future calendar enhancements should continue to extend the shared event model rather than adding one-off cell decorations that bypass day-detail behavior
- the cycle-start marker is now part of the product language and should not be removed casually

### 3. Future visibility is intentionally bounded

The calendar now reaches beyond the active cycle, but only within an explicit limit.

Current behavior:

- the calendar includes relevant active and planned periods that intersect the current month plus the next 2 months
- event generation is intentionally bounded to avoid performance drift from scanning too far ahead
- current and upcoming periods share the same frontend rendering path and detail fetch boundary

Important engineering meaning:

- future work should preserve the explicit lookahead boundary unless the event-generation model is deliberately redesigned
- the current implementation should be treated as an internal feature slice, not as a separate reusable package yet

### 4. Test and deployment flow were extended together with the UI

This session repeatedly paired calendar refinements with focused frontend verification and redeployment.

Current behavior:

- Budgets page tests now cover compact calendar rendering, full-calendar interaction, bounded lookahead, day-event modal behavior, and cycle-start markers
- the earlier demo-budget navigation warning in the Budgets page test was removed cleanly by asserting navigation directly
- Docker Compose rebuild and health verification were used repeatedly during the review cycle, and the latest deployed state includes the calendar refinements

## Latest Session: Period-Detail Polish, Sidebar Navigation Refinement, Navigation Regression Coverage, And Repeated Deployment Verification

This session focused on tightening the budget-cycle and period-detail workflow surfaces after user testing, then locking the resulting navigation behavior into frontend tests.

Important direction now in place:

- the period detail page now has complete footer totals for income, investments, and balances where totals are meaningful, while still avoiding a misleading aggregate movement total for balances
- investment status affordances now follow the same `spent` pill behavior as expenses, including revised-state handling and status wording alignment
- the sidebar now treats the active budget workspace as a distinct context surface rather than coupling it entirely to the expanded budget list
- the current budget panel uses `Current`, `Upcoming`, and `Historical` cycle shortcuts, with explicit deep links when more cycles exist than the compact sidebar preview shows
- the budget cycles page now remembers the `Upcoming` section collapse state for the browser session and responds more cleanly to section hash navigation
- the current frontend Jest suite now includes a dedicated layout-navigation regression test that captures the current sidebar baseline rather than leaving those rules implicit

### 1. Period-detail totals and status affordances were tightened without weakening ledger meaning

The period detail page received a focused polish pass driven by concrete review findings.

Current behavior:

- the `Total Income` footer row now matches the full table shape and no longer leaves a trailing visual artifact
- investments now show a footer total for budget, actual, and remaining
- balances now show footer totals for opening and closing values while intentionally omitting a meaningless movement total
- investment status pills now behave consistently with expense status pills, including clearer revise and paid affordances
- investment and balance tables now use the same horizontal overflow treatment as expenses on narrower layouts

Important product meaning:

- period totals should help users read section-level meaning quickly without implying false precision where totals are not meaningful
- movement remains transaction-derived and explainable rather than something the UI should summarize as if it were an independently managed editable field

### 2. Sidebar navigation now reflects the active budget context more deliberately

Several sidebar adjustments were made to reduce ambiguity about where the user is working and what the next available actions are.

Current behavior:

- the `Budget List` and `Current Budget` areas now render as separate sidebar concepts, with the list above the current budget panel
- compact desktop sidebar mode still preserves a minimal active-budget context rather than dropping budget context entirely
- the current budget panel now uses `Historical` rather than the old `Recent` label so sidebar and budget-cycle page grouping language stay aligned
- when more cycles exist than the sidebar preview shows, the user now sees explicit `View all ...` links rather than a vague `More` affordance
- on the budget cycles page, the sidebar no longer duplicates setup entry as a separate card; the page-level setup action is the intended route from the `No budget cycles yet` state
- the dark-mode sidebar palette was tuned back toward the deeper original appearance after an initial light/dark styling pass made it appear too grey in dark mode

Important product meaning:

- sidebar navigation should stay centered on the currently active budget workflow without duplicating too many competing entry points
- compact navigation can be reduced, but it should not become contextless
- empty-state actions should remain intentional and not multiply setup paths unnecessarily

### 3. Navigation behavior is now part of the frontend regression baseline

This session did not stop at UI tweaks; it also added focused regression protection.

Current behavior:

- the frontend now includes a dedicated layout-navigation test covering sidebar hierarchy, current-budget behavior, and explicit cycle deep-link affordances
- budget-cycle tests already covered historical collapse persistence, and the session also preserved `Upcoming` collapse behavior through the current implementation on the page itself
- focused period-detail tests were extended to protect the footer-total and spent-pill fixes

Important engineering meaning:

- sidebar behavior should now be treated as a tested workflow baseline, not a purely visual detail that future sessions can accidentally reshape without noticing
- the current navigation tests intentionally reflect live behavior rather than an idealized future state, so later UX changes should update tests deliberately

## Latest Session: Demo Budget Seeding, Shared Dev-Mode Gating, Budget-Health-Focused Demo Activity, And Compose-Based Deployment Control

This session focused on making demos faster to stand up without weakening normal production behavior or distorting current product rules.

Important direction now in place:

- the budget-create modal can now expose a dev-only `Create Demo Budget` action
- demo-budget creation is now controlled by one shared Compose-level `DEV_MODE` setting across frontend and backend rather than a checked-in frontend `.env`
- the frontend uses the shared flag only to reveal the control, while the backend separately enforces the same flag before allowing `/api/budgets/demo`
- demo import creates a new seeded budget and related records only; it does not overwrite or delete existing budgets
- the seeded demo now includes historical close-outs, a live current cycle, upcoming cycles, linked savings and investment setup, and activity shaped to influence budget health rather than merely populate records
- current docs and testing records now treat the demo-budget path as a real, documented development workflow rather than a hidden local shortcut

### 1. Demo budgets are now a deliberate development workflow, not an ad hoc manual setup shortcut

The product now has a dedicated demo-budget creation path for development and stakeholder walkthroughs.

Current behavior:

- the create-budget modal can show `Create Demo Budget` when dev mode is enabled
- the action creates a complete standard household-style budget with transaction account, savings account, income, expenses, and a primary investment line linked to savings
- the seed includes closed cycles with stored close-out comments and goals, one active cycle, and several planned upcoming cycles
- the user lands on the seeded budget after creation so the cycle state and current summary surfaces are immediately visible

Important product meaning:

- demo setup should now be treated as a first-class development affordance rather than something future sessions need to rebuild manually each time
- demo data should continue to follow real domain rules rather than introducing fake shortcuts that bypass lifecycle, carry-forward, or ledger behavior

### 2. Demo-mode gating is now shared between frontend and backend

This session intentionally avoided a frontend-only hide-or-show treatment for demo controls.

Current behavior:

- Docker Compose now provides the controlling `DEV_MODE` value
- the frontend build uses that value to decide whether the modal should show the demo-budget control
- the backend checks the same runtime flag and returns `404` for the demo route when dev mode is off
- omitting `DEV_MODE` defaults both sides to a false state

Important engineering meaning:

- hiding the control in the UI alone is not considered sufficient protection for dev-only workflows
- Vite-based frontend behavior is still compile-time, so changing the frontend side of the flag requires an image rebuild
- the backend side remains runtime-checked and should stay aligned with the same single Compose-level source of truth

### 3. Demo seed activity now intentionally affects budget health output

The first demo seed implementation populated data shape, but it did not yet create especially meaningful health signals.

Current behavior:

- historical demo cycles now show a more believable discipline pattern across rougher and steadier completed periods
- the active cycle includes real pressure signals such as revised expense state, over-budget actuals, paid-over-budget lines, and negative actual surplus
- the seeded demo budget now produces visible health evidence and non-trivial planning-stability output

Important product meaning:

- demo budgets should help explain the value of budget health rather than leaving health surfaces looking empty or artificially perfect
- future demo data changes should preserve explainable evidence rather than optimizing only for visual completeness

### 4. Demo import is additive only

This was explicitly checked because dev-only import features can become risky if they behave like reset tools.

Current behavior:

- importing demo data creates a new budget and child records tied to that new `budgetid`
- the demo import path does not delete existing budgets
- the demo import path does not overwrite existing budgets
- repeated use creates additional demo budgets rather than mutating prior ones

Important engineering meaning:

- future work should preserve this additive-only behavior unless a separate, explicitly named reset or cleanup workflow is introduced
- demo import should not quietly become a destructive environment management tool

## Latest Session: Income Transactions Unification, Unified Ledger Cleanup, Frontend Toolchain Modernisation, And Deployment Hardening

This session focused on removing remaining inconsistency in actual-entry workflows, tightening ledger trust, and cleaning up the frontend delivery baseline.

Important direction now in place:

- income actuals on the period detail page now use a dedicated transaction-history workflow rather than inline set or add controls
- `ACTIVE` locked cycles now still allow actual-entry and transaction recording, while structural edits remain protected
- the unified `periodtransactions` ledger is now the sole live transaction store; obsolete expense and investment transaction tables and bridge code have been removed
- backend startup no longer mutates schema during app boot through targeted `ALTER TABLE` checks
- the repository now has an explicit database cutover script and the local SQLite database was backed up before the schema cleanup was applied
- the frontend has moved from Create React App to Vite while keeping Jest and Playwright coverage working
- the frontend Docker build now uses Node 20, and `npm audit` is clean at zero reported vulnerabilities
- stale CRA artifacts such as the old `public/index.html`, `src/index.js`, and legacy `build/` output were removed

### 1. Income actuals now follow the same transaction-first model as expenses and investments

The period detail income section no longer uses direct inline actual overrides.

Current behavior:

- income rows open a dedicated transaction modal
- users record actual income through add, correction, and delete transaction flows
- `Add New Income Line Item` remains a separate structural setup-style action for new budgeted lines
- standard income, transfer-backed income, and `Carried Forward` now all live under one consistent transaction-entry pattern, while keeping their domain-specific rules

Important product meaning:

- actuals are now entered more consistently across income, expenses, and investments
- the page distinguishes more clearly between structural planning actions and real transaction recording
- direct actual-edit shortcuts should not be reintroduced unless there is a deliberate ledger-model decision to do so

### 2. Locked-cycle meaning was clarified and protected by tests

This session surfaced a regression where locking a cycle also blocked actual recording.

Current rule:

- `CLOSED` cycles block normal workflow writes
- `ACTIVE` plus `islocked=true` blocks structural edits only
- actuals and transactions must still be recordable on locked active cycles

Important engineering meaning:

- lock behavior is now explicitly part of the test boundary, not just an assumed UI detail
- future work should treat lifecycle state and manual structure protection as separate concerns

### 3. The unified ledger is now the only live transaction store

The application had already been functionally centered on `PeriodTransaction`, but older expense and investment transaction tables still existed as legacy persistence artifacts.

Current behavior:

- dedicated expense, investment, and income transaction routes now all write to the same live ledger table
- obsolete legacy transaction tables and related bridge logic have been removed from the active model
- startup no longer performs schema mutation on app boot
- one explicit cutover script now defines the current schema transition path, with database backup required before schema-level changes

Important product meaning:

- Dosh should now be treated as a ledger-centered workflow app rather than a mixed ledger-plus-legacy-children design
- real versioned migrations are still needed, but the active baseline is cleaner and easier to reason about

### 4. Frontend delivery and dependency posture were modernized

The old CRA-based frontend stack was carrying security findings and an aging Docker baseline.

Current behavior:

- frontend build and dev now run through Vite
- frontend tests still run through Jest and React Testing Library
- Playwright continues to cover the main smoke workflows
- the frontend Docker image now builds with Node 20 instead of Node 16
- `npm audit` now reports zero vulnerabilities for the frontend package tree

Important engineering meaning:

- future frontend work should assume Vite entrypoints and config rather than CRA conventions
- stale CRA artifacts should not be restored
- deprecation warnings during install are not currently security blockers, but should still be reviewed over time

## Latest Session: Setup UX Refinement, Account Naming Localisation Seed, And Period Summary Expansion

This session focused on tightening workflow wording, reducing repeated navigation noise, and introducing the first low-risk localisation-style display preference.

Important direction now in place:

- the old account type label `Bank` has been replaced by `Transaction` in the product, with existing data updated to match
- Dosh now supports a budget-level display preference for transaction-style account naming: `Transaction`, `Everyday`, or `Checking`
- the internal account type model still stays stable even when the user-facing terminology changes
- the budget setup page now uses in-card headers more consistently, keeps `Personalisation` and `Settings` collapsed by default, and remembers their state for the browser session
- the budget cycles list now uses `Upcoming` instead of `Future`, and the historical section remembers its collapse state for the session
- the period detail page now surfaces both `Projected Savings` and `Remaining Expenses` in the top summary card set
- several navigation and sidebar refinements were made to reduce duplicate information and improve visual grouping without changing the underlying route structure

### 1. Account naming localisation now exists as a safe display-layer preference

The product now supports regional naming variation for the main spending-account concept without changing the stored data model.

Current behavior:

- `Transaction` is now the canonical user-facing base label instead of `Bank`
- budgets can choose `Transaction`, `Everyday`, or `Checking` as the preferred display label
- the preference is used in account-related setup and helper copy while the stored account type remains `Transaction`

Important product meaning:

- Dosh can now adapt familiar terminology for different user expectations without fragmenting financial behavior or schema meaning
- future terminology preferences should follow this pattern when they are primarily presentation concerns

### 2. Budget setup guidance and section structure were made more direct

The setup page now communicates generation readiness and optional sections more cleanly.

Current behavior:

- setup-assessment blocking copy now explicitly states what information is needed before generation can proceed
- blocking issues are shown in the same order as the setup sections themselves
- the assessment card now links directly to the budget cycles page when setup is ready
- the redundant helper card about managing budget cycles from the separate page was removed
- section descriptions now live inside the card header area rather than above the card
- `Personalisation` and `Settings` start collapsed, persist their expand or collapse state for the browser session, and now use the same chevron-first affordance pattern as the period listing page

Important product meaning:

- the setup page now behaves more like a guided workflow surface and less like a collection of unrelated cards
- optional sections can stay out of the way until the user wants them, without forgetting the user’s session-level preference

### 3. Budget cycle wording and summary affordances were tightened

The periods flow now uses slightly cleaner, more consistent wording and persistence behavior.

Current behavior:

- `Future` is now `Upcoming` in the grouped budget-cycle listing and related summary wording
- the historical budget-cycle section now remembers whether it was expanded or collapsed for the duration of the browser session
- the sidebar and navigation surfaces were adjusted to reduce duplicate budget-detail repetition and to keep navigation hierarchy easier to scan

Important product meaning:

- session-level expand or collapse preferences are now an accepted lightweight interaction pattern for non-critical optional sections
- `Upcoming` is now the preferred grouping term in the periods listing where it reads more naturally than `Future`

### 4. Period detail summary cards now provide a fuller money snapshot

The top summary area on the period detail page now exposes more of the live budget picture at a glance.

Current behavior:

- `Projected Savings` now appears with the surplus summary cards
- `Remaining Expenses` now appears in the top summary grid
- the top summary area is now an 8-card grid rather than split into separate rows with mismatched card counts

Important product meaning:

- the period-detail page is moving toward a more practical “how is this period tracking?” summary before the detailed line items

### 5. A few UX ideas were intentionally deferred

These were discussed but not implemented in this session.

Deferred ideas:

- a user-facing terminology preference for `Budget Cycle` vs alternatives such as `Period`
- drag-and-drop ordering of the period-detail summary cards

Current guidance:

- the period-naming preference should stay deferred until it is clearly worth introducing another terminology preference
- draggable summary-card ordering remains a credible enhancement, but should wait until the card set feels stable enough to customize

## Latest Session: Setup Assessment Hardening, Backend Harness Isolation, And Deployment Verification

This session moved Dosh from loosely inferred setup-readiness rules into a centralized setup-assessment model with downstream protection.

Important direction now in place:

- Dosh now has a centralized setup assessment endpoint and shared readiness model rather than relying on scattered page-level assumptions
- budget-cycle generation is now intentionally blocked when expense-driven setup exists but no active primary account is configured
- setup records now become protected when generated cycles or downstream activity already depend on them
- the budget setup page now surfaces blocking issues, warnings, and section-level assessment badges
- setup tabs now show in-use or protected state for accounts, income types, expense items, and investment lines
- backend tests now use an isolated SQLite database per test case, which removes the order-dependent contamination that appeared when multiple functional areas were exercised in one session
- the repository now has a recorded deployment baseline using Docker Compose from the current working tree

### 1. Setup assessment is now a first-class contract

The product no longer relies on a mix of setup-page guidance and downstream failure discovery alone.

Current direction:

- setup remains editable
- generation and other downstream workflows consult one centralized setup assessment
- the assessment returns blocking issues, warnings, and protected setup state

Important product meaning:

- Dosh is not trying to allow every technically possible setup shape
- Dosh is now deliberately protecting only the setup shapes that remain safe for downstream financial workflows

### 2. Primary-account readiness is now treated as structural setup, not just guidance

The specific gap that triggered this work was a budget where accounts existed but none was marked primary.

Current rule:

- if expense-driven behavior is configured, one active account must be designated as the primary account before budget cycles can be generated
- expense-driven downstream activity also fails clearly if setup later drifts into a no-primary state

Important meaning:

- the system no longer silently assumes setup will conform to an older personal-use account model
- it still does not try to support unsafe combinations that would break later workflows

### 3. In-use setup sections now become protected

Protection is now applied consistently across the relevant setup sections.

Current behavior:

- accounts in downstream use are protected from delete, deactivate, or unsafe structural edits
- income types in downstream use are protected from destructive edits and deletion
- expense items in downstream use are protected from delete and deactivation while preserving revision-style changes
- investment lines in downstream use are protected from destructive edits and deletion

Important product meaning:

- setup is no longer treated as disposable configuration once real budget cycles or transactions depend on it
- users should be guided toward safe continuity rather than allowed to break the shape behind historical or active cycles

### 4. Budget setup now shows assessment state directly

Assessment state is now surfaced on the setup page itself, not only on the budget-cycle generation page.

Current behavior:

- setup summary card shows whether the budget is ready for generation
- blocking issues and warnings are shown explicitly
- accounts, income types, expense items, and investments now show section-level status such as `Needs Attention`, `Ready`, or `Protected`

Important product meaning:

- users can assess setup quality before trying to generate a cycle
- protection state is now visible where the underlying setup is edited

### 5. Backend harness isolation is now a deliberate engineering rule

This session exposed that the previous backend harness was not reliably fresh when running across multiple functional areas.

What we found:

- missing-table failures were first discovered by running the real backend `pytest` suite after installing the dev dependencies
- the failures were order-dependent because the suite was sharing a single SQLite database file and global engine state

Current fix:

- backend tests now create an isolated SQLite database per test case
- app database globals are patched onto the per-test engine before each case runs

Important engineering meaning:

- mixed functional sessions can now safely exercise lifecycle, setup, ledger, and health areas together without contaminating one another

### 6. The current deployment path was revalidated

The repository was rebuilt and started with Docker Compose from the current working tree.

Current outcome:

- backend and frontend containers start successfully
- frontend serves on port `3080`
- backend health endpoint responds through the container network

Known deployment follow-up:

- the frontend Docker build still uses Node 16 and now emits engine warnings because some development dependencies expect Node 18+

## Latest Session: Test Harness Expansion And Initial End-To-End Lifecycle Coverage

This session moved the project from “testing strategy exists” to “the repo now has a usable multi-layer regression harness”.

Important direction now in place:

- Dosh now has a dedicated testing strategy reference in [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) plus a separate forward-looking coverage roadmap in [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/docs/tests/TEST_EXPANSION_PLAN.md)
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
