# External resources — agents, skills, and patterns to pull from

Curated index of where to find more agents, skills, and prompt patterns. **Do not bulk-clone these into the repo.** Pull in what you need; reference the rest.

## Anthropic-published

| Repo | What's in it | When to pull from it |
|---|---|---|
| [`anthropics/skills`](https://github.com/anthropics/skills) | The official skills library (~17 skills): `algorithmic-art`, `brand-guidelines`, `canvas-design`, `claude-api`, `doc-coauthoring`, `docx`, `frontend-design`, `internal-comms`, `mcp-builder`, `pdf`, `pptx`, `skill-creator`, `slack-gif-creator`, `theme-factory`, `web-artifacts-builder`, `webapp-testing`, `xlsx` | When you need a Claude that can produce `.docx`/`.xlsx`/`.pptx`/`.pdf` outputs (Augurian: yes, account leads will want spreadsheets), build new MCP servers (`mcp-builder`), or author new skills (`skill-creator`) |
| [`anthropics/anthropic-cookbook`](https://github.com/anthropics/anthropic-cookbook) | Reference implementations of agentic patterns: orchestrator-workers, evaluator-optimizer, sub-agents, prompt caching | When the orchestrator routing needs more sophisticated patterns than the current `TASK_TO_SUBAGENT` map (Phase 4+) |
| [`anthropics/claude-cookbooks`](https://github.com/anthropics/claude-cookbooks) | Newer, broader cookbook — same agentic patterns plus more | Same as above |
| [`anthropics/claude-plugins-official`](https://github.com/anthropics/claude-plugins-official) | Official plugins (skill-creator, others) | When extending the Claude Code dev environment |

### Specific skills worth pulling into `.claude/skills/` when the time comes

| Skill | Pull when |
|---|---|
| `mcp-builder` | Adding the third or fourth MCP server. Pre-debugged knowledge. |
| `skill-creator` | The team is regularly authoring new skills (Phase 4+). |
| `xlsx` / `docx` / `pdf` | Account leads ask for outputs in those formats (most likely month 2+). |
| `internal-comms` | Tuning Slack-message style across multiple subagents. |

To pull a single skill:

```bash
# Sparse-checkout a single skill from anthropics/skills
git clone --filter=blob:none --no-checkout https://github.com/anthropics/skills.git /tmp/anthropic-skills
cd /tmp/anthropic-skills
git sparse-checkout init --cone
git sparse-checkout set skills/mcp-builder
git checkout main
# Then copy /tmp/anthropic-skills/skills/mcp-builder to .claude/skills/mcp-builder
```

License terms apply — verify before redistributing.

## Community

| Repo | Size | When to use |
|---|---|---|
| [`wshobson/agents`](https://github.com/wshobson/agents) | 79 plugin packs (each contains agents + skills + commands), e.g. `business-analytics`, `cicd-automation`, `code-refactoring`, `comprehensive-review`, `cloud-infrastructure` | When you need a starting point for a complex domain. Borrow patterns; don't copy whole. |
| [`VoltAgent/awesome-claude-code-subagents`](https://github.com/VoltAgent/awesome-claude-code-subagents) | 100+ subagents, broad domains | Browse for inspiration. The good ones become this repo's agents. |
| [`hesreallyhim/awesome-claude-code`](https://github.com/hesreallyhim/awesome-claude-code) | Curated index of skills, hooks, slash commands, plugins | Front door for finding anything Claude Code-adjacent. |
| [`travisvn/awesome-claude-skills`](https://github.com/travisvn/awesome-claude-skills) | Curated skills index | Same purpose, skills-only. |
| [`piotr-agier/google-drive-mcp`](https://github.com/piotr-agier/google-drive-mcp) | Drive + Docs + Sheets + Slides + Calendar MCP | Fallback if the official Drive MCP path stalls (see `TOOLING_MCP.md`). |
| [`korotovsky/slack-mcp-server`](https://github.com/korotovsky/slack-mcp-server) | More-featureful Slack MCP fork | Only if a feature gap forces a fork from the official npm package. |

### How to pick from community collections

For Augurian specifically:

1. **Start with this repo's agents and skills.** They're tailored.
2. **If a problem is unsolved**, search `wshobson/agents` and `VoltAgent` for a relevant one.
3. **Read the agent's prompt before using it.** Quality varies wildly.
4. **Adapt before adopting.** Generic agents have generic voices; rewrite the system prompt to match Augurian's conventions (drafter pattern, no `/raw/` writes, hard rules from `CLAUDE.md`).
5. **Attribute in the agent's frontmatter** if you adapt heavily — e.g. `# Adapted from wshobson/agents/code-reviewer (MIT)`.

## Patterns specifically worth knowing about

From the Anthropic cookbook (linked above):

- **Orchestrator-workers** — central LLM analyzes a task and dispatches subtasks to specialized workers. Augurian's `orchestrator/main.py:TASK_TO_SUBAGENT` is a static version; the dynamic version is what to evolve toward in Q3.
- **Evaluator-optimizer** — generator + evaluator loop until the evaluator approves. Useful for monthly-report drafting where a "is this good enough?" gate could pre-filter before the human review.
- **Sub-agents with cheaper models** — Haiku as a daily worker, Opus as the orchestrator. Already in use for `gsc-anomaly-detector`.

## Don't-bother list

To save time:

- **Generic "AI marketing agent" projects on GitHub.** They tend to be demos, not production patterns. Augurian's needs are specific enough that the boilerplate doesn't transfer.
- **Tools that wrap the Claude API in a SaaS layer.** Augurian's ops are simple enough that the SaaS overhead isn't worth it. (Composio is the exception — managed OAuth is real value.)
- **Vector-DB-backed knowledge bases.** Out of Q2 scope (and probably Q3). The architecture is deliberately Drive-as-warehouse.

## Sources

- [anthropics/skills](https://github.com/anthropics/skills) — official Anthropic skills library
- [anthropics/anthropic-cookbook](https://github.com/anthropics/anthropic-cookbook) — agent patterns
- [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) — official plugins
- [wshobson/agents](https://github.com/wshobson/agents) — production-ready subagent collection
- [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) — curated subagent collection
- [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — curated index of all Claude Code resources
- [travisvn/awesome-claude-skills](https://github.com/travisvn/awesome-claude-skills) — curated skills index
