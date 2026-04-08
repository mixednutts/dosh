# Auto Expense Plan

This document is the source of truth for Dosh Auto Expense behavior.

It captures the implemented workflow, hard rules, migration expectations, and follow-up constraints so future sessions do not need to reconstruct them from code or chat history.

## Purpose

Use this document when:

- changing Auto Expense setup or runtime behavior
- adjusting AUTO or MANUAL eligibility rules
- reviewing the scheduler or manual-run path
- validating migration behavior for older expense setup data
- extending tests around scheduled expense automation

## Scope

This plan covers:

- budget-level Auto Expense settings
- expense-item AUTO or MANUAL eligibility rules
- period-detail controls for Auto Expense
- backend automation and dedupe behavior
- migration and legacy-data normalization expectations

It does not replace:

- [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md) for general versioning and migration policy
- [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) for overall testing posture
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md) for roadmap ownership

## Implemented Behavior

### Budget-level settings

Each budget now has:

- `auto_expense_enabled` default `false`
- `auto_expense_offset_days` default `0`

Rules:

- the feature is opt-in per budget
- offset days must be zero or higher
- helper text in setup explains that expense items marked `AUTO` only automate when the budget-level setting is enabled

### Expense pay-type rules

Expense items now follow these hard rules:

- `AUTO` is only valid for scheduled expenses
- `MANUAL` is required for `Always` expenses
- `MANUAL` is required when a valid schedule is missing or incomplete
- scheduled expenses may remain `MANUAL` even when they are technically eligible for `AUTO`

Additional protection rule:

- a scheduled expense may only be changed from `MANUAL` to `AUTO` if it has no recorded expense activity
- once recorded expense movement exists for that expense item, the backend must reject `MANUAL -> AUTO` with a clear reason

This protection applies to:

- budget setup expense editing
- budget-cycle detail AUTO or MANUAL switching

### Period-detail behavior

The budget-cycle detail page now:

- shows the AUTO or MANUAL pill only when the budget has Auto Expense enabled
- allows switching scheduled expenses between `AUTO` and `MANUAL` when the cycle and line state permit it
- hides the toggle path for ineligible expenses such as `Always`, unscheduled, paid, locked, or closed-cycle lines
- includes a top-level `Run Auto Expense` action when Auto Expense is enabled for the budget
- shows manual-run results in a page-level feedback card
- shows MANUAL-to-AUTO rejection reasons in a dedicated warning modal with a simple `OK` action

### Automation behavior

Auto Expense is implemented as a backend service plus two trigger paths:

- a startup-wired daily scheduler for routine processing
- a manual period-scoped trigger from the budget-cycle detail page

Processing rules:

- only scheduled expense items marked `AUTO` are eligible
- only budgets with `auto_expense_enabled = true` are processed
- only active periods are processed by the daily job
- manual processing is limited to the viewed budget cycle
- catch-up only considers missed due dates within the processed cycle
- closed cycles are skipped
- paid lines are skipped
- expenses without a usable primary account are skipped
- transaction creation reuses the existing expense-entry and ledger path
- dedupe keys prevent duplicate auto-created transactions for the same due occurrence

Offset rule:

- offset days move the effective run date to `due date + offset`
- if the due date is the last day of the cycle, the transaction must remain on that day even when the offset is greater than zero

## Migration Expectations

This feature ships with a normal Alembic revision:

- [2ef0f1a2f1ba_add_auto_expense_settings.py](/home/ubuntu/dosh/backend/alembic/versions/2ef0f1a2f1ba_add_auto_expense_settings.py)

Migration behavior:

- add `budgets.auto_expense_enabled`
- add `budgets.auto_expense_offset_days`
- normalize invalid legacy `AUTO` expense rows to `MANUAL`

Legacy `AUTO` rows must be rewritten to `MANUAL` when:

- `freqtype IS NULL`
- `freqtype = 'Always'`
- schedule-bearing frequency types are missing `frequency_value`
- schedule-bearing frequency types are missing `effectivedate`

Valid scheduled `AUTO` rows remain unchanged.

SQLite note:

- the revision must remain SQLite-safe and should not depend on unsupported `ALTER COLUMN ... DROP DEFAULT` behavior

## Testing Expectations

The Auto Expense workflow now has dedicated backend and frontend coverage.

Backend expectations:

- migration tests must cover a clean `alembic upgrade head`
- migration tests must cover upgrade from a pre-feature database snapshot
- validation tests must cover AUTO or MANUAL normalization rules
- service tests must cover due-date execution, offset behavior, cycle-local catch-up, skip paths, and idempotency
- tests must cover the MANUAL-to-AUTO rejection once recorded activity exists

Frontend expectations:

- settings tests must cover the budget-level toggle and offset behavior
- setup tests must cover schedule-sensitive AUTO or MANUAL eligibility
- period-detail tests must cover toggle visibility, manual-run visibility, feedback behavior, and blocked AUTO switching

## Related Documents

- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md)
- [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)
- [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md)
- [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md)
