#!/usr/bin/env python3
"""
Bump version across all touchpoints in the Dosh repository.

Usage:
    python scripts/bump_version.py 0.3.2-alpha

This will update:
- backend/app/version.py (canonical)
- docker-compose.yml
- backend/Dockerfile
- frontend/package.json
- frontend/package-lock.json (via npm install --package-lock-only)
- frontend/src/components/Layout.jsx
- frontend/src/__tests__/Layout.test.jsx

After running, review the changes and commit:
    git add -A
    git commit -m "release: bump version to 0.3.2-alpha"
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
VERSION_PATTERN = re.compile(r"^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc\d+))?$")


def validate_version(version: str) -> None:
    if not VERSION_PATTERN.fullmatch(version):
        print(f"Error: '{version}' is not a valid semver version", file=sys.stderr)
        print("Expected format: MAJOR.MINOR.PATCH[-prerelease]", file=sys.stderr)
        print("Examples: 0.3.1-alpha, 1.0.0, 2.1.0-beta", file=sys.stderr)
        sys.exit(1)


def update_file(path: Path, pattern: re.Pattern, replacement: str, description: str) -> bool:
    """Update a file using regex substitution. Returns True if changed."""
    text = path.read_text(encoding="utf-8")
    new_text, count = pattern.subn(replacement, text)
    if count == 0:
        print(f"Warning: No matches found in {path}")
        return False
    if new_text == text:
        print(f"  {description}: already up to date")
        return False
    path.write_text(new_text, encoding="utf-8")
    print(f"  {description}: updated")
    return True


def bump_backend_version(version: str) -> None:
    path = ROOT_DIR / "backend" / "app" / "version.py"
    pattern = re.compile(r'(APP_VERSION\s*=\s*os\.getenv\("APP_VERSION",\s*")[^"]+(")')
    update_file(path, pattern, rf'\g<1>{version}\g<2>', "backend/app/version.py")


def bump_backend_dockerfile(version: str) -> None:
    path = ROOT_DIR / "Dockerfile"
    pattern = re.compile(r'(ENV APP_VERSION=)([^\s]+)')
    update_file(path, pattern, rf'\g<1>{version}', "Dockerfile")


def bump_package_json(version: str) -> None:
    path = ROOT_DIR / "frontend" / "package.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("version") == version:
        print("  frontend/package.json: already up to date")
        return
    data["version"] = version
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print("  frontend/package.json: updated")


def bump_package_lock(version: str) -> None:
    """Run npm install to update package-lock.json"""
    frontend_dir = ROOT_DIR / "frontend"
    result = subprocess.run(
        ["npm", "install", "--package-lock-only"],
        cwd=frontend_dir,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(f"  Warning: npm install --package-lock-only failed: {result.stderr}")
    else:
        print("  frontend/package-lock.json: updated via npm")


def bump_layout_fallback(version: str) -> None:
    path = ROOT_DIR / "frontend" / "src" / "components" / "Layout.jsx"
    pattern = re.compile(r"(return `v\$\{version \|\| ')[^']+('}`)")
    update_file(path, pattern, rf'\g<1>{version}\g<2>', "frontend/src/components/Layout.jsx")


def bump_layout_tests(version: str) -> None:
    path = ROOT_DIR / "frontend" / "src" / "__tests__" / "Layout.test.jsx"
    # Update both '0.3.0-alpha' style strings and 'v0.3.0-alpha' style strings
    pattern1 = re.compile(r"version:\s*'[^']+'")
    pattern2 = re.compile(r"current_version:\s*'[^']+'")
    pattern3 = re.compile(r"(getByText\('v)[^']+('\))")
    pattern4 = re.compile(r"(findByText\('v)[^']+('\))")
    pattern5 = re.compile(r"(findByRole\([^)]*?\{\s*name:\s*\/v)\d+\.\d+\.\d+(?:-(?:alpha|beta|rc\d+))?(/i\s*\})")
    
    text = path.read_text(encoding="utf-8")
    original = text
    
    text = pattern1.sub(f"version: '{version}'", text)
    text = pattern2.sub(f"current_version: '{version}'", text)
    text = pattern3.sub(rf'\g<1>{version}\g<2>', text)
    text = pattern4.sub(rf'\g<1>{version}\g<2>', text)
    text = pattern5.sub(rf'\g<1>{version}\g<2>', text)
    
    if text == original:
        print("  frontend/src/__tests__/Layout.test.jsx: already up to date")
    else:
        path.write_text(text, encoding="utf-8")
        print("  frontend/src/__tests__/Layout.test.jsx: updated")


def bump_backend_smoke_tests(version: str) -> None:
    """Update version assertions in backend smoke tests."""
    path = ROOT_DIR / "backend" / "tests" / "test_app_smoke.py"
    
    # Pattern to match version assertions like: assert response.json()["version"] == "0.3.1-alpha"
    patterns = [
        (re.compile(r'(assert response\.json\(\)\["version"\] == ")[^"]+(")'), 'response version'),
        (re.compile(r'(assert payload\["current_version"\] == ")[^"]+(")'), 'payload current_version'),
        (re.compile(r'(assert payload\["current_release"\]\["version"\] == ")[^"]+(")'), 'payload current_release version'),
    ]
    
    text = path.read_text(encoding="utf-8")
    original = text
    
    for pattern, desc in patterns:
        text = pattern.sub(rf'\g<1>{version}\g<2>', text)
    
    if text == original:
        print("  backend/tests/test_app_smoke.py: already up to date")
    else:
        path.write_text(text, encoding="utf-8")
        print("  backend/tests/test_app_smoke.py: updated")


def check_migration_safety() -> bool:
    """Check that migrations don't depend on APP_VERSION."""
    migrations_dir = ROOT_DIR / "backend" / "alembic" / "versions"
    issues = []
    
    for migration_file in migrations_dir.glob("*.py"):
        if migration_file.name.startswith("__"):
            continue
        content = migration_file.read_text(encoding="utf-8")
        
        dangerous_patterns = [
            ("APP_VERSION", "APP_VERSION constant"),
            ("app_version", "app_version variable"),
            ("from app.version", "version module import"),
            ("import version", "version import"),
            ('version.py', "version.py reference"),
        ]
        
        for pattern, description in dangerous_patterns:
            if pattern in content:
                issues.append(f"  - {migration_file.name}: {description}")
    
    if issues:
        print("\n⚠️  WARNING: Potential version-dependent migration logic detected:")
        for issue in issues:
            print(issue)
        print("\nMigrations should NOT depend on APP_VERSION.")
        print("See: docs/MIGRATION_AND_VERSION_SAFETY.md")
        return False
    
    return True


def validate_all_touchpoints(version: str) -> bool:
    """Run the release management validation."""
    result = subprocess.run(
        [sys.executable, "scripts/release_management.py", "validate", "--ref", "WORKTREE"],
        cwd=ROOT_DIR,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("\nValidation failed:")
        print(result.stderr)
        return False
    
    # Also check migration safety
    if not check_migration_safety():
        print("\n⚠️  Migration safety check failed.")
        return False
    
    print("\n✅ All version touchpoints validated successfully!")
    print("✅ Migration safety check passed!")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Bump version across all touchpoints in the Dosh repository"
    )
    parser.add_argument("version", help="New version (e.g., 0.3.2-alpha)")
    parser.add_argument(
        "--skip-npm",
        action="store_true",
        help="Skip npm install for package-lock.json (faster, but leaves lockfile stale)",
    )
    parser.add_argument(
        "--no-validate",
        action="store_true",
        help="Skip validation after bumping",
    )
    args = parser.parse_args()

    validate_version(args.version)

    print(f"Bumping version to {args.version}...\n")

    bump_backend_version(args.version)
    bump_docker_compose(args.version)
    bump_backend_dockerfile(args.version)
    bump_package_json(args.version)
    if not args.skip_npm:
        bump_package_lock(args.version)
    else:
        print("  frontend/package-lock.json: skipped (use --skip-npm)")
    bump_layout_fallback(args.version)
    bump_layout_tests(args.version)
    bump_backend_smoke_tests(args.version)

    if not args.no_validate:
        print()
        validate_all_touchpoints(args.version)

    print("\nDone! Review the changes with: git diff")
    print("Then commit with: git add -A && git commit -m \"release: bump version to {}\"".format(args.version))


if __name__ == "__main__":
    main()


def check_for_version_sensitive_migration_logic(version: str) -> bool:
    """Check if any migration depends on app version."""
    migrations_dir = ROOT_DIR / "backend" / "alembic" / "versions"
    issues = []
    
    for f in migrations_dir.glob("*.py"):
        content = f.read_text(encoding="utf-8")
        if "APP_VERSION" in content or "app_version" in content.lower():
            issues.append(f"  - {f.name}: contains APP_VERSION reference")
        if "version" in content.lower() and "if" in content.lower():
            # Check for conditional version logic
            lines = content.lower().split("\n")
            for i, line in enumerate(lines, 1):
                if "version" in line and any(x in line for x in [">", "<", "==", ">=", "<="]):
                    issues.append(f"  - {f.name}:{i}: potential version comparison")
    
    if issues:
        print("Warning: Potential version-sensitive migration logic found:")
        for issue in issues:
            print(issue)
        return False
    return True
