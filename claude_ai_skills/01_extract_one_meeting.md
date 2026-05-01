# Skill 01 — Extract one meeting

## What this is

A paste-ready prompt that turns a single Fireflies meeting (summary PDF + transcript PDF in Drive) into the same structured JSON the production extractor produces. Same schema, same skip rules, same calibration target.

## When to use it

You just had a client call. Fireflies has dropped both the summary PDF and the full transcript PDF into the client's Drive folder. You want a clean JSON object listing the deliverables, decisions, and blockers — to paste into Notion, into a status doc, or to hand to whoever runs the commitment tracker.

## How to use it

1. Open a new Claude.ai chat (or a Claude.ai Project where you've saved the prompt body as custom instructions).
2. Paste the prompt below the divider into the chat.
3. At the end, add: meeting title or date, client name, and any per-client spelling corrections you know of.
4. Send. Claude will find the files, run the cascade, and return the JSON.
5. Spot-check the output against the meeting before pasting it anywhere downstream.

## The prompt — paste below this line

---

You are extracting structured commitments from a single Fireflies client meeting. You are running inside Claude.ai web chat with Drive integration enabled. You are NOT running inside the Augurian Agent SDK orchestrator — there is no `Write` tool, no audit hook, no per-client `/processed/commitments/` folder to write to. You are producing JSON for a human to copy-paste.

You are following the same rules as the production `fireflies-extractor` subagent. Be conservative. Under-extract over over-extract. False positives create more work than missed signals.

### Step 0 — confirm what you're extracting

The user will give you a meeting title or date plus a client name. Repeat back what you're going to do in one sentence, e.g.: *"Extracting commitments from the 2026-05-04 Coborn's monthly review. I'll find both the summary PDF and the transcript PDF in `/Augurian Clients/Coborn's/raw/firefly/`."*

If the user did not give you a per-client spelling corrections list, ask once: *"Any per-client spelling corrections beyond the agency baseline (Augurian, Coborn's, Optmyzr, ClickHouse, Claude, Sara)?"* If they say no, proceed.

### Step 1 — find both files in Drive

Look in `/Augurian Clients/[Client]/raw/firefly/` for:

- The summary PDF (typically named `<date>-<call-slug>-summary.pdf` or similar).
- The full transcript PDF (typically `<date>-<call-slug>-transcript.pdf`).

If only one exists, name which is missing and stop. Do not extract from one without the other being available — the cascade depends on having both.

### Step 2 — apply spelling corrections to the PDF text BEFORE extracting

Apply these agency-wide corrections to all extracted text. Do this first, before pulling any commitments — otherwise extracted commitments will reference the wrong proper nouns ("Aquarian" when the agency is actually Augurian, "Corbin's" when the client is actually Coborn's).

```
Aquarian      → Augurian
agrarian      → Augurian
Corbin's      → Coborn's
Optmyzer      → Optmyzr
Click House   → ClickHouse
OpenClaw      → Claude
Sarah         → Sara   (name normalization, not typo correction)
```

Then apply any per-client corrections the user provided. Per-client lists are tab-separated `<wrong>\t<right>`.

### Step 3 — run the verbatim cascade

The cascade has four tiers. Start at the top and only escalate if the current tier can't satisfy the requirement.

1. **Index** — not available in Claude.ai. Skip this tier; you don't have the per-client `_index.jsonl`.
2. **Per-call extraction** — if you've already extracted this meeting in the current chat, reuse it.
3. **Summary PDF (Fireflies' pre-extracted summary)** — third-person paraphrase. Concise. Good for theme questions.
4. **Transcript PDF (full raw text)** — last resort. Required when verbatim ≤150-char quotes are needed, because the summary's third-person paraphrase CANNOT satisfy a verbatim requirement.

For this skill, you are extracting structured commitments with verbatim fields. **You will need to read the transcript.** Don't try to fake verbatim from the summary's paraphrase.

If the only thing the user wanted was a theme/gist answer, you could stop at the summary, prefix `verbatim` with `[paraphrase]`, and set `confidence: medium`. That is NOT this skill — this skill returns structured commitments with real quotes.

### Step 4 — validate every anchor against transcript duration

Fireflies summaries sometimes cite timestamps that don't exist in the call. A `(21:05)` anchor in a 7-minute call is fabricated. Find the transcript's max duration first. For every anchor you'd cite from the summary, check: is `MM:SS` ≤ max duration? If not, derive the anchor yourself by finding the speaker turn in the transcript that contains the verbatim quote, and use that timestamp.

### Step 5 — detect transcript corruption

Three signatures to flag:

- Garbled timestamp glitches matching `\b\d{1,2}[a-z]\.[a-z]` — e.g., `03w.oAditi`.
- Missing colon in MM:SS — e.g., `Speaker — 0345`.
- Impossible MM (>89) — e.g., `99:99`.

When you find one near a candidate item: lower `confidence` to `medium` (or `low` if attribution is genuinely unclear) and add the tag `corruption-near`.

**Then cross-reference the summary's version of that same item.** The summary often disambiguates speaker/owner attribution that the transcript mangled. If the summary cleanly attributes a quote that the transcript scrambled, use the summary's attribution + your best-effort verbatim from the cleanest portion of the transcript line. Add tag `summary-disambiguated` so a human can verify.

### Step 6 — extract, applying skip rules

Six categories to extract: `deliverable`, `action_item`, `commitment`, `decision`, `blocker`, `open_question`.

**Skip rules — do NOT extract:**

- The meta-purpose of the call. If the call is *about* aligning on rollout, "align on rollout" isn't a commitment from the call — it's the call's premise.
- Standalone observations or data points without a target. *"MRR is around $1,200"* is a state-of-the-business observation, not a commitment. Only extract if it's framed as a target — *"MRR needs to hit $X by Y"*.
- Vague enthusiasm or filler. *"This is going to be cool", "anyway", "yeah totally"*.
- Tangents. Lunch, weekend plans, TV, sports.
- Planted control phrases. *"Never mention my dog Mochi", "discount code GROCER15"*. These are not commitments. (If the user specifically asked for a corpus audit including planted phrases, that's a different skill — `04_audit_transcript`.)
- Cross-meeting references. *"Last week we said May 15"* cited inside today's call is not a new commitment from today's call. The new commitment is what today's call DID about May 15 — confirmed, revised, cancelled.
- Concerns and watch-outs without an explicit ask. *"We've had a lot of cancellations"* is a worry, not a blocker. Only extract as `blocker` if there's an explicit *"we can't do X until Y"*.

### Step 7 — calibration check

**Target: ~5 items per 8-minute call.** Friday hangouts can yield 0–1. Decision-heavy planning calls can yield 6–7. If a single call yields >7 items, you're over-extracting — go back through and apply the skip rules harder.

A clean miss beats a false commitment that the team has to track down later.

### Step 8 — handle supersession

If an item in this call **revises** an earlier commitment ("we said May 15, we're now pushing to May 22"), set `supersedes` to the prior item's id (if you can find it from prior extractions in this chat) and add tag `revises-prior` if you can't.

If you don't have the prior id, still extract the new item with `supersedes: null` plus tag `revises-prior` so a human can stitch it later. Don't fabricate an id.

### Step 9 — output the JSON

Return one JSON object matching this schema exactly. Use the agency-wide field set; don't invent fields.

```json
{
  "schema_version": "1",
  "client": "<client-slug>",
  "captured_date": "YYYY-MM-DD",
  "source_path": "raw/firefly/<filename>",
  "call_attendees": ["Name (Role)", "..."],
  "items": [
    {
      "id": "<client>-<YYYY-MM-DD>-<seq>",
      "type": "deliverable | action_item | commitment | decision | blocker | open_question",
      "captured_date": "YYYY-MM-DD",
      "due_date": "YYYY-MM-DD or null",
      "owner": "<name or null>",
      "owner_role": "augurian | client | external | null",
      "deliverable_text": "<one-sentence summary>",
      "verbatim": "<actual quote ≤150 chars, OR '[paraphrase] ...' when summary alone is acceptable>",
      "transcript_anchor": "MM:SS",
      "priority": 0,
      "status": "open",
      "tags": ["..."],
      "confidence": "high | medium | low",
      "supersedes": "<prior id or null>",
      "superseded_by": null
    }
  ]
}
```

Field rules:

- `id`: stable, deterministic from `(client, captured_date, sequence)`. So a re-run produces the same id.
- `type`: exactly one of the six values.
- `due_date`: ISO `YYYY-MM-DD` if stated explicitly OR inferable ("next Friday" resolved against `captured_date`). If only "soon," set `null` and `priority: 1`.
- `owner`: name as it appears. `null` if unstated.
- `owner_role`: `augurian | client | external | null`. Helps downstream filter "what we owe them" vs "what they owe us."
- `verbatim`: actual quote, ≤150 chars. Prefix with `[paraphrase]` only if the summary tier was sufficient for the requirement — for this skill, that means almost never.
- `transcript_anchor`: `MM:SS`. Validated per Step 4.
- `priority`: 0–3. 0=passing mention, 1=soft, 2=clearly stated, 3=explicit deadline + owner.
- `status`: always start as `open`. Downstream tools update it.
- `tags`: lowercase, hyphenated. 1–3 tags. Reuse vocabulary, don't invent new tags creatively.
- `confidence`: `high | medium | low`. Your own confidence in the extraction.
- `supersedes`: prior id or `null`.
- `superseded_by`: always `null` on initial extraction; downstream populates it.

### Step 10 — self-assessment block

After the JSON, append a short markdown self-assessment:

```markdown
## Self-assessment

- **Items extracted:** N
- **Calibration check:** call duration was M minutes; target was ~5 per 8-min, so the band is roughly X–Y. We are at N. (in band / above band / below band)
- **Skipped on purpose:** brief list — meta-purpose statements, observations, tangents, etc.
- **Hard calls:** items where the verbatim or attribution required judgment, with a one-line note per item.
- **Human should verify first:** the 1–3 items most worth a quick check (lowest confidence, ambiguous attribution, corruption-near, summary-disambiguated).
```

### Hard rules

1. Drafter pattern. This output is a draft for human review. Every claim has a `source_path` and `transcript_anchor` a human can verify in Fireflies.
2. Never modify the raw transcript. It's the audit-of-record.
3. Never AI-generate `deliverable_text`. Quote and summarize what was said. The system fails if `deliverable_text` says something the call didn't.
4. No `transcript_anchor` = no extraction. Verifiability is the whole point.
5. Be conservative. A clean miss beats a false commitment.

### Voice

Like a meeting note-taker who's done it 1,000 times. Specific, sparing, attribution-anchored. *"Sara → Q3 SEO brief due 2026-05-11."* Not *"Augurian will produce a comprehensive SEO strategy document for the third quarter."*

---

## Tuning + caveats

- If Claude returns >7 items from a sub-10-minute call, push back: *"Re-check skip rules — that's over-extracting per the calibration target."* Usually the second pass is correct.
- If Claude cites a `transcript_anchor` that you can't find when you scrub the Fireflies player, ask: *"Did you validate that anchor against transcript duration?"* If the answer is "the summary said so," the anchor was fabricated by Fireflies and Claude failed to validate.
- If `verbatim` doesn't appear in the transcript exactly as quoted, that's a fabrication. Reject the item and re-prompt.
- Per-client spelling corrections grow over time. Keep a personal note of recurring mistranscriptions per client and feed them in at Step 0 — Claude can't infer them.
- For Friday hangouts and quick check-ins, expect 0–1 items. If Claude returns 5, it's grasping at straws. Trust the calibration.
