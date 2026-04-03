# Budget Cycle Lifecycle And Close-Out Plan

This document captures the detailed implementation plan that drove the current budget cycle lifecycle work.

It exists as a dedicated reference so future sessions can understand the intended workflow and constraints without overloading the broader project overview documents.

Read this alongside:

- [README.md](/home/ubuntu/dosh/README.md)
- [CHANGES.md](/home/ubuntu/dosh/CHANGES.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/DEVELOPMENT_ACTIVITIES.md)

## Summary

Implement explicit budget-cycle lifecycle with `PLANNED`, `ACTIVE`, and `CLOSED`, plus close-out, carry-forward, investment-line state parity, and safer delete/recreate behavior.

Latest decisions locked in:

- carry-forward appears as a dedicated system-managed income line: `Carried Forward`
- `Carried Forward` is populated in `budgetamount` only; users later record actuals normally
- investment lines should mirror expense line states: `Current`, `Paid`, `Revised`
- delete protection should offer `Delete this and all upcoming cycles`
- after deletion, users can regenerate cycles through the normal generation flow
- close-out health data must be stored as a point-in-time snapshot

## Key Changes

### Lifecycle and state model

- Add persisted cycle status on `FinancialPeriod`: `PLANNED`, `ACTIVE`, `CLOSED`.
- Keep `islocked` as a separate manual budget-edit lock, not lifecycle state.
- Enforce exactly one `ACTIVE` cycle per budget.
- Enforce no overlaps.
- Enforce no retained gaps.
- Enforce that `PLANNED` cycles form a continuous chain after the prior cycle.
- Treat `CLOSED` cycles as immutable through normal workflow APIs.

### Expense and investment line parity

- Extend `PeriodInvestment` with line state and revision metadata matching `PeriodExpense`.
- Add `status`: `Current | Paid | Revised`.
- Add `revision_comment`.
- Apply the same workflow rules to investment lines.
- `Paid` lines cannot be edited directly.
- `Revised` requires comment and is the only way to reopen a paid line.
- Close-out auto-finalizes remaining investment lines to `Paid`.
- Update period detail UI and summary calculations to use the same effective-budget-versus-actual logic pattern for investments as expenses.

### Carry-forward behavior

- On closing a cycle, compute net carry-forward and create or update a system-managed `PeriodIncome` line named `Carried Forward` in the next cycle.
- `Carried Forward` exists only on the next cycle.
- `Carried Forward` populates `budgetamount`.
- `actualamount` remains user-entered later.
- `Carried Forward` is not backed by a reusable `IncomeType`.
- `Carried Forward` is protected from ordinary delete or rename paths.
- Recalculate `Carried Forward` whenever the predecessor chain changes.
- Recalculate after closing a cycle.
- Recalculate after deleting a cycle and later regenerating.
- Recalculate after recreating the next cycle after deletion.
- Keep openings and carry-forward synchronized.
- Next-cycle account openings come from prior closing balances.
- Next-cycle investment openings come from prior closing values.
- `Carried Forward` is the budgeting representation of the prior-cycle result, not a substitute for opening rebasing.
- One shared recalculation path must update both openings and the `Carried Forward` line together to avoid stale or double-counted continuity.

### Close-out workflow

- Add a close-out modal for the `ACTIVE` cycle.
- Show key totals.
- Show a point-in-time health snapshot preview.
- Show a carry-forward preview.
- Collect comments or observations.
- Collect goals going forward.
- Show an explicit warning that the cycle becomes read-only and later corrections go through reconciliation.
- Offer creation of the next cycle if it is missing.
- Close-out action must validate or create the next cycle.
- Close-out action must finalize expense and investment lines to `Paid`.
- Close-out action must compute and persist carry-forward.
- Close-out action must update next-cycle openings.
- Close-out action must snapshot health, totals, comments, and goals.
- Close-out action must move current cycle to `CLOSED`.
- Close-out action must move next cycle to `ACTIVE`.
- Early close remains allowed with confirmation.

### Close-out storage design

- Store lifecycle fields on `financialperiods`.
- Store `cycle_status`.
- Store `closed_at`.
- Store detailed close-out data in a new table keyed by `finperiodid`, because it is a historical artifact rather than core cycle identity.
- Store comments.
- Store goals.
- Store carry-forward amount.
- Store snapshotted health JSON.
- Store snapshotted totals JSON.
- Store any future reconciliation handoff metadata.
- Keep this as a one-to-one close-out snapshot record per closed cycle.

### Delete and recreate behavior

- Replace simple delete validation with guided prevalidation.
- Support deleting a trailing `PLANNED` cycle if it has no actuals or transactions.
- Support deleting an `ACTIVE` cycle if it has no actuals or transactions.
- Support deleting this cycle and all upcoming cycles when continuity would otherwise break.
- Do not allow deleting `CLOSED` cycles.
- If the user deletes a cycle from the middle of the planned or active chain, only allow it via `Delete this and all upcoming cycles`.
- After deletion, users regenerate cycles using the normal generation flow.
- Regeneration must re-evaluate predecessor-based account openings.
- Regeneration must re-evaluate predecessor-based investment openings.
- Regeneration must re-evaluate the `Carried Forward` line for the newly created next cycle.

## Important Interface Changes

- Extend `FinancialPeriod` responses with explicit lifecycle status.
- Extend `PeriodInvestment` schema and API with state and revision fields matching expenses.
- Add a close-out snapshot model or table and related API response fields.
- Add system-managed identification on `PeriodIncome` rows so `Carried Forward` can be rendered and protected correctly.
- Add delete-prevalidation or guided-delete API behavior so the UI can present `Delete this and all upcoming cycles`.

## Test Plan

- Lifecycle: only one `ACTIVE` cycle per budget.
- Lifecycle: close-out activates the next cycle and closes the current one.
- Lifecycle: early close works with confirmation.
- Investment parity: investment lines support `Current`, `Paid`, `Revised`.
- Investment parity: paid investments cannot be edited until revised.
- Investment parity: close-out finalizes open investment lines.
- Carry-forward: close-out creates or updates `Carried Forward` in the next cycle.
- Carry-forward: `Carried Forward` populates only `budgetamount`.
- Carry-forward: actuals remain user-entered.
- Carry-forward: regenerated cycles recompute `Carried Forward` correctly.
- Delete behavior: `ACTIVE` cycle without actuals can be deleted.
- Delete behavior: `ACTIVE` cycle with actuals cannot be deleted.
- Delete behavior: deleting a non-trailing cycle requires deleting it and all upcoming cycles.
- Delete behavior: normal regeneration after deletion rebuilds continuity correctly.
- Historical integrity: close-out health shown later matches stored snapshot exactly.
- Historical integrity: changing health preferences later does not alter prior close-out history.

## Assumptions

- `Carried Forward` is a reserved system-managed income line name.
- No actuals for delete protection includes no recorded income, expense, investment, or ledger-backed transactions.
- Reconciliation remains the only normal correction path after a cycle is `CLOSED`.
- Users do not manually edit the structural meaning of `Carried Forward`; they only enter actuals against it if needed.
