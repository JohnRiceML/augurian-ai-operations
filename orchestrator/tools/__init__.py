"""Per-subagent tool allowlists.

The Claude Agent SDK ships with Claude Code's full toolset (Read, Write,
Edit, Bash, Glob, Grep, ...) by default. We allowlist explicitly per
subagent so analytics agents don't get Bash and the orchestrator doesn't
get Edit. See permissions.py.
"""
