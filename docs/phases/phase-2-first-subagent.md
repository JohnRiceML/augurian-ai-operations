# Phase 2 — First subagent (weeks 3–4)

**Goal:** stand up the orchestrator and build one subagent end-to-end.
**Deliverable:** a drafted monthly report a human can review.

## What we're building

The Monthly Report Drafter. Given a client and a month, it:

1. Reads `/processed/ga4/` (and `/raw/ga4/` if no normalized version exists yet) for that client + month range.
2. Reads `/context/client_context.md` for brand voice and goals.
3. Drafts a monthly performance report — narrative + tables — in markdown.
4. Writes it to `/reports/monthly/YYYY-MM-coborns-monthly-draft.md`.
5. Posts a Slack message to the account lead linking the draft.
6. Stops. Account lead reviews, edits, and decides whether to share with the client. The agent never sends to the client.

## Tasks

### Orchestrator scaffold

- [ ] Implement `orchestrator/main.py` using the Claude Agent SDK. CLI: `augur run --task monthly-report --client coborns --month 2026-04`.
- [ ] Wire the Drive MCP server into the agent's MCP server list.
- [ ] Restrict tools per the `orchestrator/tools/` allowlist (no Bash; Read/Write/Edit only on Drive paths the agent owns).
- [ ] Implement audit hooks (basic version — fuller version in Phase 3).
- [ ] Smoke-test with a "hello world" task: `augur run --task echo --client coborns` makes one model call, logs it, exits.

### Monthly Report Drafter subagent

- [ ] Write `.claude/agents/monthly-report-drafter.md` — the system prompt + tool surface + output contract for this specialist.
- [ ] Manually run it once against Coborn's April 2026 data (or whatever month has data by then).
- [ ] Account lead reviews the output. **Iterate on the system prompt and the `/context/` file based on their feedback** — this is where the "is this good enough" calibration happens.
- [ ] Document what good looks like. Save 2–3 example reports in `examples/` so we have regression fixtures.

### Pairing with the account lead

- [ ] **Watch the account lead use the draft for one real client task.** This is the most important thing in the whole phase. If the abstraction breaks, it breaks here, and it's much cheaper to learn now than in month four.
- [ ] Capture friction points in `docs/phases/phase-2-feedback.md`. Don't fix them all in Phase 2 — note them.

## Gotchas

- **Prompt caching matters.** The `/context/` file gets included in every call. Use the SDK's caching options so the first 1–4K tokens of every prompt are cached — cuts cost ~90% and latency a lot.
- **Long outputs.** Monthly reports can be 2–4K tokens of prose plus tables. Set `max_tokens` to at least 16,000. If you go bigger than that, switch to streaming.
- **The first draft will be bad.** That's the point. The first hour with the account lead post-draft is where the project earns its keep — every "no, it should say X here" turns into a system-prompt edit or a `/context/` update, and the next draft gets meaningfully better.
- **Don't generalize prematurely.** It's tempting to design the orchestrator to handle all five future subagents from day one. Don't. Hardcode the monthly-report path. Generalize when you have two working subagents to compare.

## Definition of done

- [ ] One monthly report drafted, reviewed by the account lead, approved as "yes, I would have written something close to this."
- [ ] The account lead used the workflow — read the Slack notification, opened the draft, edited it, decided what to do next — without an engineer hovering.
- [ ] Two example outputs saved as fixtures in `examples/monthly-reports/`.
- [ ] Audit log shows every tool call the agent made for the monthly run.

## What's NOT in scope for Phase 2

- Slack as an input surface (Phase 3 — for now, runs are CLI-only).
- A second subagent (Phase 4).
- A second client (Phase 4).
- Auto-scheduling the monthly run. Trigger manually for the first month. Auto-schedule once it's been reviewed twice.
