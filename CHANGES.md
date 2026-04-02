# Changes Log

This document captures the key product and implementation changes made during recent working sessions.

It is intended to complement [README.md](/home/ubuntu/dosh/README.md), not replace it.

Use this file in future sessions to understand:

- what changed
- why it changed
- what constraints or product rules now exist
- what design direction the project is leaning toward
- what ideas are intentionally deferred

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
- Functional clarity comes before visual polish.
- Workflow-driven design is preferred over isolated screens when the user is completing a setup process.
- Metaphorical naming ideas such as `Book` and `Chapter` have appeal, but are not yet adopted.
- Existing backend/API naming should remain stable unless there is a strong reason to change it.

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

## Budget Setup Page Direction

The budget detail page was reworked away from isolated tab panes and toward a scrollable setup flow.

The top controls now act as navigation hooks to page sections rather than independent tab bodies.

Current section order:

1. Budget Info
2. Accounts
3. Income Types
4. Expense Items
5. Investments
6. Settings

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
- Prefer concise, purposeful copy over over-explaining obvious actions.
- Use warnings and confirmations when state transitions become meaningfully final.
- Avoid introducing decorative redesigns that distract from core financial workflow.
- Keep a clear rollback path when changing app structure.
- Treat `Paid` as a meaningful finalized state, not just a cosmetic label.
- Treat revision comments as important future reporting data.

## Future Development Ideas And Thought Process

These are active ideas or partially formed directions that may matter in later sessions:

- End-of-period reporting should eventually include revision comments and revision reasoning.
- Expense auto/manual flag behavior still needs deeper development and may influence later account logic.
- Settings are expected to become a place for user-selected behavior flags and page layout preferences.
- Settings should remain visible rather than hidden, even if they stay lower priority than core setup steps.
- Navigation/sidebar polish should happen later, after core functional flows stabilize.
- Naming refinement remains a possible future branding move once workflow and structure are more settled.

## Technical Notes

- Backend startup currently performs lightweight SQLite schema migrations.
- A new `revision_comment` field now exists on period expenses.
- Frontend builds currently succeed with some non-blocking lint warnings in unrelated files.
- Those warnings are not currently blocking deployment, but can be cleaned up later.

## Summary

This session pushed Dosh toward:

- clearer finalization rules for expenses
- better budget-side accounting after payment finalization
- stronger setup flow for building a budget
- better preservation of product intent for future sessions

When making future suggestions, prioritize:

- practical budgeting workflow
- explicit state transitions
- plain language
- low-friction setup
- preserving the meaning of finalized financial actions
