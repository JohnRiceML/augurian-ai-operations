# Augurian AI Operations — Claude Code instructions

You are working inside the **Augurian AI Operations** repo — a Claude Agent SDK orchestrator that drafts marketing-ops deliverables for Augurian's client portfolio. Read this whole file before suggesting changes.

## Project shape (one-paragraph version)

Five-layer architecture: client data lives in per-client Google Drive folders, scheduled Python pullers (GA4, GSC, Ads, Optmyzr) write to `/raw/`, a Drive watcher normalizes manual dumps into `/processed/`, hand-written markdown sits in `/context/`, and a Claude Agent SDK orchestrator (Opus 4.7) on Cloud Run spawns specialist subagents (organic search, paid media, analytics) that read those folders and write drafted work products to `/reports/`. Humans review every external output via Slack + Notion. **Drafter pattern, never publisher.**

The architecture and tool choices are **already decided** — see `docs/IMPLEMENTATION_PLAYBOOK.md`. Don't propose alternatives unless explicitly asked.

## Locked-in tool choices (do not re-debate)

- Orchestrator: **Claude Agent SDK** (Python). Opus 4.7. Not bare Anthropic API.
- Drive: **Google's first-party Drive MCP server**. OAuth consent screen audience MUST be `Internal` — `External + Testing` gives a 7-day refresh-token expiry that silently breaks the agent.
- Slack: production uses `@modelcontextprotocol/server-slack` with a manually-created Bot Token (Dynamic Client Registration is unreliable headless).
- Pullers: standalone Python scripts on Cloud Run + Cloud Scheduler. **Do not build a generic puller framework.** Copy `ga4_puller.py` for each new source — three scripts is easier to maintain than one over-engineered one.
- Manual dumps: Drive `changes.list` polling every 5 min. **No Whisper.** Fireflies exports its own PDF transcript (and a summary PDF) directly to Drive — re-transcribing the audio is dead weight. Use `pypdf` to extract text from the transcript PDF.
- Context files: hand-written markdown by account leads. **Never AI-generate them** — that defeats the point. Loaded via prompt caching.
- Audit logging: Agent SDK hooks → per-client `/audit/YYYY-MM-DD.jsonl`. Truncate inputs/outputs to 500 chars; keep full logs only 7 days.

## Coding conventions

- **Python 3.11+.** Type hints on public functions. `from __future__ import annotations` at the top of modules that need forward refs.
- **No silent fallbacks** in the orchestrator. If a tool call fails or a Drive read returns nothing, raise — don't paper over it. Account leads need to know when something's wrong.
- **Configuration via `pipelines/clients.yaml`.** One entry per client mapping client name → GA4 Property ID, GSC site URL, Ads customer ID, Drive folder ID. Don't hardcode IDs in scripts.
- **Secrets via env vars.** `python-dotenv` loads `.env` in dev; Cloud Run gets them from Secret Manager. Never commit `.env`.
- **Use `structlog`** for logs. JSON-formatted, includes `client`, `subagent`, `tool`, `request_id` fields where applicable.
- **Tests live under `tests/`.** Fixtures use synthetic CSVs in `examples/` — never real client data.

## What NOT to do

- Don't propose a vector database, RAG layer, or fine-tuning. Q2 scope is explicit about not doing these.
- Don't build a multi-tenant abstraction. This is for Augurian, not for resale.
- Don't add a "publisher" mode that lets the agent send to clients without human review. Drafter pattern is non-negotiable.
- Don't AI-generate the `/context/` files. They're the human-judgment input that makes the system work.
- Don't add features beyond what the current task requires. The playbook is conservative for a reason.

## Rollout constraints (from Micah, 2026-05-01)

These are binding for Q2 work. They came out of the lead engineer's review and are captured durably in memory + `docs/`:

- **No client exposure without a green pre-rollout check.** Run `scripts/readiness_check.py --client <slug>` before adding any client to the pilot. Exits non-zero if any pillar fails.
- **Centralized bot in Cloud Run is production. Distributed Claude.ai (paste-ready skills in `claude_ai_skills/`) is today's ad-hoc fallback.** Both coexist; the bot is what scales for shared connections (Drive, GA4, Slack).
- **No "production-on-a-laptop" without an ADR.** Cloud Run is the default deployment target. Laptop / Mac mini are staging only. The migration is a deploy step (env vars from Secret Manager), not a code rewrite.

## Helpful agents

`.claude/agents/` contains both:

1. **Production specialist subagent prompts** — loaded by `orchestrator/main.py` and run inside the live Agent SDK orchestrator. Names: `organic-search`, `paid-media`, `analytics`, `monthly-report-drafter`, `gsc-anomaly-detector`.
2. **Dev-helper subagents for Claude Code** — drive engineers building this repo. Names: `pipeline-engineer`, `mcp-integrator`, `agent-architect`, `audit-reviewer`.

The two sets share the directory but serve different runtimes. Each agent file's frontmatter tags which it is.

## When the user asks "should we…"

First place to look: `docs/IMPLEMENTATION_PLAYBOOK.md`. If the question isn't covered there, it's a new decision that needs leadership sign-off — surface that, don't guess.
