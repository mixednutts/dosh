# Dosh Document Register

This document is the register of active project documentation for Dosh.

Its purpose is to:

- map each document to one primary document type
- clarify what each document is for
- identify the source-of-truth boundary for each document
- reduce duplication across the documentation set
- make documentation maintenance easier as the project grows

This register follows the structure defined in [DOCUMENTATION_FRAMEWORK.md](/home/ubuntu/dosh/docs/DOCUMENTATION_FRAMEWORK.md).

## Register Rules

- each document is assigned one primary document type
- if a document touches multiple areas, its secondary concerns should be captured in `Key relationships` rather than by assigning multiple primary types
- source-of-truth scope should describe what the document owns, not everything it references
- documents should cross-link instead of duplicating maintained content

## Overview Documents

### README.md

Document:

- [README.md](/home/ubuntu/dosh/README.md)

Document type:

- overview document

Primary purpose:

- provide the main high-level introduction to Dosh
- summarize the current product and technical shape

Primary source-of-truth scope:

- current high-level product overview
- repository layout overview
- broad summary of implemented capabilities and stack

Key relationships:

- links to roadmap, plan, testing, and history documents for deeper detail

Maintenance notes:

- should remain concise and current
- should summarize rather than duplicate detailed design or backlog content

## Roadmap and Activity Documents

### DEVELOPMENT_ACTIVITIES.md

Document:

- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)

Document type:

- roadmap and activity document

Primary purpose:

- track roadmap direction and active work areas
- organize near-term and follow-up development work

Primary source-of-truth scope:

- roadmap areas
- active development streams
- grouped development activities and near-term sequencing

Key relationships:

- informed by current product state in [README.md](/home/ubuntu/dosh/README.md)
- informed by implementation history in [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)
- linked to testing and plan documents where work requires deeper design or validation detail

Maintenance notes:

- should remain the primary managed activity document
- activities should not be duplicated across multiple backlog-style documents

## Domain or Workflow Plans

### BUDGET_CYCLE_LIFECYCLE_PLAN.md

Document:

- [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md)

Document type:

- domain or workflow plan

Primary purpose:

- define lifecycle, close-out, carry-forward, and continuity behavior for budget cycles

Primary source-of-truth scope:

- lifecycle rules
- close-out behavior
- continuity and delete expectations

Key relationships:

- informs roadmap items in [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- should remain aligned with current implementation described in [README.md](/home/ubuntu/dosh/README.md) and [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md)

Maintenance notes:

- should be updated when lifecycle behavior changes materially

### SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md

Document:

- [SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md](/home/ubuntu/dosh/docs/plans/SETUP_ASSESSMENT_AND_PROTECTION_PLAN.md)

Document type:

- domain or workflow plan

Primary purpose:

- define centralized setup validity, readiness, and downstream protection behavior

Primary source-of-truth scope:

- setup assessment rules
- protected configuration behavior
- readiness and downstream consequence logic

Key relationships:

- informs setup-related roadmap items in [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- complements current-state summaries in [README.md](/home/ubuntu/dosh/README.md) and [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md)

Maintenance notes:

- should remain the main design reference for setup assessment and protection

### BUDGET_HEALTH_ADDENDUM.md

Document:

- [BUDGET_HEALTH_ADDENDUM.md](/home/ubuntu/dosh/docs/plans/BUDGET_HEALTH_ADDENDUM.md)

Document type:

- domain or workflow plan

Primary purpose:

- define budget health direction and staged health design considerations

Primary source-of-truth scope:

- health design direction
- health interpretation and planned evolution

Key relationships:

- informs health-related roadmap work in [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- complements current-state descriptions in [README.md](/home/ubuntu/dosh/README.md)

Maintenance notes:

- should remain focused on health design direction rather than become a duplicate implementation log

### INCOME_TRANSACTIONS_UNIFICATION_AND_LEGACY_LEDGER_CLEANUP_PLAN.md

Document:

- [INCOME_TRANSACTIONS_UNIFICATION_AND_LEGACY_LEDGER_CLEANUP_PLAN.md](/home/ubuntu/dosh/docs/plans/INCOME_TRANSACTIONS_UNIFICATION_AND_LEGACY_LEDGER_CLEANUP_PLAN.md)

Document type:

- domain or workflow plan

Primary purpose:

- define transaction-model unification and ledger cleanup intent

Primary source-of-truth scope:

- unification rationale
- cleanup direction
- ledger-related transition intent

Key relationships:

- relates to implementation history in [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)
- informs current-state wording in [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md) where relevant

Maintenance notes:

- should remain focused on the cleanup and unification topic, not general ledger behavior

### BUDGET_ADJUSTMENT_REVISION_HISTORY_PLAN.md

Document:

- [BUDGET_ADJUSTMENT_REVISION_HISTORY_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_ADJUSTMENT_REVISION_HISTORY_PLAN.md)

Document type:

- domain or workflow plan

Primary purpose:

- define budget-adjustment workflow, revision-history behavior, and shared adjustment-history rules

Primary source-of-truth scope:

- budget-adjustment workflow rules
- `BUDGETADJ` history behavior
- revision-workflow simplification boundaries
- setup-history sourcing for budget adjustments

Key relationships:

- informs health and quality roadmap items in [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
- complements current-state and handoff guidance in [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md)
- relates to implementation history in [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)

Maintenance notes:

- should remain the main rules document for budget-adjustment and revision-history behavior rather than becoming a second change log

### AI_INSIGHT_ON_CLOSEOUT_PLAN.md

Document:

- [AI_INSIGHT_ON_CLOSEOUT_PLAN.md](/home/ubuntu/dosh/docs/plans/AI_INSIGHT_ON_CLOSEOUT_PLAN.md)

Document type:

- domain or workflow plan

Primary purpose:

- capture supporting close-out planning insight and design thinking

Primary source-of-truth scope:

- close-out-related planning insight that is specific to this document's scope

Key relationships:

- related to [BUDGET_CYCLE_LIFECYCLE_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_LIFECYCLE_PLAN.md)
- may inform roadmap or history documents if decisions from it are adopted

Maintenance notes:

- should not become the primary lifecycle source of truth if lifecycle rules are owned elsewhere

## Testing Documents

### TEST_STRATEGY.md

Document:

- [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md)

Document type:

- testing document

Primary purpose:

- define the testing posture, priorities, and coverage intent for the project

Primary source-of-truth scope:

- testing strategy
- test priorities
- scenario direction

Key relationships:

- linked to [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/docs/tests/TEST_EXPANSION_PLAN.md) and [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md)
- should align with active work in [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)

Maintenance notes:

- should stay strategy-focused rather than becoming a results log

### TEST_EXPANSION_PLAN.md

Document:

- [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/docs/tests/TEST_EXPANSION_PLAN.md)

Document type:

- testing document

Primary purpose:

- define planned test coverage expansion and follow-up areas

Primary source-of-truth scope:

- test expansion backlog
- next intended coverage slices

Key relationships:

- follows strategy from [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md)
- should reflect high-risk work from [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)

Maintenance notes:

- should remain a forward-looking testing plan, not a results summary

### TEST_RESULTS_SUMMARY.md

Document:

- [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md)

Document type:

- testing document

Primary purpose:

- summarize recorded verification outcomes and notable test results

Primary source-of-truth scope:

- recent verification outcomes
- notable test or deployment result summaries

Key relationships:

- complements [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) and [TEST_EXPANSION_PLAN.md](/home/ubuntu/dosh/docs/tests/TEST_EXPANSION_PLAN.md)

Maintenance notes:

- should remain summary-oriented rather than becoming the test strategy itself

## Generated CI Reports

### sonar-summary.json

Document:

- `sonar-summary.json` workflow artifact generated by [.github/workflows/sonarqube.yml](/home/ubuntu/dosh/.github/workflows/sonarqube.yml)

Document type:

- generated CI report

Primary purpose:

- export a sanitized machine-readable SonarQube analysis summary for CI consumers and later coding sessions

Primary source-of-truth scope:

- latest exported SonarQube quality gate status for a workflow run
- latest exported high-level SonarQube measures for that run
- sanitized open-issue payload for that run

Key relationships:

- generated after the scan configured by [sonar-project.properties](/home/ubuntu/dosh/sonar-project.properties)
- paired with `sonar-summary.md` as the human-readable companion artifact
- supports later debugging and remediation work without exposing the Sonar token to development sessions

Maintenance notes:

- this is a generated artifact rather than a managed repository document
- the workflow schema should remain stable enough for downstream consumers, but historical artifact contents are not long-term project source of truth

### sonar-summary.md

Document:

- `sonar-summary.md` workflow artifact generated by [.github/workflows/sonarqube.yml](/home/ubuntu/dosh/.github/workflows/sonarqube.yml)

Document type:

- generated CI report

Primary purpose:

- provide a concise human-readable SonarQube run summary for review and follow-up work

Primary source-of-truth scope:

- latest exported workflow-run summary of quality gate status
- latest exported issue list snapshot for that run

Key relationships:

- derived from the same SonarQube API export as `sonar-summary.json`
- complements [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md) but does not replace curated testing or verification narrative

Maintenance notes:

- this is a generated artifact rather than a maintained hand-authored document
- the markdown output should stay concise and remediation-friendly

### sonar-issues-full.json

Document:

- `sonar-issues-full.json` workflow artifact generated by [.github/workflows/sonarqube.yml](/home/ubuntu/dosh/.github/workflows/sonarqube.yml)

Document type:

- generated CI report

Primary purpose:

- export the full sanitized open-issue set for a SonarQube workflow run so later sessions can analyze the complete backlog rather than a single page of results

Primary source-of-truth scope:

- full sanitized open-issue payload returned for the analyzed branch during that workflow run

Key relationships:

- generated from paginated SonarQube API issue retrieval in the Sonar workflow
- complements `sonar-summary.md` and `sonar-issues-summary.json` when deeper issue clustering or remediation planning is needed

Maintenance notes:

- this is a generated artifact rather than a managed repository document
- it may be materially larger than the other Sonar artifacts because it carries the full issue list

### sonar-issues-summary.json

Document:

- `sonar-issues-summary.json` workflow artifact generated by [.github/workflows/sonarqube.yml](/home/ubuntu/dosh/.github/workflows/sonarqube.yml)

Document type:

- generated CI report

Primary purpose:

- provide machine-readable aggregated SonarQube analysis that highlights issue concentrations by rule, file, directory, severity, and type

Primary source-of-truth scope:

- latest workflow-run issue clustering and high-leverage remediation candidates derived from the full exported issue set

Key relationships:

- derived from `sonar-issues-full.json`
- intended to support issue-triage, hotspot identification, and fix-many-at-once analysis in later sessions

Maintenance notes:

- this is a generated artifact rather than a maintained hand-authored document
- the summary schema should stay stable enough that future sessions can rely on it for clustering analysis

## Implementation History

### CHANGES.md

Document:

- [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)

Document type:

- implementation history document

Primary purpose:

- record meaningful project decisions and implementation changes

Primary source-of-truth scope:

- change history
- implementation decisions
- historically important product and engineering direction

Key relationships:

- informs [README.md](/home/ubuntu/dosh/README.md), [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md), and [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md)

Maintenance notes:

- should preserve decision history rather than become an active backlog

## Session Handoff or Working Context

### PROJECT_CONTEXT.md

Document:

- [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md)

Document type:

- session handoff or working context document

Primary purpose:

- provide a concise current-state handoff for future sessions

Primary source-of-truth scope:

- practical working context
- current operating assumptions
- immediate session-start orientation

Key relationships:

- synthesizes material from overview, roadmap, plan, testing, and history documents

Maintenance notes:

- should remain concise and handoff-oriented rather than replacing deeper source documents

## Framework and Governance Documents

### DOCUMENTATION_FRAMEWORK.md

Document:

- [DOCUMENTATION_FRAMEWORK.md](/home/ubuntu/dosh/docs/DOCUMENTATION_FRAMEWORK.md)

Document type:

- framework and governance document

Primary purpose:

- define the structure and governance model for project documentation

Primary source-of-truth scope:

- documentation types
- documentation structure guidance
- documentation governance expectations

Key relationships:

- informs how [DOCUMENT_REGISTER.md](/home/ubuntu/dosh/docs/DOCUMENT_REGISTER.md) is structured and maintained

Maintenance notes:

- should remain generic and reusable rather than project-policy-heavy

## Document Register Documents

### DOCUMENT_REGISTER.md

Document:

- [DOCUMENT_REGISTER.md](/home/ubuntu/dosh/docs/DOCUMENT_REGISTER.md)

Document type:

- document register document

Primary purpose:

- catalog Dosh project documents and their ownership boundaries

Primary source-of-truth scope:

- project document inventory
- per-document type assignment
- per-document source-of-truth boundaries

Key relationships:

- follows [DOCUMENTATION_FRAMEWORK.md](/home/ubuntu/dosh/docs/DOCUMENTATION_FRAMEWORK.md)
- references all active project documents without replacing their owned content

Maintenance notes:

- should be updated when new managed documentation is added, retired, renamed, or materially repurposed
