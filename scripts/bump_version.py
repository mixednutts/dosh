#!/usr/bin/env python3
"""
Bump version across all touchpoints in the Dosh repository.

Usage:
    python scripts/bump_version.py 0.3.2-alpha

This will update:
- backend/app/version.py (canonical)
- docker-compose.yml
- backend/Dockerfile
- frontend/Dockerfile
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


def bump_docker_compose(version: str) -> None:
    path = ROOT_DIR / "docker-compose.yml"
    # Match APP_VERSION=xxx or APP_VERSION: "xxx"
    pattern = re.compile(r'(APP_VERSION[=:]\s*"?)([^"\s]+)("?)')
    update_file(path, pattern, rf'\g<1>{version}\g<3>', "docker-compose.yml")


def bump_backend_dockerfile(version: str) -> None:
    path = ROOT_DIR / "backend" / "Dockerfile"
    pattern = re.compile(r'(ENV APP_VERSION=)([^\s]+)')
    update_file(path, pattern, rf'\g<1>{version}', "backend/Dockerfile")


def bump_frontend_dockerfile(version: str) -> None:
    path = ROOT_DIR / "frontend" / "Dockerfile"
    pattern = re.compile(r'(ARG APP_VERSION=)([^\s]+)')
    update_file(path, pattern, rf'\g<1>{version}', "frontend/Dockerfile")


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
    pattern3 = re.compile(r"(getByText\('v)[^']+(")")
    pattern4 = re.compile(r"(findByText\('v)[^']+(")")
    pattern5 = re.compile(r"(findByRole\([^)]+\{\s*name:\s*\/v)[^/]+(")")
    
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
    print("\nAll version touchpoints validated successfully!")
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
    bump_frontend_dockerfile(args.version)
    bump_package_json(args.version)
    if not args.skip_npm:
        bump_package_lock(args.version)
    else:
        print("  frontend/package-lock.json: skipped (use --skip-npm)")
    bump_layout_fallback(args.version)
    bump_layout_tests(args.version)

    if not args.no_validate:
        print()
        validate_all_touchpoints(args.version)

    print("\nDone! Review the changes with: git diff")
    print("Then commit with: git add -A && git commit -m \"release: bump version to {}\"".format(args.version))


if __name__ == "__main__":
    main()
