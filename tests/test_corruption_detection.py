"""Regression tests for ``detect_corruption()`` in scripts/fireflies_walkthrough.py.

Locks in three corruption signatures verified during the 2026-04-30 walkthrough:
- garbled timestamp glitches (e.g. ``03w.o``)
- speaker line missing the MM:SS colon (e.g. ``John Rice — 0345``)
- impossible MM (>89) timestamps
plus a baseline assertion that the real (clean) sandbox transcript has zero findings.
"""

from __future__ import annotations

from pathlib import Path


def test_detects_garbled_timestamp_glitch(walkthrough_module):
    text = "John Rice — 03w.oAditi, that work?"
    findings = walkthrough_module.detect_corruption(text)
    labels = [f["label"] for f in findings]
    assert any("garbled" in lbl for lbl in labels), (
        f"expected glitch label in {labels}"
    )


def test_detects_missing_colon_in_speaker_line(walkthrough_module):
    text = "John Rice — 0345 talking about the project"
    findings = walkthrough_module.detect_corruption(text)
    labels = [f["label"] for f in findings]
    assert any("missing colon" in lbl for lbl in labels), (
        f"expected missing-colon label in {labels}"
    )


def test_detects_impossible_minute_timestamp(walkthrough_module):
    text = "next item at 95:14 in the call somewhere"
    findings = walkthrough_module.detect_corruption(text)
    labels = [f["label"] for f in findings]
    assert any("impossible" in lbl for lbl in labels), (
        f"expected impossible-MM label in {labels}"
    )


def test_clean_text_returns_no_findings(walkthrough_module):
    text = "John Rice 0:00 — this transcript has no corruption signatures."
    findings = walkthrough_module.detect_corruption(text)
    assert findings == []


def test_real_sandbox_transcript_is_clean(walkthrough_module, repo_root: Path):
    sandbox_path = (
        repo_root
        / "data"
        / "walkthrough"
        / "raw"
        / "firefly"
        / "sandbox"
        / "2026-04-30-test-this-transcript.txt"
    )
    assert sandbox_path.exists(), f"missing demo transcript at {sandbox_path}"
    findings = walkthrough_module.detect_corruption(sandbox_path.read_text())
    # Brittleness note: this asserts the demo transcript stays clean. If the
    # source PDF is replaced with a corruption-bearing version, update here.
    assert findings == [], f"expected clean transcript, got: {findings}"


def test_finding_includes_match_and_context(walkthrough_module):
    text = "speaker line John Rice — 0345 mid-meeting"
    findings = walkthrough_module.detect_corruption(text)
    assert findings, "expected at least one finding"
    f = findings[0]
    assert "label" in f and "match" in f and "context" in f
    assert f["match"] in text
