"""GA4 → Drive daily puller.

Pulls yesterday's data from a client's GA4 property and writes a
timestamped CSV to /Augurian Clients/[Client]/raw/ga4/YYYY-MM-DD.csv.

This is the canonical pattern. To add a new source (GSC, Ads, Optmyzr,
...) copy this file, swap in the right API client, and modify the
report definition. Resist the urge to generalize.

Run locally:
    python -m pipelines.ga4_puller --client coborns --days-ago 1

Cloud Run Job equivalent (one client):
    gcloud run jobs execute ga4-puller-coborns

Schedule via Cloud Scheduler at 6:00 AM Central daily.
"""

from __future__ import annotations

import io
import sys
from datetime import datetime, timedelta
from typing import TYPE_CHECKING
from zoneinfo import ZoneInfo

import click
import pandas as pd
import structlog

from orchestrator.config import ClientConfig, get_client, load_clients

if TYPE_CHECKING:
    # Heavy Google client imports stay inside main(); type-checking only here.
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    from googleapiclient.discovery import Resource as DriveService

log = structlog.get_logger()


# The metrics + dimensions to pull. Tuned for the monthly report drafter's
# needs. Add to this only if a downstream subagent actually consumes it —
# every extra column is more data the agent has to ignore.
GA4_REPORT = {
    "dimensions": [
        {"name": "date"},
        {"name": "sessionDefaultChannelGroup"},
        {"name": "deviceCategory"},
    ],
    "metrics": [
        {"name": "sessions"},
        {"name": "totalUsers"},
        {"name": "newUsers"},
        {"name": "engagedSessions"},
        {"name": "engagementRate"},
        {"name": "averageSessionDuration"},
        {"name": "screenPageViewsPerSession"},
        {"name": "bounceRate"},
        {"name": "conversions"},
        {"name": "totalRevenue"},
    ],
}


def _build_clients() -> tuple[BetaAnalyticsDataClient, DriveService]:
    """Build the GA4 + Drive API clients with the service-account creds.

    Imports stay inside this function so the module imports cheaply at
    test time (the heavy Google libs aren't loaded just to read its docstring).
    """
    from google.analytics.data_v1beta import BetaAnalyticsDataClient
    from googleapiclient.discovery import build

    ga4 = BetaAnalyticsDataClient()  # picks up GOOGLE_APPLICATION_CREDENTIALS
    drive = build("drive", "v3", cache_discovery=False)
    return ga4, drive


def fetch_ga4_data(
    ga4: BetaAnalyticsDataClient,
    *,
    client: ClientConfig,
    target_date: str,
) -> pd.DataFrame:
    """Run the GA4 report for one day and return as a DataFrame."""
    from google.analytics.data_v1beta.types import (
        DateRange,
        Dimension,
        Metric,
        RunReportRequest,
    )

    request = RunReportRequest(
        property=f"properties/{client.ga4_property_id}",
        dimensions=[Dimension(name=d["name"]) for d in GA4_REPORT["dimensions"]],
        metrics=[Metric(name=m["name"]) for m in GA4_REPORT["metrics"]],
        date_ranges=[DateRange(start_date=target_date, end_date=target_date)],
    )
    response = ga4.run_report(request)

    if not response.rows:
        log.warning("ga4_empty", client=client.slug, date=target_date)
        return pd.DataFrame()

    rows = []
    dim_names = [d.name for d in response.dimension_headers]
    met_names = [m.name for m in response.metric_headers]
    for row in response.rows:
        rec = {dim_names[i]: row.dimension_values[i].value for i in range(len(dim_names))}
        for i, m in enumerate(met_names):
            rec[m] = row.metric_values[i].value
        rows.append(rec)
    return pd.DataFrame(rows)


def upload_csv_to_drive(
    drive: DriveService,
    *,
    client: ClientConfig,
    df: pd.DataFrame,
    target_date: str,
    dry_run: bool = False,
) -> str | None:
    """Upload the CSV to /Augurian Clients/[Client]/raw/ga4/YYYY-MM-DD.csv.

    Returns the new file's Drive ID (or None if dry_run).
    """
    from googleapiclient.http import MediaIoBaseUpload

    filename = f"{target_date}.csv"
    csv_bytes = df.to_csv(index=False).encode("utf-8")

    if dry_run:
        log.info(
            "dry_run_skip_upload",
            client=client.slug,
            filename=filename,
            row_count=len(df),
            bytes=len(csv_bytes),
        )
        return None

    # Find the /raw/ga4/ subfolder under the client's folder. We expect it
    # to exist (created in Phase 0); if it doesn't, fail loudly.
    raw_ga4_folder_id = _find_or_fail(
        drive, parent=client.drive_folder_id, name="raw"
    )
    ga4_folder_id = _find_or_fail(
        drive, parent=raw_ga4_folder_id, name="ga4"
    )

    media = MediaIoBaseUpload(io.BytesIO(csv_bytes), mimetype="text/csv", resumable=False)
    file_metadata = {"name": filename, "parents": [ga4_folder_id]}
    created = drive.files().create(
        body=file_metadata,
        media_body=media,
        fields="id,name,webViewLink",
        supportsAllDrives=True,
    ).execute()

    log.info(
        "upload_complete",
        client=client.slug,
        filename=filename,
        file_id=created["id"],
        link=created.get("webViewLink"),
    )
    return created["id"]


def _find_or_fail(drive: DriveService, *, parent: str, name: str) -> str:
    """Find a child folder by name under parent. Raise if missing."""
    q = (
        f"'{parent}' in parents "
        f"and name = '{name}' "
        f"and mimeType = 'application/vnd.google-apps.folder' "
        f"and trashed = false"
    )
    results = drive.files().list(
        q=q,
        fields="files(id,name)",
        supportsAllDrives=True,
        includeItemsFromAllDrives=True,
    ).execute()
    files = results.get("files", [])
    if not files:
        raise FileNotFoundError(
            f"Drive subfolder {name!r} not found under parent {parent}. "
            f"Was the Phase 0 folder structure created?"
        )
    return files[0]["id"]


def yesterday_in_client_tz(client: ClientConfig) -> str:
    """Return yesterday's date as YYYY-MM-DD in the client's timezone.

    GA4 reports in the property's configured TZ, so 'yesterday' must be
    computed in that TZ — using UTC will give partial-day data.
    """
    tz = ZoneInfo(client.timezone)
    return (datetime.now(tz) - timedelta(days=1)).strftime("%Y-%m-%d")


@click.command()
@click.option("--client", "client_slug", required=True, help="Client slug from clients.yaml")
@click.option("--days-ago", default=1, type=int, help="N days ago (default: 1 = yesterday)")
@click.option("--dry-run", is_flag=True, help="Don't upload to Drive; just log what would happen.")
def main(client_slug: str, days_ago: int, dry_run: bool) -> None:
    """Pull one day of GA4 data for one client and write to Drive."""
    if client_slug == "all":
        clients = list(load_clients().values())
    else:
        clients = [get_client(client_slug)]

    ga4, drive = _build_clients()

    for client in clients:
        target = (
            datetime.now(ZoneInfo(client.timezone)) - timedelta(days=days_ago)
        ).strftime("%Y-%m-%d")

        log.info("fetching", client=client.slug, date=target)
        df = fetch_ga4_data(ga4, client=client, target_date=target)
        if df.empty:
            # Loud failure — better than a silently-empty CSV that downstream
            # subagents could mistake for real data.
            log.error("no_rows", client=client.slug, date=target)
            sys.exit(2)
        upload_csv_to_drive(
            drive, client=client, df=df, target_date=target, dry_run=dry_run
        )


if __name__ == "__main__":
    main()
