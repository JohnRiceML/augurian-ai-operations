---
name: drive-warehouse
description: Conventions for reading and writing the per-client Google Drive warehouse. Load when a subagent needs to know exactly where files live, what naming patterns to follow, or what's read-only. Reusable across every production subagent.
---

# Drive warehouse conventions

Every Augurian client has a folder under `/Augurian Clients/[Client]/`. Inside, structure is identical across clients.

## Per-client layout

```
/Augurian Clients/[Client]/
├── raw/              READ-ONLY for subagents. Pullers + manual dumps.
│   ├── ga4/          YYYY-MM-DD.csv     (daily, GA4)
│   ├── gsc/          YYYY-MM-DD.csv     (daily, T-3 lag)
│   ├── ads/          YYYY-MM-DD.csv     (daily, T-1)
│   ├── optmyzr/      YYYY-MM-DD.csv     (daily, may lag 1–2h)
│   ├── firefly/      Audio dumps; raw filenames vary
│   ├── email/        Forwarded emails; raw filenames vary
│   └── onboarding/   Onboarding docs
├── processed/        Cleaned + normalized. Read this, not /raw/, when possible.
│   ├── ga4/          YYYY-MM-DD.json    (deduped, schema-stable)
│   ├── gsc/          YYYY-MM-DD.json
│   ├── firefly/      YYYY-MM-DD-{call}-transcript.json (PII stripped)
│   └── ...
├── context/          READ FIRST, EVERY TASK.
│   ├── client_context.md       Hand-written by account lead. Voice, goals, hard rules.
│   └── redaction_list.txt      Per-client names/terms to redact from logs.
├── reports/          WRITE HERE for subagent outputs.
│   ├── monthly/      YYYY-MM-{client}-monthly-draft.md
│   ├── seo/          YYYY-MM-DD-{topic}.md
│   ├── paid/         YYYY-MM-DD-{topic}.md
│   └── analytics/    YYYY-MM-DD-{question-slug}.md
└── audit/            APPEND-ONLY (managed by audit hook, not subagents).
    ├── YYYY-MM-DD.jsonl
    └── anomalies/    (gsc-anomaly-detector writes here)
        └── YYYY-MM-DD.txt
```

## Hard rules

1. **Never write to `/raw/`.** That's the audit-of-record. Raw data is what the puller produced.
2. **Prefer `/processed/` over `/raw/`** when both exist. Processed is normalized, deduped, and PII-stripped where applicable. Raw is what hit the API.
3. **Always read `/context/client_context.md` first.** It's prompt-cached; the cost is near-zero, and skipping it produces generic output.
4. **Write only to `/reports/<your-topic>/`.** A subagent writing outside its topic folder is a bug.
5. **Audit writes are not yours.** The audit hook handles `/audit/`. Don't write to it directly.
6. **Filenames matter.** Daily files use `YYYY-MM-DD.csv`. Reports use `YYYY-MM-DD-{slug}.md` or `YYYY-MM-{slug}.md` for monthly. Stick to it — downstream tools assume the pattern.

## Common access patterns

| Task | Read from | Write to |
|---|---|---|
| Drafting a monthly report | `/processed/ga4/`, `/processed/gsc/`, `/processed/ads/`, `/context/` | `/reports/monthly/` |
| Daily GSC anomaly check | `/processed/gsc/` (last 28 days), `/audit/anomalies/` (history) | `/audit/anomalies/YYYY-MM-DD.txt` |
| Ad-hoc analytics question | Any `/processed/*` matching the question, `/context/` | `/reports/analytics/` |
| Content brief | `/processed/gsc/`, `/context/` | `/reports/seo/briefs/` |
| Optmyzr triage | `/processed/optmyzr/`, `/context/` | `/reports/paid/optmyzr-triage/` |

## When data is missing

If a daily file you need isn't there, **say so plainly in your output**:
> *"GA4 data for 2026-04-15 missing — pipeline likely failed. Flagging for the engineer."*

Don't:
- Substitute a different date silently.
- Estimate from adjacent days without saying you did.
- Skip mentioning that a metric in your report is based on partial data.

The account lead is the human escalation path; flagging missing data is doing your job, not failing it.
