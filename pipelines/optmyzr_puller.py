"""Optmyzr → Drive daily puller.

Same shape as ga4_puller.py. Optmyzr's API is less stable than Google's;
expect this puller to need maintenance more often. Defensive parsing,
loud failures, no silent retries.

Status: SKELETON. Implement when the paid-media subagent needs Optmyzr's
recommendations as input — earliest Phase 4.
"""

from __future__ import annotations

import sys

import click
import structlog

log = structlog.get_logger()


@click.command()
@click.option("--client", "client_slug", required=True)
@click.option("--dry-run", is_flag=True)
def main(client_slug: str, dry_run: bool) -> None:
    log.error("not_implemented", message="optmyzr_puller is a Phase 4+ deliverable.")
    sys.exit(1)


if __name__ == "__main__":
    main()
