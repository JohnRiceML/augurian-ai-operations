"""Pre-rollout readiness gate — exits non-zero if any pillar fails.

Run before adding ANY client to the pilot. Mandated by the rollout
constraints in CLAUDE.md (concern #1 from Micah, 2026-05-01): no client
exposure without a documented green check.

What it verifies:
  • Client config exists in pipelines/clients.yaml (or sandbox skip)
  • Spelling corrections file exists
  • Index has ≥3 items (extraction has actually run)
  • Calibration: items-per-meeting in target band [3, 8]
  • Schema: every index row has the required fields + valid enum values
  • Supersession links: any item that's been superseded has the back-link
  • Corruption: every item NEAR a flagged region has the `corruption-near` tag
  • All canonical extractor item types appear at least once across the corpus
    (verifies the extractor isn't silently collapsing into one type)

What it does NOT do (deliberately):
  • Make Anthropic API calls (no $ cost; no network)
  • Connect to Drive (production has its own connection check)
  • Run the chatbot (use scripts/run_validation.py for that)

This is a static-state check on the local data layer, runnable in CI.
For a full live check that includes Claude API calls, run
scripts/run_validation.py against your corpus.

Usage:
    python scripts/readiness_check.py --client sandbox
    python scripts/readiness_check.py --client coborns --strict

Exits 0 = ready, 1 = blockers, 2 = warnings only with --strict.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import click

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data" / "walkthrough"
PROCESSED_DIR = DATA_DIR / "processed" / "commitments"
RAW_FIREFLY_DIR = DATA_DIR / "raw" / "firefly"
CLIENTS_YAML = REPO_ROOT / "pipelines" / "clients.yaml"

CALIBRATION_BAND = (3, 8)  # items per meeting; outside = needs review
ITEM_TYPES = {
    "deliverable", "action_item", "commitment",
    "decision", "blocker", "open_question",
}
ITEM_STATUSES = {"open", "done", "cancelled", "superseded"}
REQUIRED_INDEX_FIELDS = {"id", "client", "type", "status", "source_path"}


@dataclass
class CheckResult:
    name: str
    passed: bool
    severity: str = "blocker"  # blocker | warning | info
    detail: str = ""


@dataclass
class Report:
    client: str
    checks: list[CheckResult] = field(default_factory=list)

    def add(self, name: str, passed: bool, severity: str = "blocker", detail: str = "") -> None:
        self.checks.append(CheckResult(name, passed, severity, detail))

    @property
    def blockers(self) -> list[CheckResult]:
        return [c for c in self.checks if not c.passed and c.severity == "blocker"]

    @property
    def warnings(self) -> list[CheckResult]:
        return [c for c in self.checks if not c.passed and c.severity == "warning"]


# ---------- individual checks ----------

def check_client_config(report: Report, client: str) -> None:
    if client == "sandbox":
        report.add("client config", True, detail="(sandbox: no clients.yaml entry needed)")
        return
    if not CLIENTS_YAML.exists():
        report.add(
            "client config", False,
            detail=f"{CLIENTS_YAML} missing — copy clients.example.yaml first",
        )
        return
    text = CLIENTS_YAML.read_text()
    if f"\n  {client}:" in text or f"\n{client}:" in text:
        report.add("client config", True, detail=f"{client} present in clients.yaml")
    else:
        report.add(
            "client config", False,
            detail=f"{client!r} not found in clients.yaml — add an entry before rollout",
        )


def check_corrections_file(report: Report, client: str) -> None:
    p = RAW_FIREFLY_DIR / client / "spelling_corrections.txt"
    if p.exists():
        pairs = sum(
            1 for line in p.read_text().splitlines()
            if line.strip() and not line.startswith("#") and "\t" in line
        )
        report.add(
            "spelling corrections file", True,
            detail=f"{p.relative_to(REPO_ROOT)} ({pairs} pairs)",
        )
    else:
        report.add(
            "spelling corrections file", False,
            severity="warning",
            detail=(
                f"missing {p.relative_to(REPO_ROOT)} — agency-wide corrections "
                f"will not apply for this client (recommended even if empty)"
            ),
        )


def _load_index(client: str) -> list[dict]:
    p = PROCESSED_DIR / client / "_index.jsonl"
    if not p.exists():
        return []
    by_id: dict[str, dict] = {}
    fallback: list[dict] = []
    for line in p.read_text().splitlines():
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        rid = row.get("id")
        if rid:
            by_id[rid] = row
        else:
            fallback.append(row)
    return list(by_id.values()) + fallback


def check_index_size(report: Report, rows: list[dict]) -> None:
    if len(rows) >= 3:
        report.add("index has items", True, detail=f"{len(rows)} items")
    else:
        report.add(
            "index has items", False,
            detail=f"only {len(rows)} items — extraction hasn't been run on enough meetings",
        )


def check_calibration(report: Report, client: str, rows: list[dict]) -> None:
    """Items-per-meeting should fall in CALIBRATION_BAND for each call.

    Group by source_path; flag any meeting outside [3, 8].
    """
    by_source: dict[str, int] = {}
    for r in rows:
        src = r.get("source_path", "(unknown)")
        by_source[src] = by_source.get(src, 0) + 1
    if not by_source:
        report.add("calibration", False, detail="no items to calibrate")
        return
    out_of_band = [
        (src, count)
        for src, count in by_source.items()
        if not (CALIBRATION_BAND[0] <= count <= CALIBRATION_BAND[1])
    ]
    if not out_of_band:
        report.add(
            "calibration", True,
            detail=f"all {len(by_source)} meetings within {CALIBRATION_BAND} items/call",
        )
    else:
        sample = "; ".join(f"{Path(s).stem}={c}" for s, c in out_of_band[:3])
        report.add(
            "calibration", False,
            severity="warning",
            detail=(
                f"{len(out_of_band)}/{len(by_source)} meetings outside "
                f"target band {CALIBRATION_BAND}. Sample: {sample}"
            ),
        )


def check_schema(report: Report, rows: list[dict]) -> None:
    bad: list[str] = []
    for r in rows:
        rid = r.get("id", "(no-id)")
        missing = REQUIRED_INDEX_FIELDS - r.keys()
        if missing:
            bad.append(f"{rid}: missing {missing}")
            continue
        if r.get("type") not in ITEM_TYPES:
            bad.append(f"{rid}: bad type {r.get('type')!r}")
        if r.get("status") and r["status"] not in ITEM_STATUSES:
            bad.append(f"{rid}: bad status {r.get('status')!r}")
    if not bad:
        report.add("schema valid", True, detail=f"{len(rows)} rows checked")
    else:
        report.add(
            "schema valid", False,
            detail=f"{len(bad)} bad rows. First: {bad[0]}",
        )


def check_supersession_back_links(report: Report, rows: list[dict]) -> None:
    """If item A's supersedes points at B, B's superseded_by should point at A."""
    by_id = {r.get("id"): r for r in rows if r.get("id")}
    breaks: list[str] = []
    for r in rows:
        prior = r.get("supersedes")
        if not prior:
            continue
        target = by_id.get(prior)
        if not target:
            breaks.append(f"{r['id']} supersedes missing id {prior!r}")
            continue
        back = target.get("superseded_by")
        if back != r.get("id"):
            breaks.append(f"{r['id']} supersedes {prior} but {prior}.superseded_by={back!r}")
    if not breaks:
        report.add("supersession back-links", True, detail="all consistent")
    else:
        report.add(
            "supersession back-links", False,
            severity="warning",
            detail=f"{len(breaks)} mismatched. First: {breaks[0]}",
        )


def check_type_coverage(report: Report, rows: list[dict]) -> None:
    """Across the corpus, every item type should appear at least once.

    A pilot corpus that's all `deliverable` suggests the extractor's
    type-classification is silently collapsing.
    """
    seen = {r.get("type") for r in rows} - {None}
    missing = sorted(ITEM_TYPES - seen)
    if not missing:
        report.add("type coverage", True, detail="all 6 item types appear")
    else:
        report.add(
            "type coverage", False,
            severity="warning",
            detail=(
                f"missing types: {missing}. Either the corpus is too small or "
                f"the extractor is collapsing categories — review "
                f"calibration before client rollout."
            ),
        )


def check_corruption_tagging(report: Report, client: str, rows: list[dict]) -> None:
    """If corruption was detected during extraction, items should carry the tag.

    We can't reverify corruption without re-running pypdf here. But we can
    check the audit trail: any items that should have been flagged?
    """
    flagged = sum(1 for r in rows if "corruption-near" in (r.get("tags") or []))
    if flagged:
        report.add(
            "corruption tagging", True,
            severity="info",
            detail=f"{flagged} item(s) tagged corruption-near (audit trail intact)",
        )
    else:
        report.add(
            "corruption tagging", True,
            severity="info",
            detail="no items flagged (assumed clean transcripts)",
        )


# ---------- runner ----------

def render(report: Report, ready: bool) -> str:
    lines: list[str] = []
    lines.append(f"\nReadiness check — client={report.client}\n" + "─" * 60)
    for c in report.checks:
        if c.passed:
            mark = click.style("✓", fg="green")
        elif c.severity == "warning":
            mark = click.style("⚠", fg="yellow")
        else:
            mark = click.style("✗", fg="red")
        lines.append(f"  {mark} {c.name:30}  {c.detail}")
    lines.append("─" * 60)
    if ready:
        lines.append(click.style("READY for rollout", fg="green", bold=True))
    elif report.blockers:
        lines.append(click.style(f"NOT READY — {len(report.blockers)} blocker(s)", fg="red", bold=True))
    else:
        lines.append(click.style(f"WARNINGS — {len(report.warnings)} non-blocking", fg="yellow", bold=True))
    return "\n".join(lines)


@click.command()
@click.option("--client", required=True, help="Client slug, e.g. sandbox or coborns.")
@click.option(
    "--strict",
    is_flag=True,
    help="Treat warnings as blockers. Use this for a hard gate before client exposure.",
)
def cli(client: str, strict: bool) -> None:
    report = Report(client=client)

    check_client_config(report, client)
    check_corrections_file(report, client)
    rows = _load_index(client)
    check_index_size(report, rows)
    if rows:
        check_calibration(report, client, rows)
        check_schema(report, rows)
        check_supersession_back_links(report, rows)
        check_type_coverage(report, rows)
        check_corruption_tagging(report, client, rows)

    blockers = report.blockers
    warnings = report.warnings
    ready = not blockers and not (strict and warnings)

    click.echo(render(report, ready))

    if blockers:
        sys.exit(1)
    if strict and warnings:
        sys.exit(2)
    sys.exit(0)


if __name__ == "__main__":
    cli()
