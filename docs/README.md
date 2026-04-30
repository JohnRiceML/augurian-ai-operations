# Documentation index

Start here. All docs are markdown; everything important is also linked from the root `README.md`.

## Read first

- [`IMPLEMENTATION_PLAYBOOK.md`](IMPLEMENTATION_PLAYBOOK.md) — the source-of-truth doc. Tool decisions, time estimates, gotchas, explicit non-goals. Read before proposing scope changes.
- [`architecture/README.md`](architecture/README.md) — five-layer architecture overview, with the SVG diagram (also at the repo root as `ARCHITECTURE.svg`).

## Phase checklists (Q2 rollout)

- [`phases/phase-0-foundation.md`](phases/phase-0-foundation.md) — week 1, accounts + Drive structure
- [`phases/phase-1-first-pipeline.md`](phases/phase-1-first-pipeline.md) — week 2, GA4 → Drive automated
- [`phases/phase-2-first-subagent.md`](phases/phase-2-first-subagent.md) — weeks 3–4, monthly drafter end-to-end
- [`phases/phase-3-slack-and-audit.md`](phases/phase-3-slack-and-audit.md) — week 5, Slack input + audit
- [`phases/phase-4-second-subagent.md`](phases/phase-4-second-subagent.md) — weeks 6–8, second client + GSC anomaly detector

## Tooling references (verified April 2026)

Practical "what to use, what to avoid" briefs. Verify before deploying — vendor APIs shift.

- [`TOOLING_MCP.md`](TOOLING_MCP.md) — Drive, Slack, Notion, Asana MCP servers. **Notable:** the playbook references a Google first-party Drive MCP that doesn't exist; the right path is the Anthropic reference Drive server + service-account auth.
- [`TOOLING_CLOUD_RUN.md`](TOOLING_CLOUD_RUN.md) — Cloud Run Service vs Jobs, Scheduler, Secret Manager, IAM, cost ballpark (~$17/mo GCP + ~$200/mo Anthropic for 2 clients).
- [`TOOLING_PIPELINES.md`](TOOLING_PIPELINES.md) — GA4, GSC, Ads, Optmyzr API quirks. **Notable:** GSC has a 200 queries/day per-account quota that becomes a real blocker beyond ~5–10 clients.

## Other surfaces (non-docs)

- [`../.claude/agents/`](../.claude/agents/) — 14 subagent definitions. Five production specialists (loaded at runtime by the orchestrator), nine dev helpers (used by engineers and account leads working in Claude Code).
- [`../.claude/skills/`](../.claude/skills/) — five reusable skill packages loaded on-demand by subagents (drive-warehouse, ga4-glossary, slack-formatting, pii-redaction, augurian-voice).
- [`../context_templates/`](../context_templates/) — the template the account lead fills in to seed `/context/client_context.md` for a new client. **Do not AI-generate client_context files** — that defeats the entire system.
