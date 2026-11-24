---
id: PIP-001
title: Run each ticket type's stages in a fixed order
module: pipeline
status: active
retired: [S10, S26, S27, S28, S29, S30, S31, S32, S33, R10, R11]
invariants: [INV-004]
---
## Intent
Every ticket type has one fixed order of stages, so no role ever decides what runs next. Behaviour changes are test first: on a proposal or a bug the tester writes failing tests before the implementer touches code, or, on a proposal in the build lane, the check on the one stage that writes both proves it (PIP-024). On a proposal a spec review attacks the spec change before any test is written, and its "changes" sends the spec back to the spec-writer a bounded number of times. The order is read from the ticket's history alone, so a blocked stage resumes where it stopped, an implementer that hands a wrong test to the tester is followed by the tester and then, when the combined tree passes every done-implementer check, the reviewer, and a reviewer's "changes" loops back a bounded number of times: to the implementer, or, when a finding names a gap in the spec or asks only for tests, to the stage that can close it. This is the order of the full lane; a proposal in a light lane skips some of these stages (PIP-021).

## Behaviour
### S1: A proposal runs spec-writer, spec-review, tester, implementer, reviewer
Given a ticket "PROP-201" whose tickets.Ticket.type is "proposal"
When its tickets.Ticket.history grows one done pipeline.StageRecord at a time through pipeline.AdvanceTicket, the "spec-review" one with pipeline.StageRecord.verdict "approve"
Then pipeline.Advanced.next is "spec-review" after "spec-writer", "tester" after "spec-review", "implementer" after "tester", "reviewer" after "implementer" (R1, INV-004)
And the first stage pipeline.StartStage accepts on an empty history is "spec-writer"

### S2: A bug runs tester, implementer, reviewer
Given a ticket "BUG-301" whose tickets.Ticket.type is "bug" and whose history is empty
When pipeline.StartStage is asked for each next stage in turn
Then the stages run in the order "tester", "implementer", "reviewer" (R1, INV-004)

### S3: A task runs implementer, reviewer
Given a ticket "TASK-101" whose tickets.Ticket.type is "task" and whose history is empty
When pipeline.StartStage is asked for "tester"
Then it fails with pipeline.StageRefused and the message "tester is not a stage of a task: implementer → reviewer" (R1)

### S4: Approve finishes the ticket
Given a task whose history is one done "implementer" pipeline.StageRecord
When the reviewer's stage is recorded through pipeline.AdvanceTicket with pipeline.Report.verdict "approve"
Then pipeline.Advanced.status is "done" and pipeline.Advanced.next is null

### S5: A blocked stage resumes itself
Given a task whose last pipeline.StageRecord has role "implementer" and pipeline.StageRecord.result "blocked", and whose blocker questions have been answered
When the next stage is asked for through pipeline.StartStage
Then the next stage is "implementer" again, so starting "reviewer" fails with pipeline.StageRefused and the message "the next stage of TASK-101 is implementer, not reviewer" (R2)

### S6: Changes go back to the implementer, then straight to review
Given a proposal whose history is done "spec-writer", "tester", "implementer", then "reviewer" with pipeline.StageRecord.verdict "changes"
When the reviewer's stage is recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.next is "implementer"
And once that implementer stage is done, pipeline.Advanced.next is "reviewer", not "tester" (R3)

### S7: A second round of changes is allowed
Given a proposal whose history is "spec-writer", "tester", "implementer", "reviewer" changes, "implementer", and whose reviewer stage is running again
When that reviewer's verdict "changes", its second, is recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.next is "implementer" (R3)

### S8: A third round of changes blocks the ticket on a person
Given a task whose history is "implementer", "reviewer" changes, "implementer", "reviewer" changes, "implementer"
When a third "reviewer" stage with verdict "changes" and one pipeline.ReviewFinding is recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.status is "blocked" and pipeline.Advanced.next is null
And the last tickets.Question added has tickets.Question.kind "blocker", tickets.Question.raised_by "overseer" and tickets.Question.text "the reviewer asked for changes 3 times; a person must decide. How should TASK-101 proceed?" (R3)

### S9: A ticket past its last stage cannot start again
Given a task whose history ends with a "reviewer" stage that approved
When pipeline.StartStage is asked for "reviewer"
Then it fails with pipeline.StageRefused and the message "TASK-101 has finished its pipeline"

### S11: A reopened stage runs next, and the pipeline continues from it
Given a proposal "PROP-206" whose history is done "spec-writer", done "tester", "implementer" blocked, then a pipeline.StageRecord with role "tester" and result "reopened"
When pipeline.StartStage is asked for "implementer"
Then it fails with pipeline.StageRefused and the message "the next stage of PROP-206 is tester, not implementer" (R4)
And once "tester" is done, pipeline.Advanced.next is "implementer", and once that is done, "reviewer" (R1, R4)

### S12: A reopened stage after a round of changes
Given a task whose history is "implementer", "reviewer" changes, "implementer", then a pipeline.StageRecord with role "implementer" and result "reopened"
When the implementer's stage is done and recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.next is "reviewer", and the reviewer's earlier "changes" still count toward the limit of R3 (R3, R4)

### S13: A finding that names a gap in the spec sends a proposal back to the spec-writer
Given a proposal "PROP-201" whose history is done "spec-writer", "tester", "implementer"
And its reviewer stage reports verdict "changes" with two pipeline.ReviewFinding, one with pipeline.ReviewFinding.spec true and one without
When it is recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.next is "spec-writer" and pipeline.Advanced.status is "open" (R5)
And pipeline.StartStage accepts "spec-writer", and refuses "implementer" with the message "the next stage of PROP-201 is spec-writer, not implementer"
And the new pipeline.StageRecord.findings holds both findings (R5)

### S14: After that, the pipeline goes on from the spec-writer
Given the proposal of S13 after its spec-writer stage is done
When that stage and each one after it is recorded through pipeline.AdvanceTicket, the spec review approving
Then pipeline.Advanced.next is "spec-review" after "spec-writer", "tester" after "spec-review", "implementer" after "tester", and "reviewer" after "implementer" (R5, R7)
And the reviewer's earlier "changes" count toward the limit of R3 (R3)

### S15: A bug goes back to the tester
Given a bug "BUG-301" whose history is done "tester", "implementer", then "reviewer" with verdict "changes" and a pipeline.ReviewFinding with pipeline.ReviewFinding.spec true
When the reviewer's stage is recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.next is "tester", and once that is done "implementer", then "reviewer" (R5)

### S16: A task has no earlier stage to go back to
Given a task "TASK-101" whose history is done "implementer", then "reviewer" with verdict "changes" and a pipeline.ReviewFinding with pipeline.ReviewFinding.spec true
When the reviewer's stage is recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.next is "implementer", as for any other finding (R3, R5)

### S17: Findings about the code still go to the implementer
Given a proposal whose history is done "spec-writer", "tester", "implementer", then "reviewer" with verdict "changes" and two pipeline.ReviewFinding, neither with pipeline.ReviewFinding.spec true, or one with it false
When the reviewer's stage is recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.next is "implementer" (R3, R5)

### S18: A finding that asks only for tests sends the ticket to the tester
Given a proposal "PROP-201" whose history is done "spec-writer", "tester", "implementer"
And its reviewer stage reports verdict "changes" with two pipeline.ReviewFinding, one with pipeline.ReviewFinding.tests true and one with neither mark
When it is recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.next is "tester" and pipeline.Advanced.status is "open" (R6)
And pipeline.StartStage refuses "implementer" with the message "the next stage of PROP-201 is tester, not implementer"
And once "tester" is done, pipeline.Advanced.next is "implementer", and once that is done, "reviewer" (R6)
And that tester stage may leave every test passing, since the implementer has run (INV-004)
And the reviewer's earlier "changes" count toward the limit of R3 (R3)

### S19: With both marks the earliest stage wins
Given a proposal "PROP-201" whose history is done "spec-writer", "tester", "implementer", then "reviewer" with verdict "changes" and two pipeline.ReviewFinding, one with pipeline.ReviewFinding.spec true and one with pipeline.ReviewFinding.tests true
When the reviewer's stage is recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.next is "spec-writer" (R5, R6)
And on a bug "BUG-301" whose reviewer finding has pipeline.ReviewFinding.tests true, pipeline.Advanced.next is "tester" (R6)
And on a task "TASK-101" whose reviewer finding has pipeline.ReviewFinding.tests true, pipeline.Advanced.next is "implementer" (R3, R6)

### S20: A spec review that asks for changes sends the proposal back to the spec-writer
Given a proposal "PROP-201" whose history is done "spec-writer"
And its "spec-review" stage reports verdict "changes" with one pipeline.ReviewFinding citing "PRV-001/S4"
When it is recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.next is "spec-writer" and pipeline.Advanced.status is "open" (R7)
And the new pipeline.StageRecord has role "spec-review", verdict "changes" and pipeline.StageRecord.findings holding that finding (R7)
And pipeline.StartStage refuses "tester" with the message "the next stage of PROP-201 is spec-writer, not tester"
And once that spec-writer stage is done, pipeline.Advanced.next is "spec-review" again, and after its "approve", "tester" (R1, R7)

### S21: A third round of spec review changes blocks the proposal on a person
Given a proposal "PROP-201" whose history is "spec-writer", "spec-review" changes, "spec-writer", "spec-review" changes, "spec-writer"
When a third "spec-review" stage with verdict "changes" and one pipeline.ReviewFinding is recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.status is "blocked" and pipeline.Advanced.next is null
And the last tickets.Question added has tickets.Question.kind "blocker", tickets.Question.raised_by "overseer" and tickets.Question.text "the spec-review asked for changes 3 times; a person must decide. How should PROP-201 proceed?" (R7)
But a second "changes" from the spec review only sends the proposal back to the spec-writer (R7)

### S22: The spec review and the reviewer count their rounds apart
Given a proposal "PROP-201" whose history is "spec-writer", "spec-review" changes, "spec-writer", "spec-review" changes, "spec-writer", "spec-review" approve, "tester", "implementer"
When a "reviewer" stage with verdict "changes" and one pipeline.ReviewFinding marked neither spec nor tests is recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.next is "implementer", since the reviewer has asked for changes once (R3, R7)
And when a reviewer finding with pipeline.ReviewFinding.spec true then sends it to the spec-writer, the spec review that follows may still ask for changes once more before the proposal blocks, since the earlier two count toward its limit (R5, R7)

### S23: A proposal recorded before the spec review existed
Given a proposal "PROP-205" whose history, recorded by an earlier version, is one done "spec-writer" stage and no "spec-review" stage
When pipeline.StartStage is asked for "tester"
Then it fails with pipeline.StageRefused and the message "the next stage of PROP-205 is spec-review, not tester" (R1)
But a proposal whose history already holds a done "tester" stage after its "spec-writer" goes on to "implementer", and no spec review is asked for (R1)

### S24: Bugs and tasks have no spec review
Given a bug "BUG-301" and a task "TASK-101", each with an empty history
When pipeline.StartStage is asked for "spec-review" on each
Then it fails with pipeline.StageRefused and the messages "spec-review is not a stage of a bug: tester → implementer → reviewer" and "spec-review is not a stage of a task: implementer → reviewer" (R1)
And their stages run as before: "tester", "implementer", "reviewer" for the bug and "implementer", "reviewer" for the task (R1)

### S25: A hand-off runs the tester, then the reviewer when the tests pass
Given a proposal "PROP-201" whose history is done "spec-writer", "spec-review" approve, done "tester", then an "implementer" pipeline.StageRecord with result "blocked" and pipeline.StageRecord.blockers holding one pipeline.Blocker with pipeline.Blocker.tests true
When pipeline.StartStage is asked for "implementer"
Then it fails with pipeline.StageRefused and the message "the next stage of PROP-201 is tester, not implementer" (R2, R8)
And once that tester's stage is recorded through pipeline.AdvanceTicket with pipeline.StageRecord.passed true, pipeline.Advanced.next is "reviewer"; with pipeline.StageRecord.passed false it is "implementer", and once that is done, "reviewer" (R8)
And a bug "BUG-301" whose history is done "tester", then such an "implementer" record, goes to "tester" the same way (R8)
But an "implementer" record with result "blocked" and no pipeline.StageRecord.blockers, as every earlier version recorded, is followed by "implementer", as in S5 (R2)
And a done "tester" record with no pipeline.StageRecord.passed is followed by "implementer" (R1)

### S34: A proposal with no lane, or the full lane, runs every stage
Given two proposals, "PROP-213" with no tickets.Ticket.lane key and "PROP-214" with tickets.Ticket.lane "full", each with an empty history
When their stages are recorded one at a time through pipeline.AdvanceTicket, the spec review approving
Then each runs "spec-writer", "spec-review", "tester", "implementer", "reviewer" in that order (R1, R9)

### S35: A light lane leaves out only the stages it skips
Given a proposal "PROP-215" whose first pipeline.StageRecord has pipeline.StageRecord.lane "build", and whose history is done "spec-writer", "spec-review" approve, done "implementer", then "reviewer" with verdict "changes" and one pipeline.ReviewFinding marked neither spec nor tests
When the reviewer's stage is recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.next is "implementer", and once that stage is done, "reviewer" (R3, R9)
And a third such "changes" blocks it on a person, as in S8 (R3, R9)
And a blocked "implementer" stage with no pipeline.StageRecord.lane is followed by "implementer" again, while a blocked or done one with pipeline.StageRecord.lane "full" is followed by "tester" (R2, R9, PIP-021/R10)

## Rules
- R8: After a hand-off, an "implementer" record with result "blocked" that holds pipeline.StageRecord.blockers (PIP-008/R13), the tester runs. After a done tester stage whose pipeline.StageRecord.passed is true, the reviewer runs; with it false or left out, the order goes on as R1 says: the implementer, then the reviewer.
- R1: A proposal runs spec-writer → spec-review → tester → implementer → reviewer; a bug runs tester → implementer → reviewer; a task runs implementer → reviewer. The first stage of an empty history is the type's first stage. A history is read as it stands: after a done stage the next is the one that follows its role in this order, so a proposal whose last stage is a done spec-writer, whenever it was recorded, goes to the spec review, and one already past it never goes back for one.
- R2: After a blocked stage, the same role's stage runs again, a hand-off (R8) and a build stage that gives up its lane (PIP-021/R10) aside.
- R3: After a reviewer "changes" with no finding marked pipeline.ReviewFinding.spec or pipeline.ReviewFinding.tests, the implementer runs, then the reviewer again, skipping every other stage. The ticket blocks on a person when the reviewer has asked for changes more than 2 times in its history, whatever the findings say.
- R5: After a reviewer "changes" in which any finding has pipeline.ReviewFinding.spec true, a proposal's next stage is the spec-writer and a bug's is the tester, and the order goes on from that role in the ticket type's pipeline, as after a reopened stage (R4). A task has no such stage: its next stage is the implementer (R3). The findings are kept in the reviewer's pipeline.StageRecord.
- R6: After a reviewer "changes" in which any finding has pipeline.ReviewFinding.tests true and none has pipeline.ReviewFinding.spec true, a proposal's or a bug's next stage is the tester, and the order goes on from it in the ticket type's pipeline: the implementer, then the reviewer. A task has no tester stage: its next stage is the implementer (R3). When findings carry both marks, the earliest of the stages they name runs next (R5). The round is counted as any other (R3).

- R4: A "reopened" entry as the last in the history makes its role the next stage, as a blocked stage does (R2); when that stage is done the order goes on from that role in the ticket type's pipeline. The entry is added by `spec ticket answer --back` (tickets).
- R7: After a spec-review "approve" the tester runs. After a spec-review "changes" the spec-writer runs, then the spec review again; the findings are kept in the spec review's pipeline.StageRecord. The proposal blocks on a person when the spec review has asked for changes more than 2 times in its history. Spec-review rounds and reviewer rounds are counted apart: neither counts toward the other's limit (R3).
- R9: The orders of R1 are those of the full lane, which every ticket runs unless it is a proposal in a light lane (PIP-021); a ticket with no tickets.Ticket.lane, or with "full", runs them unchanged. In a light lane every other rule here holds, with the stages the lane skips left out: a rule that names a skipped stage goes on to the stage after it in the full order that the lane keeps.

## Out of scope
- Whether a ticket may start at all: the gate decides (tickets)
- The retired ticket-runner brief path is replaced by the main session's stage flow (CLI-007)
- Running stages of several tickets at once (workspace)
