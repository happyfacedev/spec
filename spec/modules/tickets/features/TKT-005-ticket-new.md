---
id: TKT-005
title: Create a ticket with spec ticket new
module: tickets
status: active
writes: [tickets.Ticket]
provides: [tickets.TicketNew]
decisions: [ADR-002]
questions:
  - id: Q1
    kind: preference
    text: "When the JSON comes from a file and does not parse, the message still says the ticket is read as JSON on stdin (S13). Keep that wording, or name the file?"
    default: keep the wording
    cites: [TKT-005/S13, TKT-005/S24]
    answer: 'Change requested in review (2026-10-29): Name the file. Done in PROP-021: the message names the file (S24, R10).'
    raised_by: null
  - id: Q2
    kind: preference
    text: "The next ID counts only tickets that parse (S3), so a ticket file that does not parse can hold the ID the CLI picks, and saving then fails with tickets.StoreRefused. Keep that, or also count the IDs of files that do not parse?"
    default: keep it as it is
    cites: [TKT-005/S3, TKT-005/S23]
    answer: 'Change requested in review (2026-10-29): Count the IDs of broken files too. Done in PROP-021: a ticket file that does not parse still holds the ID in its name (S3, S23, R1).'
    raised_by: null
---
## Intent
Commands such as /feature and /bug, and people, create tickets from a few structured fields instead of hand-writing frontmatter. The CLI picks the next free ID, writes the ticket in the ticket format, saves it, and gates it at once, so the person sees straight away whether it can start and what to fix.

## Behaviour
### S1: The next ID of each type
Given the store holds "PROP-201", "PROP-206" and "BUG-301"
When the developer runs `spec ticket new` through tickets.TicketNew with tickets.NewTicket.type "proposal"
Then the new ticket's tickets.Ticket.id is "PROP-207" (R1)

### S2: The first ticket of a type
Given the store holds no ticket of type task
When the developer runs `spec ticket new` through tickets.TicketNew with tickets.NewTicket.type "task"
Then the new ticket's tickets.Ticket.id is "TASK-001" (R1)

### S3: A ticket file that does not parse still holds its ID
Given the store holds "TASK-101" and a file "tickets/TASK-150.md" that does not parse
When the developer runs `spec ticket new` through tickets.TicketNew with tickets.NewTicket.type "task"
Then the CLI picks "TASK-151" (R1)

### S4: The ticket as written
Given the store holds "PROP-206" as its highest proposal
When the developer runs `spec ticket new --format json` through tickets.TicketNew with the JSON {"type": "proposal", "title": "Show the token count under each reply", "touches": ["PRV-003"], "questions": [{"kind": "preference", "text": "Show counts for replies that were stopped?", "default": "yes"}], "body": "Under each reply, show how many tokens it used."}
Then "tickets/PROP-207.md" holds exactly (R2):
```text
---
id: PROP-207
type: proposal
title: Show the token count under each reply
status: open
stage: null
touches: [PRV-003]
violates: []
depends_on: []
changed: []
questions:
  - id: Q1
    kind: preference
    text: Show counts for replies that were stopped?
    default: yes
    cites: []
    answer: null
    raised_by: null
history: []
---
Under each reply, show how many tokens it used.
```

### S5: The JSON result
Given the same input as S4
When the developer runs `spec ticket new --format json` through tickets.TicketNew
Then cli.CommandResult.stdout is a tickets.TicketNewResult with tickets.TicketNewResult.ticket "PROP-207", tickets.TicketNewResult.file "tickets/PROP-207.md" and tickets.TicketNewResult.gate.ready true
And tickets.TicketNewResult.gate.preferences lists one tickets.GatePreference with id "PROP-207#Q1"
And cli.CommandResult.exitCode is 0

### S6: Committed on its own
Given the project is a git repository with a clean working tree
When the developer creates "PROP-207" titled "Show the token count under each reply" through tickets.TicketNew
Then the newest commit has the subject "PROP-207: new proposal, Show the token count under each reply" and holds only "tickets/PROP-207.md" (R3)
And `git status --porcelain` prints nothing

### S7: The text result
Given the store holds "TASK-103" as its highest task
When the developer runs `spec ticket new` through tickets.TicketNew for a task that touches "CNV-003"
Then cli.CommandResult.stdout starts "TASK-104 created (tickets/TASK-104.md)", a blank line, then the gate's text, starting "TASK-104: ready"

### S8: A ticket the gate refuses is still created
Given the spec has no scenario "CNV-003/S9"
When the developer creates a bug with tickets.NewTicket.violates ["CNV-003/S9"] through tickets.TicketNew
Then the ticket "BUG-303" is saved (R4)
And tickets.TicketNewResult.gate.blockers is one tickets.GateBlocker with kind "unresolved" and id "CNV-003/S9"
And cli.CommandResult.exitCode is 0 (R4)

### S9: Read from a file
Given the file "ticket.json" holds a valid tickets.NewTicket
When the developer runs `spec ticket new ticket.json` through tickets.TicketNew with tickets.TicketNew.file "ticket.json"
Then the ticket is read from "ticket.json", relative to the working directory, and stdin is not read

### S10: A dry run saves nothing
Given the file "ticket.json" holds a task that touches "CNV-003", and the highest task is "TASK-103"
When the developer runs `spec ticket new --dry-run ticket.json` through tickets.TicketNew with tickets.TicketNew.dryRun true
Then cli.CommandResult.stdout starts "TASK-104 would be created (dry run; nothing saved)", a blank line, then "TASK-104: ready" (R5)
And "tickets/TASK-104.md" does not exist, and nothing is committed (R5)

### S11: A dry run in JSON
Given the same input as S10
When the developer runs `spec ticket new --dry-run --format json ticket.json` through tickets.TicketNew
Then cli.CommandResult.stdout is a tickets.TicketNewResult with tickets.TicketNewResult.ticket "TASK-104", tickets.TicketNewResult.file null and tickets.TicketNewResult.dryRun true

### S12: The gate on a draft
Given "CNV-003" is a draft
When the developer runs `spec ticket new --dry-run` through tickets.TicketNew for a task that touches "CNV-003/S1"
Then cli.CommandResult.stdout holds the line "- draft CNV-003: CNV-003 is a draft, not yet confirmed" and the text "run spec confirm <ID>"

### S13: Input that is not JSON
Given stdin holds "not json"
When the developer runs `spec ticket new` through tickets.TicketNew
Then the command fails with tickets.NotJson
And cli.CommandResult.stderr starts "spec ticket new reads the ticket as JSON on stdin: ", then the seven keys of tickets.NewTicket in braces, a blank line and the usage text (R10)
And cli.CommandResult.exitCode is 2

### S14: A malformed ID
Given the JSON has tickets.NewTicket.touches ["not an id"]
When the developer runs `spec ticket new` through tickets.TicketNew
Then the command fails with tickets.InvalidTicket, and cli.CommandResult.stderr starts "the ticket is not valid: " (R6)
And cli.CommandResult.exitCode is 1
And nothing is saved (R6)

### S15: A missing body
Given the JSON has no body key
When the developer runs `spec ticket new` through tickets.TicketNew
Then the command fails with tickets.InvalidTicket, and cli.CommandResult.stderr is "the ticket is not valid: body: Invalid input: expected string, received undefined" (R6)

### S16: An unknown key
Given the JSON also has the key "owner"
When the developer runs `spec ticket new` through tickets.TicketNew
Then the command fails with tickets.InvalidTicket, and cli.CommandResult.stderr starts "the ticket is not valid: (root): Unrecognized key: " and names "owner" (R6)

### S17: The file does not exist
Given there is no file "missing.json"
When the developer runs `spec ticket new missing.json` through tickets.TicketNew
Then the command fails with tickets.MissingFile, and cli.CommandResult.stderr is "missing.json does not exist"
And cli.CommandResult.exitCode is 1

### S18: Questions are numbered in order
Given the JSON has two questions, a blocker then a preference
When the developer runs `spec ticket new` through tickets.TicketNew
Then the ticket's tickets.Ticket.questions are "Q1" (the blocker) then "Q2" (the preference), each with tickets.Question.answer null and tickets.Question.raised_by null (R2)

### S19: Outside a git repository
Given the project root is not a git repository
When the developer creates a ticket through tickets.TicketNew
Then the ticket file is written and nothing is committed (R3)

### S20: A long title stays on one line
Given the JSON has tickets.NewTicket.title of 100 characters
When the developer runs `spec ticket new` through tickets.TicketNew
Then the ticket is saved and the new tickets.Ticket.title line in its file is on one line, holding all 100 characters (R7)
And cli.CommandResult.exitCode is 0

### S21: Filed from a ticket branch
Given the tickets are files in the repository, "main" is checked out in "/work/app", and the developer is in the worktree of "TASK-101", on "ticket/TASK-101"
When the developer runs `spec ticket new` there through tickets.TicketNew
Then the command fails with tickets.NotOnBaseBranch, and cli.CommandResult.stderr is "file tickets from main: run spec ticket new in /work/app; nothing was saved" (R8)
And no ticket file is written and "ticket/TASK-101" gets no commit
And cli.CommandResult.exitCode is 1

### S22: A commit git refuses saves nothing
Given the project is a git repository on "main" whose pre-commit hook prints "commits are closed" and exits 1
When the developer runs `spec ticket new` through tickets.TicketNew for a task
Then the command fails with tickets.CommitRefused, and cli.CommandResult.stderr is "git could not commit tickets/TASK-104.md: commits are closed; nothing was saved" (R9)
And "tickets/TASK-104.md" does not exist and nothing is uncommitted
And cli.CommandResult.exitCode is 1

### S23: A broken file on the next ID is skipped, not refused
Given the store holds "TASK-103" as its highest task, and "tickets/TASK-104.md" is a committed file that does not parse
When the developer runs `spec ticket new ticket.json` through tickets.TicketNew for a task that touches "CNV-003"
Then cli.CommandResult.stdout starts "TASK-105 created (tickets/TASK-105.md)" (R1)
And "tickets/TASK-104.md" is unchanged
And cli.CommandResult.exitCode is 0

### S24: A JSON file that does not parse
Given the file "ticket.json" holds "not json"
When the developer runs `spec ticket new ticket.json` through tickets.TicketNew with tickets.TicketNew.file "ticket.json"
Then the command fails with tickets.NotJson
And cli.CommandResult.stderr starts "spec ticket new reads the ticket as JSON from ticket.json: ", then the seven keys of tickets.NewTicket in braces, a blank line and the usage text (R10)
And cli.CommandResult.exitCode is 2
And nothing is saved

### S25: A broken copy on another ticket branch holds its ID
Given the tickets are files in a git repository on "main", whose highest task is "TASK-103"
And "ticket/TASK-150" is not merged into "main", no tree has it checked out, and its "tickets/TASK-150.md" does not parse, while "main" has no "tickets/TASK-150.md"
When the developer runs `spec ticket new ticket.json` through tickets.TicketNew for a task that touches "CNV-003"
Then cli.CommandResult.stdout starts "TASK-151 created (tickets/TASK-151.md)" (R1)
And cli.CommandResult.exitCode is 0

### S26: A tracker's next ID comes from its first list
Given tickets.StoreConfig is a tickets.CommandStore whose first list prints a tickets.TrackerList holding "TASK-103", and whose every later list exits 3
When the developer runs `spec ticket new --dry-run ticket.json` through tickets.TicketNew for a task that touches "CNV-003"
Then cli.CommandResult.stdout starts "TASK-104 would be created (dry run; nothing saved)" (R1)
And cli.CommandResult.exitCode is 0

### S27: An absorbed ticket holds its ID
Given the store holds the open task "TASK-103" and "tickets/TASK-104.md", whose tickets.Ticket.status is "absorbed" with tickets.Ticket.absorbed_into "TASK-103"
When the developer runs `spec ticket new --dry-run ticket.json` through tickets.TicketNew for a task that touches "CNV-003"
Then cli.CommandResult.stdout starts "TASK-105 would be created (dry run; nothing saved)" (R1)

## Rules
- R1: A new ID is the type's prefix (PROP, BUG or TASK), a dash, and one more than the highest number of that type, written with at least three digits. With the files store, the highest number counts every ticket in the store, absorbed ones included, every `.md` file under the ticket folder named `<prefix>-<n>.md`, and every ticket whose live copy is on a ticket branch or in another worktree (WSP-004), whether or not that file or copy parses, so the ID picked is never taken here nor when that branch merges. With the command store, it counts the tickets of the list the command read first; no later list changes the ID
- R2: The new ticket is open, with no stage, nothing changed and no history; lists of IDs are on one line, questions are a block numbered from Q1, each unanswered and raised by no role; the body is the input's body, trimmed, with one newline after it
- R3: In a git repository, a ticket saved as a file is committed alone, with the subject "<ID>: new <type>, <title>"
- R4: The ticket is saved whatever the gate says; the gate tells the person what to fix, and the command still exits 0
- R5: `--dry-run` picks the ID and gates the ticket, and saves and commits nothing
- R6: Input that does not make a valid ticket (a missing or unknown key, a malformed ID, an empty title or body, a title over 120 characters) is refused with each problem, and nothing is saved
- R7: A title of 1 to 120 characters is written on one line, never folded onto a second line, so the file is valid and the ticket is created
- R8: With the files store in a git repository, tickets are filed only on format.Config.baseBranch: on any other branch, a ticket's branch included, nothing is written, and the refusal names the tree to run it in. A dry run is not refused
- R9: When git refuses to stage or commit the new file, the file is removed and unstaged, and nothing is saved
- R10: Input that does not parse as JSON names where it was read: "on stdin", or "from <file>" with the path as given on the command line

## Out of scope
- Editing a ticket after it is created: people edit the file; the CLI edits only its own keys (TKT-002)
