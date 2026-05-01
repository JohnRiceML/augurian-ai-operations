"""Regression tests for spelling-correction loading + application in scripts/ask.py.

Covers:
- comment + blank-line skipping
- tab-separation requirement
- longest-first sort (so substrings don't get partially replaced)
- count log returned by ``_apply_corrections``
- the real sandbox correction file has the documented entries
"""

from __future__ import annotations

from pathlib import Path


# ---- _load_corrections (against the real sandbox file) ----------------------


def test_loads_real_sandbox_corrections(ask_module, sandbox_client):
    pairs = ask_module._load_corrections(sandbox_client)
    assert len(pairs) >= 6, f"expected ≥6 sandbox corrections, got {len(pairs)}"
    pair_dict = dict(pairs)
    # Spot-check a few documented entries.
    assert pair_dict.get("Aquarian") == "Augurian"
    assert pair_dict.get("OpenClaw") == "Claude"
    assert pair_dict.get("Click House") == "ClickHouse"


def test_load_corrections_returns_longest_first(ask_module, sandbox_client):
    pairs = ask_module._load_corrections(sandbox_client)
    # Verify monotonically non-increasing key length.
    lengths = [len(k) for k, _ in pairs]
    assert lengths == sorted(lengths, reverse=True), (
        f"corrections not longest-first: {lengths}"
    )


# ---- _load_corrections (with tmp_path-isolated fake client) -----------------


def _write_fake_client(tmp_path: Path, client: str, content: str) -> Path:
    """Create ``tmp_path/raw/firefly/<client>/spelling_corrections.txt``."""

    base = tmp_path / "raw" / "firefly" / client
    base.mkdir(parents=True, exist_ok=True)
    p = base / "spelling_corrections.txt"
    p.write_text(content)
    return p


def test_load_corrections_skips_comments_and_blank_lines(
    ask_module, tmp_path, monkeypatch
):
    monkeypatch.setattr(ask_module, "RAW_FIREFLY_DIR", tmp_path / "raw" / "firefly")
    _write_fake_client(
        tmp_path,
        "fakeco",
        "# This is a comment\n"
        "\n"
        "Foo\tBar\n"
        "# another comment\n"
        "Baz\tQux\n",
    )
    pairs = ask_module._load_corrections("fakeco")
    pair_dict = dict(pairs)
    assert pair_dict == {"Foo": "Bar", "Baz": "Qux"}


def test_load_corrections_requires_tab(ask_module, tmp_path, monkeypatch):
    monkeypatch.setattr(ask_module, "RAW_FIREFLY_DIR", tmp_path / "raw" / "firefly")
    _write_fake_client(
        tmp_path,
        "fakeco",
        "no-tab-here, just commas\n"
        "Foo\tBar\n"
        "also no tab\n",
    )
    pairs = ask_module._load_corrections("fakeco")
    assert pairs == [("Foo", "Bar")]


def test_load_corrections_returns_empty_for_missing_client(ask_module, tmp_path, monkeypatch):
    monkeypatch.setattr(ask_module, "RAW_FIREFLY_DIR", tmp_path / "raw" / "firefly")
    assert ask_module._load_corrections("does-not-exist") == []


# ---- _apply_corrections -----------------------------------------------------


def test_apply_corrections_replaces_and_counts(ask_module):
    corrections = [("Aquarian", "Augurian")]
    text = "Aquarian builds tools. Aquarian is great."
    out, log = ask_module._apply_corrections(text, corrections)
    assert "Aquarian" not in out
    assert out.count("Augurian") == 2
    assert log == [{"as_transcribed": "Aquarian", "corrected": "Augurian", "count": 2}]


def test_apply_corrections_longest_first_prevents_partial_overlap(ask_module):
    # If "Click" replaces before "Click House", we'd corrupt the source phrase
    # "Click House" → "Claude House". The loader sorts longest-first to prevent
    # this. We pass longest-first directly and verify the long replacement wins.
    corrections = [("Click House", "ClickHouse"), ("Click Bait", "Clickbait")]
    text = "Click House and Click Bait are different things."
    out, log = ask_module._apply_corrections(text, corrections)
    assert "ClickHouse" in out
    assert "Clickbait" in out
    # Both source phrases must be gone (no leftover original substrings).
    assert "Click House" not in out
    assert "Click Bait" not in out


def test_apply_corrections_short_first_demonstrates_why_order_matters(ask_module):
    # Sanity check the inverse: pass shortest-first, verify the long phrase gets
    # corrupted. This documents WHY _load_corrections sorts longest-first.
    corrections = [("Click", "Claude"), ("Click House", "ClickHouse")]
    text = "Click House is great."
    out, _log = ask_module._apply_corrections(text, corrections)
    # "Click" replaces first → "Claude House". Then "Click House" no longer
    # exists in the text, so the second replacement never fires.
    assert "Claude House" in out
    assert "ClickHouse" not in out


def test_apply_corrections_returns_empty_log_when_nothing_matches(ask_module):
    out, log = ask_module._apply_corrections("nothing to fix here", [("X", "Y")])
    assert out == "nothing to fix here"
    assert log == []
