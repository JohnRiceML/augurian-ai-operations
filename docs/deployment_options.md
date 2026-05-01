# Deployment options — production home + QA-to-production transfer

Per the rollout constraints in `CLAUDE.md`: **production lives in Cloud Run, not on a laptop.** This document captures the reasoning + the actual transfer path so the conversation doesn't have to be re-run every time it comes up.

## Why Cloud Run for production

| Need | Why a laptop / Mac mini fails | Why Cloud Run works |
|---|---|---|
| Slack webhook | Slack needs to POST to a public URL when someone messages Augurbot. Laptops on home/office WiFi aren't publicly addressable without ngrok / Tailscale, neither of which scales. | Cloud Run gives you a stable HTTPS endpoint by default. |
| Always-on | Laptops sleep when closed, restart on update, die when the user travels. Mac minis at the office go down when the office network blips. | Cloud Run runs as long as Google does (≥99.95% SLA). |
| Multi-user access | If Augurbot lives on Micah's MacBook, the rest of the team can't reach it without a shared VPN or port-forward. Either is fragile, neither is what Augurian should run in production. | Cloud Run is reachable from anywhere with credentials. |
| Persistent OAuth | Drive MCP needs a refresh token that survives reboots. Service-account JSON works on any machine, but OAuth-based auth has flaky behavior across power events on a Mac. | Cloud Run + Secret Manager gives a clean credential layer with rotation built in. |
| Cost transparency | A Mac you already own looks free, but the engineering hours to keep it healthy aren't. | ~$20–30/mo at pilot scale. The economic break-even vs an hour of engineering time is the first month. |

## Acceptable non-production roles for a laptop / Mac mini

- **Local QA / dogfood.** Runs the same code with `.env` instead of Secret Manager. Use `scripts/run_validation.py` and `scripts/readiness_check.py` here. This is where every change gets exercised before it ships.
- **Development.** Edit code, run tests, iterate on prompts.
- **Demo machine.** A locked-down Mac for client demos with a frozen build.

These are valid uses; they're just not "production" — meaning, they don't host the thing the team and clients depend on day-to-day.

## QA → production transfer (the actual path)

**Same code in both places. Different runtime config.**

### What's identical

- `orchestrator/main.py` — the orchestrator
- `.claude/agents/*.md` — every agent prompt
- `.claude/skills/*` — every skill
- `pipelines/clients.yaml` — per-client routing
- `scripts/ask.py` — the smart agent (used in dev for spot-checks)

### What differs

| Concern | Local (laptop) | Cloud Run |
|---|---|---|
| Secrets | `.env` file (git-ignored) | Secret Manager, mounted as env vars |
| Anthropic key | `ANTHROPIC_API_KEY` in `.env` | `ANTHROPIC_API_KEY` from Secret Manager |
| Drive auth | Service-account JSON in `./credentials/` | Service-account JSON mounted from Secret Manager |
| Slack | Skipped (or bot token in `.env`) | Bot token from Secret Manager + webhook routed to Cloud Run URL |
| Scheduled pulls | Run manually | Cloud Scheduler triggers Cloud Run jobs |
| Logs | stdout / structlog | Cloud Logging |
| Audit trail | `audit-local/` (git-ignored) | Drive `/audit/` per client + Cloud Logging |

### Promotion checklist (when the time comes — Phase 4+)

1. ✅ All 70 pytest tests green (`python -m pytest tests/ -q`)
2. ✅ `scripts/readiness_check.py --client <slug> --strict` exits 0
3. ✅ `scripts/run_validation.py` against the client's corpus produces a report a partner has signed off on
4. ✅ Client added to `pipelines/clients.yaml` with verified Drive folder ID
5. ✅ Service-account email shared on the client's Drive folder
6. ✅ Slack bot token + webhook URL in Secret Manager
7. ✅ Cloud Run service deployed, smoke test (one query end-to-end) passes
8. ✅ First week of usage runs in DRY_RUN=true mode (drafts, no sends)
9. ✅ Account lead reviews dry-run drafts; only after approval does DRY_RUN flip off

## What this constrains for new features

- **Don't build features that only work on a Mac.** Anything macOS-specific (osascript, `say`, Notification Center, Spotlight) doesn't belong in the orchestrator code path. If it's helpful for local dev, put it in `scripts/` and label it as such.
- **Don't hardcode paths.** Use `Path` + env vars. Cloud Run won't have your home directory.
- **Don't store state on disk that needs to survive a restart.** Cloud Run instances are ephemeral; use Drive (the warehouse) or Cloud Storage for anything stateful.
- **Test deploys aren't real deploys.** The promotion checklist is the gate. Until it's green for a given client, that client doesn't get turned on in production, regardless of how the demo went.
