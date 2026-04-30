# Client disclosure worksheet

Per-client. Filled out by the account lead before Phase 1 of that client's onboarding. Determines what gets shared, what doesn't, and how visible the AI work can be.

This is a worksheet, not policy. Augurian leadership has a default policy (see below); this worksheet captures the per-client variant.

## Augurian's default policy

> *Default to disclosing AI involvement when asked, but don't proactively brand the work as "AI-drafted" unless the client has explicitly opted in. Every output is reviewed and edited by an Augurian human before it ships.*

(Augurian leadership may revise this default. Once revised, update this section.)

## Per-client worksheet

Fill in once per client. Stored at `/Augurian Clients/<client>/context/disclosure_stance.md` alongside `client_context.md`.

```markdown
# Client disclosure stance — {Client name}

**Filled by:** {account lead name}
**Date:** {date}
**Reviewed by leadership on:** {date} — {reviewer}

## Has anyone at the client been told that AI is in the loop?

- [ ] No, and we don't want them to know yet
- [ ] No, but we'd disclose if directly asked
- [ ] Yes, in passing — they're aware but not signed off
- [ ] Yes, with explicit sign-off

## If asked directly "are you using AI on our account?", the truthful answer is:

{One sentence the account lead would actually say.}

## What this means for the workflow

| Stance | Implication |
|---|---|
| No, don't want known | Drafted reports must be substantively edited before sending. No telltale phrases. The "looks AI-generated" check happens before send. |
| No, but disclose if asked | Same as above; no proactive labeling. |
| Yes, in passing | Drafted outputs can keep "drafted by Augur" in internal Slack threads but not in client deliverables. |
| Yes, signed off | Drafted outputs CAN be labeled to the client (e.g. "AI-drafted summary, reviewed by Sarah"). Some clients prefer this. |

## Specific things to avoid in deliverables for this client

- {List per-client. E.g.: "Avoid the word 'leverage' — they joke about it." or "No emoji in headlines." or "Always include the loyalty-program metric."}

## Approved AI-disclosure language (if applicable)

{If the client has signed off on disclosure, the exact wording Augurian uses. Don't improvise.}

## Quarterly review trigger

This stance gets re-confirmed when:

- [ ] The account renews
- [ ] There's a leadership change at the client
- [ ] Augurian's default policy changes
- [ ] The client asks about AI

Last reviewed: {date}
Next review due: {date + 3 months OR triggering event}
```

## How this connects to the rest of the system

- The `client_context.md` references the disclosure stance ("disclosure stance: see disclosure_stance.md") — keeps the agent aware.
- The audit hook respects the stance: if "No, don't want known," the daily Slack summary in `#agent-activity` doesn't mention the client by name in any cross-channel post.
- Drafted client-facing outputs include a `<!-- DISCLOSURE: <stance> -->` HTML comment as a hint for the human reviewer.

## What this is NOT

- Not legal advice. If a client has a contractual or regulatory restriction on AI tooling (some financial / healthcare clients do), check the contract first.
- Not a substitute for a real privacy review. PII handling is in `pii-redaction` skill; this worksheet is about AI disclosure, not data privacy.
- Not optional. A client without a filled worksheet doesn't get onboarded into the AI-ops system.
