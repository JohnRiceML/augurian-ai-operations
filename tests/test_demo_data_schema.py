"""Schema sanity checks on the seeded demo extraction.

Locks in that the partner-demo data file conforms to the documented schema so
we don't ship a typo'd demo on Wednesday.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest


ALLOWED_TYPES = {
    "deliverable",
    "action_item",
    "commitment",
    "decision",
    "blocker",
    "open_question",
}
ALLOWED_STATUSES = {"open", "done", "cancelled", "superseded"}
REQUIRED_ITEM_FIELDS = {
    "id",
    "type",
    "due_date",
    "owner_role",
    "priority",
    "status",
    "tags",
    "confidence",
    "transcript_anchor",
}
REQUIRED_INDEX_FIELDS = {"id", "client", "type", "status", "source_path"}


@pytest.fixture(scope="module")
def demo_extraction(repo_root: Path) -> dict:
    p = (
        repo_root
        / "data"
        / "walkthrough"
        / "processed"
        / "commitments"
        / "sandbox"
        / "2026-04-30-test-this.json"
    )
    assert p.exists(), f"missing demo extraction at {p}"
    return json.loads(p.read_text())


@pytest.fixture(scope="module")
def demo_index_lines(repo_root: Path) -> list[str]:
    p = (
        repo_root
        / "data"
        / "walkthrough"
        / "processed"
        / "commitments"
        / "sandbox"
        / "_index.jsonl"
    )
    assert p.exists(), f"missing demo index at {p}"
    return [line for line in p.read_text().splitlines() if line.strip()]


def test_top_level_keys_present(demo_extraction):
    for key in ("client", "captured_date", "items"):
        assert key in demo_extraction, f"top-level key '{key}' missing"


def test_items_have_required_fields(demo_extraction):
    items = demo_extraction["items"]
    assert items, "expected at least one item in the demo extraction"
    for idx, item in enumerate(items):
        missing = REQUIRED_ITEM_FIELDS - set(item.keys())
        assert not missing, f"item[{idx}] (id={item.get('id')}) missing fields: {missing}"


def test_every_item_type_is_allowed(demo_extraction):
    for item in demo_extraction["items"]:
        assert item["type"] in ALLOWED_TYPES, (
            f"item {item.get('id')} has disallowed type {item['type']!r}"
        )


def test_every_item_status_is_allowed(demo_extraction):
    for item in demo_extraction["items"]:
        assert item["status"] in ALLOWED_STATUSES, (
            f"item {item.get('id')} has disallowed status {item['status']!r}"
        )


def test_index_lines_parse_as_json(demo_index_lines):
    for i, line in enumerate(demo_index_lines):
        try:
            json.loads(line)
        except json.JSONDecodeError as exc:
            pytest.fail(f"index line {i + 1} not JSON: {exc}\nline: {line!r}")


def test_index_rows_have_required_fields(demo_index_lines):
    for i, line in enumerate(demo_index_lines):
        row = json.loads(line)
        missing = REQUIRED_INDEX_FIELDS - set(row.keys())
        assert not missing, (
            f"index row {i + 1} (id={row.get('id')}) missing fields: {missing}"
        )
