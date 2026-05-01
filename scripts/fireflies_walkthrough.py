"""Exploratory CLI: walk one real Fireflies meeting through the pipeline.

This is a TEST RIG, not the production code path. Production lives in
orchestrator/main.py + pipelines/drive_watcher.py. The point of this script
is to walk a real call end-to-end as quickly as possible so we can find
the sharp edges before we wire the full system.

What it does:

    auth                One-time OAuth to your Drive (read-only).
    list                Show recent Fireflies-looking files in your Drive.
    pull FILE_ID        Download + normalize one Drive file to text.
    extract FILE_ID --client SLUG
                        Run Claude on the transcript; write structured
                        commitments to data/walkthrough/processed/commitments/.
    pull-local PATH     Normalize a LOCAL Fireflies PDF/txt to text. No Drive.
    extract-local PATH --client SLUG
                        Same as `extract`, but reads a local file. Use this
                        when you've manually downloaded a Fireflies PDF.
    query "QUESTION" --client SLUG
                        Answer a question from the local commitment index.

Setup once:

    1. GCP project: enable Drive API, create OAuth client (type "Desktop").
       Download credentials → ./credentials/oauth_client.json
    2. Add ANTHROPIC_API_KEY to .env
    3. python scripts/fireflies_walkthrough.py auth

Output goes to data/walkthrough/ (gitignored). Nothing is written back to
Drive — this script is read-only on the Drive side and writes only locally.
"""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import click
import structlog
from dotenv import load_dotenv

load_dotenv()
log = structlog.get_logger()

# ---------- Paths ----------
REPO_ROOT = Path(__file__).resolve().parent.parent
CREDS_DIR = REPO_ROOT / "credentials"
OAUTH_CLIENT_FILE = CREDS_DIR / "oauth_client.json"
TOKEN_FILE = CREDS_DIR / "drive_token.json"
DATA_DIR = REPO_ROOT / "data" / "walkthrough"
RAW_DIR = DATA_DIR / "raw" / "firefly"
PROCESSED_DIR = DATA_DIR / "processed" / "commitments"

# ---------- Config ----------
DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
EXTRACTOR_AGENT_PATH = REPO_ROOT / ".claude" / "agents" / "fireflies-extractor.md"
EXTRACTION_RULES_PATH = REPO_ROOT / ".claude" / "skills" / "fireflies-extraction-rules" / "SKILL.md"
CLAUDE_MODEL = "claude-opus-4-7"


# ---------- Lazy imports ----------
# Heavy deps stay out of import time so `--help` is instant.
def _drive_service():
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), DRIVE_SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not OAUTH_CLIENT_FILE.exists():
                raise click.ClickException(
                    f"Missing {OAUTH_CLIENT_FILE}. See `auth --help` for setup."
                )
            flow = InstalledAppFlow.from_client_secrets_file(
                str(OAUTH_CLIENT_FILE), DRIVE_SCOPES
            )
            creds = flow.run_local_server(port=0)
        TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
        TOKEN_FILE.write_text(creds.to_json())
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _anthropic():
    from anthropic import Anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise click.ClickException("ANTHROPIC_API_KEY not set. Add it to .env.")
    return Anthropic(api_key=api_key)


# ---------- Data model ----------
@dataclass
class DriveFile:
    id: str
    name: str
    mime_type: str
    modified_time: str
    parents: list[str]
    size: int | None
    web_link: str


def _file_to_drivefile(f: dict[str, Any]) -> DriveFile:
    return DriveFile(
        id=f["id"],
        name=f["name"],
        mime_type=f["mimeType"],
        modified_time=f.get("modifiedTime", ""),
        parents=f.get("parents", []),
        size=int(f["size"]) if f.get("size") else None,
        web_link=f.get("webViewLink", ""),
    )


# ---------- CLI ----------
@click.group()
def cli() -> None:
    """Walk one real Fireflies meeting through the pipeline."""


@cli.command()
def auth() -> None:
    """Run OAuth once. Saves a refresh token to credentials/drive_token.json.

    Setup BEFORE running this:

      1. https://console.cloud.google.com → New Project (or pick existing)
      2. APIs & Services → Library → enable "Google Drive API"
      3. APIs & Services → OAuth consent screen
           - User type: Internal (avoids 7-day refresh-token expiry)
           - Add scope: .../auth/drive.readonly
      4. APIs & Services → Credentials → Create Credentials → OAuth client ID
           - Application type: Desktop app
           - Download JSON → save as credentials/oauth_client.json
      5. Then: python scripts/fireflies_walkthrough.py auth
    """
    CREDS_DIR.mkdir(parents=True, exist_ok=True)
    if not OAUTH_CLIENT_FILE.exists():
        raise click.ClickException(
            f"Place your downloaded OAuth client JSON at {OAUTH_CLIENT_FILE} first.\n"
            "See `auth --help` for the setup steps."
        )
    svc = _drive_service()
    about = svc.about().get(fields="user(emailAddress,displayName)").execute()
    user = about.get("user", {})
    click.echo(
        f"Authenticated as {user.get('displayName')} <{user.get('emailAddress')}>"
    )
    click.echo(f"Token saved to {TOKEN_FILE}")


@cli.command(name="list")
@click.option(
    "--days",
    default=30,
    help="Look back this many days for recent files.",
)
@click.option(
    "--folder-id",
    default=None,
    help="If you know your Fireflies folder ID, pass it here. Otherwise we search.",
)
@click.option(
    "--limit",
    default=25,
    help="Max results.",
)
def list_files(days: int, folder_id: str | None, limit: int) -> None:
    """Find Fireflies-looking files in your Drive.

    Strategy:
      - If --folder-id given, list that folder.
      - Else search for: recently-modified Google Docs whose name OR parent folder
        looks like a Fireflies output (contains "fireflies", "transcript",
        or matches a typical meeting-name pattern).

    The first sharp edge to find: what does Fireflies *actually* dump? Doc?
    Docx? Folder named what? Print the raw API result so we know.
    """
    svc = _drive_service()
    fields = "files(id,name,mimeType,modifiedTime,parents,size,webViewLink)"

    if folder_id:
        q = f"'{folder_id}' in parents and trashed = false"
    else:
        # Heuristic search. We'll iterate on this once we see real output.
        # Fireflies typically creates a folder named "Fireflies.ai" or similar
        # and drops Google Docs into it.
        cutoff = _iso_n_days_ago(days)
        q = (
            f"modifiedTime > '{cutoff}' and trashed = false and ("
            "name contains 'fireflies' or "
            "name contains 'Fireflies' or "
            "name contains 'transcript' or "
            "name contains 'Meeting' or "
            "mimeType = 'application/vnd.google-apps.document'"
            ")"
        )

    resp = svc.files().list(
        q=q,
        pageSize=min(limit, 100),
        orderBy="modifiedTime desc",
        fields=fields,
    ).execute()
    files = [_file_to_drivefile(f) for f in resp.get("files", [])]
    if not files:
        click.echo("No files matched. Try --folder-id <id> if you know your Fireflies folder.")
        return
    click.echo(f"Found {len(files)} file(s):\n")
    for f in files:
        size = f"{f.size:>10,} B" if f.size else "      Doc "
        mt_short = f.mime_type.split(".")[-1][:18]
        click.echo(f"  {f.id}  {f.modified_time[:10]}  {size}  {mt_short:<18}  {f.name}")


@cli.command()
@click.argument("file_id")
def pull(file_id: str) -> None:
    """Download + normalize a Drive file to text. Writes to data/walkthrough/raw/firefly/."""
    text, meta = _pull_file(file_id)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    txt_path = RAW_DIR / f"{file_id}.txt"
    meta_path = RAW_DIR / f"{file_id}.meta.json"
    txt_path.write_text(text)
    meta_path.write_text(json.dumps(meta, indent=2))
    click.echo(f"Wrote {len(text):,} chars to {txt_path}")
    click.echo(f"Meta:  {meta_path}")
    click.echo("\n--- first 500 chars ---")
    click.echo(text[:500])


def _pull_file(file_id: str) -> tuple[str, dict[str, Any]]:
    svc = _drive_service()
    meta = svc.files().get(
        fileId=file_id,
        fields="id,name,mimeType,modifiedTime,parents,size,webViewLink,owners",
    ).execute()
    mime = meta["mimeType"]

    if mime == "application/vnd.google-apps.document":
        data = svc.files().export(fileId=file_id, mimeType="text/plain").execute()
        text = data.decode("utf-8") if isinstance(data, bytes) else data
    elif mime in ("text/plain", "text/markdown", "application/json"):
        data = svc.files().get_media(fileId=file_id).execute()
        text = data.decode("utf-8") if isinstance(data, bytes) else data
    elif mime == "application/pdf":
        data = svc.files().get_media(fileId=file_id).execute()
        text = _pdf_bytes_to_text(data)
    else:
        raise click.ClickException(
            f"Don't know how to read mimeType={mime} yet. File: {meta['name']}\n"
            "Edit _pull_file() to add a handler for this format."
        )
    return text, meta


def _pull_local(path: Path) -> tuple[str, dict[str, Any]]:
    """Local-file equivalent of _pull_file. No Drive auth needed."""
    if not path.exists():
        raise click.ClickException(f"File not found: {path}")
    suffix = path.suffix.lower()
    stat = path.stat()
    meta = {
        "id": f"local:{path.name}",
        "name": path.name,
        "mimeType": _local_mime(suffix),
        "modifiedTime": datetime.fromtimestamp(stat.st_mtime, timezone.utc).isoformat(),
        "size": stat.st_size,
        "webViewLink": f"file://{path}",
        "fireflies_naming": _parse_fireflies_filename(path.name),
    }
    if suffix == ".pdf":
        text = _pdf_bytes_to_text(path.read_bytes())
    elif suffix in (".txt", ".md", ".json"):
        text = path.read_text(encoding="utf-8")
    else:
        raise click.ClickException(
            f"Don't know how to read suffix={suffix}. Add a handler in _pull_local()."
        )

    fname = meta["fireflies_naming"]
    if fname and fname["kind"] == "summary":
        click.secho(
            "  warning: this looks like a Fireflies SUMMARY, not the transcript. "
            "The extractor wants the transcript file (richer signal). "
            "Did you mean the matching '-transcript-' file?",
            fg="yellow",
            err=True,
        )
    return text, meta


def _local_mime(suffix: str) -> str:
    return {
        ".pdf": "application/pdf",
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".json": "application/json",
    }.get(suffix, "application/octet-stream")


def _pdf_bytes_to_text(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as e:
        raise click.ClickException(
            "PDF support needs `pypdf`. Install it:\n  pip install pypdf"
        ) from e
    import io

    reader = PdfReader(io.BytesIO(data))
    return "\n\n".join(page.extract_text() or "" for page in reader.pages)


# Fireflies naming pattern: <meeting-title>-<{summary|transcript}>-<ISO-UTC>.pdf
# Example: "Test this-transcript-2026-04-30T23-23-29.000Z.pdf"
_FIREFLIES_RE = re.compile(
    r"^(?P<title>.+?)-(?P<kind>summary|transcript)-"
    r"(?P<ts>\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.\d{3}Z)\.pdf$"
)


def _parse_fireflies_filename(name: str) -> dict[str, str] | None:
    m = _FIREFLIES_RE.match(name)
    if not m:
        return None
    ts = m.group("ts").replace("T", " ").replace(".000Z", "Z")
    return {
        "title": m.group("title"),
        "kind": m.group("kind"),
        "timestamp_utc": m.group("ts"),
        "captured_date": m.group("ts")[:10],
    }


@cli.command(name="pull-local")
@click.argument("path", type=click.Path(exists=True, dir_okay=False, path_type=Path))
def pull_local(path: Path) -> None:
    """Local-file equivalent of `pull`. No Drive needed."""
    text, meta = _pull_local(path)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    base = _slugify(path.stem)[:60]
    txt_path = RAW_DIR / f"{base}.txt"
    meta_path = RAW_DIR / f"{base}.meta.json"
    txt_path.write_text(text)
    meta_path.write_text(json.dumps(meta, indent=2))
    click.echo(f"Wrote {len(text):,} chars to {txt_path}")
    if meta.get("fireflies_naming"):
        click.echo(f"Detected Fireflies naming: {meta['fireflies_naming']}")
    click.echo(f"Meta:  {meta_path}")
    click.echo("\n--- first 500 chars ---")
    click.echo(text[:500])


@cli.command(name="extract-local")
@click.argument("path", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--client", required=True, help="Client slug, e.g. coborns or sandbox.")
@click.option(
    "--captured-date",
    default=None,
    help="ISO date when the call happened. Defaults to file's mtime or Fireflies filename.",
)
def extract_local(path: Path, client: str, captured_date: str | None) -> None:
    """Local-file equivalent of `extract`. No Drive needed."""
    text, meta = _pull_local(path)
    cap_date = (
        captured_date
        or (meta.get("fireflies_naming") or {}).get("captured_date")
        or meta.get("modifiedTime", "")[:10]
        or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    )
    _run_extraction(
        text=text,
        client=client,
        captured_date=cap_date,
        source_id=meta["id"],
        display_name=meta["name"],
    )


@cli.command()
@click.argument("file_id")
@click.option("--client", required=True, help="Client slug, e.g. coborns or sandbox.")
@click.option(
    "--captured-date",
    default=None,
    help="ISO date when the call happened. Defaults to file's modifiedTime.",
)
def extract(file_id: str, client: str, captured_date: str | None) -> None:
    """Run Claude against the transcript; write structured commitments locally."""
    text, meta = _pull_file(file_id)
    cap_date = captured_date or meta.get("modifiedTime", "")[:10]
    if not cap_date:
        cap_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    _run_extraction(
        text=text,
        client=client,
        captured_date=cap_date,
        source_id=f"drive://{file_id}",
        display_name=meta.get("name", file_id),
    )


def _run_extraction(
    text: str, client: str, captured_date: str, source_id: str, display_name: str
) -> None:
    """Shared extraction core: prompt → Claude → write JSON + index."""
    system_prompt = _build_extractor_system_prompt()
    user_prompt = (
        f"Client slug: {client}\n"
        f"Captured date: {captured_date}\n"
        f"Source: {source_id}\n\n"
        "Transcript follows. Extract per the rules. Output ONLY a single JSON "
        "object matching the schema. No prose, no code fences.\n\n"
        "----- TRANSCRIPT -----\n"
        f"{text}"
    )
    client_anthropic = _anthropic()
    log.info("extracting", source=source_id, client=client, chars=len(text))
    resp = client_anthropic.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=8192,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    raw = "".join(block.text for block in resp.content if block.type == "text").strip()
    parsed = _parse_json_strict(raw)

    out_dir = PROCESSED_DIR / client
    out_dir.mkdir(parents=True, exist_ok=True)
    slug = _slugify(display_name)[:40]
    out_path = out_dir / f"{captured_date}-{slug}.json"
    out_path.write_text(json.dumps(parsed, indent=2))

    index_path = out_dir / "_index.jsonl"
    with index_path.open("a") as f:
        for item in parsed.get("items", []):
            row = {
                "id": item.get("id"),
                "client": client,
                "type": item.get("type"),
                "captured_date": item.get("captured_date"),
                "due_date": item.get("due_date"),
                "owner": item.get("owner"),
                "owner_role": item.get("owner_role"),
                "priority": item.get("priority"),
                "status": item.get("status", "open"),
                "tags": item.get("tags", []),
                "source_path": str(out_path.relative_to(DATA_DIR)),
                "transcript_anchor": item.get("transcript_anchor"),
            }
            f.write(json.dumps(row) + "\n")

    n_items = len(parsed.get("items", []))
    click.echo(f"Extracted {n_items} item(s). → {out_path}")
    click.echo(f"Index updated:           {index_path}")
    click.echo(f"\nUsage: in {resp.usage.input_tokens} / out {resp.usage.output_tokens}")


@cli.command()
@click.argument("question")
@click.option("--client", required=True, help="Client slug to query.")
@click.option("--limit", default=200, help="Max index rows to load into context.")
def query(question: str, client: str, limit: int) -> None:
    """Answer a question by reading the local commitment index."""
    index_path = PROCESSED_DIR / client / "_index.jsonl"
    if not index_path.exists():
        raise click.ClickException(
            f"No index for client '{client}' at {index_path}. Run `extract` first."
        )
    rows: list[dict[str, Any]] = []
    with index_path.open() as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    if len(rows) > limit:
        rows = sorted(rows, key=lambda r: r.get("captured_date", ""), reverse=True)[:limit]

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    system_prompt = (
        "You answer questions about marketing-ops commitments tracked across client calls.\n"
        f"Today's date: {today}.\n"
        "You are given a JSONL index of items extracted from call transcripts.\n"
        "Each item has type, due_date, owner, owner_role, priority, status, tags, and a source path.\n\n"
        "Rules:\n"
        "- Only answer from the index. If the answer isn't there, say so plainly.\n"
        "- Cite each item's id and source_path so the human can verify.\n"
        "- Sort by due_date when listing deliverables.\n"
        "- 'Things we owe them' = owner_role: augurian. 'Things they owe us' = client.\n"
    )
    user_prompt = (
        f"Question: {question}\n\nIndex ({len(rows)} rows):\n"
        + "\n".join(json.dumps(r) for r in rows)
    )
    client_anthropic = _anthropic()
    resp = client_anthropic.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2048,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    answer = "".join(b.text for b in resp.content if b.type == "text")
    click.echo(answer)
    click.echo(f"\n--- in {resp.usage.input_tokens} / out {resp.usage.output_tokens} tokens ---")


# ---------- Helpers ----------
def _iso_n_days_ago(days: int) -> str:
    from datetime import timedelta

    return (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%dT%H:%M:%SZ")


def _slugify(s: str) -> str:
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")
    return s or "untitled"


def _build_extractor_system_prompt() -> str:
    """Assemble the extractor's prompt from the .md agent + skill files."""
    agent_md = EXTRACTOR_AGENT_PATH.read_text()
    # Strip frontmatter.
    if agent_md.startswith("---"):
        agent_md = agent_md.split("---", 2)[2].lstrip()
    skill_md = ""
    if EXTRACTION_RULES_PATH.exists():
        skill_md = EXTRACTION_RULES_PATH.read_text()
        if skill_md.startswith("---"):
            skill_md = skill_md.split("---", 2)[2].lstrip()
    parts = [agent_md.strip()]
    if skill_md:
        parts.append("---\n# Extraction rules (skill)\n\n" + skill_md.strip())
    parts.append(
        "---\n# Output protocol for this run\n\n"
        "Output a SINGLE JSON object exactly matching the schema in the agent prompt.\n"
        "No code fences. No prose before or after. If you cannot extract anything, "
        "still output a valid object with `items: []`."
    )
    return "\n\n".join(parts)


def _parse_json_strict(raw: str) -> dict[str, Any]:
    """Tolerant of a stray code fence even though we asked for none."""
    s = raw.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s)
        s = re.sub(r"\s*```$", "", s)
    try:
        return json.loads(s)
    except json.JSONDecodeError as e:
        sys.stderr.write("Failed to parse model output as JSON:\n")
        sys.stderr.write(s[:2000] + ("\n…" if len(s) > 2000 else "\n"))
        raise click.ClickException(f"Model returned non-JSON output: {e}") from e


if __name__ == "__main__":
    cli()
