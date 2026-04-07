from __future__ import annotations

from app.release_notes import (
    ParsedReleaseNote,
    _parse_release_note_header,
    _parse_release_notes,
    _version_key,
    release_notes_payload,
)


def test_parse_release_note_header_accepts_expected_format():
    assert _parse_release_note_header("## 1.2.3-rc1 | released | 2026-04-08") == (
        "1.2.3-rc1",
        "released",
        "2026-04-08",
    )


def test_parse_release_note_header_rejects_invalid_shape():
    assert _parse_release_note_header("## 1.2.3 | draft | 2026-04-08") is None
    assert _parse_release_note_header("## 1.2.3 | released") is None
    assert _parse_release_note_header("### 1.2.3 | released | 2026-04-08") is None


def test_parse_release_notes_preserves_summary_and_sections():
    notes = _parse_release_notes(
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


def test_release_notes_payload_excludes_unreleased_entries(monkeypatch):
    monkeypatch.setattr(
        "app.release_notes.read_release_notes",
        lambda: [
            ParsedReleaseNote(
                version="1.1.0",
                status="released",
                release_date="2026-03-01",
                summary="Latest",
                sections=[],
            ),
            ParsedReleaseNote(
                version="1.0.0",
                status="released",
                release_date="2026-01-01",
                summary="Released",
                sections=[],
            ),
            ParsedReleaseNote(
                version="1.1.0",
                status="unreleased",
                release_date="2026-02-01",
                summary="Draft",
                sections=[],
            ),
            ParsedReleaseNote(
                version="0.9.0",
                status="released",
                release_date="2025-12-01",
                summary="Older",
                sections=[],
            ),
        ],
    )

    payload = release_notes_payload("1.0.0")

    assert payload["update_available"] is True
    assert payload["newer_release_count"] == 1
    assert payload["newer_releases"][0]["version"] == "1.1.0"
    assert payload["previous_release_count"] == 1
    assert payload["previous_releases"][0]["version"] == "0.9.0"
