"""Regression tests for ``tool_list_meetings()`` in scripts/ask.py.

Covers:
- enumerates all per-call JSON files for a client, sorted
- skips files whose names start with ``_`` (e.g. ``_index.jsonl``)
- returns a sensible error payload for an unknown client
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest


CLIENT = "fakeco"


@pytest.fixture
def fake_processed(ask_module, tmp_path: Path, monkeypatch):
    base = tmp_path / "processed" / "commitments" / CLIENT
    base.mkdir(parents=True, exist_ok=True)

    def _write(name: str, payload: dict) -> Path:
        p = base / name
        p.write_text(json.dumps(payload))
        return p

    _write(
        "2026-04-30-test-this.json",
        {"captured_date": "2026-04-30", "items": [{"id": "x"}], "call_attendees": ["John"]},
    )
    _write(
        "2026-05-04-coborns-monthly.json",
        {"captured_date": "2026-05-04", "items": [], "call_attendees": []},
    )
    # Underscore-prefixed JSON files MUST be skipped (e.g. _index, _scratch).
    _write("_scratch.json", {"captured_date": "ignore"})
    # _index.jsonl is the canonical companion file; not a .json so glob skips it,
    # but write it for realism.
    (base / "_index.jsonl").write_text("{}\n")

    monkeypatch.setattr(
        ask_module, "PROCESSED_DIR", tmp_path / "processed" / "commitments"
    )
    return base


def test_list_meetings_returns_meetings_sorted(ask_module, fake_processed):
    out = ask_module.tool_list_meetings({"client": CLIENT})
    assert "error" not in out
    slugs = [m["slug"] for m in out["meetings"]]
    assert slugs == sorted(slugs)
    assert "2026-04-30-test-this" in slugs
    assert "2026-05-04-coborns-monthly" in slugs
    # _scratch must be skipped.
    assert "_scratch" not in slugs


def test_list_meetings_attaches_metadata(ask_module, fake_processed):
    out = ask_module.tool_list_meetings({"client": CLIENT})
    by_slug = {m["slug"]: m for m in out["meetings"]}
    test_this = by_slug["2026-04-30-test-this"]
    assert test_this["captured_date"] == "2026-04-30"
    assert test_this["items_count"] == 1
    assert test_this["attendees"] == ["John"]


def test_list_meetings_returns_error_for_missing_client(ask_module, tmp_path, monkeypatch):
    monkeypatch.setattr(
        ask_module, "PROCESSED_DIR", tmp_path / "processed" / "commitments"
    )
    out = ask_module.tool_list_meetings({"client": "no-such-client"})
    assert "error" in out
    assert out["meetings"] == []
