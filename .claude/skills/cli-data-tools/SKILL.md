---
name: cli-data-tools
description: Useful command-line tools for inspecting, debugging, and manipulating Drive warehouse data. Load when the engineer needs to ad-hoc-query a CSV, parse JSONL, sync Drive locally, or audit the warehouse without writing a Python script.
---

# CLI tools for the data layer

When you can answer the question with a one-liner, do. Don't write a Python script for what `jq` or `csvkit` already does.

## The toolkit

```bash
# JSON / JSONL
brew install jq dasel

# CSV
brew install csvkit xsv

# Files / search
brew install fd ripgrep

# Drive sync
brew install rclone        # friendlier than gcloud for Drive
# OR: gcloud (already installed if you're on the Augurian project)

# Parallelism
brew install parallel
```

## Common questions and one-liners

### "Show me all open deliverables for Coborn's due in the next 30 days."

```bash
jq -c 'select(
  .client == "coborns" and
  (.type == "deliverable" or .type == "action_item") and
  .status == "open" and
  .due_date >= "'"$(date +%Y-%m-%d)"'" and
  .due_date <= "'"$(date -v+30d +%Y-%m-%d)"'"
)' /path/to/coborns/processed/commitments/_index.jsonl \
  | jq -s 'sort_by(.priority, .due_date) | reverse | .[:10]'
```

### "Which days in April had no GA4 puller run?"

```bash
fd -e csv . /path/to/coborns/raw/ga4/ -d 1 \
  | awk -F'/' '{print $NF}' \
  | sed 's/.csv//' \
  | sort \
  | comm -23 \
    <(seq -f '2026-04-%02g' 1 30) \
    -
```

### "Top 10 queries by clicks in last week's GSC pull"

```bash
csvgrep -c date -r '2026-04-2[1-7]' /path/to/coborns/raw/gsc/2026-04-27.csv \
  | csvsort -c clicks -r \
  | head -11    # +1 for header
```

### "Show me every per-call JSON where 'launch' was tagged"

```bash
fd -e json . /path/to/coborns/processed/commitments/ \
  | xargs jq -c 'select(.items[]?.tags | index("launch"))' \
  | head
```

### "Find any audit log line that mentions a customer name from the redaction list"

```bash
# Belt-and-suspenders verification that the redaction hook is working.
while IFS= read -r name; do
  rg -F "$name" /path/to/coborns/audit/ && echo "LEAK: $name" >&2
done < /path/to/coborns/context/redaction_list.txt
```

(If anything matches, redaction is broken. Investigate.)

### "Sync Coborn's Drive folder locally for offline work"

```bash
# Configure rclone once (rclone config), then:
rclone sync "augurian-drive:Augurian Clients/Coborn's/processed" \
  ~/coborns-local-mirror/ \
  --include "*.json" --include "*.jsonl" --include "*.csv" \
  --exclude ".tmp/**" \
  -P
```

### "Roll up commitments by month for a quarterly review"

```bash
jq -c 'select(.status == "open" or .status == "done") | {
  month: (.captured_date[:7]),
  type: .type,
  client: .client
}' /path/to/coborns/processed/commitments/_index.jsonl \
  | jq -s 'group_by(.month, .type) | map({month: .[0].month, type: .[0].type, count: length})'
```

## When to use jq vs csvkit vs Python

| Tool | Sweet spot |
|---|---|
| `jq` | JSON, JSONL. Anything in `_index.jsonl` or `processed/commitments/*.json`. |
| `dasel` | YAML (clients.yaml). Same operations as jq, multi-format. |
| `csvkit` (`csvgrep`, `csvjson`, `csvsort`, `csvsql`) | CSVs. Anything in `/raw/`. Slower than `xsv` but the SQL flavor is convenient. |
| `xsv` | Big CSVs (>100MB) or tight loops. Faster than csvkit. |
| `rg` (ripgrep) | Searching across the warehouse for a string. Honors `.gitignore` by default — useful for not searching audit-local. |
| `fd` | "Show me files modified recently" / "show me files matching pattern X." |
| Python | Anything > ~30 lines of CLI piping, anything that needs a real data structure (trees, graphs), anything writing structured output back to Drive. |

If your `jq` pipeline has more than 3 stages, consider switching to Python. CLI clarity drops fast.

## Drive sync gotchas

- `rclone sync` is destructive on the destination. Use `rclone copy` if unsure; only `sync` when you actively want one-way mirroring.
- Both `rclone` and `gcloud` use exponential backoff. If you're hitting Drive rate limits, slow down rather than retry harder.
- Don't sync `audit-full/` to your laptop. PII is unredacted there. Use `audit/` (redacted) for offline work.

## Audit-friendly logging

When you write a script that touches the warehouse, log:

```bash
# At the top of every ad-hoc script:
echo "[$(date -Is)] $(whoami) on $(hostname) running: $0 $*" >> ~/augurian-cli.log
```

That single log file is what you point at when leadership asks "did anyone touch the Coborn's data on the 23rd?"

## What NOT to do from the CLI

- **Don't `chmod` or `chown` Drive-mounted files.** Permissions there mean nothing locally; you'll just confuse rclone.
- **Don't `vim` an `_index.jsonl` file.** Manual edits break the append-only invariant. Use `jq` to filter; never edit lines in place.
- **Don't `cat .env` into a script.** Use `set -a; source .env; set +a` and unset after.
- **Don't `curl` an Anthropic / Google API endpoint with a real token in the command line.** History files capture commands.
