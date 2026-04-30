---
name: fireflies-extraction-rules
description: What to extract from Fireflies call transcripts and what to ignore. Load when processing any /raw/firefly/ file. Conservative bias — under-extract over over-extract.
---

# Fireflies extraction rules

The whole system fails if extracted commitments include things that weren't said. Better to miss a soft commitment than fabricate a hard one.

## Six extraction types

| Type | Trigger language | Examples |
|---|---|---|
| **deliverable** | "I'll have / We'll send / We'll deliver / We'll get you" + a thing + (optionally) a date | "I'll have the Q3 brief over to you by Friday." |
| **action_item** | "{Name}, can you / will you / could you" + a verb + an object | "Sarah, can you pull the GSC data?" |
| **commitment** | "We'll keep / We're committing to / We're going to" — a constraint or stance over a duration | "We'll hold paid spend flat through May." |
| **decision** | "OK we're going with / Let's do / I think we're decided on" | "OK we're going with the green hero." |
| **blocker** | "We can't until / We're waiting on / Blocked by" | "Can't launch until legal signs off." |
| **open_question** | "Still TBD / Not sure / We need to figure out" | "Still TBD on whether to expand to YouTube." |

## When NOT to extract

Even when language suggests an item, skip when:

- **Conditional / hypothetical.** "If X happens, we might…" — not a commitment.
- **Past-tense recap.** "We talked about doing X last quarter" — unless re-affirmed.
- **Tentative musing.** "Maybe we could…", "what if we…" — not commitments.
- **Sales/buyer chitchat.** "Yeah we should jump on a call sometime soon."
- **Internal Augurian banter** during a client call. (e.g., one Augurian person to another, "I'll grab you a coffee after.")
- **Repeated commitments.** If the same item was committed in a prior call, don't re-extract; the original stands.

## How to resolve dates

Fireflies transcripts include the call date. Resolve relative dates against it:

| Said | Resolved as |
|---|---|
| "by Friday" | The next Friday after `captured_date`. |
| "next Friday" | The Friday after the next ~7 days (so usually 7–14 days out). |
| "next week" | Following Monday's date. |
| "end of month" | Last day of the call's month. |
| "next month" | First day of the next month — flag in the answer that this is approximate. |
| "soon" / "shortly" | `due_date: null`, `priority: 1`. |
| "quickly" / "ASAP" | `due_date: null`, `priority: 2`. (Yes, "ASAP" is a soft constraint.) |

When in doubt: leave `due_date: null`, set `priority: 1`, let a human disambiguate.

## How to identify owners

Owner is whoever said "I'll" / whoever was asked "can you" / whoever was named.

- **First-person from an Augurian person** → `owner_role: augurian`, name as said.
- **First-person from a client person** → `owner_role: client`.
- **Named third party** → `owner_role: external`.
- **No clear owner** → `owner: null`, `owner_role: null`. Flag with `confidence: low`.

If the call attendees aren't clearly labeled in the transcript, default to `null` and lower confidence.

## Priority scale

| Priority | Meaning | Examples |
|---|---|---|
| 0 | Passing mention | "We should think about Y at some point." |
| 1 | Soft commitment, no explicit deadline | "We'll get you something on this." |
| 2 | Clear commitment | "I'll send the brief by next Friday." |
| 3 | Hard commitment + owner + deadline + stakes | "I'll have the launch plan to you by Monday EOD or we delay launch." |

If you'd extract priority 0, ask yourself: would a human want this in the index? If no — don't extract.

## Tags vocabulary

Reuse over creativity. Prefer short, hyphenated, lowercase. Augurian's vocabulary so far:

```
seo, paid, organic, content, technical, audit, brief, copy,
monthly-report, quarterly-planning, annual-strategy,
launch, redesign, migration, audit-prep,
budget, pacing, optimization, anomaly,
blocker, escalation, legal, compliance,
status-meeting, kickoff, onboarding, handoff
```

Use 1–3 tags per item. If nothing fits, leave empty (`[]`). Don't invent a one-off tag.

## Confidence

| Confidence | When |
|---|---|
| `high` | Direct quote, clear owner, clear deadline, unambiguous type. |
| `medium` | Owner OR deadline missing. Or paraphrased context needed. |
| `low` | Ambiguous type. Owner inferred. Date inferred from vague phrasing. |

Most items end up `medium`. `high` should be ~30%. If everything is `high`, you're being overconfident; if everything is `low`, the source quality is bad and the engineer should investigate.

## What gets redacted in `verbatim`

Pass the verbatim through `pii-redaction` rules:

- Phone numbers, emails, SSNs (regex)
- Per-client redaction list (`/context/redaction_list.txt`)
- Customer names mentioned in the call (NOT Augurian/client staff — them you keep)

If after redaction the verbatim is mostly `[REDACTED]`, set `confidence: low` and flag for human review — the call may have been about a specific customer issue that the agent should hand off rather than extract.

## When the transcript quality is bad

Fireflies transcription quality varies. If you encounter:

- Heavy speaker mis-attribution (the same person labeled three different ways) → set all items to `confidence: low`, flag in the per-call JSON's `notes` field.
- Significant `[INAUDIBLE]` or `[UNINTELLIGIBLE]` markers → don't extract from those segments.
- A short transcript (<5 minutes) — possibly a partial recording → flag, extract only what's clearly stated.

## Schema versioning

The output schema is `schema_version: "1"`. If the schema evolves, the field stays — don't try to upgrade old records in place. The drive-data-architect agent decides when to rev the schema and how to migrate.
