"""Regression tests for ``_parse_fireflies_filename()`` in scripts/fireflies_walkthrough.py.

The Fireflies export pattern is ``<title>-<{summary|transcript}>-<ISO-UTC>.pdf``.
The parser returns ``None`` for non-matching names. ``captured_date`` is the first
10 chars of the ISO timestamp.
"""

from __future__ import annotations


def test_parses_transcript_filename(walkthrough_module):
    name = "Test this-transcript-2026-04-30T23-23-29.000Z.pdf"
    parsed = walkthrough_module._parse_fireflies_filename(name)
    assert parsed is not None
    assert parsed["title"] == "Test this"
    assert parsed["kind"] == "transcript"
    assert parsed["timestamp_utc"] == "2026-04-30T23-23-29.000Z"
    assert parsed["captured_date"] == "2026-04-30"


def test_parses_summary_filename(walkthrough_module):
    name = "Coborn's Monthly Review-summary-2026-05-04T15-12-08.000Z.pdf"
    parsed = walkthrough_module._parse_fireflies_filename(name)
    assert parsed is not None
    assert parsed["kind"] == "summary"
    assert parsed["title"] == "Coborn's Monthly Review"
    assert parsed["captured_date"] == "2026-05-04"


def test_returns_none_for_non_matching_name(walkthrough_module):
    assert walkthrough_module._parse_fireflies_filename("notes.txt") is None
    assert walkthrough_module._parse_fireflies_filename("random.pdf") is None


def test_returns_none_for_wrong_kind(walkthrough_module):
    name = "Meeting-recording-2026-04-30T23-23-29.000Z.pdf"
    assert walkthrough_module._parse_fireflies_filename(name) is None


def test_title_with_dashes_preserved(walkthrough_module):
    name = "Q3-Planning-Sync-transcript-2026-05-15T14-00-00.000Z.pdf"
    parsed = walkthrough_module._parse_fireflies_filename(name)
    assert parsed is not None
    # Regex is non-greedy on title, so title takes the smallest match before -kind-.
    assert parsed["kind"] == "transcript"
    assert parsed["captured_date"] == "2026-05-15"
    # Title should be everything before "-transcript-".
    assert parsed["title"] == "Q3-Planning-Sync"
