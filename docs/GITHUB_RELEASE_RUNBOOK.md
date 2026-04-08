# GitHub Release Runbook

This runbook is the high-level operator guide for Dosh GitHub-managed releases.

Use it alongside [GITHUB_RELEASE_MANAGEMENT_WORKFLOW_PLAN.md](/home/ubuntu/dosh/docs/plans/GITHUB_RELEASE_MANAGEMENT_WORKFLOW_PLAN.md) and [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md).

## When To Use This

Use this flow when a change is release-worthy and should become an official Dosh GitHub release.

Typical examples:

- meaningful user-facing enhancements
- backward-compatible fixes worth surfacing in release info
- release-management or deployment improvements that should become a versioned checkpoint

## Prepare The Release

Before merging to `main`:

1. update all required version touchpoints to the same canonical version
2. move the relevant content from the top `Unreleased` section in [RELEASE_NOTES.md](/home/ubuntu/dosh/docs/RELEASE_NOTES.md) into a new matching `released` entry for the chosen version
3. keep the release-note entry concise and suitable for direct GitHub Release publishing
4. run the relevant automated tests for the touched areas
5. wait for the `SonarQube` GitHub check to pass and rely on `main` branch protection to block merge until it does

Between releases:

- keep notable unreleased work in the top `## Unreleased` section
- do not assign a concrete next version number until you are ready to ship

Required version touchpoints:

- [version.py](/home/ubuntu/dosh/backend/app/version.py)
- [docker-compose.yml](/home/ubuntu/dosh/docker-compose.yml)
- [backend/Dockerfile](/home/ubuntu/dosh/backend/Dockerfile)
- [frontend/Dockerfile](/home/ubuntu/dosh/frontend/Dockerfile)
- [package.json](/home/ubuntu/dosh/frontend/package.json)
- [package-lock.json](/home/ubuntu/dosh/frontend/package-lock.json)
- [Layout.jsx](/home/ubuntu/dosh/frontend/src/components/Layout.jsx)

## What GitHub Does

On push to `main`:

- detect whether the canonical version changed
- validate version alignment across the required touchpoints
- validate that [RELEASE_NOTES.md](/home/ubuntu/dosh/docs/RELEASE_NOTES.md) contains a matching `released` entry
- skip cleanly if there is no version bump
- skip cleanly if the matching remote tag already exists
- create the annotated `v<version>` tag when validation passes
- create or update the GitHub Release from that same workflow run

This tagging flow assumes SonarQube already passed before merge. It does not wait on the Sonar workflow itself.

Manual repair path:

- run the `Publish Release From Tag` workflow manually with an existing `v*` tag
- use this only when a GitHub Release needs to be backfilled or republished for a tag that already exists
- this path was used successfully to publish the first `v0.1.3-alpha` GitHub Release after the `GITHUB_TOKEN` workflow-trigger limitation was confirmed in practice

## In-App Release Info

The app does not call GitHub directly.

- the frontend calls `/api/release-notes`
- the backend reads published GitHub Releases and maps them into the existing modal payload
- the app shows published releases only
- if the running version is not yet published, the app still shows the running version but `current_release` may be empty

## Private Repo Token Setup

For private repositories, configure a server-side token in the personal [docker-compose.override.yml](/home/ubuntu/dosh/docker-compose.override.yml) path through the `GITHUB_RELEASES_TOKEN` environment variable.

Current override pattern:

```yaml
services:
  backend:
    environment:
      - GITHUB_RELEASES_TOKEN=${GITHUB_RELEASES_TOKEN:-}
```

Guidance:

- keep the token out of the shared base [docker-compose.yml](/home/ubuntu/dosh/docker-compose.yml)
- prefer a minimal read-capable token for runtime GitHub release access
- when the repository becomes public, the backend can continue working without a token

## What Remains Manual

Deployment is still manual.

After the release tag and GitHub Release exist, continue using [release_with_migrations.sh](/home/ubuntu/dosh/scripts/release_with_migrations.sh) for the current deployment path:

1. build backend and frontend images
2. back up the SQLite database
3. run Alembic upgrade or baseline stamping
4. restart the stack
5. verify `/api/health` and `/api/release-notes`

## GitHub Settings Requirement

Configure `main` branch protection so the `SonarQube` status check is required before merge.

That repository setting is the release gate for code quality. The release-tagging workflow is intentionally not responsible for waiting on Sonar after merge.

## Failure Handling

- version mismatch: fix the inconsistent version touchpoint before merging
- missing or unreleased release entry: convert the relevant `Unreleased` content into a matching `released` entry before merging
- duplicate tag: GitHub skips tag creation rather than creating a second tag
- missing token for private repo: runtime release info degrades safely instead of breaking the app
- GitHub API failure: runtime release info degrades safely and should be retried later

## Future Extension

This workflow is intentionally positioned so a future tag-triggered job can also build and publish versioned Docker images for the same release tag without changing release authority or in-app release semantics.
