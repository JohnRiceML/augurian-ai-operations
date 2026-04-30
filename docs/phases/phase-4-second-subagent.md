# Phase 4 — Second subagent + second client (weeks 6–8)

**Goal:** prove the pattern scales by adding a second client and a second subagent.
**Deliverable:** two clients (Coborn's, Theisen's), two workflows, and confidence that subagent #3 will be cheap.

## Why the GSC anomaly detector is the right second subagent

- **Daily-running, low-stakes.** It runs every morning, posts a one-line summary to Slack. If it's wrong, no client sees it.
- **Different shape than the monthly drafter.** Tests whether the orchestrator pattern generalizes from "long narrative" to "short alert."
- **Reliability test.** Daily means failure modes show up within a week, not a month.

## Tasks

### Add Theisen's

- [ ] Repeat Phase 0's Drive setup for `/Augurian Clients/Theisen's/`.
- [ ] Add Theisen's row to `pipelines/clients.yaml`.
- [ ] Account lead writes Theisen's `/context/client_context.md`. (2 hours.)
- [ ] Service account access to Theisen's GA4, GSC, Ads, Optmyzr accounts. Coordinate with the Theisen's account lead.
- [ ] Run the Phase 1 pullers against Theisen's for 5 days. Confirm CSVs land.
- [ ] Run the Phase 2 monthly drafter against Theisen's. Account lead reviews.

### Build the GSC puller

- [ ] Copy `pipelines/ga4_puller.py` to `pipelines/gsc_puller.py`. Modify for the Search Console API. Target "3 days ago" because of GSC's data lag.
- [ ] Deploy to Cloud Run, schedule daily at 6:30 AM Central.
- [ ] Run for 5 days for both Coborn's and Theisen's.

### Build the GSC anomaly detector subagent

- [ ] Write `.claude/agents/gsc-anomaly-detector.md`. The agent reads the last 28 days of GSC data, computes per-query baselines, flags anomalies (clicks down >40%, impressions up >100% with no click increase, new queries appearing in top 10, etc.).
- [ ] Wire it as a daily orchestrator job: 7:00 AM Central, runs for each active client.
- [ ] Output: a Slack message in `#client-<name>` with bullet-point anomalies. If nothing anomalous, posts "GSC: all clear" so the team knows it ran.
- [ ] Keep a 28-day rolling window of "what was flagged as anomalous" in `/audit/anomalies/` so we can tune the thresholds based on what actually mattered.

### Validation

- [ ] Run anomaly detection daily for 14 days across both clients before declaring done.
- [ ] After day 14, review every flagged anomaly with the relevant account lead. Mark each as: real / noise / would have been useful but wasn't flagged. Tune thresholds.

## Gotchas

- **Theisen's context file is the differentiator.** If both clients' `/context/` files end up similar, you're doing it wrong — the whole point is per-client human judgment. Push back on generic answers.
- **Daily-run cost adds up.** The anomaly detector runs every day per client. With prompt caching, it's cheap per run, but watch the monthly bill.
- **Slack notification fatigue.** If the anomaly detector cries wolf often, the team will start ignoring it. Better to skew toward fewer flags with higher precision than more flags with more noise. Start strict, loosen if real anomalies are missed.

## Definition of done

- [ ] Two clients running on the same code path. Three pullers (GA4, GSC, Ads — well, two so far; Ads is next phase). Two subagents (monthly drafter, GSC anomaly).
- [ ] 14 days of clean daily runs.
- [ ] Account leads from both clients have used the system on a real task.
- [ ] A retrospective doc (`docs/phases/phase-4-retro.md`) captures what was easy, what was hard, what we'd do differently in Q3.

## End-of-quarter status

If we get here, Q2 is a success. Anything more (Notion integration, Optmyzr puller, third subagent) is Q3.
