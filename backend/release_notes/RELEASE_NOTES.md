# Dosh Release Notes

## 0.1.2-alpha | released | 2026-04-08

Dosh now lets the in-app release notes reveal previous released versions without crowding the default current-version view.

### Enhancements

- Added a `View previous releases` option to the release-notes modal so older released versions can be revealed on demand
- Extended the backend release-notes payload to return previous released entries alongside the running release and any newer updates
- Added focused regression coverage for the previous-releases payload shape and modal interaction

## 0.1.1-alpha | released | 2026-04-08

Dosh now hardens release-notes parsing against regex-driven denial-of-service risk.

### Fixes

- Replaced regex-based release-note header parsing with bounded string parsing in the backend release-notes loader
- Added dedicated backend regression coverage for release-note header parsing, payload filtering, and version ordering behavior
- Redeployed the app on the shared Compose release path after the parser hardening update

## 0.1.0-alpha | released | 2026-04-08

Dosh now has a formal versioning and migration-management foundation.

### Highlights

- Added a canonical app version of `0.1.0-alpha`, displayed in the app as `v0.1.0-alpha`
- Added Alembic as the supported database migration path from the current aligned schema baseline
- Added a release workflow with database backup, migration, restart, and verification guidance
- Added a runtime app-info endpoint so deployed environments can report their version and schema revision

### Fixes

- Replaced the old hardcoded sidebar version text with the canonical runtime version
- Moved the expanded-sidebar version label below the product descriptor to avoid overlap with the logo and controls
- Upgraded Vite to the patched `6.4.2` release and cleared the reported audit issue
- Split major frontend routes into lazy-loaded chunks to reduce the initial bundle size
