"""Audit logging hook.

Writes one JSONL line per tool call to /Augurian Clients/[Client]/audit/
YYYY-MM-DD.jsonl in Drive. Inputs and outputs are truncated to 500 chars
and PII is redacted via redact.py. Full unredacted logs go to a separate
audit-full/ folder, retained for 7 days only.

The Claude Agent SDK invokes hooks via callbacks registered on
ClaudeAgentOptions.hooks. The SDK's hook signature stabilized in early
2026; if it changes, fix here, not at every call site.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Callable

import structlog

from orchestrator.hooks.redact import redact

log = structlog.get_logger()

TRUNCATE_LIMIT = 500  # chars per input/output field in the redacted log


def _truncate(value: Any, limit: int = TRUNCATE_LIMIT) -> str:
    s = str(value)
    if len(s) <= limit:
        return s
    return s[:limit] + f"…[+{len(s) - limit} chars]"


def _audit_record(
    *,
    client: str,
    subagent: str,
    event: str,
    tool: str | None,
    inputs: Any,
    outputs: Any,
    error: str | None = None,
) -> dict[str, Any]:
    """Build one redacted, truncated audit record."""
    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "client": client,
        "subagent": subagent,
        "event": event,
        "tool": tool,
        "inputs": _truncate(redact(inputs, client=client)) if inputs is not None else None,
        "outputs": _truncate(redact(outputs, client=client)) if outputs is not None else None,
        "error": error,
    }


def make_audit_hook(*, client: str, subagent: str) -> Callable[..., None]:
    """Build the per-run audit hook.

    Returns a callable matching the Claude Agent SDK hook signature.
    The SDK passes a HookContext-like object containing the event name,
    tool name (if applicable), and inputs/outputs. We log a redacted
    record per event.
    """

    def hook(event: str, payload: dict[str, Any]) -> None:
        # `event` is one of: PreToolUse, PostToolUse, OnError, ...
        # `payload` shape depends on event — see SDK docs. We pull the
        # common fields and tolerate missing ones.
        record = _audit_record(
            client=client,
            subagent=subagent,
            event=event,
            tool=payload.get("tool_name"),
            inputs=payload.get("tool_input"),
            outputs=payload.get("tool_output"),
            error=payload.get("error"),
        )

        # In production: append to /Augurian Clients/[Client]/audit/<date>.jsonl
        # via the Drive API. For now, log structured + write a local copy
        # that the audit-reviewer subagent can read during dev.
        # TODO Phase 3: switch to Drive append once the Drive MCP exposes a
        #               safe append-only mode for audit files.
        log.info("audit", **record)
        _write_local_jsonl(client=client, record=record)

    return hook


def _write_local_jsonl(*, client: str, record: dict[str, Any]) -> None:
    """Dev-mode: append to ./audit-local/<client>/<date>.jsonl. Production
    target is Drive — see the TODO above."""
    from pathlib import Path

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_dir = Path("audit-local") / client
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{today}.jsonl"
    with path.open("a") as f:
        f.write(json.dumps(record, default=str) + "\n")
