# Phase 0 — Foundation (week 1)

**Goal:** accounts, credentials, and Drive structure in place for one client (Coborn's). No agent yet.
**Deliverable:** a working `/Augurian Clients/Coborn's/` folder structure that's ready for raw GA4 data to flow in.

> This phase is unglamorous and entirely about removing future blockers. Resist the urge to start writing the puller. The cost of skipping a step here is a week of debugging in Phase 2.

## Pre-flight decisions (must be made before this phase starts)

These block week 1 if they're not nailed down. See `README.md` → "Decisions that need leadership sign-off":

- [ ] Notion or Asana picked
- [ ] Owner identified for the dedicated `ai-ops@augurian.com` Workspace user
- [ ] Builder identity confirmed (internal / contractor / consultant)
- [ ] Q2 budget envelope agreed
- [ ] Coborn's AI-disclosure stance documented

## Accounts

- [ ] Anthropic API key created at `console.anthropic.com`. Stored in 1Password under "Augurian AI Ops".
- [ ] Google Cloud project created — name `augurian-ai-ops`. Billing account attached. Owner = `ai-ops@augurian.com`.
- [ ] Slack app created at `api.slack.com/apps`. Bot username "Augur". Bot Token Scopes: `channels:history`, `channels:read`, `chat:write`, `search:read`, `users:read`.
- [ ] Slack app installed to the Augurian workspace. Bot User OAuth Token (`xoxb-...`) saved to 1Password.
- [ ] OpenAI API key created (for Whisper). Stored in 1Password.

## Google Cloud setup

- [ ] APIs enabled: Drive API, Google Analytics Data API, Google Search Console API, Google Ads API.
- [ ] Service account `ga4-puller@augurian-ai-ops.iam.gserviceaccount.com` created. JSON key downloaded, stored in 1Password and **not committed to the repo**.
- [ ] OAuth consent screen configured. **Audience set to Internal.** This is the single most important checkbox in the whole project — External + Testing causes 7-day token expiry.
- [ ] OAuth client ID created (Web application type). Client ID + secret stored in 1Password.

## Drive structure for Coborn's

- [ ] Top-level folder `/Augurian Clients/` exists in the Augurian shared drive.
- [ ] Subfolder `/Augurian Clients/Coborn's/` created. Account lead has write access; service account has Editor access.
- [ ] Inside Coborn's, create:
  - [ ] `/raw/ga4/`
  - [ ] `/raw/gsc/`
  - [ ] `/raw/ads/`
  - [ ] `/raw/optmyzr/`
  - [ ] `/raw/firefly/`
  - [ ] `/raw/email/`
  - [ ] `/raw/onboarding/`
  - [ ] `/processed/`
  - [ ] `/context/`
  - [ ] `/reports/`
  - [ ] `/audit/`

## Per-client API access

- [ ] Service account email added as **Viewer** on Coborn's GA4 property.
- [ ] Service account email added as **Restricted** user on Coborn's Search Console property.
- [ ] Google Ads access requested (this one needs a Google Ads developer token approval, which takes 1–3 business days — start it early in the week).
- [ ] Optmyzr API token issued for Coborn's account.

## Repo bootstrap

- [ ] This repo cloned to the builder's machine.
- [ ] `python -m venv .venv && source .venv/bin/activate && pip install -e ".[dev]"` runs cleanly.
- [ ] `.env` populated from `.env.example` with all keys.
- [ ] `pipelines/clients.yaml` populated with Coborn's GA4 Property ID, GSC site URL, Ads customer ID, Drive folder ID.
- [ ] `/context/client_context.md` written for Coborn's by the account lead. Use `context_templates/client_context_template.md` as the starting point. **Do not skip this.** It's the highest-leverage hour in the whole quarter.

## Smoke tests

- [ ] `python -c "from googleapiclient.discovery import build; build('drive', 'v3', credentials=...)"` succeeds.
- [ ] Service account can list files in `/Augurian Clients/Coborn's/`.
- [ ] `slack_sdk` test message posts to `#agent-activity` channel.

## What success looks like

At the end of week 1, you can demonstrate:

1. The Drive folder structure exists and the service account has appropriate access.
2. `python -m pipelines.ga4_puller --client coborns --days-ago 1 --dry-run` prints what it *would* do (without writing to Drive yet — the actual write happens in Phase 1).
3. Coborn's `client_context.md` is in place and the account lead has signed off on it.

If any of those three are missing at the end of the week, do not move into Phase 1. Resolve first.
