from __future__ import annotations

import json
import logging
import os
import time
from pathlib import Path
from typing import Any
from urllib import error, request

from .release_markdown import (
    ParsedReleaseNote,
    parse_release_body,
    parse_release_note_header as _parse_release_note_header,
    parse_release_notes as _parse_release_notes,
)
from .version import APP_VERSION


logger = logging.getLogger(__name__)

_RELEASE_NOTES_PATH = Path(__file__).resolve().parents[2] / "docs" / "RELEASE_NOTES.md"
_PRERELEASE_STAGE_ORDER = {
    "alpha": 0,
    "beta": 1,
    "rc": 2,
}
_CACHE: dict[str, Any] = {
    "repository": None,
    "fetched_at": 0.0,
    "entries": None,
}


def _parse_prerelease_suffix(suffix: str) -> tuple[int, int]:
    if not suffix:
        return (3, 0)

    for stage_name, stage_order in _PRERELEASE_STAGE_ORDER.items():
        if suffix == stage_name:
            return (stage_order, 0)
        if suffix.startswith(stage_name):
            stage_num_text = suffix[len(stage_name):]
            if stage_num_text.isdigit():
                return (stage_order, int(stage_num_text))
            return (0, -1)

    return (0, -1)


def _version_key(version: str) -> tuple[int, int, int, int, int]:
    normalized = version.strip()
    if not normalized:
        return (0, 0, 0, -1, -1)

    base_version, separator, prerelease = normalized.partition("-")
    version_parts = base_version.split(".")
    if len(version_parts) != 3 or not all(part.isdigit() for part in version_parts):
        return (0, 0, 0, -1, -1)
    if separator and not prerelease:
        return (0, 0, 0, -1, -1)

    major, minor, patch = (int(part) for part in version_parts)
    stage, stage_num = _parse_prerelease_suffix(prerelease.lower() if prerelease else "")
    return (major, minor, patch, stage, stage_num)


def _github_repository() -> str:
    return os.getenv("GITHUB_RELEASES_REPOSITORY") or os.getenv("GITHUB_REPOSITORY") or "mixednutts/dosh"


def _cache_ttl_seconds() -> int:
    value = os.getenv("GITHUB_RELEASES_CACHE_TTL_SECONDS", "300").strip()
    try:
        return max(0, int(value))
    except ValueError:
        logger.warning(
            "Invalid GITHUB_RELEASES_CACHE_TTL_SECONDS value %r; falling back to 300 seconds.",
            value,
        )
        return 300


def _github_release_headers() -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "dosh-release-notes",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    token = os.getenv("GITHUB_RELEASES_TOKEN", "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def _request_json(url: str) -> Any:
    req = request.Request(url, headers=_github_release_headers())
    with request.urlopen(req, timeout=5) as response:  # noqa: S310 - GitHub API host is controlled by code
        return json.loads(response.read().decode("utf-8"))


def _read_release_notes() -> list[ParsedReleaseNote]:
    return _parse_release_notes(_RELEASE_NOTES_PATH.read_text(encoding="utf-8"))


def _release_date_from_api(release: dict[str, Any]) -> str:
    for field in ("published_at", "created_at"):
        value = str(release.get(field, "")).strip()
        if value:
            return value[:10]
    return ""


def _parse_github_release(release: dict[str, Any]) -> ParsedReleaseNote | None:
    if release.get("draft"):
        return None

    tag_name = str(release.get("tag_name", "")).strip()
    if not tag_name.startswith("v"):
        return None
    version = tag_name[1:]
    if _version_key(version) == (0, 0, 0, -1, -1):
        return None

    summary, sections = parse_release_body(str(release.get("body") or ""))
    return ParsedReleaseNote(
        version=version,
        status="released",
        release_date=_release_date_from_api(release),
        summary=summary,
        sections=sections,
    )


def _published_github_releases(fetcher=None) -> list[ParsedReleaseNote]:
    repository = _github_repository()
    ttl_seconds = _cache_ttl_seconds()
    now = time.monotonic()

    if fetcher is None and ttl_seconds > 0:
        cached_entries = _CACHE.get("entries")
        cached_repository = _CACHE.get("repository")
        cached_at = float(_CACHE.get("fetched_at") or 0.0)
        if cached_repository == repository and cached_entries is not None and now - cached_at < ttl_seconds:
            return cached_entries

    fetch = fetcher or (
        lambda: _request_json(f"https://api.github.com/repos/{repository}/releases?per_page=100")
    )
    releases = fetch()
    if not isinstance(releases, list):
        raise ValueError("GitHub Releases API did not return a list payload.")
    entries = [entry for entry in (_parse_github_release(release) for release in releases) if entry is not None]
    entries.sort(key=lambda entry: _version_key(entry.version), reverse=True)

    if fetcher is None and ttl_seconds > 0:
        _CACHE["repository"] = repository
        _CACHE["fetched_at"] = now
        _CACHE["entries"] = entries

    return entries


def _empty_release_notes_payload(current_version: str) -> dict[str, Any]:
    return {
        "current_version": current_version,
        "update_available": False,
        "newer_release_count": 0,
        "previous_release_count": 0,
        "current_release": None,
        "newer_releases": [],
        "previous_releases": [],
    }


def release_notes_payload(current_version: str = APP_VERSION, fetcher=None) -> dict[str, Any]:
    try:
        released_entries = _published_github_releases(fetcher=fetcher)
    except FileNotFoundError:
        logger.warning("Release notes source file is missing.", exc_info=True)
        return _empty_release_notes_payload(current_version)
    except (error.HTTPError, error.URLError, TimeoutError, OSError, ValueError) as exc:
        logger.warning("Unable to load GitHub release notes for %s: %s", _github_repository(), exc)
        return _empty_release_notes_payload(current_version)

    current_entry = next((entry for entry in released_entries if entry.version == current_version), None)
    newer_entries = [entry for entry in released_entries if _version_key(entry.version) > _version_key(current_version)]
    previous_entries = [entry for entry in released_entries if _version_key(entry.version) < _version_key(current_version)]

    def serialize(entry: ParsedReleaseNote) -> dict[str, Any]:
        return {
            "version": entry.version,
            "status": entry.status,
            "release_date": entry.release_date,
            "summary": entry.summary,
            "sections": entry.sections,
        }

    return {
        "current_version": current_version,
        "update_available": bool(newer_entries),
        "newer_release_count": len(newer_entries),
        "previous_release_count": len(previous_entries),
        "current_release": serialize(current_entry) if current_entry else None,
        "newer_releases": [serialize(entry) for entry in newer_entries],
        "previous_releases": [serialize(entry) for entry in previous_entries],
    }
