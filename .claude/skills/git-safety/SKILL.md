---
name: git-safety
description: Hard rules for git operations in the Augurian repo. Load when running any destructive or history-rewriting git command, or when something looks accidentally-committed. Belt-and-suspenders alongside the git-workflow agent.
---

# Git safety rules

## Operations that REQUIRE explicit user confirmation

These have non-trivial blast radius. Don't run them on inferred intent.

| Operation | Why it's dangerous |
|---|---|
| `git push --force` | Rewrites remote history — destroys collaborators' work |
| `git push --force-with-lease` | Safer than `--force`, but still rewrites — confirm anyway |
| `git reset --hard <ref>` | Discards uncommitted work irretrievably |
| `git checkout -- <path>` / `git restore <path>` | Discards uncommitted edits to that file |
| `git clean -fd` | Deletes untracked files; can't undo |
| `git branch -D <name>` | Force-deletes a branch even if unmerged |
| `git rebase -i` | Rewrites history; `-i` (interactive) is also blocked in this CLI |
| `git filter-repo` / `git filter-branch` | Mass-rewrites history |
| `git commit --amend` (after push) | Rewrites a published commit |

## Operations that are NEVER allowed

| Operation | Why |
|---|---|
| `git push --force` to `main` | Rewriting `main` is a coordinated incident, not a regular operation. |
| `git config --global` writes | Changes the user's global config — out of scope for repo work. |
| `--no-verify` on commit/push | Bypasses pre-commit hooks. Hooks fail for reasons; bypass only with explicit user instruction. |
| `--no-gpg-sign` / `-c commit.gpgsign=false` | Bypasses signing. Only with explicit instruction. |
| Including `.env`, `credentials/`, or anything in `.gitignore` in `git add` | Committing secrets. |

## File patterns that should NEVER appear in any commit

```
.env
.env.[!example]*
credentials/
*.json.key
service-account-*.json
*.pem
*.p12
*.pfx
audit-local/
data/
*.csv          (in repo root or pipelines/, except example fixtures)
pipelines/clients.yaml      (the populated one — clients.example.yaml is fine)
```

If `git status` shows one of these as a tracked or staged change, **stop**. Investigate before doing anything else. Possible causes:
1. Someone added an entry that overrode `.gitignore`.
2. The file was committed before it was added to `.gitignore` and is still tracked. Run `git rm --cached <path>` to untrack without deleting locally.
3. A hook is mis-configured.

## When something looks wrong

Common "this shouldn't be here" scenarios and the right responses:

### A secret made it into a commit (not yet pushed)

1. Don't just edit the file and re-commit. The secret is still in the prior commit.
2. Either:
   - `git reset --soft HEAD~1`, fix the file, re-commit. Works only if the secret is in the most recent commit.
   - For older commits: `git rebase -i <ref>` (NOT supported in this CLI's `Bash` — user must do this themselves).
3. Rotate the key anyway — assume it's compromised.

### A secret made it into a pushed commit

1. **Rotate the key immediately.** Don't wait until cleanup is done. Compromised the moment it touched a remote.
2. Use BFG Repo-Cleaner or `git filter-repo` to scrub from history.
3. Force-push (coordinated with the team) to update the remote.
4. Run a secret-scan on the whole repo to verify there's nothing else.

### `git status` shows a file you didn't change

1. Run `git diff <path>` to see what actually changed.
2. If it's a line-ending or whitespace change, check `.gitattributes` and IDE settings.
3. Don't `git checkout --` it without understanding what changed — you might lose work the IDE auto-saved.

### A merge conflict

1. Open the file, locate the conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
2. Resolve by reading both sides and choosing or merging — not by accepting one side blindly.
3. After resolving every conflict: `git add <files>` then `git commit` (or `git rebase --continue` if mid-rebase).
4. **Don't `git checkout --theirs/--ours`** without confirming with the user. Discards real work.

## Pre-push checklist

Before any `git push`:

1. `git status` — clean working tree?
2. `git log origin/<branch>..HEAD` — what am I about to push?
3. `git diff origin/<branch>..HEAD` (paginate or pipe to `head`) — last sanity check on the diff.
4. Run the secret-scanner agent on the staged/committed changes.
5. If pushing to `main` directly — is this in the allowlist (docs typos, README, etc.)? If not, this should be a PR.
