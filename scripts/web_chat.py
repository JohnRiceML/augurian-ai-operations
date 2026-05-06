"""Streamlit chat UI over Fireflies meetings stored in Google Drive.

Single-page web app for testing the Fireflies → Drive → agent flow without
local-PDF dependencies. Auth is delegated to the existing CLI (Streamlit
+ OAuth in-app is fragile); we just read the persisted token.

Run:

    pip install streamlit
    python scripts/fireflies_walkthrough.py auth   # one-time
    streamlit run scripts/web_chat.py

Reuses everything from `scripts.ask` — tool schemas, system prompt,
Anthropic client, plus the file-backed implementations of
query_commitments / get_meeting_details. The two read tools
(read_meeting_summary, read_meeting_transcript) and list_meetings get
Drive-aware overrides that fall back to the local raw dir if Drive is
unreachable or the file isn't there.
"""

from __future__ import annotations

import importlib.util
import io
import json
import os
import sys
from pathlib import Path
from typing import Any

import streamlit as st

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = REPO_ROOT / "scripts"


def _load_sibling(name: str) -> Any:
    """Load a sibling script by file path. `scripts/` is not a package, so
    `from scripts.ask import ...` fails when this app is run via `streamlit
    run scripts/web_chat.py`. The path-based loader sidesteps that without
    modifying `scripts/ask.py` or adding a package marker."""
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, str(SCRIPTS_DIR / f"{name}.py"))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load {name}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# Reuse the agent surface — DO NOT redefine schemas, prompts, or the client.
_ask = _load_sibling("ask")
_walkthrough = _load_sibling("fireflies_walkthrough")

CLAUDE_MODEL = _ask.CLAUDE_MODEL
PROCESSED_DIR = _ask.PROCESSED_DIR
RAW_FIREFLY_DIR = _ask.RAW_FIREFLY_DIR
_anthropic = _ask._anthropic
_apply_corrections = _ask._apply_corrections
_load_corrections = _ask._load_corrections
detect_corruption = _walkthrough.detect_corruption
tool_get_meeting_details = _ask.tool_get_meeting_details
tool_list_meetings_local = _ask.tool_list_meetings
tool_query_commitments = _ask.tool_query_commitments

CREDS_DIR = REPO_ROOT / "credentials"
TOKEN_FILE = CREDS_DIR / "drive_token.json"
# All three scopes are requested at auth time. We list them here so
# `_load_creds` loads a token that knows about all three; if the user has
# only granted a subset (older token), the sidebar will show which are missing.
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/webmasters.readonly",
]
DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"
GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly"
GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly"
AUTH_CMD = "python scripts/fireflies_walkthrough.py auth"
REPO_URL = "https://github.com/JohnRiceML/augurian-ai-operations"


# ----------------------------- Drive helpers -----------------------------

def _load_creds():
    """Load saved Google credentials. Refresh in-place if expired. Returns None if no token.

    Same token covers Drive + GA4 + GSC because the CLI's `auth` command requests
    all three scopes in a single OAuth flow. The sidebar inspects `creds.scopes`
    to show which APIs are usable in this session.
    """
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials

    if not TOKEN_FILE.exists():
        return None
    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), GOOGLE_SCOPES)
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            TOKEN_FILE.write_text(creds.to_json())
        except Exception as exc:  # surface but don't crash
            st.session_state["drive_error"] = f"Token refresh failed: {exc}"
            return None
    return creds


def _ga4_client(creds):
    """Build an authenticated GA4 Data API client."""
    from google.analytics.data_v1beta import BetaAnalyticsDataClient

    return BetaAnalyticsDataClient(credentials=creds)


def _gsc_service(creds):
    """Build an authenticated Search Console v1 service."""
    from googleapiclient.discovery import build

    return build("searchconsole", "v1", credentials=creds, cache_discovery=False)


def _drive_service():
    """Build a Drive v3 service. Cached on st.session_state for the session."""
    if "drive_service" in st.session_state:
        return st.session_state["drive_service"]
    creds = _load_creds()
    if creds is None:
        return None
    from googleapiclient.discovery import build

    svc = build("drive", "v3", credentials=creds, cache_discovery=False)
    st.session_state["drive_service"] = svc
    return svc


def _drive_search_pdf(svc, slug: str, kind: str, folder_id: str | None) -> dict[str, Any] | None:
    """Find a Fireflies PDF on Drive whose name contains slug AND -<kind>-."""
    parts = [
        "mimeType='application/pdf'",
        "trashed=false",
        f"name contains '{slug}'",
        f"name contains '-{kind}-'",
    ]
    if folder_id:
        parts.append(f"'{folder_id}' in parents")
    q = " and ".join(parts)
    resp = svc.files().list(
        q=q,
        pageSize=10,
        orderBy="modifiedTime desc",
        fields="files(id,name,mimeType,modifiedTime,webViewLink)",
    ).execute()
    files = resp.get("files", [])
    return files[0] if files else None


def _drive_list_transcripts(svc, folder_id: str | None) -> list[dict[str, Any]]:
    """List Fireflies transcript PDFs (Drive-side discovery)."""
    parts = [
        "mimeType='application/pdf'",
        "trashed=false",
        "name contains 'transcript'",
    ]
    if folder_id:
        parts.append(f"'{folder_id}' in parents")
    q = " and ".join(parts)
    resp = svc.files().list(
        q=q,
        pageSize=50,
        orderBy="modifiedTime desc",
        fields="files(id,name,mimeType,modifiedTime,webViewLink)",
    ).execute()
    return resp.get("files", [])


def _download_pdf_text(svc, file_id: str) -> str:
    """Download a Drive PDF and extract text. Cached on st.session_state by file_id."""
    cache: dict[str, str] = st.session_state.setdefault("pdf_text_cache", {})
    if file_id in cache:
        return cache[file_id]
    from pypdf import PdfReader

    data = svc.files().get_media(fileId=file_id).execute()
    if not isinstance(data, bytes):
        data = bytes(data)
    reader = PdfReader(io.BytesIO(data))
    text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
    cache[file_id] = text
    return text


# ----------------------------- Tool implementations (Drive-aware) -----------------------------

def _drive_read(client: str, slug: str, kind: str) -> dict[str, Any]:
    """Drive-first read of a Fireflies PDF. Falls back to local raw text on miss."""
    svc = _drive_service()
    folder_id = st.session_state.get("drive_folder_id") or os.environ.get("AUGUR_DRIVE_FOLDER_ID")

    if svc is not None:
        try:
            hit = _drive_search_pdf(svc, slug, kind, folder_id)
        except Exception as exc:
            hit = None
            st.session_state["drive_last_error"] = f"Drive search failed: {exc}"
        if hit is not None:
            try:
                raw = _download_pdf_text(svc, hit["id"])
                corrected, applied = _apply_corrections(raw, _load_corrections(client))
                out: dict[str, Any] = {
                    "source": "drive",
                    "drive_file_id": hit["id"],
                    "drive_name": hit["name"],
                    "web_link": hit.get("webViewLink", ""),
                    "kind": kind,
                    "char_count": len(corrected),
                    "text": corrected,
                }
                findings = detect_corruption(corrected)
                if findings:
                    out["corruption_findings"] = findings
                if applied:
                    out["spelling_corrections_applied"] = applied
                return out
            except Exception as exc:
                st.session_state["drive_last_error"] = f"Drive download/parse failed: {exc}"

    # Fallback: local raw text written by fireflies_walkthrough pull-local.
    base = RAW_FIREFLY_DIR / client
    direct = base / f"{slug}-{kind}.txt"
    if direct.exists():
        path = direct
    elif not base.exists():
        return {"error": f"no Drive match and no local raw folder for client '{client}'"}
    else:
        matches = sorted(base.glob(f"*{slug}*-{kind}.txt"))
        if not matches:
            available = sorted(p.stem for p in base.glob(f"*-{kind}.txt"))
            return {
                "error": f"no Drive match and no local {kind} for slug '{slug}' (client={client})",
                "available_slugs": available,
            }
        if len(matches) > 1:
            return {
                "error": f"ambiguous slug '{slug}' in local fallback",
                "candidates": [m.stem for m in matches],
            }
        path = matches[0]
    raw = path.read_text()
    corrected, applied = _apply_corrections(raw, _load_corrections(client))
    out = {
        "source": "local",
        "path": str(path.relative_to(REPO_ROOT)),
        "kind": kind,
        "char_count": len(corrected),
        "text": corrected,
    }
    findings = detect_corruption(corrected)
    if findings:
        out["corruption_findings"] = findings
    if applied:
        out["spelling_corrections_applied"] = applied
    return out


def tool_list_meetings(args: dict[str, Any]) -> dict[str, Any]:
    """Local-first list. Falls back to Drive transcript discovery if local empty."""
    local = tool_list_meetings_local(args)
    if local.get("meetings"):
        return local
    svc = _drive_service()
    if svc is None:
        return local  # no fallback possible
    folder_id = st.session_state.get("drive_folder_id") or os.environ.get("AUGUR_DRIVE_FOLDER_ID")
    try:
        files = _drive_list_transcripts(svc, folder_id)
    except Exception as exc:
        return {**local, "drive_error": str(exc)}
    meetings = []
    for f in files:
        # Convention: <title>-transcript-<ISO>.pdf — slug is name minus -transcript-... suffix.
        name = f["name"]
        slug = name
        if "-transcript-" in name:
            slug = name.split("-transcript-", 1)[0]
        meetings.append(
            {
                "slug": slug,
                "drive_file_id": f["id"],
                "drive_name": name,
                "modified_time": f.get("modifiedTime", ""),
            }
        )
    return {"client": args["client"], "meetings": meetings, "count": len(meetings), "source": "drive"}


def tool_read_meeting_summary(args: dict[str, Any]) -> dict[str, Any]:
    return _drive_read(args["client"], args["meeting_slug"], "summary")


def tool_read_meeting_transcript(args: dict[str, Any]) -> dict[str, Any]:
    return _drive_read(args["client"], args["meeting_slug"], "transcript")


# ----------------------------- Live Google API tools -----------------------------
#
# These two tools hit Google's APIs directly using the same OAuth creds the
# Drive tools use. They live in web_chat.py only — the CLI (`scripts/ask.py`)
# stays file-backed so its tests + plumbing don't depend on network calls.

def tool_query_ga4(args: dict[str, Any], creds) -> dict[str, Any]:
    """Run a GA4 RunReport against one property."""
    try:
        from google.analytics.data_v1beta.types import (
            DateRange,
            Dimension,
            Metric,
            RunReportRequest,
        )

        client = _ga4_client(creds)
        req = RunReportRequest(
            property=f"properties/{args['property_id']}",
            metrics=[Metric(name=m) for m in args["metrics"]],
            dimensions=[Dimension(name=d) for d in args.get("dimensions", [])],
            date_ranges=[
                DateRange(start_date=args["start_date"], end_date=args["end_date"])
            ],
            limit=args.get("limit", 25),
        )
        resp = client.run_report(req)
        return {
            "row_count": len(resp.rows),
            "totals": [
                {
                    m.name: v.value
                    for m, v in zip(resp.metric_headers, totals.metric_values)
                }
                for totals in resp.totals
            ],
            "rows": [
                {
                    "dimensions": {
                        dh.name: dv.value
                        for dh, dv in zip(resp.dimension_headers, r.dimension_values)
                    },
                    "metrics": {
                        mh.name: mv.value
                        for mh, mv in zip(resp.metric_headers, r.metric_values)
                    },
                }
                for r in resp.rows
            ],
        }
    except Exception as exc:
        return {"error": f"ga4 query failed: {type(exc).__name__}: {exc}"}


def tool_query_gsc(args: dict[str, Any], creds) -> dict[str, Any]:
    """Run a Search Console searchanalytics.query for one site."""
    try:
        svc = _gsc_service(creds)
        body: dict[str, Any] = {
            "startDate": args["start_date"],
            "endDate": args["end_date"],
            "dimensions": args.get("dimensions", ["query"]),
            "rowLimit": args.get("row_limit", 25),
        }
        qf = args.get("query_filter")
        if qf:
            body["dimensionFilterGroups"] = [
                {
                    "filters": [
                        {
                            "dimension": "query",
                            "operator": "contains",
                            "expression": qf,
                        }
                    ]
                }
            ]
        resp = (
            svc.searchanalytics()
            .query(siteUrl=args["site_url"], body=body)
            .execute()
        )
        rows = resp.get("rows", [])
        return {
            "row_count": len(rows),
            "rows": [
                {
                    "keys": r.get("keys", []),
                    "clicks": r.get("clicks", 0),
                    "impressions": r.get("impressions", 0),
                    "ctr": round(r.get("ctr", 0.0), 4),
                    "position": round(r.get("position", 0.0), 2),
                }
                for r in rows
            ],
        }
    except Exception as exc:
        return {"error": f"gsc query failed: {type(exc).__name__}: {exc}"}


# ----------------------------- Tool registry -----------------------------

# Extra tool schemas that this runtime adds on top of `_ask.TOOLS`. Live API
# tools — Drive credentials are required to actually run them.
WEB_EXTRA_TOOLS: list[dict[str, Any]] = [
    {
        "name": "query_ga4",
        "description": (
            "Run a Google Analytics 4 report for one property. Live API call. "
            "Use when the user asks about traffic, sessions, conversions, "
            "engagement, page-level performance over a date range. Returns "
            "rows + totals. Do not use for keyword/search-query data — that's "
            "Search Console."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "property_id": {
                    "type": "string",
                    "description": "GA4 property ID (numeric, no 'properties/' prefix)",
                },
                "metrics": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "GA4 metric names. Common: sessions, screenPageViews, "
                        "totalUsers, conversions, engagementRate."
                    ),
                },
                "dimensions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Optional GA4 dimension names. Common: date, pagePath, "
                        "sessionDefaultChannelGroup, country."
                    ),
                },
                "start_date": {
                    "type": "string",
                    "description": "YYYY-MM-DD or relative like '7daysAgo'.",
                },
                "end_date": {
                    "type": "string",
                    "description": "YYYY-MM-DD or 'today'.",
                },
                "limit": {"type": "integer", "default": 25},
            },
            "required": ["property_id", "metrics", "start_date", "end_date"],
        },
    },
    {
        "name": "query_gsc",
        "description": (
            "Run a Google Search Console search-analytics query for one site. "
            "Live API call. Use when the user asks about search queries, "
            "rankings, impressions, click-through rate, or page-level search "
            "performance. Returns rows with clicks/impressions/ctr/position."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "site_url": {
                    "type": "string",
                    "description": (
                        "Verified GSC site URL, including trailing slash. e.g. "
                        "'https://example.com/' or 'sc-domain:example.com'."
                    ),
                },
                "dimensions": {
                    "type": "array",
                    "items": {
                        "type": "string",
                        "enum": ["query", "page", "country", "device", "date"],
                    },
                    "default": ["query"],
                },
                "start_date": {"type": "string", "description": "YYYY-MM-DD."},
                "end_date": {"type": "string", "description": "YYYY-MM-DD."},
                "row_limit": {"type": "integer", "default": 25},
                "query_filter": {
                    "type": "string",
                    "description": (
                        "Optional substring filter on the 'query' dimension."
                    ),
                },
            },
            "required": ["site_url", "start_date", "end_date"],
        },
    },
]

# Merge: keep the original 5 file-backed tools, append the 2 live-API ones.
# The original `_ask.TOOLS` list stays untouched so the CLI keeps working.
WEB_TOOLS: list[dict[str, Any]] = list(_ask.TOOLS) + WEB_EXTRA_TOOLS

# Live-API tools need authenticated creds, which the file-backed tools do not.
# We pick the contract: file-backed tools take (args), live tools take
# (args, creds). The dispatch in `_run_agent_turn` branches on tool name. This
# avoids wrapping every existing tool just to ignore an unused argument and
# keeps the call sites readable.
TOOL_RUNNERS = {
    "query_commitments": tool_query_commitments,
    "get_meeting_details": tool_get_meeting_details,
    "list_meetings": tool_list_meetings,
    "read_meeting_summary": tool_read_meeting_summary,
    "read_meeting_transcript": tool_read_meeting_transcript,
    "query_ga4": tool_query_ga4,
    "query_gsc": tool_query_gsc,
}
LIVE_API_TOOLS = {"query_ga4", "query_gsc"}


# ----------------------------- UI helpers -----------------------------

def _render_setup_screen() -> None:
    """Centered setup card. Uses native Streamlit components so the colors
    follow the user's theme (light or dark) instead of inheriting unreadable
    contrast from a hardcoded card background."""
    _, mid, _ = st.columns([1, 2, 1])
    with mid:
        st.title("Drive not connected")
        st.write(
            "This app reuses the CLI's Drive token. Run the one-time auth "
            "command first:"
        )
        st.code(AUTH_CMD, language="bash")
        st.write(
            "Once you authorize in your browser, the token persists in "
            "`credentials/drive_token.json`. Then come back here and click "
            "**Reload**."
        )
        st.write("")
        if st.button("Reload", type="primary", use_container_width=True):
            st.rerun()
        st.caption(
            "Don't have OAuth credentials yet? "
            "See `scripts/fireflies_walkthrough.py auth --help` for the GCP "
            "console steps (5 minutes, one-time)."
        )


def _render_tool_block(name: str, args: dict[str, Any], result: dict[str, Any]) -> None:
    label = f"tool · {name}"
    with st.expander(label, expanded=False):
        st.caption("args")
        st.code(json.dumps(args, indent=2), language="json")
        st.caption("result preview")
        # Truncate very large fields (transcript text) for the preview.
        preview = dict(result)
        if isinstance(preview.get("text"), str) and len(preview["text"]) > 1200:
            preview["text"] = preview["text"][:1200] + f"… [+{len(result['text']) - 1200} chars]"
        st.code(json.dumps(preview, indent=2)[:6000], language="json")
        if result.get("corruption_findings"):
            n = len(result["corruption_findings"])
            st.warning(f"Corruption signatures detected: {n} finding(s). The PDF may have garbled timestamps or speaker lines.")
        if result.get("spelling_corrections_applied"):
            applied = result["spelling_corrections_applied"]
            total = sum(c.get("count", 0) for c in applied)
            st.info(f"Applied {len(applied)} spelling correction(s), {total} total replacement(s).")


def _web_system_prompt() -> str:
    """Augment the file-backed system prompt with rules for the live GA4/GSC tools.

    We don't modify scripts/ask.py (its CLI doesn't have these tools) — we
    just append a section so the chat agent knows when to reach for live data
    vs. the meeting tools.
    """
    base = _ask._system_prompt()
    extra = """

# This runtime is Drive-aware — read tools hit live Drive, not just local files

The descriptions in the cascade above were written for the file-backed CLI
runtime. In THIS runtime (the web chat), three of the meeting tools query
LIVE Google Drive in addition to the local cache:

- **`list_meetings(client)`** — returns BOTH:
  - meetings already extracted to the local index (with `source: "extracted"`)
  - meetings whose Fireflies PDFs sit in Drive but haven't been extracted
    yet (with `source: "drive_only"`, plus a `drive_file_id` and `drive_name`)
  Total under `count`; per-source counts under `extracted_count` and
  `drive_only_count`.

- **`read_meeting_summary(client, meeting_slug)`** — searches Drive for a
  PDF whose name contains `<slug>` AND `-summary-`, downloads it, runs
  pypdf + spelling corrections. Falls back to local raw text if Drive misses.

- **`read_meeting_transcript(client, meeting_slug)`** — same pattern for
  the transcript PDF.

So if `query_commitments` shows nothing for a date the user asked about, do
NOT conclude the meeting doesn't exist. Call `list_meetings` and check the
`drive_only` entries — the transcript may be in Drive but not yet extracted.
You can then `read_meeting_summary` or `read_meeting_transcript` to read it
live. Only commitments from extracted meetings appear in the index; live
reads of unextracted meetings give you the raw text but not structured items.

For drive_only meetings the slug is derived from the Fireflies filename:
everything before `-transcript-`. E.g. `John-Christie-Tony-transcript-...pdf`
has slug `John-Christie-Tony`. Pass that exact slug to read_meeting_*.

# Live Google API tools (this runtime only)

You ALSO have two live API tools that hit Google's APIs directly:

- **`query_ga4(property_id, metrics, dimensions, start_date, end_date)`** —
  GA4 traffic + engagement reports. Use for: sessions, page views, users,
  conversions, traffic sources, engagement rates, page-level performance.
  Do NOT use for keyword/search-query data — that's GSC.

- **`query_gsc(site_url, dimensions, start_date, end_date, query_filter?)`** —
  Search Console search-analytics. Use for: search queries the site ranks
  for, rankings, impressions, CTR, page-level search performance.

When to use these vs. the meeting tools:
- The meeting tools (query_commitments, get_meeting_details, read_meeting_*)
  answer "what did we say / decide / commit to."
- The live API tools answer "what's the actual performance data."
- A question like "did the SEO change we discussed in the May call work?"
  uses BOTH — read the May call to find the change, then query GSC for
  the page that changed.

The user must provide property_id (GA4) or site_url (GSC) — these are
client-specific and live in pipelines/clients.yaml. If they're not given
in the question and not in chat history, ask the user before guessing.
"""
    return base + extra


def _run_agent_turn(user_question: str, client: str) -> None:
    """Run the tool-use loop until end_turn. Streams tool calls into the UI."""
    anthropic = _anthropic()
    system = _web_system_prompt()
    # Live-API tools need creds. File-backed tools don't. We resolve creds
    # once per turn — they may be None if the user revoked access mid-session.
    creds = _load_creds()

    # Convert prior visible turns into the API message shape, then append the new user question.
    api_messages: list[dict[str, Any]] = []
    for m in st.session_state.messages:
        if m["role"] == "user":
            api_messages.append({"role": "user", "content": m["content"]})
        elif m["role"] == "assistant" and m.get("text"):
            api_messages.append({"role": "assistant", "content": m["text"]})
    api_messages.append({"role": "user", "content": f"Client: {client}\n\nQuestion: {user_question}"})

    assistant_record: dict[str, Any] = {"role": "assistant", "text": "", "tool_calls": []}
    placeholder = st.chat_message("assistant")
    status = placeholder.status("Thinking…", expanded=True)

    iteration = 0
    max_iterations = 8
    while iteration < max_iterations:
        iteration += 1
        resp = anthropic.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            system=system,
            tools=WEB_TOOLS,
            messages=api_messages,
        )
        st.session_state.tokens_in += resp.usage.input_tokens
        st.session_state.tokens_out += resp.usage.output_tokens

        text_parts: list[str] = []
        tool_uses = []
        for block in resp.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_uses.append(block)

        if resp.stop_reason == "end_turn":
            assistant_record["text"] = "\n".join(p for p in text_parts if p.strip())
            break

        if resp.stop_reason != "tool_use":
            assistant_record["text"] = (
                "\n".join(text_parts)
                + f"\n\n_Unexpected stop_reason: {resp.stop_reason}_"
            )
            break

        api_messages.append({"role": "assistant", "content": resp.content})
        tool_results: list[dict[str, Any]] = []
        for tu in tool_uses:
            runner = TOOL_RUNNERS.get(tu.name)
            status.write(f"calling `{tu.name}`…")
            if runner is None:
                result = {"error": f"unknown tool '{tu.name}'"}
            else:
                try:
                    if tu.name in LIVE_API_TOOLS:
                        if creds is None:
                            result = {
                                "error": (
                                    "Google credentials unavailable. Re-run "
                                    "`python scripts/fireflies_walkthrough.py auth`."
                                )
                            }
                        else:
                            result = runner(tu.input, creds)
                    else:
                        result = runner(tu.input)
                except Exception as exc:
                    result = {"error": str(exc)}
            assistant_record["tool_calls"].append(
                {"name": tu.name, "args": tu.input, "result": result}
            )
            with status:
                _render_tool_block(tu.name, tu.input, result)
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": json.dumps(result),
                }
            )
        api_messages.append({"role": "user", "content": tool_results})
    else:
        assistant_record["text"] = f"_Hit max iterations ({max_iterations}) without final answer._"

    status.update(label=f"Done — {iteration} iteration(s)", state="complete", expanded=False)
    if assistant_record["text"]:
        placeholder.markdown(assistant_record["text"])
    st.session_state.messages.append(assistant_record)


def _render_sidebar() -> tuple[str, bool]:
    """Returns (client_slug, drive_ok)."""
    with st.sidebar:
        st.subheader("Session")
        client = st.text_input("Client slug", value=st.session_state.get("client", "sandbox"))
        st.session_state["client"] = client

        creds = _load_creds()
        drive_ok = creds is not None
        if drive_ok:
            granted = set(getattr(creds, "scopes", None) or [])

            def _has(scope: str) -> bool:
                return scope in granted

            if _has(DRIVE_SCOPE):
                st.success("Drive: connected")
            else:
                st.error("Drive: scope not granted")
            if _has(GA4_SCOPE):
                st.success("GA4: connected")
            else:
                st.warning(
                    "GA4: scope not granted — re-run "
                    "`python scripts/fireflies_walkthrough.py auth` to grant "
                    "additional scopes."
                )
            if _has(GSC_SCOPE):
                st.success("GSC: connected")
            else:
                st.warning(
                    "GSC: scope not granted — re-run "
                    "`python scripts/fireflies_walkthrough.py auth` to grant "
                    "additional scopes."
                )

            expiry = getattr(creds, "expiry", None)
            if expiry is not None:
                st.caption(f"Access token expiry: {expiry.isoformat()}")
            if creds.refresh_token:
                st.caption("Refresh token: present")
            else:
                st.caption("Refresh token: missing (re-run CLI auth)")
        else:
            st.error("Drive: not connected")
            st.caption(f"Run `{AUTH_CMD}`")

        if st.session_state.get("drive_last_error"):
            st.warning(st.session_state["drive_last_error"])

        folder_id = st.text_input(
            "Drive folder ID (optional)",
            value=st.session_state.get("drive_folder_id")
            or os.environ.get("AUGUR_DRIVE_FOLDER_ID", ""),
            help="Constrain Drive searches to a single folder. Leave blank to search all of Drive.",
        )
        st.session_state["drive_folder_id"] = folder_id.strip() or None

        st.divider()
        st.subheader("Usage")
        st.metric("Input tokens", f"{st.session_state.tokens_in:,}")
        st.metric("Output tokens", f"{st.session_state.tokens_out:,}")

        if st.button("Reset conversation"):
            st.session_state.messages = []
            st.session_state.tokens_in = 0
            st.session_state.tokens_out = 0
            st.session_state.pop("pdf_text_cache", None)
            st.rerun()

        st.divider()
        st.caption(
            f"[repo]({REPO_URL}) · `claude_ai_skills/` lives at the repo root"
        )
    return client, drive_ok


# ----------------------------- App entry -----------------------------

def main() -> None:
    st.set_page_config(page_title="Augurian — Fireflies chat", layout="wide")
    st.title("Augurian — Fireflies chat")
    st.caption("Drive-backed agent over your Fireflies meetings. Drafter pattern; nothing is sent externally.")

    # Init session state.
    st.session_state.setdefault("messages", [])
    st.session_state.setdefault("tokens_in", 0)
    st.session_state.setdefault("tokens_out", 0)

    if not TOKEN_FILE.exists():
        _render_setup_screen()
        return

    client, drive_ok = _render_sidebar()
    if not drive_ok:
        # Token file exists but credentials failed to load. Show setup screen.
        _render_setup_screen()
        return

    # Replay history.
    for m in st.session_state.messages:
        if m["role"] == "user":
            with st.chat_message("user"):
                st.markdown(m["content"])
        else:
            with st.chat_message("assistant"):
                for tc in m.get("tool_calls", []):
                    _render_tool_block(tc["name"], tc["args"], tc["result"])
                if m.get("text"):
                    st.markdown(m["text"])

    user_question = st.chat_input("Ask about your Fireflies meetings…")
    if user_question:
        st.session_state.messages.append({"role": "user", "content": user_question})
        with st.chat_message("user"):
            st.markdown(user_question)
        try:
            _run_agent_turn(user_question, client)
        except Exception as exc:
            st.error(f"Agent loop crashed: {exc}")


if __name__ == "__main__":
    main()
