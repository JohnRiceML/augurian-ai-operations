# Augurian AI Operations — Implementation Playbook

**Status:** Pre-build research complete. Ready to scope a Q2 pilot.
**Date:** April 2026
**Audience:** Augurian leadership

---

## Why this exists

The architecture doc tells us *what* to build. This doc tells us *how* to build it without surprises. Each section names the specific tool we're using, where the friction will be, what it costs in time, and what the alternative looks like if the first choice doesn't fit.

The headline: every layer of the architecture has a current, supported, well-documented tool. We aren't building anything from scratch. Most of what looks like "engineering" in the build is really "configuration plus thirty lines of glue code." The expensive part of the project is the parts only Augurian can do — writing the client context, calibrating the agent's voice, and doing the human review.

---

## Phased rollout — what Q2 actually looks like

A "let's take it one step at a time" approach, where each phase produces something real and reviewable before the next phase starts.

### Phase 0 — Foundation (week 1)

Get the accounts, credentials, and Drive structure in place for one client. No agent yet.
**Deliverable:** a working `/Augurian Clients/Coborn's/` folder with raw GA4 data flowing in daily.

### Phase 1 — First pull pipeline (week 2)

GA4 → Drive, on a daily schedule, fully automated.
**Deliverable:** a CSV in `/raw/ga4/` that updates every morning without human touch.

### Phase 2 — First subagent (weeks 3–4)

Stand up the orchestrator. Build one subagent end-to-end (the Monthly report drafter). Run it once, by hand, on the data we've collected.
**Deliverable:** a drafted monthly report a human can review.

### Phase 3 — Slack integration + audit (week 5)

Connect Slack so the team can ask the agent ad-hoc questions, and add audit logging.
**Deliverable:** someone on the Augurian team uses it for a real client task.

### Phase 4 — Second subagent + second client (weeks 6–8)

Add Theisen's. Add a second subagent (recommend the GSC anomaly detector — daily-running, low-stakes, a good test of reliability).
**Deliverable:** two clients, two workflows, and confidence the pattern scales.

That's roughly Q2. Anything beyond is Q3.

---

## Tool-by-tool decisions

For each piece of the architecture: what we're using, why, what the gotcha is, and what we'd switch to if it doesn't work.

### The orchestrator — Claude Agent SDK (decided)

**What it is.** Anthropic's open-source SDK (Python or TypeScript) that gives you a Claude-powered agent with built-in tools — file I/O, bash, web search — plus native MCP support for connecting external systems, plus a subagent system, plus hooks for audit logging. This is the exact pattern the architecture describes; it's not a coincidence, it's the pattern Anthropic built the SDK for.

**Why this and not the bare API.** With the bare API, we'd write the agent loop ourselves (call the model → check if it wants a tool → execute the tool → feed the result back → repeat). The SDK does that for us and handles edge cases — retries, context management, tool permission gates. Saves roughly two weeks of build time.

**Setup, in concrete steps:**

1. Create an Anthropic API key on `console.anthropic.com`. *(15 min)*
2. `pip install claude-agent-sdk` (Python) or `npm install @anthropic-ai/claude-agent-sdk` (TypeScript). *(5 min)*
3. Set `ANTHROPIC_API_KEY` env var. *(5 min)*
4. Write a "hello world" agent — about 20 lines of code from the quickstart. *(30 min)*
5. Wrap it in a process manager (systemd, pm2, or a Cloud Run service) so it runs continuously. *(half a day)*

**Gotcha.** The SDK was originally Claude Code SDK; it ships with Claude Code's full toolkit (Read, Write, Edit, Bash) by default. We need to restrict tools per subagent — analytics agents shouldn't have Bash, the orchestrator shouldn't have Edit. Use the `allowed_tools` option to allowlist explicitly.

**Fallback.** If the SDK doesn't fit (rare), drop down to the bare Anthropic API and write the loop manually. About two weeks of additional engineering.

### Google Drive connection — Google's official Drive MCP server (recommended)

**What it is.** Google released their own first-party Drive MCP server in early 2026. Pre-built, OAuth-based, hosted by Google. Provides standard read/write tools that the Agent SDK can call.

**Why this and not a community version.** Three or four community Drive MCP servers exist (Composio's, piotr-agier's, a-bonus's). They all work. But the Google-official one means Google handles the OAuth refreshes, breaks less when APIs change, and avoids the "your refresh token expired in 7 days because the OAuth app is in Testing status" problem that bites every community implementation.

**Setup:**

1. Create a Google Cloud project for Augurian's AI ops. *(15 min)*
2. Enable the Drive API. *(5 min)*
3. Configure the OAuth consent screen — set Audience to **Internal** (this is the part that prevents the 7-day token expiry). *(15 min)*
4. Create an OAuth client ID, application type "Web application." *(10 min)*
5. In the Agent SDK config, add the Drive MCP server URL with the OAuth client ID and secret. *(15 min)*
6. First time the agent runs, it'll prompt for OAuth consent. After that, refresh tokens auto-renew. *(10 min)*

**Gotcha #1 — the Internal vs External setting.** If the OAuth consent screen is set to External and the app is in "Testing" status, refresh tokens expire after 7 days. The agent will silently stop working a week later. Set it to Internal (only available with a Google Workspace account, which Augurian has). This is the single most common reason these integrations break.

**Gotcha #2 — scopes.** Request the minimum needed. For our case: `drive.readonly` for `/raw/`, `drive` for `/processed/` and `/reports/`. Over-scoping triggers more aggressive Google review.

**Fallback.** Composio. They handle OAuth as a managed service for ~$30/month. Costs more, breaks less. Worth it if Phase 0 takes longer than two days due to OAuth issues.

### Slack connection — Slack's official MCP server (decided)

**What it is.** Slack also released a first-party MCP server in early 2026. Hosted at `https://mcp.slack.com/mcp`. Provides search, message read/write, channel management.

**Setup:**

1. Create a Slack app at `api.slack.com/apps`. Name it "Augur" (or whatever the bot identity is). *(15 min)*
2. Add Bot Token Scopes: `channels:history`, `channels:read`, `chat:write`, `search:read`, `users:read`. *(15 min)*
3. Install the app to the Augurian workspace. *(5 min)*
4. Copy the Bot User OAuth Token (`xoxb-...`). *(5 min)*
5. Configure the MCP server in the Agent SDK with the token. *(15 min)*
6. Invite the bot to the channels it needs access to (`/invite @augur` in each channel). *(10 min)*

**Gotcha.** Slack's MCP server uses an OAuth flow that requires Dynamic Client Registration. If using Claude Code locally, this works; if running headless on a server, the npm-based `@modelcontextprotocol/server-slack` with a manually-created Bot Token is more reliable. We'll use the Bot Token approach for production.

**Fallback.** None needed — both approaches above are stable.

### GA4 data pull — Python script + Google Cloud Scheduler (recommended)

**What it is.** A small Python script that authenticates to GA4 with a service account, pulls yesterday's data, writes a timestamped CSV to Drive. Scheduled to run daily at 6am.

**Setup:**

1. Same Google Cloud project as the Drive MCP. Enable the Google Analytics Data API. *(5 min)*
2. Create a service account named `ga4-puller`. Download the JSON key. *(15 min)*
3. In each client's GA4 property, add the service account email as a Viewer. *(5 min per client — Augurian's account leads can do this in the GA4 admin UI)*
4. Write the puller script — ~50 lines of Python. Uses `google-api-python-client` and `pandas`. *(half a day, including testing)*
5. Deploy to Cloud Run (or a small VM). *(half a day)*
6. Schedule with Cloud Scheduler: daily, 6am Central. *(30 min)*
7. Output goes to `/Augurian Clients/[Client]/raw/ga4/YYYY-MM-DD.csv`. *(no extra setup; the script writes via Drive API)*

**Gotcha.** GA4 doesn't have "views" like UA did — the unit is the Property ID. Each client has a different one; the puller needs a config file mapping client → Property ID → Drive folder. Build this as a YAML file from day one; don't hardcode.

**Fallback.** Coupler.io or Supermetrics if writing the script is too much for the engineer doing the work. Costs $50–200/month depending on volume. Removes engineering work but adds a vendor dependency.

### GSC, Google Ads, Optmyzr pulls — same pattern as GA4

Same shape: service account, enable the API, add the service account as a user on each client's account, write a script, schedule it.

- **GSC:** the Google Search Console API has a 2-3 day lag on data. Our daily pulls should target "3 days ago" rather than "yesterday."
- **Google Ads:** uses a slightly different auth pattern (developer token + OAuth client). Slightly more setup, ~1 extra day.
- **Optmyzr:** has its own API. The puller for Optmyzr is the most likely to need maintenance because their API is less stable than Google's. Plan for that.

**Recommendation.** Build the GA4 puller first. Once it works end-to-end, the others are 80% the same script with different API client libraries. Don't try to build a "generic puller framework" — just copy the script and modify it. Three scripts is easier to maintain than one over-engineered one.

### Manual dump pipeline (Firefly, email, onboarding) — Drive watcher + normalizer

**What it is.** A Python script (or Cloud Run service) that watches `/raw/firefly/`, `/raw/email/`, `/raw/onboarding/` for new files. When a file appears, it normalizes (strips PII, transcribes audio, converts to CSV/JSON) and writes the cleaned version to `/processed/`.

**Setup:**

1. Use the Drive API's `changes.list` endpoint with a watch token to detect new files. *(half a day)*
2. For Firefly audio files specifically: use OpenAI Whisper API or Google Speech-to-Text for transcription. Whisper is cheaper and better for messy audio; ~$0.006/minute. *(half a day)*
3. PII stripping: a regex pass for phone numbers, names from a redaction list, email addresses. *(half a day)*
4. Output normalized JSON/CSV to `/processed/[source]/`. *(part of the same script)*

**Gotcha.** Drive's changes API is a polling endpoint, not push. We'll poll every 5 minutes; that's the latency between "file dropped" and "agent can use it." Fine for our use case.

**Fallback.** Zapier or Make.com if the watcher script becomes a maintenance burden. ~$30–50/month, less reliable but no code.

### The `/context/` files — markdown, hand-written

**What it is.** A markdown file per client (~1 page) describing brand voice, business goals, dos and don'ts. The agent loads this on every relevant task via prompt caching, which makes it nearly free to include.

**Setup:**

1. The account lead writes the first draft. *(2 hours per client)*
2. Reviewed by the client (optional but recommended). *(1 hour)*
3. Stored in `/Augurian Clients/[Client]/context/client_context.md`.
4. Reviewed quarterly. *(30 min per client per quarter)*

**Gotcha.** Don't generate these with AI. The whole point is that they capture human judgment that wouldn't otherwise be in the system. AI-generated context files just regress everything to a generic baseline.

**Cost note.** With prompt caching, a 5KB context file loaded 100 times a month costs about $0.25. Treat it as free; include it everywhere.

### Audit logging — Agent SDK hooks

**What it is.** The Agent SDK supports hooks that fire at lifecycle points (before tool call, after tool call, on error). We use these to log every action the agent takes to a per-client `/audit/` folder.

**Setup:**

1. Write a hook that captures: timestamp, subagent name, tool called, inputs (redacted), outputs (truncated), client context. *(half a day)*
2. Hook writes to `/Augurian Clients/[Client]/audit/YYYY-MM-DD.jsonl`. *(part of the same code)*
3. A separate script summarizes the day's audit log and posts to `#agent-activity` in Slack. *(2 hours)*

**Gotcha.** Logging the full input/output of every Claude call gets large fast — a busy day might be 50MB. Truncate to first 500 chars of input and first 500 of output for the audit log. Keep full logs only for the last 7 days, in a separate folder.

---

## What's actually expensive (and what isn't)

| Activity                                            | Time cost      | Note                                |
| --------------------------------------------------- | -------------- | ----------------------------------- |
| OAuth setup for Drive + Slack + Google Ads          | 1 day          | Front-loaded, done once             |
| First pull script (GA4)                             | 1–2 days       | Sets the pattern                    |
| Each additional pull script                         | 0.5 day        | Mostly copy-paste                   |
| Firefly normalizer (with Whisper transcription)     | 2–3 days       | The most code in the project        |
| Orchestrator + first subagent end-to-end            | 1–2 weeks      | Real iteration here                 |
| `/context/` files                                   | 2 hours/client | The single highest-leverage hour    |
| Audit hooks                                         | 1 day          | Don't skip                          |
| Each additional subagent after the first            | 2–3 days       | Pattern is established              |

**Total Q2 engineering:** roughly 4–6 weeks of focused work for one engineer, plus account-lead time for context files and review. Not 4–6 weeks of calendar time — that's the working hours estimate. With normal context-switching, it lands at ~10 calendar weeks, which is what the phased plan above reflects.

---

## What I'd push Augurian to decide before week 1 starts

These are the decisions that block everything if they're not made:

1. **Notion or Asana?** (Pick one. Don't run both.)
2. **Who owns the Google Cloud project, the Anthropic API key, and the Slack bot identity?** Recommend a new dedicated `ai-ops@augurian.com` Workspace user, not an existing employee.
3. **Which engineer is doing the build?** Internal hire, contractor, or me as the consultant building it directly.
4. **What's the budget envelope for Q2?** Engineering time + ~$200/month in AI compute + ~$50/month in tooling = ballpark $X. Need a number to work against.
5. **Does Coborn's know AI is in the loop?** If the answer is "no, and we don't want them to know yet," that constrains how visible the pilot can be. Best to surface this now.

---

## What I'm explicitly not recommending we do in Q2

Worth naming, so the scope stays honest:

- **No custom-trained model.** We use Claude as-is. Fine-tuning is months of work for marginal gains.
- **No public-facing tools for clients.** This is Augurian-internal. Clients receive deliverables, not access.
- **No vector database / RAG infrastructure.** The data lives in Drive; the agent reads files directly. RAG adds complexity we don't need at this scale.
- **No multi-tenant SaaS architecture.** This is for Augurian, not for resale to other agencies. Don't over-engineer for a future that may not happen.
- **No agent autonomy past drafting.** Every external output is human-reviewed. This is non-negotiable.

---

## The consultant's honest note

The biggest risk in this project isn't technical. The technical pieces all exist and are well-documented; the build is mostly assembly. The risk is **adoption** — whether Augurian's team actually uses what gets built, whether the account leads keep `/context/` files current, whether someone owns the audit channel. If we build it and nobody uses it, that's the failure mode, not "Claude wrote a bad report."

Recommend that whoever builds this also pairs with one account lead through Phase 2 — not just delivering the tool but watching them use it once on a real client task. That's the moment where the abstraction either holds up or doesn't, and it's much cheaper to find out in week 4 than in month four.
