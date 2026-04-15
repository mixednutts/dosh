# Dosh Release Notes

## Unreleased

## 0.5.1-alpha | released | 2026-04-15

### Fixed

- Restored missing budget cycle shortcuts in the left sidebar. The periods list was failing to load due to a mismatched API path, causing the sidebar to incorrectly show "No budget cycles yet."
- Aligned frontend and backend period routing across budget cycles, period details, and transaction modals for more reliable navigation.

## 0.5.0-alpha | released | 2026-04-15

### Changed

- Simplified the Budget Health Engine down to two core metrics: Setup Health and Budget Discipline. Removed templates, data sources, scales, custom metric builder, formula evaluation, and drill-down links so the engine is easier to understand and tune.
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
