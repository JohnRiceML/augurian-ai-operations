# For non-technical readers

If you're an Augurian partner, account lead, or operations team member opening this repo for the first time — start here. The rest of the docs assume some technical context. This one doesn't.

## In one paragraph

Augurian is building an AI assistant ("Augur") that helps the team do their job faster — drafting client reports, spotting anomalies in search data, triaging Optmyzr recommendations. Every output the assistant produces is reviewed by a human at Augurian before it ever reaches a client. The assistant doesn't replace the account lead's judgment; it removes the part of the work that's mostly mechanical (pulling data, writing the first draft, checking for unusual numbers) so the account lead can spend more time on the part that needs them (strategy, relationships, judgment).

That's it. The rest of the repo is the plan to build that.

## What's in the box (in plain English)

| You'll see this term | It means |
|---|---|
| The orchestrator | The main AI program. Like a project manager that decides which specialist to ask for help with each task. |
| A subagent | A specialist version of Augur, trained for one job (e.g. "draft monthly reports"). Each subagent has its own job description (`.claude/agents/*.md`). |
| A skill | A piece of reusable knowledge any subagent can load when needed (e.g. "how Augurian writes — what words to avoid"). |
| MCP server | The plumbing that lets Augur talk to Google Drive, Slack, Notion, etc. Pre-built, off-the-shelf — Augurian doesn't build these. |
| The warehouse | A folder structure in Google Drive, one folder per client, where data and drafts live. |
| Drafter pattern | Augur drafts; humans review; humans send. The agent never sends to a client. This is non-negotiable. |
| Phase 0 / Phase 1 / etc. | The week-by-week rollout plan. Each phase produces something Augurian can review before the next starts. |
| Audit log | A daily record of everything the AI did, per client. Reviewable. Trimmable. |

The full glossary is in [`GLOSSARY.md`](./GLOSSARY.md).

## Three things to read first

1. **[`docs/IMPLEMENTATION_PLAYBOOK.md`](./IMPLEMENTATION_PLAYBOOK.md)** — the consultant brief. Tool decisions, time estimates, what's *not* in scope. Written for leadership.
2. **[`ARCHITECTURE.svg`](../ARCHITECTURE.svg)** — the diagram. Open in any browser.
3. **[`docs/ADOPTION_PLAN.md`](./ADOPTION_PLAN.md)** — week-by-week rollout from the *team's* perspective (not the engineer's). Where you fit, what you'll be asked to do.

## Three things you'll need to do as Augurian leadership

These are decisions only Augurian can make. The engineer cannot make them on Augurian's behalf:

1. **Pick Notion or Asana.** Don't run both. Pick the one your team already uses.
2. **Decide who owns the AI assistant.** Recommend a dedicated `ai-ops@augurian.com` Workspace user — not an existing employee's account.
3. **Decide what to tell clients.** Does Coborn's know AI is in the loop? "No, and we don't want them to know yet" is a valid answer; "yes, fully transparent" is also valid; the answer constrains how visible the pilot can be. Worksheet at `docs/CLIENT_DISCLOSURE_WORKSHEET.md` (added in Phase 0).

The full leadership decision list is in [`docs/LEADERSHIP_BRIEF.md`](./LEADERSHIP_BRIEF.md).

## Three things you'll need to do as an account lead

If you'll be using Augur on a client account:

1. **Write the client context file.** ~2 hours. The single highest-leverage thing in this whole project. There's an interview agent (`context-coach`) that helps you do it right — see [`docs/TRAINING_GUIDE.md`](./TRAINING_GUIDE.md).
2. **Review the first three drafts critically.** Mark every line you'd change, every claim that needs verifying, every voice mismatch. The system gets better the more you push back.
3. **Use it on a real task within two weeks.** Adoption is the whole game. If it's never used after delivery, the project fails — not because the AI was bad, but because no one ran it.

## Three risks worth knowing about

1. **Adoption risk** (highest). The biggest failure mode is "we built it, nobody uses it." That's why the rollout has account-lead pairing built into Phase 2.
2. **Context-file rot.** If the per-client context files get stale (no quarterly review), the agent's voice drifts toward generic. Quarterly review is non-negotiable.
3. **Cost surprises.** Capped via a per-client daily token budget, but the partner who owns the bill should look at the weekly cost report (in `#agent-activity` Slack channel) for the first month.

## Who to ask for what

- **"What does X term mean?"** → [`GLOSSARY.md`](./GLOSSARY.md), or ask the `ai-literacy-coach` subagent if it doesn't.
- **"How do I write a good client context file?"** → [`TRAINING_GUIDE.md`](./TRAINING_GUIDE.md) and the `context-coach` agent.
- **"How is the project going?"** → ask for the most recent leadership brief; template at [`LEADERSHIP_BRIEF.md`](./LEADERSHIP_BRIEF.md).
- **"Are we getting our money's worth?"** → [`KPI_PLAYBOOK.md`](./KPI_PLAYBOOK.md).
- **"How do I tell the team about this rollout?"** → the `change-comms` agent will draft the internal email; you edit and send.
- **"How do I evaluate the engineer's progress?"** → [`VENDOR_MANAGEMENT.md`](./VENDOR_MANAGEMENT.md).
- **"Something's wrong"** → ask in `#agent-activity` Slack, or DM the engineer + the consultant.
