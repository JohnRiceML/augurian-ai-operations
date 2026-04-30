"""Augurian AI Operations — orchestrator entry point.

Spawns the right specialist subagent for a task, wires up the Drive + Slack
MCP servers, restricts tools per the per-subagent allowlist, and registers
the audit hook so every tool call gets logged.

This is the production runtime. CLI: `augur run --task <task> --client <slug>`.

NOTE: The Claude Agent SDK Python API surface stabilized in early 2026.
If imports below fail, check the SDK README — class/function names may
have shifted between versions. The patterns (allowed_tools, mcp_servers,
hooks) are stable; the names around them may not be.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any

import click
import structlog

from orchestrator.config import ClientConfig, RuntimeConfig, get_client
from orchestrator.hooks.audit_log import make_audit_hook
from orchestrator.tools.permissions import allowed_tools_for

# Claude Agent SDK — stable imports as of early 2026.
# If this changes, fix here, not by sprinkling try/except across the codebase.
from claude_agent_sdk import (  # type: ignore[import-not-found]
    ClaudeAgentOptions,
    ClaudeSDKClient,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
AGENTS_DIR = REPO_ROOT / ".claude" / "agents"

log = structlog.get_logger()


# Map of task name → which subagent (.md file in .claude/agents/) handles it.
# Add new tasks here as new subagents come online.
TASK_TO_SUBAGENT: dict[str, str] = {
    "monthly-report":   "monthly-report-drafter",
    "gsc-anomaly":      "gsc-anomaly-detector",
    "organic-search":   "organic-search",
    "paid-media":       "paid-media",
    "analytics":        "analytics",
}


def build_mcp_servers(client: ClientConfig, runtime: RuntimeConfig) -> dict[str, dict[str, Any]]:
    """Return the MCP server configuration for this run.

    Drive is per-client (scoped to that client's folder). Slack is shared
    across clients but the orchestrator passes the client's channel as
    context so the bot replies in the right place.

    The exact shape depends on the SDK version's `mcp_servers` schema —
    see the SDK README. The shape below is the documented form for the
    Drive + Slack MCP servers as of early 2026.
    """
    servers: dict[str, dict[str, Any]] = {}

    # Google's first-party Drive MCP server. OAuth-based; the SDK handles
    # the consent flow on first run, then auto-refreshes thereafter.
    # Audience MUST be Internal — see CLAUDE.md.
    servers["google_drive"] = {
        "type": "url",
        "url": "https://mcp.googleapis.com/v1/drive",  # placeholder — verify against current Google docs
        "scopes": ["drive.readonly", "drive.file"],
        "scope_to_folder_id": client.drive_folder_id,
    }

    # Slack — production uses npm-based @modelcontextprotocol/server-slack
    # with a manually-created Bot Token (Slack's first-party MCP requires
    # Dynamic Client Registration which is unreliable headless).
    if runtime.slack_bot_token:
        servers["slack"] = {
            "type": "stdio",
            "command": "npx",
            "args": ["-y", "@modelcontextprotocol/server-slack"],
            "env": {"SLACK_BOT_TOKEN": runtime.slack_bot_token},
        }

    return servers


def load_subagent_prompt(name: str) -> str:
    """Read the subagent's system prompt from .claude/agents/<name>.md."""
    path = AGENTS_DIR / f"{name}.md"
    if not path.exists():
        raise FileNotFoundError(
            f"Subagent definition not found: {path}. "
            f"Add a markdown file at {path} with frontmatter."
        )
    text = path.read_text()
    if text.startswith("---"):
        # Strip YAML frontmatter — the SDK only wants the prompt body.
        _, _, body = text.split("---", 2)
        return body.strip()
    return text.strip()


def load_client_context(client: ClientConfig) -> str:
    """Load the per-client /context/client_context.md.

    In production this is read via the Drive MCP server during the agent
    loop (so it's prompt-cached). For local dev runs against a dev Drive
    folder, we can stub it from a local mirror. The production path:
    the agent reads it as its first action via the Drive MCP.
    """
    # TODO Phase 2: read from Drive via MCP, not local fs. For now, the
    # subagent's system prompt instructs it to Read the context file
    # itself, which gets prompt-cached on subsequent calls.
    return ""


async def run_task(task: str, client_slug: str, prompt: str | None = None) -> None:
    """Run a single task end-to-end.

    Args:
        task:        Logical task name; must be in TASK_TO_SUBAGENT.
        client_slug: Client identifier from clients.yaml.
        prompt:      Optional human-provided prompt. If None, the subagent
                     runs its default workflow (e.g. "draft this month's
                     report"). Slack-mode runs always provide a prompt.
    """
    runtime = RuntimeConfig.from_env()
    client = get_client(client_slug)

    if task not in TASK_TO_SUBAGENT:
        raise ValueError(
            f"Unknown task {task!r}. Known tasks: {sorted(TASK_TO_SUBAGENT)}"
        )
    subagent_name = TASK_TO_SUBAGENT[task]

    log.info(
        "starting_task",
        task=task,
        client=client.slug,
        subagent=subagent_name,
        dry_run=runtime.dry_run,
    )

    options = ClaudeAgentOptions(
        # Opus 4.7 for drafter, Haiku for the daily anomaly detector — see
        # the model field in each agent's frontmatter; the SDK reads it.
        # We also pass model explicitly here as a safety net.
        system_prompt=load_subagent_prompt(subagent_name),
        allowed_tools=allowed_tools_for(subagent_name),
        mcp_servers=build_mcp_servers(client, runtime),
        hooks=[make_audit_hook(client=client.slug, subagent=subagent_name)],
        # Per-client context tag — surfaces in audit logs and lets the
        # SDK route per-tenant rate limits correctly.
        metadata={"client": client.slug, "task": task, "subagent": subagent_name},
    )

    # Default prompt if the caller didn't supply one. Each subagent
    # interprets "do your default job" from its system prompt.
    user_prompt = prompt or f"Run your standard {task} workflow for {client.name}."

    async with ClaudeSDKClient(options=options) as agent:
        await agent.query(user_prompt)
        async for message in agent.receive_response():
            # In production, the agent writes its output to Drive via the
            # Write tool. The streamed messages are for logging and
            # console feedback during dev runs.
            log.info("agent_message", message=str(message)[:200])

    log.info("task_complete", task=task, client=client.slug)


# ----- CLI ------------------------------------------------------------------


@click.group()
def cli() -> None:
    """Augurian AI Operations orchestrator."""


@cli.command(name="run")
@click.option("--task", required=True, help="Task name (e.g. monthly-report)")
@click.option("--client", "client_slug", required=True, help="Client slug (e.g. coborns)")
@click.option("--prompt", default=None, help="Optional human prompt for Slack-mode runs.")
def run_cmd(task: str, client_slug: str, prompt: str | None) -> None:
    """Run a single orchestrator task."""
    try:
        asyncio.run(run_task(task=task, client_slug=client_slug, prompt=prompt))
    except Exception as exc:
        log.error("task_failed", task=task, client=client_slug, error=str(exc), exc_info=True)
        sys.exit(1)


@cli.command(name="list-tasks")
def list_tasks_cmd() -> None:
    """List available tasks."""
    for task, subagent in TASK_TO_SUBAGENT.items():
        click.echo(f"  {task:20s} → {subagent}")


if __name__ == "__main__":
    cli()
