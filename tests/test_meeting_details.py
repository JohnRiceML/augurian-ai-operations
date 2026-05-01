"""Regression tests for ``tool_get_meeting_details()`` in scripts/ask.py.

Covers:
- exact-slug match (``<slug>.json`` directly)
- fuzzy substring match (single candidate)
- ambiguous match → returns error with ``candidates``
- missing client folder → returns error
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

    _write("2026-04-30-test-this.json", {"client": CLIENT, "items": [], "captured_date": "2026-04-30"})
    _write("2026-05-04-coborns-monthly.json", {"client": CLIENT, "items": [], "captured_date": "2026-05-04"})
    _write("2026-05-15-coborns-budget.json", {"client": CLIENT, "items": [], "captured_date": "2026-05-15"})

    monkeypatch.setattr(
        ask_module, "PROCESSED_DIR", tmp_path / "processed" / "commitments"
    )
    monkeypatch.setattr(ask_module, "DATA_DIR", tmp_path)
    return base


def test_exact_slug_match(ask_module, fake_processed):
    out = ask_module.tool_get_meeting_details(
        {"client": CLIENT, "meeting_slug": "2026-04-30-test-this"}
    )
    assert "error" not in out
    assert out["content"]["captured_date"] == "2026-04-30"
    assert "2026-04-30-test-this.json" in out["path"]


def test_fuzzy_substring_match_single_candidate(ask_module, fake_processed):
    out = ask_module.tool_get_meeting_details(
        {"client": CLIENT, "meeting_slug": "test-this"}
    )
    assert "error" not in out
    assert "test-this" in out["path"]


def test_ambiguous_match_returns_candidates(ask_module, fake_processed):
    out = ask_module.tool_get_meeting_details(
        {"client": CLIENT, "meeting_slug": "coborns"}
    )
    assert "error" in out
    assert "candidates" in out
    assert len(out["candidates"]) >= 2


def test_missing_client_folder_returns_error(ask_module, tmp_path, monkeypatch):
    monkeypatch.setattr(
        ask_module, "PROCESSED_DIR", tmp_path / "processed" / "commitments"
    )
    out = ask_module.tool_get_meeting_details(
        {"client": "no-such-client", "meeting_slug": "anything"}
    )
    assert "error" in out


def test_no_match_returns_error(ask_module, fake_processed):
    out = ask_module.tool_get_meeting_details(
        {"client": CLIENT, "meeting_slug": "nonexistent-xyz"}
    )
    assert "error" in out
