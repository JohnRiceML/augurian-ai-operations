"""Regression tests for ``_slugify()`` and ``_meeting_slug_and_kind()``.

These produce the canonical filesystem slug used by the chatbot's read tools.
Slug shape is ``<captured_date>-<title-slug>`` (title slug is lowercased,
hyphenated, alnum-only, max 40 chars).
"""

from __future__ import annotations

from pathlib import Path


# ---- _slugify ---------------------------------------------------------------


def test_slugify_lowercases_and_hyphenates(walkthrough_module):
    assert walkthrough_module._slugify("Test This Meeting") == "test-this-meeting"


def test_slugify_strips_non_alnum_and_collapses_runs(walkthrough_module):
    assert walkthrough_module._slugify("Coborn's: Q3 Plan!!") == "coborn-s-q3-plan"


def test_slugify_trims_leading_and_trailing_hyphens(walkthrough_module):
    assert walkthrough_module._slugify("---hello---") == "hello"


def test_slugify_falls_back_to_untitled_for_empty(walkthrough_module):
    assert walkthrough_module._slugify("") == "untitled"
    assert walkthrough_module._slugify("!!!") == "untitled"


# ---- _meeting_slug_and_kind -------------------------------------------------


def test_slug_from_fireflies_metadata(walkthrough_module):
    meta = {
        "fireflies_naming": {
            "title": "Test this",
            "kind": "transcript",
            "captured_date": "2026-04-30",
        }
    }
    slug, kind = walkthrough_module._meeting_slug_and_kind(
        meta, Path("/tmp/whatever.pdf"), captured_date=None
    )
    assert slug == "2026-04-30-test-this"
    assert kind == "transcript"


def test_slug_falls_back_to_path_stem_when_no_fireflies_metadata(walkthrough_module):
    meta = {"modifiedTime": "2026-05-04T10:00:00Z"}
    slug, kind = walkthrough_module._meeting_slug_and_kind(
        meta, Path("/tmp/Some Random Notes.pdf"), captured_date=None
    )
    # The non-fireflies branch labels everything as a transcript by default.
    assert kind == "transcript"
    assert slug.startswith("2026-05-04-")
    assert "some-random-notes" in slug


def test_explicit_captured_date_overrides(walkthrough_module):
    meta = {
        "fireflies_naming": {
            "title": "Test this",
            "kind": "summary",
            "captured_date": "2026-04-30",
        }
    }
    slug, kind = walkthrough_module._meeting_slug_and_kind(
        meta, Path("/tmp/x.pdf"), captured_date="2026-05-01"
    )
    assert slug == "2026-05-01-test-this"
    assert kind == "summary"
