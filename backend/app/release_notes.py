from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .version import APP_VERSION


_CANDIDATE_RELEASE_NOTES_PATHS = (
    Path(__file__).resolve().parents[1] / "release_notes" / "RELEASE_NOTES.md",
    Path(__file__).resolve().parents[2] / "docs" / "RELEASE_NOTES.md",
)
_RELEASED_STATUS = "released"
_UNRELEASED_STATUS = "unreleased"
_PRERELEASE_STAGE_ORDER = {
    "alpha": 0,
    "beta": 1,
    "rc": 2,
}


@dataclass(frozen=True)
class ParsedReleaseNote:
    version: str
    status: str
    release_date: str
    summary: str
    sections: list[dict[str, list[str]]]


def _parse_release_note_header(line: str) -> tuple[str, str, str] | None:
    stripped = line.strip()
    if not stripped.startswith("## "):
        return None

    parts = [part.strip() for part in stripped[3:].split("|")]
    if len(parts) != 3 or not all(parts):
        return None

    version, status, release_date = parts
    normalized_status = status.lower()
    if normalized_status not in {_RELEASED_STATUS, _UNRELEASED_STATUS}:
        return None

    return version, normalized_status, release_date


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


def _parse_release_notes(text: str) -> list[ParsedReleaseNote]:
    entries: list[ParsedReleaseNote] = []
    current_version: str | None = None
    current_status: str | None = None
    current_date: str | None = None
    current_summary: list[str] = []
    current_sections: list[dict[str, list[str]]] = []
    current_section_title: str | None = None
    current_section_items: list[str] = []

    def flush_section() -> None:
        nonlocal current_section_title, current_section_items, current_sections
        if current_section_title:
            current_sections.append({"title": current_section_title, "items": current_section_items[:]})
        current_section_title = None
        current_section_items = []

    def flush_entry() -> None:
        nonlocal current_version, current_status, current_date, current_summary, current_sections
        if current_version and current_status and current_date:
            flush_section()
            entries.append(
                ParsedReleaseNote(
                    version=current_version,
                    status=current_status,
                    release_date=current_date,
                    summary=" ".join(line.strip() for line in current_summary if line.strip()),
                    sections=current_sections[:],
                )
            )
        current_version = None
        current_status = None
        current_date = None
        current_summary = []
        current_sections = []

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        header_parts = _parse_release_note_header(line)
        if header_parts:
            flush_entry()
            current_version, current_status, current_date = header_parts
            continue
        if current_version is None:
            continue
        if line.startswith("### "):
            flush_section()
            current_section_title = line[4:].strip()
            continue
        if line.startswith("- ") and current_section_title:
            current_section_items.append(line[2:].strip())
            continue
        if line.strip():
            if current_section_title:
                current_section_items.append(line.strip())
            else:
                current_summary.append(line.strip())

    flush_entry()
    return entries


def read_release_notes() -> list[ParsedReleaseNote]:
    for path in _CANDIDATE_RELEASE_NOTES_PATHS:
        if path.exists():
            return _parse_release_notes(path.read_text(encoding="utf-8"))
    raise FileNotFoundError("RELEASE_NOTES.md was not found in any expected runtime location.")


def release_notes_payload(current_version: str = APP_VERSION) -> dict:
    entries = read_release_notes()
    released_entries = [entry for entry in entries if entry.status == _RELEASED_STATUS]
    released_entries.sort(key=lambda entry: _version_key(entry.version), reverse=True)

    current_entry = next((entry for entry in released_entries if entry.version == current_version), None)
    newer_entries = [entry for entry in released_entries if _version_key(entry.version) > _version_key(current_version)]
    previous_entries = [entry for entry in released_entries if _version_key(entry.version) < _version_key(current_version)]

    def serialize(entry: ParsedReleaseNote) -> dict:
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
