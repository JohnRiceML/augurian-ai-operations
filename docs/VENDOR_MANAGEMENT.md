# Vendor management

How Augurian (a non-technical org) evaluates and manages the technical builder who's executing this project. Whether that's an internal hire, a contractor, or the consultant — same playbook.

## The mismatch this doc solves

Non-technical orgs hiring a technical builder face a recurring problem: it's hard to evaluate whether they're doing good work, on schedule, until they're done. By then, problems are expensive.

Three principles to fix that:

1. **Demo every phase.** Each phase produces something you can see — a CSV in Drive, a Slack message, a drafted report. Demos go on the calendar, every Friday of phase weeks.
2. **The audit log is the work log.** Whatever the builder claims to have built, the audit log shows what's actually running. Read it.
3. **Decisions don't go in the builder's head.** Anything the builder is making a call on (tool choice, scope, schedule) gets surfaced in the weekly leadership brief.

## What "good" looks like, by phase

Use this as a yardstick. If the builder finishes a phase and the deliverable doesn't match, push back.

### End of Phase 0 (week 1)

- [ ] Demo: builder shares screen, walks through the `/Augurian Clients/Coborn's/` folder. Empty subfolders exist. Service account access is verified.
- [ ] Coborn's `client_context.md` is in Drive (the account lead wrote it, not the builder).
- [ ] `clients.yaml` is populated for Coborn's. Builder shows the file (with secrets redacted).
- [ ] No code changes pushed yet. This phase is mostly setup.

**Red flag:** Builder is "almost done" with Phase 0 at end of week 1 but the `client_context.md` isn't written. **Don't proceed to Phase 1.** That file is the leverage point.

### End of Phase 1 (week 2)

- [ ] Demo: open the Drive folder, see today's GA4 CSV, opened, the dates are correct, row counts make sense.
- [ ] Run the puller live during the demo: builder triggers it manually, you watch the CSV land in Drive within ~2 minutes.
- [ ] 5 consecutive days of clean automated runs (proven by the file timestamps).
- [ ] One simulated failure was caught by the Slack alert (builder will have tested this).

**Red flag:** Builder shows the puller running locally but it's not yet on Cloud Run, or "the alert will work when we set it up." Slipping deployment to Phase 2 is fine; un-tested alerting isn't.

### End of Phase 2 (weeks 3–4)

- [ ] Demo: builder runs the monthly drafter live for Coborn's. You read the draft.
- [ ] Account lead pairing happened — they sat with the builder, marked up a draft, the builder iterated.
- [ ] Two example outputs are saved as fixtures (in `examples/monthly-reports/`).
- [ ] Audit log shows every tool call the agent made for that draft.

**Red flag:** A demo where the draft "needs more work" but the account lead never reviewed it during the phase. Adoption depends on that pairing happening *during* the build, not after.

### End of Phase 3 (week 5)

- [ ] Demo: account lead types `@augur` in `#client-coborns`, gets a real answer.
- [ ] Daily audit summary has been posting to `#agent-activity` for 5 consecutive days.
- [ ] Cost cap test was run (simulated runaway, alert fired).

**Red flag:** Slack listener works in dev but not for the actual account leads' accounts. Test access for every team member during the demo.

### End of Phase 4 (weeks 6–8)

- [ ] Demo: same workflows now work for Theisen's. Account lead onboarding happened.
- [ ] GSC anomaly detector has been running daily for 14 days, both clients.
- [ ] Builder has handed off the operational runbook (see below).

**Red flag:** "It works for Coborn's, just need to wire up Theisen's" at end of week 8 means the second-client cost wasn't priced in. Coborn's-only is not a finished Phase 4.

## What to ask in every weekly check-in

Five questions, every Friday. The builder should expect them.

1. **What did you ship this week that I can see?** ("Wrote a refactor" is not a shipped thing.)
2. **What's blocking you?** Naming it makes it visible. If "nothing," ask: what's the next risk?
3. **Are you on schedule for the phase deliverable? If not, why?** Slips happen; surface them at week 1, not week 4.
4. **Is anything happening I won't see in the audit log?** Catches things like "I rotated the API key" — fine, but should be visible.
5. **What decision do you need from me?** If the builder is making business-impacting calls without surfacing them, that's a problem.

## Reading the work without reading the code

You don't need to read Python. You DO need to read:

- **The audit log.** `/Augurian Clients/<client>/audit/<date>.jsonl`. The `audit-reviewer` agent summarizes it for you. If a day shows "0 tasks ran," ask why.
- **The Slack `#agent-activity` channel.** Daily summary, weekly cost report. Anomalies surface here.
- **The git log.** `git log --oneline` shows what got committed. The conventional-commits format means subjects are readable in plain English.
- **The phase checklist boxes.** `docs/phases/phase-N-*.md`. Are the boxes checked? If a box is checked but the deliverable isn't there, ask.

## What "done" looks like at end of Q2

The builder has handed off:

- [ ] A working orchestrator running on Cloud Run, with monitoring + alerting.
- [ ] Five Python pullers (4 implemented, drive_watcher implemented if Phase 3 was completed).
- [ ] The `.claude/agents/` and `.claude/skills/` definitions, all registered in `permissions.py`.
- [ ] Audit logs flowing to Drive per-client, with the daily Slack summary posting.
- [ ] An **operational runbook** (see template below).
- [ ] The `clients.yaml.example` file kept current; the real `clients.yaml` documented in the password manager.
- [ ] All credentials in Secret Manager, none in repo, none in chat.

## Operational runbook (the builder produces this at end of Q2)

If the builder leaves and the next person needs to keep this running, they need:

```markdown
# Augurian AI Operations — Runbook

## Where things run

- Orchestrator: Cloud Run service `augur-orchestrator`, region us-central1
- Pullers: Cloud Run Jobs (`ga4-puller`, `gsc-puller`, `ads-puller`, `optmyzr-puller`)
- Drive watcher: Cloud Run service `drive-watcher`, min-instances 1
- Schedules: Cloud Scheduler, all jobs at `region us-central1`
- Logs: GCP Cloud Logging
- Secrets: GCP Secret Manager, project `augurian-ai-ops`

## Common tasks

### Onboarding a new client
{Step-by-step. Reference the `client-onboarder` agent.}

### Adding a new subagent
{Step-by-step. Reference the `agent-architect` agent.}

### A puller is failing — how to diagnose
{Common causes: OAuth expired (most common), service account missing
permissions, API quota hit, schema change.}

### A spike in cost — how to diagnose
{Reference the `cost-monitor` agent. Common causes: cache invalidation,
new daily-running task, runaway loop.}

### Rotating an API key
{Step-by-step.}

## Who to contact

- Anthropic API issue: support@anthropic.com (have request ID handy)
- Google Cloud issue: GCP support console
- Slack issue: app owner = ai-ops@augurian.com
```

The `vendor-manager` subagent in this repo helps Augurian leadership read this output, ask the right follow-up questions, and verify the runbook is real (not aspirational).

## Negotiating scope and price

Three guardrails:

1. **Q2 has a fixed scope** (the playbook). Out-of-scope work is Q3 or later. If a builder proposes adding a vector DB, custom-trained model, or multi-tenant abstraction, that's a Q3 conversation — not a Q2 expansion.
2. **Time-boxed phases.** Each phase has a calendar week target. If the builder wants more time, they can have it — but it's surfaced in the brief, not buried.
3. **Fixed-price-per-phase is OK; open-ended hourly billing is risky.** A non-technical org can't easily evaluate "I billed 40 hours this week"; they can evaluate "Phase 2 is done, here's the demo."

## When to bring the consultant back

The consultant who wrote the playbook is the right second opinion when:

- The builder proposes a major architecture change ("let's add Kubernetes").
- A phase is slipping by >1 week and you want a sanity check.
- Cost is climbing without obvious cause.
- Something feels wrong but you can't articulate why.

Two hours of the consultant's time can save weeks. Use it.
