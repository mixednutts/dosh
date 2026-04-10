# Localisation Support Plan

This plan records the implemented localisation-support scope for Dosh.

It was produced before implementation and now acts as the source reference for the current regional formatting, amount input, and preference-resolution boundaries.

## Purpose

Implement app-wide regional formatting without turning this pass into full text translation or backend domain-model renaming.

The implemented goal is:

- use budget-level `locale`, `currency`, `timezone`, and `date_format` preferences
- use `Intl.NumberFormat` for currency, number, and percent display
- use `Intl.DateTimeFormat` for date, time, date-range, timezone-aware date display, and the selected default date format
- use localized numeric masks for plain amount entry without currency symbols or currency codes in the editable field
- preserve formula support through explicit leading-`=` formula mode
- keep backend storage, API payloads, ledger calculations, migrations, and machine-readable exports locale-neutral

## Implemented Scope

Budget preferences:

- budget create, update, and output schemas now include `locale`, `currency`, `timezone`, and `date_format`
- defaults are `en-AU`, `AUD`, `Australia/Sydney`, and `medium`
- backend validation accepts supported BCP 47-style locale tags, ISO 4217 currency codes, IANA timezones, and the supported date-format presets
- Alembic migrations `9b7f3c2d1a4e` and `c4d8e6f1a2b3` add the budget preference fields with safe defaults

Frontend localisation:

- shared localisation helpers resolve preferences from the active budget
- shared APIs cover currency, number, percent, date, time, date-time, date-range, selected default date formatting, storage date keys, timezone-aware today, localized amount parsing, and AutoNumeric options
- high-traffic app surfaces now use those shared helpers instead of page-local hard-coded `en-AU`, `AUD`, raw percent strings, or browser-local timestamp assumptions

Amount input:

- normal money fields keep plain typed text while focused, apply localized grouping and fixed decimals only when unfocused, avoid currency symbols and currency codes inside editable fields, and emit normalized decimal values
- arithmetic input is deliberate and starts with `=`
- formula-mode previews use localized currency formatting
- submitted values remain normalized decimals
- incomplete or invalid formula input remains a user-facing validation state rather than becoming backend-localized text

Backend boundaries:

- financial values remain numeric or decimal values
- dates remain normalized ISO-style values for storage and API use
- machine-readable CSV and JSON exports remain locale-neutral
- backend-generated user-facing evidence should avoid hard-coded currency strings; prefer structured numeric values or neutral wording that the frontend can localize

## Out Of Scope

This pass did not implement:

- full text translation
- country-specific legal, tax, or banking behavior
- localized backend domain model names
- localized machine-readable export output
- accepting fully localized arithmetic expressions in normal masked amount fields
- replacing the existing account naming preference pattern with a broader i18n framework

## Key References

- [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md)
- [localisation.js](/home/ubuntu/dosh/frontend/src/utils/localisation.js)
- [LocalisationContext.jsx](/home/ubuntu/dosh/frontend/src/components/LocalisationContext.jsx)
- [LocalizedAmountInput.jsx](/home/ubuntu/dosh/frontend/src/components/LocalizedAmountInput.jsx)
- [AmountExpressionInput.jsx](/home/ubuntu/dosh/frontend/src/components/AmountExpressionInput.jsx)
