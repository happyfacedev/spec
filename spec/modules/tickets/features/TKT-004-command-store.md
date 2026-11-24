---
id: TKT-004
title: Tickets in any tracker, through a command
module: tickets
status: active
questions:
  - id: Q1
    kind: preference
    text: "docs/TICKETS.md says put prints {\"ok\": true} to accept; the CLI also accepts an empty reply, or any reply that is not JSON, as success (S8). Keep accepting those, or refuse a put that does not print {\"ok\": true}?"
    default: keep accepting them
    cites: [TKT-004/S8]
    answer: 'Keep today''s behaviour; fix the docs or wording only (decided in review, 2026-10-29).'
    raised_by: null
  - id: Q2
    kind: preference
    text: "A ticket that list returns with an ID that is not a ticket ID is dropped without a finding (S5). Keep it silent, or report it as an L020 finding?"
    default: keep it silent
    cites: [TKT-004/S5]
    answer: 'Change requested in review (2026-10-29): Report it as an L020 finding. Filed as a proposal; until it lands, the spec states today''s behaviour.'
    raised_by: null
---
## Intent
Tickets can live in any tracker (GitHub Issues, Linear, Jira, a database) through a small program the project owns. The CLI speaks two operations to it and always exchanges whole tickets in the ticket file format, so every working tree and machine sees the same queue and the tracker decides how the text maps to its fields.

## Behaviour
### S1: The tracker is listed
Given tickets.StoreConfig is a tickets.CommandStore with tickets.CommandStore.command "node tools/tickets.mjs"
And `node tools/tickets.mjs list`, run through a shell from the project root, prints a tickets.TrackerList whose tickets.TrackerList.tickets holds tickets.TrackerTicket "TASK-103" and "BUG-301"
When the developer runs `spec queue` through tickets.Queue
Then cli.CommandResult.stdout holds "## Ready (2)" followed by the line "- BUG-301 bug · next tester · Fallback moves on to a third provider" (R1)

### S2: A ticket is updated with put
Given the tracker holds "TASK-103" with status open
When the CLI changes it with the note "TASK-103 implementer: started"
Then `node tools/tickets.mjs put TASK-103` runs with a tickets.TrackerPut on stdin: tickets.TrackerPut.id "TASK-103", tickets.TrackerPut.text the whole new ticket, tickets.TrackerPut.previous the text list returned, tickets.TrackerPut.note "TASK-103 implementer: started" (R2)

### S3: A new ticket is created with put
Given the tracker does not hold "TASK-104"
When `spec ticket new` saves "TASK-104" through tickets.TicketNew
Then `put TASK-104` runs with tickets.TrackerPut.previous null and tickets.TrackerPut.note "TASK-104: new ticket" (R2)
And cli.CommandResult.stdout starts "TASK-104 created" with no path after it

### S4: Tickets from a tracker are named by a virtual path
Given the tracker returns "TASK-103" whose text does not parse
When the developer runs `spec gate TASK-103` through tickets.Gate
Then the schema blockers come from "tracker/TASK-103.md" (R3)

### S5: An entry whose ID is not a ticket ID is skipped
Given list returns entries "TASK-103" and "notes"
When the developer runs `spec queue` through tickets.Queue
Then the queue holds "TASK-103" and nothing for "notes"

### S6: The tracker refuses an update
Given put prints a tickets.TrackerReply with tickets.TrackerReply.ok false and tickets.TrackerReply.error "BUG-301 changed since it was read"
When the CLI changes "BUG-301"
Then it fails with tickets.StoreRefused, saying "the tracker refused the update: BUG-301 changed since it was read" (R4)
And the ticket in the tracker is unchanged (R4)

### S7: The tracker refuses a new ticket
Given put prints tickets.TrackerReply.ok false with tickets.TrackerReply.error "read only"
When `spec ticket new` saves a ticket through tickets.TicketNew
Then it fails with tickets.StoreRefused, saying "the tracker refused the ticket: read only" (R4)

### S8: An empty reply to put is success
Given put exits 0 and prints nothing
When the CLI changes "TASK-103"
Then the change counts as saved

### S9: The command exits non-zero
Given put exits 3 and its stderr ends with the lines "a", "b", "c" and "d"
When the CLI changes "TASK-103"
Then it fails with tickets.StoreRefused, saying "the tickets command exited 3: b | c | d" (R4)

### S10: list fails
Given list exits 1
When the developer runs `spec lint`
Then it reports a finding with lint.Finding.rule "L020", lint.Finding.file "tracker", lint.Finding.line 1, a lint.Finding.message that starts "the tickets command exited 1" and lint.Finding.fix "fix the tickets command in config.json (docs/TICKETS.md)"
And no ticket is read (R5)

### S11: list prints something other than the protocol
Given list exits 0 and prints "hello"
When the developer runs `spec lint`
Then it reports a finding with lint.Finding.rule "L020", lint.Finding.file "tracker" and a lint.Finding.message that starts "`list` did not print", followed by the shape of a tickets.TrackerList (R5)

### S12: A ticket that is not in the tracker
Given list does not return "TASK-999"
When the CLI changes "TASK-999"
Then it fails with tickets.StoreRefused, saying "ticket TASK-999 is not in the tracker"

### S13: A new ticket whose ID the tracker already holds
Given list returns "TASK-104"
When the store is asked to create "TASK-104"
Then it fails with tickets.StoreRefused, saying "TASK-104 already exists in the tracker", and put does not run

### S14: An entry whose ID is not a ticket ID is reported by lint
Given list returns entries "TASK-103" and "notes"
When the developer runs `spec lint`
Then it reports a finding with lint.Finding.rule "L020", lint.Finding.severity "warning", lint.Finding.file "tracker", lint.Finding.line 1, lint.Finding.id null, lint.Finding.message "`list` listed ''notes'', which is not a ticket ID" and lint.Finding.fix "fix the tickets command in config.json (docs/TICKETS.md)" (R6)
And cli.CommandResult.exitCode is 0

## Rules
- R1: The command runs through `/bin/sh` from the project root, with `list` or `put <ID>` appended; the only value the CLI adds is a validated ticket ID
- R2: Every put sends the whole ticket text, the text the CLI read (null for a new ticket) and why
- R3: Findings name a tracker ticket `tracker/<ID>.md`
- R4: A refusal or a non-zero exit stops the command, and nothing is saved
- R5: When list fails, the store holds no tickets and lint reports why
- R6: An entry that list returns with an ID that is not a ticket ID is left out of the tickets, and lint reports it as an L020 warning at tracker line 1, with no ID, never as an error

## Out of scope
- Stage commits: with a tracker they hold no ticket file (pipeline)
- How a tracker maps the text to its own fields: the adapter's choice
