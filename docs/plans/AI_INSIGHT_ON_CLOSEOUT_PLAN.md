# AI Insight On Closeout Plan

This document captures the current discovery-stage plan for introducing optional AI-generated close-out insights in Dosh.

It is intentionally a planning document, not a locked product decision. Use it to preserve the current discussion, open questions, and recommended implementation direction without treating the design as finalized.

Read this alongside:

- [README.md](/home/ubuntu/dosh/README.md)
- [AGENTS.md](/home/ubuntu/dosh/AGENTS.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)
- [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md)
- [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/archive/BUDGET_HEALTH_ADDENDUM.md)
- [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md)
- [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/docs/tests/TEST_EXPANSION_PLAN.md)
- [SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md](/home/ubuntu/dosh/docs/plans/SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md)

## Purpose

This plan exists to guide discovery and implementation of an AI insight layer for budget-cycle close-out.

Its purpose is to keep the work grounded in Dosh's existing lifecycle, historical-integrity, and testing rules while exploring:

- what close-out insight should do for the user
- what data should be sent to a configured LLM
- how privacy and review controls should work
- how the feature should fit into the existing close-out modal and settings model

## Current Product Context

The relevant current-state facts already established elsewhere in the repository are:

- budget cycles have explicit lifecycle state with `PLANNED`, `ACTIVE`, and `CLOSED`; see [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md)
- close-out already exists as a first-class workflow with preview, carry-forward handling, snapshot storage, and next-cycle activation; see [README.md](/home/ubuntu/dosh/README.md) and [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)
- close-out stores comments, goals, carry-forward amount, health snapshot JSON, and totals snapshot JSON as a dedicated historical artifact; see [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md)
- historical close-out meaning must remain point-in-time and must not be rewritten from later settings; see [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) and [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)
- budget health Phase 2 already anticipates closer use of close-out commentary and revision signals; see [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/archive/BUDGET_HEALTH_ADDENDUM.md)
- close-out hardening, consequence visibility, and snapshot-based reporting are already active development directions; see [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)

## Discovery Framing

AI close-out insight should be treated as a discovery stream, not as settled product truth.

The working framing from the current discussion is:

- the insight should focus first on what went well
- the tone should be encouraging, practical, and adult
- the writing should avoid praise that feels generic, inflated, or condescending
- the insight should still mention meaningful watchouts, but only after leading with evidence-backed positives
- the feature should help users reflect on progress and continuity rather than turning close-out into a gamified score explanation

Current tone direction:

- prefer language about steadiness, follow-through, control, resilience, or clearer visibility
- avoid language that sounds like coaching hype or automatic congratulations
- avoid overclaiming causes when the data only supports a partial explanation

## Working Product Goal

The likely product goal for a first useful version is:

- generate an optional short close-out reflection after or during close-out review
- summarize the strongest evidence-backed positive signal first
- connect the current close-out result to recent history and the next cycle where useful
- use close-out comments, goals, and selected transaction or revision comments as supporting context
- keep the feature optional and clearly separated from the core close-out transaction itself

This aligns with the current direction that close-out should feel reviewable and trustworthy; see [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md) and [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md).

## Data Inputs Under Consideration

The current discussion indicates that a meaningful AI insight payload should extend beyond just the active close-out preview.

Working proposal:

- include the current cycle being actioned for close-out
- include up to the last 15 `CLOSED` cycles to establish trends
- include stored close-out comments and next-cycle goals from those historical cycles
- include selected transaction comments and revision comments where they plausibly explain outcomes
- avoid sending raw unrestricted transaction history when summarized or filtered evidence would suffice

Why this broader lookback matters:

- trend language is weak without historical context
- repeated pressure or strength categories become more visible across closed cycles
- commentary may explain whether a result came from one-off events, tighter control, or repeated drift

Important caution:

- raw data volume should still be constrained through summarization and evidence filtering rather than assuming a large-context model makes payload discipline unnecessary

## Recommended Payload Shape

The current discussion favors a structured application-built payload rather than raw database records.

Recommended payload characteristics:

- one current-cycle summary for the cycle being closed
- one historical summary window for up to 15 recent `CLOSED` cycles
- precomputed trend summaries from the app where possible
- filtered supporting evidence rather than every transaction note
- explicit separation between facts, summaries, and supporting comments

Useful fields for the current cycle:

- period dates and lifecycle status
- close-out preview totals
- carry-forward amount
- stored or preview health summary, score, and status
- counts of revised or paid lines
- top positive drivers
- top pressure drivers
- close-out comments
- next-cycle goals
- notable transaction, revision, or line-item comments

Useful historical fields per cycle:

- close date and date range
- carry-forward amount
- surplus budget and surplus actual
- health snapshot summary, score, and status
- comments and goals
- revised-line counts
- top positive and pressure drivers
- filtered notable comments

Payload guardrails:

- summarize before sending
- cap the number of supporting comments per cycle
- prioritize comments tied to meaningful variance, revised lines, or unusually large movement
- avoid sending unnecessary personal identifiers, account identifiers, or raw free text when a normalized summary is sufficient

## Prompt Direction

The strongest current prompt direction is evidence-led rather than fully open-ended.

Working prompt goals:

- lead with the clearest evidence-backed sign of progress or stability
- explain what went well before mentioning watchouts
- keep the tone encouraging without sounding cheerful by default
- avoid generic praise
- avoid inventing causes not supported by the evidence
- use comments as reported context rather than unquestioned truth

Recommended structure for a first response:

1. one short headline sentence
2. one short paragraph on what went well
3. one short paragraph on what to watch next
4. one short closing sentence

Working phrasing guidance:

- prefer "steady", "composed", "constructive", "held together", or "stayed on course"
- avoid "amazing", "great job", "you're crushing it", or similar congratulatory language

## Privacy And Trust Direction

This feature should be treated as highly trust-sensitive because it involves financial history, close-out commentary, and potentially transaction notes.

Current direction from the discussion:

- AI insights should be optional
- data sharing should be narrow, reviewable, and user-controlled
- the app should send a structured insight payload, not a raw database export
- users should be able to review the payload before it is sent
- prompts, payloads, and responses should not be logged casually
- API credentials should not be stored in plaintext

Recommended baseline privacy posture:

1. feature off by default
2. user-configured provider and personal API key
3. review-before-send enabled by default
4. data minimisation and redaction before any model call
5. clear disclosure of what provider and model will receive the payload

Important implementation note:

- a per-user or per-installation provider configuration should not rely only on `.env` because the feature direction is user-controlled BYO provider usage
- `.env` still makes sense for feature flags, encryption secrets, or a possible server-owned fallback configuration

## Settings Direction

Current recommendation:

- configure provider, model, enablement, and API key through a settings UI
- keep credentials and provider selection out of the close-out modal itself
- consider budget-level enablement only as a secondary choice; the primary concern is user-level provider configuration

Likely settings fields:

- AI insights enabled
- provider
- model
- API key
- review payload before submission
- optional save-generated-insights preference if persistent storage is later introduced

## Close-Out Modal Integration Direction

The current close-out modal already shows totals, carry-forward, health summary, comments, goals, and the read-only warning; see [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md) and [README.md](/home/ubuntu/dosh/README.md).

Recommended integration path:

- add an optional `AI Insights` section within the close-out modal
- only enable it when the user has configured a provider and API key in settings
- show a disabled state with guidance to configure settings when AI is unavailable
- when enabled, let the user opt in for this close-out
- offer `Review payload before submission`
- keep review enabled by default

Recommended interaction sequence:

1. user opens close-out modal
2. user optionally selects `AI Insights`
3. if `Review payload before submission` is enabled, show the structured payload before any send
4. user confirms or cancels AI submission
5. close-out itself still completes independently of AI success or failure
6. AI insight should be treated as a follow-on artifact, not as a prerequisite for closing the cycle

Important guardrail:

- do not couple the financial close-out mutation to the success of the AI request

## Open Questions

These questions remain open and should be resolved through discovery rather than assumed here:

- should AI provider configuration be truly user-level, budget-level, or installation-level in the Dosh product model
- should generated insights be stored with the close-out snapshot or treated as transient outputs
- how much transaction-comment evidence is enough before the payload becomes noisy
- whether line-level driver summaries should be computed entirely in-app before AI submission
- whether users should be able to edit or discard generated insight text before it is displayed historically
- what exact privacy disclosure language best supports trust without overpromising

## Testing Implications

Any implementation of this plan should extend the current test-with-change discipline already established in the repository; see [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) and [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/docs/tests/TEST_EXPANSION_PLAN.md).

Likely test areas:

- settings-state gating for AI availability in the close-out modal
- payload review visibility and opt-in behavior
- close-out still succeeds when AI insight generation is unavailable or fails
- redaction and payload-minimisation behavior
- historical snapshot integrity remains unchanged by AI features
- prompt-input shaping remains stable for trend windows and comment filtering

Important testing rule:

- AI insight features should not weaken existing lifecycle, close-out, reconciliation, or historical-integrity guarantees

## Recommended Next Discovery Steps

1. confirm the exact ownership model for AI configuration: user, installation, or budget
2. map the current backend data needed for a trend-ready payload and identify gaps
3. define the first redaction and filtering rules for comments and identifiers
4. prototype close-out modal UX states for unavailable, available, review, and failure paths
5. validate prompt tone against multiple realistic sample payloads before implementation is treated as settled

## Status

**Superseded by [AI_INSIGHTS_IMPLEMENTATION_PLAN.md](/home/ubuntu/dosh/docs/plans/AI_INSIGHTS_IMPLEMENTATION_PLAN.md).**

This discovery plan has been superseded by the implementation plan, which documents the actual built feature. The key decisions from this discovery document that were adopted:

- AI insights are optional, user-controlled, and BYO-provider
- Data is summarized and aggregated before sending to the LLM
- Close-out insight is generated **before** confirming close-out (user reviews it in the modal)
- Close-out never fails because of AI issues
- API keys are encrypted at rest

Decisions that differ from this discovery document:

- Provider configuration is **budget-level** (not user-level or installation-level)
- Insight is generated **before** close-out and passed in the request (not fire-and-forget after)
- No "review payload before submission" step — the structured payload is not shown to the user
- No dedicated `PeriodAIInsight` table — insights are either transient (current period) or stored in `PeriodCloseoutSnapshot.ai_insight_text` (closed cycles)
