# Dosh Release Notes

## Unreleased

### Added

- You can now jump straight to the current budget cycle using a simple URL shortcut: `/budgets/<id>/periods/current`. This automatically redirects to the active period for that budget, saving you from hunting through the cycle list.

### Engineering

- Expanded automated test coverage across backend and frontend to improve long-term reliability and maintainability. Backend tests now cover auto-expense scheduler behavior, budget health engine metrics, and investment transaction workflows. Frontend tests now cover mobile-responsive card rendering, drag-and-drop reordering, and Dashboard mobile views.

## 0.7.0-beta | released | 2026-04-24

### Fixed

- Fixed the in-app Release Notes modal incorrectly showing "Current Version" badges against older releases in the "Previous Releases" section. Previous releases now display a "Previous Release" badge with neutral gray styling instead.

### Changed

- The Budget Cycle Details page header has been redesigned for clearer visual hierarchy and better status communication. The date range title is now larger and more prominent, the cycle stage appears as a colored badge (filled teal with pulse indicator for Current cycles, bordered badges for Closed and Upcoming), and the metadata line uses a cleaner icon-plus-divider layout.

### Improved

- The app is now much easier to use on mobile devices. All tables in Budget Setup and Budget Cycle Details render as stacked cards on small screens instead of requiring horizontal scrolling. Summary tables on the Budget Cycles and Dashboard pages scroll smoothly within their containers. Buttons and controls have larger touch targets on mobile while the desktop layout remains exactly as it was. Modals now expand to full-screen on narrow devices for easier interaction.

## 0.6.11-beta | released | 2026-04-22

### Changed

- Promoted `0.6.11-alpha` to beta. No user-facing changes.

## 0.6.11-alpha | released | 2026-04-22

### Fixed

- Internal code quality improvements across the backend and frontend to keep the app maintainable and reliable as it grows. No user-facing workflow changes.

## 0.6.10-alpha | released | 2026-04-22

### Fixed

- Fixed duplicate log lines during container startup. Alembic migration messages no longer appear twice in `docker logs`.
- Switched backend logging from JSON format to plain text with ISO-8601 UTC timestamps, making container logs easier to read without sacrificing structure or severity levels.

## 0.6.9-alpha | released | 2026-04-22

### Added

- The New Budget modal now lets you choose locale, currency, timezone, and date format when creating a budget, so your regional preferences are set from the start instead of needing to be adjusted later in Settings.
- Added a preview GIF to the README so new visitors can see the app in action before installing.

### Changed

- The New Budget modal has been restructured with a two-column layout so all fields fit on screen without scrolling.
- The submit button in the New Budget modal is now labelled "Create" instead of "Save" for clearer intent.
- `.env.example` now lists only the timezones Dosh supports, making it easier to pick a valid value.
- Sidebar budget list now wraps long budget names and descriptions to multiple lines instead of truncating them.
- Demo budget health thresholds are now more relaxed so first-time users see green "Strong" health scores instead of warnings.
- Demo budget grocery expenses are now spread across the period (every 4 days instead of weekly) for a more realistic calendar view.

### Fixed

- Fixed budget deletion failing with "FOREIGN KEY constraint failed" error. The issue was caused by legacy transaction tables (`periodexpense_transactions` and `periodinvestment_transactions`) that were not fully removed during the unified ledger migration. An Alembic migration now drops these tables if they still exist.
- Fixed stale data appearing in the calendar after deleting a budget. The frontend now properly invalidates cached period and health data when a budget is deleted.

### Changed

- Restructured project documentation with a new user-facing README.md containing product overview and Docker deployment instructions. Development documentation moved to AGENTS.md and docs/.
- Docker Compose configuration updated: `docker-compose.yml` now uses the pre-built GHCR image (`ghcr.io/mixednutts/dosh:latest`), while `docker-compose.override.yml` provides local build context for development.
- Changed default port from 80 to 3080 for both host and container to avoid conflicts with common web services.
- Removed `DEV_MODE` environment variable and associated gating. The "Create Demo Budget" option is now unconditionally available.
- Removed `scripts/release_with_migrations.sh` as migrations now run automatically via `entrypoint.sh`.

### Infrastructure

- Backend logging is now structured JSON with syslog-style severity levels. Logs are emitted to stdout for Docker compatibility, and the log level is controlled via the `LOG_LEVEL` environment variable (default `INFO`).
- Added `.env` file support for `GITHUB_RELEASES_TOKEN` configuration, keeping secrets out of version control.
- Added `/backups` to `.gitignore` for local database backup storage.

## 0.6.8-alpha | released | 2026-04-21

### Added

- Budget Backup & Restore is now available from the Budgets page. You can download a JSON backup of a single budget or all budgets, and restore from a backup file later. The restore process checks app version compatibility, warns if the backup is from an older version, and blocks restores from newer versions until the app is upgraded.
- Backup files include full budget data: setup, cycles, transactions, health matrices, and historical snapshots.

### Changed

- Expense actual values now show green when under budget and red when over budget, matching the semantic color pattern used for projected investment amounts.
- The inner momentum circle has been removed from the overall budget health score display until the health score trending framework is implemented.
- The close-out snapshot on the budget cycle details page is now presented inside a clearer "Close Out Details" card with three child cards for Budget Health, Notes & Observations, and Carried Forward.
- The "Create Demo Budget" option is now always available in the create-budget modal, renamed from "Developer shortcut" to "Demonstration and Evaluation".

### Fixed

- The locked-cycle banner now stays dismissed across browser refreshes for the same budget cycle. It reappears when the cycle is unlocked or a different cycle is viewed.
- Duplicate demo budget creation is now prevented with a clear error message if a demo budget already exists.

## 0.6.7-alpha | released | 2026-04-20

### Added

- Added Docker image publishing workflow (`Publish Docker Image to GHCR`) for manual builds from release tags, with a path to future automation.
- Added `entrypoint.sh` to the Docker image so Alembic migrations run automatically before the app starts. This fixes first-run failures on fresh servers where the database schema was uninitialized.

### Changed

- `docker-compose.yml` cleaned up: removed hard-coded `APP_VERSION` and `DEV_MODE` from build args and environment; service renamed from `backend` to `dosh`. Runtime configuration now reads from `.env` file.
- `.gitignore` updated to exclude `.env` and `.donotupdate`.
- Scripts updated: `release_with_migrations.sh` and `db-migrate.sh` now reference the `dosh` service name.

### Fixed

- Fixed first-run database error (`no such table: paytypes`) on new deployments by running `alembic upgrade head` in the container entrypoint before app startup.

## 0.6.6-alpha | released | 2026-04-20

### Fixed

- Fixed `Projected Investment` calculation so it correctly reflects the linked savings account balance plus planned contributions. Previous values were overstated because they did not properly use linked-account balances and did not accumulate correctly across upcoming periods.
- Upcoming budget cycles now carry forward the prior period's projected investment balance so the cumulative value grows as expected.

### Changed

- Budget Health Details modal and Current Period Check modal now show per-metric cards with structured evidence, making it easier to see how each metric score connects to the underlying source data.
- Metric cards are collapsed by default. Tap "Show Details" to expand evidence rows, and "Show Formula" to see the exact calculation, scoring curve, weight, and contribution to the total score.
- The Current Period Check summary now uses the budget's selected health tone (supportive, friendly, or direct) so the messaging feels consistent with the rest of the app.
- The Close-Out modal now reuses the same health component as the Current Period Check, collapsed to a summary view, and uses past-tense messaging appropriate for historical cycles.
- The budget summary page no longer shows traffic-light indicators. Instead, a score circle sits at the top-right of each budget card with a "Health Details" button underneath.
- The Pending Closure section now includes an "Open" button alongside "Close Out" so you can jump directly to a cycle's detail page.
- The calendar modal now uses a single clickable "Today" label instead of a separate label and button.

### Added

- Added a dismissible warning in the Close-Out modal: "Closing a budget cycle makes it read-only and prevents further changes from being made." You can dismiss it and it will not appear again on this device.
- Added backend calculation traces for every metric so the frontend can display the exact arithmetic behind each score.

## 0.6.5-alpha | released | 2026-04-19

### Added

- Added "Return to Top" floating buttons to the Budget Cycles Summary and Budget Cycle Details pages for easier navigation on long pages.

### Changed

- Renamed "Planned" budget cycles to "Upcoming" across the app, including sidebar shortcuts, lists, and status labels.
- Improved banner styling for locked, closed, error, and warning states with softer colours, rounded corners, bold text, and a lock icon for cycle state banners.
- When a budget line is marked Paid, the status pill now shows the surplus or deficit amount (for example, "Paid -$60.00" or "Paid +$20.00") so you can see variance at a glance.
- The left sidebar now starts with the Budget List expanded by default after a page refresh.

## 0.6.4-alpha | released | 2026-04-19

### Changed

- Close-out now asks whether to carry forward surplus instead of doing it automatically. A checkbox appears in the close-out modal when surplus is positive, defaulting to unchecked. If left unchecked, the next cycle will not receive a "Carried Forward" income line.

### Fixed

- Fixed close-out modal summary totals so they match the Budget Cycle Details page. Expense Budget, Investment Budget, and Surplus (Budget) now use the same calculation as the detail page, ensuring the preview reflects true values before the cycle is closed.

## 0.6.3-alpha | released | 2026-04-18

### Changed

- Renamed "Projected Savings" to "Projected Investment" throughout the app to better reflect that the value represents planned investment allocations rather than generic savings.

### Fixed

- Fixed `Surplus (Budget)` showing different values on the budget cycles summary page versus the period detail page. Both surfaces now use the same calculation so the numbers match.
- Fixed `Projected Investment` on the budget cycles summary page to use live computed account balances instead of potentially stale stored values, matching the detail page behavior.
- Fixed a balance chain corruption issue where creating a new budget cycle during close-out could initialize account balances from the wrong source, breaking the opening-to-closing chain across periods.
- Fixed a SQLite datetime comparison bug that could cause balance propagation to incorrectly include the source period when updating later periods.

## 0.6.2-alpha | released | 2026-04-16

### Fixed

- Fixed page refresh on deep links (such as `/budgets/1` or `/budgets/2/periods/23`) so the app loads correctly instead of showing a "Not Found" error. The backend static file handler now properly falls back to `index.html` for React Router routes.

## 0.6.1-alpha | released | 2026-04-16

### Changed

- Simplified the Docker Compose stack into a single backend service. The backend image now builds the React frontend directly and serves it alongside the API, making deployments easier to build and maintain.

## 0.6.0-alpha | released | 2026-04-16

### Changed

- Replaced the per-budget health metrics database table with a global metric registry defined in code. This simplifies the engine while still letting each budget tune weights, sensitivity, and parameters.
- Expanded the Budget Health Engine from two metrics to six: Setup Health, Budget Cycles Pending Close-Out, Budget vs Actual (Amount), Budget vs Actual (Lines), In-Cycle Budget Adjustments, and Revisions on Paid Expenses.
- Renamed metric parameter storage from `parameters_json` to `health_metric_parameters` for clearer intent.
- Removed drill-down support from budget health surfaces to keep the experience focused on scores and evidence.

### Fixed

- Cleaned up obsolete backend and frontend code left over from the previous health engine simplification, including legacy metric template references and drill-down fallbacks.

## 0.5.1-alpha | released | 2026-04-15

### Fixed

- Restored missing budget cycle shortcuts in the left sidebar. The periods list was failing to load due to a mismatched API path, causing the sidebar to incorrectly show "No budget cycles yet."
- Aligned frontend and backend period routing across budget cycles, period details, and transaction modals for more reliable navigation.

## 0.5.0-alpha | released | 2026-04-15

### Changed

- Simplified the Budget Health Engine down to two core metrics: Setup Health and Budget Discipline. Removed templates, data sources, scales, custom metric builder, and formula evaluation so the engine is easier to understand and tune.
- Replaced threshold-based scoring with user-tunable parameters on each metric. Setup Health lets you set the minimum number of income, expense, and investment lines. Budget Discipline lets you set a dollar and percentage tolerance for historical expense overrun.
- Updated the Budget Health setup page to show only the two metric cards with enable/disable, weight, sensitivity, and direct parameter controls.

### Fixed

- Removed obsolete health engine concepts that were no longer used, eliminating dead code and orphaned database tables.

## 0.4.8-alpha | released | 2026-04-15

### Fixed

- Fixed custom metrics in the Budget Health Engine so they now evaluate properly instead of returning "Metric evaluation not yet implemented." Custom metrics created through the metric builder now compute real scores based on their formula result and threshold.

## 0.4.7-alpha | released | 2026-04-15

### Fixed

- Fixed a database foreign-key error when deleting a health matrix template in dev mode. Deleting a template now correctly cascades and removes all derived metrics across budgets.
- Fixed the budget dashboard so the Budget Health card and grey placeholder backgrounds are completely hidden when a budget has no health matrix metrics.
- Fixed the Budget Health Engine so empty matrices return no health data instead of a default score of 50.

### Changed

- The Save as Template and Create Empty Matrix dev-mode controls remain visible even when no templates exist yet.
- Added a warning banner before deleting a matrix template in dev mode to confirm the cascade impact.

## 0.4.6-alpha | released | 2026-04-15

### Changed

- Simplified the Budget Health Engine by removing the separate threshold-definition layer. Scales and default values now live directly on each metric, and per-budget threshold overrides are stored on matrix items. This makes the engine easier to understand and extend without changing how scores are calculated.
- Updated the custom metric builder to use scales and default values directly instead of linking to reusable threshold definitions.

## 0.4.5-alpha | released | 2026-04-15

### Changed

- Renamed the budget setup "Thresholds & Tolerances" section to "Budget Health Engine" and replaced the underlying `PersonalisationTab` component with a new `BudgetHealthTab` to better reflect the configurable engine architecture.
- Added a matrix template selector so you can see which health template your budget is using, switch to a different template, or reset to the template defaults when your matrix has been customized.
- Added scope tabs (`All`, `Overall`, `Current Period`, `Both`) to the health matrix so it is easier to see which metrics affect which health checks.
- Improved matrix item cards to show weight and sensitivity inline, with a visual progress bar for weight, so you can compare contributions at a glance.
- Enhanced metric details with clearer threshold names and scale labels, and improved the custom metric builder with a threshold selector and smarter formula insertion.

## 0.4.4-alpha | released | 2026-04-14

### Fixed

- Fixed a bug where the Budget Health Engine returned empty data after the terminology refactor, causing blank health circles on the budget summary page.
- Aligned SQLAlchemy models and Alembic migrations so health threshold tables are correctly named for both fresh installs and upgrades.

## 0.4.3-alpha | released | 2026-04-14

- Renamed the budget setup "Personalisation" section to "Thresholds & Tolerances" so health metric settings are described more accurately.
- Updated health engine language from "personalisation" to "threshold" throughout the app for clearer scoring inputs.

## 0.4.2-alpha | released | 2026-04-14

### Fixed

- Corrected the Budget Health API path in the frontend client so the dashboard health card loads properly.
- Fixed the `current_period_check` payload shape in the health engine runner so the Current Budget Cycle Check modal no longer crashes with a black screen.
- Added defensive fallbacks in the Current Period Check modal for missing evidence and drill-down data.

## 0.4.1-alpha | released | 2026-04-14

### Changed

- Removed legacy personalisation sliders from the Personalisation tab. Metric cards are now the single source of truth, with an inline View/Edit toggle for formula details and scale-aware personalisation controls.
- Refactored `setup_health` and `current_period_check` metric executors to consume `formula_result` and `source_values` instead of querying the database directly.
- Migrated closeout preview to use the Budget Health Engine directly, removing reliance on legacy `closeout_health.py`.
- Updated `current_period_check` formula to `live_period_surplus + total_budgeted_income * 0` so income context is available to the executor without changing the computed value.
- Aligned `health_tone` documentation with the implemented three-tone model (`supportive`, `factual`, `friendly`).

### Engineering

- Added dedicated backend unit tests for the formula evaluator, metric executors, and runner (`test_health_engine.py`, 22 tests).
- Updated lifecycle health snapshot test to verify historical closeout snapshots remain frozen after live personalisation changes.
- All backend tests passing (184). All frontend tests passing (198).

## 0.4.0-alpha | released | 2026-04-14

### Added

- **Budget Health Engine**: Replaced the fixed health implementation with a fully configurable engine. Budget health is now driven by a metric matrix, safe formula evaluation, code-backed data sources, and per-metric executors.
- **Health Personalisation Framework**: Added per-budget health matrices with `BudgetHealthMatrix`, `BudgetHealthMatrixItem`, and `BudgetMetricPersonalisation`. Each metric supports configurable thresholds, scoring sensitivity, and weight.
- **Point-in-Time Health Snapshots**: Close-out now persists `PeriodHealthResult` snapshots so historical health meaning is preserved even when engine logic evolves.
- **Health Tone Selection**: Budget settings now include a `health_tone` preference (`practical` or `clinical`) that shapes evidence language across the health surface.
- **Drill-Down Links**: Health modals now render contextual drill-down links that navigate directly into relevant budget setup, period detail, or cycles pages.
- **Custom Metric Builder**: The Personalisation tab now includes a metric builder UI that allows creating custom health metrics from available data sources.

### Changed

- The legacy `/api/budgets/{id}/health` endpoint now runs through the Budget Health Engine directly. The old fixed scoring implementation has been removed.
- `PersonalisationTab.jsx` expanded to support matrix item management, tone selection, metric builder, and weight/sensitivity controls.

### Engineering

- Added Alembic migration `7a8b9c0d1e2f` for all Budget Health Engine tables (`HealthDataSource`, `HealthMetricTemplate`, `HealthScale`, `BudgetHealthMatrix`, `PeriodHealthResult`, and supporting entities).
- Added `health_engine/` package with safe formula parser, data source executors, metric executors, runner, and period utilities.
- Added `health_matrices.py` router for matrix and personalisation CRUD.
- Legacy `budget_health.py` and associated legacy tests removed. Remaining closeout preview logic extracted to `health_engine/closeout_health.py`.
- Demo budget and test factories updated to seed health engine catalogs and create default matrices automatically.
- All backend tests passing (153). All frontend tests passing (176).

## 0.3.9-alpha | released | 2026-04-13

### Fixed

- Fixed budget cycles remaining stuck as "Planned" after their start date passes. Cycle stage is now derived from actual dates rather than relying solely on the stored status, and the daily scheduler refreshes lifecycle states to keep the database in sync.
- Fixed investment and expense budget totals on the period detail page so the total row correctly sums the budgeted amounts rather than substituting actuals for paid lines.

## 0.3.8-alpha | released | 2026-04-13

### Added

- **Investment Debit Account Override**: Investment transactions now allow selecting which active account to debit at transaction time. The modal defaults to the investment item's configured source account and shows the linked credit account read-only.
- **Two-Sided Investment Ledger**: Investment transactions are now proper two-sided movements: the source account is debited and the linked cash account is credited.

### Improved

- **Dynamic Balance Limit UX**: When the forward-calculation limit is exceeded, the balance endpoint now returns `200 []` with an explicit `X-Balances-Limit-Exceeded` header, and the period detail includes a `balances_limit_exceeded` flag. The frontend banner uses this explicit signal instead of inferring state from an empty array.

### Fixed

- Fixed missing `BalanceType` import in `investment_transactions.py` that caused a server error on submit.
- Fixed long account names truncating in the investment section table by allowing text to wrap naturally.

## 0.3.7-alpha | released | 2026-04-13

### Added

- **Dynamic Account Balance Calculation**: Account balances for open budget cycles are now computed dynamically from the last frozen cycle (closed or pending closure), rather than relying only on stored values. This ensures balance accuracy when transactions are recorded across multiple open cycles.
- **Forward Calculation Limit**: Added a budget setting to control how many planned cycles Dosh will calculate balances for (default 10, adjustable from 1 to 50). If the limit is exceeded, the balance section shows a clear banner instead of stale or misleading numbers.

### Fixed

- **Period End-Date Boundaries**: Fixed a timezone bug where budget cycles in timezones ahead of UTC (such as Australia/Sydney) could expire before the actual local end of day. Period start and end dates now correctly represent midnight in the budget's timezone.
- **Live Balance Updates**: Account balances on the period detail page now refresh immediately after recording income, expense, investment, or transfer transactions, without requiring a page refresh or focus change.

## 0.3.6-alpha | released | 2026-04-13

### Improved

- **Period Detail Table Layout Unification**: Income, Expense, Investment, and Account Balances sections now share consistent column widths and header alignment across the period-detail page.
- **Transfer Income Display**: Transfer income lines now show "Transfer from {source}" in the Description column and display the destination account in the Account column for clearer readability.
- **Account Balances Column Reorganization**: The Account Balances table now uses the column order Account → Opening → Movement → Closing → Account Type → Details, with matching background colors (Opening = budget grey, Movement = actual tint) aligned to the other sections.

### Fixed

- Fixed stale CSS `:nth-child()` width overrides in `index.css` that were forcing the Budget column to ~22% despite the `<colgroup>` setting 12%, causing misalignment across period-detail tables.

### Engineering

- Updated `PeriodDetailPage.test.jsx` assertions to match the new unified `colSpan` structure in income and balance tables.
- Updated the dev-only demo budget seed to include realistic cash-flow routing, scheduled expenses (Fixed Day of Month and Every N Days), and a mix of AUTO and MANUAL payment types so walkthroughs better reflect real use.

## 0.3.5-alpha | released | 2026-04-12

### Added

- **Generalised Account Transfers**: Transfers are no longer limited to savings accounts. The `savings-transfer` endpoint has been replaced with `account-transfer`, allowing money to be moved between any two active accounts. Transfer income lines are now named `Transfer: {source} to {destination}` for unambiguous ledger tracking.
- **Transfer Balance Validation**: New committed-amount validation ensures a source account can absorb a transfer before the line is created or before additional transactions are recorded. For unpaid lines, validation uses `max(budgetamount, actualamount)`; for paid lines, it uses `actualamount`.
- **Expense Default Account Routing**: Expense items can now store a `default_account_desc` in budget setup. When recording an expense transaction, users can select which active account to debit, defaulting to the item's configured account and falling back to the primary account.
- **Investment Account Tracking**: Investment transactions now expose `affected_account_desc` in the API and display the linked cash account in the transaction list.

### Fixed

- Fixed expense-item debit account selection so any active account (including non-Transaction accounts such as Savings) can be chosen, removing the previous Transaction-only restriction.
- Fixed the expense-item account selector UI in Budget Setup and Period Detail to use a single "Debit Account" picklist with a helper tooltip, defaulting to the primary account.
- Fixed missing interval validation for scheduled expenses: `Fixed Day of Month` and `Every N Days` now require `frequency_value` on both creation and update, and `Every N Days` also requires an effective date.
- Fixed the `Always` scheduling helper text placement so it appears between Frequency Type and Pay Type for clearer context.

### Engineering

- Added Alembic migration `e4f5a6b7c8d9` to add `default_account_desc` to `expenseitems`.
- Added Alembic migration `f1a2b3c4d5e6` to backfill `default_account_desc` for existing expense items and `affected_account_desc` for existing expense, transfer, and investment transactions.
- Added backend regression coverage for generalised transfer validation (`test_account_transfer_validation.py`) and expense entry account routing (`test_expense_entry_account_routing.py`).
- Added backend regression coverage for scheduled-expense field validation (`test_budget_setup_workflows.py`).
- Added frontend regression coverage for debit-account defaulting and scheduled-expense interval validation (`ExpenseItemsTab.test.jsx`).
- Full gap-analysis reconciliation script run inside the Docker container returned zero anomalies.

## 0.3.4-alpha | released | 2026-04-12

### Fixed

- Fixed Setup Assessment messaging appearing on the Budget Setup page even after budget cycles already existed; it is now hidden once any cycle is present
- Fixed newly added active accounts not appearing in existing budget cycle details. Creating a new active account now backfills `PeriodBalance` rows for current and future periods (skipping closed and pending-closure periods) and recalculates the budget chain

## 0.3.3-alpha | released | 2026-04-12

### Improved

- Release Notes modal "N newer release available" badge is now clickable and smoothly scrolls to the "Available Updates" section

### Fixed

### Fixed

- Fixed scheduled expenses incorrectly appearing in future budget cycles where they were not due. The "Every N Days" and "Fixed Day of Month" scheduling logic now correctly skips cycles that fall before the expense effective date or contain no occurrence
- Fixed browser autofill suggestions overlapping the Effective Date calendar picker in the add-expense modal
- Fixed misleading budget-cycle delete messaging: the last cycle in a chain now shows a simple "This budget cycle will be deleted." confirmation instead of "Delete this cycle and all upcoming cycles (1)"

### Engineering

- Cleaned up ~50 unused imports and unused variables across `PeriodDetailPage.jsx`, `BudgetPeriodsPage.jsx`, `transactionHelpers.js`, and `periods.py` following the PeriodDetailPage modularization
- Updated `scripts/fetch_latest_sonar_artifact.sh` to download the latest completed SonarQube workflow artifact regardless of success or failure, making failed-run diagnostics easier
- Added backend regression coverage for scheduled expense period applicability (`test_period_logic.py`, `test_budget_setup_workflows.py`)
- Added frontend regression coverage for trailing-cycle delete messaging (`BudgetPeriodsPage.test.jsx`)

## 0.3.2-alpha | released | 2026-04-11

### Added

- **Status Change History**: Budget settings now include an option to record Paid/Revised status changes as non-financial transaction records. When enabled, marking income, expense, or investment lines as Paid or Revised creates an audit trail entry visible in transaction details. This feeds into future budget health analysis for revision frequency and planning accuracy tracking.

### Fixed

- Fixed remaining backend test failures from UTC datetime migration: all datetime comparisons now properly handle timezone-aware objects
- Cleaned up redundant timezone handling code in models (now handled by `UTCDateTime` type decorator)
- Fixed demo budget creation failure caused by legacy `isfixed` database column (pre-baseline schema artifact)

### Changed

- **Transaction Entry Date Simplification**: Transaction date/time is now read-only and automatically set to the current datetime when a transaction modal opens. Removed the editable date field and calendar picker due to layout and validation complexity. Dates display in the user's locale format (e.g., "11 Apr 2026, 2:30 PM" for en-AU).
- **Add Remaining/Full Button Layout**: Widened the quick-fill button to equal the amount input field width (0.5fr grid column), eliminating the previously cramped appearance.

### Engineering

- **PeriodDetailPage Complete Modularization**: Reduced from 2,911 lines to 642 lines (78% reduction) through three-phase extraction
  - Extracted 7 transaction components to `components/transaction/`
  - Extracted 4 action modals to `components/modals/`
  - Extracted 4 section components to `components/period-sections/`
  - Extracted 3 utility modules to `utils/`
- Database datetime storage now consistently uses UTC format with `+00:00` suffix
- All backend tests passing (121/121)
- All frontend tests passing (164/164)
- Removed unused `parseDateTimeInput` function and `DATE_PARSE_PATTERNS` from localisation utilities
- Removed unused `format` import from date-fns in PeriodDetailPage.jsx

## 0.3.1-alpha | released | 2026-04-10

## 0.3.1-alpha | released | 2026-04-10

Dosh now adds Income status workflow and improves date format consistency.

### Improvements

- Added Income status workflow matching Expenses and Investments: Income lines now show `Spent` progress bar, can be marked `Paid`, and reopened as `Revised` when edits are needed
- Hardened beta localisation settings so supported locale, currency, timezone, and date-format options now come from the backend and stay aligned with API validation
- Restored the Settings date format control to a standard dropdown while adding supported custom formats such as `MM-dd-yy` and `MMM-dd-yyyy`
- Improved date handling so the shared calendar control follows the active budget locale and date ranges use standard platform range formatting where available
- Improved money entry normalization with string-based decimal handling, current negative-value rejection, and clearer beta scope that non-Latin digit locales are out of scope
- Removed the unused AutoNumeric dependency and kept the active custom numeric input contract
- Updated calculator amount fields so simple operators trigger calculation directly, with leading `=` still supported but no separate `Adjust` button required
- Focused the shared add-transaction modal on the amount field by default

### Fixed

- Fixed date format consistency across the application: Layout sidebar, Period Detail header, navigation links, and Budget Cycles page now all respect the user's date format preference instead of using hardcoded presets
- Expense items can now be deactivated even when already in use. Deactivation affects only future budget cycles; existing cycles retain the expense line. A warning explains the impact when deactivating an in-use expense.

### Notes

- Machine-readable CSV and JSON export remain locale-neutral for beta and are not presented as localized or human-readable export modes

## 0.3.0-alpha | released | 2026-04-10

Dosh now adds budget-level localisation controls across regional display, date handling, and amount entry.

### Highlights

- Fixed account setup so primary designation is now scoped per account type, preventing `Savings` or `Cash` accounts from displacing the required primary transaction account
- Fixed in-use account editing so primary-flag changes no longer fail when the account structure itself is unchanged
- Reconfirmed through focused transfer-and-balance tests that savings-transfer activity is represented as ledger-backed movement affecting both the selected savings account and the receiving account
- Refined budget-cycle lifecycle presentation so periods now surface as `Current`, `Planned`, `Pending Closure`, or `Closed`, with overdue open cycles staying explicitly outstanding until close-out is completed
- Aligned the sidebar, budget cycles page, and budget summary shortcuts around the new stage order and added direct close-out links for pending-closure periods
- Expanded the rolling demo budget seed to include multiple pending-closure scenarios, carry-forward continuity, transaction-direction edge cases, and budget-adjustment examples for walkthroughs
- Unified expense scheduling across Budget Setup and Period Detail around a shared add-expense field set, including consistent `Effective Date` wording and period-only note/include controls staying scoped to the period-detail flow
- Replaced the touched native expense date inputs with a shared calendar control that now supports dark mode better, uses a clickable calendar icon, and displays effective dates as `DD MMM YYYY`
- Added fixed-day-of-month rollover handling for short months, including the accepted `31st` behavior and helper guidance in the expense flows
- Aligned transaction-modal quick-fill behavior across income, expense, and investment through the shared modal rules, and neutralized transaction submit-button styling so these actions no longer read like cancel or destructive actions
- Expanded the release-notes modal so newly available versions can reveal their details inline without losing the current-version focus
- Added budget-level locale, currency, and timezone preferences, with settings controls and validation so each budget can drive its regional display behavior
- Added a budget-level date format preference so normal date display can follow the selected budget setting while internal date keys stay stable
- Added app-wide `Intl`-based currency, number, percent, date, time, and date-range formatting across high-traffic budget, setup, history, and period-detail surfaces
- Added localized numeric masked entry for normal amount fields without currency symbols or codes inside the editable field, while preserving explicit leading-`=` formula mode for arithmetic entry and normalized decimal submission
- Added migration-backed deployment for the localisation preferences, fixed a post-deploy budgets-page refresh crash in the pending-closure list, and corrected amount-entry masking so plain focused entry does not lock the keyboard

## 0.2.0-alpha | released | 2026-04-08

Dosh now adds scheduled Auto Expense automation while also tightening the release and migration reliability needed to ship it safely.

### Highlights

- Added optional Auto Expense automation for scheduled expenses, including budget-level enablement and offset-day controls
- Added Auto Expense controls to the budget-cycle detail page, including manual run support and scheduled expense AUTO or MANUAL switching
- Added backend enforcement so invalid or ineligible AUTO expense states fall back safely to MANUAL, including blocking MANUAL-to-AUTO after recorded expense activity exists
- Added Auto Expense migration coverage for both clean database upgrade and upgrade from a pre-feature SQLite snapshot
- Aligned the backend container and GitHub workflow Python baseline to 3.12 so the current backend runtime matches the deployed codebase
- Moved GitHub Release creation into the `auto-tag-on-version-bump` workflow so the normal release path no longer depends on a second workflow being triggered by a `GITHUB_TOKEN` tag push
- Converted the separate tag-based release workflow into a manual repair or backfill path for existing tags
- Documented the confirmed remote release flow, including protected `main`, the SonarQube gate, and the successful manual backfill of the first `v0.1.3-alpha` GitHub Release
- Added budget-cycle export from the period-detail page with user-selected flat `CSV` and grouped `JSON` download
- Added direct export regression coverage in Jest and Playwright, including validation of the downloaded flat CSV ordering rules

## 0.1.3-alpha | released | 2026-04-08

Dosh now treats GitHub as the published release authority for both release tags and the in-app release-notes view.

### Highlights

- Added a push-to-`main` workflow that validates version alignment and creates the official `v<version>` tag only when the repo is release-ready
- Added a tag-triggered workflow that creates or updates the matching GitHub Release from the validated repo release entry
- Switched the backend `/api/release-notes` endpoint to read published GitHub Releases, with safe fallback behavior when GitHub is unavailable or private-repo auth is missing
- Added a GitHub release runbook and personal override token guidance so private repos work now while public-repo access can remain unauthenticated later

## 0.1.2-alpha | released | 2026-04-08

Dosh now lets the in-app release notes reveal previous released versions without crowding the default current-version view.

### Enhancements

- Added a `View previous releases` option to the release-notes modal so older released versions can be revealed on demand
- Extended the backend release-notes payload to return previous released entries alongside the running release and any newer updates
- Added focused regression coverage for the previous-releases payload shape and modal interaction

## 0.1.1-alpha | released | 2026-04-08

Dosh now hardens release-notes parsing against regex-driven denial-of-service risk.

### Fixes

- Replaced regex-based release-note header parsing with bounded string parsing in the backend release-notes loader
- Added dedicated backend regression coverage for release-note header parsing, payload filtering, and version ordering behavior
- Redeployed the app on the shared Compose release path after the parser hardening update

## 0.1.0-alpha | released | 2026-04-08

Dosh now has a formal versioning and migration-management foundation.

### Highlights

- Added a canonical app version of `0.1.0-alpha`, displayed in the app as `v0.1.0-alpha`
- Added Alembic as the supported database migration path from the current aligned schema baseline
- Added a release workflow with database backup, migration, restart, and verification guidance
- Added a runtime app-info endpoint so deployed environments can report their version and schema revision

### Fixes

- Replaced the old hardcoded sidebar version text with the canonical runtime version
- Moved the expanded-sidebar version label below the product descriptor to avoid overlap with the logo and controls
- Upgraded Vite to the patched `6.4.2` release and cleared the reported audit issue
- Split major frontend routes into lazy-loaded chunks to reduce the initial bundle size
