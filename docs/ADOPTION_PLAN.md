# Adoption plan

The technical rollout is in `docs/phases/`. This is the *team* rollout — what humans at Augurian are doing in each week, what they're being asked to learn, and what success looks like at the team level.

The technical work and the adoption work run in parallel. Technical Phase 0 happens while Adoption Week 1 happens.

## Why this doc exists

The implementation playbook calls out — explicitly — that adoption is the project's biggest risk:

> The biggest risk in this project isn't technical. The technical pieces all exist and are well-documented; the build is mostly assembly. The risk is adoption — whether Augurian's team actually uses what gets built.

A non-technical org integrating its first AI tool fails in one of three ways:

1. **The system is built, but nobody uses it.** ("It's there if you need it" is the death sentence.)
2. **One person uses it, becomes the bottleneck, and quits.** ("Only Mike knows how to ask it questions.")
3. **People use it, but only for tasks they were going to do anyway.** ("It's a fancier version of what I had.") The leverage isn't realized.

This plan exists to make all three of those harder.

## The cast

| Role | Time commitment | Who |
|---|---|---|
| **Executive sponsor** | ~1 hr/week reading the brief | An Augurian partner |
| **Project owner** | ~3 hr/week | Person responsible for whether this succeeds |
| **Pilot account leads** (2) | ~3–5 hr/week during their phase | Coborn's lead, Theisen's lead |
| **Pilot specialists** (2) | ~1 hr/week | One paid, one SEO |
| **Builder** | Full-time during build phases | Engineer / contractor |
| **Consultant** | Part-time for review + escalations | John / Next Gen AI |

If any of those slots is unfilled, the plan stalls. Identify them before week 1.

## Week-by-week (team view)

### Week 1 — Foundation (parallel with technical Phase 0)

**Leadership:**
- Resolve the 5 pre-week-1 decisions (Notion vs Asana, ai-ops account owner, builder identity, budget, client disclosure).
- Sign off on the executive sponsor.

**Coborn's account lead:**
- Read [`docs/FOR_NON_TECHNICAL_READERS.md`](./FOR_NON_TECHNICAL_READERS.md) and [`docs/GLOSSARY.md`](./GLOSSARY.md) (~30 min).
- Write the first draft of `client_context.md` for Coborn's. Use the `context-coach` agent for the interview structure. **2 hours, on the calendar.**
- Optional: get Coborn's sign-off on the context file (recommended for clients who know AI is in the loop).

**Project owner:**
- Onboard with the consultant. Walk through the playbook + this adoption plan.
- Schedule the first weekly leadership brief for end of week 2.

### Week 2 — First data flowing (parallel with technical Phase 1)

**No team-facing change yet.** The puller runs daily, but no one outside the engineer notices.

**Project owner:**
- Verify that the first weekly cost report posts to `#agent-activity` (set up in Phase 1).
- First weekly leadership brief. Use the template in [`LEADERSHIP_BRIEF.md`](./LEADERSHIP_BRIEF.md).

### Weeks 3–4 — First subagent, first real interaction (parallel with technical Phase 2)

**This is the make-or-break phase for adoption.**

**Coborn's account lead:**
- Watch a live demo of the orchestrator running the monthly drafter on real Coborn's data. Engineer drives.
- Get the drafted monthly report. **Review it critically.** Mark every line you'd change. Don't be polite — the system gets better the more you push back.
- Pair with the engineer for one full hour of iteration: account lead suggests edits, engineer adjusts the system prompt or the context file, they regenerate, repeat.
- Use the resulting draft as the starting point for the actual Coborn's monthly report you would have written anyway.

**Project owner:**
- Sit in on the pairing session above. Observe what works and what doesn't.
- Update the leadership brief with first-impressions data: did the draft save time? How much edit was needed?

**Specialist (paid or SEO):**
- Optional but recommended: ask the agent one ad-hoc question via the consultant's CLI access. Just to see what it feels like. (Slack access comes in Phase 3.)

### Week 5 — Slack + audit live (parallel with technical Phase 3)

**This is when the team starts using it directly.**

**All Coborn's-touching team members:**
- Read [`docs/TRAINING_GUIDE.md`](./TRAINING_GUIDE.md) — 30 min.
- Use `@augur` in `#client-coborns` for one real task this week. Even a small one. Document what worked / didn't.
- The `change-comms` agent has drafted a "here's how to use it" Slack message — adapt it and post.

**Project owner:**
- Watch the daily audit summary in `#agent-activity` for one full week. Note when nothing was used (a quiet day = an adoption signal).
- Confirm cost is in budget.

### Weeks 6–8 — Second client, second workflow (parallel with technical Phase 4)

**Theisen's account lead:**
- Same onboarding as Coborn's lead in Week 1. Write Theisen's `client_context.md`.
- Review first drafts. Iterate.

**All team members touching Coborn's:**
- The GSC anomaly detector is now running daily on Coborn's. Posts a one-liner to `#client-coborns` every morning at 7 AM.
- For 14 days, mark each posted anomaly as: real / noise / would-have-been-useful-but-missed. Tune thresholds based on this.

**Project owner:**
- End-of-Q2 retrospective. What's worth bringing into Q3? What got cut?
- Decide: does the system stay running? Add a third client? Hire a permanent owner?

## Adoption signals (what to watch)

Track these weekly. If they're not improving, intervene:

| Signal | Healthy looks like | Unhealthy looks like |
|---|---|---|
| `@augur` mentions in Slack per week | Climbing through Phase 3, plateaus by Phase 4 | Zero, or only the engineer |
| Number of unique team members who used it | Climbing | One person carrying the whole load |
| Account lead edits per draft | Decreasing over time | Constant or increasing |
| Anomalies the team reads vs ignores | Most are read | All are ignored — alert fatigue |
| Cost per useful task | Decreasing | Increasing without explanation |
| Account lead sentiment ("how does this feel?") | "Saves me time on data pulls" | "I still don't trust it" |

The KPI playbook ([`KPI_PLAYBOOK.md`](./KPI_PLAYBOOK.md)) has the full measurement system.

## Things that kill adoption (and what to do)

### "I asked it once and the answer was wrong"

The drafter pattern accommodates this — the answer was a draft. **But early bad outputs poison adoption.** Counter:

- Pair with the account lead during the first three uses. Engineer present. Iterate the system prompt or context file in real time.
- The first three drafts will be bad. Plan for it. Frame it as calibration.

### "It's faster to do it myself"

Sometimes true, especially for simple tasks. **Don't push the agent on tasks it isn't right for.** Counter:

- The agent's value is in the *time-consuming-and-mechanical* tasks (monthly reports, anomaly checks). Not in 5-minute lookups.
- Be explicit about what it's for. The training guide has a "good fit / bad fit" matrix.

### "I don't know what to ask it"

Common with novice users of any AI tool. Counter:

- The training guide has a starter list of questions for each subagent.
- The `ai-literacy-coach` subagent answers "what can I ask?" type questions.

### "The context file is too much work"

It's two hours. But two hours that aren't on the calendar will never happen. Counter:

- Put it on the calendar. Two-hour block.
- The `context-coach` agent runs it as an interview, so it's two hours of conversation, not two hours of staring at a blank page.
- The 2 hours saves ~5–10 hours of editing AI-drafted reports per quarter. ROI is fast.

### "We built it and forgot about it"

The deepest failure mode. Counter:

- The weekly cost report and weekly leadership brief make absence visible. If a week passes with zero `@augur` mentions, the brief calls it out.
- The end-of-Q2 retrospective forces a decision: keep, kill, or scale.

## At the end of Q2

Two questions, asked literally:

1. **Did anyone use it for a real client task without the engineer prompting them?** If no — the project failed, regardless of how well the technology worked.
2. **Would the team complain if it were turned off tomorrow?** If no — you have a research project, not a production tool.

Honest answers to those two questions decide whether Q3 happens.
