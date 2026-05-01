# ADR 0001: No vector search in Q2

**Status:** Accepted (2026-05-01)
**Context:** Engineer asked whether to add vector search after the 2026-05-01 8-meeting validation succeeded.

## Decision

**Hold the existing scope fence — no vector search in Q2.** Use SQLite FTS5 over `verbatim` + `deliverable_text` if a recall upgrade is needed before Q3. Revisit pgvector for Q3 if any of the [re-evaluation triggers](#re-evaluation-triggers-q3-revisit-if-any-fire) fire.

## Why

The structured-index + Opus-reads-the-text architecture works because every commitment carries `tags`, `owner_role`, `type`, `due_date`, and a verbatim quote — that's structure the LLM can reason over directly. At ~50–500 commitments per client, an Opus 4.7 read of the filtered index *is* the semantic search. Vectors add infrastructure for a benefit you can't measure yet.

### Concrete query analysis

| Query class | Today | With vectors | Verdict |
|---|---|---|---|
| Status-meeting prep ("what's due Friday") | Works perfectly via `query_commitments` | No improvement | Vectors don't help |
| Theme-shaped queries ("anything about creative fatigue") | Partial — depends on tag presence | Genuine win | But FTS5 captures most of it |
| Cross-client pattern matching | **Cannot answer** (commitment-tracker contract excludes it) | Real win | But it's a contract change too — not a Q2 ask |
| Theme drift over time | Doesn't work | Vectors + clustering could surface drift | Quarterly question — human-tractable |
| Phrase variant search ("someone said something like…") | Painful at 80+ calls | Clear win at scale | FTS5 helps; vectors win at corpus size |

**2 of 5 real wins, both at scale, one requires a contract change anyway.**

### Cost vs benefit at Q2 scale

- Q2 corpus estimate: 4 calls/mo × 5 items × 6 mo × 2 clients = **~240 commitments**.
- Threshold where vectors become load-bearing: **1,500–3,000 commitments per client** (when filtered slices stop fitting comfortably in Opus's context).
- We're 6× under threshold even at end-of-pilot.
- Embedding cost: trivial (~$0.001/mo at projected volume — not the constraint).
- Operational cost: real. Vector index introduces a sync invariant with the JSONL — a new bug class (drift between structured + vector views) we don't have today.

### What we'll do instead (Q2)

In priority order:

1. **SQLite FTS5** as a 6th tool (`search_commitments_text(query, client)`) — full-text search over `verbatim` + `deliverable_text`. ~50 LOC, no new infra. Captures the "creative fatigue" / "attribution worry" cases where phrasing roughly matches but tags miss.
2. **Tighten tag taxonomy** in the `commitment-labeling` skill. Define ~40 canonical tags. Forces the extractor to map free-form to vocab. Costs governance, not infrastructure.
3. **Add a `theme` field** to the extraction schema (one-liner, controlled vocab) — pushes the extractor to surface theme structure at extraction time rather than at query time.

## Re-evaluation triggers — Q3, revisit if any fire

1. Per-client commitment count crosses **1,500**.
2. Partner-tier cross-client queries become a **weekly** ask (today they're hypothetical).
3. After FTS5 + tag-taxonomy + theme upgrades land, account leads still report missed-recall on **>20% of fuzzy queries** over a 4-week observation window.
4. A second, qualitatively different corpus joins (email threads, Slack archives, onboarding intake) and unified cross-modality retrieval becomes the bottleneck.

## If we do it eventually — what we'd pick

- **pgvector on Cloud SQL Postgres** (which we'll have anyway for audit/state). Pinecone adds a billing line + auth surface and isn't justified at <100K rows; Weaviate is operational overkill at our scale; FAISS in-process loses durability and concurrency.
- **`text-embedding-3-small`** for embeddings at $0.02/M tokens. Voyage AI as a fallback if recall benchmarks favor it.
- **Re-embed policy:** items immutable post-extraction; supersession appends a row; schema change = full re-embed (cheap). Spelling-correction reruns re-embed affected items. ~20 LOC sync script.

## Smallest experiment to flip the decision (not running today)

In-process FAISS, ~1 day, ~$0.50:

1. Embed every `verbatim` + `deliverable_text` from the validation corpus.
2. Hand-write 10 fuzzy queries the structured index demonstrably struggles with (creative fatigue, attribution worry, scope creep).
3. Run vector top-3 vs. current-system top-3.
4. Score: where does each system find the right item the other missed?

Threshold to flip the decision: **6+ of 10 queries where vectors find an item the cascade misses, AND those queries match plausible Augurian use.**

## References

- CLAUDE.md scope fence (current): "Don't propose a vector database, RAG layer, or fine-tuning. Q2 scope is explicit about not doing these."
- Commitment-tracker contract: "Don't combine commitments from multiple clients in one answer."
- Validation 2026-05-01: 8 meetings, ~34 commitments, 6 queries answered correctly through the cascade alone.
