# Demo walkthrough — Fireflies → Drive → smart agent

A scripted walkthrough for the Wednesday sync (or any first-time viewer). Roughly 15 minutes if everything works.

The demo's goal: show the **first slice** working end-to-end on real Fireflies meetings, with cited timestamps you can verify back in Fireflies. Not the whole architecture — just the flow that matters most.

## Prereqs (one-time, ~5 minutes)

```bash
# From repo root
pip install -e ".[dev]"
echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env   # your real key
```

That's it. No GCP project, no service account, no Drive auth — those come later when we move from local PDFs to programmatic Drive access.

## Recording the test meetings (do before the demo)

Fireflies takes 5–20 minutes to export PDFs to Drive after a meeting ends, so record at least an hour ahead.

Aim for 2–3 short test meetings (~3–5 min each), with varied content:

1. **Pseudo-client status call.** Mention 2 deliverables with deadlines, 1 decision.
   *Example phrases:* "Sarah will have the SEO brief by next Friday." / "We're going with the green hero treatment." / "MRR target for next month is up 30%."
2. **Internal planning call.** Repo / rollout / who's doing what.
   *Example phrases:* "I'll set up the GitHub repo by end of week." / "We'll soft-launch with 3 people first." / "Open question — do we use V1 or V2 of the tool?"
3. *(Optional)* **Blocker-heavy call.** Talk through what's stuck and why.

Diverse content gives the demo something to *show across meetings*, not just inside one.

When PDFs land in your Drive (folder Fireflies creates, usually `Fireflies Meetings/Transcripts/` and `.../Summaries/`):
- Download both PDFs for each meeting to `~/Downloads/`
- Note the filenames — they follow `<title>-<{summary|transcript}>-<ISO-UTC>.pdf`

## Demo path

### Part 1 — Ingestion (per meeting, ~10 sec each)

```bash
# Save the raw summary text in the per-client layout
python scripts/fireflies_walkthrough.py pull-local \
    "~/Downloads/<meeting-title>-summary-<ts>.pdf" \
    --client sandbox

# Save raw transcript text + run Claude extraction
python scripts/fireflies_walkthrough.py extract-local \
    "~/Downloads/<meeting-title>-transcript-<ts>.pdf" \
    --client sandbox
```

Expected output: filenames written to `data/walkthrough/raw/firefly/sandbox/`, structured commitments JSON written to `data/walkthrough/processed/commitments/sandbox/`, index appended.

**Talking point:** "This is the extraction layer. It runs whenever a new transcript lands — could be triggered by a Drive watcher in production. The output is structured, so the chatbot can answer in milliseconds."

### Part 2 — Q&A (this is the money shot)

Run these in order. Use `-v` for the first few so the audience watches the agent pick tools.

```bash
# Tier 1 only — fast
python scripts/ask.py "what's open with priority 3?" --client sandbox -v

# Should escalate to Tier 3 (Fireflies summary)
python scripts/ask.py "what was the call about?" --client sandbox -v

# Should escalate to Tier 4 (full transcript) — Mochi appears only there
python scripts/ask.py "did Mochi come up?" --client sandbox -v

# Cross-meeting (only works once you have multiple meetings)
python scripts/ask.py "what have I committed to in May?" --client sandbox -v

# Verbatim verification
python scripts/ask.py "what did I decide about Whisper, exactly?" --client sandbox -v
```

**Talking points:**
- "Notice the `-v` output — the agent picks the cheapest tool that can answer. That's the cascade."
- "Every answer cites a transcript anchor. The human can verify in Fireflies in one click."
- "No vector DB. No RAG. Just labeled extraction + a flat index."

### Part 3 — Sharp edges to call out (don't hide them)

Lead with these — they signal you've thought it through:

1. **Transcription quality is rough on proper nouns.** Show the `spelling_corrections.txt` file. Explain: "Fireflies misheard 'Augurian' as 'Aquarian' AND 'agrarian' in the same call. Per-client correction list fixes it before extraction."
2. **Two PDFs per meeting.** Show one of each in Drive. Explain: "Fireflies gives us a summary AND a transcript. Cascade reaches for the cheaper summary first; the agent escalates to the transcript only when it needs verbatim quotes or timestamps."
3. **No Whisper.** "Originally the playbook had Whisper for transcription. Fireflies already does it natively, so we dropped it — saves $50–200/mo and one moving part."

## What's NOT shown (and why)

- **Drive MCP.** Currently using local PDFs you downloaded. Production swaps the local-file tools for Drive MCP calls — see `docs/TOOLING_MCP.md`. The agent reasoning is identical; only the data source changes.
- **Slack interface.** Production answer goes to Slack with a human-review gate. Locally we just print to terminal. Wiring is straightforward once the agent is solid.
- **Per-client onboarding.** Coborn's first, then Theisen's. Each gets its own Drive folder, redaction list, spelling-corrections list, and `client_context.md`.

## If something breaks during the demo

| Symptom | Likely cause | Fix |
|---|---|---|
| "ANTHROPIC_API_KEY not set" | Missing `.env` | `echo 'ANTHROPIC_API_KEY=...' > .env` |
| `pypdf` ImportError | Forgot `pip install -e ".[dev]"` | Install deps |
| Filename doesn't match Fireflies pattern | Renamed the PDF | Use original name from Drive |
| Empty index for client | Didn't run `extract-local` | Run extract-local on the transcript PDF |
| Agent loops with no answer | Bug in tool / data | Re-run with `-v`, paste the iter log |

## After the demo

If Wednesday goes well, the next questions to align on:

- **Drive MCP wiring** — service account vs OAuth vs Composio (`docs/TOOLING_MCP.md` has the verified configs)
- **First real client** — Coborn's, with their actual call data
- **Slack rollout** — soft launch with one channel before going wide (matches Micah's instinct to soft-roll)
- **GitHub org setup** — issue Micah surfaced earlier in the thread; do this in the same session
