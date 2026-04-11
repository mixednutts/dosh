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

### AGENTS.md

Document:

- [AGENTS.md](/home/ubuntu/dosh/AGENTS.md)

Document type:

- session handoff or working context (with framework/governance aspects)

Primary purpose:

- provide agent-specific session initialization guidance
- define hard operational controls for AI agent sessions
- establish constraints and guardrails (NEVER stage/commit, DOCUMENTATION_FRAMEWORK compliance)
- consolidate project context, domain rules, and AI-session-specific navigation

Primary source-of-truth scope:

- agent session initialization path
- hard operational controls (non-negotiable rules)
- DOCUMENTATION_FRAMEWORK compliance requirements for agents
- workflow guidelines for making and documenting changes

Key relationships:

- serves as primary working handoff for AI sessions
- references DOCUMENTATION_FRAMEWORK.md as compliance standard
- links to all canonical source documents
- complements DOCUMENTATION_FRAMEWORK.md with agent-specific constraints

Maintenance notes:

- hard controls defined in [AGENTS.md](/home/ubuntu/dosh/AGENTS.md) are non-negotiable and permanent
- update when DOCUMENTATION_FRAMEWORK compliance requirements change
- keep current project state snapshot updated
- preserve clear separation between agent constraints and general project guidance

### MIGRATION_AND_RELEASE_MANAGEMENT.md

Document:

- [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md)

Document type:

- operational policy document

Primary purpose:

- define release versioning, migration management, and deployment update expectations

Primary source-of-truth scope:

- semantic versioning rules
- pre-release classification rules
- Alembic migration conventions
- release sequencing and rollback expectations

Key relationships:

- linked from [README.md](/home/ubuntu/dosh/README.md) and [AGENTS.md](/home/ubuntu/dosh/AGENTS.md)
- informs future release and schema-update work across backend and deployment tooling

Maintenance notes:

- should remain the canonical operational reference for release and migration behavior
- should be updated whenever the release path or versioning policy changes materially

### RELEASE_NOTES.md

Document:

- [RELEASE_NOTES.md](/home/ubuntu/dosh/docs/RELEASE_NOTES.md)

Document type:

- overview document

Primary purpose:

- provide app-facing release notes aligned with the running and available Dosh versions

Primary source-of-truth scope:

- release-note content shown in the app
- per-version user-facing highlights and fixes
- published release-note content plus the staged `Unreleased` queue for future release preparation

Key relationships:

- used by the in-app release-notes surface
- complements deeper engineering history in [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)
- should stay aligned with versioning rules in [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md)

Maintenance notes:

- should stay concise and version-oriented
- should keep a versionless top `Unreleased` section for post-release work until the next version is intentionally chosen
- should remain suitable for direct app display rather than becoming a full engineering log

## Roadmap and Activity Documents

### ROADMAP.md

Document:

- [ROADMAP.md](/home/ubuntu/dosh/docs/ROADMAP.md)

Document type:

- roadmap and activity document

Primary purpose:

- define the overall release-shaped delivery path for Dosh
- separate beta scope, Phase 2 scope, and longer-view opportunities

Primary source-of-truth scope:

- overall roadmap stages
- release-boundary scope for beta versus post-beta work
- long-range opportunity visibility

Key relationships:

- links to [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md) for detailed implementation streams
- complements [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md) for beta-readiness and upgrade-path expectations

Maintenance notes:

- should remain concise and release-shaped rather than becoming a second detailed backlog
- should stay aligned with [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md) when scope moves between beta and later phases

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
- should remain aligned with current implementation described in [README.md](/home/ubuntu/dosh/README.md) and [AGENTS.md](/home/ubuntu/dosh/AGENTS.md)

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
- complements current-state summaries in [README.md](/home/ubuntu/dosh/README.md) and [AGENTS.md](/home/ubuntu/dosh/AGENTS.md)

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
- informs current-state wording in [AGENTS.md](/home/ubuntu/dosh/AGENTS.md) where relevant

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
- complements current-state and handoff guidance in [AGENTS.md](/home/ubuntu/dosh/AGENTS.md)
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

### INLINE_EXPRESSION_AMOUNT_INPUT_PLAN.md

Document:

- [INLINE_EXPRESSION_AMOUNT_INPUT_PLAN.md](/home/ubuntu/dosh/docs/plans/INLINE_EXPRESSION_AMOUNT_INPUT_PLAN.md)

Document type:

- domain or workflow plan

Primary purpose:

- preserve the implemented plan decisions for inline arithmetic amount entry in period-detail modals

Primary source-of-truth scope:

- supported inline expression scope
- parser and evaluation boundaries
- preview and validation behavior for modal amount fields

Key relationships:

- informs current-state wording in [AGENTS.md](/home/ubuntu/dosh/AGENTS.md)
- links to testing and implementation outcomes in [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md) and [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)
- complements activity tracking in [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)

Maintenance notes:

- should remain the main design-boundary document for inline arithmetic amount entry rather than becoming a second change log

### LOCALISATION_SUPPORT_PLAN.md

Document:

- [LOCALISATION_SUPPORT_PLAN.md](/home/ubuntu/dosh/docs/plans/LOCALISATION_SUPPORT_PLAN.md)

Document type:

- domain or workflow plan

Primary purpose:

- preserve the implemented localisation-support decisions for regional formatting, amount masking, operator-triggered calculator behavior, and budget preference resolution

Primary source-of-truth scope:

- budget-level `locale`, `currency`, `timezone`, and `date_format` preference behavior
- `Intl`-based currency, number, percent, date, time, and date-range display boundaries
- numeric masked amount-entry behavior and operator-triggered calculator boundary
- locale-neutral backend storage, API, ledger, migration, and machine-readable export expectations

Key relationships:

- informs current-state and handoff guidance in [AGENTS.md](/home/ubuntu/dosh/AGENTS.md)
- linked from [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md) as the current localisation implementation reference
- paired with verification notes in [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md)

Maintenance notes:

- should remain focused on localisation boundaries rather than becoming a full translation or copy-style guide

### BUDGET_CYCLE_EXPORT_PLAN.md

Document:

- [BUDGET_CYCLE_EXPORT_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_CYCLE_EXPORT_PLAN.md)

Document type:

- domain or workflow plan

Primary purpose:

- preserve the implemented plan decisions for budget-cycle export shape, ordering, and spreadsheet-oriented constraints

Primary source-of-truth scope:

- budget-cycle export entry-point direction
- flat CSV row semantics and ordering rules
- JSON parity shape for the same export domain
- reconciliation constraints between exported rows and the period-detail page

Key relationships:

- linked from [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md) as the current design reference for export follow-through
- complements current-state and handoff guidance in [AGENTS.md](/home/ubuntu/dosh/AGENTS.md)
- paired with verification notes in [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md)

Maintenance notes:

- should remain focused on export shape and behavior rather than absorbing backup or restore policy
- should be updated if export row semantics, ordering, or format scope change materially

### GITHUB_RELEASE_MANAGEMENT_WORKFLOW_PLAN.md

Document:

- [GITHUB_RELEASE_MANAGEMENT_WORKFLOW_PLAN.md](/home/ubuntu/dosh/docs/plans/GITHUB_RELEASE_MANAGEMENT_WORKFLOW_PLAN.md)

Document type:

- domain or workflow plan

Primary purpose:

- define the GitHub-managed workflow for release tagging, release publishing, and in-app release-info sourcing

Primary source-of-truth scope:

- GitHub release-tagging workflow shape
- GitHub Release publishing workflow shape
- version-bump validation expectations
- authority split between local workflow, GitHub tagging, GitHub Release publishing, and deployment release steps

Key relationships:

- complements release and migration policy in [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md)
- linked from [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md) as the current design reference for release orchestration
- paired with the operator-facing [GITHUB_RELEASE_RUNBOOK.md](/home/ubuntu/dosh/docs/GITHUB_RELEASE_RUNBOOK.md)

Maintenance notes:

- should remain focused on GitHub release orchestration rather than absorb deployment-only operational detail

### AUTO_EXPENSE_PLAN.md

Document:

- [AUTO_EXPENSE_PLAN.md](/home/ubuntu/dosh/docs/plans/AUTO_EXPENSE_PLAN.md)

Document type:

- domain or workflow plan

Primary purpose:

- define budget-level Auto Expense behavior and the hard rules around scheduled expense automation

Primary source-of-truth scope:

- Auto Expense settings behavior
- AUTO or MANUAL eligibility rules
- scheduler and manual-run expectations
- legacy-data normalization and migration constraints for Auto Expense

Key relationships:

- informs current-state and handoff guidance in [AGENTS.md](/home/ubuntu/dosh/AGENTS.md)
- linked from [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md) as the canonical Auto Expense rules reference
- paired with verification notes in [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md) and [TEST_RESULTS_SUMMARY.md](/home/ubuntu/dosh/docs/tests/TEST_RESULTS_SUMMARY.md)

Maintenance notes:

- should remain the main design-boundary document for Auto Expense behavior rather than becoming a second change log

### STATUS_CHANGE_HISTORY_PLAN.md

Document:

- [STATUS_CHANGE_HISTORY_PLAN.md](/home/ubuntu/dosh/docs/plans/STATUS_CHANGE_HISTORY_PLAN.md)

Document type:

- domain or workflow plan

Primary purpose:

- define the implementation approach for recording Paid/Revised status changes as non-financial transactions

Primary source-of-truth scope:

- status change history record structure and behavior
- budget-level feature gating for status change tracking
- alignment with budget adjustment pattern for non-financial transaction recording

Key relationships:

- informs status workflow implementation in [periods.py](/home/ubuntu/dosh/backend/app/routers/periods.py)
- complements budget adjustment workflow in [BUDGET_ADJUSTMENT_REVISION_HISTORY_PLAN.md](/home/ubuntu/dosh/docs/plans/BUDGET_ADJUSTMENT_REVISION_HISTORY_PLAN.md)
- paired with verification notes in [TEST_STRATEGY.md](/home/ubuntu/dosh/docs/tests/TEST_STRATEGY.md)

Maintenance notes:

- should remain focused on status change history behavior rather than becoming a general transaction ledger document

### FRONTEND_MODULARISATION_PLAN.md

Document:

- [FRONTEND_MODULARISATION_PLAN.md](/home/ubuntu/dosh/docs/FRONTEND_MODULARISATION_PLAN.md)

Document type:

- technical improvement plan

Primary purpose:

- define the phased approach for reducing frontend component complexity through extraction and modularization

Primary source-of-truth scope:

- PeriodDetailPage component breakdown strategy
- component directory structure and organization
- extraction patterns for transaction components, status pills, modals, and utility functions

Key relationships:

- implemented in [frontend/src/pages/PeriodDetailPage.jsx](/home/ubuntu/dosh/frontend/src/pages/PeriodDetailPage.jsx)
- new components located in [frontend/src/components/](/home/ubuntu/dosh/frontend/src/components/)
- extraction utilities in [frontend/src/utils/](/home/ubuntu/dosh/frontend/src/utils/)

Maintenance notes:

- update when adding new major sections or completing additional phases
- track component extraction progress and line count reductions

### GITHUB_RELEASE_RUNBOOK.md

Document:

- [GITHUB_RELEASE_RUNBOOK.md](/home/ubuntu/dosh/docs/GITHUB_RELEASE_RUNBOOK.md)

Document type:

- operational policy document

Primary purpose:

- provide the high-level human workflow for preparing, publishing, and deploying GitHub-managed releases

Primary source-of-truth scope:

- operator release checklist
- private-repo token setup expectations
- boundary between GitHub release automation and manual deployment

Key relationships:

- complements the design boundary in [GITHUB_RELEASE_MANAGEMENT_WORKFLOW_PLAN.md](/home/ubuntu/dosh/docs/plans/GITHUB_RELEASE_MANAGEMENT_WORKFLOW_PLAN.md)
- complements release policy in [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md)

Maintenance notes:

- should stay concise and instruction-oriented rather than becoming a second design document

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

- `sonar-summary.json` GitHub Actions workflow artifact generated by [.github/workflows/sonarqube.yml](/home/ubuntu/dosh/.github/workflows/sonarqube.yml)

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
- it is not expected to exist in a normal repository checkout unless a workflow artifact has been downloaded locally
- the workflow schema should remain stable enough for downstream consumers, but historical artifact contents are not long-term project source of truth

### sonar-summary.md

Document:

- `sonar-summary.md` GitHub Actions workflow artifact generated by [.github/workflows/sonarqube.yml](/home/ubuntu/dosh/.github/workflows/sonarqube.yml)

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
- it is not expected to exist in a normal repository checkout unless a workflow artifact has been downloaded locally
- the markdown output should stay concise and remediation-friendly

### sonar-issues-full.json

Document:

- `sonar-issues-full.json` GitHub Actions workflow artifact generated by [.github/workflows/sonarqube.yml](/home/ubuntu/dosh/.github/workflows/sonarqube.yml)

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
- it is not expected to exist in a normal repository checkout unless a workflow artifact has been downloaded locally
- it may be materially larger than the other Sonar artifacts because it carries the full issue list

### sonar-issues-summary.json

Document:

- `sonar-issues-summary.json` GitHub Actions workflow artifact generated by [.github/workflows/sonarqube.yml](/home/ubuntu/dosh/.github/workflows/sonarqube.yml)

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
- it is not expected to exist in a normal repository checkout unless a workflow artifact has been downloaded locally
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

- informs [README.md](/home/ubuntu/dosh/README.md), [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md), and [AGENTS.md](/home/ubuntu/dosh/AGENTS.md)

Maintenance notes:

- should preserve decision history rather than become an active backlog

## Session Handoff or Working Context

### AGENTS.md

Document:

- [AGENTS.md](/home/ubuntu/dosh/AGENTS.md)

Document type:

- session handoff or working context document

Primary purpose:

- provide a concise current-state handoff for future sessions
- establish hard operational controls for AI agent sessions

Primary source-of-truth scope:

- practical working context
- current operating assumptions
- immediate session-start orientation
- hard operational controls (non-negotiable rules)
- core domain rules and guardrails

Key relationships:

- synthesizes material from overview, roadmap, plan, testing, and history documents
- references DOCUMENTATION_FRAMEWORK.md as compliance standard

Maintenance notes:

- should remain concise and handoff-oriented rather than replacing deeper source documents
- update when hard controls or core domain rules change
- preserves incident history for agent learning

**Note:** Content previously in PROJECT_CONTEXT.md has been consolidated into AGENTS.md

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

## Operational Helper Scripts

### fetch_latest_sonar_artifact.sh

Document:

- [fetch_latest_sonar_artifact.sh](/home/ubuntu/dosh/scripts/fetch_latest_sonar_artifact.sh)

Document type:

- operational helper script

Primary purpose:

- download the latest successful SonarQube workflow artifact so future sessions can inspect the exported analysis without manually re-deriving the retrieval steps

Primary source-of-truth scope:

- the standard repository-local retrieval path for the latest downloadable Sonar workflow artifact

Key relationships:

- works against [.github/workflows/sonarqube.yml](/home/ubuntu/dosh/.github/workflows/sonarqube.yml)
- retrieves the generated CI reports documented in this register and referenced in [AGENTS.md](/home/ubuntu/dosh/AGENTS.md)

Maintenance notes:

- should remain a small operational convenience script rather than growing into a general CI client
- should print the downloaded artifact paths clearly enough that future sessions can immediately open the exported files

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
