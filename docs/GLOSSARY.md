# Glossary

Every term used in this repo, in plain English. If a doc uses a word that isn't here, ask the `ai-literacy-coach` subagent or open an issue.

## The system itself

**Augur** — The name of Augurian's AI assistant. Spawned for each task; doesn't run continuously the way Slack does.

**Augurian AI Operations** — The internal name for this whole project. The repo, the running system, the rollout. Q2 2026 build.

**Drafter pattern** — The non-negotiable design rule: the AI drafts, a human reviews, a human sends. Augur never communicates with clients directly. If a feature would let it, that feature is rejected.

## The architecture

**The orchestrator** — The main program that runs on a server. When a task comes in (someone messages `@augur`, or it's the daily anomaly check), the orchestrator decides which specialist to invoke. Like a project manager.

**Subagent / specialist** — A version of Augur configured for one specific job. Augurian has five production subagents: `monthly-report-drafter`, `gsc-anomaly-detector`, `organic-search`, `paid-media`, `analytics`. Each has its own "job description" written in markdown (`.claude/agents/*.md`).

**Skill** — A reusable piece of knowledge any subagent can load when relevant — e.g. "Augurian's writing voice rules" or "how Slack messages should be formatted." Different from a subagent: a subagent is a *who*, a skill is a *what they know*.

**MCP server** (Model Context Protocol) — Pre-built plumbing that lets the AI talk to other systems. Augurian uses three: Google Drive (read client data, write drafts), Slack (chat with the team), and Notion or Asana (where reviewed drafts go). Augurian does not build these — they're off-the-shelf.

**The warehouse** — The collection of Google Drive folders, one per client, where data and drafts live. Structure is identical across clients: `/raw/`, `/processed/`, `/context/`, `/reports/`, `/audit/`.

## The workflow

**Pipeline / puller** — A small Python program that runs once a day to pull data from a source (GA4, Search Console, Google Ads, Optmyzr) and saves it as a CSV in the client's `/raw/` folder. Five total: `ga4_puller`, `gsc_puller`, `ads_puller`, `optmyzr_puller`, `drive_watcher`.

**Drive watcher** — A program that watches the manual-dump folders (`/raw/firefly/`, `/raw/email/`, `/raw/onboarding/`) for new files and normalizes them — transcribes Firefly audio, strips email signatures, redacts PII.

**Context file** — A markdown document, one per client, written by hand by the account lead. Lives at `/context/client_context.md`. Captures voice, business goals, what the client cares about, hard rules, approved claims. ~1 page per client. **Never AI-generated.**

**Audit log** — A daily JSONL file recording every action the AI took for that client. Inputs and outputs are truncated to 500 chars and PII is redacted. Reviewable on demand.

## Roles in the rollout

**Account lead** — The Augurian person who owns a client relationship. Writes the context file, reviews drafts, decides what to send.

**Specialist (paid / SEO)** — The Augurian person responsible for ad campaigns or SEO work. Reviews paid-media or organic-search drafts.

**Engineer / builder** — The technical person who builds and maintains the system. Could be internal, contracted, or the consultant. Lives mostly in `/orchestrator/` and `/pipelines/`.

**Consultant** — The outside expert (currently John Rice / Next Gen AI) who designed the system and wrote the playbook.

**Manager / owner** — The Augurian leadership person responsible for whether this project succeeds. Reads the weekly leadership brief, watches the cost dashboard.

## Phases

**Phase 0** — Foundation. Accounts, credentials, Drive folders. Week 1.
**Phase 1** — First pipeline. GA4 → Drive, daily, automated. Week 2.
**Phase 2** — First subagent. Monthly report drafter. Weeks 3–4.
**Phase 3** — Slack + audit. Production audit logging, ad-hoc Slack queries. Week 5.
**Phase 4** — Second client + second subagent. Theisen's. GSC anomaly detector. Weeks 6–8.

## Technical jargon you'll see

**Claude / Claude Opus 4.7 / Claude Haiku 4.5** — The AI model. Anthropic's product. "Opus" is the smarter (more expensive) tier; "Haiku" is the faster/cheaper tier. Augurian uses both — Opus for drafting, Haiku for the daily anomaly check.

**Claude Agent SDK** — The framework Augurian uses to build the orchestrator. Anthropic's open-source Python library.

**Claude Code** — The command-line tool engineers use to build software with Claude's help. The dev-helper subagents (in `.claude/agents/`) work in Claude Code.

**Cloud Run** — Google Cloud's "run a small program for me" service. Hosts the orchestrator and the pullers.

**Cloud Scheduler** — Google Cloud's "run X every day at Y time" service. Triggers the daily pullers.

**Secret Manager** — Google Cloud's "store passwords and API keys safely" service. Holds the Anthropic key, Slack token, etc.

**Service account** — A Google Cloud identity that programs use, separate from a person's identity. Augurian has separate service accounts per puller so a leak in one doesn't compromise the others.

**OAuth** — The "log in with Google" pattern, but for programs. The Drive MCP server and the Notion/Asana MCP servers use OAuth.

**Token / API key** — A long string of characters that authenticates a program. Stored in Secret Manager, never in code, never in Slack messages, never in commit messages.

**PII** (Personally Identifiable Information) — Phone numbers, email addresses, SSNs, customer names. Redacted from audit logs before they're saved.

**Prompt cache** — A way to reuse the AI's reading of a long document across multiple questions, ~90% cheaper than re-reading. The `/context/client_context.md` file is loaded via prompt cache, so it's nearly free to include in every task.

**Conventional Commits** — A standard format for git commit messages. Augurian uses it. See `.claude/skills/conventional-commits/`.

## Phrases you'll hear and what they mean for you

| Phrase | Translation |
|---|---|
| "It's in production" | The program is running on Google Cloud, doing its job daily. |
| "It's drafted" | The AI wrote a first version. A human still needs to review. |
| "We need to write a context file" | Account lead spends 2 hours capturing client voice + goals. |
| "The puller failed" | The daily data pull didn't run successfully. The Slack alert in `#agent-activity` will say which one. |
| "The audit log shows…" | We have a record of what the AI did. We can verify any specific action. |
| "Cost is up this week" | The Anthropic API bill is higher than usual. Worth investigating but rarely an emergency. |
| "We need to update the redaction list" | A name or term keeps appearing in logs that shouldn't. Add it to the per-client list. |
| "Adoption is the risk" | The technical work is straightforward. The risk is whether anyone actually uses what gets built. |
