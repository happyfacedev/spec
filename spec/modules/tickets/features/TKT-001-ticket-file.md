---
id: TKT-001
title: The ticket file and its type rules
module: tickets
status: active
invariants: [INV-013]
---
## Intent
Every store holds tickets in one format: YAML frontmatter with fixed keys, then a free-text body. The keys say what kind of work it is and what it touches, so the gate can check it before any work starts. A ticket that breaks the format, or the rules of its type, is refused by the gate with the fix. The format grows over time, and every tree reads every ticket's live copy, so a tree whose spec predates a field still reads a ticket that has it: a key it does not know is kept and ignored, never an error, and survives when the CLI rewrites the ticket. So that a rewrite can keep every key and value exactly, a ticket file uses plain YAML only: no anchors, no aliases, and every key a string.

## Behaviour
### S1: A ticket with only the keys a person writes
Given the store holds "tickets/TASK-900.md" with tickets.Ticket.id "TASK-900", tickets.Ticket.type "task", tickets.Ticket.title "x", tickets.Ticket.status "open" and tickets.Ticket.touches ["PRV-001"], and no other key
When the developer runs `spec gate TASK-900` through tickets.Gate
Then the first line of cli.CommandResult.stdout is "TASK-900: ready" (R1)
And cli.CommandResult.exitCode is 0

### S2: A bug that names no scenario
Given the store holds "tickets/BUG-302.md" with tickets.Ticket.type "bug" and an empty tickets.Ticket.violates
When the developer runs `spec gate BUG-302` through tickets.Gate
Then tickets.GateResult.blockers is exactly one tickets.GateBlocker: kind "schema", id "BUG-302", text "a bug must name the scenario it violates; without one the behaviour is unspecified: add the violated scenario IDs to violates, or turn the ticket into a proposal" (R2)

### S3: An ID whose prefix does not match the type
Given the store holds "tickets/BUG-910.md" with tickets.Ticket.type "proposal", tickets.Ticket.touches ["PRV-001"] and an empty violates
When the developer runs `spec gate BUG-910` through tickets.Gate
Then tickets.GateResult.blockers holds kind "schema", id "BUG-910", text "a proposal ticket must have a PROP- ID: rename the ticket or set type to match BUG-910" (R3)

### S4: A proposal or task that touches nothing
Given the store holds "tickets/TASK-911.md" with tickets.Ticket.type "task" and an empty tickets.Ticket.touches
When the developer runs `spec gate TASK-911` through tickets.Gate
Then tickets.GateResult.blockers holds kind "schema", id "TASK-911", text "a task must touch at least one unit: add the units it changes to touches" (R4)

### S5: Only bugs list violates
Given the store holds "tickets/TASK-912.md" with tickets.Ticket.type "task", tickets.Ticket.touches ["PRV-001"] and tickets.Ticket.violates ["PRV-002/S3"]
When the developer runs `spec gate TASK-912` through tickets.Gate
Then tickets.GateResult.blockers holds kind "schema", id "TASK-912", text "only bugs may list violates: move the IDs to touches, or set type: bug" (R2)

### S6: The file is not named after its ID
Given the store holds "tickets/old-ticket.md" whose tickets.Ticket.id is "TASK-003"
When `spec lint` reads the store
Then it reports a finding with lint.Finding.rule "L020", lint.Finding.file "tickets/old-ticket.md", lint.Finding.message "ticket file old-ticket.md is not named TASK-003.md" and lint.Finding.fix "rename the file to TASK-003.md" (R5)

### S7: A required key is missing
Given the store holds "tickets/TASK-002.md" with no title key
When `spec lint` reads the store
Then it reports a finding with lint.Finding.rule "L020", lint.Finding.severity "error", lint.Finding.message "ticket is missing required field title" and lint.Finding.fix "add title to the frontmatter" (R6)

### S8: A type outside the three
Given the store holds "tickets/TASK-002.md" with tickets.Ticket.type "chore"
When `spec lint` reads the store
Then it reports a finding with lint.Finding.rule "L020", lint.Finding.severity "error" and lint.Finding.fix "use one of: proposal, bug, task" (R6)

### S9: An unknown key
Given the store holds "tickets/TASK-913.md" with tickets.Ticket.type "task", tickets.Ticket.title "x", tickets.Ticket.status "open" and tickets.Ticket.touches ["PRV-001"], whose frontmatter also has the key "owner"
When the developer runs `spec gate TASK-913` through tickets.Gate
Then the first line of cli.CommandResult.stdout is "TASK-913: ready" (R9)
And cli.CommandResult.exitCode is 0

### S10: A malformed ID in touches
Given the store holds "tickets/TASK-914.md" with tickets.Ticket.touches ["not an id"]
When the developer runs `spec gate TASK-914` through tickets.Gate
Then tickets.GateResult.blockers holds kind "schema" and id "TASK-914", with a text that starts with `touches[0]:` and ends "is not a valid unit ID: write it like a feature, scenario, rule, contract, invariant, decision or screen ID" (R6)

### S11: A ticket that does not parse is refused on its schema alone
Given "tickets/TASK-904.md" does not parse because tickets.Ticket.type is "chore", and its frontmatter also has the key "owner"
When the developer runs `spec gate TASK-904` through tickets.Gate
Then tickets.GateResult.blockers is exactly one blocker of kind "schema" for "TASK-904", whose text is the type finding's message, ": ", and its fix "use one of: proposal, bug, task" (R6)
And no other check runs on it, and no blocker names "owner" (R9)

### S12: Two files with one ID
Given the store holds "tickets/TASK-101.md" and "tickets/archive/TASK-101.md", both with tickets.Ticket.id "TASK-101"
When `spec lint` reads the store
Then it reports a finding with lint.Finding.rule "L003" and lint.Finding.message "ticket TASK-101 is also defined in tickets/TASK-101.md" for the second file (R7)

### S13: Question values written as YAML numbers or booleans
Given "tickets/PROP-915.md" has a preference question with tickets.Question.default written as the YAML number 3
When the developer runs `spec gate PROP-915 --format json` through tickets.Gate
Then the question's tickets.GatePreference.default is the string "3"

### S14: A preference without a default
Given "tickets/TASK-900.md" has a question with tickets.Question.kind "preference" and tickets.Question.default null
When the developer runs `spec gate TASK-900` through tickets.Gate
Then tickets.GateResult.blockers is exactly one blocker: kind "schema", id "TASK-900#Q1", text "preference TASK-900#Q1 has no default: add the default work proceeds on, or make it a blocker" (R8)

### S15: A preference that cites a contract
Given "tickets/TASK-916.md" has a question with tickets.Question.kind "preference", a default, and tickets.Question.cites ["providers.ProviderConfig"]
When the developer runs `spec gate TASK-916` through tickets.Gate
Then tickets.GateResult.blockers holds kind "schema", id "TASK-916#Q1", text "TASK-916#Q1 cites providers.ProviderConfig, so it is a blocker: set kind: blocker" (R8)
But a question with tickets.Question.kind "external", no default, and the same cites gives no "schema" blocker (R8)

### S29: A ticket's question cites only its own ticket
Given "tickets/PROP-900.md" touches "PIP-007" and has two answered blocker questions: Q1 with tickets.Question.cites ["PROP-900"] and Q2 with tickets.Question.cites ["PROP-901"]
When the developer runs `spec gate PROP-900 --format json` through tickets.Gate
Then tickets.GateResult.blockers is exactly one blocker: kind "schema", id "PROP-900", text "questions[1].cites[0]: a ticket question may cite only its own ticket ID: fix questions[1].cites[0] to match the ticket schema" (R6)
And cli.CommandResult.exitCode is 1
But with Q2 removed, `spec gate PROP-900` prints "PROP-900: ready": citing its own ID is no problem (R6)

### S16: An unknown field in a history record
Given "tickets/TASK-917.md" is a valid open task whose first tickets.Ticket.history record also has the key "findings2" with the value []
When the developer runs `spec gate TASK-917` through tickets.Gate
Then the first line of cli.CommandResult.stdout is "TASK-917: ready" (R9)
And cli.CommandResult.exitCode is 0

### S17: Lint warns once for every unknown field of a ticket
Given "tickets/TASK-918.md" is a valid open task with the frontmatter key "owner" on line 7, the key "asked_at" in its first tickets.Question, and the key "findings2" in its first tickets.Ticket.history record, and no other problem
When `spec lint` reads the store
Then it reports exactly one finding for "tickets/TASK-918.md": lint.Finding.rule "L020", lint.Finding.severity "warning", line 7, lint.Finding.message "ticket has fields this spec does not know: owner, questions[0].asked_at, history[0].findings2" and lint.Finding.fix "if a newer spec wrote them, they are kept: merge the base branch to read them; otherwise remove them or fix their spelling" (R9)
And cli.CommandResult.exitCode is 0

### S18: A known field keeps its check beside an unknown one
Given "tickets/TASK-919.md" is a valid open task whose first tickets.Ticket.history record has pipeline.StageRecord.role "chef" on line 9 and also the key "findings2"
When `spec lint` reads the store
Then it reports a finding with lint.Finding.rule "L020", lint.Finding.severity "error", line 9, lint.Finding.message "history[0].role: Invalid option: expected one of ''spec-writer''|''spec-review''|''tester''|''implementer''|''reviewer''" and lint.Finding.fix "use one of: spec-writer, spec-review, tester, implementer, reviewer" (R9)
And it reports an L020 warning with lint.Finding.message "ticket has fields this spec does not know: history[0].findings2"
And cli.CommandResult.exitCode is 1

### S19: Recording a stage keeps unknown fields
Given "PROP-920" has a running spec-writer stage, the frontmatter key "owner" with the value "bob", the key "asked_at" with the value "x" in its question Q1, and the key "findings2" with the value [] in its first tickets.Ticket.history record
When the main session runs `spec ticket advance PROP-920` through pipeline.AdvanceTicket with a valid done report
Then the saved ticket's frontmatter still has "owner" with the value "bob", Q1 still has "asked_at" with the value "x", and the first history record still has "findings2" with the value [] (R10)
And the saved ticket's tickets.Ticket.history ends with the new spec-writer record

### S20: Answering a question keeps unknown fields
Given "PROP-921" is blocked on its question Q1, which also has the key "asked_at" with the value "x", and its frontmatter also has the key "owner" with the value "bob"
When the developer runs `spec ticket answer PROP-921 Q1 yes` through tickets.TicketAnswer
Then the saved ticket's tickets.Question.answer for Q1 is "yes" (R10)
And Q1 still has "asked_at" with the value "x", and the frontmatter still has "owner" with the value "bob"

### S21: The queue reads a ticket that has unknown fields
Given "tickets/TASK-922.md" is a valid open task, ready to start, whose first tickets.Ticket.history record also has the key "findings2"
When the developer runs `spec queue --format json` through tickets.Queue
Then tickets.QueueResult.ready holds an entry with tickets.QueueEntry.id "TASK-922" and tickets.QueueEntry.type "task" (R9)

### S22: A ticket that uses a YAML anchor and an alias
Given "tickets/TASK-923.md" is a valid open task with "touches: &units [PRV-001]" on line 6 and "owner: *units" on line 7
When `spec lint` reads the store
Then it reports exactly two findings for "tickets/TASK-923.md", each with lint.Finding.rule "L020", lint.Finding.severity "error" and lint.Finding.fix "write the value out: ticket files may not use YAML anchors or aliases" (R11):
| line | message |
| 6 | "ticket uses the YAML anchor &units" |
| 7 | "ticket uses the YAML alias *units" |
And no finding for the file names "owner" (R9)
And cli.CommandResult.exitCode is 1

### S23: A ticket with a bare numeric key
Given "tickets/TASK-924.md" is a valid open task whose first tickets.Question has the key "2" written bare, as "2: x", on line 12
When `spec lint` reads the store
Then it reports exactly one finding for "tickets/TASK-924.md": lint.Finding.rule "L020", lint.Finding.severity "error", line 12, lint.Finding.message "ticket has a key that is not a string: 2" and lint.Finding.fix "quote the key: ''2''" (R11)
And cli.CommandResult.exitCode is 1

### S24: The gate refuses a ticket with a boolean key
Given "tickets/TASK-925.md" is a valid open task with "true: x" on line 7
When the developer runs `spec gate TASK-925` through tickets.Gate
Then tickets.GateResult.blockers is exactly one blocker: kind "schema", id "TASK-925", text "ticket has a key that is not a string: true: quote the key: ''true''" (R11)
And cli.CommandResult.exitCode is 1

### S25: A quoted key is a string key
Given "tickets/PROP-926.md" is a valid blocked proposal with the key written quoted as "''2'': x" on line 7, and its question Q1 also has the quoted key "''7'': y"
When `spec lint` reads the store
Then it reports exactly one finding for "tickets/PROP-926.md": lint.Finding.rule "L020", lint.Finding.severity "warning", line 7, lint.Finding.message "ticket has fields this spec does not know: 2, questions[0].7" (R9, R11)

### S26: A rewrite keeps a quoted key quoted
Given "tickets/PROP-927.md" is blocked on its question Q1, its frontmatter has the line "''2'': x" and Q1 has the line "''7'': y"
When the developer runs `spec ticket answer PROP-927 Q1 yes` through tickets.TicketAnswer
Then the saved ticket's tickets.Question.answer for Q1 is "yes" (R10)
And the saved frontmatter still has the line "''2'': x", and Q1 still has the line "''7'': y" (R11)

### S27: An absorbed ticket passes lint
Given "tickets/PROP-202.md" is a valid proposal with tickets.Ticket.status "absorbed" and tickets.Ticket.absorbed_into "PROP-201", and "PROP-201" is an open proposal in the store
When `spec lint` reads the store
Then it reports no finding for "tickets/PROP-202.md" (R12)

### S28: absorbed_into that does not hold
Given the store holds the open proposal "PROP-201", "PROP-203" absorbed into "PROP-201", and each ticket below with absorbed_into on line 6
When `spec lint` reads the store
Then it reports for each an L020 error at line 6 with this lint.Finding.message and lint.Finding.fix (R12):
| ticket | status | absorbed_into | message | fix |
| "PROP-204" | "absorbed" | "PROP-299" | "absorbed_into PROP-299, which is not a ticket" | "name the ticket it was combined into" |
| "PROP-205" | "absorbed" | "PROP-203" | "absorbed_into PROP-203, which is itself absorbed into PROP-201" | "set absorbed_into to PROP-201" |
| "PROP-206" | "open" | "PROP-201" | "only an absorbed ticket has absorbed_into" | "remove absorbed_into" |
And "PROP-207", with tickets.Ticket.status "absorbed" and no absorbed_into, gets the L020 error "an absorbed ticket names the ticket it went into" with the fix "add absorbed_into" (R12)

### S30: A recorded finding's marks and a recorded stage's keys are known
Given "tickets/TASK-930.md" is a valid open task whose first tickets.Ticket.history record is a reviewer's with verdict "changes" and two pipeline.ReviewFinding, one with pipeline.ReviewFinding.spec true and pipeline.ReviewFinding.class "C1", the other with pipeline.ReviewFinding.tests true and pipeline.ReviewFinding.class "C2", and whose second record is a done spec-writer's with pipeline.StageRecord.checklist of one pipeline.ChecklistItem, pipeline.StageRecord.documents, pipeline.StageRecord.refusals and pipeline.StageRecord.cost_usd
When `spec lint` reads the store
Then it reports no finding for "tickets/TASK-930.md" (R13)
But with pipeline.ReviewFinding.tests written as "yes", it reports one L020 error for "tickets/TASK-930.md" whose lint.Finding.message starts "history[0].findings[1].tests:", and no L020 warning for it names "tests" (R13)

### S31: A proposal in a light lane
Given the store holds "tickets/PROP-931.md", a valid open proposal with tickets.Ticket.lane "docs", "tickets/PROP-932.md", one with tickets.Ticket.lane "tests", and "tickets/PROP-936.md", one with tickets.Ticket.lane "build"
When the developer runs `spec gate PROP-931`, `spec gate PROP-932` and `spec gate PROP-936` through tickets.Gate, and `spec lint` reads the store
Then the first line of each gate's cli.CommandResult.stdout is "<ID>: ready" (R14)
And lint reports no finding for any of the three files: lane is a known key (R9, R14)

### S32: A light lane on a bug or a task
Given the store holds "tickets/BUG-933.md", a valid bug with tickets.Ticket.lane "tests", and "tickets/TASK-934.md", a valid task with tickets.Ticket.lane "docs"
When the developer runs `spec gate BUG-933` and `spec gate TASK-934` through tickets.Gate
Then tickets.GateResult.blockers holds kind "schema", id "BUG-933", text "only a proposal may run in a light lane: remove lane, or set lane: full" (R14, INV-013)
And it holds kind "schema", id "TASK-934", with the same text, and either ticket with tickets.Ticket.lane "build" gives it too (R14)
And cli.CommandResult.exitCode is 1
But a bug or a task with tickets.Ticket.lane "full" gives no such blocker (R14)

### S33: A lane outside the four
Given the store holds "tickets/PROP-935.md", a valid proposal with tickets.Ticket.lane "quick"
When `spec lint` reads the store
Then it reports a finding with lint.Finding.rule "L020", lint.Finding.severity "error" and lint.Finding.fix "use one of: full, docs, tests, build" (R6, R14)
And `spec gate PROP-935` through tickets.Gate gives one blocker of kind "schema" for "PROP-935" and exits 1 (R6)

## Rules
- R1: A list key left out, or written with no value, reads as an empty list; stage left out reads as null
- R2: A bug names at least one scenario in violates; no other type lists violates
- R3: The ID prefix matches the type: PROP- for a proposal, BUG- for a bug, TASK- for a task
- R4: A proposal or a task touches at least one unit
- R5: A ticket file in the files store is named `<id>.md`
- R6: A ticket whose frontmatter does not match the schema (a missing key, a value outside its set, a malformed ID, a title over 120 characters, a question that cites a ticket ID other than its own ticket's) is refused with the problem and its fix
- R7: Ticket IDs are unique in a store
- R8: A preference has a default, and a question that cites a contract, member, invariant or decision is a blocker or an external question
- R9: A string key the ticket schema does not know, in the frontmatter, in a question, in a history record or in any record inside them, is kept and ignored: the ticket parses, the gate, queue and plan read it as if the key were absent, and lint gives the ticket one L020 warning that lists every such key in file order, at the line of the first. Every known key keeps its checks
- R10: When the CLI rewrites a ticket (`spec ticket advance`, `spec ticket answer`, or any other command that saves it), every unknown string key stays where it was, with its value
- R11: A ticket file may not use YAML anchors, aliases or keys that are not strings (a bare number, boolean or null), at any depth; a quoted key is a string key. Lint reports each anchor, alias and such key as an L020 error at its line, with the fix "write the value out" for an anchor or an alias and "quote the key" for a key, and reports nothing else about that ticket's frontmatter; the gate refuses the ticket on these findings alone, one schema blocker each. `spec ticket new` and every CLI rewrite never write them, and a quoted key the CLI keeps stays quoted
- R12: A ticket has absorbed_into exactly when its status is "absorbed", and it names another ticket in the store that is not itself absorbed; lint reports each break as an L020 error at the absorbed_into line (or the status line when it is missing). An absorbed ticket is otherwise checked like any ticket of its type
- R13: The members of pipeline.StageRecord are the known keys of a history record, and those of pipeline.ReviewFinding the known keys of a recorded finding, so lint warns about neither as unknown; each keeps its checks (R9)
- R14: tickets.Ticket.lane is "full", "docs", "tests" or "build", and "full" when left out; a lane other than "full" is refused on a bug or a task with the fix "remove lane, or set lane: full" (PIP-021). A CLI refuses a lane it does not know (R6), so "build" is set only once every checkout's pinned CLI has it

## Out of scope
- Whether the IDs in touches and violates exist, and everything else the gate checks beyond the file (TKT-007)
- Severities lint gives these problems: lint
