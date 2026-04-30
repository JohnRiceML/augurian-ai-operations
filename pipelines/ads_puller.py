"""Google Ads → Drive daily puller.

Same shape as ga4_puller.py, except:
 - Auth uses developer token + OAuth refresh token (not service-account-only).
 - Use the google-ads python lib's GAQL query interface.
 - Pull at the campaign + ad-group level. Don't pull keywords daily; that
   blows up the row count and the paid subagent doesn't read keyword-day
   granularity.

Status: SKELETON. Implement in Phase 4 (or earlier if a paid-media subagent
needs it). Copy the structure of ga4_puller.py exactly.
"""

from __future__ import annotations

import sys

import click
import structlog

log = structlog.get_logger()


@click.command()
@click.option("--client", "client_slug", required=True)
@click.option("--days-ago", default=1, type=int)
@click.option("--dry-run", is_flag=True)
def main(client_slug: str, days_ago: int, dry_run: bool) -> None:
    log.error("not_implemented", message="ads_puller is a Phase 4+ deliverable.")
    sys.exit(1)


if __name__ == "__main__":
    main()
