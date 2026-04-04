# Dosh Test Expansion Plan

This document captures the current follow-up plan for expanding Dosh test coverage from the now-established harnesses.

It exists separately from [TEST_STRATEGY.md](/home/ubuntu/dosh/TEST_STRATEGY.md) so future sessions can see the likely next testing work without overloading the strategy document with too much moving detail.

Read this alongside:

- [TEST_STRATEGY.md](/home/ubuntu/dosh/TEST_STRATEGY.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/DEVELOPMENT_ACTIVITIES.md)
- [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/BUDGET_CYCLE_LIFECYCLE_PLAN.md)
- [SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md](/home/ubuntu/dosh/SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md)
- [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/TEST_RESULTS_SUMMARY.md)

## Purpose

This plan is the practical testing continuation guide.

Use it to answer:

- which testing areas are most likely next
- which risks are already covered versus still thin
- how to extend coverage without duplicating effort
- where scenario-based and end-to-end coverage should go from here

## Current Baseline

The repository now has:

- backend `pytest` workflow coverage
- frontend Jest and React Testing Library workflow coverage
- Playwright end-to-end smoke coverage for:
- create-budget to incomplete-setup gating
- minimum setup and first cycle generation
- first expense transaction and linked account movement
- close-out snapshot visibility and next-cycle activation

This means the next work should favor depth and consequence coverage rather than building new test harnesses.

Current update:

- backend test harness isolation is now in place and should be treated as baseline, not future work
- setup-assessment and downstream-protection coverage is also now baseline rather than an open test-expansion target

## Guiding Rules

- keep using a test-with-change discipline for new work
- prefer extending existing suites before creating overlapping one-off tests
- focus first on downstream consequences, not just local form behavior
- add scenario-shaped coverage when a workflow can behave differently for different account setups
- treat migration backfill as historical alignment work, not a recurring workflow feature
- document meaningful new testing scope back into [TEST_STRATEGY.md](/home/ubuntu/dosh/TEST_STRATEGY.md)

## Next Backend Priorities

### 1. Reconciliation and correction flows

Add deeper coverage for:

- post-close correction and reconciliation expectations
- movement-versus-ledger discrepancy handling
- system-generated adjustment visibility and integrity
- more complex multi-transaction-account behavior

### 2. Setup consequence coverage

Extend setup-driven tests so they verify the first downstream workflow that each change affects.

Best next slices:

- changing primary account and then recording expense or income activity
- changing primary investment and then generating the next cycle
- removing optional references and then attempting the first dependent action
- valid-but-weaker setup states that should still produce clear guidance
- reconciliation-aware or closed-cycle consequence messaging when protected setup can no longer be changed directly

### 3. Budget health expansion

Continue broadening the scoring matrix around:

- savings-priority interactions
- period-criticality weighting
- revision sensitivity combinations
- current-period weighting balance
- close-out snapshot integrity after later preference changes

## Next Frontend Priorities

### 1. Consequence visibility after setup edits

The main remaining frontend gap is not setup creation itself, but setup changes whose downstream impact may not be obvious.

Good next targets:

- primary-account reassignment guidance
- primary-investment reassignment guidance
- optional-reference removal consequences
- setup states that remain valid but reduce later workflow clarity

### 2. Transaction and correction flows

Add UI workflow coverage around:

- transaction viewing versus editing states
- post-paid revision and correction flows
- closed-cycle reconciliation messaging
- account movement explanation surfaces

### 3. Scenario-shaped setup flows

Keep growing the named scenario coverage for:

- `Single Account`
- `Multi Transaction`
- `Mixed Accounts`
- missing optional investment setup
- missing savings account where transfer-oriented behavior is attempted

## Next End-To-End Priorities

The current Playwright layer should stay intentionally small, but it can still grow into a stronger lifecycle smoke set.

Most useful next additions:

- correction or reconciliation behavior after a cycle is closed
- an investment activity path in addition to the current expense path
- scenario-shaped E2E flows such as `Single Account`
- delete and regenerate continuity smoke for planned cycles

## Things To Avoid

- broad snapshot-style frontend coverage with weak behavioral value
- duplicating backend business-rule tests in too many frontend layers
- over-expanding Playwright into a slow, brittle suite before the underlying workflows justify it
- treating every possible setup permutation as equally urgent before the higher-risk scenario differences are covered

## Session Handoff Note

If a future session changes product behavior in any workflow already mentioned here:

- update or add the relevant tests in the appropriate layer
- record the new coverage boundary in [TEST_STRATEGY.md](/home/ubuntu/dosh/TEST_STRATEGY.md)
- only expand this plan when the next-step priorities themselves have materially changed
