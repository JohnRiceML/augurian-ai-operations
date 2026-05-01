"""Batch-run the validation corpus through our local pipeline.

Mirrors what we did manually in Claude.ai web on 2026-05-01: takes a folder
of Fireflies PDFs, runs our extraction on every meeting, then runs the
canonical query set against the resulting index. Produces a markdown
report so we can diff our code's output against the Claude.ai run.

The point: prove our code path produces results comparable to what the
hosted Claude.ai Drive integration produced. If the diff is small, the
fixes from commits c4143a6 / 791a830 are working in our runtime, not
just in Claude.ai's. If the diff is large, we have a prompt issue our
unit tests can't catch.

Usage:
    python scripts/run_validation.py ~/Downloads/augurian-validation-pdfs/ \\
        --client sandbox

The folder should contain pairs of <title>-summary-<ts>.pdf and
<title>-transcript-<ts>.pdf as Fireflies dropped them. Non-matching
files are ignored.

Outputs:
    data/walkthrough/validation/<YYYYMMDD-HHMMSS>/
        report.md           — human-readable summary + the 6 query answers
        per-meeting/*.json  — Claude's raw extraction for each meeting
        run.log             — token usage + timing per call

This is a TEST RIG. Production runs through orchestrator/main.py.
"""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import click

# Reuse the walkthrough helpers — they're already battle-tested by the
# 70-test pytest suite and tightly coupled to the schema / cascade rules.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts import ask, fireflies_walkthrough as fw  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data" / "walkthrough"
VALIDATION_DIR = DATA_DIR / "validation"

# The canonical query set from the 2026-05-01 validation run. Update
# this list when adding new diagnostic queries; keep it short.
VALIDATION_QUERIES: list[str] = [
    "What did Augurian commit to for Coborn's?",
    "What's blocking the Pinterest pilot?",
    "What did we decide about the vector DB?",
    "What action items came from last week's tooling review?",
    "Summarize the Helmsley situation across the meetings it appears in.",
    "What did we discuss at the team hangout?",
]


def _pair_pdfs(folder: Path) -> list[tuple[Path, Path]]:
    """Find (transcript, summary) pairs by Fireflies filename pattern.

    Pairs are matched by title — the part of the filename before
    `-summary-` or `-transcript-`. Returns (transcript, summary) so the
    transcript-driven extraction can find its matching summary.
    """
    by_title: dict[str, dict[str, Path]] = {}
    for path in sorted(folder.glob("*.pdf")):
        meta = fw._parse_fireflies_filename(path.name)
        if not meta:
            continue
        slot = by_title.setdefault(meta["title"], {})
        slot[meta["kind"]] = path

    pairs: list[tuple[Path, Path]] = []
    for title, slot in sorted(by_title.items()):
        if "transcript" in slot and "summary" in slot:
            pairs.append((slot["transcript"], slot["summary"]))
        else:
            click.secho(
                f"  skipping {title!r}: missing "
                f"{'transcript' if 'transcript' not in slot else 'summary'}",
                fg="yellow",
                err=True,
            )
    return pairs


@click.command()
@click.argument("folder", type=click.Path(exists=True, file_okay=False, path_type=Path))
@click.option("--client", required=True, help="Client slug for the index, e.g. sandbox.")
@click.option(
    "--queries-only",
    is_flag=True,
    help="Skip extraction; only run the canonical queries against the existing index.",
)
def cli(folder: Path, client: str, queries_only: bool) -> None:
    """Run the validation corpus through our pipeline + emit a report."""
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    run_dir = VALIDATION_DIR / timestamp
    run_dir.mkdir(parents=True, exist_ok=True)
    log_path = run_dir / "run.log"
    log_path.write_text(f"validation run {timestamp}\nclient: {client}\nfolder: {folder}\n\n")

    pairs = _pair_pdfs(folder)
    click.echo(f"Found {len(pairs)} meeting pair(s) in {folder}")

    extracted_meetings: list[dict] = []
    total_extract_in = total_extract_out = 0
    t0 = time.time()

    if not queries_only:
        for i, (transcript_pdf, summary_pdf) in enumerate(pairs, 1):
            click.secho(f"\n[{i}/{len(pairs)}] {transcript_pdf.name}", fg="cyan")
            # 1. Pull both raw text files into the per-client raw folder.
            for pdf in (transcript_pdf, summary_pdf):
                text, meta = fw._pull_local(pdf)
                slug, kind = fw._meeting_slug_and_kind(meta, pdf, None)
                fw._save_raw_text(client, slug, kind, text)

            # 2. Extract from the transcript via Claude.
            text, meta = fw._pull_local(transcript_pdf)
            slug, kind = fw._meeting_slug_and_kind(meta, transcript_pdf, None)
            cap_date = "-".join(slug.split("-", 3)[:3])

            corruption = fw.detect_corruption(text)
            if corruption:
                click.secho(f"  ⚠ {len(corruption)} corruption signature(s)", fg="yellow")

            try:
                # _run_extraction prints + writes the per-call JSON + appends index
                fw._run_extraction(
                    text=text,
                    client=client,
                    captured_date=cap_date,
                    source_id=meta["id"],
                    display_name=slug,
                )
            except Exception as exc:
                click.secho(f"  ✗ extraction failed: {exc}", fg="red", err=True)
                with log_path.open("a") as f:
                    f.write(f"FAIL {slug}: {exc}\n")
                continue

            extracted_meetings.append({"slug": slug, "transcript": str(transcript_pdf)})

    # 3. Run canonical queries against the now-populated index.
    click.echo(f"\nRunning {len(VALIDATION_QUERIES)} canonical queries…")
    query_results: list[dict] = []
    anthropic_client = ask._anthropic()
    system = ask._system_prompt()

    for q in VALIDATION_QUERIES:
        click.echo(f"\n  Q: {q}")
        messages: list[dict] = [
            {"role": "user", "content": f"Client: {client}\n\nQuestion: {q}"}
        ]
        in_tokens = out_tokens = 0
        iter_count = 0
        final_text = ""
        for _ in range(8):
            iter_count += 1
            resp = anthropic_client.messages.create(
                model=ask.CLAUDE_MODEL,
                max_tokens=4096,
                system=system,
                tools=ask.TOOLS,
                messages=messages,
            )
            in_tokens += resp.usage.input_tokens
            out_tokens += resp.usage.output_tokens

            text_parts = [b.text for b in resp.content if b.type == "text"]
            tool_uses = [b for b in resp.content if b.type == "tool_use"]

            if resp.stop_reason == "end_turn":
                final_text = "\n".join(p for p in text_parts if p.strip())
                break
            if resp.stop_reason != "tool_use":
                final_text = "\n".join(text_parts) + f"\n[stop_reason={resp.stop_reason}]"
                break

            messages.append({"role": "assistant", "content": resp.content})
            tool_results = []
            for tu in tool_uses:
                runner = ask.TOOL_RUNNERS.get(tu.name)
                result = runner(tu.input) if runner else {"error": f"unknown tool {tu.name}"}
                tool_results.append(
                    {"type": "tool_result", "tool_use_id": tu.id, "content": json.dumps(result)}
                )
            messages.append({"role": "user", "content": tool_results})
        query_results.append(
            {"question": q, "answer": final_text, "iterations": iter_count,
             "tokens_in": in_tokens, "tokens_out": out_tokens}
        )

    # 4. Build the markdown report.
    elapsed = time.time() - t0
    report = run_dir / "report.md"
    lines: list[str] = []
    lines.append(f"# Validation run — {timestamp}")
    lines.append("")
    lines.append(f"- Client: `{client}`")
    lines.append(f"- Folder: `{folder}`")
    lines.append(f"- Meetings extracted: {len(extracted_meetings)}")
    lines.append(f"- Queries run: {len(query_results)}")
    lines.append(f"- Wall time: {elapsed:.1f}s")
    qtotal_in = sum(r["tokens_in"] for r in query_results)
    qtotal_out = sum(r["tokens_out"] for r in query_results)
    lines.append(f"- Query tokens: in={qtotal_in:,} out={qtotal_out:,}")
    lines.append("")
    lines.append("## Extracted meetings")
    lines.append("")
    for m in extracted_meetings:
        lines.append(f"- `{m['slug']}`")
    lines.append("")
    lines.append("## Canonical query answers")
    lines.append("")
    for r in query_results:
        lines.append(f"### Q: {r['question']}")
        lines.append("")
        lines.append(r["answer"] or "_(empty)_")
        lines.append("")
        lines.append(f"_iterations: {r['iterations']}, in={r['tokens_in']:,} out={r['tokens_out']:,}_")
        lines.append("")
    report.write_text("\n".join(lines))
    click.secho(f"\n✓ Report: {report}", fg="green")

    with log_path.open("a") as f:
        f.write(f"\nelapsed: {elapsed:.1f}s\nquery_tokens_in: {qtotal_in}\nquery_tokens_out: {qtotal_out}\n")


if __name__ == "__main__":
    cli()
