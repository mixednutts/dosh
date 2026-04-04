# Income Transactions Unification And Legacy Ledger Cleanup Plan

This document preserves the dedicated implementation plan that drove the income transaction and legacy-ledger cleanup work completed in this session.

Use it as a focused reference for why the session took the shape it did and which design constraints were intentional.

Read this alongside:

- [PROJECT_CONTEXT.md](/home/ubuntu/dosh/PROJECT_CONTEXT.md)
- [CHANGES.md](/home/ubuntu/dosh/CHANGES.md)
- [TEST_STRATEGY.md](/home/ubuntu/dosh/TEST_STRATEGY.md)
- [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/TEST_RESULTS_SUMMARY.md)

## Summary

Replace the inline income actual editor on the period detail page with a dedicated `Income Transactions` modal that mirrors the expense and investment transaction workflow.

Implement this through dedicated income transaction routes backed by the existing unified `periodtransactions` ledger table.

In the same change, perform a single cleanup cutover for legacy transaction persistence:

- back up the existing SQLite database before any schema change
- remove obsolete legacy expense and investment transaction tables and related compatibility code
- remove transitional startup schema patching and replace it with an explicit one-time cutover path for this schema state

## Key Changes

### Income actuals workflow

- remove the inline `IncomeActualCell` interaction from [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)
- add a dedicated `Income Transactions` modal with the same interaction model used for expenses and investments:
- list transactions for one income line
- add a positive income transaction
- add a negative correction or reversal transaction
- delete an existing income transaction when allowed
- show running total or actual value and budget-versus-actual summary
- keep `Add New Income Line Item` separate as a structural budget-line action

### Backend income transaction API

- add dedicated income transaction endpoints parallel to expense and investment routes:
- `GET /periods/{finperiodid}/income/{incomedesc}/transactions`
- `POST /periods/{finperiodid}/income/{incomedesc}/transactions`
- `DELETE /periods/{finperiodid}/income/{incomedesc}/transactions/{tx_id}`
- back these routes with `PeriodTransaction`
- use `source="income"` for standard income lines and preserve `source="transfer"` behavior for transfer-backed lines
- retire the direct set or add income actual flow from the period detail UI
- keep period state sync unchanged so actuals continue to be recalculated from ledger rows

### Income-specific rules

- standard income lines allow add and delete transaction rows
- negative entries are supported for reversals and corrections
- transfer-backed income lines stay inside the same modal while preserving transfer-specific movement logic
- `Carried Forward` remains structurally system-managed but still allows actual recording through transactions
- closed cycles block income transaction add or delete
- locked active cycles allow income transaction add or delete
- income line deletion remains blocked when recorded actuals exist

### Legacy table and startup cleanup

- create a timestamped SQLite backup under [backend/db_backups](/home/ubuntu/dosh/backend/db_backups) before schema mutation
- remove obsolete legacy persistence artifacts:
- `periodexpense_transactions`
- `periodinvestment_transactions`
- related SQLAlchemy models and compatibility helpers no longer needed
- remove schema-changing startup logic from [main.py](/home/ubuntu/dosh/backend/app/main.py)
- introduce an explicit cutover script to establish the new baseline schema state

## Public Interface Changes

- add dedicated income transaction request and response schemas parallel to expense and investment transaction schemas
- add dedicated income transaction client methods in the frontend API layer
- remove frontend dependence on inline income actual update helpers
- keep generic transaction listing routes for audit and reporting rather than the primary line-item workflow API

## Test Plan

### Frontend period detail tests

- income rows open an `Income Transactions` modal instead of inline edit
- locked active cycle still allows opening and using the income transaction modal
- closed cycle shows income transaction actions as read-only or blocked
- `Add New Income Line Item` remains separate from the transaction modal
- `Carried Forward` stays system-managed while still allowing actual-entry flow

### Backend income transaction tests

- add standard income transaction updates `actualamount`
- add negative correction updates `actualamount`
- delete income transaction recalculates `actualamount`
- transfer-backed income transaction behavior preserves account movement
- `Carried Forward` income transactions affect actuals but not structural protection
- locked active cycle allows income transaction add or delete
- closed cycle rejects income transaction add or delete

### Ledger integrity and cleanup verification

- income transaction rows appear in `periodtransactions` with correct `source`, `source_key`, account linkage, and signs
- balance movement remains correct for linked income accounts and transfer-backed rows
- backup is created before schema mutation
- startup no longer performs schema-changing `ALTER TABLE` operations
- legacy transaction tables are absent after cutover
- app boot and focused workflow tests pass against the post-cutover schema only

## Outcome

This plan was implemented in the same session it was documented.

Future sessions should treat it as historical design context for:

- why income actuals now follow the transaction-first pattern
- why the unified ledger should remain the only live transaction store
- why startup schema mutation should not be reintroduced
