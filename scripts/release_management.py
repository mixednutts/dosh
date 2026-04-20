#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.release_markdown import parse_release_notes, render_release_body  # noqa: E402


VERSION_PATTERN = re.compile(r"^\d+\.\d+\.\d+(?:-(?:alpha|beta|rc\d+))?$")
ZERO_SHA = "0" * 40
DOCS_RELEASE_NOTES_PATH = "docs/RELEASE_NOTES.md"
VERSION_TOUCHPOINTS = {
    "backend canonical version": ("backend/app/version.py", re.compile(r'APP_VERSION\s*=\s*os\.getenv\("APP_VERSION",\s*"([^"]+)"\)')),
    "compose environment APP_VERSION": ("docker-compose.yml", re.compile(r"-\s*APP_VERSION=([^\s]+)")),
    "compose frontend build arg APP_VERSION": ("docker-compose.yml", re.compile(r'APP_VERSION:\s*"([^"]+)"')),
    "backend docker default APP_VERSION": ("Dockerfile", re.compile(r"ENV APP_VERSION=([^\s]+)")),
    "frontend package version": ("frontend/package.json", re.compile(r'"version"\s*:\s*"([^"]+)"')),
    "frontend package-lock version": ("frontend/package-lock.json", re.compile(r'"version"\s*:\s*"([^"]+)"')),
    "frontend fallback display version": ("frontend/src/components/Layout.jsx", re.compile(r"return `v\$\{version \|\| '([^']+)'\}`")),
}


def _read_ref_text(ref: str, path: str) -> str:
    if ref.upper() == "WORKTREE":
        return (ROOT_DIR / path).read_text(encoding="utf-8")

    result = subprocess.run(
        ["git", "show", f"{ref}:{path}"],
        cwd=ROOT_DIR,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Unable to read {path} at {ref}: {result.stderr.strip() or 'file not found'}")
    return result.stdout


def _extract_match(label: str, text: str, pattern: re.Pattern[str]) -> str:
    match = pattern.search(text)
    if not match:
        raise RuntimeError(f"Unable to locate {label}.")
    return match.group(1).strip()


def canonical_version_for_ref(ref: str) -> str:
    version_text = _read_ref_text(ref, "backend/app/version.py")
    version = _extract_match("backend canonical version", version_text, VERSION_TOUCHPOINTS["backend canonical version"][1])
    if not VERSION_PATTERN.fullmatch(version):
        raise RuntimeError(f"Canonical version {version!r} is not a supported Dosh semver value.")
    return version


def version_changed(base_ref: str, head_ref: str) -> bool:
    if not base_ref or base_ref == ZERO_SHA:
        return False
    return canonical_version_for_ref(base_ref) != canonical_version_for_ref(head_ref)


def validate_version_touchpoints(ref: str) -> dict[str, str]:
    canonical_version = canonical_version_for_ref(ref)
    values = {"backend canonical version": canonical_version}

    for label, (path, pattern) in VERSION_TOUCHPOINTS.items():
        text = _read_ref_text(ref, path)
        value = _extract_match(label, text, pattern)
        values[label] = value
        if value != canonical_version:
            raise RuntimeError(
                f"{label} is {value!r} at {path}, but backend canonical version is {canonical_version!r}."
            )

    return values


def release_note_entries(ref: str) -> list:
    return parse_release_notes(_read_ref_text(ref, DOCS_RELEASE_NOTES_PATH))


def release_entry_for_version(ref: str, version: str):
    for entry in release_note_entries(ref):
        if entry.version == version:
            return entry
    raise RuntimeError(f"docs/RELEASE_NOTES.md does not contain an entry for version {version}.")


def validate_release_entry(ref: str, version: str):
    entry = release_entry_for_version(ref, version)
    if entry.status != "released":
        raise RuntimeError(f"Release entry for {version} is {entry.status!r}, not 'released'.")
    return entry


def validate_ref(ref: str, expect_tag: str | None = None, require_release_entry: bool = False) -> dict[str, str]:
    values = validate_version_touchpoints(ref)
    version = values["backend canonical version"]

    if expect_tag and expect_tag != f"v{version}":
        raise RuntimeError(f"Tag {expect_tag!r} does not match canonical version v{version}.")

    if require_release_entry:
        validate_release_entry(ref, version)

    return values


def release_body_for_version(ref: str, version: str) -> str:
    entry = validate_release_entry(ref, version)
    body = render_release_body(entry)
    if not body:
        raise RuntimeError(f"Release entry for {version} does not contain publishable body content.")
    return body


def _print_json(data) -> None:
    print(json.dumps(data, indent=2, sort_keys=True))


def main() -> int:
    parser = argparse.ArgumentParser(description="Dosh release-management helper.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    canonical_parser = subparsers.add_parser("canonical-version")
    canonical_parser.add_argument("--ref", default="WORKTREE")

    changed_parser = subparsers.add_parser("version-changed")
    changed_parser.add_argument("--base-ref", required=True)
    changed_parser.add_argument("--head-ref", required=True)

    validate_parser = subparsers.add_parser("validate")
    validate_parser.add_argument("--ref", default="WORKTREE")
    validate_parser.add_argument("--expect-tag")
    validate_parser.add_argument("--require-release-entry", action="store_true")

    release_body_parser = subparsers.add_parser("release-body")
    release_body_parser.add_argument("--ref", default="WORKTREE")
    release_body_parser.add_argument("--version", required=True)

    args = parser.parse_args()

    try:
        if args.command == "canonical-version":
            print(canonical_version_for_ref(args.ref))
            return 0
        if args.command == "version-changed":
            return 0 if version_changed(args.base_ref, args.head_ref) else 1
        if args.command == "validate":
            _print_json(
                validate_ref(
                    args.ref,
                    expect_tag=args.expect_tag,
                    require_release_entry=args.require_release_entry,
                )
            )
            return 0
        if args.command == "release-body":
            print(release_body_for_version(args.ref, args.version))
            return 0
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
