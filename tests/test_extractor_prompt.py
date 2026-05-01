"""String-match audit of ``.claude/agents/fireflies-extractor.md``.

This is a markdown prompt, not code — but the seven sharp edges fixed during
the 2026-04-30 walkthrough each manifest as a specific instruction in the
extractor prompt. If any of those substrings disappear (e.g. a doc rewrite
strips Fix #1's summary-timestamp validation), this regression catches it.
"""

from __future__ import annotations

from pathlib import Path

import pytest


@pytest.fixture(scope="module")
def extractor_md(repo_root: Path) -> str:
    p = repo_root / ".claude" / "agents" / "fireflies-extractor.md"
    assert p.exists(), f"missing extractor prompt at {p}"
    return p.read_text()


def test_supersession_schema_fields_documented(extractor_md):
    assert "supersedes" in extractor_md
    assert "superseded_by" in extractor_md


def test_status_enum_includes_cancelled_and_superseded(extractor_md):
    # The status enum is documented as `open | done | cancelled | superseded`.
    assert "cancelled" in extractor_md
    assert "superseded" in extractor_md


def test_fix1_summary_timestamp_validation_present(extractor_md):
    # Fix #1: validate Fireflies summary-anchored timestamps before trusting them.
    assert "Validate summary timestamps" in extractor_md


def test_fix2_verbatim_cascade_present(extractor_md):
    # Fix #2: verbatim cascade — paraphrase isn't a verbatim quote.
    assert "Verbatim cascade" in extractor_md


def test_fix5_corruption_detection_present(extractor_md):
    # Fix #5: detect transcript corruption + tag affected items 'corruption-near'.
    assert "transcript corruption" in extractor_md
    assert "corruption-near" in extractor_md


def test_fix6_summary_disambiguated_tag_present(extractor_md):
    # Fix #6: when transcript is corrupted, cross-reference the summary;
    # apply tag 'summary-disambiguated'.
    assert "summary-disambiguated" in extractor_md


def test_fix7_mrr_target_rule_present(extractor_md):
    # Fix #7: don't extract observations as commitments.
    # Only extract MRR-style data points if they're framed as targets.
    assert "Only extract if it's framed as a target" in extractor_md


def test_extraction_categories_documented(extractor_md):
    # The six allowed types must all show up in the prompt.
    for t in ["deliverable", "action_item", "commitment", "decision", "blocker", "open_question"]:
        assert t in extractor_md, f"missing extraction type {t} in prompt"
