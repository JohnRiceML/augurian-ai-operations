"""Manual-dump normalizer.

Polls the Drive `changes.list` endpoint every 5 minutes for new files in
each client's /raw/firefly/, /raw/email/, and /raw/onboarding/ folders.
When a new file appears:

 - Fireflies transcript (.pdf, named "<title>-transcript-<ts>.pdf"):
   extract text via pypdf. Fireflies' own transcript is what we use — no
   Whisper re-transcription. The matching "-summary-" PDF is parsed
   separately as a baseline check (Fireflies' own action items).
 - Email (.eml, .msg, forwarded HTML): parse, strip headers, extract body.
 - Onboarding (.pdf, .docx): extract text, preserve section structure.

After normalization:
 - Strip PII via orchestrator/hooks/redact.py.
 - Write the cleaned version to /processed/<source>/YYYY-MM-DD-{filename}.json.
 - Leave the raw file in /raw/<source>/ untouched (audit trail).

Status: SKELETON for Phase 3+. The pattern is well-documented in the
playbook (~1 day of work for a single engineer, simpler than originally
scoped now that Whisper is out). Implementing it fully here would be
premature — the changes.list watch token + pypdf extraction +
per-format parsing is meaningful code we want reviewed when it's
written, not now.

Run as a long-running Cloud Run service:
    python -m pipelines.drive_watcher

Or one-shot for testing:
    python -m pipelines.drive_watcher --once
"""

from __future__ import annotations

import sys
import time

import click
import structlog

log = structlog.get_logger()

POLL_INTERVAL_SECONDS = 5 * 60  # 5 min — playbook standard.


def poll_once() -> None:
    """One pass through all clients' /raw/{firefly,email,onboarding}/ folders.

    1. For each client, page through Drive's changes.list since last token.
    2. For each new file, dispatch to the right normalizer:
       - "<title>-transcript-<ts>.pdf" under /raw/firefly/ → pypdf extract →
         trigger the `fireflies-extractor` subagent to produce structured
         records under /processed/commitments/<client>/.
       - "<title>-summary-<ts>.pdf" under /raw/firefly/ → pypdf extract,
         store alongside as Fireflies' own pre-extracted action items
         (used as a baseline / sanity check on Claude's extraction).
       - .eml/.msg under /raw/email/ → parse + strip signatures + redact
         PII → /processed/email/. If a commitment is mentioned, also
         routes to the email-commitment extractor (Phase 4+).
       - .pdf/.docx under /raw/onboarding/ → text extraction → /processed/
         onboarding/. Onboarding intake commitments routed to commitment
         extraction.
    3. Write normalized output to /processed/<source>/.
    4. Persist the new changes-list page token.

    Note: triggering the orchestrator's `extract-call` task per new transcript
    is the bridge from raw transcript → structured commitments. The
    orchestrator handles auth + agent invocation; this watcher only detects
    + dispatches.

    TODO Phase 3: implement Drive changes.list polling + PDF text extraction.
    TODO Phase 3+: wire extract-call dispatch.
    """
    log.warning("not_implemented", message="drive_watcher is a Phase 3 deliverable.")


@click.command()
@click.option("--once", is_flag=True, help="Run one poll cycle and exit (for testing).")
def main(once: bool) -> None:
    if once:
        poll_once()
        return
    while True:
        try:
            poll_once()
        except Exception as exc:
            # Loud failure → Slack alert. Don't silently retry.
            log.error("poll_failed", error=str(exc), exc_info=True)
            sys.exit(1)
        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
