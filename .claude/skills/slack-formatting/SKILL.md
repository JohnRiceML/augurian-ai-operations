---
name: slack-formatting
description: Slack message conventions for the Augur bot — character limits, threading, mrkdwn quirks, channel routing. Load when posting to Slack from any subagent.
---

# Slack formatting conventions for `@augur`

How the agent should write messages so they're useful and readable.

## Channel routing

| What you're posting | Where |
|---|---|
| Reply to an `@augur` mention | In the thread of the message that mentioned you. **Always thread.** |
| Daily audit summary | `#agent-activity` |
| Anomaly detection (one client) | `#client-{slug}` per `clients.yaml:slack_channel` |
| Cost alert / runaway warning | `#agent-activity` (cc the engineer in DM if severity is high) |
| New draft notification | `#client-{slug}`, with link to the Drive file |

Never DM clients. Never post in a channel the bot wasn't explicitly invited to.

## Length

- Slack message hard limit: **4,000 characters per message**.
- Practical limit for readability: **~600 characters in a channel**, **~1,500 in a thread**.
- For longer content (a full report draft summary): post a 3-line summary + a Drive link. **Don't paste the whole draft.**

## mrkdwn quirks

Slack's flavor of markdown is non-standard. Specifically:

- **Bold** is `*single asterisks*` not `**double**`.
- _Italic_ is `_underscores_`.
- `~strikethrough~` (single tilde, not double).
- Code: `` `inline` `` and triple-backtick blocks both work.
- Links: `<https://example.com|link text>` — pipe-delimited, NOT `[text](url)`.
- Bulleted lists: prefix with `• ` (real bullet character) or `- `. Nested bullets need real indentation (4 spaces), not tabs.
- Headings (`#`, `##`) don't render — use `*bold*` for emphasis instead.

## Formatting patterns

### Anomaly summary

```
*GSC daily check — Coborn's — 2026-04-30*

• Clicks for "weekly ad" query down 47% week-over-week (impressions stable). Likely SERP feature change.
• New top-10 query: "coborns curbside christmas" — 3,400 impressions this week.
• Page `/locations/sartell` lost average position 4.2 → 7.8 over the last 14 days.
```

### Draft notification

```
:memo: New monthly report draft for Theisen's: <https://docs.google.com/...|2026-04 monthly draft>

Headline: organic up 11% MoM, paid down 4% (intentional pacing pullback).

Reviewer: @{account-lead}
```

### Ad-hoc Slack reply (in thread)

```
You asked: how did paid do last week?

*Apr 21–27 vs Apr 14–20:*
• Spend $8,420 → $9,110 (+8%)
• Conversions 142 → 138 (−3%)
• CPA $59 → $66 (+12%)

The spend increase came from new "Spring Saver" campaign launched Apr 23. CPA elevation is consistent with a new campaign in learning phase. <https://docs.google.com/...|full data>
```

## Code blocks

When showing data tables, prefer Slack-format markdown over a triple-backtick block — backtick blocks render fixed-width but don't render bullets, links, or bold inside.

## Mentions

- `<@USERID>` mentions a person by Slack ID, not username.
- `<!channel>` pings everyone — use sparingly.
- `<!here>` pings active members. Use only for cost alerts and incidents.

## What NOT to do

- Don't post the full draft of a report into Slack. Link to the Drive file.
- Don't put confidential data (revenue numbers, client lists) in `#agent-activity`. Per-client channels only.
- Don't @-mention clients by name in shared channels.
- Don't use emoji to indicate state in a way that's load-bearing — colorblind-accessible cues only (`✓`, `✗`, `⚠`, plus text).
- Don't repost the same message if the first one didn't get a reaction. Slack's signal-to-noise is fragile.
