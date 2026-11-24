---
id: TKT-007
title: Gate a ticket with spec gate
module: tickets
status: active
provides: [tickets.Gate]
invariants: [INV-006]
---
## Intent
No work starts on a ticket without a clear path. `spec gate` says whether a ticket may start, lists every reason it may not with what each is about, says how to clear each kind, and lists the preferences work will proceed on. The same check runs before a brief is built and before a stage starts, so a refused ticket gets no work.

## Behaviour
### S1: A ready ticket
Given "TASK-101" has nothing that stops it and no open preference
When the developer runs `spec gate TASK-101` through tickets.Gate
Then cli.CommandResult.stdout is "TASK-101: ready" and a newline
And cli.CommandResult.exitCode is 0

### S2: An open blocker question on the ticket
Given "PROP-206" has the open blocker question Q1 "Do renamed providers keep their usage history?" and nothing else stops it
When the developer runs `spec gate PROP-206` through tickets.Gate
Then cli.CommandResult.stdout is exactly (R1):
```text
PROP-206: not ready

Blockers:
- question PROP-206#Q1: Do renamed providers keep their usage history?

To unblock:
- question: answer it by setting the question's answer: field in its owner's file (the ID before #); it stays for the record
```
And cli.CommandResult.exitCode is 1

### S3: An open blocker on a unit in scope
Given "TASK-103" touches the feature "PRV-002", which has the open blocker question Q1 "Does a fallback count toward usage?" and the preference Q2 "Notice wording?" with default "as in UI-001"
When the developer runs `spec gate TASK-103` through tickets.Gate
Then tickets.GateResult.blockers is exactly one tickets.GateBlocker: kind "question", id "PRV-002#Q1", text "Does a fallback count toward usage?" (R2)
And tickets.GateResult.preferences lists "PRV-002#Q2"

### S4: A violated scenario puts its feature's questions in scope
Given "BUG-301" violates "PRV-002/S3", and "PRV-002" has the open blocker question Q1
When the developer runs `spec gate BUG-301` through tickets.Gate
Then the ids of tickets.GateResult.blockers are exactly "PRV-002#Q1" (R2)

### S5: An answered blocker no longer blocks
Given "BUG-301" violates "PRV-002/S3", and Q1 of "PRV-002" is a blocker with tickets.Question.answer "no"
When the developer runs `spec gate BUG-301` through tickets.Gate
Then tickets.GateResult.ready is true (R2)

### S6: A preference proceeds on its default
Given "PROP-202" has the open preference Q1 "In what order does the model picker list enabled providers?" with default "alphabetical", and nothing stops it
When the developer runs `spec gate PROP-202` through tickets.Gate
Then cli.CommandResult.stdout is exactly (R3):
```text
PROP-202: ready

Preferences (work proceeds on the default):
- PROP-202#Q1 In what order does the model picker list enabled providers? → alphabetical
```
And cli.CommandResult.exitCode is 0

### S7: The JSON result
Given "PROP-202" as in S6
When the developer runs `spec gate PROP-202 --format json` through tickets.Gate
Then cli.CommandResult.stdout is a tickets.GateResult with tickets.GateResult.ticket "PROP-202", tickets.GateResult.ready true, tickets.GateResult.blockers empty, and tickets.GateResult.preferences one tickets.GatePreference with tickets.GatePreference.id "PROP-202#Q1", tickets.GatePreference.default "alphabetical" and tickets.GatePreference.text "In what order does the model picker list enabled providers?"

### S8: JSON for a refused ticket exits 1
Given "PROP-206" as in S2
When the developer runs `spec gate PROP-206 --format json` through tickets.Gate
Then tickets.GateResult.ready is false and cli.CommandResult.exitCode is 1

### S9: Blockers in a fixed order, each fix once
Given "TASK-930" has tickets.Ticket.type "proposal" (a schema problem, since its prefix is TASK), an unknown ID "PRV-009" in touches, an open blocker question Q1, and depends on "BUG-301", which is open
When the developer runs `spec gate TASK-930` through tickets.Gate
Then the kinds in tickets.GateResult.blockers are "schema", "unresolved", "question", "dependency", in that order (R4)
And "To unblock:" lists one line per kind present, in that order (R4)
And the schema line is "- schema: fix the ticket file so it matches the ticket schema (tickets/TASK-930.md)" (R5)
But once "TASK-930" is absorbed into "TASK-101", its blockers are only the one of kind "absorbed", which comes before every other kind (R4)

### S10: How each kind is cleared
Given a ticket refused for every kind of tickets.BlockerKind
When the developer runs `spec gate` for it through tickets.Gate
Then "To unblock:" holds these lines, in this order (R5):
| line |
| - absorbed: nothing to clear: work on the ticket it was absorbed into |
| - schema: fix the ticket file so it matches the ticket schema (<ticket file>) |
| - unresolved: correct the ID in touches or violates, or create the unit first |
| - removed: point the ticket at the unit that replaced it |
| - draft: check the drafted unit against what the software should do, then run spec confirm <ID> |
| - question: answer it by setting the question's answer: field in its owner's file (the ID before #); it stays for the record |
| - scope_gap: add the named feature to touches, or narrow the contracts the ticket touches |
| - dependency: finish the ticket it depends on and merge its branch; this clears by itself, no answer is needed |

### S11: A ticket the store does not hold
Given the store holds "PROP-201", "PROP-202", "PROP-205" and "PROP-206" and no file "tickets/PROP-20.md"
When the developer runs `spec gate PROP-20` through tickets.Gate
Then the command fails with tickets.UnknownTicket, and cli.CommandResult.stderr starts "Unknown PROP-20. Did you mean PROP-201?"
And cli.CommandResult.exitCode is 2

### S12: An argument that is not a ticket ID
Given the spec has a feature "PRV-001"
When the developer runs `spec gate PRV-001` through tickets.Gate
Then the command fails with tickets.UnknownTicket, and cli.CommandResult.stderr starts "Unknown PRV-001."

### S13: Wrong number of arguments
Given the store holds "TASK-101" and "TASK-102"
When the developer runs `spec gate TASK-101 TASK-102` through tickets.Gate
Then the command fails with cli.UsageError, and cli.CommandResult.stderr starts "usage: spec gate <TICKET>"
And cli.CommandResult.exitCode is 2

### S14: Questions outside the scope do not block
Given "TASK-101" touches only "PRV-001", and "PRV-002" has an open blocker question
When the developer runs `spec gate TASK-101` through tickets.Gate
Then tickets.GateResult.blockers holds no question (R2)

### S15: A preference without a default is not listed
Given a unit in scope of "TASK-101" has the preference Q1 with tickets.Question.default null
When the developer runs `spec gate TASK-101 --format json` through tickets.Gate
Then tickets.GateResult.preferences does not list it

### S16: An open external question blocks like a blocker
Given "PROP-208" has the open question Q1 with tickets.Question.kind "external" and the text "Does Claude Code run PreToolUse callbacks in parallel?", and nothing else stops it
When the developer runs `spec gate PROP-208 --format json` through tickets.Gate
Then tickets.GateResult.blockers is exactly one tickets.GateBlocker: kind "question", id "PROP-208#Q1", text "Does Claude Code run PreToolUse callbacks in parallel?" (R2, INV-006)
And tickets.GateResult.preferences is empty, and cli.CommandResult.exitCode is 1
And an open external question on a unit in scope blocks the same way, and one outside the scope does not (R2)
But once tickets.Question.answer is "yes, verified in a spike", tickets.GateResult.ready is true (R2, INV-006)

## Rules
- R1: The text output is `<ID>: ready` or `<ID>: not ready`; then, when there are blockers, "Blockers:" with one `- <kind> <id>: <text>` line each and "To unblock:"; then, when there are preferences, "Preferences (work proceeds on the default):" with one `- <id> <text> → <default>` line each; sections are separated by a blank line
- R2: An open question blocks when it is a blocker or an external question on the ticket, or on a unit in its scope: each ID in touches, violates and changed, and the feature that owns each named scenario or rule; an answered question never blocks
- R3: An open preference with a default in that scope never blocks; it is listed with its default
- R4: Blockers are ordered by kind (absorbed, schema, unresolved, removed, draft, question, scope_gap, dependency), then by ID in natural order; the exit code is 0 when there is none, else 1
- R5: "To unblock:" names, once per kind present, how to clear that kind; the schema line ends with the ticket's file in parentheses

## Out of scope
- What makes a ticket file valid (TKT-001), which IDs and drafts block (TKT-008), dependencies (TKT-009), and absorbed tickets (TKT-012)
- Refusing a brief or a stage for a refused ticket: pipeline
