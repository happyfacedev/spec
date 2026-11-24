---
id: LNT-014
title: Report broken tickets (L020)
module: lint
status: active
writes: [lint.Report.findings]
---
## Intent
Lint checks every ticket in the store as it checks the spec, under one rule, L020: a ticket that does not match the ticket schema, a file not named after its ticket, and dependencies that name no ticket or loop. What a ticket type requires (a bug's violated scenario, a proposal's or task's touched units, an ID that matches the type) is only a warning: the gate refuses such a ticket, so CI need not fail on it. So is a string key the schema does not know, which a newer spec may have written. A YAML anchor, an alias or a key that is not a string is an error: ticket files use plain YAML so the CLI can rewrite them exactly. Each scenario starts from the base spec of LNT-001, whose store is "tickets/" with "TASK-001", and runs lint.Lint. Inside a quoted message or fix, '' stands for a double quote the text holds.

## Behaviour
### S1: A ticket missing a required field
Given the base spec with a ticket "TASK-002" in "tickets/TASK-002.md" that has no "title"
When lint.Lint runs
Then lint.Report.findings holds: error "L020" at "tickets/TASK-002.md" line 1, id "TASK-002", message "ticket is missing required field title", fix "add title to the frontmatter" (R1)

### S2: A ticket type that does not exist
Given the base spec with "type: chore" on line 3 of "tickets/TASK-002.md"
When lint.Lint runs
Then lint.Report.findings holds: error "L020" at "tickets/TASK-002.md" line 3, id "TASK-002", fix "use one of: proposal, bug, task" (R1)
And its message is "type: Invalid option: expected one of ''proposal''|''bug''|''task''"

### S3: A ticket with an unknown field
Given the base spec with "owner: bob" on line 19 of "tickets/TASK-001.md"
When lint.Lint runs
Then lint.Report.findings is exactly: warning "L020" at "tickets/TASK-001.md" line 19, id "TASK-001", message "ticket has fields this spec does not know: owner", fix "if a newer spec wrote them, they are kept: merge the base branch to read them; otherwise remove them or fix their spelling" (R2, R4)
And cli.CommandResult.exitCode is 0

### S4: A ticket file with no frontmatter
Given the base spec with "tickets/TASK-003.md" holding only "no frontmatter"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L020" at "tickets/TASK-003.md" line 1, id null, message "ticket has no YAML frontmatter", fix "start the file with a --- frontmatter block" (R2)

### S5: A ticket file not named after its ticket
Given the base spec with ticket "TASK-003" saved as "tickets/old-ticket.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L020" at "tickets/old-ticket.md" line 2, id "TASK-003", message "ticket file old-ticket.md is not named TASK-003.md", fix "rename the file to TASK-003.md" (R1)

### S6: A bug that names no scenario
Given the base spec with a bug "BUG-001" whose "violates" on line 8 is empty
When lint.Lint runs
Then lint.Report.findings is exactly: warning "L020" at "tickets/BUG-001.md" line 8, id "BUG-001" (R3)
And its message is "a bug must name the scenario it violates; without one the behaviour is unspecified"
And its fix is "add the violated scenario IDs to violates, or turn the ticket into a proposal"
And cli.CommandResult.exitCode is 0

### S7: A task that touches nothing
Given the base spec with "touches: []" on line 7 of "TASK-001"
When lint.Lint runs
Then lint.Report.findings is exactly: warning "L020" at "tickets/TASK-001.md" line 7, id "TASK-001", message "a task must touch at least one unit", fix "add the units it changes to touches" (R3)

### S8: A non-bug that lists violates
Given the base spec with "violates: [ALP-001/S1]" on "TASK-001"
When lint.Lint runs
Then lint.Report.findings is exactly: warning "L020" at "tickets/TASK-001.md" line 7, the line of "touches", id "TASK-001", message "only bugs may list violates", fix "move the IDs to touches, or set type: bug" (R3)

### S9: An ID that does not match the type
Given the base spec with "type: proposal" on "TASK-001"
When lint.Lint runs
Then lint.Report.findings is exactly: warning "L020" at "tickets/TASK-001.md" line 7, id "TASK-001", message "a proposal ticket must have a PROP- ID", fix "rename the ticket or set type to match TASK-001" (R3)

### S10: A ticket that depends on itself
Given the base spec with "depends_on: [TASK-001]" on line 19 of "TASK-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L020" at "tickets/TASK-001.md" line 19, id "TASK-001", message "TASK-001 depends on itself", fix "remove it from depends_on" (R1)

### S11: A dependency that is not a ticket
Given the base spec with "depends_on: [TASK-404]" on line 19 of "TASK-001", and no ticket "TASK-404"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L020" at "tickets/TASK-001.md" line 19, id "TASK-001", message "depends_on TASK-404, which is not a ticket", fix "correct the ID, or remove it from depends_on" (R1)

### S12: Dependencies that loop
Given the base spec where "TASK-001" depends on "TASK-002" and "TASK-002" depends on "TASK-001", each on line 19
When lint.Lint runs
Then lint.Report.findings is exactly two "L020" errors, each with fix "break the cycle: one of these tickets must come first" (R1):
| file | id | message |
| "tickets/TASK-001.md" | "TASK-001" | "TASK-001 depends on itself through depends_on" |
| "tickets/TASK-002.md" | "TASK-002" | "TASK-002 depends on itself through depends_on" |

### S13: A tickets command that fails
Given the base spec with "tickets": {"adapter": "command", "command": "false"} in "config.json"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L020" at "tracker" line 1, id null, fix "fix the tickets command in config.json (docs/TICKETS.md)" (R1)
And its message starts with "the tickets command exited 1"

### S14: A tickets command that prints something else
Given the base spec with a tickets command whose "list" prints "[]"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L020" at "tracker" line 1, id null, fix "fix the tickets command in config.json (docs/TICKETS.md)" (R1)
And its message is "`list` did not print {''tickets'':[{''id'',''text''}]}"

### S15: A tracker ticket is named by its ID
Given the base spec with a tickets command whose "list" prints one ticket "TASK-001" with no "title"
When lint.Lint runs
Then lint.Report.findings holds: error "L020" at "tracker/TASK-001.md" line 1, id "TASK-001", message "ticket is missing required field title" (R1)

### S16: A ticket that uses a YAML anchor and an alias
Given the base spec with "touches: &units [ALP-001]" on line 7 of "TASK-001" and "owner: *units" on line 19
When lint.Lint runs
Then lint.Report.findings is exactly two "L020" errors at "tickets/TASK-001.md", each with fix "write the value out: ticket files may not use YAML anchors or aliases" (R5):
| line | message |
| 7 | "ticket uses the YAML anchor &units" |
| 19 | "ticket uses the YAML alias *units" |
And cli.CommandResult.exitCode is 1

### S17: A ticket with a null key
Given the base spec with "null: x" on line 19 of "TASK-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L020" at "tickets/TASK-001.md" line 19, message "ticket has a key that is not a string: null", fix "quote the key: ''null''" (R5)
And cli.CommandResult.exitCode is 1

## Rules
- R1: A ticket that breaks the schema, is misnamed, or whose dependencies are unknown or loop is an L020 error, and so is a tickets command that fails or prints something other than its ticket list
- R2: Every finding about a ticket's frontmatter carries L020, not L001 or L002
- R3: What a ticket type requires is an L020 warning, at the line of violates for a bug and of touches otherwise
- R4: String keys a ticket has that the ticket schema does not know are one L020 warning per ticket, not an error: a newer spec may have written them
- R5: Each YAML anchor, alias, and key that is not a string (a bare number, boolean or null) in a ticket is an L020 error at its line, with the fix "write the value out" for an anchor or an alias and "quote the key" for a key; lint reports nothing else about that ticket's frontmatter

## Out of scope
- The ticket format and stores: tickets
- Refusing a ticket that may not start: tickets (gate)
