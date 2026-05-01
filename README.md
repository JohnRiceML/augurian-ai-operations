<div align="center">

<img src="docs/architecture/augurian-logo.svg" alt="Augurian" width="180"/>

# Augurian AI Operations

**Internal AI assistant for Augurian's marketing-ops work.**
*Drafts client reports. Spots anomalies. Triages recommendations. Never sends to clients without a human review.*

[![Status](https://img.shields.io/badge/status-Phase%200%20starter-orange)](./docs/phases/) &nbsp;
[![Pilot](https://img.shields.io/badge/Q2%202026-pilot-blue)](./docs/IMPLEMENTATION_PLAYBOOK.md) &nbsp;
[![Pattern](https://img.shields.io/badge/pattern-drafter%20never%20publisher-green)](./docs/FOR_NON_TECHNICAL_READERS.md) &nbsp;
[![Clients](https://img.shields.io/badge/pilot%20clients-Coborn's%20%E2%80%A2%20Theisen's-555)](./pipelines/clients.example.yaml)

</div>

---

## ⭐ The flow that matters most

Every conversation Augurian has on a client call is captured by Fireflies. Most of those captures sit in a folder, unread. **This system reads them, extracts what was committed to, and lets a partner ask a question on Friday morning that gets a real answer in seconds — sourced back to the exact moment in the call where the commitment was made.**

<div align="center">

<a href="docs/images/fireflies-flow-hero.svg">
  <img src="docs/images/fireflies-flow-hero.svg" alt="How a Fireflies call becomes a verified answer in Slack: Fireflies records and transcribes → Drive stores → Claude extracts → Drive indexes → Slack answers, with human review at the end." width="100%"/>
</a>

</div>

[![Fireflies.ai](https://img.shields.io/badge/Fireflies.ai-records%20%2B%20transcribes-F35F73?style=for-the-badge)](https://fireflies.ai)
[![Google Drive](https://img.shields.io/badge/Google%20Drive-stores-4285F4?style=for-the-badge&logo=googledrive&logoColor=white)](https://drive.google.com)
[![Claude](https://img.shields.io/badge/Claude-extracts-D4A27F?style=for-the-badge&logo=anthropic&logoColor=white)](https://www.anthropic.com)
[![Drive Index](https://img.shields.io/badge/Drive-indexes-1A73E8?style=for-the-badge&logo=googledrive&logoColor=white)](#)
[![Slack](https://img.shields.io/badge/Slack-answers-4A154B?style=for-the-badge&logo=slack&logoColor=white)](https://slack.com)
[![Human review](https://img.shields.io/badge/Human-verifies-E8964D?style=for-the-badge)](./docs/FOR_NON_TECHNICAL_READERS.md)

**Why this is the headline flow:** every other capability in this system is in service of this one. The monthly report drafter, the Optmyzr triage, the GSC anomaly detector — they all matter, but none of them answer the question Augurian leadership actually asks before a status meeting: *"what did we commit to, and what's coming up?"*  This flow does, and it does it without a vector database, without fuzzy search, and without any inference layer that could make something up. The labeling convention IS the query interface.

> Read the technical detail in [`docs/HOW_IT_WORKS.md`](./docs/HOW_IT_WORKS.md#how-a-fireflies-call-becomes-an-answer-to-a-leadership-question), the extraction rules in [`.claude/skills/fireflies-extraction-rules/`](./.claude/skills/fireflies-extraction-rules/SKILL.md), and the labeling convention in [`.claude/skills/commitment-labeling/`](./.claude/skills/commitment-labeling/SKILL.md).

---

## What is this, in plain English

A safe AI assistant for Augurian's team. It reads each client's data, drafts the work, and hands the draft to a human at Augurian. The human edits and decides what the client sees. **The AI never reaches the client directly.**

It's not a content generator. It's not a chatbot. It's a way to take the time-consuming-and-mechanical parts of an account lead's work — pulling data, writing first drafts, checking for unusual numbers — and shrink them, so the time-consuming-and-strategic parts (relationships, judgment, calls) get more room.

**For:** Augurian partners, account leads, paid specialists, SEO specialists.
**Pilot clients:** Coborn's first, Theisen's second.

## How it works in 60 seconds

```mermaid
flowchart LR
    A([Account lead<br/>asks a question]) -->|"&commat;augur, draft<br/>April monthly"| B[Augur picks the<br/>right specialist]
    B --> C[Specialist reads<br/>client data + voice]
    C --> D[Drafts the report]
    D --> E([Account lead<br/>reviews and edits])
    E --> F([Client receives<br/>the human-approved version])
    style A fill:#FFE4B5,stroke:#333
    style E fill:#FFE4B5,stroke:#333
    style F fill:#C8E6C9,stroke:#333
```

The orange boxes are humans. The green box is the client. Everything between is automation. Every external output passes through a human review.

## What's in the stack

[![Claude](https://img.shields.io/badge/Claude-Opus%204.7-D4A27F?logo=anthropic&logoColor=white)](https://www.anthropic.com)
[![Google Drive](https://img.shields.io/badge/Google%20Drive-MCP-4285F4?logo=googledrive&logoColor=white)](https://drive.google.com)
[![Slack](https://img.shields.io/badge/Slack-MCP-4A154B?logo=slack&logoColor=white)](https://slack.com)
[![Notion](https://img.shields.io/badge/Notion-MCP-000000?logo=notion&logoColor=white)](https://notion.so)
[![Asana](https://img.shields.io/badge/Asana-MCP-F06A6A?logo=asana&logoColor=white)](https://asana.com)
[![Google Analytics](https://img.shields.io/badge/Google%20Analytics-GA4-E37400?logo=googleanalytics&logoColor=white)](https://analytics.google.com)
[![Search Console](https://img.shields.io/badge/Search%20Console-API-4285F4?logo=googlesearchconsole&logoColor=white)](https://search.google.com)
[![Google Ads](https://img.shields.io/badge/Google%20Ads-API-4285F4?logo=googleads&logoColor=white)](https://ads.google.com)
[![Optmyzr](https://img.shields.io/badge/Optmyzr-API-FF6B35)](https://optmyzr.com)
[![Fireflies.ai](https://img.shields.io/badge/Fireflies.ai-transcripts-F35F73)](https://fireflies.ai)
[![Cloud Run](https://img.shields.io/badge/Cloud%20Run-deploy-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python&logoColor=white)](https://www.python.org)

## A worked example: "What were the top deliverables for Coborn's for next month?"

This is the kind of question Augurian leadership asks before a status meeting. The system answers it in seconds, with sources you can verify.

```mermaid
sequenceDiagram
    autonumber
    participant Sarah as Account lead
    participant Augur
    participant Drive as Drive warehouse
    participant FF as Fireflies (verify)

    Sarah->>Augur: What were the top deliverables<br/>for Coborn's for next month?
    Note over Augur: Loads Coborn's<br/>voice + context (cached)
    Augur->>Drive: Read commitments index
    Drive-->>Augur: 47 items
    Note over Augur: Filter: deliverables,<br/>due next month, status=open<br/>Sort: priority desc
    Augur-->>Sarah: Top 5 with sources<br/>+ timestamp anchors
    Sarah->>FF: Verify quote at 14:32<br/>in May 4 call
    Note over Sarah: Confirms before<br/>status meeting
```

Sarah's answer arrives looking like:

> *Top 5 open deliverables for Coborn's, due 2026-06-01 to 2026-06-30:*
>
> 1. **Q3 SEO brief** — due Jun 4, owner: Sarah, captured in May 4 monthly review @ 14:32
> 2. **Spring Saver paid pacing review** — due Jun 10, owner: Mike (Augurian), captured in May 11 status call @ 22:18
> 3. **Curbside landing page redesign brief** — due Jun 14, owner: Sarah, captured in May 4 monthly review @ 31:05
> 4. *…*
> 5. *…*

No vector database. No fuzzy search. No inference layer. The system extracts commitments from Fireflies transcripts as they're recorded, indexes them in plain JSON, and answers in milliseconds.

## Where to start, by audience

<table>
<tr>
<th width="33%">Augurian partners / leadership</th>
<th width="33%">Account leads / specialists</th>
<th width="33%">Engineers / contractors</th>
</tr>
<tr>
<td>

**[Plain-English entry](./docs/FOR_NON_TECHNICAL_READERS.md)** — what this is, who it's for, what to read next.

[Glossary](./docs/GLOSSARY.md) — every term decoded.

[Implementation Playbook](./docs/IMPLEMENTATION_PLAYBOOK.md) — the consultant's brief.

[Adoption Plan](./docs/ADOPTION_PLAN.md) — the team rollout.

[KPI Playbook](./docs/KPI_PLAYBOOK.md) — what success looks like.

[Leadership Brief template](./docs/LEADERSHIP_BRIEF.md) — partner-facing status.

[Vendor Management](./docs/VENDOR_MANAGEMENT.md) — managing the technical builder.

</td>
<td>

**[Training Guide](./docs/TRAINING_GUIDE.md)** — what Augur is good at, what it's bad at, how to ask good questions.

[Glossary](./docs/GLOSSARY.md) — every term decoded.

[Client context template](./context_templates/client_context_template.md) — the 2-hour interview that makes the system work.

[Disclosure worksheet](./docs/CLIENT_DISCLOSURE_WORKSHEET.md) — per-client AI-disclosure stance.

</td>
<td>

**[CLAUDE.md](./CLAUDE.md)** — coding conventions and locked-in decisions.

[Phase checklists](./docs/phases/) — week-by-week deliverables.

[Tooling: MCP](./docs/TOOLING_MCP.md) · [Cloud Run](./docs/TOOLING_CLOUD_RUN.md) · [Pipelines](./docs/TOOLING_PIPELINES.md)

[External resources](./docs/EXTERNAL_RESOURCES.md) — what to pull from Anthropic + community.

[`orchestrator/main.py`](./orchestrator/main.py) — entry point.

[`pipelines/ga4_puller.py`](./pipelines/ga4_puller.py) — canonical pipeline pattern.

</td>
</tr>
</table>

---

## Architecture

The five-layer architecture, with explicit data pipelines:

<div align="center">
  <img src="ARCHITECTURE.svg" alt="Augurian AI architecture" width="850"/>
</div>

```mermaid
flowchart TB
    subgraph S1["Layer 1 — Sources (per client)"]
        GA[GA4]
        GSC[Search Console]
        ADS[Google Ads]
        OPT[Optmyzr]
        FF[Fireflies calls]
        EM[Emails / onboarding]
        CTX[Hand-written<br/>client context]
    end

    subgraph S2["Layer 2 — Ingestion pipelines"]
        PULL[Cloud Scheduler<br/>+ Python pullers]
        WATCH[Drive watcher<br/>+ PDF extract + redaction]
    end

    subgraph S3["Layer 3 — Drive warehouse (per client)"]
        RAW["/raw/"]
        PROC["/processed/<br/>+ /commitments/"]
        CTXF["/context/"]
        REP["/reports/"]
        AUD["/audit/"]
    end

    subgraph S4["Layer 4 — Orchestrator + subagents"]
        ORCH[Claude Agent SDK<br/>orchestrator]
        SUB1[Monthly drafter]
        SUB2[GSC anomaly]
        SUB3[Organic / Paid<br/>/ Analytics]
        SUB4[Fireflies extractor<br/>+ commitment tracker]
    end

    subgraph S5["Layer 5 — Human surfaces"]
        SLACK[Slack — questions<br/>+ daily digest]
        NOTION[Notion or Asana —<br/>drafted reports + tasks]
        DM[Manager DM —<br/>oversight + cost]
    end

    GA & GSC & ADS & OPT --> PULL
    FF & EM --> WATCH
    CTX --> CTXF
    PULL --> RAW
    WATCH --> PROC
    RAW --> PROC
    PROC & CTXF --> ORCH
    ORCH --> SUB1 & SUB2 & SUB3 & SUB4
    SUB1 & SUB2 & SUB3 & SUB4 --> REP
    SUB1 & SUB2 & SUB3 & SUB4 --> AUD
    REP --> SLACK & NOTION & DM
```

Layer-by-layer breakdown in [`docs/architecture/README.md`](./docs/architecture/README.md). Visual deep-dive in [`docs/HOW_IT_WORKS.md`](./docs/HOW_IT_WORKS.md).

## Q2 2026 rollout

```mermaid
gantt
    title Q2 2026 phased rollout
    dateFormat  YYYY-MM-DD
    axisFormat  %b %d
    section Foundation
    Phase 0 — Accounts, Drive, context file (1wk)        :p0, 2026-04-27, 7d
    section Build
    Phase 1 — First puller live (GA4, daily) (1wk)       :p1, after p0, 7d
    Phase 2 — First subagent (monthly drafter) (2wk)     :p2, after p1, 14d
    Phase 3 — Slack + audit + cost guards (1wk)          :p3, after p2, 7d
    Phase 4 — Theisen's + GSC anomaly detector (3wk)     :p4, after p3, 21d
```

Each phase produces a real, reviewable deliverable before the next starts. Per-phase checklists in [`docs/phases/`](./docs/phases/).

## What's NOT in scope for Q2

- **No fine-tuning.** Claude as-is.
- **No client-facing tools.** Augurian-internal only.
- **No vector DB / RAG.** Data lives in Drive; the agent reads files directly.
- **No multi-tenant SaaS.** Built for Augurian, not for resale.
- **No agent autonomy past drafting.** Every external output is human-reviewed.

## Decisions that need leadership sign-off before week 1

- [ ] **Notion or Asana?** Pick one; don't run both.
- [ ] **Owner of the Google Cloud project, Anthropic API key, and Slack bot identity** — recommend a dedicated `ai-ops@augurian.com` Workspace user.
- [ ] **Builder identity** — internal hire, contractor, or consultant.
- [ ] **Q2 budget envelope** — engineering time + ~$200/mo AI + ~$50/mo tooling.
- [ ] **Client-AI disclosure** — does Coborn's know AI is in the loop? Worksheet at [`docs/CLIENT_DISCLOSURE_WORKSHEET.md`](./docs/CLIENT_DISCLOSURE_WORKSHEET.md).

---

## Subagents and skills

Two roles in `.claude/agents/`:

**Production specialists** — loaded by the orchestrator at runtime:

| Agent | Job |
|---|---|
| `monthly-report-drafter` | Drafts monthly client performance reports |
| `gsc-anomaly-detector` | Daily Search Console anomaly check (Haiku) |
| `organic-search` | SEO briefs, technical audits, GSC analysis |
| `paid-media` | Pacing checks, ad copy, Optmyzr triage |
| `analytics` | Cross-channel analytics, ad-hoc questions |
| `fireflies-extractor` | Extracts deliverables/decisions from call transcripts |
| `commitment-tracker` | Answers "what's coming up for X?" / "what does Augurian owe Y?" |

**Dev helpers** — for engineers and account leads working in Claude Code:

| Agent | Job |
|---|---|
| `pipeline-engineer` | Build/maintain the scheduled pullers |
| `mcp-integrator` | Wire and debug MCP server connections |
| `agent-architect` | Design new specialist subagents |
| `audit-reviewer` | Read audit logs, summarize daily activity |
| `drive-warehouse-curator` | Audit folder structure, fix permission drift |
| `drive-data-architect` | Design Drive structure, naming conventions, query paths |
| `client-onboarder` | Walk through Phase 0 for a new client |
| `cost-monitor` | Watch token + GCP spend; flag outliers |
| `ga4-data-expert` | GA4 metric semantics, healthy ranges |
| `context-coach` | Help account leads write `client_context.md` (interview-only) |
| `report-reviewer` | Capture edit patterns; recommend context-file updates |
| `git-workflow` | Repo's git steward |
| `code-reviewer` | Reviews PRs against this repo's specific concerns |
| `secret-scanner` | Pre-push scan for leaked tokens / keys |
| `adoption-coach` | Watches adoption signals; intervenes on drops |
| `leadership-briefing` | Drafts the weekly partner brief |
| `training-designer` | Designs role-specific onboarding |
| `kpi-tracker` | Computes weekly KPIs |
| `change-comms` | Drafts internal Augurian comms |
| `vendor-manager` | Helps non-technical leadership manage the builder |
| `ai-literacy-coach` | Plain-English answers about the system |
| `readme-curator` | Owns the public-facing README |
| `diagram-designer` | Designs mermaid diagrams for non-technical readers |

**Reusable agent skills** in `.claude/skills/`:

- `drive-warehouse` — folder structure, where to read/write
- `ga4-glossary` — metric/dimension definitions
- `slack-formatting` — channel routing, length limits, mrkdwn
- `pii-redaction` — what gets redacted, what to flag
- `augurian-voice` — house voice, words to avoid
- `conventional-commits` — commit message format
- `git-safety` — destructive-op rules
- `fireflies-extraction-rules` — what to extract from call transcripts
- `commitment-labeling` — naming and index conventions
- `cli-data-tools` — `jq` / `csvkit` / `rclone` one-liners

For more agents and skills published by Anthropic and the community, see [`docs/EXTERNAL_RESOURCES.md`](./docs/EXTERNAL_RESOURCES.md).

## Repository layout

```
.
├── ARCHITECTURE.svg            # Top-level five-layer diagram
├── README.md                   # This file
├── CLAUDE.md                   # Engineer instructions for Claude Code
├── docs/                       # Audience-tracked docs (non-technical, technical, tooling)
├── orchestrator/               # Claude Agent SDK app (Python)
├── pipelines/                  # Scheduled puller scripts (one per source)
├── context_templates/          # Starter template for /context/client_context.md
├── examples/                   # Worked examples + test fixtures
├── .claude/
│   ├── agents/                 # 24 subagent definitions
│   ├── skills/                 # 10 reusable agent-skills
│   └── settings.json           # Permission allowlist for the dev environment
├── .pre-commit-config.yaml     # ruff, detect-secrets, large-file guard
├── .gitmessage                 # Conventional Commits template
├── pyproject.toml
├── .env.example
└── .gitignore
```

## Getting started (for engineers)

```bash
git clone https://github.com/JohnRiceML/augurian-ai-operations.git
cd augurian-ai-operations
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pip install pre-commit && pre-commit install
git config commit.template .gitmessage

cp .env.example .env                                    # fill in secrets
cp pipelines/clients.example.yaml pipelines/clients.yaml  # add real client IDs

python -m pipelines.ga4_puller --client coborns --days-ago 1 --dry-run   # smoke test
```

Then walk [`docs/phases/phase-0-foundation.md`](./docs/phases/phase-0-foundation.md) end-to-end.

## License

Proprietary. Internal Augurian use only.

---

<div align="center">

*Built for Augurian by [Next Gen AI LLC](https://next-gen-ai.com).*
*Status: Phase 0 starter. Q2 2026 pilot.*

</div>
