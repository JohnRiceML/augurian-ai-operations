"""Smart-agent chatbot — answers commitment questions with tool use.

Gives Claude three tools that read the local commitment index, then lets
it decide what to load. Same data layer as the production
`commitment-tracker` subagent — different runtime (Anthropic SDK + tools
here, Claude Agent SDK + Drive MCP in production). The agent's reasoning
is identical, so what we learn here transfers cleanly.

Compared to the walkthrough's `query` command (which dumps the entire
index into one prompt), this is the agentic pattern: Claude sees the
question, picks tools, makes calls, reasons, answers. Sharp edges in tool
schemas / loop control / error handling surface here, not in production.

Usage:
    python scripts/ask.py "what did I commit to in May?" --client sandbox
    python scripts/ask.py "show overdue items" --client sandbox -v
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import click
import structlog
from dotenv import load_dotenv

load_dotenv()
log = structlog.get_logger()

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data" / "walkthrough"
PROCESSED_DIR = DATA_DIR / "processed" / "commitments"
RAW_FIREFLY_DIR = DATA_DIR / "raw" / "firefly"
TRACKER_PROMPT_PATH = REPO_ROOT / ".claude" / "agents" / "commitment-tracker.md"
CLAUDE_MODEL = "claude-opus-4-7"


# ----------------------------- Tool schemas -----------------------------

TOOLS: list[dict[str, Any]] = [
    {
        "name": "query_commitments",
        "description": (
            "Search the commitment index for a client. Returns items matching "
            "the filters, sorted by priority desc then due_date asc. Use this "
            "first — it covers most questions efficiently."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "client": {"type": "string"},
                "type": {
                    "type": "string",
                    "enum": [
                        "deliverable", "action_item", "commitment",
                        "decision", "blocker", "open_question",
                    ],
                    "description": "Single item type. Omit to match all.",
                },
                "owner_role": {
                    "type": "string",
                    "enum": ["augurian", "client", "external"],
                    "description": "augurian = we owe them; client = they owe us.",
                },
                "status": {
                    "type": "string",
                    "enum": ["open", "done", "cancelled"],
                    "description": "Defaults to 'open' if omitted.",
                },
                "due_before": {"type": "string", "description": "ISO YYYY-MM-DD"},
                "due_after": {"type": "string", "description": "ISO YYYY-MM-DD"},
                "captured_after": {"type": "string", "description": "ISO YYYY-MM-DD"},
                "tags_any": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Match if item has ANY of these tags.",
                },
                "limit": {"type": "integer", "default": 10},
            },
            "required": ["client"],
        },
    },
    {
        "name": "get_meeting_details",
        "description": (
            "Fetch the full per-call extraction — verbatim quotes, transcript "
            "anchors, all items. Use when the user wants to verify a specific "
            "item or ask about full call context."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "client": {"type": "string"},
                "meeting_slug": {
                    "type": "string",
                    "description": "e.g. '2026-04-30-test-this' (without .json).",
                },
            },
            "required": ["client", "meeting_slug"],
        },
    },
    {
        "name": "list_meetings",
        "description": (
            "List all extracted meetings for a client. Use for discovery — "
            "'what calls do you have on file?' / 'what was the last call?'"
        ),
        "input_schema": {
            "type": "object",
            "properties": {"client": {"type": "string"}},
            "required": ["client"],
        },
    },
    {
        "name": "read_meeting_summary",
        "description": (
            "Read Fireflies' own pre-extracted summary for a meeting "
            "(themes, action items with timestamps, decisions). CHEAP and "
            "concise — Fireflies has already done the summarization. Try this "
            "BEFORE read_meeting_transcript when the user asks 'what was "
            "discussed' or 'what came out of meeting X'."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "client": {"type": "string"},
                "meeting_slug": {
                    "type": "string",
                    "description": "e.g. '2026-04-30-test-this'.",
                },
            },
            "required": ["client", "meeting_slug"],
        },
    },
    {
        "name": "read_meeting_transcript",
        "description": (
            "Read the FULL raw transcript. Most expensive in tokens — only "
            "use as a LAST RESORT when query_commitments + get_meeting_details "
            "+ read_meeting_summary together can't answer the question. "
            "Verbatim with speaker labels and timestamps."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "client": {"type": "string"},
                "meeting_slug": {"type": "string"},
            },
            "required": ["client", "meeting_slug"],
        },
    },
]


# ----------------------------- Tool implementations -----------------------------

def _read_index(client: str) -> list[dict[str, Any]]:
    p = PROCESSED_DIR / client / "_index.jsonl"
    if not p.exists():
        return []
    return [json.loads(line) for line in p.read_text().splitlines() if line.strip()]


def tool_query_commitments(args: dict[str, Any]) -> dict[str, Any]:
    client = args["client"]
    rows = _read_index(client)
    if not rows:
        return {
            "error": f"no commitment index for client '{client}'",
            "rows": [],
            "matched_count": 0,
            "total_index_size": 0,
        }

    type_f = args.get("type")
    role_f = args.get("owner_role")
    status_f = args.get("status", "open")
    due_before = args.get("due_before")
    due_after = args.get("due_after")
    captured_after = args.get("captured_after")
    tags_any = set(args.get("tags_any", []))
    limit = args.get("limit", 10)

    def keep(r: dict[str, Any]) -> bool:
        if type_f and r.get("type") != type_f:
            return False
        if role_f and r.get("owner_role") != role_f:
            return False
        if status_f and (r.get("status") or "open") != status_f:
            return False
        if due_before and (r.get("due_date") or "9999-99-99") > due_before:
            return False
        if due_after and (r.get("due_date") or "0000-00-00") < due_after:
            return False
        if captured_after and (r.get("captured_date") or "") < captured_after:
            return False
        if tags_any and not (set(r.get("tags") or []) & tags_any):
            return False
        return True

    matched = [r for r in rows if keep(r)]
    matched.sort(
        key=lambda r: (-(r.get("priority") or 0), r.get("due_date") or "9999-99-99")
    )
    return {
        "matched_count": len(matched),
        "total_index_size": len(rows),
        "filters_applied": {k: v for k, v in args.items() if k != "client"},
        "rows": matched[:limit],
    }


def tool_get_meeting_details(args: dict[str, Any]) -> dict[str, Any]:
    client = args["client"]
    slug = args["meeting_slug"]
    base = PROCESSED_DIR / client
    if not base.exists():
        return {"error": f"no client folder for '{client}'"}
    direct = base / f"{slug}.json"
    if direct.exists():
        return {
            "path": str(direct.relative_to(DATA_DIR)),
            "content": json.loads(direct.read_text()),
        }
    matches = sorted(base.glob(f"*{slug}*.json"))
    matches = [m for m in matches if not m.name.startswith("_")]
    if not matches:
        return {"error": f"no meeting matching '{slug}' for client '{client}'"}
    if len(matches) > 1:
        return {
            "error": f"ambiguous meeting_slug '{slug}'",
            "candidates": [m.stem for m in matches],
        }
    p = matches[0]
    return {
        "path": str(p.relative_to(DATA_DIR)),
        "content": json.loads(p.read_text()),
    }


def tool_list_meetings(args: dict[str, Any]) -> dict[str, Any]:
    client = args["client"]
    d = PROCESSED_DIR / client
    if not d.exists():
        return {"error": f"no client folder for '{client}'", "meetings": []}
    out = []
    for f in sorted(d.glob("*.json")):
        if f.name.startswith("_"):
            continue
        try:
            data = json.loads(f.read_text())
        except json.JSONDecodeError:
            continue
        out.append(
            {
                "slug": f.stem,
                "captured_date": data.get("captured_date"),
                "items_count": len(data.get("items", [])),
                "attendees": data.get("call_attendees", []),
            }
        )
    return {"client": client, "meetings": out, "count": len(out)}


def _load_corrections(client: str) -> list[tuple[str, str]]:
    """Load per-client spelling corrections. Tab-separated as_transcribed\\tcorrected."""
    p = RAW_FIREFLY_DIR / client / "spelling_corrections.txt"
    if not p.exists():
        return []
    pairs: list[tuple[str, str]] = []
    for line in p.read_text().splitlines():
        line = line.split("#", 1)[0].rstrip()
        if not line.strip() or "\t" not in line:
            continue
        wrong, right = line.split("\t", 1)
        wrong, right = wrong.strip(), right.strip()
        if wrong and right and wrong != right:
            pairs.append((wrong, right))
    # Longest-first so substrings don't get partially replaced.
    pairs.sort(key=lambda kv: -len(kv[0]))
    return pairs


def _apply_corrections(text: str, corrections: list[tuple[str, str]]) -> tuple[str, list[dict]]:
    """Apply spelling corrections; return (corrected_text, applied_log)."""
    applied: list[dict] = []
    for wrong, right in corrections:
        n = text.count(wrong)
        if n:
            text = text.replace(wrong, right)
            applied.append({"as_transcribed": wrong, "corrected": right, "count": n})
    return text, applied


def _read_raw_text(client: str, slug: str, kind: str) -> dict[str, Any]:
    """kind = 'summary' | 'transcript'. Returns corrected text + a log of fixes."""
    base = RAW_FIREFLY_DIR / client
    direct = base / f"{slug}-{kind}.txt"
    if direct.exists():
        path = direct
    elif not base.exists():
        return {"error": f"no raw firefly folder for client '{client}'"}
    else:
        matches = sorted(base.glob(f"*{slug}*-{kind}.txt"))
        if not matches:
            available = sorted(p.stem for p in base.glob(f"*-{kind}.txt"))
            return {
                "error": f"no {kind} for slug '{slug}' (client={client})",
                "available_slugs": available,
            }
        if len(matches) > 1:
            return {
                "error": f"ambiguous slug '{slug}'",
                "candidates": [m.stem for m in matches],
            }
        path = matches[0]

    raw = path.read_text()
    corrected, applied = _apply_corrections(raw, _load_corrections(client))
    out: dict[str, Any] = {
        "path": str(path.relative_to(DATA_DIR)),
        "kind": kind,
        "char_count": len(corrected),
        "text": corrected,
    }
    if applied:
        out["spelling_corrections_applied"] = applied
    return out


def tool_read_meeting_summary(args: dict[str, Any]) -> dict[str, Any]:
    return _read_raw_text(args["client"], args["meeting_slug"], "summary")


def tool_read_meeting_transcript(args: dict[str, Any]) -> dict[str, Any]:
    return _read_raw_text(args["client"], args["meeting_slug"], "transcript")


TOOL_RUNNERS = {
    "query_commitments": tool_query_commitments,
    "get_meeting_details": tool_get_meeting_details,
    "list_meetings": tool_list_meetings,
    "read_meeting_summary": tool_read_meeting_summary,
    "read_meeting_transcript": tool_read_meeting_transcript,
}


# ----------------------------- Agent loop -----------------------------

def _system_prompt() -> str:
    """Reuse the commitment-tracker prompt; adapt the tool section."""
    md = TRACKER_PROMPT_PATH.read_text()
    if md.startswith("---"):
        md = md.split("---", 2)[2].lstrip()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return (
        f"Today's date is {today}.\n\n"
        + md
        + "\n\n# Tool use (this runtime) — START CHEAP, ESCALATE ONLY IF NEEDED\n\n"
        "You have five tools. Always reach for the cheapest one that can answer "
        "the question. Don't escalate unless the cheaper layer comes up short.\n\n"
        "**Tier 1 — `query_commitments(client, ...)`**\n"
        "Filter the indexed commitments. Covers ~80% of questions: what's due, "
        "what's overdue, what was decided, what's open by owner, etc.\n\n"
        "**Tier 2 — `get_meeting_details(client, meeting_slug)`**\n"
        "Per-call extraction with verbatim quotes + transcript anchors already "
        "preserved by the extractor. Use when the user asks for verbatim or full "
        "context of a known call AND that call has been extracted.\n\n"
        "**Tier 3 — `read_meeting_summary(client, meeting_slug)`**\n"
        "Fireflies' pre-extracted summary (themes, action items with timestamps "
        "in third-person paraphrase). Concise; right for 'what was the call "
        "about', 'what came up around X', themes / topics.\n\n"
        "**Tier 4 — `read_meeting_transcript(client, meeting_slug)`**\n"
        "The full raw transcript. Speaker-labeled, with original phrasing.\n\n"
        "**`list_meetings(client)`** — discovery, when you don't know which slug.\n\n"
        "## Escalation rule (validated 2026-05-01)\n\n"
        "The Tier 3 summary is **third-person paraphrase**. It CANNOT satisfy:\n"
        "- requests for verbatim speaker quotes (≤150-char actual phrasing)\n"
        "- precise transcript anchors at MM:SS speaker-turn precision\n\n"
        "If a question requires either of those, you MUST escalate to Tier 4 "
        "(transcript) — even if the summary alone would have been enough for "
        "the gist. Don't pretend a paraphrase is a verbatim quote.\n\n"
        "## On transcription quality\n\n"
        "Fireflies mishears proper nouns. The `_read_raw_text` tools auto-apply "
        "per-client spelling corrections (e.g. Aquarian→Augurian, Corbin's→"
        "Coborn's, OpenClaw→Claude). If a tool result includes "
        "`spelling_corrections_applied`, the text you see is already corrected — "
        "trust the corrected names. If the user asks about an unfamiliar proper "
        "noun, flag it as possibly-mistranscribed and surface to the human.\n\n"
        "## Output\n\n"
        "After your tool calls, write the final answer following the markdown "
        "output format above. Always cite `source_path` and `transcript_anchor` "
        "where applicable, so the human can verify in Fireflies.\n"
    )


def _anthropic():
    from anthropic import Anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise click.ClickException("ANTHROPIC_API_KEY not set. Add to .env.")
    return Anthropic(api_key=api_key)


@click.command()
@click.argument("question")
@click.option("--client", required=True, help="Client slug (e.g. sandbox, coborns).")
@click.option("--max-iterations", default=8, help="Cap on tool-call rounds.")
@click.option("-v", "--verbose", is_flag=True, help="Show tool calls + args + results.")
def cli(question: str, client: str, max_iterations: int, verbose: bool) -> None:
    """Ask the smart agent a question."""
    anthropic = _anthropic()
    system = _system_prompt()
    messages: list[dict[str, Any]] = [
        {"role": "user", "content": f"Client: {client}\n\nQuestion: {question}"}
    ]

    total_in = total_out = 0
    iteration = 0

    while iteration < max_iterations:
        iteration += 1
        resp = anthropic.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            system=system,
            tools=TOOLS,
            messages=messages,
        )
        total_in += resp.usage.input_tokens
        total_out += resp.usage.output_tokens

        if verbose:
            click.secho(
                f"\n[iter {iteration}] stop_reason={resp.stop_reason} "
                f"in={resp.usage.input_tokens} out={resp.usage.output_tokens}",
                fg="cyan",
                err=True,
            )

        text_parts: list[str] = []
        tool_uses = []
        for block in resp.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_uses.append(block)

        if resp.stop_reason == "end_turn":
            click.echo("\n".join(p for p in text_parts if p.strip()))
            break

        if resp.stop_reason != "tool_use":
            click.secho(
                f"\nUnexpected stop_reason: {resp.stop_reason}", fg="red", err=True
            )
            click.echo("\n".join(text_parts))
            break

        # Append assistant turn (text + tool_use blocks) and run the tools.
        messages.append({"role": "assistant", "content": resp.content})
        tool_results: list[dict[str, Any]] = []
        for tu in tool_uses:
            runner = TOOL_RUNNERS.get(tu.name)
            if verbose:
                click.secho(
                    f"  → {tu.name}({json.dumps(tu.input)})", fg="yellow", err=True
                )
            if runner is None:
                result: dict[str, Any] = {"error": f"unknown tool '{tu.name}'"}
            else:
                try:
                    result = runner(tu.input)
                except Exception as exc:  # surface tool errors to the model
                    result = {"error": str(exc)}
            if verbose:
                preview = json.dumps(result)
                if len(preview) > 240:
                    preview = preview[:240] + "…"
                click.secho(f"    {preview}", fg="green", err=True)
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": json.dumps(result),
                }
            )
        messages.append({"role": "user", "content": tool_results})
    else:
        click.secho(
            f"\nHit max iterations ({max_iterations}) without final answer.",
            fg="red",
            err=True,
        )

    click.secho(
        f"\n--- usage: in={total_in:,} out={total_out:,} tokens, "
        f"{iteration} iteration(s) ---",
        fg="bright_black",
        err=True,
    )


if __name__ == "__main__":
    cli()
