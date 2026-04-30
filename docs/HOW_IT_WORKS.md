# How it works

Visual deep-dive — for partners, account leads, or anyone who's read the README and wants to see *more* of how the pieces fit together. No code in this doc; it's all diagrams and plain English.

The architecture diagram is at [`../ARCHITECTURE.svg`](../ARCHITECTURE.svg) — open it in any browser for the full-resolution version.

## The big picture, one diagram

```mermaid
flowchart TB
    subgraph Inputs["What goes in"]
        A1[Client data<br/>GA4, Search Console, Ads, Optmyzr]
        A2[Call recordings<br/>Fireflies]
        A3[Emails, onboarding docs]
        A4[Hand-written client context<br/>2 hours from the account lead]
    end

    subgraph Middle["What happens to it"]
        B1[Scheduled programs<br/>pull data every morning]
        B2[Drive watcher<br/>cleans + transcribes]
        B3[Per-client folders<br/>in Google Drive]
    end

    subgraph Augur["Augur — the AI assistant"]
        C1[Orchestrator<br/>picks the right specialist]
        C2[Specialists<br/>read data + voice + context]
        C3[Specialists draft<br/>reports / answers / alerts]
    end

    subgraph Outputs["What comes out"]
        D1[Drafts in Drive — for review]
        D2[Slack — daily summaries + answers]
        D3[Notion / Asana — tasks + reports]
    end

    Inputs --> Middle --> Augur --> Outputs
    D1 --> E((Account lead<br/>reviews + edits))
    D2 --> E
    D3 --> E
    E --> F((Client))

    style E fill:#FFE4B5,stroke:#333
    style F fill:#C8E6C9,stroke:#333
```

The orange box is where humans do the work that only humans can do. The green box is the client — they only ever see human-approved output.

## The three things Augurian people do

### 1. Account leads write the context file (~2 hours, once per client)

This is where the system gets its voice. Without it, every report sounds the same; with it, every report sounds like Augurian-for-this-specific-client.

```mermaid
flowchart LR
    A([Account lead]) -->|opens the<br/>template| B[client_context.md]
    B -->|interviews via| C[context-coach agent]
    C -->|asks specifics about<br/>voice, goals, hard rules| A
    A -->|writes the answers| B
    B -->|saved to Drive| D[/Augurian Clients/<br/>Coborn's/context/]
    D -->|loaded by every<br/>specialist on every task| E[Augur]
    style A fill:#FFE4B5,stroke:#333
```

The `context-coach` agent doesn't write the context file. It interviews the account lead so the answers come out organized. AI-generating this file would defeat the entire system.

### 2. Specialists work on real client tasks

A specialist (account lead, paid manager, SEO lead) asks Augur for help with a specific task. The right subagent picks it up.

```mermaid
sequenceDiagram
    autonumber
    participant Sarah as Account lead
    participant Augur
    participant Drive as Drive warehouse
    participant Lead as Sarah (review)
    participant Client

    Sarah->>Augur: Draft Coborn's April monthly
    Augur->>Drive: Read /context/client_context.md
    Augur->>Drive: Read /processed/ga4/*.csv (last month)
    Augur->>Drive: Read /processed/gsc/*.csv (last month)
    Note over Augur: Drafts headline +<br/>what worked / didn't<br/>+ recommendations
    Augur->>Drive: Write /reports/monthly/2026-04-coborns-draft.md
    Augur->>Sarah: Slack: draft ready, link in thread
    Sarah->>Lead: Review the draft
    Note over Lead: Edits voice, removes one claim,<br/>tightens recommendations
    Lead->>Client: Sends approved version
```

Augur drafts in 60 seconds what would take Sarah 90 minutes. Sarah's hour of edits + judgment is the part that makes it good.

### 3. Leadership reads the weekly brief

The project owner (and partners) don't use Augur day-to-day. They read the weekly brief to know if it's working.

```mermaid
flowchart TB
    subgraph Auto["Automated"]
        A1[Audit logs<br/>per client per day]
        A2[Cost data<br/>Anthropic + GCP]
        A3[Adoption signals<br/>users, tasks, repeat rate]
    end

    A1 & A2 & A3 --> B[leadership-briefing agent]
    B -->|drafts weekly brief| C[Project owner]
    C -->|edits + adds context| D[Partner inbox]
    D --> E([Partners decide:<br/>on track / at risk / blocked])

    style E fill:#FFE4B5,stroke:#333
```

5-minute read. Three sentences carry it: status, who used it, cost vs budget.

## The data warehouse, demystified

Each Augurian client gets one folder in a shared Google Drive. The structure is identical across clients.

```mermaid
flowchart TB
    Top[/Augurian Clients/<br/>Coborn's//]
    Top --> R[/raw//]
    Top --> P[/processed//]
    Top --> C[/context//]
    Top --> Rep[/reports//]
    Top --> Aud[/audit//]

    R --> R1[ga4/<br/>YYYY-MM-DD.csv]
    R --> R2[gsc/, ads/,<br/>optmyzr/]
    R --> R3[firefly/, email/,<br/>onboarding/]

    P --> P1[Cleaned CSVs]
    P --> P2[commitments/<br/>extracted deliverables]

    C --> C1[client_context.md<br/>HAND-WRITTEN]
    C --> C2[redaction_list.txt]

    Rep --> Rep1[monthly/, seo/,<br/>paid/, analytics/]

    Aud --> Aud1[YYYY-MM-DD.jsonl<br/>everything Augur did]

    style C1 fill:#FFE4B5,stroke:#333
    style Rep fill:#E1F5FE,stroke:#333
    style Aud fill:#F3E5F5,stroke:#333
```

| Folder | What's in it | Who writes it |
|---|---|---|
| `/raw/` | Daily exports + manual dumps | Pipelines (automated) |
| `/processed/` | Cleaned, deduped, PII-stripped | Drive watcher (automated) |
| `/context/` | Voice, goals, hard rules | Account lead (by hand) |
| `/reports/` | Drafted deliverables for review | Augur subagents |
| `/audit/` | Daily log of everything Augur did | Audit hook (automated) |

## How a Fireflies call becomes an answer to a leadership question

This is the system's most ambitious flow — and the one that earns its keep.

```mermaid
sequenceDiagram
    autonumber
    participant Sarah as Account lead
    participant FF as Fireflies
    participant Watch as Drive watcher
    participant Whisper
    participant FE as fireflies-extractor
    participant Drive as Drive warehouse
    participant Augur as commitment-tracker
    participant Partner

    Note over Sarah,FF: Tuesday: Sarah and the Coborn's<br/>team have a status call
    Sarah->>FF: Recording captured
    FF->>Drive: Audio dropped to /raw/firefly/

    Note over Watch: 5-min poll loop
    Watch->>Drive: Detects new file
    Watch->>Whisper: Transcribe audio
    Whisper-->>Watch: Text + speaker labels + timestamps
    Watch->>Drive: Save transcript to /raw/firefly/

    Watch->>FE: Trigger extraction
    FE->>Drive: Read transcript + client_context.md
    Note over FE: Extracts: deliverables,<br/>action items, decisions,<br/>blockers — with anchors
    FE->>Drive: Write /processed/commitments/<br/>2026-05-04-status-call.json
    FE->>Drive: Append to _index.jsonl

    Note over Partner: Friday: partner prepping<br/>for board update
    Partner->>Augur: What deliverables for<br/>Coborn's next month?
    Augur->>Drive: Read commitments index
    Augur-->>Partner: Top 5 with sources<br/>+ Fireflies anchor times
```

The trick: at no point does the system "think" about the question. It extracts on capture, indexes flat JSON, and answers by filtering. No vector DB, no embeddings, no fuzzy matching. Just: what's in the index, when's it due, who owns it, where can I verify.

That's the architectural decision that keeps cost low and accuracy high.

## How safety works (the drafter pattern)

Three guardrails, none of them new ideas — but all three together.

```mermaid
flowchart LR
    A[Augur drafts] -->|always to<br/>/reports/| B[Drive folder]
    B --> C[Account lead reviews]
    C -->|edits, deletes,<br/>or rewrites| D[Approved version]
    D --> E([Client receives])

    F[Augur tries to<br/>send to client] -.X.-> E

    style E fill:#C8E6C9,stroke:#333
    style F fill:#FFCDD2,stroke:#333
    linkStyle 4 stroke:#D32F2F,stroke-dasharray:5
```

| Guardrail | What it does | Where it's enforced |
|---|---|---|
| **No publish path** | Augur literally has no tool that talks to a client | `orchestrator/tools/permissions.py` — the agent's tool surface doesn't include a "send email" or "post externally" tool |
| **Always-write-to-`/reports/`** | Every draft lands in a review queue, not in an outbound channel | The subagent system prompts; reinforced in the code-review agent |
| **Audit log everything** | Every action is recorded; review-able for any client at any time | `orchestrator/hooks/audit_log.py` |

If a future Augurian engineer ever proposed adding a "send to client" tool, the `code-reviewer` agent's first action would be to block the PR.

## How adoption is supposed to work

The technical work is straightforward. The adoption work is where this either succeeds or fails.

```mermaid
flowchart TB
    A[Phase 0: setup<br/>+ context file written] --> B[Phase 2: account lead<br/>pairs with builder<br/>on first real task]
    B --> C[Phase 3: account lead<br/>uses it on real client work<br/>WITHOUT the builder]
    C --> D{Did they?}
    D -->|Yes| E[adoption-coach watches<br/>for drift; recurring use<br/>= success]
    D -->|No| F[Project failed<br/>at the human layer<br/>not the tech layer]

    style D fill:#FFF9C4,stroke:#333
    style E fill:#C8E6C9,stroke:#333
    style F fill:#FFCDD2,stroke:#333
```

The decision point at the end of Phase 3 is the project's actual moment of truth. The technology doesn't matter if it's not used.

The adoption-coach agent's whole job is watching for that signal and intervening *before* the answer to "did they?" turns into "no."

## Where to go next

| If you want… | Read |
|---|---|
| The plain-English overview | [`FOR_NON_TECHNICAL_READERS.md`](./FOR_NON_TECHNICAL_READERS.md) |
| Term-by-term explanations | [`GLOSSARY.md`](./GLOSSARY.md) |
| The week-by-week plan from the team's perspective | [`ADOPTION_PLAN.md`](./ADOPTION_PLAN.md) |
| The consultant's source-of-truth doc | [`IMPLEMENTATION_PLAYBOOK.md`](./IMPLEMENTATION_PLAYBOOK.md) |
| What "good" looks like by phase (for managing the builder) | [`VENDOR_MANAGEMENT.md`](./VENDOR_MANAGEMENT.md) |
| How we measure success | [`KPI_PLAYBOOK.md`](./KPI_PLAYBOOK.md) |
