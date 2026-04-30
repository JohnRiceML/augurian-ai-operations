"""Tool allowlists per subagent.

Single source of truth for "which subagent can use which built-in tools."
Every subagent gets Read + Glob + Grep so it can navigate Drive. Write
is restricted to subagents that produce drafts. Bash is never granted
to a production subagent.

To add a new subagent: add an entry here AND add a markdown file in
.claude/agents/. The orchestrator reads from both.
"""

from __future__ import annotations


# Built-in tools we never grant to production subagents:
# - Bash: too broad. If a subagent needs to run code, give it Code Execution
#         (server-side, sandboxed) instead.
# - WebFetch / WebSearch: not needed in this architecture; Drive is the
#         data source. Granting them invites the agent to wander.
DEFAULT_TOOLS_READ_ONLY = ["Read", "Glob", "Grep"]
DEFAULT_TOOLS_DRAFTER = ["Read", "Glob", "Grep", "Write"]


SUBAGENT_TOOLS: dict[str, list[str]] = {
    # Drafters — read /processed/ + /context/, write to /reports/.
    "monthly-report-drafter": DEFAULT_TOOLS_DRAFTER,
    "organic-search":         DEFAULT_TOOLS_DRAFTER,
    "paid-media":             DEFAULT_TOOLS_DRAFTER,
    "analytics":              DEFAULT_TOOLS_DRAFTER,

    # Detector — reads + appends to /audit/anomalies/. Write is required for
    # the daily-rolling anomaly log.
    "gsc-anomaly-detector":   DEFAULT_TOOLS_DRAFTER,

    # Dev helpers — get the broader Claude Code surface; they're not
    # production. Defined here so the SDK's runtime knows them by name,
    # but the dev environment grants them via .claude/settings.json
    # rather than via this allowlist.
}


def allowed_tools_for(subagent: str) -> list[str]:
    """Return the allowed-tool list for a production subagent.

    Raises if the subagent isn't registered — better to fail loudly than
    silently grant the default Claude Code toolset.
    """
    if subagent not in SUBAGENT_TOOLS:
        raise KeyError(
            f"Unregistered subagent {subagent!r}. Add an entry to "
            f"orchestrator/tools/permissions.py:SUBAGENT_TOOLS before running."
        )
    return list(SUBAGENT_TOOLS[subagent])
