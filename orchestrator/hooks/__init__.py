"""Lifecycle hooks for the orchestrator.

Hooks fire at agent lifecycle points (before/after tool call, on error).
We use them for audit logging (audit_log.py) and PII redaction.
"""
