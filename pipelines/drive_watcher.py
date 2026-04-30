"""Manual-dump normalizer.

Polls the Drive `changes.list` endpoint every 5 minutes for new files in
each client's /raw/firefly/, /raw/email/, and /raw/onboarding/ folders.
When a new file appears:

 - Firefly audio (.mp3, .m4a, .wav): transcribe with OpenAI Whisper API
   (~$0.006/min, cheaper and better than Google STT for messy audio).
 - Email (.eml, .msg, forwarded HTML): parse, strip headers, extract body.
 - Onboarding (.pdf, .docx): extract text, preserve section structure.

After normalization:
 - Strip PII via orchestrator/hooks/redact.py.
 - Write the cleaned version to /processed/<source>/YYYY-MM-DD-{filename}.json.
 - Leave the raw file in /raw/<source>/ untouched (audit trail).

Status: SKELETON for Phase 3+. The pattern is well-documented in the
playbook (~2-3 days of work for a single engineer). Implementing it
fully here would be premature — the changes.list watch token + Whisper
client + per-format parsing is meaningful code we want reviewed when it's
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
    2. For each new file, dispatch to the right normalizer.
    3. Write normalized output to /processed/<source>/.
    4. Persist the new changes-list page token.

    TODO Phase 3: implement.
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
