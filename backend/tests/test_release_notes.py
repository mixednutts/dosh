from __future__ import annotations

from app.release_markdown import (
    ParsedReleaseNote,
    parse_release_note_header,
    parse_release_notes,
)
from app.release_notes import (
    _parse_release_note_header,
    _parse_release_notes,
    _version_key,
    release_notes_payload,
)


def test_parse_release_note_header_accepts_expected_format():
    assert parse_release_note_header("## 1.2.3-rc1 | released | 2026-04-08") == (
        "1.2.3-rc1",
        "released",
        "2026-04-08",
    )


def test_release_notes_module_reexports_markdown_parsers():
    assert _parse_release_note_header("## 1.2.3 | released | 2026-04-08") == (
        "1.2.3",
        "released",
        "2026-04-08",
    )
    assert _parse_release_notes("## 1.2.3 | released | 2026-04-08\n\nSummary") == parse_release_notes(
        "## 1.2.3 | released | 2026-04-08\n\nSummary"
    )


def test_parse_release_note_header_rejects_invalid_shape():
    assert parse_release_note_header("## 1.2.3 | draft | 2026-04-08") is None
    assert parse_release_note_header("## 1.2.3 | released") is None
    assert parse_release_note_header("### 1.2.3 | released | 2026-04-08") is None


def test_parse_release_notes_preserves_summary_and_sections():
    notes = parse_release_notes(
        """
# Dosh Release Notes

## 1.2.3 | released | 2026-04-08

Summary line one.
Summary line two.

### Highlights

- First item
- Second item
"""
    )

    assert notes == [
        ParsedReleaseNote(
            version="1.2.3",
            status="released",
            release_date="2026-04-08",
            summary="Summary line one. Summary line two.",
            sections=[{"title": "Highlights", "items": ["First item", "Second item"]}],
        )
    ]


def test_version_key_orders_supported_prerelease_suffixes():
    assert _version_key("1.2.3-alpha") < _version_key("1.2.3-beta")
    assert _version_key("1.2.3-beta") < _version_key("1.2.3-rc1")
    assert _version_key("1.2.3-rc1") < _version_key("1.2.3")


def test_release_notes_payload_uses_published_github_releases():
    payload = release_notes_payload(
        "1.0.0",
        fetcher=lambda: [
            {
                "tag_name": "v1.1.0",
                "draft": False,
                "published_at": "2026-03-01T08:00:00Z",
                "body": "Latest summary\n\n### Highlights\n\n- Added new release flow",
            },
            {
                "tag_name": "v1.0.0",
                "draft": False,
                "published_at": "2026-01-01T08:00:00Z",
                "body": "Released summary",
            },
            {
                "tag_name": "v0.9.0",
                "draft": False,
                "published_at": "2025-12-01T08:00:00Z",
                "body": "Older summary",
            },
            {
                "tag_name": "v1.2.0",
                "draft": True,
                "published_at": "2026-04-01T08:00:00Z",
                "body": "Draft should be ignored",
            },
        ],
    )

    assert payload["update_available"] is True
    assert payload["newer_release_count"] == 1
    assert payload["newer_releases"][0]["version"] == "1.1.0"
    assert payload["previous_release_count"] == 1
    assert payload["previous_releases"][0]["version"] == "0.9.0"
    assert payload["current_release"]["version"] == "1.0.0"
    assert payload["newer_releases"][0]["sections"][0]["title"] == "Highlights"


def test_release_notes_payload_degrades_safely_when_github_fetch_fails():
    payload = release_notes_payload("1.0.0", fetcher=lambda: (_ for _ in ()).throw(ValueError("boom")))

    assert payload == {
        "current_version": "1.0.0",
        "update_available": False,
        "newer_release_count": 0,
        "previous_release_count": 0,
        "current_release": None,
        "newer_releases": [],
        "previous_releases": [],
    }
