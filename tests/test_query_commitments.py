"""Regression tests for ``tool_query_commitments()`` in scripts/ask.py.

Exercises every filter axis: type, owner_role, status (default 'open' hides
'superseded'; 'any' shows all), due_before, due_after, captured_after,
tags_any, priority sort + due_date sort, and the ``limit`` cap.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest


CLIENT = "fakeco"


@pytest.fixture
def fake_index(ask_module, tmp_path: Path, monkeypatch):
    """Write a synthetic index to tmp_path and point PROCESSED_DIR at it."""

    base = tmp_path / "processed" / "commitments" / CLIENT
    base.mkdir(parents=True, exist_ok=True)
    rows = [
        {
            "id": "a-001",
            "client": CLIENT,
            "type": "deliverable",
            "captured_date": "2026-04-15",
            "due_date": "2026-05-10",
            "owner_role": "augurian",
            "priority": 2,
            "status": "open",
            "tags": ["seo", "internal"],
        },
        {
            "id": "a-002",
            "client": CLIENT,
            "type": "commitment",
            "captured_date": "2026-04-30",
            "due_date": "2026-05-31",
            "owner_role": "augurian",
            "priority": 3,
            "status": "open",
            "tags": ["mrr", "growth"],
        },
        {
            "id": "a-003",
            "client": CLIENT,
            "type": "decision",
            "captured_date": "2026-04-30",
            "due_date": None,
            "owner_role": "client",
            "priority": 1,
            "status": "open",
            "tags": ["architecture"],
        },
        {
            "id": "a-004",
            "client": CLIENT,
            "type": "deliverable",
            "captured_date": "2026-04-01",
            "due_date": "2026-04-15",
            "owner_role": "augurian",
            "priority": 2,
            "status": "done",
            "tags": ["paid"],
        },
        {
            "id": "a-005",
            "client": CLIENT,
            "type": "deliverable",
            "captured_date": "2026-03-15",
            "due_date": "2026-04-01",
            "owner_role": "augurian",
            "priority": 3,
            "status": "superseded",
            "tags": ["seo"],
        },
    ]
    p = base / "_index.jsonl"
    with p.open("w") as f:
        for row in rows:
            f.write(json.dumps(row) + "\n")
    monkeypatch.setattr(
        ask_module, "PROCESSED_DIR", tmp_path / "processed" / "commitments"
    )
    return rows


def test_default_status_is_open(ask_module, fake_index):
    out = ask_module.tool_query_commitments({"client": CLIENT})
    statuses = {r["status"] for r in out["rows"]}
    # Default filter is 'open' — no done, no superseded.
    assert statuses == {"open"}


def test_default_excludes_superseded(ask_module, fake_index):
    out = ask_module.tool_query_commitments({"client": CLIENT})
    ids = {r["id"] for r in out["rows"]}
    assert "a-005" not in ids


def test_status_any_shows_everything(ask_module, fake_index):
    out = ask_module.tool_query_commitments({"client": CLIENT, "status": "any"})
    ids = {r["id"] for r in out["rows"]}
    # Reaches all rows including done + superseded.
    assert {"a-001", "a-002", "a-003", "a-004", "a-005"}.issubset(ids)


def test_filter_by_type(ask_module, fake_index):
    out = ask_module.tool_query_commitments(
        {"client": CLIENT, "type": "deliverable", "status": "any"}
    )
    types = {r["type"] for r in out["rows"]}
    assert types == {"deliverable"}


def test_filter_by_owner_role_client(ask_module, fake_index):
    out = ask_module.tool_query_commitments(
        {"client": CLIENT, "owner_role": "client"}
    )
    assert len(out["rows"]) == 1
    assert out["rows"][0]["id"] == "a-003"


def test_due_before_filters_out_later_dates(ask_module, fake_index):
    out = ask_module.tool_query_commitments(
        {"client": CLIENT, "due_before": "2026-05-15"}
    )
    # a-001 due 2026-05-10 OK; a-002 due 2026-05-31 EXCLUDED; a-003 has no due_date so EXCLUDED.
    ids = {r["id"] for r in out["rows"]}
    assert "a-001" in ids
    assert "a-002" not in ids


def test_due_after_filters_out_earlier_dates(ask_module, fake_index):
    out = ask_module.tool_query_commitments(
        {"client": CLIENT, "due_after": "2026-05-15"}
    )
    ids = {r["id"] for r in out["rows"]}
    assert "a-002" in ids  # due 2026-05-31
    assert "a-001" not in ids  # due 2026-05-10


def test_captured_after_filter(ask_module, fake_index):
    out = ask_module.tool_query_commitments(
        {"client": CLIENT, "captured_after": "2026-04-20"}
    )
    ids = {r["id"] for r in out["rows"]}
    # a-002 + a-003 captured 2026-04-30 OK; a-001 captured 2026-04-15 EXCLUDED.
    assert "a-002" in ids
    assert "a-003" in ids
    assert "a-001" not in ids


def test_tags_any_matches_any_overlap(ask_module, fake_index):
    out = ask_module.tool_query_commitments(
        {"client": CLIENT, "tags_any": ["mrr", "architecture"]}
    )
    ids = {r["id"] for r in out["rows"]}
    assert ids == {"a-002", "a-003"}


def test_sort_priority_desc_then_due_date_asc(ask_module, fake_index):
    out = ask_module.tool_query_commitments({"client": CLIENT})
    rows = out["rows"]
    # Among open: a-001 prio 2 due 2026-05-10, a-002 prio 3 due 2026-05-31, a-003 prio 1 no due.
    # Order should be: priority 3 (a-002), priority 2 (a-001), priority 1 (a-003).
    assert [r["id"] for r in rows] == ["a-002", "a-001", "a-003"]


def test_limit_caps_result_size(ask_module, fake_index):
    out = ask_module.tool_query_commitments({"client": CLIENT, "limit": 1})
    assert len(out["rows"]) == 1
    # matched_count counts all matches, not capped.
    assert out["matched_count"] >= 3


def test_missing_client_returns_error_payload(ask_module, tmp_path, monkeypatch):
    monkeypatch.setattr(
        ask_module, "PROCESSED_DIR", tmp_path / "processed" / "commitments"
    )
    out = ask_module.tool_query_commitments({"client": "no-such-client"})
    assert "error" in out
    assert out["matched_count"] == 0
