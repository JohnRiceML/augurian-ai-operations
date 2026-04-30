# Phase 1 — First pull pipeline (week 2)

**Goal:** GA4 → Drive, daily, fully automated.
**Deliverable:** a CSV in `/Augurian Clients/Coborn's/raw/ga4/YYYY-MM-DD.csv` that updates every morning without human intervention.

## Why GA4 first

It's the most stable API of the four (GSC, Ads, Optmyzr), with the cleanest auth pattern. Once GA4 works end-to-end, the other three pullers are 80% copy-paste.

## Tasks

- [ ] **Implement `pipelines/ga4_puller.py`.** Reads `clients.yaml`, runs a `runReport` request for the previous day's data (sessions, users, events, conversions), writes a CSV to a temp file, uploads to Drive at `/Augurian Clients/[Client]/raw/ga4/YYYY-MM-DD.csv`. Use `google-analytics-data` for the GA4 calls and `googleapiclient.discovery` for Drive uploads.
- [ ] **Smoke-test locally.** `python -m pipelines.ga4_puller --client coborns --days-ago 1` should write a real CSV to Coborn's raw folder.
- [ ] **Verify the CSV in Drive.** Open it, sanity-check the row count and metric values against the GA4 UI for the same date.
- [ ] **Containerize.** Add a `Dockerfile` for the puller; build locally; run the same `--client coborns --days-ago 1` invocation inside the container.
- [ ] **Deploy to Cloud Run as a Job** (not a service — it's a batch task). Service account on the job has the Drive + Analytics scopes.
- [ ] **Schedule via Cloud Scheduler.** Daily at 6:00 AM Central. Targets the Cloud Run Job.
- [ ] **Wire up alerting.** If the Cloud Run Job fails, post to `#agent-activity` Slack channel with the error.
- [ ] **Run for 5 consecutive days** before declaring done. Confirms the schedule fires and the OAuth/service-account auth doesn't drift.

## Gotchas

- **GSC has a 2–3 day data lag** — but this is the GA4 puller, so target "yesterday." When you build the GSC puller in Phase 4, target "3 days ago" instead.
- **GA4 quotas** — Property-level: 10,000 tokens / day standard, 200 concurrent reports. A single daily pull is well under this. Plan to monitor if you scale to many clients.
- **Time zones.** GA4 reports in the property's configured time zone. Coborn's is Central. Make sure the daily pull's "yesterday" is computed in Central, not UTC, or you'll get partial-day data.
- **Don't build a generic puller framework.** This script will get copied four times for the other sources. Three scripts is easier to maintain than one over-engineered abstraction.

## Definition of done

- [ ] CSV in Drive every morning at 6:05 AM Central, no manual intervention, for 5 consecutive days.
- [ ] Failure alert tested: kill the Cloud Run Job mid-run on day 3, confirm Slack alert fires, then re-trigger the job manually.
- [ ] Code reviewed by a second engineer (or by a senior account lead if no second engineer).

## What's NOT in scope for Phase 1

- The orchestrator. Phase 2.
- Subagents reading from `/raw/`. Phase 2.
- GSC, Ads, Optmyzr pullers. Phase 4.
- Audit logging. Phase 3.

If you find yourself building any of those, stop — you've drifted out of phase.
