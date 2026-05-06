"""FastAPI backend for the polished Next.js front-end.

This is the production HTTP surface for the Augurian agent. It runs the
exact same tool-use loop as `scripts/web_chat.py` (the Streamlit dev rig),
but exposes it as Server-Sent Events so a real web UI can stream tool
calls and text deltas as they happen.

What it reuses (DO NOT redefine):
- Tool schemas: `scripts.web_chat.WEB_TOOLS` (the 5 file-backed tools + 2 live API tools)
- Tool runners: `scripts.web_chat.TOOL_RUNNERS` (Drive-aware overrides)
- System prompt: `scripts.web_chat._web_system_prompt` (commitment-tracker + GA4/GSC rules)
- Anthropic client: `scripts.ask._anthropic`
- Google creds loader: `scripts.web_chat._load_creds`

What it does NOT do:
- Persist conversation history (that's the browser's job — localStorage).
- Talk to Anthropic from the browser (secrets stay server-side).
- Re-implement Streamlit's session_state coupling — we keep `web_chat.py`
  untouched and run our own loop here that yields events instead of
  writing into st.session_state.

Run:
    uvicorn scripts.api:app --port 8000 --reload
"""

from __future__ import annotations

import asyncio
import importlib.util
import json
import os
import sys
from pathlib import Path
from typing import Any, AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

REPO_ROOT = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = REPO_ROOT / "scripts"


def _load_sibling(name: str) -> Any:
    """Load `scripts/<name>.py` by file path. Mirrors web_chat._load_sibling.

    The `scripts/` directory is not a Python package, so a normal import
    only works when the cwd happens to align. Loading by file path makes
    `uvicorn scripts.api:app` work regardless of where it is launched.
    """
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, str(SCRIPTS_DIR / f"{name}.py"))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load {name}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# `web_chat` imports streamlit at module load. We don't want the API server
# to require streamlit, but the module-level `import streamlit as st` makes
# that hard to avoid without refactoring web_chat. Streamlit IS in the dev
# extras, so for local dev this is fine. If a deployment ever drops the
# streamlit dep we can extract a streamlit-free `agent_core.py` and have
# both web_chat.py and api.py import from it.
_ask = _load_sibling("ask")
_web = _load_sibling("web_chat")

CLAUDE_MODEL = _ask.CLAUDE_MODEL
WEB_TOOLS = _web.WEB_TOOLS
LIVE_API_TOOLS = _web.LIVE_API_TOOLS
_anthropic = _ask._anthropic
_load_creds = _web._load_creds
_web_system_prompt = _web._web_system_prompt

# We can't reuse `_web.TOOL_RUNNERS` directly because some of its entries
# (notably tool_list_meetings, tool_read_meeting_summary, tool_read_meeting_transcript)
# call into st.session_state for caching + folder-id lookup. We need a
# Streamlit-free dispatch for the API runtime.
#
# Strategy: import the local file-backed implementations from `_ask` for
# everything except the live API tools, and write thin Drive-aware wrappers
# locally that read from request state instead of st.session_state.
_apply_corrections = _ask._apply_corrections
_load_corrections = _ask._load_corrections
detect_corruption = _web.detect_corruption
RAW_FIREFLY_DIR = _ask.RAW_FIREFLY_DIR


# ----------------------------- Drive helpers (Streamlit-free) -----------------------------


def _drive_service_for(creds: Any) -> Any | None:
    """Build a Drive v3 service from creds. Returns None if creds is None."""
    if creds is None:
        return None
    from googleapiclient.discovery import build

    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _drive_search_pdf(svc: Any, slug: str, kind: str, folder_id: str | None) -> dict[str, Any] | None:
    """Same logic as web_chat._drive_search_pdf, but no Streamlit."""
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


def _drive_list_transcripts(svc: Any, folder_id: str | None) -> list[dict[str, Any]]:
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


def _download_pdf_text(svc: Any, file_id: str, cache: dict[str, str]) -> str:
    """Cache is per-request (one dict per chat call), not global — safer."""
    if file_id in cache:
        return cache[file_id]
    import io
    from pypdf import PdfReader

    data = svc.files().get_media(fileId=file_id).execute()
    if not isinstance(data, bytes):
        data = bytes(data)
    reader = PdfReader(io.BytesIO(data))
    text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
    cache[file_id] = text
    return text


def _drive_read(
    svc: Any,
    folder_id: str | None,
    pdf_cache: dict[str, str],
    client: str,
    slug: str,
    kind: str,
) -> dict[str, Any]:
    """Drive-first read of a Fireflies PDF. Falls back to local raw text on miss.

    Same shape as web_chat._drive_read but parameterized — no st.session_state.
    """
    if svc is not None:
        try:
            hit = _drive_search_pdf(svc, slug, kind, folder_id)
        except Exception:
            hit = None
        if hit is not None:
            try:
                raw = _download_pdf_text(svc, hit["id"], pdf_cache)
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
                # Fall through to local fallback. We surface the error message
                # so the model can decide whether to retry or escalate.
                drive_error = f"Drive download/parse failed: {exc}"
        else:
            drive_error = None
    else:
        drive_error = None

    # Local fallback.
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
    if drive_error:
        out["drive_error"] = drive_error
    findings = detect_corruption(corrected)
    if findings:
        out["corruption_findings"] = findings
    if applied:
        out["spelling_corrections_applied"] = applied
    return out


def _build_runners(
    svc: Any,
    folder_id: str | None,
    pdf_cache: dict[str, str],
    creds: Any,
) -> dict[str, Any]:
    """Per-request runner table. Closes over Drive service + creds."""

    def _list_meetings(args: dict[str, Any]) -> dict[str, Any]:
        """List meetings — merge local extractions + Drive PDFs.

        Drive is the source of truth for what meetings exist; local is just
        the cache of what's been extracted. The agent needs to see both so
        it can answer "was there a meeting yesterday?" even when the
        extractor hasn't run yet.
        """
        local = _ask.tool_list_meetings(args)
        local_meetings = local.get("meetings", []) or []
        for m in local_meetings:
            m["source"] = "extracted"

        drive_meetings: list[dict[str, Any]] = []
        drive_error: str | None = None
        if svc is not None:
            try:
                files = _drive_list_transcripts(svc, folder_id)
            except Exception as exc:
                drive_error = str(exc)
            else:
                local_slugs = {m.get("slug") for m in local_meetings}
                for f in files:
                    name = f["name"]
                    slug = name
                    if "-transcript-" in name:
                        slug = name.split("-transcript-", 1)[0]
                    if slug in local_slugs:
                        # Already extracted — Drive entry is redundant.
                        continue
                    drive_meetings.append(
                        {
                            "slug": slug,
                            "drive_file_id": f["id"],
                            "drive_name": name,
                            "modified_time": f.get("modifiedTime", ""),
                            "source": "drive_only",
                        }
                    )

        all_meetings = local_meetings + drive_meetings
        result: dict[str, Any] = {
            "client": args["client"],
            "meetings": all_meetings,
            "count": len(all_meetings),
            "extracted_count": len(local_meetings),
            "drive_only_count": len(drive_meetings),
            "drive_searched": svc is not None,
        }
        if drive_error:
            result["drive_error"] = drive_error
        return result

    def _read_summary(args: dict[str, Any]) -> dict[str, Any]:
        return _drive_read(svc, folder_id, pdf_cache, args["client"], args["meeting_slug"], "summary")

    def _read_transcript(args: dict[str, Any]) -> dict[str, Any]:
        return _drive_read(svc, folder_id, pdf_cache, args["client"], args["meeting_slug"], "transcript")

    def _query_ga4(args: dict[str, Any]) -> dict[str, Any]:
        if creds is None:
            return {
                "error": (
                    "Google credentials unavailable. Re-run "
                    "`python scripts/fireflies_walkthrough.py auth`."
                )
            }
        return _web.tool_query_ga4(args, creds)

    def _query_gsc(args: dict[str, Any]) -> dict[str, Any]:
        if creds is None:
            return {
                "error": (
                    "Google credentials unavailable. Re-run "
                    "`python scripts/fireflies_walkthrough.py auth`."
                )
            }
        return _web.tool_query_gsc(args, creds)

    return {
        "query_commitments": _ask.tool_query_commitments,
        "get_meeting_details": _ask.tool_get_meeting_details,
        "list_meetings": _list_meetings,
        "read_meeting_summary": _read_summary,
        "read_meeting_transcript": _read_transcript,
        "query_ga4": _query_ga4,
        "query_gsc": _query_gsc,
    }


# ----------------------------- Agent loop (generator) -----------------------------


def _truncate_for_event(obj: Any, limit: int = 500) -> Any:
    """Return a JSON-stringified preview no longer than `limit` chars.

    We send a small preview over SSE so the UI can render the tool result
    inline without bloating the wire. The full result still goes back to
    the model in the next turn — this only trims the event payload.
    """
    s = json.dumps(obj, default=str)
    if len(s) <= limit:
        return obj
    return {"_preview": s[:limit] + "…", "_truncated": True, "_full_len": len(s)}


async def _run_agent_stream(
    *,
    client: str,
    messages: list[dict[str, Any]],
    drive_folder_id: str | None,
    max_iterations: int = 8,
) -> AsyncIterator[dict[str, Any]]:
    """Run the tool-use loop, yielding SSE event dicts.

    Yields dicts of shape {"event": str, "data": str}. The caller wraps them
    in EventSourceResponse so sse-starlette serializes them correctly.

    We deliberately do NOT use Anthropic's streaming API here — the agent
    loop iterates many tool calls per turn, and a non-streaming
    messages.create per iteration is simpler + sufficient for the UX we
    want (tool calls stream live; the final text appears in one chunk
    after the last iteration). Switching to true token streaming is a
    later optimization, not a v1 requirement.
    """
    anthropic = _anthropic()
    system = _web_system_prompt()
    creds = _load_creds()
    svc = _drive_service_for(creds)
    pdf_cache: dict[str, str] = {}
    runners = _build_runners(svc, drive_folder_id, pdf_cache, creds)

    # Build the API message list. The browser sends prior turns; we prepend
    # the client-slug context onto the latest user message just like the
    # CLI and the Streamlit rig do.
    api_messages: list[dict[str, Any]] = []
    for i, m in enumerate(messages):
        if m["role"] == "user" and i == len(messages) - 1:
            api_messages.append(
                {"role": "user", "content": f"Client: {client}\n\nQuestion: {m['content']}"}
            )
        else:
            api_messages.append({"role": m["role"], "content": m["content"]})

    total_in = total_out = 0
    iteration = 0

    while iteration < max_iterations:
        iteration += 1
        # The Anthropic SDK call is sync. Run it in a thread so we don't
        # block the event loop while it waits for the API.
        resp = await asyncio.to_thread(
            anthropic.messages.create,
            model=CLAUDE_MODEL,
            max_tokens=4096,
            system=system,
            tools=WEB_TOOLS,
            messages=api_messages,
        )
        total_in += resp.usage.input_tokens
        total_out += resp.usage.output_tokens

        text_parts: list[str] = []
        tool_uses: list[Any] = []
        for block in resp.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                tool_uses.append(block)

        if resp.stop_reason == "end_turn":
            text = "\n".join(p for p in text_parts if p.strip())
            if text:
                # We don't have token streaming wired up; emit the whole
                # final answer as one delta. The UI is shaped to handle
                # multiple deltas, so this is forward-compatible.
                yield {"event": "text_delta", "data": json.dumps({"text": text})}
            yield {
                "event": "done",
                "data": json.dumps(
                    {
                        "tokens_in": total_in,
                        "tokens_out": total_out,
                        "iterations": iteration,
                    }
                ),
            }
            return

        if resp.stop_reason != "tool_use":
            yield {
                "event": "error",
                "data": json.dumps(
                    {"message": f"Unexpected stop_reason: {resp.stop_reason}"}
                ),
            }
            return

        # Append the assistant turn so the next call sees it, then run the tools.
        api_messages.append({"role": "assistant", "content": resp.content})
        tool_results: list[dict[str, Any]] = []
        for tu in tool_uses:
            yield {
                "event": "tool_use",
                "data": json.dumps({"name": tu.name, "args": tu.input}),
            }
            runner = runners.get(tu.name)
            if runner is None:
                result: dict[str, Any] = {"error": f"unknown tool '{tu.name}'"}
            else:
                try:
                    # Run the tool in a thread. Most tools are file-system
                    # bound; the Drive + GA4 + GSC ones are network bound.
                    # Either way we don't want to block the event loop.
                    result = await asyncio.to_thread(runner, tu.input)
                except Exception as exc:
                    result = {"error": f"{type(exc).__name__}: {exc}"}
            yield {
                "event": "tool_result",
                "data": json.dumps(
                    {"name": tu.name, "result": _truncate_for_event(result)}
                ),
            }
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": json.dumps(result, default=str),
                }
            )
        api_messages.append({"role": "user", "content": tool_results})

    yield {
        "event": "error",
        "data": json.dumps(
            {"message": f"Hit max iterations ({max_iterations}) without final answer."}
        ),
    }


# ----------------------------- HTTP surface -----------------------------


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    client: str = "sandbox"
    messages: list[ChatMessage]
    drive_folder_id: str | None = None


app = FastAPI(title="Augurian agent API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    # Tight: only the local Next.js dev server. Don't widen this without a real reason.
    allow_origins=["http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.get("/api/status")
def status() -> dict[str, Any]:
    """Cheap connection check. Inspects creds.scopes — no API calls."""
    creds = _load_creds()
    token_path_exists = _web.TOKEN_FILE.exists()
    user_email = os.environ.get("AUGUR_USER_EMAIL") or os.environ.get("USER_EMAIL")

    if creds is None:
        return {
            "anthropic_configured": bool(os.environ.get("ANTHROPIC_API_KEY")),
            "drive": "not_connected",
            "ga4": "not_connected",
            "gsc": "not_connected",
            "user_email": user_email,
            "token_path_exists": token_path_exists,
        }

    granted = set(getattr(creds, "scopes", None) or [])

    def _state(scope: str) -> str:
        return "connected" if scope in granted else "scope_missing"

    return {
        "anthropic_configured": bool(os.environ.get("ANTHROPIC_API_KEY")),
        "drive": _state(_web.DRIVE_SCOPE),
        "ga4": _state(_web.GA4_SCOPE),
        "gsc": _state(_web.GSC_SCOPE),
        "user_email": user_email,
        "token_path_exists": token_path_exists,
    }


@app.post("/api/chat")
async def chat(req: ChatRequest) -> EventSourceResponse:
    if not req.messages:
        raise HTTPException(400, "messages must not be empty")
    if req.messages[-1].role != "user":
        raise HTTPException(400, "last message must be from the user")

    msgs = [m.model_dump() for m in req.messages]

    async def event_stream() -> AsyncIterator[dict[str, Any]]:
        try:
            async for ev in _run_agent_stream(
                client=req.client,
                messages=msgs,
                drive_folder_id=req.drive_folder_id,
            ):
                yield ev
        except Exception as exc:
            # No silent fallback — surface the error to the UI verbatim.
            yield {
                "event": "error",
                "data": json.dumps({"message": f"{type(exc).__name__}: {exc}"}),
            }

    return EventSourceResponse(event_stream())


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
