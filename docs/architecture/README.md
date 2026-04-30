# Architecture overview

Five layers, all explicit. The diagram is at `architecture-v2.svg` in this folder.

## Layer 1 — Sources (per client)

Three input streams per client, treated differently:

| Stream | Examples | How it gets in |
|---|---|---|
| Scheduled API pulls | GA4, GSC, Google Ads, Optmyzr | Python pullers in `pipelines/`, daily cron via Cloud Scheduler |
| Manual dumps | Firefly call recordings, forwarded emails, onboarding docs | Account leads drop into `/raw/<source>/` in Drive; the watcher normalizes |
| Client context | Brand voice, business goals, do/don't lists | Hand-written markdown by the account lead, in `/context/` |

The split matters: API pulls are deterministic and cheap; manual dumps are messy and need normalization; context is small but high-leverage and must be human-written.

## Layer 2 — Ingestion pipelines

The piece that didn't exist on the whiteboard. Three pipelines, one per source type:

- **`pipelines/<source>_puller.py`** — service-account auth, hits the API, writes timestamped CSV/JSON to `/raw/<source>/`. Run on a Cloud Run job triggered daily by Cloud Scheduler.
- **`pipelines/drive_watcher.py`** — polls Drive's `changes.list` every 5 min for new files in `/raw/firefly/`, `/raw/email/`, `/raw/onboarding/`. Transcribes audio (Whisper), strips PII, normalizes schema, writes to `/processed/<source>/`.
- **`/context/*.md`** — hand-written. No automation; quarterly review.

## Layer 3 — Warehouse (Google Drive)

One folder per client. Per-client subfolders:

```
/Augurian Clients/[Client]/
├── raw/             # As-pulled, as-dumped. Source of truth, read-only.
│   ├── ga4/
│   ├── gsc/
│   ├── ads/
│   ├── optmyzr/
│   ├── firefly/
│   ├── email/
│   └── onboarding/
├── processed/       # Cleaned + normalized. The agent reads from here.
├── context/         # Hand-written brand/voice/goals markdown. Cached.
├── reports/         # Agent outputs land here. Human reviews before send.
└── audit/           # JSONL of every agent action, per day.
```

Drive isn't a database, but for the data volumes involved (single-digit MB per client per day) it's the right call: zero ops overhead, native to how account leads already work, and trivially shareable with clients when the time comes.

## Layer 4 — Orchestration (Claude Agent SDK)

A single orchestrator process (Cloud Run service) that:

1. Receives a task — from Slack mention, scheduled trigger, or Notion/Asana hook.
2. Identifies the client and loads `/context/client_context.md` (prompt-cached).
3. Spawns the right specialist subagent — `organic-search`, `paid-media`, or `analytics`.
4. The subagent reads `/processed/` files via the Drive MCP, drafts a deliverable, writes to `/reports/`.
5. Audit hook fires on every tool call → `/audit/YYYY-MM-DD.jsonl`.
6. Notifies the human reviewer via Slack.

Subagent definitions live in `.claude/agents/*.md`. The orchestrator picks one based on task routing logic in `orchestrator/main.py`.

## Layer 5 — Human surfaces

Three surfaces, three roles:

- **Slack** — real-time chat with the agent (ad-hoc questions, clarifications, quick lookups). The audit summary posts to `#agent-activity` daily.
- **Notion or Asana** (pick one) — drafted reports + tasks land here for human review. Approved reports get manually shared with clients; nothing auto-publishes.
- **Manager DM + weekly digest** — oversight surface. Cost summary, escalations, anomalies.

The drafter pattern is the design constraint: the agent never sends to a client. Always to a human first.
