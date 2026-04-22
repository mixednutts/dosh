# GitHub Release Runbook

This runbook is the high-level operator guide for Dosh GitHub-managed releases.

Use it alongside [GITHUB_RELEASE_MANAGEMENT_WORKFLOW_PLAN.md](/home/ubuntu/dosh/docs/plans/GITHUB_RELEASE_MANAGEMENT_WORKFLOW_PLAN.md), [MIGRATION_AND_RELEASE_MANAGEMENT.md](/home/ubuntu/dosh/docs/MIGRATION_AND_RELEASE_MANAGEMENT.md), and [MIGRATION_AND_VERSION_SAFETY.md](/home/ubuntu/dosh/docs/MIGRATION_AND_VERSION_SAFETY.md).

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
- [Layout.test.jsx](/home/ubuntu/dosh/frontend/src/__tests__/Layout.test.jsx)

**Automated version bump:**

Instead of manually editing each file, use the bump script:

```bash
python scripts/bump_version.py 0.3.2-alpha
```

This updates all touchpoints and runs validation. Then commit:

```bash
git add -A
git commit -m "release: bump version to 0.3.2-alpha"
```

The script handles:
- All version touchpoint files
- npm install to sync package-lock.json
- Test expectation updates in Layout.test.jsx
- Post-bump validation

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

After the release tag and GitHub Release exist:

### Production Server Deployment

On the production server, pull and run the GHCR image:

```bash
# docker-compose.yml should reference ghcr.io/mixednutts/dosh:latest
docker compose pull
docker compose up -d
```

The entrypoint script automatically runs Alembic migrations before starting the app.

### Development Server Deployment

On the development server, build from local source:

```bash
docker compose up --build -d
```

The `docker-compose.override.yml` provides the local build context and Traefik labels.

### Verification

After deployment, verify:
```bash
curl -sS http://localhost:3080/api/health
curl -sS http://localhost:3080/api/release-notes
```

## GitHub Settings Requirement

Configure `main` branch protection so the `SonarQube` status check is required before merge.

That repository setting is the release gate for code quality. The release-tagging workflow is intentionally not responsible for waiting on Sonar after merge.

## Failure Handling

- version mismatch: fix the inconsistent version touchpoint before merging
- missing or unreleased release entry: convert the relevant `Unreleased` content into a matching `released` entry before merging
- duplicate tag: GitHub skips tag creation rather than creating a second tag
- missing token for private repo: runtime release info degrades safely instead of breaking the app
- GitHub API failure: runtime release info degrades safely and should be retried later

### Recovery Workflow

If the auto-tag workflow fails (e.g., due to SonarQube failure at merge time), use the **Manual Tag and Release** workflow:

1. Go to **Actions** → **Manual Tag and Release**
2. Click **Run workflow**
3. Parameters:
   - **version**: The version to release (e.g., `0.3.1-alpha`)
   - **commit_sha**: (Optional) The specific commit to tag. Leave empty for HEAD.
   - **force**: Check this to recreate the tag if it already exists (use with caution)
4. Click **Run workflow**

This workflow will:
- Validate all version touchpoints at the target commit
- Create the annotated tag `v<version>`
- Create or update the GitHub Release

Use this for:
- Recovery when auto-tag failed during merge
- Re-tagging a different commit after fixes
- Backfilling releases for historical tags

**Note:** The `Publish Release From Tag` workflow is for republishing GitHub Releases for existing tags only. For new tags or retagging, use `Manual Tag and Release`.

## Docker Image Publishing

Dosh publishes container images to the GitHub Container Registry (GHCR).

### Manual Publishing (Current)

After a GitHub Release tag exists, manually trigger the Docker publish workflow:

1. Go to **Actions → Publish Docker Image to GHCR**
2. Click **Run workflow**
3. Parameters:
   - **tag_name**: The release tag to build (e.g., `v0.6.6-alpha`)
   - **push_latest**: Check to also tag the image as `latest` (default: unchecked)
4. Click **Run workflow**

The workflow will:
- Check out the repository at the specified tag
- Validate version touchpoints via `scripts/release_management.py`
- Build the multi-stage Dockerfile for **linux/amd64** and **linux/arm64** (QEMU + Buildx), producing a **multi-arch manifest list** per tag
- Push to `ghcr.io/mixednutts/dosh:<version>`
- Optionally push to `ghcr.io/mixednutts/dosh:latest`
- Generate a build attestation

After publishing, confirm both platforms are present (requires a logged-in `docker` or public visibility):

```bash
docker buildx imagetools inspect ghcr.io/mixednutts/dosh:<version>
```

### Authentication

No additional secrets are required. The workflow uses the built-in `GITHUB_TOKEN` with `packages: write` permission.

Ensure repository settings allow Actions to write packages:
- **Settings → Actions → General → Workflow permissions**: Select "Read and write permissions"

### Tag Strategy

| Tag | Example | Purpose |
|-----|---------|---------|
| Version | `0.6.6-alpha` | Immutable release image |
| Latest | `latest` | Rolling pointer to most recent build |

### Future Automation

The `Publish Release From Tag` workflow includes a disabled trigger that can invoke the Docker publish workflow automatically. To enable:

1. Remove `if: false` from the "Trigger Docker publish workflow" step in `.github/workflows/release-on-tag.yml`
2. Uncomment the `push: tags:` trigger in `.github/workflows/publish-docker-image.yml`

This will cause every new release tag to automatically build and publish its Docker image.

## Future Extension

This workflow is intentionally positioned so a future tag-triggered job can also build and publish versioned Docker images for the same release tag without changing release authority or in-app release semantics.
