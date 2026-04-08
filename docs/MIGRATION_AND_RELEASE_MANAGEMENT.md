# Dosh Migration And Release Management

This document is the source of truth for Dosh release versioning, Alembic migration management, and the expected deployment update sequence.

Use it when:

- changing the app version
- creating or reviewing database migrations
- preparing a deployment or rollback
- updating release notes or deciding what release information should appear in the app
- deciding whether the product is still `alpha` or has earned `beta`

## Current Baseline

- current canonical app version: `0.1.3-alpha`
- current UI display format: `v0.1.3-alpha`
- current app state classification: `alpha`
- current schema management authority: Alembic
- current deployment path: Docker Compose

The current repository state and deployed state are treated as aligned for this migration baseline.

## Versioning Rules

Dosh uses semantic versioning in the form `MAJOR.MINOR.PATCH`.

Pre-release suffixes are appended with a hyphen:

- `alpha`: active development, workflow and release model still evolving
- `beta`: release/update path stable, broader real-world confidence, remaining work mostly hardening and polish
- `rcN`: release candidate, such as `1.0.0-rc1`

Rules for incrementing versions:

- increase `PATCH` for backward-compatible fixes and small operational improvements
- increase `MINOR` for backward-compatible feature additions or meaningful workflow expansion
- increase `MAJOR` for intentionally breaking changes or a major compatibility reset
- remove the suffix only when Dosh is ready for a production-grade release

Storage and display rules:

- store the canonical version as plain semver text, for example `0.1.2-alpha`
- display it in the UI with a `v` prefix, for example `v0.1.2-alpha`
- do not store the `v` prefix as part of the canonical version value

## Release Notes Management

[RELEASE_NOTES.md](/home/ubuntu/dosh/docs/RELEASE_NOTES.md) is the repo-managed release-content source of truth.

Management rules:

- keep user-facing release content in `RELEASE_NOTES.md`, not in frontend code
- keep deeper engineering history and implementation detail in [CHANGES.md](/home/ubuntu/dosh/docs/CHANGES.md)
- update `RELEASE_NOTES.md` whenever a version bump represents a releasable change worth surfacing in the app
- keep release-note entries concise, version-oriented, and suitable for direct app display

In-app visibility rules:

- validated `released` entries from `RELEASE_NOTES.md` are published into GitHub Releases through the tag workflow
- the app reads published GitHub release content through the backend release-notes endpoint
- the app should show the currently running version's published release as the primary entry when one exists
- the app may also show newer published versions as available updates when they exist in GitHub but have not yet been applied to the running app
- unreleased or draft entries must not be shown in-app

Practical expectations for entries:

- released entries should identify the version using the `## <version> | released | <date>` format
- unreleased work should accumulate under a versionless `## Unreleased` section until the release version is intentionally chosen
- released entries may be published into GitHub Releases and then surfaced in the app
- the `Unreleased` section is for repo planning and preparation only until that content is assigned a real version and published

## Migration Rules

Alembic is the only supported schema migration mechanism for backend schema changes.

Migration expectations:

- every schema change must ship in an Alembic revision
- every revision filename must include a short descriptive slug
- the slug should describe the schema intent, not a ticket id or vague internal phrase
- keep each migration focused on one logical schema change where practical
- prefer additive or explicitly staged changes over risky in-place mutation when rollout safety is unclear

Examples of acceptable slugs:

- `baseline_current_schema`
- `add_budget_health_threshold_fields`
- `drop_legacy_income_isfixed_column`
- `remove_appinfo_table`

Useful Alembic commands from [backend](/home/ubuntu/dosh/backend):

```bash
./.venv/bin/alembic upgrade head
./.venv/bin/alembic downgrade -1
./.venv/bin/alembic current
./.venv/bin/alembic history
./.venv/bin/alembic stamp <revision>
```

For already aligned existing environments being brought under Alembic control, use `stamp` against the baseline revision instead of replaying historical one-off patches.

## Release Sequence

The standard release sequence is:

1. build the target backend and frontend images
2. back up the SQLite database
3. run `alembic upgrade head`
4. start or refresh the application containers
5. verify health and smoke behavior

When a release includes a version bump, also:

6. update [RELEASE_NOTES.md](/home/ubuntu/dosh/docs/RELEASE_NOTES.md) for that version
7. verify the in-app release notes and version display reflect the expected current version and any newer released updates correctly
8. ensure the `SonarQube` status check has passed before the version-bump merge reaches protected `main`

Recommended release-notes flow:

1. keep in-progress release content under `## Unreleased`
2. when the release version is intentionally chosen, convert that content into a new top `## <version> | released | <date>` entry
3. leave `## Unreleased` in place above it for future work

The repository includes [release_with_migrations.sh](/home/ubuntu/dosh/scripts/release_with_migrations.sh) to run the expected Compose-based build, backup, migration, and restart flow.

Guidance:

- do not rely on app startup to perform normal schema upgrades
- do not skip the backup step before a schema-changing release
- do not treat a partially migrated deployment as a successful release
- if an environment uses an optional local [docker-compose.override.yml](/home/ubuntu/dosh/docker-compose.override.yml) or equivalent server-specific compose file, include it explicitly when running the release script; repo-level release guidance should still treat the base script invocation as the canonical default

## Rollback

The initial rollback model is intentionally simple:

1. stop or replace the failed deployment
2. restore the pre-migration SQLite backup
3. redeploy the previously working application version

Rollback should be treated as a coordinated app-and-database restore, not just a container restart.

## Alpha To Beta Criteria

Dosh should remain `alpha` until all of the following are true:

- Alembic migrations are the normal path for schema updates
- release sequencing is explicit and repeatable
- startup is no longer depended on for schema mutation
- backup and rollback steps are documented and usable
- at least one full upgrade using the new model has been exercised successfully

At that point, Dosh can be reconsidered for `beta`.
