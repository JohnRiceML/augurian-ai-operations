# Phase checklists

Q2 rolls out in five phases over ~10 calendar weeks. Each phase produces a real, reviewable deliverable before the next phase starts.

| Phase | Weeks | Deliverable |
|---|---|---|
| [0 — Foundation](phase-0-foundation.md) | Week 1 | Drive folder structure + accounts + first client_context.md for Coborn's |
| [1 — First pull pipeline](phase-1-first-pipeline.md) | Week 2 | Daily GA4 → Drive CSV, fully automated, 5 days clean |
| [2 — First subagent](phase-2-first-subagent.md) | Weeks 3–4 | Drafted monthly report, account lead approved |
| [3 — Slack + audit](phase-3-slack-and-audit.md) | Week 5 | An Augurian team member uses `@augur` for a real task |
| [4 — Second subagent + Theisen's](phase-4-second-subagent.md) | Weeks 6–8 | Two clients, two workflows, GSC anomaly detector running daily |

Anything past Phase 4 is Q3 scope.

## How to use these

Each checklist is a literal checklist. Don't skip items even when they look obvious. The Phase 0 OAuth setup looks trivial; getting it wrong (External + Testing instead of Internal) costs you a week in Phase 2 when refresh tokens silently expire.

Mark items done in the file as you go. The phase isn't done until every checkbox is checked AND the "Definition of done" criteria are met.
