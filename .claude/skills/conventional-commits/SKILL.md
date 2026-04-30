---
name: conventional-commits
description: Augurian's commit message convention. Load when generating a commit message, reviewing one, or asked "how do I write this commit?"
---

# Conventional Commits — Augurian style

Format:

```
<type>(<scope>): <short summary>

<body — wraps at 72 chars, explains why>

<footer — Refs, BREAKING CHANGE, Co-Authored-By>
```

## Types

| Type | Use for |
|---|---|
| `feat` | New visible feature (new agent, new puller, new CLI command) |
| `fix` | Bug fix |
| `docs` | Docs only — README, playbook, phase checklists |
| `chore` | Tooling, dep bumps, no behavior change |
| `refactor` | Code change, no behavior change, no bug fix |
| `test` | Tests added/updated |
| `perf` | Performance |
| `ci` | CI/CD only |

## Scopes (this repo)

| Scope | Covers |
|---|---|
| `orchestrator` | `orchestrator/*` |
| `pipelines` | `pipelines/*` |
| `agents` | `.claude/agents/*` |
| `skills` | `.claude/skills/*` |
| `docs` | `docs/*`, root `README.md`, `CLAUDE.md` |
| `config` | `pyproject.toml`, `.env.example`, `clients.example.yaml`, `.claude/settings.json` |

If a change spans multiple scopes, pick the dominant one or omit the scope.

## Subject line rules

- **Imperative mood.** "add" not "added", "fix" not "fixed".
- **No trailing period.**
- **≤ 60 chars where possible.** 72 is the hard cap.
- **Lowercase first letter** (after the `:`).

## Body — explain *why*

The diff shows *what*. The commit message captures *why*. Examples that earn their keep:

```
feat(pipelines): pull GA4 in client TZ, not UTC

GA4 reports in the property's configured time zone. The puller was
computing 'yesterday' in UTC, which gave us partial-day data for
clients in CST and PT timezones. Switching to per-client timezone
via clients.yaml fixes both.

Refs: docs/phases/phase-1-first-pipeline.md#gotchas
```

```
fix(orchestrator): block runs when client_context.md is missing

We hit a case where Theisen's onboarding skipped the context file and
the monthly drafter generated generic copy that the account lead had
to rewrite from scratch. Now the orchestrator refuses to run any task
for a client without a context file in /context/.

Refs: phase-0-foundation.md (context file is non-negotiable)
```

## Footers

- `Refs: <doc-path>` or `Refs: #123` — link to the doc / ticket that motivates the change.
- `BREAKING CHANGE: <description>` — if behavior changes in a way users (engineers, account leads) need to know about.
- `Co-Authored-By:` — when pairing.

## What NOT to do

- Don't write `fix bug`. What bug?
- Don't write `update foo.py`. The diff shows that.
- Don't write `WIP`. Squash WIPs before merging.
- Don't write a 200-word essay. Two short paragraphs at most.
- Don't paste error messages or stack traces in the subject line.
- Don't include API keys, tokens, or PII in any line of the message.

## When to skip the body

OK to omit body for:
- One-line typo fixes
- Dep version bumps with no behavior change
- Renaming a single var or function

Always include body for:
- Anything in `orchestrator/` or `pipelines/`
- Anything that changes the data contract (Drive paths, schemas)
- Bug fixes — explain the bug
