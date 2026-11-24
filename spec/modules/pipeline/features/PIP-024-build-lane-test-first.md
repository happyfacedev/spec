---
id: PIP-024
title: Hold a build stage to test first
module: pipeline
status: active
invariants: [INV-003, INV-004, INV-013, INV-015]
---
## Intent
A proposal in the build lane has no tester: its implementer writes the tests and the code in one build stage (PIP-021). Test first is then a check instead of a split between two roles. When a build stage reports done, the CLI runs the tests twice. The first run is on the stage's whole tree, where every test must pass. The second, the proof run, is on the code as it was before the ticket's first build stage, with the branch's test files alone put on it: there each new or changed scenario needs a test that fails on its assertion. The CLI decides both from git and its own runs, never from the report. The proof run is made for every done build stage, so a later round cannot swap a proved test for one that passes on any code. The cost is that no independent tester reads the scenarios before the code exists: the proof shows that a test depends on the change, not that it checks what its scenario says, which the reviewer judges from the diff and the named mutations. A test that can only fail by an error on the earlier code, as one that calls a function or does not compile without the new code, cannot be proved this way, and its proposal belongs in the full lane, where the tester adds stubs.

## Behaviour
### S1: Tests that fail first and then pass are accepted
Given "PROP-215" is in a build stage, its branch added "PRV-001/S4" and "SET-001/S4" and reworded "PRV-001/S1", and the stage adds the tests "PRV-001/S4 Streams from gemini" and "SET-001/S4 Enable gemini", changes "src/providers.ts" and "package.json", and names a mutation for each of the two scenarios
And on the stage's whole tree the test command exits 0 with every test passing
And on the proof tree both new tests fail with pipeline.TestCase.failureKind "assertion"
When the implementer's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true, and no problem names a file under testGlobs (R1, R2, INV-003, INV-004)
And in the proof run the project held the stage's test files and spec folder, and "src/providers.ts" and "package.json" as they were before the stage (R2)
And stderr's lines starting "tests: " are, in order, "tests: running the test command" and "tests: running the proof run on the code before the build" (R4)
And the stage's tree, HEAD, branches, index and stash list are as they were, and "git worktree list" shows no worktree the check made (R4)

### S2: A test that passes without the code is refused
Given the "PROP-215" of S1, but on the proof tree "SET-001/S4 Enable gemini" passes
When the implementer's done report is checked through pipeline.CheckReport
Then the only problem is "no test of SET-001/S4 fails on the code before the build; write one that fails there on what it asserts" (R3, INV-004)
And "PRV-001/S4 Streams from gemini" failing does not stand in for "SET-001/S4", each scenario needing its own (R3)
And the problem is the same when the only test of "SET-001/S4" is skipped on the proof tree (R3)
And "PRV-001/S1", reworded over the same steps, needs no failing test (R3)

### S3: A test that fails first by an error is refused
Given the "PROP-215" of S1, but on the proof tree "PRV-001/S4 Streams from gemini" fails with pipeline.TestCase.failureKind "error" and pipeline.TestCase.firstErrorLine "TypeError: gemini.stream is not a function"
When the implementer's done report is checked through pipeline.CheckReport
Then the only problem is "on the code before the build, the test \"PRV-001/S4 Streams from gemini\" fails with an error, not an assertion: TypeError: gemini.stream is not a function; make it fail on what it asserts, or report with lane: full" (R3, INV-004)
And the problem is given as well when another test of "PRV-001/S4" fails there on its assertion (R3)

### S4: A failure that does not say it is an assertion proves nothing
Given the "PROP-215" of S1, but on the proof tree "PRV-001/S4 Streams from gemini" fails with no pipeline.TestCase.failureKind
When the implementer's done report is checked through pipeline.CheckReport
Then the only problem is "on the code before the build, the test report does not say whether the test \"PRV-001/S4 Streams from gemini\" failed on an assertion; make the report tell them apart, or report with lane: full" (R3)

### S5: A test file that does not load on the earlier code is refused
Given the "PROP-215" of S1, but on the proof tree the report gives "tests/prv_001.test.ts" the status "failed", the message "Cannot find module '../src/gemini'" and no tests, so the run holds no test of "PRV-001/S4"
When the implementer's done report is checked through pipeline.CheckReport
Then the only problem is "no test of PRV-001/S4 ran on the code before the build (tests/prv_001.test.ts: Cannot find module '../src/gemini'); write one that fails there on what it asserts, or report with lane: full" (R3)
And with a report that names no failed file, the problem has no text in parentheses (R3)

### S6: A documented scenario passes on the earlier code
Given the "PROP-215" of S1, whose latest done "spec-writer" stage has pipeline.StageRecord.documents ["SET-001/S4"]
When the implementer's done report is checked through pipeline.CheckReport, with "SET-001/S4 Enable gemini" passing on the proof tree, and again with it failing there
Then the first check gives pipeline.ReportCheck.ok true: a documented scenario must not fail first (R3, INV-004)
And the second gives the only problem "the test \"SET-001/S4 Enable gemini\" fails on the code before the build, but the spec-writer listed SET-001/S4 under documents as behaviour the code already has; make the test check what the code does, or report a blocker that cites SET-001/S4" (R3)
And when no test of "SET-001/S4" passes there, its only one skipped, the only problem is "no test of SET-001/S4 passes on the code before the build, but the spec-writer listed it under documents as behaviour the code already has; a skipped test does not count, so make one run and pass" (R3)

### S7: The whole tree is checked first, as the tester's and the implementer's
Given the "PROP-215" of S1, whose proof run would pass
When the implementer's done report is checked through pipeline.CheckReport after each change below
Then each gives its one problem, and no proof run is made (R1, R2, INV-004):
| change | problem |
| on the whole tree the test command exits 1 with "SET-001/S4 Enable gemini" failing | "tests fail (exit 1): SET-001/S4 Enable gemini" |
| no test is named for "SET-001/S4" | "no test covers SET-001/S4; name it \"SET-001/S4 <scenario title>\"" |
| a passing test is named "PRV-001/S9 Removed long ago", which the spec does not have | "test \"PRV-001/S9 Removed long ago\" names PRV-001/S9, which is not in the spec; delete or rename it" |
| format.Config.checkCommands is ["npm run lint"], which exits 1 with "src/app.ts:3 unused" | "npm run lint fails (exit 1): src/app.ts:3 unused" |
| "src/providers.ts" holds a "SPEC-STUB" line the branch added | "SPEC-STUB is still in src/providers.ts; replace every stub with the real code" |
| the report names no mutation for "SET-001/S4" | "the report names no wrong implementation for SET-001/S4; add { scenario: SET-001/S4, wrong: \"<a plausible wrong implementation its test fails against>\" } under mutations" |

### S8: Every build stage is proved against the code before the first one
Given "PROP-215", whose first build stage is recorded done, whose reviewer asked for changes with a finding marked neither spec nor tests, and whose branch then merged "main", which changed "src/other.ts" and "tests/other.test.ts"
And its second build stage changes "src/providers.ts" and the test of "SET-001/S4"
When the implementer's done report is checked through pipeline.CheckReport
Then the proof tree holds "src/other.ts" and "tests/other.test.ts" as "main" brought them, and "src/providers.ts" without the first build stage's change (R2)
And with the changed test of "SET-001/S4" passing on that tree, the only problem is the one of S2 (R3, INV-004)
And with every test of "PRV-001/S4" and "SET-001/S4" that fails there failing on its assertion, and one of each failing, pipeline.ReportCheck.ok is true (R3)

### S9: A branch with nothing to prove makes no proof run
Given "PROP-216" is in a build stage, its branch added and changed no scenario and reworded "PRV-001/S1", and every check on the stage's whole tree passes
When the implementer's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true and stderr holds no "tests: running the proof run on the code before the build" line (R2)

### S10: A proof run with no results neither accepts nor refuses
Given the "PROP-215" of S1, whose whole-tree run passes and whose proof run gives no results, with pipeline.TestRun.error "spawnSync /bin/sh ETIMEDOUT"
When "spec ticket advance PROP-215 --report-file report.md" runs through pipeline.AdvanceTicket
Then it fails with pipeline.CheckCouldNotRun: stderr's line with the reason is "the check could not run: the test command gave no results: on the code before the build: spawnSync /bin/sh ETIMEDOUT", and the exit code is 3 (R5, INV-015)
And tickets.Ticket.history is unchanged, no refusal is counted, and the stage is still running with its changes in its tree (R5, PIP-022/R1)
And it fails the same way when format.Config.worktreeSetup fails in the proof tree, the reason then being "on the code before the build: worktreeSetup failed: <the last lines of its output>" (R5)
And "spec check-report" gives the only problem "the test command gave no results: on the code before the build: <reason>" and exits 1 (R5)
But a report with pipeline.Report.lane "full", or a blocked one, needs neither run, so a stage whose tests never compile on the earlier code can still leave the lane (R5, PIP-021/R10)

### S11: The proof run takes its own turn, and two checks do not share a tree
Given the "PROP-215" of S1, and "spec test" in the main checkout takes the only test-run turn after the stage's whole-tree run gave its turn back
When the implementer's done report is checked through pipeline.CheckReport
Then the proof run waits, with "waiting for a test run to finish" on stderr, and starts once that run has ended (R4)
And while it runs it holds one turn recorded for "PROP-215", and its time limit counts from its own start (R4)
And when "spec check-report" and "spec ticket advance" check "PROP-215" at the same time, each makes its own proof tree, and each gives the result it would give alone (R4)
And when a check is interrupted with Ctrl-C during its proof run, its test command is stopped and its turn given back, and the stage's tree is as it was (R4)

### S12: Advance reuses a proof run made on the same trees
Given "spec check-report implementer PROP-215" accepted the report of S1 at "2026-11-23T09:00:00.000Z", and nothing in the stage's tree or on the base branch has changed since
When "spec ticket advance PROP-215" runs through pipeline.AdvanceTicket
Then neither run is made again, and stderr holds "tests: reused the test run made at <time> on this tree" then "tests: reused the proof run made at <time> on this tree" (R6)
But after a change to any file PIP-008/R12 counts, to the commit the code before the build is read from, or to format.Config.worktreeSetup, or when the kept proof run cannot be read or did not give pipeline.ReportCheck.ok true, the proof run is made again (R6)

### S13: The report claims nothing the runs do not show
Given the "PROP-215" of S2, whose report's summary says "every new test failed first" and whose mutations name "SET-001/S4"
When the implementer's done report is checked through pipeline.CheckReport
Then the only problem is the one of S2 (R3, INV-004, INV-013)
And a spec-folder change by the stage, such as an edit of testGlobs in "spec/config.json", gives the problem "the implementer never changes spec files; revert spec/config.json" and no proof run is made (R2, INV-003)

### S14: Other implementer stages have no proof run
Given "PROP-201" in the full lane, "PROP-210" in the docs lane whose reviewer asked for changes, "BUG-301" and "TASK-101", each in its "implementer" stage with every check passing
When each implementer's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true for each, and no stderr holds a "tests: running the proof run on the code before the build" line (R2)

## Rules
- R1: A done build stage is checked on the stage's whole tree as any done implementer stage (PIP-005, PIP-006/R5 to R7, PIP-023) and, for its tests, as a tester's is by PIP-006/R1 and R4 and PIP-019/R1; it may change files under `testGlobs` (PIP-005/R1).
- R2: When those checks find no problem and the branch added or changed a scenario, a reworded one aside, the CLI makes the proof run: format.Config.testCommand over every test on the proof tree. The proof tree is the stage's tree in which every file outside `testGlobs`, the spec folder and the tickets folder is as at the merge base of HEAD and the config's `baseBranch`: one the branch changed is put back, one it added is absent and one it removed is there again. On the ticket's first build stage that is the code as it was before the stage, and on a later one what it would be with no build stage, with whatever the base branch has brought since. It is set up as a ticket's worktree is (WSP-001/R2), and the config read is the stage's own, which no build stage may change. No other stage has a proof run.
- R3: In the proof run, each scenario the branch added or changed, a reworded one and a documented one (PIP-006/R10) aside, has at least one failing test, and every failing test of it has pipeline.TestCase.failureKind "assertion"; one that fails as "error", or with no failureKind, is refused, one problem per test, and a scenario with no failing test, or with no test in the run, is one problem. Each documented scenario has at least one passing test and no failing one. A problem for a scenario with no test in the run names the files the report marks failed as PIP-006/R12 does. No other test's result in the proof run counts, nor its exit code.
- R4: The proof tree is a folder of its own outside every worktree, one per check, removed when the check ends; nothing in the stage's tree, the index, the stash, the branches or the list of worktrees changes. The proof run takes a turn (PIP-009/R3) after the whole-tree run has given its own back, counts as a run of the command that makes it on that ticket, and has its own time limit. The line "tests: running the proof run on the code before the build" is written to stderr before it starts; stdout and the exit code follow only from the problems.
- R5: A proof run that gives no results, the proof tree's setup failing included, is a check that could not run (PIP-022/R1) with the reason starting "on the code before the build: ", and nothing is recorded or counted. A blocked report, and one with pipeline.Report.lane "full" (PIP-021/R10), makes no run.
- R6: A proof run that found no problem is kept and reused as PIP-008/R12 keeps and reuses the whole-tree run, under the same conditions and only with the same merge base and the same format.Config.worktreeSetup; a reused one adds the stderr line "tests: reused the proof run made at <time> on this tree".

## Out of scope
- Which stages the build lane runs, and how a ticket leaves it: PIP-021
- Whether a proved test checks what its scenario says: the reviewer, from the diff and the mutations (PIP-019)
- Running a test against a named mutation
