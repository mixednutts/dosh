# Inline Expression Amount Input Plan

This document captures the implemented plan and final product boundaries for inline arithmetic support in Dosh period-detail modal amount fields.

Read this alongside:

- [README.md](/home/ubuntu/dosh/README.md)
- [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)
- [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md)
- [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md)

## Purpose

This plan exists to preserve the final decisions from the inline-calculation planning and implementation session.

Its purpose is to keep future work aligned on:

- where inline arithmetic is currently supported
- what syntax is intentionally allowed
- how typing, preview, validation, and submission should behave
- what was deliberately left out of the first release

## Implemented Scope

The first released version applies only to amount-entry modals on [PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx).

Implemented surfaces:

- income transaction modal
- expense transaction modal
- investment transaction modal
- budget adjustment modal
- add income to budget cycle modal
- add expense to budget cycle modal

This plan does not currently extend inline arithmetic to setup-tab edit or create forms.

## Final Product Decisions

### Expression Trigger And Syntax

Calculator mode is driven by user input, not by a separate `Adjust` button.

The field enters calculator mode when the user types any simple arithmetic operator:

- `+`
- `-`
- `*`
- `/`
- `(`
- `)`

The older leading `=` trigger still works for existing user muscle memory, but it is no longer required.

Supported syntax is intentionally narrow:

- digits
- decimal points
- whitespace
- parentheses
- `+`
- `-`
- `*`
- `/`

Unsupported features include:

- percentages
- named functions
- identifiers or variable references
- currency-prefixed input such as `$100+20`
- broader JavaScript-like expression features

### Input and preview behavior

The input should keep the raw typed expression visible.

Preview behavior:

- plain numeric literals behave like normal amount entry and do not show a preview line
- a user can append an operator expression to an existing field value, such as changing `100` to `100+20`, without adding a leading `=`
- valid arithmetic expressions show a muted resolved preview such as `= $275.00`
- incomplete expressions such as `100+` or `(100+20` should not flash a hard validation error while the user is still typing
- incomplete expressions should instead show a muted in-progress summary line such as `= 100+`
- truly invalid expressions such as unsupported characters or malformed operator combinations should show `Enter a valid calculation`

### Submission and validation behavior

- the frontend resolves the expression before submit
- backend contracts remain unchanged and still receive numeric `amount` or `budgetamount` values
- values are rounded to 2 decimal places before submit-facing use
- minimum-amount rules are enforced after evaluation, not by the parser itself
- negative calculated results are rejected wherever the current amount field passes a non-negative minimum
- quick-fill buttons should continue to write simple literal values into the field and should not trigger the expression preview

## Technical Direction

The implementation uses:

- shared input component: [AmountExpressionInput.jsx](/home/ubuntu/dosh/frontend/src/components/AmountExpressionInput.jsx)
- parser: `jsep`
- a small custom arithmetic-only AST evaluator on top of the parsed result

Why this direction was chosen:

- smaller dependency than `mathjs`
- no deprecation warning
- easier to keep the allowed syntax intentionally narrow
- avoids shipping a richer math language than Dosh needs

## Non-Goals And Follow-Up

Not part of this plan:

- setup-tab amount-field support
- percentage expressions
- richer calculator widgets
- backend-side expression parsing
- replacing `Full` quick-fill wording with `Add Remaining`

Useful follow-up work:

- introduce route-level lazy loading in [App.jsx](/home/ubuntu/dosh/frontend/src/App.jsx) to reduce the still-large main frontend chunk
- decide later whether setup-tab amount fields should adopt the same expression input
