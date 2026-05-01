"""Regression tests for ``tool_read_meeting_summary`` / ``tool_read_meeting_transcript``.

Both delegate to ``_read_raw_text()``, which:
- locates ``raw/firefly/<client>/<slug>-<kind>.txt``
- applies per-client spelling corrections from ``spelling_corrections.txt``
- returns text + a ``spelling_corrections_applied`` log when corrections fire
- returns ``error`` + ``available_slugs`` for a missing slug
"""

from __future__ import annotations

from pathlib import Path

import pytest


CLIENT = "fakeco"


@pytest.fixture
def fake_raw(ask_module, tmp_path: Path, monkeypatch):
    base = tmp_path / "raw" / "firefly" / CLIENT
    base.mkdir(parents=True, exist_ok=True)

    (base / "2026-04-30-demo-call-summary.txt").write_text(
        "Aquarian discussed Coborn's strategy. OpenClaw was useful."
    )
    (base / "2026-04-30-demo-call-transcript.txt").write_text(
        "John Rice 0:00 — Aquarian builds tools for Coborn's."
    )
    (base / "spelling_corrections.txt").write_text(
        "Aquarian\tAugurian\nOpenClaw\tClaude\nCorbin's\tCoborn's\n"
    )

    monkeypatch.setattr(
        ask_module, "RAW_FIREFLY_DIR", tmp_path / "raw" / "firefly"
    )
    monkeypatch.setattr(ask_module, "DATA_DIR", tmp_path)
    return base


def test_read_summary_returns_text_with_corrections(ask_module, fake_raw):
    out = ask_module.tool_read_meeting_summary(
        {"client": CLIENT, "meeting_slug": "2026-04-30-demo-call"}
    )
    assert "error" not in out
    assert "Augurian" in out["text"]
    assert "Aquarian" not in out["text"]
    assert "Claude" in out["text"]
    assert "OpenClaw" not in out["text"]
    assert out["kind"] == "summary"
    assert "spelling_corrections_applied" in out
    log = out["spelling_corrections_applied"]
    fixed = {entry["as_transcribed"]: entry["count"] for entry in log}
    assert fixed.get("Aquarian", 0) >= 1
    assert fixed.get("OpenClaw", 0) >= 1


def test_read_transcript_returns_text(ask_module, fake_raw):
    out = ask_module.tool_read_meeting_transcript(
        {"client": CLIENT, "meeting_slug": "2026-04-30-demo-call"}
    )
    assert "error" not in out
    assert out["kind"] == "transcript"
    assert "Augurian" in out["text"]
    assert out["char_count"] == len(out["text"])


def test_missing_slug_returns_available_slugs(ask_module, fake_raw):
    out = ask_module.tool_read_meeting_summary(
        {"client": CLIENT, "meeting_slug": "no-such-meeting"}
    )
    assert "error" in out
    assert "available_slugs" in out
    # The summary file's stem appears in available_slugs.
    assert any("demo-call" in s for s in out["available_slugs"])


def test_no_corrections_log_when_text_is_clean(ask_module, tmp_path, monkeypatch):
    base = tmp_path / "raw" / "firefly" / CLIENT
    base.mkdir(parents=True, exist_ok=True)
    (base / "2026-05-01-clean-summary.txt").write_text(
        "This call has no transcription quirks."
    )
    (base / "spelling_corrections.txt").write_text("Aquarian\tAugurian\n")
    monkeypatch.setattr(
        ask_module, "RAW_FIREFLY_DIR", tmp_path / "raw" / "firefly"
    )
    monkeypatch.setattr(ask_module, "DATA_DIR", tmp_path)
    out = ask_module.tool_read_meeting_summary(
        {"client": CLIENT, "meeting_slug": "2026-05-01-clean"}
    )
    assert "error" not in out
    # No corrections fired, so the key shouldn't be present.
    assert "spelling_corrections_applied" not in out


def test_missing_client_folder_returns_error(ask_module, tmp_path, monkeypatch):
    monkeypatch.setattr(
        ask_module, "RAW_FIREFLY_DIR", tmp_path / "raw" / "firefly"
    )
    out = ask_module.tool_read_meeting_summary(
        {"client": "no-such-client", "meeting_slug": "anything"}
    )
    assert "error" in out
