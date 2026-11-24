---
id: PIP-022
title: A check that could not run is not a refused report
module: pipeline
status: active
observes: [tickets.Ticket.history, tickets.Ticket.status, tickets.Ticket.stage, pipeline.TestRun.error]
invariants: [INV-003, INV-015]
---
## Intent
A done tester or implementer report is checked on a run of the project's tests, and that run can give no results for reasons that have nothing to do with the report: the machine is loaded and the test command times out, or the runner cannot start. `spec ticket advance` then says the check could not run and to run the same command again, and changes nothing. The run is not one of the report's three attempts (PIP-018/R3), so a slow machine cannot block a ticket and stash its work, and the same report is accepted on the retry once the tests give results. Only a run that gave results decides a report.

## Behaviour
### S1: A test run that gave no results does not refuse the report
Given "TASK-101" is in its "implementer" stage with "src/app.ts" changed and uncommitted, and one earlier intake of its report was refused, so its refusal count is 1 (PIP-018/R3)
And the report file holds a valid done implementer report, and the test command timed out with pipeline.TestRun.error "spawnSync /bin/sh ETIMEDOUT"
When the main session runs "spec ticket advance TASK-101 --report-file report.md" through pipeline.AdvanceTicket
Then it fails with pipeline.CheckCouldNotRun: stderr starts "the check could not run: the test command gave no results: spawnSync /bin/sh ETIMEDOUT", its last line tells the driver to run the same command again, and the exit code is 3 (R1)
And stderr holds neither "report refused" nor "attempt"
And tickets.Ticket.status is still "in_progress", tickets.Ticket.stage is still "implementer", tickets.Ticket.history is unchanged, HEAD is unchanged, "src/app.ts" is still changed in the tree, and the git stash list holds no "TASK-101 implementer: blocked" (R1, INV-015)
And the next report of this stage that is refused for a failing test is attempt 2 of 3, not 3 of 3 (R1, PIP-018/R3)
And with `--format json`, pipeline.Advanced.next is null, pipeline.Advanced.status is "in_progress", pipeline.Advanced.problems is ["the test command gave no results: spawnSync /bin/sh ETIMEDOUT"] and the exit code is 3 (R1)
And the same holds when the command runs from the primary checkout, which resolves the ticket's worktree (PIP-018/S1)

### S2: The same report is accepted when the retry gets results
Given the stage of S1, and the test command now gives results with every test passing
When the main session runs the same "spec ticket advance TASK-101 --report-file report.md" again through pipeline.AdvanceTicket
Then stdout is "TASK-101 implementer: <summary>" then "next: reviewer", and the exit code is 0 (R1)
And tickets.Ticket.history ends with a pipeline.StageRecord with result "done" and pipeline.StageRecord.refusals 1: the run that gave no results was not counted (R1, INV-015)
And a report given on stdin is not stored by the run that could not check it, so the retry gives the same report on stdin again; a report the finish check stored stays stored, so "spec ticket advance TASK-101" with nothing on stdin records it once the tests give results (R1, PIP-008/R5)

### S3: Every way a run gives no results is a check that could not run
Given "BUG-301" is in its "tester" stage and its done tester report is valid
When "spec ticket advance BUG-301" runs through pipeline.AdvanceTicket and the test command fails to start, or times out, or wrote no report, or wrote one in no known format
Then each time it fails with pipeline.CheckCouldNotRun: stderr starts "the check could not run: the test command gave no results: " followed by that reason, and the exit code is 3 (R1)
And tickets.Ticket.history and tickets.Ticket.status are unchanged, and no refusal is counted (R1, INV-015)
And the same holds for "PROP-215" in a build stage, its first run passing, when its proof run ends in any of these ways, the reason then starting "on the code before the build: " (R1, PIP-024/R5)

### S4: A run that gave results, or a report with another problem, is still refused
Given "TASK-101" is in its "implementer" stage and its report file holds a valid done implementer report
When "spec ticket advance TASK-101 --report-file report.md" runs through pipeline.AdvanceTicket and the test command gives results with "PRV-001/S1 Streams tokens" failing
Then it is refused: stderr starts "report refused (attempt 1 of 3):" and holds the problem "tests fail (exit 1): PRV-001/S1 Streams tokens", and the exit code is 1 (R1, PIP-018/R3)
And with no "config.json", so no format.Config.testCommand, the problem is "the test command gave no results: config.json has no testCommand", the attempt is 1 of 3 and the exit code is 1 (R1)
And when the test command times out on "PROP-205", a proposal whose implementer stage also changed "tests/PRV-001.test.ts", a file under testGlobs, the report is refused with the problems "on a proposal the tests are the tester's and the implementer changes code only; revert tests/PRV-001.test.ts, or report a blocker that cites the scenario whose test is wrong" and "the test command gave no results: <reason>", the attempt is 1 of 3 and the exit code is 1 (R1, PIP-005/R1, INV-003)
And a done reviewer report is recorded as in PIP-008/S3 although the test command would time out, because the test command does not run for it (PIP-006/S10)

## Rules
- R1: The check of a done tester or implementer report could not run when the test run gave no results (pipeline.TestRun.error is set: the test command failed to start, timed out, wrote no report or wrote one in no known format), or a build stage's proof run gave none (PIP-024/R5), a testCommand is set, and that is the report's only problem. Then advance fails with pipeline.CheckCouldNotRun and changes nothing: no ticket, history, commit, stash or tree file, and no stored report is created, changed or deleted, so a retry gives the report again by the same means (a report on stdin or in a file) or, for a report the finish check stored, finds it still stored; the stage's refusal count (PIP-018/R3) is not raised, so the run is never one of the three attempts and the ticket does not block on it. It holds on every way the report reaches advance (`--report-file`, `--report -`, stdin, the finish check's stored report) and in the ticket's worktree or the primary checkout. A report with another problem, a run that gave results, and a project with no testCommand are refused and counted as before.

## Out of scope
- The refusal count and the third refusal's block: PIP-018
- The test run itself and what it reports: PIP-006
