---
name: feature
description: Add new behaviour to cart, spec first. Interviews the user until the change is clear, files a proposal ticket, and starts it on request. Use when the user wants something the software does not do yet.
argument-hint: <what the feature should do>
allowed-tools: Bash(.claude/skills/cart-spec/scripts/spec *)
---
# /feature: new behaviour, spec first

What the spec says near this request:

!`.claude/skills/cart-spec/scripts/spec brief '$0' '$1' --query '$ARGUMENTS'`

Turn the request into one proposal ticket. The spec changes first; tests and code follow it.

1. Find where it belongs. Which features does it extend, or which are closest when it is a new area? Which contracts does it read, change or add? The spec-writer adds new units later; the ticket names the existing ones it touches.
2. Interview the user until the behaviour is clear (rules below).
3. File the ticket with `"type": "proposal"`.

How to ask:
- Read what the spec already says before asking anything. Never ask what the spec answers.
- Ask one question at a time, only about something that changes behaviour: inputs, outputs, limits, errors, what happens at the edges. Offer the likely answers as choices when you can.
- Never invent behaviour. What the user does not know becomes a question on the ticket: a `blocker` if the answer could change behaviour, a `preference` with a `default` if a reversible default is safe.
- Stop asking once every Then step could be written with a concrete value a test can check.
- If no one can answer you (you run unattended), do not wait: put every open point on the ticket as a question and go on.

How to file it:
- First check that no ticket already covers it: `.claude/skills/cart-spec/scripts/spec queue`, and `.claude/skills/cart-spec/scripts/spec show <ticket ID>` for any that looks close. If one does, tell the user its ID and file nothing.
- Name units by their IDs: features (`PRV-002`), scenarios (`PRV-002/S3`), contracts (`providers.ProviderConfig`, or a field when only it changes). Check each with `.claude/skills/cart-spec/scripts/spec show <ID>`; search with `.claude/skills/cart-spec/scripts/spec find <words>`.
- Write the ticket as JSON to a file with your file tool (for example `ticket.json` in a scratch folder), then run `.claude/skills/cart-spec/scripts/spec ticket new --dry-run <file>`. Fix what the gate reports (an unknown ID, a scope gap), then run `.claude/skills/cart-spec/scripts/spec ticket new <file>`. Open questions may stay open: they are for the user.
  The JSON: `{ "type", "title", "touches": [IDs], "violates": [scenario IDs], "depends_on": [ticket IDs], "questions": [{ "kind": "blocker" | "preference", "text", "default", "cites": [IDs] }], "body": "what the user wants, in their words" }`.
- `depends_on` is only for a ticket whose result this one needs, for example a contract it adds. Tickets that change the same files or features do not depend on each other: `.claude/skills/cart-spec/scripts/spec plan` keeps conflicting tickets apart, and merging resolves shared files.
- Show the user the ticket: its ID, what it touches, its reach (`.claude/skills/cart-spec/scripts/spec impact <ID>`), and its open questions.
- Ask before starting it. On yes: `.claude/skills/cart-spec/scripts/spec orchestrate <ID>`. It runs the stages (spec first, then tests, then code, then review) and merges the ticket when everything passes.
- Unattended, never start it: no one said yes. Report the ticket and stop.
