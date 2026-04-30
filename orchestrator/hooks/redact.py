"""PII redaction for audit logs.

Strips phone numbers, email addresses, and per-client name lists from
strings before they hit the audit log. Full-fidelity logs go to a
separate audit-full/ folder retained 7 days; this is for the canonical
audit trail.

Conservative by design — over-redact rather than leak. The audit-full
folder has the unredacted version if an investigation needs it.
"""

from __future__ import annotations

import re
from functools import lru_cache
from typing import Any

from orchestrator.config import get_client

# US phone numbers in common formats: 555-555-5555, (555) 555-5555,
# 555.555.5555, +1 555 555 5555, etc.
_PHONE_RE = re.compile(
    r"(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}"
)
_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
# Conservative SSN match: 3-2-4 digits separated by hyphens or spaces.
_SSN_RE = re.compile(r"\b\d{3}[\s-]\d{2}[\s-]\d{4}\b")


@lru_cache(maxsize=32)
def _client_redaction_terms(client_slug: str) -> tuple[str, ...]:
    """Per-client redaction list from clients.yaml. Cached.

    Account leads add to this when they spot something the regex pass
    won't catch (e.g., a customer name that recurs in Firefly transcripts).
    """
    try:
        client = get_client(client_slug)
    except (KeyError, FileNotFoundError):
        return ()
    return tuple(client.redaction_list or ())


def redact(value: Any, *, client: str) -> Any:
    """Redact PII from a value. Recurses into dicts and lists.

    Strings get phone/email/SSN/per-client-term matches replaced with
    the redaction marker. Non-strings pass through unchanged at this
    layer — the caller can stringify if needed.
    """
    if isinstance(value, dict):
        return {k: redact(v, client=client) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(item, client=client) for item in value]
    if not isinstance(value, str):
        return value

    redacted = value
    redacted = _PHONE_RE.sub("[PHONE]", redacted)
    redacted = _EMAIL_RE.sub("[EMAIL]", redacted)
    redacted = _SSN_RE.sub("[SSN]", redacted)
    for term in _client_redaction_terms(client):
        if term:
            # Case-insensitive replacement, whole-word.
            pattern = re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
            redacted = pattern.sub("[REDACTED]", redacted)
    return redacted
