# Augurian AI Operations

A Claude Agent SDK orchestrator that drafts (never publishes) marketing-ops work for Augurian's client portfolio. Per-client Google Drive warehouse, scheduled API pulls, Slack/Notion human surfaces.

> **Status:** Phase 0 starter. The repo is scaffolded; foundation work happens in week 1 (see `docs/phases/phase-0-foundation.md`).

## Architecture at a glance

![Augurian AI architecture](./ARCHITECTURE.svg)

**Five layers, all explicit.** Sources → ingestion pipelines → per-client Drive warehouse → Claude Agent SDK orchestrator + specialist subagents → human review surfaces (Slack, Notion). Open `ARCHITECTURE.svg` in any browser for the full-resolution version. Layer-by-layer breakdown in [`docs/architecture/README.md`](./docs/architecture/README.md). Tool-by-tool decisions and gotchas in [`docs/IMPLEMENTATION_PLAYBOOK.md`](./docs/IMPLEMENTATION_PLAYBOOK.md).

## What this is

Internal Augurian tooling. Specialist subagents (organic search, paid media, analytics) read per-client data from Google Drive, draft work products (monthly reports, GSC anomaly briefs, ad-pacing notes), and hand them to humans via Slack and Notion. **Every external output is human-reviewed before it ships to a client.** Drafter pattern, never publisher.

## The five layers

1. **Sources** — GA4, GSC, Google Ads, Optmyzr (scheduled API pulls); Firefly call recordings, email, onboarding docs (manual dumps); hand-written client context.
2. **Ingestion pipelines** — Cloud Scheduler + Python pullers; a Drive-watcher normalizer for manual dumps; markdown context files maintained by account leads.
3. **Warehouse** — `/Augurian Clients/[Client]/` in Google Drive, with `/raw/`, `/processed/`, `/context/`, `/reports/`, `/audit/`.
4. **Orchestration** — Claude Agent SDK orchestrator (Opus 4.7) on Cloud Run, spawning specialist subagents per task.
5. **Human surfaces** — Slack for ad-hoc and clarifying questions, Notion (or Asana) for drafted reports and tasks, manager DM for oversight.

See `ARCHITECTURE.svg` (root) or `docs/architecture/` for the diagram. See `docs/IMPLEMENTATION_PLAYBOOK.md` for the source-of-truth doc, `docs/README.md` for the full doc index, and `docs/TOOLING_*.md` for verified tool references (MCP servers, Cloud Run, pipeline APIs).

## Subagents and skills (`.claude/`)

Two roles, one directory:

**Production specialists** (loaded by the orchestrator at runtime):

| Agent | Job |
|---|---|
| `monthly-report-drafter` | Drafts monthly client performance reports |
| `gsc-anomaly-detector` | Daily Search Console anomaly check (Haiku, low-stakes) |
| `organic-search` | SEO briefs, technical audits, GSC analysis |
| `paid-media` | Pacing checks, ad copy, Optmyzr triage |
| `analytics` | Cross-channel analytics, ad-hoc questions |
| `fireflies-extractor` | Extracts deliverables / decisions / blockers from call transcripts |
| `commitment-tracker` | Answers "what's coming up for X?" / "what does Augurian owe Y?" |

**Dev helpers** (Claude Code subagents for engineers and account leads):

| Agent | Job |
|---|---|
| `pipeline-engineer` | Build/maintain the scheduled pullers |
| `mcp-integrator` | Wire and debug MCP server connections |
| `agent-architect` | Design new specialist subagents |
| `audit-reviewer` | Read audit logs, summarize daily activity |
| `drive-warehouse-curator` | Audit per-client Drive folders, fix permission drift |
| `client-onboarder` | Walk through Phase 0 for a new client |
| `cost-monitor` | Watch token + GCP spend, flag outliers |
| `ga4-data-expert` | GA4 metric semantics, healthy-account ranges |
| `context-coach` | Help account leads write `client_context.md` (interview-only, never drafts) |
| `git-workflow` | Repo's git steward — conventional commits, branch/PR practices, blocks unsafe ops |
| `code-reviewer` | Reviews PRs against this repo's specific concerns (not generic boilerplate) |
| `secret-scanner` | Scans changes for leaked API keys / tokens / service-account JSON |
| `drive-data-architect` | Designs Drive structure, naming conventions, query paths |
| `adoption-coach` | Watches the audit log for adoption signals; intervenes when usage drops |
| `leadership-briefing` | Drafts the weekly partner brief from audit + KPI data |
| `training-designer` | Designs role-specific onboarding sessions for the team |
| `kpi-tracker` | Computes the KPIs from KPI_PLAYBOOK.md weekly |
| `change-comms` | Drafts internal Augurian comms (kickoff emails, FAQ, Slack posts) |
| `vendor-manager` | Helps non-technical leadership manage the technical builder |
| `ai-literacy-coach` | Plain-English answers to "what does this mean / can it do X?" |
| `report-reviewer` | Captures account-lead edit patterns, recommends context-file updates |

**Reusable agent skills** (`.claude/skills/`) — load on-demand by any subagent that needs them:

- `drive-warehouse` — folder structure, where to read/write, what's read-only
- `ga4-glossary` — metric/dimension definitions and common quirks
- `slack-formatting` — channel routing, length limits, mrkdwn
- `pii-redaction` — what gets redacted, what to flag for the account lead
- `augurian-voice` — house voice, words to avoid, structure for client-adjacent reports
- `conventional-commits` — commit message format and scoping
- `git-safety` — destructive-op rules and incident-response playbook
- `fireflies-extraction-rules` — what to extract from call transcripts; what to ignore
- `commitment-labeling` — naming/index conventions for the commitments warehouse
- `cli-data-tools` — `jq` / `csvkit` / `rclone` one-liners for ad-hoc warehouse queries

For more agents/skills published by Anthropic and the community, see [`docs/EXTERNAL_RESOURCES.md`](./docs/EXTERNAL_RESOURCES.md).

## Example end-to-end query

A user in Slack asks `@augur`:

> *"What were the top deliverables for Coborn's for next month?"*

The query path:

1. `commitment-tracker` is invoked.
2. It reads `/Augurian Clients/Coborn's/processed/commitments/_index.jsonl` — the append-only commitments index assembled by `fireflies-extractor` from Firefly call transcripts (and, in later phases, emails and onboarding docs).
3. It filters to `client=coborns`, `type ∈ {deliverable, action_item}`, `due_date` in next month, `status=open`.
4. It sorts by priority desc, due_date asc.
5. It returns top items with the call source + timestamp anchor so the lead can verify in Fireflies.

The whole flow — from a recording dropped in `/raw/firefly/` to a Slack answer — is the architecture's reason for being. The labeling conventions in `.claude/skills/commitment-labeling/` are what make it work without a vector DB.

## For non-technical readers

If you're an Augurian partner, account lead, or ops team member opening this for the first time — start at [`docs/FOR_NON_TECHNICAL_READERS.md`](./docs/FOR_NON_TECHNICAL_READERS.md). It explains the system in plain English, points to the docs you'll actually use, and names the decisions only Augurian leadership can make.

Other non-technical entry points:
- [`docs/GLOSSARY.md`](./docs/GLOSSARY.md) — every term decoded
- [`docs/ADOPTION_PLAN.md`](./docs/ADOPTION_PLAN.md) — week-by-week from the *team's* perspective (not the engineer's)
- [`docs/LEADERSHIP_BRIEF.md`](./docs/LEADERSHIP_BRIEF.md) — partner-facing status template
- [`docs/KPI_PLAYBOOK.md`](./docs/KPI_PLAYBOOK.md) — what success looks like
- [`docs/TRAINING_GUIDE.md`](./docs/TRAINING_GUIDE.md) — onboarding for account leads / specialists
- [`docs/VENDOR_MANAGEMENT.md`](./docs/VENDOR_MANAGEMENT.md) — how to manage the technical builder
- [`docs/CLIENT_DISCLOSURE_WORKSHEET.md`](./docs/CLIENT_DISCLOSURE_WORKSHEET.md) — per-client AI-disclosure stance worksheet

## Repository layout

```
.
├── docs/                  # Playbook, architecture, phase checklists
├── orchestrator/          # Claude Agent SDK app (Python)
│   ├── main.py            # Entry point — reads clients.yaml, spawns subagents
│   ├── hooks/             # Audit logging, redaction
│   └── tools/             # Tool allow/deny config
├── pipelines/             # Scheduled puller scripts (one per source)
│   ├── ga4_puller.py
│   ├── gsc_puller.py
│   ├── ads_puller.py
│   ├── optmyzr_puller.py
│   ├── drive_watcher.py   # Manual-dump normalizer
│   └── clients.yaml       # Per-client Property IDs / folder mapping
├── context_templates/     # Starter templates for /context/ markdown files
├── .claude/
│   ├── agents/            # Claude Code dev-helper subagents (drive engineers
│   │                      # building this repo) AND production specialist
│   │                      # subagent prompts (loaded by orchestrator/main.py)
│   └── settings.json      # Permission allowlists for the dev environment
└── examples/              # Worked examples & fixtures
```

## Getting started (Phase 0, week 1)

Front-loaded one-time setup. Follow `docs/phases/phase-0-foundation.md` end-to-end before writing any pipeline code.

```bash
# 1. Clone and install
git clone <this-repo>
cd augurian-ai-operations
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# 2. Configure secrets
cp .env.example .env
# Edit .env: ANTHROPIC_API_KEY, GOOGLE_APPLICATION_CREDENTIALS path, SLACK_BOT_TOKEN

# 3. Add the first client to clients.yaml
cp pipelines/clients.example.yaml pipelines/clients.yaml
# Fill in Coborn's GA4 Property ID, Drive folder ID, etc.

# 4. Run a single GA4 pull as a smoke test
python -m pipelines.ga4_puller --client coborns --days-ago 1
```

## What's NOT in scope for Q2

- **No fine-tuning.** Claude as-is.
- **No client-facing tools.** Augurian-internal only; clients receive deliverables, not access.
- **No vector DB / RAG.** Data lives in Drive; agent reads files directly.
- **No multi-tenant SaaS.** Built for Augurian, not for resale.
- **No agent autonomy past drafting.** Every external output is human-reviewed.

## Decisions that need leadership sign-off before week 1

- **Notion or Asana?** Pick one. Don't run both.
- **Owner of the Google Cloud project, Anthropic API key, and Slack bot identity.** Recommend a dedicated `ai-ops@augurian.com` Workspace user.
- **Builder identity** — internal hire, contractor, or consultant.
- **Q2 budget envelope** — engineering time + ~$200/mo AI compute + ~$50/mo tooling.
- **Client-AI disclosure** — does Coborn's know AI is in the loop? Constrains pilot visibility.

## License

Proprietary. Internal Augurian use only.
