# GitHub Release Management Workflow Plan

This plan defines the intended Git-aligned release-management workflow for Dosh.

It exists because the repository already has a deployment release helper in [release_with_migrations.sh](/home/ubuntu/dosh/scripts/release_with_migrations.sh), but it does not yet have a GitHub-managed process for turning a version bump on `main` into an official release tag and release checkpoint.

## Purpose

- align Dosh releases with Git history rather than relying only on local deployment state
- keep version bumps, release notes, and release tags synchronized
- fit the preferred development workflow where a normal commit and push to `main` can trigger release tagging when the repository version actually changes
- avoid duplicate tag creation between local tooling and GitHub automation

## Current State

Today Dosh has:

- versioning and deployment rules in [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md)
- app-facing release notes in [RELEASE_NOTES.md](/home/ubuntu/dosh/docs/RELEASE_NOTES.md)
- manual deployment orchestration in [release_with_migrations.sh](/home/ubuntu/dosh/scripts/release_with_migrations.sh)
- no Git tags currently recorded in the repository history
- no GitHub workflow that creates or validates release tags from version bumps

This means Dosh can be deployed safely, but Git is not yet the authoritative release-checkpoint system.

## Desired Model

GitHub should become the single authority for creating official release tags.

The intended flow is:

1. normal feature or fix work is committed and merged to `main`
2. a release-worthy change includes a version bump plus updated release notes
3. a GitHub workflow triggered by a push to `main` detects that the canonical version changed
4. the workflow validates required version touchpoints and release-note alignment
5. if validation passes and the tag does not already exist, GitHub creates the annotated tag for that commit
6. a separate tag-triggered workflow can later create a GitHub Release, run extra validation, or prepare future deployment automation

## Authority Boundary

To avoid duplicate releases:

- local tooling should not create Git release tags once this workflow is live
- GitHub should be the only authority that creates `v*` release tags
- deployment scripts should continue deploying code, but not inventing Git release markers

This keeps the responsibility split clear:

- local workflow: edit, test, commit, push
- GitHub workflow: detect valid version bump and create the official tag
- deployment workflow: build, back up, migrate, restart, verify

## Validation Rules

The version-bump workflow should validate all of the following before creating a tag:

- the canonical version changed between the previous and current `main` commit
- the new version string is valid semver with the currently supported prerelease suffix conventions
- all required version touchpoints match exactly
- the new version has a corresponding released entry in [RELEASE_NOTES.md](/home/ubuntu/dosh/docs/RELEASE_NOTES.md)
- the runtime bundled [backend/release_notes/RELEASE_NOTES.md](/home/ubuntu/dosh/backend/release_notes/RELEASE_NOTES.md) entry matches the repo source
- the release tag does not already exist remotely

Required version touchpoints to validate:

- [version.py](/home/ubuntu/dosh/backend/app/version.py)
- [docker-compose.yml](/home/ubuntu/dosh/docker-compose.yml)
- [backend/Dockerfile](/home/ubuntu/dosh/backend/Dockerfile)
- [frontend/Dockerfile](/home/ubuntu/dosh/frontend/Dockerfile)
- [package.json](/home/ubuntu/dosh/frontend/package.json)
- [package-lock.json](/home/ubuntu/dosh/frontend/package-lock.json)
- any release-version fallback in [Layout.jsx](/home/ubuntu/dosh/frontend/src/components/Layout.jsx)

## Workflow Shape

### Workflow 1: Auto Tag On Version Bump

Trigger:

- push to `main`

Responsibilities:

- detect whether the canonical version changed
- read the new version from the canonical backend source
- validate version alignment and release-note presence
- confirm `v<version>` does not already exist
- create and push the tag for the pushed commit

Failure behavior:

- fail loudly when version touchpoints disagree
- fail when the release-notes entry is missing or not marked `released`
- skip cleanly when the push does not contain a version bump
- skip cleanly when the matching tag already exists

### Workflow 2: Release On Tag

Trigger:

- push tag matching `v*`

Responsibilities:

- validate that the tag points to a commit whose version files match the tag
- optionally create a GitHub Release using release-note content
- optionally become the future place for additional release publication checks

This second workflow should not create tags. It should only react to them.

## Suggested Implementation Notes

- use the backend canonical version source as the primary value rather than parsing commit messages
- treat commit messages only as human description, not as release authority
- keep the auto-tag workflow idempotent so reruns do not create duplicate tags
- use repository permissions that allow tag creation but keep the workflow narrowly scoped
- add explicit logging about which file or rule caused a validation failure

## Open Decisions

- decide whether the workflow should also validate documentation touchpoints such as [README.md](/home/ubuntu/dosh/README.md), [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md), and [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md), or whether those remain soft expectations outside the blocking tag gate
- decide whether GitHub Releases should be generated automatically from release notes in the first iteration or deferred to a follow-up
- decide whether future deployment automation should ever be triggered from tags, or remain a manual operational step

## Initial Delivery Slice

The first practical implementation slice should be:

1. add the `auto-tag-on-version-bump` GitHub workflow
2. validate canonical version alignment plus release-note presence
3. create the release tag only when the new version passes validation
4. leave deployment manual through [release_with_migrations.sh](/home/ubuntu/dosh/scripts/release_with_migrations.sh)
5. optionally scaffold but do not yet fully automate a tag-triggered GitHub Release workflow

## Related Documents

- [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md)
- [RELEASE_NOTES.md](/home/ubuntu/dosh/docs/RELEASE_NOTES.md)
- [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
