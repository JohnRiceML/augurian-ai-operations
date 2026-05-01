# Claude.ai Skills for Augurian Account Leads

Paste-ready prompts for Claude.ai web chat. No code, no repo, no terminal — pick a skill, paste it into a fresh chat (or save it as a Claude.ai Project's custom instructions), and let Claude do the work against the client's Drive folder.

## Prerequisite

Claude.ai Drive integration enabled for your account, with access to the relevant client's `/Augurian Clients/[Client]/` folder. If you can't see the folder when you ask Claude to list it, stop and get IT to fix the integration before going further. The skills assume Drive is reachable.

## The four skills

| File | Use when… | Output |
|---|---|---|
| [`01_extract_one_meeting.md`](01_extract_one_meeting.md) | You just had a client call and want structured commitments for tracking. | One JSON object matching the production schema. |
| [`02_query_meetings.md`](02_query_meetings.md) | You need to answer a question across many meetings ("what's overdue with Coborn's?", "what did we decide about the Pinterest pilot?"). | Markdown answer with citations and transcript anchors. |
| [`03_draft_status_report.md`](03_draft_status_report.md) | You're prepping for a status meeting and want a one-pager covering a date range. | Markdown status report — drafter pattern, human review required before sending. |
| [`04_audit_transcript.md`](04_audit_transcript.md) | A transcript "looks weird" and you want a sanity check before letting it feed downstream automation. | Audit report flagging mistranscriptions, corruption, and summary/transcript mismatches. |

## Two ways to use these

**A. Paste-into-chat (one-off).** Open a new Claude.ai chat. Copy everything below the `## The prompt — paste below this line` divider in the relevant skill file. Paste it as the first message. Add your specific input (meeting title, client name, question, etc.) at the end. Send.

**B. Save-as-Project (repeat use).** In Claude.ai, create a Project per skill (or one Project covering all four with a router instruction at the top). Paste the prompt body into the Project's custom instructions. Now every chat in that Project starts pre-loaded — you only paste the specific input.

For account leads who run the same workflow multiple times a week, option B is worth the 5 minutes of setup.

## What the skills bake in (and why)

These four prompts enforce the same rules as the production `fireflies-extractor` subagent in this repo. Specifically:

- **The schema.** Same field set, same types, same `id` convention as `.claude/agents/fireflies-extractor.md`.
- **The verbatim cascade.** Index → per-call extraction → summary → full transcript. Escalate only when the lower tier can't satisfy the requirement. Summary is third-person paraphrase, so it cannot satisfy a verbatim ≤150-char ask — that forces a transcript read.
- **Anchor validation.** Fireflies summaries sometimes cite timestamps that don't exist in the call (a `(21:05)` anchor in a 7-minute meeting). Every anchor gets cross-checked against transcript duration.
- **Spelling corrections, applied before extraction.** Agency-wide list (Augurian, Coborn's, Optmyzr, ClickHouse, Claude, Sara) plus per-client supplements when the user provides them. Apply the corrections to the PDF text first, then extract — otherwise commitments end up referencing the wrong proper nouns.
- **Skip rules.** Meta-purpose of the call, standalone observations, vague enthusiasm, tangents, control phrases ("never mention my dog Mochi"), cross-meeting references that aren't new commitments, and concerns without an explicit ask all get filtered out.
- **Calibration target.** ~5 items per 8-minute call. Friday hangouts can be 0–1. Decision-heavy planning calls can be 6–7. >7 from a single call means you're over-extracting.
- **Corruption detection.** Three signatures get flagged: garbled timestamp glitches (`03w.oAditi`), missing colons in MM:SS, impossible MM (>89). When found, confidence drops and the summary gets cross-referenced for clean attribution.
- **Supersession.** When a later meeting revises an earlier commitment (May 15 → May 22), both surface and the earlier one is marked superseded. Queries hide superseded items by default.
- **Drafter pattern.** Every output is a draft for human review. Every claim cites a `source_path` and `transcript_anchor`. Nothing is presented as authoritative without something a human can verify.

If a skill ever produces output that looks like it broke one of these rules — re-read the prompt, find the violated rule, and tell Claude. The skills are written to self-correct when the rule is named.

## Voice

The skills use the same direct, attribution-anchored voice as the production subagents. No marketing language. No hedging when the evidence is clear. Concise paraphrase + verbatim quote when the verbatim matters, paraphrase alone when only the gist matters (with `[paraphrase]` prefix and lower confidence).

## When a skill isn't enough

If you find yourself fighting the prompt — re-prompting it three times to get the right output, or it keeps citing the wrong meeting — the workflow may need to graduate to a production subagent. Surface it to the engineering team. The skills are deliberately limited to what one Claude.ai chat can do without orchestration.
