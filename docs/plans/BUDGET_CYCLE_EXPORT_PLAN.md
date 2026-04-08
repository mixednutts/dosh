# Budget Cycle Export Plan

This document preserves the implemented plan direction for budget-cycle export.

It should be used when:

- extending export formats or export scope
- deciding how flat spreadsheet exports should reconcile to the budget-cycle detail view
- reviewing whether future import or backup work should reuse the same shapes

It complements:

- [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md)
- [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md)

## Summary

Dosh now supports exporting any viewed budget cycle from the period-detail header as either:

- a single flat `CSV` designed for Excel and Google Sheets
- a grouped `JSON` file for structured review or later machine use

The current export entry point lives on the period-detail page beside the lifecycle controls, and uses the normal browser download flow rather than a browser-specific folder picker.

## Implemented Export Shape

The current export endpoint is:

- `GET /api/periods/{finperiodid}/export?format=csv|json`

Current output rules:

- export is available for any viewed cycle, including active, planned, and closed cycles
- export values should reconcile to the budget-cycle detail page rather than introducing a second summary source
- flat CSV omits separate balance rows and separate metadata-only rows
- JSON keeps grouped cycle sections while exposing the same flat transaction-row semantics used by CSV

## Flat CSV Rules

The spreadsheet-friendly CSV uses one flat row shape with three row kinds:

- `budget_only`
- `transaction`
- `budget_adjustment`

Meaning:

- `budget_only` means the line exists in the selected cycle and contributes displayed line values, but has no exported transaction rows for that cycle
- `transaction` means the row represents a normal underlying line transaction
- `budget_adjustment` means the row represents a stored `BUDGETADJ` history row for the line

Current row columns:

- `line_type`
- `line_name`
- `row_kind`
- `line_status`
- `line_budget_amount`
- `line_actual_amount`
- `line_remaining_amount`
- `transaction_id`
- `transaction_date`
- `transaction_type`
- `transaction_amount`
- `transaction_note`
- `transaction_account`
- `related_account`
- `linked_income_desc`
- `budget_before_amount`
- `budget_after_amount`

Current ordering rule:

- rows with empty `transaction_date` sort first
- rows with populated `transaction_date` sort after that in ascending date order
- tie-breaking remains stable by line identity and transaction id

## Calculation And Mapping Constraints

Current implementation constraints to preserve:

- export should reuse the same line-level values already shown on the detail page
- paid expense and investment lines should keep the same effective-budget behavior already used by the page totals
- transaction rows should map back to their parent line through the existing ledger `source` and `source_key` pairing
- `transfer`-sourced income-style rows should continue mapping back to their income line identity for export purposes
- `budget_only` rows must not be emitted for a line that already has exported transaction or budget-adjustment rows

## Follow-Up Work

Likely next export follow-through:

- decide whether to add budget-level or multi-cycle export views
- decide whether account-balance or reconciliation-specific exports belong in this same surface or a separate reporting area
- define import and restore expectations separately from this export workflow
- expand export validation once broader reporting and backup shapes are chosen
