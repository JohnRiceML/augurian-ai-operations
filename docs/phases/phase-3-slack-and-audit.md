# Phase 3 — Slack integration + audit (week 5)

**Goal:** Slack as a real input surface, plus production-grade audit logging.
**Deliverable:** a member of the Augurian team uses the agent for a real client task via Slack.

## Tasks

### Slack as an input surface

- [ ] Add the Slack MCP server to the orchestrator's MCP config (use `@modelcontextprotocol/server-slack` with the Bot Token — the first-party MCP requires Dynamic Client Registration, which is unreliable headless).
- [ ] Implement a Slack event listener (Cloud Run service, listens to `app_mention`) that hands the message to the orchestrator.
- [ ] Routing logic: when `@augur` is mentioned in `#client-coborns`, the orchestrator infers `--client coborns` from the channel name. When mentioned in a DM, the agent asks "which client?".
- [ ] Test the round-trip: account lead types `@augur what was Coborn's GA4 traffic last week?` in `#client-coborns` → agent reads the relevant CSV, replies in-thread.

### Production audit logging

- [ ] Promote the Phase 2 audit hooks to production quality:
  - [ ] Captures: timestamp, subagent name, tool called, redacted inputs, truncated outputs (500 char limit), client, request ID.
  - [ ] Writes JSONL to `/Augurian Clients/[Client]/audit/YYYY-MM-DD.jsonl`.
  - [ ] Full unredacted logs go to a separate `audit-full/` folder, retained for 7 days only.
- [ ] Daily summarizer script: at 5 PM Central, summarize the day's audit log per client and post to `#agent-activity`. Include: number of tasks run, total token cost, any errors.
- [ ] PII redaction in the hook — phone numbers, email addresses, SSNs, names from a per-client redaction list in `/context/redaction_list.txt`.

### Adoption

- [ ] **Pair with one account lead through one full client workday.** The lead uses Slack to ask the agent things, gets answers, edits drafts, sends to clients (via their normal workflow, not the agent). Engineer watches.
- [ ] Document what worked, what didn't, in `docs/phases/phase-3-feedback.md`.

## Gotchas

- **Slack message length.** Agent responses can exceed Slack's 4,000-char message limit. Either truncate with a "see full draft in Drive" link, or split into multiple messages. The first option is cleaner.
- **Mention detection in threads.** Make sure the Slack listener handles threaded replies correctly — `@augur` inside a thread should keep the conversation in that thread, not start a new one.
- **Cost monitoring.** Once Slack is open as an input surface, costs can spike if someone leaves a runaway agent loop. Set a per-day token budget per client; the orchestrator hard-stops if exceeded.

## Definition of done

- [ ] An Augurian team member who is not the engineer used `@augur` for a real client task and got a useful answer.
- [ ] The daily audit summary posted to `#agent-activity` for 5 consecutive days.
- [ ] Cost-cap test: simulate a runaway loop, confirm the budget guard fires.

## What's NOT in scope for Phase 3

- A second subagent (Phase 4).
- A second client (Phase 4).
- Notion/Asana integration. Slack first; Notion in a future phase.
