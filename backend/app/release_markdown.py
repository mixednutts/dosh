from __future__ import annotations

from dataclasses import dataclass


_RELEASED_STATUS = "released"
_UNRELEASED_STATUS = "unreleased"


@dataclass(frozen=True)
class ParsedReleaseNote:
    version: str
    status: str
    release_date: str
    summary: str
    sections: list[dict[str, list[str]]]


def parse_release_note_header(line: str) -> tuple[str, str, str] | None:
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


def parse_release_body(text: str) -> tuple[str, list[dict[str, list[str]]]]:
    summary_lines: list[str] = []
    sections: list[dict[str, list[str]]] = []
    current_section_title: str | None = None
    current_section_items: list[str] = []

    def flush_section() -> None:
        nonlocal current_section_title, current_section_items
        if current_section_title:
            sections.append({"title": current_section_title, "items": current_section_items[:]})
        current_section_title = None
        current_section_items = []

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
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
                summary_lines.append(line.strip())

    flush_section()
    return " ".join(line for line in summary_lines if line), sections


def parse_release_notes(text: str) -> list[ParsedReleaseNote]:
    entries: list[ParsedReleaseNote] = []
    current_version: str | None = None
    current_status: str | None = None
    current_date: str | None = None
    current_lines: list[str] = []

    def flush_entry() -> None:
        nonlocal current_version, current_status, current_date, current_lines
        if current_version and current_status and current_date:
            summary, sections = parse_release_body("\n".join(current_lines))
            entries.append(
                ParsedReleaseNote(
                    version=current_version,
                    status=current_status,
                    release_date=current_date,
                    summary=summary,
                    sections=sections,
                )
            )
        current_version = None
        current_status = None
        current_date = None
        current_lines = []

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        header_parts = parse_release_note_header(line)
        if header_parts:
            flush_entry()
            current_version, current_status, current_date = header_parts
            continue
        if current_version is None:
            continue
        current_lines.append(line)

    flush_entry()
    return entries


def render_release_body(entry: ParsedReleaseNote) -> str:
    lines: list[str] = []
    if entry.summary:
        lines.append(entry.summary)
        lines.append("")
    for index, section in enumerate(entry.sections):
        lines.append(f"### {section['title']}")
        lines.append("")
        for item in section["items"]:
            lines.append(f"- {item}")
        if index != len(entry.sections) - 1:
            lines.append("")
    return "\n".join(lines).strip()
