---
id: PIP-021
title: Run a small proposal in a light lane
module: pipeline
status: active
invariants: [INV-003, INV-004, INV-013]
---
## Intent
Some proposals leave stages with nothing to do: one that only brings scenario text in line with behaviour the code and its tests already have has nothing for the tester or the implementer, and one that fixes tests alone has nothing for the spec review or the implementer. A small proposal that changes behaviour has work for both, but pays for the hand-over: the implementer finds a wrong test it may not edit, the tester fixes it without seeing the code, and the ticket goes back and forth. A person puts such a proposal in a light lane, "docs", "tests" or "build", in its frontmatter, and the stage order skips those stages; the reviewer runs in every lane. In the "build" lane the implementer writes the tests and the code in one build stage, between the spec review and the reviewer. Test first stays, as a check the CLI makes (PIP-024) instead of a split between two roles. What it costs is the second reader: no independent tester reads the scenarios before the code exists, so one misreading can shape a test and its code alike, and only the spec review before and the reviewer after can see it. The lane is for a proposal small enough that the reviewer can judge its tests and code together; one that needs a second reader, or tests that cannot compile without the new code, belongs in the full lane. The lane is fixed once the first stage is recorded, so a later edit cannot skip a guard. The CLI keeps a light lane honest, not the agents: when recording a stage shows the ticket needs a stage its lane skips, or any stage reports that it does, the ticket leaves the light lane for good and runs the full order (PIP-001) from there.

## Behaviour
### S1: A docs-lane proposal runs spec-writer, spec-review, reviewer
Given a proposal "PROP-210" whose tickets.Ticket.lane is "docs" and whose history is empty
And its spec-writer stage rewords "PRV-002/S1", which a test named "PRV-002/S1 Fallback enabled" covers, and the test command exits 0 with every test passing
When its stages are recorded one at a time through pipeline.AdvanceTicket, the spec review approving
Then pipeline.Advanced.next is "spec-review" after "spec-writer" and "reviewer" after "spec-review" (R1, R5)
And the first pipeline.StageRecord has pipeline.StageRecord.lane "docs", and no later one has pipeline.StageRecord.lane (R2)
And on its empty history, pipeline.StartStage refuses "tester" with the message "tester is not a stage of a proposal in the docs lane: spec-writer → spec-review → reviewer" (R1)
And after the reviewer's "approve", pipeline.Advanced.status is "done"

### S2: A tests-lane proposal runs spec-writer, tester, reviewer
Given a proposal "PROP-211" whose tickets.Ticket.lane is "tests" and whose history is empty
And its spec-writer stage changes no file in the spec folder
And its tester's report is accepted, and its tree passes every check a done implementer stage gets: the test command exits 0 with no failed test, every command of format.Config.checkCommands exits 0, and no "SPEC-STUB" line the branch added is left
When its stages are recorded one at a time through pipeline.AdvanceTicket
Then pipeline.Advanced.next is "tester" after "spec-writer" and "reviewer" after "tester" (R1, R6, R7)
And the first pipeline.StageRecord has pipeline.StageRecord.lane "tests", and no later one has pipeline.StageRecord.lane (R2)
And on its empty history, pipeline.StartStage refuses "spec-review" with the message "spec-review is not a stage of a proposal in the tests lane: spec-writer → tester → reviewer" (R1)

### S3: A docs-lane spec-writer whose scenarios lack a passing test moves the proposal to the full lane
Given a proposal "PROP-210" whose tickets.Ticket.lane is "docs" and whose spec-writer stage is running
When the stage's done report is recorded through pipeline.AdvanceTicket in each case below
Then the new pipeline.StageRecord has pipeline.StageRecord.lane "full" and pipeline.Advanced.next is "spec-review" (R5):
| case |
| the stage adds "PRV-002/S9", and no test covers it |
| the stage changes the steps of "PRV-002/S2", and no test covers it |
| the stage changes only the title of "PRV-002/S3", a rewording, and no test covers it |
| the stage rewords "PRV-002/S1", and the only test that covers it fails |
| every scenario it adds, changes or rewords has a passing test, but another test fails |
| every test passes, but the test command exits 1, for example on a coverage threshold |
| the project's tests cannot be run, or their results cannot be read |
And once the spec review approves, pipeline.Advanced.next is "tester", then "implementer", then "reviewer" (R3)
And tickets.Ticket.lane still reads "docs" in the ticket file, though the order is the full one (R3)

### S4: A tests-lane spec-writer that changes the spec sends the proposal to the spec review
Given a proposal "PROP-211" whose tickets.Ticket.lane is "tests" and whose spec-writer stage changes a file in the spec folder
When its done report is recorded through pipeline.AdvanceTicket
Then the new pipeline.StageRecord has pipeline.StageRecord.lane "full" and pipeline.Advanced.next is "spec-review" (R6)
And after the spec review's "approve", pipeline.Advanced.next is "tester", then "implementer", then "reviewer" (R3)

### S5: A tests-lane tester is checked as any tester first, then against the implementer's checks
Given a proposal "PROP-211" whose tickets.Ticket.lane is "tests" and whose history is a done "spec-writer" with pipeline.StageRecord.lane "tests"
When its tester's done report is accepted by the tester's own checks and recorded through pipeline.AdvanceTicket, while a test fails, a command of format.Config.checkCommands fails on a file outside testGlobs, or a "SPEC-STUB" line the branch added is left
Then the new "tester" pipeline.StageRecord has pipeline.StageRecord.lane "full" and pipeline.Advanced.next is "implementer" (R7)
And once that implementer stage is done, pipeline.Advanced.next is "reviewer" (R3)
But when "npm run lint" fails on its own test file, as in PIP-006/S19, the tester's report is refused as on any tester stage, no pipeline.StageRecord.lane is recorded, and the next stage is "tester" again (R7)

### S6: Any stage can move its ticket to the full lane, and none can make it lighter
Given a proposal "PROP-210" whose history is a done "spec-writer" with pipeline.StageRecord.lane "docs"
When its spec review's report with verdict "approve" and pipeline.Report.lane "full" is recorded through pipeline.AdvanceTicket
Then the new pipeline.StageRecord has pipeline.StageRecord.lane "full" and pipeline.Advanced.next is "tester" (R4)
But a report with pipeline.Report.lane "docs", "tests" or "build", checked through pipeline.CheckReport, gives a problem that starts "report lane: " (R4, INV-013)
And on a proposal in the full lane, a report with pipeline.Report.lane "full" changes no stage: the order goes on as PIP-001 says

### S7: A reviewer finding that needs an earlier stage takes a light lane back to the full order
Given a proposal "PROP-210" whose history is a done "spec-writer" with pipeline.StageRecord.lane "docs", then "spec-review" approve
And its reviewer stage reports verdict "changes" with one pipeline.ReviewFinding with pipeline.ReviewFinding.tests true
When it is recorded through pipeline.AdvanceTicket
Then the new pipeline.StageRecord has pipeline.StageRecord.lane "full" and pipeline.Advanced.next is "tester", then "implementer", then "reviewer" (R8)
And with a finding with pipeline.ReviewFinding.spec true instead, pipeline.Advanced.next is "spec-writer", and after it the full order: "spec-review", "tester", "implementer", "reviewer" (R8)
But with findings marked neither way, pipeline.Advanced.next is "implementer", then "reviewer", and the record has no pipeline.StageRecord.lane (R8)

### S8: The lane is fixed once the first stage is recorded
Given a proposal "PROP-212" with no tickets.Ticket.lane whose history is a done "spec-writer" that changed the spec, so its record has no pipeline.StageRecord.lane
When its tickets.Ticket.lane is then set to "tests" and pipeline.StartStage is asked for "tester"
Then it fails with pipeline.StageRefused and the message "the next stage of PROP-212 is spec-review, not tester" (R2, INV-013)
And with tickets.Ticket.lane set to "docs" after its spec review approved, the next stage is "tester", not "reviewer" (R2, INV-013)
And a proposal whose first record has pipeline.StageRecord.lane "docs" runs the docs lane though its tickets.Ticket.lane is later set to "full" or "tests" (R2)
And a docs-lane "PROP-210" whose tickets.Ticket.lane is edited to "tests" while its first stage is running gets the first pipeline.StageRecord.lane "tests", the lane that record keeps (R2)
And a ticket whose history was recorded before lanes existed has no pipeline.StageRecord.lane on its first record, so it runs the full order (R2)

### S9: A build-lane proposal runs spec-writer, spec-review, implementer, reviewer
Given a proposal "PROP-215" whose tickets.Ticket.lane is "build" and whose history is empty
And its implementer's done report passes every check of PIP-024
When its stages are recorded one at a time through pipeline.AdvanceTicket, the spec review approving
Then pipeline.Advanced.next is "spec-review" after "spec-writer", "implementer" after "spec-review" and "reviewer" after "implementer" (R1, R9)
And the first pipeline.StageRecord has pipeline.StageRecord.lane "build", and no later one has pipeline.StageRecord.lane (R2)
And the build stage's one commit holds its test files and its code (R9)
And on its empty history, pipeline.StartStage refuses "tester" with the message "tester is not a stage of a proposal in the build lane: spec-writer → spec-review → implementer → reviewer" (R1)
And after the reviewer's "approve", pipeline.Advanced.status is "done"
And a ticket whose tickets.Ticket.lane is set to "build" after its first stage was recorded without it keeps its full order, as in S8 (R2, INV-013)

### S10: A spec review's changes, or a reopened spec stage, stay in the build lane
Given the "PROP-215" of S9 after a done "spec-writer" with pipeline.StageRecord.lane "build"
When its spec review's "changes" is recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.next is "spec-writer", then "spec-review", and after its "approve" "implementer" (R1, PIP-001/R7)
And after a done build stage, a person's answer that reopens "spec-writer" gives the same order, and the build stage that follows is checked against the code before the first one, as PIP-024/S8 says (R1, PIP-024/R2)

### S11: A done report that asks for the full lane hands the ticket to the tester
Given the "PROP-215" of S9 in its first build stage, with "src/providers.ts" and "tests/prv_001.test.ts" changed
When its report with result "done", summary "Needs stubs" and pipeline.Report.lane "full" is recorded through pipeline.AdvanceTicket
Then the test command does not run, and the new "implementer" pipeline.StageRecord has pipeline.StageRecord.lane "full" and no pipeline.StageRecord.mutations (R4, R10)
And stdout's lines are "PROP-215 implementer: Needs stubs", "next: tester" and "stash: PROP-215 build: blocked", pipeline.Advanced.status is "open", pipeline.Advanced.stash is "PROP-215 build: blocked", and no tickets.Question is added (R10, R11)
And the stage's commit holds only "tickets/PROP-215.md", and that stash holds "src/providers.ts" and "tests/prv_001.test.ts" (R10, R11)
And the tester that follows is held to test first, as before any implementer stage: a done report whose new tests all pass is refused as in PIP-006/S5 (R10, PIP-006/R9, INV-004)
And after the tester, pipeline.Advanced.next is "implementer", then "reviewer" (R3)

### S12: A blocked build stage that asks for the full lane goes to the tester once answered
Given the "PROP-215" of S11, whose report is instead blocked, with pipeline.Report.lane "full" and one pipeline.Blocker
When it is recorded through pipeline.AdvanceTicket and the question its blocker raises is answered
Then the "implementer" pipeline.StageRecord has result "blocked" and pipeline.StageRecord.lane "full", and pipeline.StartStage accepts "tester" and refuses "implementer" with the message "the next stage of PROP-215 is tester, not implementer" (R10, PIP-001/R2)
And the question's text ends "Its changes are kept in git stash ''PROP-215 build: blocked''; no later stage gets them back." (R11)
And the tester that follows is held to test first, as in S11 (R10, PIP-006/R9)

### S13: A blocked build stage that stays in the lane gets its work back
Given the "PROP-215" of S9 in its build stage, with "src/providers.ts" and the new "tests/prv_001.test.ts" uncommitted, and no pipeline.Report.lane in its blocked report
When it is recorded through pipeline.AdvanceTicket and its question is answered
Then stdout's last line is "stash: PROP-215 build: blocked", and the question's text ends "Its changes are kept in git stash ''PROP-215 build: blocked''; the next build stage gets them back." (R11, PIP-008/R9)
And the next "spec ticket start PROP-215 implementer" through pipeline.StartStage brings both files back and drops that stash (R11, PIP-002/R4)
And a third refused report stashes and blocks the same way, with pipeline.StageRecord.summary "invalid report" and no pipeline.StageRecord.lane, so the ticket is still in the build lane (R11, PIP-008/R9)
And "spec next PROP-215 --restart" keeps and restores an interrupted build stage's changes through a stash of that name (R11)
But when the ticket leaves the lane first, as by a reopened "spec-writer" whose report has pipeline.Report.lane "full", the full lane's "implementer" stage restores nothing from that stash, which stays in "git stash list" (R11, PIP-002/R4)
And "spec ticket close PROP-215 --superseded-by PROP-063", run then, prints a "kept stash" line for "PROP-215 build: blocked" (R11, TKT-012/R12)

### S14: A build stage cannot hand a test to the tester
Given the "PROP-215" of S9 in its build stage, whose blocked report has one pipeline.Blocker with pipeline.Blocker.tests true
When it is checked through pipeline.CheckReport, with and without pipeline.Report.lane "full"
Then each time the only problem is "the build lane has no tester stage: fix the test in this stage, and drop tests: true from the blocker" (R12, PIP-004/R9)
But once the ticket has left the lane, its "implementer" stage may hand a test to the tester as in PIP-008/S28 (R12)

### S15: A round of changes in the build lane
Given the "PROP-215" of S9 whose build stage is recorded done and whose reviewer asked for changes with one pipeline.ReviewFinding marked neither spec nor tests
When the next build stage, which changes "src/providers.ts" and "tests/prv_001.test.ts", is recorded through pipeline.AdvanceTicket with a done report that passes every check of PIP-024
Then pipeline.Advanced.next is "reviewer", and the record has no pipeline.StageRecord.lane (R8, R9)
But had the finding pipeline.ReviewFinding.tests true, the reviewer's record would have pipeline.StageRecord.lane "full" and pipeline.Advanced.next would be "tester", then "implementer", then "reviewer" (R8)
And that tester, and the implementer after it, are held to the full lane's rules: the tester may leave every test passing, since a build stage is recorded done (PIP-006/R9), and the implementer may change no test file (PIP-005/R1, INV-003)

### S16: A later build stage that leaves the lane keeps the earlier one's work
Given the "PROP-215" of S15 in its second build stage, whose report has result "done" and pipeline.Report.lane "full"
When it is recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.next is "tester", its changes are in the stash "PROP-215 build: blocked", and the branch still holds the first build stage's commit (R10, R11)
And that tester may leave every test passing, as the first build stage's done record counts (PIP-006/R9)

## Rules
- R9: A build stage is an implementer stage run while the ticket is in the "build" lane (R2, R3). It writes the tests and the code, and its done report is held to PIP-024, its mutations kept as a tester's are (PIP-019/R3). A refused report leaves the lane as it is.
- R10: A build stage's report with pipeline.Report.lane "full", done or blocked, gives up the stage: it is checked as a blocked report is, a done one needing no blocker, so no test and no check command runs and no mutation is asked for. Its record holds lane "full" and no mutations, its changes are stashed (R11) and never committed, and the tester runs next, after any question its blockers raise is answered. The record does not count as an implementer stage for PIP-006/R9 and R10 and PIP-014/R4.
- R11: Whatever way a build stage's changes are stashed (blocked, refused for the third time, given up or restarted), the stash is named "<ID> build: blocked" in place of "<ID> implementer: blocked" (PIP-008/R9), and only a build stage of that ticket restores it (PIP-002/R4). Its question says "the next build stage gets them back", or "no later stage gets them back" when the record has lane "full", so test files one role wrote never reach a stage that may not change them.
- R12: In the "build" lane a blocker marked pipeline.Blocker.tests is refused, whatever the report's lane (PIP-004/R9), so no hand-off (PIP-008/R13) happens in it.
- R1: A proposal in the "docs" lane runs spec-writer → spec-review → reviewer; one in the "tests" lane runs spec-writer → tester → reviewer; one in the "build" lane runs spec-writer → spec-review → implementer → reviewer; the "full" lane is PIP-001/R1. Every other rule of PIP-001 (a blocked stage, a reopened stage, the rounds of changes and their limits) applies in a light lane as in the full one. pipeline.StartStage refuses a role the lane skips with "<role> is not a stage of a proposal in the <lane> lane: <its order>" when the history gives no other next stage.
- R2: tickets.Ticket.lane is read only while the history is empty, so an edit of it before the first stage is recorded, even while that stage is running, is the lane the first record keeps. Recording the first stage keeps it in that record's pipeline.StageRecord.lane when it is "docs", "tests" or "build" (or "full" when that stage moves the ticket out, R3). From then on the lane is the first record's pipeline.StageRecord.lane, or "full" when it has none, and a later edit of tickets.Ticket.lane changes nothing.
- R3: A ticket leaves its light lane for good when a later record holds pipeline.StageRecord.lane "full" (R4 to R8, R10); from that record on it runs the full order of its type, going on from the recorded role as PIP-001/R1, R3, R5 and R6 say, except after a build stage, which the tester follows (R10).
- R4: A report's pipeline.Report.lane "full", from any role, done or blocked, moves the ticket to the full lane; no other value is accepted.
- R5: In the "docs" lane, each done spec-writer stage is checked by the CLI running the project's test command on the stage's tree. The ticket stays in the lane only when the command exits 0, no test fails, and every scenario the branch added, changed or reworded (PIP-014/R2) has at least one test that covers it (PIP-011) and passes; otherwise, including when the tests cannot be run or their results read, the record holds lane "full".
- R6: In the "tests" lane, a done spec-writer stage that changes any file in the spec folder moves the ticket to the full lane.
- R7: In the "tests" lane, a tester's report is first checked as on any tester stage (PIP-004, PIP-006); a report those checks refuse is refused as there, and the lane does not change. An accepted done tester stage whose tree then fails any check a done implementer stage gets (PIP-006/R5, R6, R7: the test command exits 0 with no failed test, every command of format.Config.checkCommands exits 0, no "SPEC-STUB" line the branch added is left) moves the ticket to the full lane, and the implementer runs next.
- R8: A reviewer "changes" with a finding marked pipeline.ReviewFinding.spec or pipeline.ReviewFinding.tests moves a light-lane ticket to the full lane, and PIP-001/R5 and R6 name the next stage; one with neither mark leaves the lane as it is, and the implementer then the reviewer run (PIP-001/R3).

## Out of scope
- The full order and its loops: PIP-001
- Which ticket types may name a light lane: TKT-001
- What each role is told about its lane: PIP-012, PIP-014 and PIP-017
- The checks a done build stage gets: PIP-024
