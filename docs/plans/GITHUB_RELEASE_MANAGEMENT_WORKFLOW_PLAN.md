# GitHub Release Management Workflow Plan

This plan defines the Git-aligned release-management workflow for Dosh.

It exists because the repository already has a deployment release helper in [release_with_migrations.sh](/home/ubuntu/dosh/scripts/release_with_migrations.sh), and Dosh now also needs GitHub-managed tagging, published GitHub Releases, and a stable app-facing release-info source.

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
- a push-to-`main` workflow that validates real version bumps and creates official release tags
- a tag-triggered workflow that validates tagged commits and publishes GitHub Releases from repo-managed release content
- a backend `/api/release-notes` endpoint that reads published GitHub Releases instead of container-bundled Markdown

This means GitHub is now the authoritative release-checkpoint system, while deployment remains a separate manual operational step.

## Desired Model

GitHub should become the single authority for creating official release tags.

The intended flow is:

1. normal feature or fix work is committed and merged to `main`
2. `main` is protected so the SonarQube status check must pass before a release-worthy version-bump commit can be merged
3. a release-worthy change includes a version bump plus updated release notes
4. a GitHub workflow triggered by a push to `main` detects that the canonical version changed
5. the workflow validates required version touchpoints and release-note alignment
6. if validation passes and the tag does not already exist, GitHub creates the annotated tag for that commit
7. that same post-merge workflow creates or updates the GitHub Release from validated repo release content so it is not blocked by the `GITHUB_TOKEN` workflow-trigger limitation
8. an optional manual repair workflow can republish a GitHub Release from an existing tag when backfill or recovery is needed
9. the app reads those published GitHub Releases through the backend release-notes endpoint

## Authority Boundary

To avoid duplicate releases:

- local tooling should not create Git release tags once this workflow is live
- GitHub should be the only authority that creates `v*` release tags
- deployment scripts should continue deploying code, but not inventing Git release markers

This keeps the responsibility split clear:

- local workflow: edit, test, commit, push
- branch protection: block merge to `main` until SonarQube passes
- GitHub workflow: detect valid version bump, create the official tag, and publish the GitHub Release
- manual repair workflow: republish a GitHub Release from an existing tag when needed
- deployment workflow: build, back up, migrate, restart, verify

## Validation Rules

The version-bump workflow should validate all of the following before creating a tag:

- the canonical version changed between the previous and current `main` commit
- the new version string is valid semver with the currently supported prerelease suffix conventions
- all required version touchpoints match exactly
- the new version has a corresponding released entry in [RELEASE_NOTES.md](/home/ubuntu/dosh/docs/RELEASE_NOTES.md)
- the release tag does not already exist remotely
- the tagged release body is generated from the validated `released` entry in [RELEASE_NOTES.md](/home/ubuntu/dosh/docs/RELEASE_NOTES.md)
- SonarQube should already have passed through `main` branch protection before this workflow runs on a releasable merge

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

Precondition:

- `main` branch protection requires the `SonarQube` status check to pass before merge

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

This workflow intentionally does not orchestrate or wait on the SonarQube workflow directly. SonarQube gating happens before merge through GitHub branch protection so the tagger can stay simple and post-merge.

### Workflow 2: Manual Release Backfill Or Repair

Trigger:

- manual `workflow_dispatch` with a `v*` tag input

Responsibilities:

- validate that the requested tag points to a commit whose version files match the tag
- create or update the GitHub Release using the validated release-note content for that version
- provide a safe repair path if a release needs to be republished after a tag already exists
- remain the extension point for future versioned Docker image publication from successful tagged builds

This second workflow should not create tags. It should only republish releases from existing tags on demand.

## Runtime Release Info

The app-facing release-info flow now uses GitHub as its published release source.

- the frontend continues to call `/api/release-notes`
- the backend is the only GitHub client
- the backend prefers `GITHUB_RELEASES_TOKEN` when configured and falls back to unauthenticated reads when the repository is public
- if GitHub is unavailable or a private repo token is missing, the endpoint returns the current app version with `current_release: null` and empty release lists rather than failing the app
- the runtime repository token belongs in the personal [docker-compose.override.yml](/home/ubuntu/dosh/docker-compose.override.yml), not the shared base Compose file

## GitHub Repository Settings

The release workflow depends on one GitHub repository setting outside committed YAML:

- protect `main` with the `SonarQube` required status check so version-bump merges cannot land until SonarQube succeeds

This keeps release gating at the merge boundary rather than forcing the tagging workflow to coordinate with another workflow run after merge.

This repository setting has now been applied for the current repository and should be preserved.

## Suggested Implementation Notes

- use the backend canonical version source as the primary value rather than parsing commit messages
- treat commit messages only as human description, not as release authority
- keep the auto-tag workflow idempotent so reruns do not create duplicate tags
- use repository permissions that allow tag creation but keep the workflow narrowly scoped
- add explicit logging about which file or rule caused a validation failure

## Open Decisions

- decide whether the workflow should also validate documentation touchpoints such as [README.md](/home/ubuntu/dosh/README.md), [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md), and [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md), or whether those remain soft expectations outside the blocking tag gate
- decide whether documentation touchpoints beyond the current version-validation set should ever become blocking gates
- decide whether future deployment automation should ever be triggered from tags, or remain a manual operational step
- decide the exact future Docker image publication policy for prerelease versus stable `latest` tags

## Initial Delivery Slice

The first practical implementation slice should be:

1. validate canonical version alignment plus release-note presence on push to `main`
2. create the release tag only when the new version passes validation
3. publish the GitHub Release from the validated repo release entry when that tag is pushed
4. source the in-app release-notes endpoint from those published GitHub Releases
5. leave deployment manual through [release_with_migrations.sh](/home/ubuntu/dosh/scripts/release_with_migrations.sh)

## Related Documents

- [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md)
- [GITHUB_RELEASE_RUNBOOK.md](/home/ubuntu/dosh/docs/GITHUB_RELEASE_RUNBOOK.md)
- [RELEASE_NOTES.md](/home/ubuntu/dosh/docs/RELEASE_NOTES.md)
- [PROJECT_CONTEXT.md](/home/ubuntu/dosh/docs/PROJECT_CONTEXT.md)
- [DEVELOPMENT_ACTIVITIES.md](/home/ubuntu/dosh/docs/DEVELOPMENT_ACTIVITIES.md)
