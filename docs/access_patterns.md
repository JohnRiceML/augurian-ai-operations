# Access patterns — distributed Claude.ai vs centralized Augurbot

The system supports two ways an Augurian team member interacts with it. They coexist on different timelines and serve different needs.

## Today (no infrastructure)

Each team member uses **Claude.ai with Drive integration** + the four paste-ready prompts in [`claude_ai_skills/`](../claude_ai_skills/).

- **Setup:** Claude.ai Drive integration enabled per person, scoped to whichever clients they have folder access for. ~30 seconds.
- **Per-person session.** Each Augurian person runs their own chat. No shared state.
- **No deploy.** Works the moment the skills are pasted into a chat.
- **Limit:** can't be triggered from Slack, can't run on a schedule, no centralized audit trail.

This is what unblocks account leads while the centralized bot is being built. It's also the long-term ad-hoc fallback for anything off the Slack rails.

## Eventually (centralized)

**Augurbot** — the orchestrator (`orchestrator/main.py`) running on Cloud Run, with:

- **Single shared Drive connection** via service account. The service-account email is granted read access to each client's `/Augurian Clients/<Client>/` folder. One credential, many client folders, scoped per call by `drive_folder_id` from `pipelines/clients.yaml`.
- **Single GA4 connection** via the same service account. One credential, one OAuth dance, one place to revoke if compromised.
- **Slack interface.** Anyone in the Augurian workspace can ask in `#augur` (or per-client channels) and get a cited answer. No per-person setup.
- **Centralized audit log** at `/Augurian Clients/<Client>/audit/` — every tool call recorded, redacted per `pii-redaction` skill rules.

This is what scales for the team. "Easier global connections" is exactly what the centralized model buys you — set Drive up once, set GA4 up once, everyone benefits.

## Decision logic

| You need… | Use |
|---|---|
| Ad-hoc work right now, no waiting on infra | Claude.ai + paste-ready skills |
| One-off question from a phone, on the road | Claude.ai mobile app + skills |
| Scheduled / triggered runs (e.g., "every Monday morning") | Augurbot |
| Slack-native workflow (ask in channel, get answer in channel) | Augurbot |
| Audit trail for compliance / partner review | Augurbot |
| Multi-client cross-cutting analysis | Augurbot (when Q3 + the cross-client commitment-tracker contract is reviewed) |

## Migration path

The skills don't go away when the bot ships. They become the answer for:

1. Off-Slack ad-hoc work (a partner skimming Drive on a Sunday morning).
2. Backup access if Cloud Run is down.
3. Onboarding new team members before they're added to the Slack channel.

Same agent prompts, same data layer, two runtimes. The work is in the prompts and the schema; the runtime is plumbing.

## What this constrains for new features

When proposing a new capability, ask:

- **Does it need a shared connection (Drive folder, GA4 property, Slack channel)?** Default = build it for Augurbot, not for individual Claude.ai sessions. Individual users can always *use* a centralized connection through Augurbot; building the same connection per-person doesn't scale.
- **Does it need scheduling or triggering?** Augurbot only. Claude.ai doesn't run on a schedule.
- **Does it produce an audit-required output (anything that touches a client)?** Augurbot only. Claude.ai sessions don't write to the centralized audit log.
- **Is it a one-off shape an account lead might use ad-hoc?** Likely a Claude.ai skill. Add it to `claude_ai_skills/`.
