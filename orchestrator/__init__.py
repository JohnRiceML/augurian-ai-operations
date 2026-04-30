"""Augurian AI Operations orchestrator package.

Production agent runtime built on the Claude Agent SDK. Reads per-client
warehouse data from Google Drive, spawns specialist subagents to draft
deliverables, and writes outputs back to Drive for human review.

The drafter pattern is non-negotiable: nothing here ever publishes to a
client. Every external output is reviewed by an Augurian account lead.
"""

from __future__ import annotations

__version__ = "0.1.0"
