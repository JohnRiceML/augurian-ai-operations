"""Google Search Console → Drive daily puller.

Same shape as ga4_puller.py — service-account auth, daily run, CSV to Drive.
The difference: GSC has a 2–3 day data lag, so this puller targets
"3 days ago" by default rather than "yesterday."

Status: SKELETON. Implement in Phase 4. Copy the structure of ga4_puller.py
exactly — don't be clever, don't extract a base class.

Run:
    python -m pipelines.gsc_puller --client coborns --days-ago 3
"""

from __future__ import annotations

import sys

import click
import structlog

log = structlog.get_logger()


@click.command()
@click.option("--client", "client_slug", required=True)
@click.option("--days-ago", default=3, type=int, help="Default 3 — accounts for GSC's data lag.")
@click.option("--dry-run", is_flag=True)
def main(client_slug: str, days_ago: int, dry_run: bool) -> None:
    log.error("not_implemented", message="gsc_puller is a Phase 4 deliverable.")
    sys.exit(1)


if __name__ == "__main__":
    main()
