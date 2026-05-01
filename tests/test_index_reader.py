"""Regression tests for ``_read_index()`` in scripts/ask.py.

The index is append-only — supersession updates re-emit a row with the same
``id``. ``_read_index()`` must return the LATEST row per id, preserving the
audit trail on disk while giving callers one logical record per commitment.
"""

from __future__ import annotations

import json
from pathlib import Path


def _write_index(tmp_path: Path, client: str, rows: list[dict]) -> Path:
    base = tmp_path / "processed" / "commitments" / client
    base.mkdir(parents=True, exist_ok=True)
    p = base / "_index.jsonl"
    with p.open("w") as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")
    return p


def test_read_index_returns_empty_for_missing_client(ask_module, tmp_path, monkeypatch):
    monkeypatch.setattr(
        ask_module, "PROCESSED_DIR", tmp_path / "processed" / "commitments"
    )
    assert ask_module._read_index("nonexistent") == []


def test_read_index_returns_all_rows_when_no_collisions(ask_module, tmp_path, monkeypatch):
    monkeypatch.setattr(
        ask_module, "PROCESSED_DIR", tmp_path / "processed" / "commitments"
    )
    rows = [
        {"id": "a-001", "client": "fakeco", "type": "deliverable", "status": "open"},
        {"id": "a-002", "client": "fakeco", "type": "commitment", "status": "open"},
        {"id": "a-003", "client": "fakeco", "type": "decision", "status": "done"},
    ]
    _write_index(tmp_path, "fakeco", rows)
    out = ask_module._read_index("fakeco")
    assert len(out) == 3
    assert {r["id"] for r in out} == {"a-001", "a-002", "a-003"}


def test_read_index_latest_row_per_id_wins(ask_module, tmp_path, monkeypatch):
    """Supersession behavior: write same id twice; the later row's status wins."""

    monkeypatch.setattr(
        ask_module, "PROCESSED_DIR", tmp_path / "processed" / "commitments"
    )
    rows = [
        {"id": "a-001", "client": "fakeco", "type": "deliverable", "status": "open"},
        {
            "id": "a-001",
            "client": "fakeco",
            "type": "deliverable",
            "status": "superseded",
            "superseded_by": "a-002",
        },
    ]
    _write_index(tmp_path, "fakeco", rows)
    out = ask_module._read_index("fakeco")
    assert len(out) == 1
    assert out[0]["status"] == "superseded"
    assert out[0]["superseded_by"] == "a-002"


def test_read_index_skips_blank_lines(ask_module, tmp_path, monkeypatch):
    monkeypatch.setattr(
        ask_module, "PROCESSED_DIR", tmp_path / "processed" / "commitments"
    )
    base = tmp_path / "processed" / "commitments" / "fakeco"
    base.mkdir(parents=True, exist_ok=True)
    p = base / "_index.jsonl"
    p.write_text(
        '{"id": "a-001", "status": "open"}\n'
        "\n"
        "   \n"
        '{"id": "a-002", "status": "done"}\n'
    )
    out = ask_module._read_index("fakeco")
    assert len(out) == 2
