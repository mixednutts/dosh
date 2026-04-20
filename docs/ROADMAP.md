# Dosh Roadmap

This document defines the overall delivery path for Dosh across:

- `Beta Release`
- `Phase 2`
- `Future Opportunities`

It exists to give the project one concise release-shaped roadmap rather than relying only on activity-group planning.

Use this document to answer:

- what Dosh must include before leaving `alpha`
- what belongs in the first post-beta expansion phase
- which longer-view opportunities should stay visible without distorting near-term scope

Read this alongside:

- [README.md](/home/ubuntu/dosh/README.md)
- [AGENTS.md](/home/ubuntu/dosh/AGENTS.md) for operational constraints and current state
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md)

## Roadmap Structure

This roadmap groups work by release intent:

- `Beta Release`: the work required for Dosh to become stable, trustworthy, and operationally ready for broader real-world use
- `Phase 2`: the next major capability expansion after beta
- `Future Opportunities`: strategically valuable work that should remain visible without becoming implied near-term commitment

The detailed implementation backlog still lives in [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md).

## Beta Release

Beta is the point where Dosh should feel coherent as a complete budgeting workflow rather than a strong but still evolving alpha.

Beta work should focus on workflow trust, operational stability, clear user guidance, and broader real-world confidence.

### 1. Close Out Process

Goal:

- deliver a complete, trustworthy, and user-clear end-of-cycle workflow

Status:

- substantially complete for beta: close-out experience, health snapshot display, historical snapshot integrity with `carry_forward_applied`, dismissible warnings, read-only behavior, and end-to-end coverage
- inter-period expense movement (e.g., moving unreceipted expenses forward) remains a Phase 2 enhancement

Includes:

- close-out experience refinement
- historical snapshot integrity
- clear closed-cycle read-only behavior
- correction and post-close guidance
- stronger continuity coverage around close-out and delete or regenerate flows

### 2. Cash Management

Goal:

- define and implement how Dosh supports cash balances through a budget-cycle workflow

Includes:

- cash model definition
- available cash, committed cash, and reserved cash concepts
- current-period cash review surfaces
- cash pressure visibility and guidance
- alignment with balances, planned spending, savings, and investments

Status:

- completed for beta: generalised account transfers, committed-amount validation, expense and investment account routing, dynamic balance calculation from frozen anchors with configurable forward limits, and explicit limit-exceeded signaling
- cash pressure visibility and guidance remains outside beta scope

### 3. Localisation

Goal:

- make regional behavior, formatting, and terminology preferences explicit and consistent

Status:

- completed for app-wide regional formatting, centrally governed budget-level locale/currency/timezone/date-format preferences, numeric masked amount entry without currency symbols or codes inside editable fields, operator-triggered calculator entry, calendar locale alignment, custom supported date formats, and string-based amount normalization
- remaining localisation work is outside the beta non-translation hardening scope unless new real-world issues appear
- broader text translation remains a future opportunity rather than beta scope

Includes:

- shared formatting utilities
- locale, currency, date, and timezone handling
- preference storage and resolution
- terminology variation where appropriate
- supporting regression coverage around locale-sensitive behavior
- supported-option governance for locale, currency, timezone, and date-format choices
- robust localized amount parsing, decimal precision, paste, negative-value policy, comma-decimal behavior, and invalid mixed separator handling
- date picker locale alignment and date-range formatting that use standard platform APIs where practical
- custom numeric input contract after removing the unused AutoNumeric dependency
- formatter performance and consistency hardening, including avoiding needless per-call formatter construction where it matters

### 4. Budget Health Engine

Goal:

- evolve budget health into a robust, user-driven, explainable, and versioned engine

Status:

- substantially complete for beta: six global metrics with structured evidence, calculation traces, tone-aware summaries, point-in-time snapshots on close-out, test coverage, and demo data alignment
- scoring credibility and momentum logic remain visible for future refinement

Includes:

- stronger scoring credibility
- user-driven personalisation
- clearer evidence language
- preserved historical meaning when health logic evolves
- explicit versioning of health interpretation where needed
- stronger validation and regression coverage for thresholds and scoring behavior

### 5. Maintainability

Goal:

- ensure Dosh is operationally stable and safe to evolve

Status:

- substantially complete for beta: Alembic migration discipline, repeatable release sequencing, CI quality-gate follow-through, and Docker image publishing to GHCR verified with successful cross-server deployment
- standardized logging output utilizing syslog naming conventions remains the single active item before beta

Includes:

- reliable upgrade path
- Alembic migration discipline
- repeatable release sequencing
- backup and rollback confidence
- CI and quality-gate follow-through
- deployment and startup reliability
- standardized logging output utilizing syslog logging naming conventions

---

## Beta Release Summary

The five beta roadmap areas are now substantially complete:

| Area | Status | Remaining |
|------|--------|-----------|
| Close Out Process | Substantially complete | Inter-period expense movement deferred to Phase 2 |
| Cash Management | Complete for beta | Cash pressure visibility deferred |
| Localisation | Complete for beta | Full text translation deferred |
| Budget Health Engine | Substantially complete | Scoring credibility / momentum logic for future refinement |
| Maintainability | Substantially complete | Standardized syslog logging |

**Single remaining beta item:** Implement standardized logging output utilizing syslog naming conventions for backend services.

Once logging is in place, Dosh meets the beta threshold: a coherent, trustworthy budgeting workflow with operational stability and a verified deployment path.

## Phase 2

Phase 2 builds on the beta foundation by adding deeper review, audit, insight, and portability workflows.

### 1. Reconciliation Module

Goal:

- provide a user-facing reconciliation workflow grounded in the ledger-backed model

Includes:

- account-by-account reconciliation
- discrepancy detection
- ledger review surfaces
- closed-cycle reconciliation handoff
- correction and adjustment visibility

### 2. Reporting Module

Goal:

- provide useful financial review and comparison surfaces without weakening workflow clarity

Includes:

- reporting summary endpoints
- budget and cycle summary cards
- trend and variance visibility
- historical reporting usability
- backend-owned reporting calculations

### 3. Full Budget File Export

Goal:

- support complete, useful budget data export beyond the current single-cycle export slice

Includes:

- budget-level export
- multi-cycle export
- stable machine-readable shapes
- human-review-friendly output
- validation for export completeness

### 4. Backup And Restore

Goal:

- provide trustworthy recovery and portability paths for self-hosted use

Includes:

- backup scope definition
- restore expectations
- compatibility considerations
- privacy and trust boundaries
- restore-from-export or restore-from-backup workflow design

## Future Opportunities

These opportunities should stay visible, but they are intentionally outside the current beta and Phase 2 commitments.

### 1. Bank Integration

Potential scope:

- budget setup assistance
- transaction import and tracking
- transaction mapping and categorisation support
- reconciliation support

## Delivery Principles

- Beta focuses on workflow trust, operational stability, and user confidence.
- Phase 2 focuses on review, insight, and portability.
- Future Opportunities should remain visible without becoming implied near-term commitments.
- when a roadmap item is not yet decomposed into a stable implementation stream, it may remain defined here before it gains a detailed home in [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md) remains the source of truth for detailed implementation streams and sequencing within this roadmap.

## Current Gaps To Close

The roadmap above introduces a release-shaped structure that is stronger than the current activity map in a few areas.

Known gaps in the current documentation set:

- `Cash Management` is now explicitly beta-critical and should be interpreted as supporting cash balances through a budget-cycle workflow.
- `Budget Health` exists as a first release, but the roadmap now expects it to become robust, user-driven, and version-aware.
- `Localisation` now has app-wide regional formatting, budget preference storage/resolution, supported-option governance, string-based amount normalization, calendar locale alignment, custom supported date formats, and the custom numeric input contract in place; full text translation stays outside beta scope.
- `Maintainability` work is spread across migration, release, reliability, and Sonar follow-through documents rather than being framed as one beta-critical stream.
- `Phase 2` items may remain intentionally underdefined here until they are ready to become concrete activity streams in [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md).
- `Bank Integration` is intentionally roadmap-only for now and does not need detailed activity breakdown yet.

## Suggested Reading Order

1. read this document for the release-shaped path
2. read [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md) for the detailed execution backlog
3. read [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md) when beta readiness, versioning, or upgrade-path decisions are involved
