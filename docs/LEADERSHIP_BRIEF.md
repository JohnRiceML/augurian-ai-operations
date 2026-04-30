# Leadership brief

Template + cadence for the partner-facing status update. Filled in weekly during the build, then monthly once the system is in steady state.

## Audience

Augurian partners. Reading time budget: 5 minutes. They want to know — fast — whether this is on track, whether costs are sane, and whether anyone's using it.

The mistake to avoid: a brief full of technical detail. Save tokens-per-day, percentile latency, and which subagent was refactored for the engineer. Talk in business terms.

## Cadence

| Phase | Frequency |
|---|---|
| Build (Phases 0–4, weeks 1–8) | Weekly, end of Friday |
| Steady state (post-Q2) | Monthly, last business day |
| Incident in progress | Daily until resolved |

Owner: the project owner. The `leadership-briefing` subagent will draft from the audit logs and KPI dashboard; the project owner edits and sends.

## Template

```markdown
# Augurian AI Operations — Leadership Brief
**Period:** {start date} – {end date}
**Phase:** {Phase X — name}
**Status:** ON TRACK / AT RISK / BLOCKED
**Owner:** {name}

## Headline (1–2 sentences)

{The single most important thing leadership should know this period.
"Phase 1 complete on schedule, GA4 data flowing daily for Coborn's"
or "Phase 2 slipping by 5 days due to OAuth issue with Drive — see
risks." If headline is good news, lead with the number. If bad,
lead with what we're doing about it.}

## What got done

- {2–4 bullets. Concrete, in business terms.
   ✓ "First monthly report draft generated and reviewed by Sarah"
   ✗ "Implemented the orchestrator's MCP wiring"}

## Numbers that matter

| Metric | This period | vs target |
|---|---|---|
| Tasks the agent ran | … | … |
| Drafts reviewed by an account lead | … | … |
| Account leads who used `@augur` | … | … |
| Anthropic spend (week / month) | $… | budget $… |
| Cloud Run spend | $… | budget $… |
| Errors / failures requiring intervention | … | < 2 = healthy |

(Drop rows that don't apply yet — early phases will only have 1–2 of these.)

## Risks and what we're doing

- **{Risk 1}** — {one sentence on what we're doing about it, with date}
- {2–3 bullets max. If there are more, the brief is hiding something.}

## Decisions needed from leadership this week

- [ ] {Decision needed, with deadline}
- [ ] {…}
- {Most weeks this is empty. That's a good sign.}

## Looking ahead

- {Next 1–2 weeks, what's coming}
- {Anything that needs leadership attention before it lands}

## What's NOT in this brief (intentionally)

- Technical detail. If you want it, ask the engineer or read `#agent-activity`.
- Speculation about Q3 features. Q2 first.
```

## Worked example — Week 5 brief, hypothetical

```markdown
# Augurian AI Operations — Leadership Brief
**Period:** May 4 – May 10, 2026
**Phase:** Phase 3 — Slack + audit
**Status:** ON TRACK
**Owner:** {project owner}

## Headline

Augur is now answering ad-hoc questions in Slack for Coborn's. Sarah
(Coborn's lead) used it 4 times this week without engineer help —
real adoption, not a demo.

## What got done

- ✓ Slack integration live; `@augur` in `#client-coborns` works
- ✓ Audit logging now writes to Drive nightly per client
- ✓ Sarah used Augur for two real client questions and one ad-hoc analysis
- ✓ Cost-per-task tracking dashboard live in `#agent-activity`

## Numbers that matter

| Metric | This week | vs target |
|---|---|---|
| Tasks the agent ran | 11 | n/a (first real week) |
| Drafts reviewed by Sarah | 1 (April monthly) | 1/month per client |
| Account leads who used `@augur` | 1 of 1 active | tracking toward 100% |
| Anthropic spend | $34 | budget ~$50/wk |
| Cloud Run spend | $4 | budget ~$5/wk |
| Errors requiring intervention | 1 (transient OAuth refresh) | < 2 = healthy |

## Risks and what we're doing

- **Sarah is the only user so far.** Phase 4 onboards Theisen's lead;
  if we don't, we're back to one-person-bus-factor by mid-June.

## Decisions needed from leadership this week

- [ ] Confirm Theisen's onboarding starts Monday May 13

## Looking ahead

- Next week: Theisen's Drive folder structure + access (Phase 4 kickoff)
- Within 2 weeks: GSC anomaly detector running daily on both clients
```

## Things to put in writing every brief

These three sentences should appear in some form, somewhere:

1. **What changed since last brief.** "Same as last week" is also valid — partners need to know whether to skim or read carefully.
2. **What's the project owner worried about.** Surface it early. A risk hidden for two weeks becomes a crisis.
3. **What leadership is being asked for.** Either a decision (with deadline), a budget approval, or "nothing — keep watching."

## Things to NEVER put in the brief

- Internal Augurian gossip. The brief might end up in a board deck.
- Speculation about clients' future spend with Augurian. Out of scope.
- Specific dollar figures of client revenue. Confidential, and not what this project measures.
- API keys, tokens, real Drive folder IDs. Even in screenshots.

## Versions of the brief by audience

The `leadership-briefing` agent produces three variants from the same source data:

1. **Partner version** — the template above. 5-min read.
2. **Engineer version** — adds the technical "what got built" section. 10-min read. Goes to the builder + the consultant.
3. **All-hands version** — wider audience, drops the financial detail and the "decisions needed" section. Used for internal Slack posts to the broader team.
