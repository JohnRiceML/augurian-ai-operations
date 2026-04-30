---
name: pii-redaction
description: Rules for redacting PII before content lands in audit logs, Slack messages, or shared drafts. Conservative — over-redact rather than leak. Load when the content might contain personal data.
---

# PII redaction rules

The audit hook (`orchestrator/hooks/redact.py`) handles the regex pass automatically. **Use this skill when you're producing content that might end up in front of someone other than the immediate reviewer.**

## What gets redacted automatically

The audit hook redacts these in any string field passed through it:

- Phone numbers (US formats: `555-555-5555`, `(555) 555-5555`, `+1 555 555 5555`, etc.) → `[PHONE]`
- Email addresses → `[EMAIL]`
- Social Security numbers (3-2-4 digits) → `[SSN]`
- Per-client redaction list from `clients.yaml:redaction_list` → `[REDACTED]`

This handles ~80% of PII risk. The remaining 20% is the part that matters.

## What you still need to think about

### In Firefly transcripts

Customer names mentioned in calls:
- "Mary called about her bill" — **redact** `Mary` if it's a customer.
- "Mary Jones, our analyst, said..." — keep `Mary Jones` if she's an Augurian/client employee.

The redaction list per client should call out specific customer names. If you spot a name that looks like a customer and isn't on the list, **flag it for the account lead** rather than redacting silently — the list needs updating, not just this one record.

### In email forwards

Email signatures contain:
- Phone numbers (caught by regex)
- Email addresses (caught by regex)
- Names + titles (NOT caught — be careful)
- Direct dial / cell numbers
- Mailing addresses (NOT caught)
- LinkedIn URLs

Strip the entire signature block from a forwarded email before processing. Look for the pattern of `--` or `Best,\n[Name]` and cut everything after.

### In ad-copy drafts

Avoid putting:
- Specific customer testimonials with names
- Internal Augurian slack quotes
- Numbers from the client's actual data when drafting copy hypotheses

### In analytics outputs

GA4 by default doesn't expose user-level PII to the API — the threshold filtering handles it. But if a client has set up custom dimensions that include PII (we've seen "userEmail" as a custom dim), refuse to read that dimension.

## Hard rules

1. **Conservative > convenient.** When unsure, redact. The audit-full/ folder has the unredacted version if a real investigation needs it.
2. **Never reverse a redaction in a downstream report.** If the audit log shows `[EMAIL]`, the report should show `[EMAIL]` too — don't go back to the source to "rehydrate" it.
3. **Don't write your own regexes ad-hoc.** Add patterns to `orchestrator/hooks/redact.py` and use the shared function.
4. **Per-client redaction list is the escalation path.** When the regex pass misses something, the answer is "add it to the list," not "patch around it in this output."

## What's NOT considered PII for our purposes

- Public business data (company names, public emails, public phone numbers listed on the company website)
- Augurian internal info (your own employees, internal slack handles)
- Data points (revenue, sessions, conversions) — those are confidential business data, but not PII; redact them only if disclosing the wrong audience would be a problem
- Client account-leads' names — they're the workflow, not the PII

## When you DO leak something

- Log it.
- Tell the engineer.
- Add the leaked term to the per-client redaction list.
- Re-run the affected audit batch through redaction if possible.
- Don't try to delete the leaked record from Drive — that breaks audit integrity. The 7-day rolling audit-full retention will age it out.
