# Training guide

For Augurian team members who'll use Augur on a real client account. Mostly account leads, paid specialists, and SEO specialists.

Time budget: 30 minutes to read, 2 hours to write your first context file, ~1 hour pairing with the engineer.

## Before you start

Read first:
1. [`FOR_NON_TECHNICAL_READERS.md`](./FOR_NON_TECHNICAL_READERS.md) — overview, terms.
2. [`GLOSSARY.md`](./GLOSSARY.md) — keep open in another tab.

Have these ready:
- Your client's GA4 admin access (you'll need to add a service account email).
- 2 uninterrupted hours, on the calendar, for the context-file interview.
- A draft of your last monthly report for this client (the agent will use it as a style reference).

## What Augur is good at

These tasks are a good fit. The agent will earn its keep here:

| Task | What you do | What Augur does |
|---|---|---|
| Drafting a monthly performance report | Review the draft, edit, send | Reads `/processed/` data, drafts the headline + bullets + appendix tables |
| Spotting anomalies in Search Console | Check the daily Slack post; intervene if real | Compares last 7 days to a 28-day baseline; flags meaningful changes |
| Triaging Optmyzr recommendations | Approve or override | Goes through open recommendations, suggests accept/reject/defer with rationale |
| Answering ad-hoc data questions | Ask in Slack | Reads the right `/processed/` files, answers with numbers and a comparison |
| Drafting content briefs | Edit the brief, hand to the writer | Pulls GSC data, identifies opportunities, structures a brief |
| Drafting RSA ad copy | Pick a variant, ship it | Generates 3 variants per campaign with rationale |

## What Augur is bad at

Don't use it for these — it'll either fail or burn time:

- **Strategy questions.** "Should we increase the budget on Coborn's?" requires judgment Augur doesn't have.
- **Client communication.** Augur drafts, you write the email.
- **Real-time pivots.** "Live event at 3pm, what should we do" — too contextual, too many unwritten constraints.
- **Anything where the data is in someone's head.** If it's not in `/processed/`, Augur doesn't know.
- **Quick lookups.** "What was sessions on April 4?" is faster in the GA4 UI than in Slack.

## Step 1: Write the context file (the highest-leverage 2 hours)

Open `context_templates/client_context_template.md`. The `context-coach` subagent walks you through it as an interview — recommended.

The template covers:
- Who the client is (in your words)
- Their goal in plain English (what does success this quarter mean?)
- Voice and tone — adjectives and example phrases
- What they care about most / least
- Hard rules (things never to do)
- Approved claims (things the agent can use in copy)
- Disclosure stance (does the client know AI is in the loop?)

**Two hours. Calendar it.** The system gets dramatically better with a good context file and stays generic without one. AI-generating it defeats the entire purpose.

## Step 2: Pair with the engineer (first draft session)

Once technical Phase 2 is live, schedule one hour with the engineer. They will:

1. Run the monthly drafter against your client's most recent month.
2. Show you the draft.
3. Sit there while you mark every line you'd change.

Your job: **don't be polite**. The first draft will be 60% right and 40% needs work. Telling the engineer "looks great!" wastes the most valuable feedback hour in the project.

For each thing you'd change, the engineer either:
- Edits the system prompt for that subagent, or
- Updates the `/context/client_context.md`, or
- Notes it as a known limitation.

After ~5 iterations, the next draft will be noticeably better.

## Step 3: Use it for one real task in week 1

Within 7 days of pairing, use Augur on a real client task — not a demo. Examples:

- Ask `@augur` in `#client-{slug}`: "summarize last week's performance for the client check-in tomorrow."
- Have it draft a section of your monthly report you'd otherwise be writing tonight.
- Run a one-off Optmyzr triage you'd otherwise put off.

The point isn't to replace your work; it's to find out what the agent's actually for. After one real-task use, you'll know.

## How to ask good questions in Slack

The agent does best when:

- **You name the time period.** "Last week" beats "recently."
- **You name the channel** (e.g., "organic" vs "paid"). Augur defaults to all channels.
- **You say what you'll do with the answer.** "I'm writing the client check-in" tells Augur to format for that.
- **You include a "compared to what."** "Sessions last week vs same week last year" beats "how were sessions last week."

Bad: "How's Coborn's doing?"
Better: "How did Coborn's organic search perform April 21–27 vs April 14–20? I need numbers for tomorrow's status."

## When the agent is wrong

It will be, sometimes. Three response patterns:

### "The number is wrong"

- Check the date range it used (Augur should restate the question — read that line).
- Check which channel it filtered to.
- If genuinely wrong: tell the engineer + add to a "tune the system prompt" backlog.

### "The voice is off"

- The context file probably doesn't capture this voice nuance yet.
- Add the missing detail to `/context/client_context.md`. Next draft will be better.

### "It's making stuff up"

- Rare on factual questions if the data exists. If it's happening, the data probably *doesn't* exist (puller failed, file is empty).
- Ask Augur "what data did you use?" — the audit log will say.
- Tell the engineer.

## When NOT to use the agent

Sometimes the answer is "do it yourself." Specifically:

- The task takes <5 minutes by hand. Don't pay setup cost for trivial work.
- The task involves judgment about a relationship. "How do we tell Coborn's about this drop?" is yours.
- The data isn't in `/processed/` yet. (Check `#agent-activity` for the daily pull status.)
- It's after-hours and you're tired. The agent is fine; tired-you reviewing the agent's draft isn't. Save it for morning.

## What to ask if you're stuck

The dev-helper subagents are designed to answer:

- `ai-literacy-coach` — "What can Augur do? What's an MCP? How do I…?"
- `context-coach` — "Help me write or update my client_context.md."
- `audit-reviewer` — "What did Augur do for Coborn's yesterday?"

Or just message the engineer or the consultant in `#agent-activity`.

## A note on AI literacy

If this is your first time using an AI tool at work, two things to know:

1. **It's a draft.** Always. Treat anything Augur produces as a junior staffer's first attempt. Editing is your job.
2. **It doesn't learn from you between conversations** (in this implementation). The way to make it better is to update the context file or tell the engineer to tune the system prompt — not to repeatedly correct it in chat. Corrections in chat are forgotten when the next task starts.

That's the model. Once those two things click, everything else makes sense.
