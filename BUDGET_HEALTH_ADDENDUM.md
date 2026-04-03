# Budget Health Addendum

This addendum captures the staged direction for Dosh budget health metrics work.

## Purpose

This document is the focused roadmap for the budget health feature.

Its purpose is to keep the staged health-scoring direction clear without overloading the broader project documents.

Read this alongside:

- [README.md](/home/ubuntu/dosh/README.md)
- [CHANGES.md](/home/ubuntu/dosh/CHANGES.md)

## Phase 1

Phase 1 is the initial implemented version.

Current direction:

- Use a backend metrics service, not a generic rules engine.
- Keep scoring logic fixed in code while the product meaning is still stabilizing.
- Return explainable data with source evidence so users can inspect why a score was assigned.
- Show an overall budget health result, supporting pillar scores, and a trend/momentum indicator.

Current pillars:

- Setup Health
- Budget Discipline
- Planning Stability

Additional current-period layer:

- a dedicated `Health Check for Current Period` is now returned alongside the pillar set
- it is intended to surface live-period issues without replacing the broader budget-health view

Current user experience direction:

- Show a concise health summary at the budget level.
- Provide a details modal that explains the data behind the result.
- Use supportive language that points users toward improvement rather than judgment.
- Keep internal phase terminology out of the user-facing UI.
- Prefer compact visualization in the summary surface and reserve fuller explanation for the modal.
- Let the current-period summary link users directly into the active period when deeper inspection is needed.

Important Phase 1 constraint:

- Scores should be treated as guided indicators based on real product data, not as definitive financial truth.
- Visible score states must be backed by inspectable evidence shown to the user.
- Visible timestamps and date-sensitive classification should align with the app’s intended local timezone.

Current presentation notes:

- The budget-level summary currently uses a compact score-circle treatment.
- The large circle shows the current health score.
- A smaller overlapping circle shows the improvement/decline delta.
- Detailed interpretation remains in the modal rather than the compact card.
- The current-period summary currently uses a traffic-light treatment on the Budgets page.
- Current-period evidence now reflects live-period surplus, deficit concern thresholds, revision pressure, expense tolerance, and timing sensitivity.

## Phase 2

Phase 2 should extend the metrics model once period close-out workflows are in place.

Planned direction:

- incorporate period close-out performance metrics
- include close-out review completion and sign-off style indicators
- use revision comments and close-out commentary as richer source data
- make end-of-period reporting and budget health reinforce each other
- improve trend logic with clearer before/after comparisons across close-out windows

Important note:

- Phase 2 should deepen the credibility of the metrics before exposing more user-facing configuration.

## Phase 3

Phase 3 is the point where a configurable metrics engine may become worthwhile.

Planned direction:

- allow selected metric rules or weights to be configured through budget settings
- support configurable lookback windows and tolerance thresholds
- let users choose whether some pillars are emphasized more than others
- keep scoring versioned so old explanations remain understandable when rules change
- continue budget-specific personalisation only where the user can reasonably understand what a control changes
- phrase personalisation around the financial value being assessed, such as deficit concern thresholds, rather than abstract scoring language

Important caution:

- do not expose settings that users cannot reasonably understand or trust
- configuration should only be introduced after the scoring model has proved stable in real use

## Design Principles

Future work on budget health should preserve these principles:

- Every visible score should be backed by inspectable real data.
- A user should be able to see what improved or declined and why.
- Budget health should measure planning and workflow quality, not just whether money was tight.
- Improvement indicators should reward meaningful corrective action.
- The metric system should remain supportive, practical, and explainable.
- Personalisation should tune interpretation, not turn scoring into a black box.
- When thresholds are configurable, the UI copy should clearly state whether Dosh is assessing surplus strength, deficit size, tolerance, or timing sensitivity.
