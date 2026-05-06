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

TOOLS = _ask.TOOLS
CLAUDE_MODEL = _ask.CLAUDE_MODEL
PROCESSED_DIR = _ask.PROCESSED_DIR
RAW_FIREFLY_DIR = _ask.RAW_FIREFLY_DIR
_anthropic = _ask._anthropic
_apply_corrections = _ask._apply_corrections
_load_corrections = _ask._load_corrections
_system_prompt = _ask._system_prompt
tool_get_meeting_details = _ask.tool_get_meeting_details
tool_list_meetings_local = _ask.tool_list_meetings
tool_query_commitments = _ask.tool_query_commitments
detect_corruption = _walkthrough.detect_corruption

CREDS_DIR = REPO_ROOT / "credentials"
TOKEN_FILE = CREDS_DIR / "drive_token.json"
DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
AUTH_CMD = "python scripts/fireflies_walkthrough.py auth"
REPO_URL = "https://github.com/JohnRiceML/augurian-ai-operations"


# ----------------------------- Drive helpers -----------------------------

def _load_creds():
    """Load saved Drive credentials. Refresh in-place if expired. Returns None if no token."""
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials

    if not TOKEN_FILE.exists():
        return None
    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), DRIVE_SCOPES)
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            TOKEN_FILE.write_text(creds.to_json())
        except Exception as exc:  # surface but don't crash
            st.session_state["drive_error"] = f"Token refresh failed: {exc}"
            return None
    return creds


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


TOOL_RUNNERS = {
    "query_commitments": tool_query_commitments,
    "get_meeting_details": tool_get_meeting_details,
    "list_meetings": tool_list_meetings,
    "read_meeting_summary": tool_read_meeting_summary,
    "read_meeting_transcript": tool_read_meeting_transcript,
}


# ----------------------------- UI helpers -----------------------------

def _render_setup_screen() -> None:
    st.markdown(
        """
        <div style="max-width:560px;margin:5rem auto;padding:2rem;border:1px solid #ddd;
        border-radius:12px;background:#fafafa;">
          <h2 style="margin-top:0;">Drive not connected</h2>
          <p>This app reuses the CLI's Drive token. Run the one-time auth command first:</p>
          <pre style="background:#111;color:#eee;padding:1rem;border-radius:6px;">""" + AUTH_CMD + """</pre>
          <p>Once you authorize in your browser, the token persists in
          <code>credentials/drive_token.json</code>. Then come back here and click
          <strong>Reload</strong>.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )
    if st.button("Reload"):
        st.rerun()


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


def _run_agent_turn(user_question: str, client: str) -> None:
    """Run the tool-use loop until end_turn. Streams tool calls into the UI."""
    anthropic = _anthropic()
    system = _system_prompt()

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
            tools=TOOLS,
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
            st.success("Drive: connected")
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
