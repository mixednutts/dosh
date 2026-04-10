# Migration and Version Safety

This document defines how to safely handle database migrations that may depend on application version, and the safeguards required to prevent unstable releases.

## Current State (Safe)

Currently, migrations are **completely independent** of `APP_VERSION`:
- Alembic uses revision hashes (`32e38f31a3bd`) stored in `alembic_version` table
- `APP_VERSION` is display-only metadata
- No conditional logic in migrations based on app version

This is the **recommended** pattern and should be preserved.

## Future: If You Must Add Version-Dependent Migrations

### Anti-Pattern (Avoid)

```python
# backend/alembic/versions/xxxxx_example.py
def upgrade():
    # DON'T DO THIS - makes migration dependent on deployment timing
    if APP_VERSION >= "0.4.0":
        op.add_column(...)
```

This creates a deployment hazard: the migration's behavior depends on which code version is running when it executes.

### Recommended Pattern: Migration-Driven Version Gates

Instead of migrations checking app version, use **schema existence** as the gate:

```python
# backend/alembic/versions/xxxxx_add_new_feature.py
def upgrade():
    # Check if column already exists (idempotent)
    if not column_exists('periodincome', 'new_field'):
        op.add_column('periodincome', sa.Column('new_field', sa.String()))

def downgrade():
    if column_exists('periodincome', 'new_field'):
        op.drop_column('periodincome', 'new_field')
```

### Required Safeguards for Version-Dependent Logic

If you absolutely must have version-dependent behavior, implement these safeguards:

#### 1. Pre-Deployment Version Check

Add to deployment script (`scripts/release_with_migrations.sh`):

```bash
#!/bin/bash
set -e

# Get current deployed version from API (if available)
CURRENT_VERSION=$(curl -s http://localhost:8000/api/info | jq -r '.version' || echo "unknown")
NEW_VERSION=$(grep APP_VERSION backend/app/version.py | grep -o '"[^"]*"' | tr -d '"')

echo "Current: $CURRENT_VERSION"
echo "New: $NEW_VERSION"

# Validate migration order
alembic current
alembic heads

# Check if we're skipping any migrations
REQUIRED_REVISION=$(alembic heads -v | grep "^\w" | awk '{print $1}')
CURRENT_REVISION=$(alembic current -v | grep "^\w" | awk '{print $1}')

if [ "$REQUIRED_REVISION" != "$CURRENT_REVISION" ]; then
    echo "Migration required: $CURRENT_REVISION -> $REQUIRED_REVISION"
    # Backup before migration
    ./scripts/backup_db.sh
fi
```

#### 2. Migration Compatibility Check

Add validation script (`scripts/validate_migration_safety.py`):

```python
#!/usr/bin/env python3
"""
Validate that migrations can run safely against current production state.
Run this BEFORE deployment to catch version-dependent migration issues.
"""
import subprocess
import sys
from pathlib import Path

def check_migration_independence():
    """Ensure no migration references APP_VERSION."""
    migrations_dir = Path("backend/alembic/versions")
    issues = []
    
    for migration_file in migrations_dir.glob("*.py"):
        content = migration_file.read_text()
        
        # Check for dangerous patterns
        dangerous_patterns = [
            "APP_VERSION",
            "app_version",
            "version.py",
            "from app.version",
            "import version",
        ]
        
        for pattern in dangerous_patterns:
            if pattern in content:
                issues.append(f"{migration_file.name}: contains '{pattern}'")
    
    if issues:
        print("ERROR: Version-dependent migration logic detected:")
        for issue in issues:
            print(f"  - {issue}")
        print("\nMigrations should NOT depend on APP_VERSION.")
        print("Use schema introspection instead (op.get_bind(), inspector).")
        return False
    
    return True

def check_migration_order():
    """Ensure migration chain is continuous."""
    result = subprocess.run(
        ["alembic", "history", "--verbose"],
        capture_output=True,
        text=True,
        cwd="backend"
    )
    # Parse and validate history...
    return True

if __name__ == "__main__":
    safe = check_migration_independence() and check_migration_order()
    sys.exit(0 if safe else 1)
```

#### 3. CI/CD Gate

Add to GitHub workflow (`.github/workflows/validate-migrations.yml`):

```yaml
name: Validate Migrations

on:
  pull_request:
    paths:
      - "backend/alembic/versions/**"

jobs:
  validate-migrations:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Check for version-dependent migrations
        run: |
          if grep -r "APP_VERSION\|app_version" backend/alembic/versions/; then
            echo "ERROR: Migrations must not reference APP_VERSION"
            exit 1
          fi
      
      - name: Validate migration chain
        run: |
          cd backend
          alembic check  # Requires alembic 1.8+
```

#### 4. Deployment Rollback Plan

If version-dependent migrations are deployed incorrectly:

```bash
# Emergency rollback procedure
# 1. Stop app
docker compose stop backend

# 2. Restore database from backup (taken pre-migration)
cp backup/dosh_$(date +%Y%m%d)_*.db data/dosh.db

# 3. Revert to previous code version
git checkout v0.3.1-alpha

# 4. Restart
docker compose up -d
```

## Best Practices Summary

1. **Never** make migrations depend on `APP_VERSION`
2. Use **idempotent migrations** (check existence before altering)
3. Always **backup** before migration
4. Test migrations against **production-like data** before deployment
5. Have a **rollback plan** (database backup + previous version tag)
6. Use **feature flags** in code instead of version checks in migrations

## If You Break This Rule

If you must add version-dependent migration logic:

1. Update this document with the specific rationale
2. Add the safeguards above to CI/CD
3. Require two-person approval for the migration
4. Test in staging with production data snapshot
5. Schedule deployment during low-traffic period
6. Have rollback procedure tested and ready

## Related Documents

- [MIGRATION_AND_RELEASE_MANAGEMENT.md](./MIGRATION_AND_RELEASE_MANAGEMENT.md)
- [GITHUB_RELEASE_RUNBOOK.md](./GITHUB_RELEASE_RUNBOOK.md)
