# Dosh Release Notes

## Unreleased

### Added

- **Status Change History**: Budget settings now include an option to record Paid/Revised status changes as non-financial transaction records. When enabled, marking income, expense, or investment lines as Paid or Revised creates an audit trail entry visible in transaction details. This feeds into future budget health analysis for revision frequency and planning accuracy tracking.

### Fixed

- Fixed remaining backend test failures from UTC datetime migration: all datetime comparisons now properly handle timezone-aware objects
- Cleaned up redundant timezone handling code in models (now handled by `UTCDateTime` type decorator)

### Changed

- **Transaction Entry Date Simplification**: Transaction date/time is now read-only and automatically set to the current datetime when a transaction modal opens. Removed the editable date field and calendar picker due to layout and validation complexity. Dates display in the user's locale format (e.g., "11 Apr 2026, 2:30 PM" for en-AU).
- **Add Remaining/Full Button Layout**: Widened the quick-fill button to equal the amount input field width (0.5fr grid column), eliminating the previously cramped appearance.

### Engineering

- Database datetime storage now consistently uses UTC format with `+00:00` suffix
- All backend tests passing (121/121)
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
