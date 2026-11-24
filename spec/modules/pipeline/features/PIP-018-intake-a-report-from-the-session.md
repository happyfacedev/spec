---
id: PIP-018
title: Intake a delegated stage report from the main session
module: pipeline
status: active
---

## Intent
The main session can pass a subagent's final message directly to `spec ticket advance`, without a SubagentStop hook. Report extraction, ticket and role binding, checks, recording, and bounded refusals stay the same.

## Behaviour
### S1: A valid final message is checked and recorded
Given "TASK-101" has its "implementer" stage running in a ticket worktree
And a valid implementer report names "TASK-101"
When the main session runs the primary checkout's `spec ticket advance TASK-101 --report-file report.md`
Then it resolves the ticket worktree, checks the report there, records its transcript when supplied, and commits the stage on ticket/TASK-101 (R1)
And the same command run from TASK-101's worktree advances that branch

### S2: A report cannot advance another ticket or role
Given "TASK-101" has its "implementer" stage running
When `spec ticket advance TASK-101 --report-file report.md` reads a report for "TASK-103" or a different role
Then it refuses the report without saving it for the named ticket (R2)

### S3: Refused reports return problems for the same subagent
Given "TASK-101" has its "implementer" stage running
When the first or second report intake fails checks
Then it exits 1, prints the problems and its attempt number of 3, and leaves the stage running (R3)
And with `--format json` it returns the problems and attempt number in JSON

### S4: The third refusal blocks on the problems
Given "TASK-101" has its "implementer" stage running and two report intakes were refused
When the third report intake fails checks
Then it keeps that message, blocks the ticket, and adds a blocker question listing the problems (R3)

### S5: A report can come from stdin
Given "TASK-101" has its "implementer" stage running
When `spec ticket advance TASK-101 --report -` reads the final message from stdin
Then it checks and records that message just like `--report-file` (R1)

### S6: Without report intake the stored report path is unchanged
Given "TASK-101" has its "implementer" stage running and a valid report is stored by a finish hook
When `spec ticket advance TASK-101` runs without either report option
Then it advances from the stored report as it does today (R4)

### S7: A new run resets only that stage's refusal budget
Given TASK-101's implementer report was refused once
And its implementer stage finishes and the reviewer stage then sends the ticket back to the implementer
When `spec ticket start TASK-101 implementer` begins that new stage
Then the next refused implementer report is attempt 1 of 3 (R5)

### S8: Restarting the running stage keeps its refusal count
Given TASK-101's implementer report was refused once and its implementer stage is still running
When `spec ticket start TASK-101 implementer` is run again
Then the next refused implementer report is attempt 2 of 3 (R6)

### S9: The recorded stage keeps how many of its reports were refused
Given "TASK-101" has its "implementer" stage running and two of its report intakes were refused
When a third, valid report is recorded through pipeline.AdvanceTicket with `--report-file`
Then tickets.Ticket.history ends with a pipeline.StageRecord with result "done" and pipeline.StageRecord.refusals 2 (R7)
And when the third intake is refused too, the blocked pipeline.StageRecord it records has pipeline.StageRecord.refusals 3 (R3, R7)
But a stage whose first report was recorded has no pipeline.StageRecord.refusals key, and a stage started anew after a refusal counts from 0 (R5, R7)

## Rules
- R7: The pipeline.StageRecord a stage ends with keeps, as pipeline.StageRecord.refusals, the refusal count R3 holds for that stage when it is recorded, the refusal that blocks it included; with none, the key is left out.
- R1: `--report-file <path>` reads a final message from the project root; `--report -` reads it from stdin. A valid report is saved with its optional transcript, logged, then advanced.
- R2: Intake binds to the requested ticket's running role; a different ticket or role is refused and never saved for the named ticket.
- R3: Refusals use the hook's report-check logic, return problems and attempts 1 through 3 to the main session; the third refused message is kept and the ticket blocks on a question listing the problems.
- R4: With no report option, advance preserves its stored-report and stdin behavior.
- R5: Refusal counts are isolated by ticket and role, and `ticket start` clears the count when a new stage of that role begins.
- R6: Restarting an already-running stage does not clear that role's refusal count.

## Out of scope
- A check that could not run because the test run gave no results: it is not a refusal and is not counted (PIP-022)
- Extracting or checking a report block: PIP-003 and PIP-004
- Starting a stage: PIP-002
