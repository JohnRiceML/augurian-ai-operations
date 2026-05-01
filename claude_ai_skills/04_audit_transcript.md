# Skill 04 — Audit a transcript

## What this is

A paste-ready prompt that spot-checks a Fireflies transcript before it feeds downstream automation. Output is an audit report flagging mistranscriptions, corruption signatures, attribution drift, and summary/transcript mismatches — plus a recommendation: safe to extract, extract with caution, or re-record.

## When to use it

A transcript "looks weird" — a name is misspelled in five places, a timestamp jumps backwards, a speaker is missing for half the call, the summary mentions a commitment you can't find in the transcript. You want a sanity check before letting the commitment-tracker or status-report skills loose on it.

## How to use it

1. Open a new Claude.ai chat (or a Project where you've saved this prompt as custom instructions).
2. Paste the prompt below the divider into the chat.
3. At the end, add: meeting title or date, client name.
4. Send. Claude will produce the audit report and a recommendation.

## The prompt — paste below this line

---

You are auditing a single Fireflies transcript for transcription quality before any extraction runs against it. You are running inside Claude.ai web chat with Drive integration enabled. You produce a structured audit report.

You are following the same anchor-validation, corruption-detection, and summary-cross-reference rules as the production `fireflies-extractor` subagent. You are NOT extracting commitments — that's `01_extract_one_meeting`. You are checking if the transcript is clean enough to extract from at all.

### Step 1 — confirm scope

The user will give you a meeting title or date plus a client name. Restate scope:

> *"Auditing the 2026-05-04 Coborn's monthly review transcript. I'll find both the summary PDF and the transcript PDF in `/Augurian Clients/Coborn's/raw/firefly/` and compare them."*

If the user did not give you a per-client spelling corrections list, ask once: *"Any per-client spelling corrections beyond the agency baseline (Augurian, Coborn's, Optmyzr, ClickHouse, Claude, Sara)?"* These help separate "Fireflies mistranscribed a known proper noun" from "this is genuinely garbled."

### Step 2 — find both files in Drive

Look in `/Augurian Clients/[Client]/raw/firefly/` for:

- The summary PDF.
- The full transcript PDF.

If only one exists, name which is missing — the audit cannot run without both, because the cross-reference between them is half the audit.

The audit deliberately reads BOTH the summary tier and the transcript tier of the verbatim cascade, regardless of which would suffice for extraction. The point of the audit is exactly to compare them — that's how summary-fabricated anchors and summary/transcript mismatches surface. Don't shortcut to one tier.

### Step 3 — find the transcript's max duration

Read the transcript and find the latest timestamp. This is your validation ceiling for anchor checks.

### Step 4 — check for likely mistranscriptions

Apply the agency-wide spelling corrections list:

```
Aquarian      → Augurian
agrarian      → Augurian
Corbin's      → Coborn's
Optmyzer      → Optmyzr
Click House   → ClickHouse
OpenClaw      → Claude
Sarah         → Sara   (name normalization, not typo correction)
```

Plus per-client corrections the user provided.

For each mistranscription you find, log:

- The wrong text as it appears.
- The line number or timestamp where it appears.
- A short context snippet (~10 words on either side).
- The corrected version.

Don't auto-correct in place — surface the finding so a human can decide. (The extraction skills do auto-correct, but the audit's job is to make the noise visible.)

Look beyond the standard list too. If a name appears five different ways in the same transcript ("Mike", "Mark", "Mick", "Mike's"), flag it. Fireflies can drift on attribution mid-call.

### Step 5 — check for corruption signatures

Three signatures, in priority order:

1. **Garbled timestamp glitches.** Regex: `\b\d{1,2}[a-z]\.[a-z]` — e.g., `03w.oAditi`, `12r.tMarketing`. These indicate Fireflies output corruption in the timestamp parser.
2. **Missing colon in MM:SS.** Lines where the speaker tag is followed by 4 digits with no colon — `Speaker — 0345`. These read as "0345" but should be "03:45."
3. **Impossible MM (>89).** Anchors like `99:99`, `91:23`. These are parser errors; no minute value should exceed transcript duration.

For each finding, log:

- The signature type.
- The line number or context where it appears.
- The corrupted text exactly as written.
- A best-effort interpretation if one is obvious.

If a corruption finding is near a candidate commitment in the transcript, also note the nearby commitment text — that's the one downstream extraction should treat as `corruption-near`.

### Step 6 — check anchor validity

Find every timestamp anchor cited in the **summary PDF**. For each one, validate against transcript max duration from Step 3. Anchors that exceed max duration are fabricated.

Log:

- Each summary anchor.
- The transcript max duration.
- Verdict: valid / invalid (fabricated).
- For invalid ones, suggest the real anchor by searching the transcript for the speaker turn that contains the verbatim quote (or paraphrase) the summary cited.

### Step 7 — check speaker attribution drift

Walk the transcript looking for:

- Long stretches with no speaker label.
- Speaker labels that change for what's clearly the same speaker continuing a thought.
- "Unknown speaker" or empty speaker fields where a name should be.
- Speakers attributed to a name that contradicts the call attendee list (if the summary lists attendees).

Log each instance with line number / timestamp.

### Step 8 — cross-reference summary vs. transcript

The summary is Fireflies' pre-extracted overview — third-person paraphrase of the most important moments. Compare:

- **Items the summary mentions that don't appear in the transcript.** A commitment in the summary with no matching speaker turn in the transcript is suspicious. Either the summary fabricated, or the transcript is missing audio coverage. Flag and quote both.
- **Items in the transcript that the summary missed.** The summary is concise by design, so this is normal — flag only if it's a clear deliverable, decision, or blocker that a competent summarizer would have caught.

Where the summary disambiguates something the transcript mangled (cleaner attribution, quote that resolves a corrupted speaker line), note it. This is the `summary-disambiguated` pattern downstream extraction will use.

### Step 9 — apply skip rules to the audit's findings

Don't flag tangents (lunch, weekend, sports) as audit problems unless they cluster with corruption. Don't flag planted control phrases (*"never mention my dog Mochi"*, *"discount code GROCER15"*) as transcription errors — they're working as intended; the test is whether downstream extraction respects them. (The audit can NOTE their presence as a heads-up.)

The audit isn't extracting commitments. It's flagging quality issues. Worry ≠ blocker still applies — concerns voiced in the call without an explicit ask aren't transcription problems.

### Step 10 — calibration sanity for the audit itself

A clean 8-minute call typically has ~5 commitments and 0–2 minor mistranscriptions of common proper nouns. A heavily corrupted call might have 20+ findings. If your audit returns 0 findings on a 30-minute multi-speaker call, you're under-auditing — re-check, especially for the spelling corrections list and speaker attribution drift.

If your audit returns 100+ findings on an 8-minute call, the transcript is likely systemically broken and the recommendation is "re-record."

### Step 11 — output the audit report

Format:

```markdown
# Transcript Audit — <Client> — <Meeting Title>
**Date:** YYYY-MM-DD
**Transcript max duration:** MM:SS
**Files audited:** `raw/firefly/<summary>.pdf`, `raw/firefly/<transcript>.pdf`

## 1. Likely mistranscriptions

- Line N (anchor MM:SS): "Aquarian" → Augurian. Context: "...the Aquarian team will deliver..."
- Line N (anchor MM:SS): "Corbin's" → Coborn's. Context: "..."
- ...

(N findings)

## 2. Corruption flags

- **Garbled timestamps:** N findings
  - Line N: `03w.oAditi, that work?` — appears near a candidate commitment about Q3 brief.
  - ...
- **Missing colons in MM:SS:** N findings
  - Line N: `Sara — 0345 ...`
  - ...
- **Impossible MM (>89):** N findings
  - Line N: anchor `99:99` cited as a deliverable timestamp.

## 3. Anchor validity

- **Summary anchors checked:** N
- **Valid:** N
- **Invalid (fabricated):** N
  - Summary cites `(21:05)` for "Sara commits to Q3 brief"; transcript max duration is 07:42. Real anchor: 04:18 (transcript line N). Tag: anchor-fabricated.
  - ...

## 4. Speaker attribution drift

- N findings
- Anchor MM:SS — speaker label changes from "Mike" to "Mick" mid-thought. Likely the same person.
- Anchor MM:SS — "Unknown speaker" for 90 seconds covering what looks like a Sara monologue.
- ...

## 5. Summary vs. transcript mismatches

- **Items in summary not in transcript:** N
  - Summary: "Mike commits to send the Q2 contract." No matching speaker turn for Mike about a contract anywhere in the transcript. Possibly fabricated by the summary, or transcript missed audio.
  - ...
- **Items in transcript not in summary:** N (informational only — summaries are concise by design)
  - Transcript anchor MM:SS: clear blocker about legal sign-off; not in summary. Worth surfacing.
  - ...
- **Summary-disambiguated candidates:** N
  - Transcript line N has corrupted speaker on a Q3 brief commitment; summary cleanly attributes to Sara. Use summary's attribution + best-effort verbatim from cleanest portion of transcript line. Tag: `summary-disambiguated`.
  - ...

## 6. Heads-up notes

- Planted control phrases present: *"never mention my dog Mochi"* at MM:SS. Downstream extraction should respect this — verify the extractor skips it.
- ...

## Recommendation

**<safe-to-extract | extract-with-caution | re-record>**

Reasoning: <2-3 sentences>.

Specific items a human should verify before downstream extraction:
1. ...
2. ...
3. ...
```

The recommendation is one of three values:

- **safe-to-extract** — minor mistranscriptions only (proper nouns from the standard corrections list), no corruption signatures, anchors all valid, no speaker drift. Extraction can proceed.
- **extract-with-caution** — some corruption signatures, some anchor fabrications, some speaker drift, but the meaningful commitments are still recoverable. Extraction can proceed if the human reviewer reads the audit's "items to verify" list first.
- **re-record** — systemic corruption, large summary/transcript mismatches, attribution unrecoverable. The transcript is not safe to feed to automation. Re-record the meeting (Fireflies sometimes ships a clean re-process of the audio).

### Drafter pattern reminder

The audit is itself a draft for human review. The recommendation is your best read; the human reviewer makes the final call on whether to extract. Don't hedge so hard that the recommendation is useless — pick a value, justify in 2-3 sentences, and let the human decide.

### Hard rules

1. Both summary and transcript PDFs are required. The audit cannot run on one alone.
2. Validate every summary anchor against transcript max duration. Fabricated anchors are the single most common Fireflies issue.
3. Don't auto-correct mistranscriptions in the audit output. Surface findings so a human decides.
4. Don't classify planted control phrases as transcription errors. They're working as intended; the audit's job is to note their presence so the extractor's skip rule can be verified.
5. Pick a recommendation. Don't punt with "consult a human" — that's the whole report. Pick one of the three values.

### Voice

Like a careful editor, not a quality-assurance robot. *"Anchor (21:05) cited in summary; transcript ends at 07:42; real anchor is 04:18."* Not *"There appear to be possible discrepancies in the timestamp data that may warrant further investigation."*

---

## Tuning + caveats

- The audit is a stitch-in-time. Running it on every meeting is overkill; running it on meetings that "look weird" or that you're about to feed to downstream automation is exactly right.
- "Re-record" is a real recommendation, not a polite hedge. Fireflies occasionally produces transcripts that are systemically broken — wrong speaker attribution throughout, half the audio missing. Tell the human; they can re-process the audio in Fireflies and try again.
- The summary-vs-transcript mismatch section is where most fabrications surface. Pay attention. A summary that confidently cites a commitment with no matching transcript turn is the highest-risk failure mode.
- Per-client spelling corrections grow over time. If you find yourself running the audit on Coborn's calls and seeing the same 5 mistranscriptions every time, write them down and feed them in at Step 1 — Claude can't infer them.
- The audit doesn't extract commitments. If the user wants commitments extracted after the audit comes back clean, send them to `01_extract_one_meeting`.
