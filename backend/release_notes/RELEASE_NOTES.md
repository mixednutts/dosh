# Dosh Release Notes

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
