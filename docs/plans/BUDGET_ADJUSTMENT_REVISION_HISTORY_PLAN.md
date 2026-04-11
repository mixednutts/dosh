# Budget Adjustment Revision History Plan

This document captures the workflow and domain rules for budget-line adjustment history across income, expense, and investment lines.

It exists because this area now has enough product and implementation-specific behavior that it should not live only in chat history or be inferred from scattered code paths.

## Purpose

This plan is the source-of-truth design reference for:

- budget adjustment workflow rules
- how budget adjustments relate to revision workflows
- how adjustment history is stored and interpreted
- what must be excluded from balance and actual calculations
- how setup-level history should be sourced

It complements:

- [AGENTS.md](/home/ubuntu/dosh/AGENTS.md) for operational constraints and current state
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md) for roadmap ownership and follow-up work
- [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md) for implementation history
- [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/plans/BUDGET_HEALTH_ADDENDUM.md) for broader health-direction guidance
- [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) for validation posture

## Scope

This plan covers:

- budget amount changes for income, expense, and investment lines
- revision-state interaction for expense and investment lines
- transaction history implications of budget changes
- setup-level history readback sourced from period transactions
- planning-stability interpretation that depends on this event history

This plan does not replace:

- lifecycle and close-out rules in [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md)
- broad health scoring direction in [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/plans/BUDGET_HEALTH_ADDENDUM.md)
- migration-strategy work, which still belongs elsewhere

## Definitions

- `Budget adjustment`: a change to a line's budgeted amount rather than its actual recorded amount
- `BUDGETADJ`: the explicit period-transaction entry kind used to record budget-adjustment history
- `Current scope`: update only the current period line
- `Future unlocked scope`: update the current period plus matching future unlocked period lines and the underlying setup amount
- `Line state`: the current workflow state of a line, such as `Current`, `Paid`, or `Revised`
- `Setup history`: cross-period review of budget-adjustment history for a setup item

## Core Rules

### 1. Budget adjustments are first-class history events

Budget changes for income, expense, and investment lines should be recorded as explicit history events, not inferred from silent row edits.

Current implemented rule:

- budget changes are recorded in `PeriodTransaction` as `BUDGETADJ`

Why this matters:

- users need one reviewable history model for plan changes and actual-entry activity
- future reporting should be able to answer what changed and why without relying on fragile free-text fields

### 2. Budget adjustments do not represent financial movement

`BUDGETADJ` entries are part of history, but they are not money movement.

Current implemented rule:

- `BUDGETADJ` must be excluded from balance movement
- `BUDGETADJ` must be excluded from income, expense, and investment actual calculations
- `BUDGETADJ` must be excluded from investment closing-value movement logic

Guardrail:

- no later convenience change should treat budget-adjustment rows as if they were ordinary financial transactions

### 3. One shared modal-driven budget-edit workflow should be used

Budget editing should not diverge by line family.

Current implemented rule:

- income, expense, and investment budget edits use the same modal-driven pattern
- the workflow captures target amount, note, and scope
- the note is required for adjustment events

Why this matters:

- users should not have to learn separate budget-edit semantics for different line types
- budget-change commentary should stay attached to the adjustment event itself

### 4. Scope determines whether setup is also revised

Budget adjustments can either stay local to one period or change the forward plan.

Current implemented rule:

- `Current` updates only the current period line
- `Future unlocked` updates the current period line, matching future unlocked period lines, and the underlying setup amount

Implication:

- future unlocked scope is a planning change, not merely a one-period correction

### 5. Revision workflow should stay lightweight

Expense and investment lines still use `Current`, `Paid`, and `Revised`, but the state-change workflow should not duplicate information already captured elsewhere.

Current implemented rule:

- direct `Paid` to `Revised` reopening is allowed
- no dedicated revision-reason modal is required
- explanatory context should instead come from budget-adjustment notes and actual-entry notes

Guardrail:

- do not reintroduce mandatory revision-justification prompts unless the product deliberately adds a stronger audit workflow later

### 6. Planning stability should use event history rather than prompt compliance

Budget health should interpret real off-plan activity, not just whether a user filled in a reason field.

Current implemented rule:

- transaction history now carries line-state context where relevant
- planning stability uses current off-plan activity and transaction history rather than revision-comment presence

Why this matters:

- a required comment field is a weak proxy for plan drift
- event-backed interpretation is more explainable and less burdensome

### 7. Setup history should reuse the shared transaction model

Setup-level review should not create a second adjustment-history store.

Current implemented rule:

- setup history for income, expense, and investment items is sourced from the existing transaction history model
- setup history should remain a read model over `PeriodTransaction`, not a separate owned event table

## Constraints

- `Carried Forward` remains system-managed and is not a normal editable planning line
- locked and closed cycles must continue protecting budget edits according to the supported workflow rules
- line-level note fields that only duplicated budget-adjustment commentary should not be treated as the primary explanation source
- current implementation uses explicit schema support in the live database for adjustment and line-state fields

## Implementation Implications

The implemented model now assumes:

- explicit `BUDGETADJ` transaction support
- transaction rows can carry current line-state context where required for later interpretation
- setup item history is derived from the shared transaction model
- budget health can reason about off-plan activity without depending on revision-comment prompts

Future work in this area should preserve those assumptions unless the source-of-truth documents are deliberately revised first.

## Remaining Follow-Up

Still-open follow-up that may build on this plan:

- broaden reporting surfaces that summarize budget-adjustment history and off-plan changes
- continue refining how budget health explains plan drift without becoming overly authoritative
- keep demo data aligned with the event-backed planning-history model
- fold this area into a proper migration history once the project introduces versioned migrations

## Related Documents

- [AGENTS.md](/home/ubuntu/dosh/AGENTS.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)
- [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/plans/BUDGET_HEALTH_ADDENDUM.md)
- [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md)
- [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md)
