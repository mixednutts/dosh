# Documentation Framework

This framework provides a structured methodology to ensure consistency, clarity, and reusability across project documentation.

It is intended to help future sessions and contributors:

- create new documents with a consistent shape and purpose
- understand how documents relate to one another
- avoid duplicate or conflicting sources of truth
- preserve decision context while allowing documents to evolve
- manage roadmap work, detailed activities, and supporting plans without losing cross-area visibility

## Purpose

Many projects move beyond a single README plus ad hoc planning notes.

Documentation now covers:

- current product shape
- roadmap direction
- lifecycle and workflow design
- testing strategy and test expansion
- implementation history and decisions
- session handoff and working context

This framework is intended to be reusable across projects and should be treated as a portable project artifact rather than a project-specific policy note.

It establishes how documentation should be structured, linked, reviewed, and maintained.

## Core Principles

- one document should own each primary source of truth
- documents may cross-link, but should not silently duplicate managed content
- when an item affects multiple areas, keep one canonical entry and reference it elsewhere through cross-links
- preserve original context when reorganizing existing material
- if intent or placement is unclear, pause and review before rewriting meaning
- use stable headings and predictable structure so future sessions can navigate quickly
- prefer practical, working documentation over abstract process-heavy templates

## AI and Session Initialization

Projects using this framework should support a consistent initialization path for new AI sessions, agent sessions, or contributors.

Recommended initialization flow:

1. start with `README.md`
2. follow the README to the primary context or handoff document
3. use the context or handoff document to branch into roadmap, plans, testing, history, or other source documents as needed

Initialization rules:

- `README.md` should remain the top-level entry point
- `README.md` should explicitly point to the primary context or handoff document when one exists
- the context or handoff document should act as the operational starting point for work, not the README itself
- deeper documents should be discoverable from the context or handoff document rather than requiring ad hoc searching
- this initialization path should be kept current as the documentation set evolves

## Recommended Folder Hierarchy

Projects using this framework should adopt a documentation layout that keeps the project root clean while preserving a predictable information architecture.

Recommended generic structure:

```text
project-root/
├── README.md
└── docs/
    ├── DOCUMENTATION_FRAMEWORK.md
    ├── DOCUMENT_REGISTER.md
    ├── <overview or context documents>
    ├── <roadmap or activity documents>
    ├── <implementation history documents>
    ├── plans/
    │   ├── <plan documents>
    │   └── ...
    ├── tests/
    │   ├── <testing documents>
    │   └── ...
    └── archive/
        ├── <superseded or obsolete documents>
        └── ...
```

Folder guidance:

- keep `README.md` at the project root as the primary entry point for most users
- store most managed project documentation under `docs/`
- group plan-type documents under `docs/plans/`
- group testing documents under `docs/tests/`
- group superseded or obsolete documents under `docs/archive/`
- use additional subfolders only when they improve clarity and remain easy to navigate
- avoid scattering managed documentation across unrelated project directories unless the document must live with code or tooling for a specific reason

Hierarchy rules:

- a document register should reflect the actual folder structure in use
- folder placement should support discoverability, not duplicate ownership boundaries
- moving documents should be accompanied by link updates and document-register updates
- the folder hierarchy should stay shallow enough that users can understand it quickly

## Standard Document Types

The following document types are commonly useful across projects.

### Overview Documents

Purpose:

- explain the current product and technical shape

Common file types:

- `README.md`

Examples:

- overview
- introduction
- current-state summary

Recommended structure:

- purpose
- current-state summary
- system or product shape
- key entry points
- links to deeper documents

### Roadmap and Activity Documents

Purpose:

- describe active work areas, grouped activities, and next practical work

Examples:

- development activities
- roadmap
- work backlog

Recommended structure:

- purpose
- roadmap areas
- activity groups within roadmap areas
- managed activities
- sequencing or backlog view
- links to supporting plans and validation material

Structured grouping:

- `Roadmap Area`
- `Activity Group`
- `Activity`

Each tracked activity should have:

- a single canonical entry
- one `Roadmap Area`
- one `Activity Group`
- a status

Optional supporting attributes:

- notes
- cross-links

Activity tracking rules:

- every activity should exist once as a canonical item
- the canonical item should be placed where ownership is clearest
- cross-area effects should be represented through `cross-links`, not duplicate items
- `notes` should preserve context that could be lost during regrouping
- if wording must change for consistency, the original intent and scope must remain intact
- if regrouping would risk changing meaning, review first and do not force the classification

Roadmap guidance:

- roadmap areas are project-defined and should be tailored to the current product or work domain
- the framework does not prescribe a fixed roadmap taxonomy
- if a project tracks quality-oriented work separately, `Quality` is a useful roadmap area because it gives a stable place for improvements that cut across feature areas

If a project uses a `Quality` roadmap area, useful activity groups may include:

- UX/UI
- Bugs
- Test Coverage
- Regression
- Reliability
- Consistency
- Accessibility
- Polish

### Domain or Workflow Plans

Purpose:

- define rules, constraints, and intended behavior for a focused area

Examples:

- architecture plan
- workflow plan
- domain design note

Recommended structure:

- purpose
- scope
- definitions
- rules or constraints
- target behavior
- edge cases
- implementation implications
- related documents

Plan subtypes may include:

- architecture plans
- workflow plans
- lifecycle plans
- migration plans
- cleanup plans
- policy or protection plans
- design addenda

### Testing Documents

Purpose:

- define testing posture, expansion priorities, and results

Examples:

- test strategy
- test expansion plan
- test results summary

Recommended structure:

- purpose
- scope
- testing posture or objective
- coverage areas
- priorities or gaps
- verification results or follow-up

### Implementation History

Purpose:

- record meaningful product and engineering decisions that should not be accidentally undone

Examples:

- changes
- decisions
- release history

Recommended structure:

- purpose
- chronological entries
- decision or change summary
- rationale
- downstream impacts
- references to related plans or implementation work

### Session Handoff or Working Context

Purpose:

- provide concise current-state orientation for future work sessions

Examples:

- project context
- contributor handoff
- session context

Recommended structure:

- purpose
- current-state summary
- active focus areas
- constraints or guardrails
- practical starting points
- linked source documents

### Archived Documents

Purpose:

- preserve superseded or obsolete documents that are no longer active sources of truth but still hold historical value

Examples:

- legacy plans that have been fully replaced by a new design
- deprecated runbooks or workflow descriptions
- old addenda that no longer apply to the current system

Recommended structure:

- move the original document into `docs/archive/` without rewriting its content
- add a short header note indicating it is archived and optionally why
- update `DOCUMENT_REGISTER.md` to list the document under the archive category

### Framework and Governance Documents

Purpose:

- define how project documentation itself should be structured and maintained

Examples:

- documentation framework
- documentation governance
- documentation standards

Recommended structure:

- purpose
- principles
- document types
- structure rules
- governance
- maintenance expectations
- document register or adoption guidance

### Document Register Documents

Purpose:

- catalog project documents
- define each document's role and ownership
- show source-of-truth boundaries
- record relationships between documents
- support documentation governance and maintenance

Common file types:

- `DOCUMENT_REGISTER.md`
- `DOC_REGISTER.md`

Examples:

- document register
- documentation inventory
- document catalog

Recommended structure:

- purpose
- scope
- document inventory
- document type
- source-of-truth scope
- key relationships
- maintenance notes
- review or update expectations

## Document Register

This framework should maintain a living register of project documentation.

The register is intended to:

- identify the purpose of each document
- make ownership and usage clearer
- show how documents relate to one another
- reduce overlap and accidental duplication
- make future restructuring easier and safer

Each entry should describe:

- document
- document type
- primary purpose
- primary source-of-truth scope
- key relationships
- maintenance notes

Document register rules:

- every registered document should map to one primary document type defined by the framework
- if a document overlaps multiple document types, assign one primary type and capture the secondary relationships in notes or key relationships
- the primary document type should guide the expected structure, ownership, and maintenance pattern for that document

Additional entries can be added over time as the framework expands.

## Document Register Templates

Projects adopting this framework should add document entries using a consistent template.

### Register Entry Template

Document:

- `<document name>`

Document type:

- `<document type>`

Primary purpose:

- `<what this document is for>`

Primary source-of-truth scope:

- `<what this document owns>`

Key relationships:

- `<what it depends on or links to>`

Maintenance notes:

- `<how it should be maintained>`

## Document Relationships

Documentation should be linked intentionally.

Typical relationship patterns:

- overview documents summarize and link to deeper plans
- roadmap documents reference plans, strategy documents, and results summaries
- plan documents define area-specific rules that roadmap work must respect
- testing documents validate roadmap and plan changes
- implementation history documents record the decisions that explain why current behavior exists
- working-context documents summarize the current state across the broader set of source documents

## Governance

Documentation governance should follow these rules:

- each managed topic should have one primary source-of-truth document
- supporting documents should link to the source rather than restating it in full
- updates should preserve historical intent where that intent still matters
- major regrouping should be done carefully so context is not lost
- when a document is reorganized, links and references should be updated deliberately
- status-oriented documents should remain easy to query in natural language

## Versioning and Maintenance

When updating project documentation:

- prefer additive clarification before destructive rewrite
- preserve important history when a document also acts as a decision trail
- separate "current state" from "future intention" where confusion could arise
- keep headings stable where other documents or future sessions may refer to them
- review cross-links whenever a canonical item is moved or renamed

## Example Register Entries

The examples below are generic patterns that can be adapted in any project.

### Development Activities

Document:

- `DEVELOPMENT_ACTIVITIES.md`

Document type:

- roadmap and activity document

Primary purpose:

- track roadmap direction
- organize active and near-term work
- provide a practical backlog for future sessions or contributors

Primary source-of-truth scope:

- roadmap areas
- grouped activities
- near-term sequencing
- activity relationships where current and planned work intersect

Key relationships:

- informed by overview and current-state documents
- informed by implementation history and decision records
- linked to testing, planning, and validation documents

Maintenance notes:

- should remain the primary managed activity document
- activities should not be duplicated across roadmap areas
- cross-area impact should be represented through `cross-links`
- regrouping should preserve original meaning and context

### README

Document:

- `README.md`

Document type:

- overview document

Primary purpose:

- explain what the project is
- orient new contributors quickly
- summarize the current product or system shape

Primary source-of-truth scope:

- project overview
- high-level architecture or layout
- primary entry points for understanding the project

Key relationships:

- links to roadmap, plans, testing documents, and implementation history

Maintenance notes:

- should stay concise and current
- should summarize rather than duplicate deeper plans

### Changes

Document:

- `CHANGES.md`

Document type:

- implementation history document

Primary purpose:

- record meaningful project decisions and implementation changes

Primary source-of-truth scope:

- decision history
- meaningful implementation milestones
- changes that future work should not accidentally undo

Key relationships:

- informs roadmap and planning documents
- supports current-state and context documents

Maintenance notes:

- should preserve historical intent
- should remain decision-focused rather than become a duplicate backlog

## Change Safety For Realignment

Before realigning existing activity content:

- identify the canonical meaning of each current item
- preserve its existing context through notes where needed
- assign one primary roadmap area and one activity group
- use cross-links for secondary impacts
- avoid splitting a single item into multiple duplicates unless the original item clearly contains multiple distinct activities
- if context would be weakened by immediate regrouping, review the item before changing it
