# Tooling reference — MCP servers for the Augurian orchestrator

Practical, decision-ready survey of the MCP servers the agent actually plugs into. Verified against current docs (April 2026). Use this when wiring `mcp_servers` in `orchestrator/main.py`.

> Heads-up — the tooling-MCP landscape moves fast. Re-verify before deploying anything. The `mcp.<vendor>.com` URLs are stable; the npm package versions and exact OAuth flows are not.

## Decision summary

| Need | Use this | Why |
|---|---|---|
| Drive read/write per client | **`@modelcontextprotocol/server-gdrive`** + service-account auth (or Composio) | The "Google first-party Drive MCP" mentioned in the playbook does NOT exist as of April 2026; the official Anthropic reference implementation does. |
| Slack — bot replies, search, post | **`@modelcontextprotocol/server-slack`** (npm) + manually-created Bot Token | Anthropic archived the reference repo in May 2025, but the npm package still works and is the most stable headless option. |
| Notion (drafts, tasks, project pages) | **Official Notion MCP** at `https://mcp.notion.com/mcp` | OAuth-based, hosted by Notion, no infrastructure to run. The right choice if Augurian picks Notion over Asana. |
| Asana (tasks, projects) | **Official Asana V2 MCP** | V2 is GA. V1 (`https://mcp.asana.com/sse`) deprecates May 11, 2026 — don't wire to V1. |
| Google Calendar (digest reminders) | Skip in Q2 | Not in playbook scope. Add in Q3 if a calendar surface earns its keep. |
| Direct GA4 querying via MCP | **Skip — keep the pull-based pipeline** | An MCP-driven GA4 surface lets the agent run unbounded queries against GA4. The pull-based pattern bounds cost (one query/day/client) and gives a deterministic data contract. Don't introduce non-determinism into the analytics path. |
| GitHub | Skip in Q2 | Not part of the architecture. |

## Per-server detail

### Google Drive

| | |
|---|---|
| **Recommended** | Anthropic reference: [`@modelcontextprotocol/server-gdrive`](https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive) (now in `servers-archived` but still functional) — pair with a **service account** for headless production use. |
| **Auth** | Service-account JSON key, scopes `drive.readonly` + `drive.file`. Each client's Drive folder is shared with the service account email. |
| **What it does** | List, search, read, upload files by folder ID. Streams Google Docs / Sheets / Slides as text. |
| **Gotcha** | The playbook references a "Google first-party" Drive MCP. As of April 2026, that does not exist — Google has Cloud-platform MCP servers (Cloud Run, BigQuery, etc.), not an end-user Drive MCP. Plan accordingly. |
| **Alt 1: Composio** | Managed service ~$30/mo; handles OAuth refresh + scoping. Right answer if Phase 0 OAuth setup costs >2 days. |
| **Alt 2: piotr-agier/google-drive-mcp** | Community, broader (Drive + Docs + Sheets + Slides + Calendar). Good for desktop dev; service-account support is uneven for headless. |

### Slack

| | |
|---|---|
| **Recommended** | [`@modelcontextprotocol/server-slack`](https://www.npmjs.com/package/@modelcontextprotocol/server-slack) (npm) with a manually-created Bot Token. Run via `npx -y @modelcontextprotocol/server-slack`. |
| **Auth** | `SLACK_BOT_TOKEN` (xoxb-...) + `SLACK_TEAM_ID` (T...). Optional `SLACK_CHANNEL_IDS` to scope. |
| **Tools** | 8 core tools — list channels, post message, get history, get user info, etc. |
| **Status** | Anthropic archived the reference repo in May 2025. The npm package still works; community forks (`korotovsky/slack-mcp-server`, `dennisonbertram/mcp-slack`) extend it but introduce drift. Stay on the official npm package unless a feature gap forces a fork. |
| **Gotcha** | A first-party Slack MCP that uses Dynamic Client Registration exists but isn't reliable for headless deployments. The Bot Token path is what production should use — matches the playbook's recommendation. |

### Notion

| | |
|---|---|
| **Recommended** | [Official Notion MCP](https://developers.notion.com/docs/get-started-with-mcp) at `https://mcp.notion.com/mcp`. Hosted by Notion, OAuth-only, no infra. |
| **Auth** | OAuth flow with PKCE on first connect. Refresh tokens auto-renew. **Bearer / API tokens are NOT accepted** — only OAuth. This is different from Notion's REST API. |
| **What it does** | Read pages, search workspace, create pages, edit blocks, add comments. Optimized for AI agents. |
| **First-time setup** | Engineer runs `/mcp` in the agent process, walks the Notion OAuth consent, refresh token persists. For headless production, run the consent dance once per environment and persist the credential. |
| **Gotcha** | The integration token (`ntn_...`) you'd use for the REST API does NOT work for the MCP server. Different auth systems. |

### Asana

| | |
|---|---|
| **Recommended** | [Official Asana V2 MCP](https://developers.asana.com/docs/using-asanas-mcp-server). OAuth-based. |
| **Auth** | OAuth, similar shape to Notion. |
| **Status** | V2 is GA. **V1 (`https://mcp.asana.com/sse`) shuts down May 11, 2026 — do not wire to V1.** |
| **What it does** | Create tasks, search projects, analyze workload, comment, move tasks across sections. |
| **Gotcha** | Same as Notion — REST-API tokens don't work for MCP. |

## What this means for `clients.yaml` and `orchestrator/main.py`

The orchestrator's MCP server config (in `orchestrator/main.py:build_mcp_servers`) needs:

1. **Drive (per-client scoped)** — pass the client's `drive_folder_id` from `clients.yaml`. Service-account JSON is shared, but tool scoping is folder-ID based.
2. **Slack (workspace-wide)** — single Bot Token from Secret Manager. Channel routing is the orchestrator's job, not the MCP server's.
3. **Notion or Asana (decided per Augurian, not per client)** — one connection, OAuth credential stored once. Both V2 servers are workspace-scoped, not project-scoped.

The current skeleton in `orchestrator/main.py` has placeholder URLs — update them with the real ones above before the first deploy.

## Sources

- [MCP servers — Anthropic reference repo](https://github.com/modelcontextprotocol/servers)
- [Notion MCP — official docs](https://developers.notion.com/docs/get-started-with-mcp)
- [Notion MCP server — GitHub](https://github.com/makenotion/notion-mcp-server)
- [Asana MCP — official docs](https://developers.asana.com/docs/using-asanas-mcp-server)
- [@modelcontextprotocol/server-slack — npm](https://www.npmjs.com/package/@modelcontextprotocol/server-slack)
- [Slack MCP setup guide 2026 — TeamDay.ai](https://www.teamday.ai/blog/slack-mcp-server-guide-2026)
- [Google Drive MCP — Composio (Claude Agent SDK integration)](https://composio.dev/toolkits/googledrive/framework/claude-agents-sdk)
- [piotr-agier/google-drive-mcp — community Drive MCP](https://github.com/piotr-agier/google-drive-mcp)
- [Google Cloud MCP servers overview](https://docs.cloud.google.com/mcp/overview)
