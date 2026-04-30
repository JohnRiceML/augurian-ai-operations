# KPI playbook

How Augurian measures whether this project is working. Three categories: adoption, output quality, and cost. Each has primary metrics (the thing) and secondary metrics (the early-warning signals).

## The two questions that ultimately matter

1. **Did the team use it for real client work?** (Adoption.)
2. **Were the outputs good enough that someone shipped them after editing?** (Quality.)

Everything else is supporting detail. If those two are healthy, the project is working — even if costs are above target. If either one is unhealthy, it doesn't matter how cheap the system is.

## Category 1: Adoption

The risk the playbook calls out as biggest. Track weekly.

### Primary

| Metric | Target by end of Q2 | How to measure |
|---|---|---|
| Unique team members who used `@augur` in the last 7 days | ≥ 4 | Audit logs (count distinct user IDs) |
| Tasks per week (drafts + ad-hoc) | ≥ 25 across two clients | Audit logs |
| Tasks initiated by someone who isn't the engineer | ≥ 80% of total | Audit logs (filter on user role) |

### Secondary (early warning)

| Metric | Healthy | Investigate when |
|---|---|---|
| Days since last `@augur` use | ≤ 2 | ≥ 5 — adoption is decaying |
| Repeat usage rate (people who use it twice or more) | ≥ 70% | < 50% — first impression is bad |
| Unique subagents invoked per week | ≥ 3 of 5 | ≤ 2 — usage is narrowing |

## Category 2: Output quality

### Primary

| Metric | Target | How to measure |
|---|---|---|
| Account lead edit rate per draft | trending down month over month | Manual: lead notes "% of draft kept as-is" on each review |
| Drafts shipped to clients (after edits) per total drafts | ≥ 60% by end of Q2 | Reviewer's note in `#client-{slug}` thread |
| Anomaly detection precision | ≥ 70% by end of Phase 4 | Mark each flagged anomaly as real/noise/missed; track the ratio |

The edit-rate metric is qualitative but vital. Reviewers should habitually note "kept ~80% as-is," "had to rewrite the headline," "removed three claims" — short tags, not essays. The `report-reviewer` subagent collects these into a rolling weekly view.

### Secondary

| Metric | Healthy | Investigate when |
|---|---|---|
| Same correction made on multiple drafts | Decreasing | Same fix every week — context file needs an update |
| Reviewer time per draft | < 30 min for monthly | > 1 hour — draft quality is too low |
| Anomaly false-positive rate | < 30% | > 50% — alert fatigue brewing |

## Category 3: Cost

### Primary

| Metric | Q2 budget | Healthy |
|---|---|---|
| Anthropic API spend / month | $200–250 | within budget, with variance < ±25% week to week |
| GCP spend / month | ~$17 | within budget |
| **Cost per shipped deliverable** | < $5 (monthly report); < $0.50 (daily anomaly check); < $0.10 (ad-hoc Q&A) | Trending down or flat |

The third one — cost per shipped deliverable — is the most important cost metric. Total spend can grow if usage grows; per-deliverable cost should shrink as caching matures.

### Secondary

| Metric | Healthy | Investigate when |
|---|---|---|
| Cache hit rate on the monthly drafter | > 80% on second-and-later runs | < 60% — silent cache invalidator (date in prompt, varying tools, etc.) |
| Single-task token spike events / week | < 1 | ≥ 2 — investigate per-task budgets |
| Per-client daily spend variance | low | high — runaway-loop risk |

## How the metrics get collected

Most are read directly from per-client audit logs. The `cost-monitor` subagent computes the spend metrics weekly. Edit-rate comes from reviewer tags. Anomaly-precision comes from the rolling annotation file at `/audit/anomalies/`.

The `kpi-tracker` subagent assembles all of these into the weekly leadership brief.

## What we do NOT measure

Worth naming, because they're tempting traps:

- **Latency.** Doesn't matter for our use case. A monthly report drafted in 2 minutes vs 2 hours doesn't change the workflow.
- **Lines of code in the orchestrator.** Wrong proxy for anything that matters.
- **Number of subagents created.** More isn't better.
- **Number of features shipped.** The playbook explicitly underscopes Q2; shipping fewer features is the goal.
- **Vanity AI metrics** — model accuracy benchmarks, BLEU scores, embedding-space measurements. The right test is "would the account lead have written something close to this?"

## When a metric goes red

For any primary metric that goes red:

1. **Don't panic.** Two weeks of bad numbers can be noise. Three is a trend.
2. **Ask why.** The metric isn't the problem; the underlying issue is.
3. **Match the response to the metric:**
   - Adoption red → revisit Phase 2 pairing; was the account lead actually using it for a real task, or just demos?
   - Quality red → the context file is stale, or the system prompt needs tuning. Run a `context-coach` session.
   - Cost red → caching is broken, or someone enabled a daily-running task without a budget.
4. **Surface in the next leadership brief.** Don't hide it.

## End-of-Q2 scorecard

If by end of Q2:

- ✓ ≥ 4 unique users in the last week
- ✓ ≥ 25 tasks/week
- ✓ ≥ 60% of drafts shipped
- ✓ Cost per deliverable trending down
- ✓ The team would complain if you turned it off

→ The project is a success. Decide what to add in Q3.

If any two of those are missing → it's a research project, not a production tool. **Decide explicitly:** invest more in adoption, scale back, or shut down. Don't drift.
