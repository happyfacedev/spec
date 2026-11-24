---
id: PIP-008
title: Record a finished stage and commit it
module: pipeline
status: active
writes: [tickets.Ticket.status, tickets.Ticket.stage, tickets.Ticket.history, tickets.Ticket.questions, tickets.Ticket.changed]
provides: [pipeline.AdvanceTicket]
invariants: [INV-003, INV-006, INV-017]
decisions: [ADR-002]
---
## Intent
`spec ticket advance <TICKET>` ends the stage that is running: it checks the role's report exactly as `check-report` does, records the stage in the ticket's history, turns blockers into questions so the gate holds the ticket until a person answers, rebuilds the generated files, and commits the stage as one commit holding only this ticket's work. A report that fails its checks blocks the ticket and commits nothing. A stage that ends blocked, either way, keeps its work: advance stashes it, and the next run of that stage gets it back, so no role reverts or stashes anything itself. One blocked stage is the exception: an implementer whose code is done and whose only blockers are wrong tests hands off. Its work is committed, no person is asked, and the tester runs next against that code. A report that never arrived changes nothing at all, so a transport slip never loses a stage. A full test run can take minutes, and a role runs `check-report` just before its stage is recorded, so advance does not run the tests a second time on the same work: when `check-report` ran them for the same ticket and role on exactly the tree advance sees, advance checks the stage on that run. Any difference, or any doubt, and it runs them again. A test run that gives no results (a timeout, a runner that cannot start) says nothing about the report: advance then says the check could not run and to run it again, records nothing and counts no attempt (PIP-022).

## Behaviour
### S1: A done stage is recorded and committed
Given "BUG-301" is in its "tester" stage, its failing test for "PRV-002/S3" is uncommitted, and the clock reads "2026-10-27T12:00:00.000Z"
And stdin is the tester's message ending in a report with summary "Added the PRV-002/S3 test; it fails on main" and changed ["PRV-002/S3"]
When the developer runs `spec ticket advance BUG-301` through pipeline.AdvanceTicket
Then stdout is "BUG-301 tester: Added the PRV-002/S3 test; it fails on main" then "next: implementer", and the exit code is 0
And one commit is added whose subject is that first line and whose message ends in the one trailer line "Spec-Ticket: BUG-301" (R1)
And tickets.Ticket.status is "open", tickets.Ticket.stage is null, and tickets.Ticket.history ends with the pipeline.StageRecord {at "2026-10-27T12:00:00.000Z", role "tester", result "done", summary "Added the PRV-002/S3 test; it fails on main", verdict null, assumed []}
And tickets.Ticket.changed holds "PRV-002/S3"

### S2: JSON output
Given the stage of S1
When the developer runs `spec ticket advance BUG-301 --format json` through pipeline.AdvanceTicket
Then stdout is the pipeline.Advanced {"ticket": "BUG-301", "next": "implementer", "status": "open", "problems": []}

### S3: The last stage finishes the ticket
Given "BUG-301" is in its "reviewer" stage after its tester and implementer stages
When a reviewer report with verdict "approve" and summary "Fix matches PRV-002/R2" is recorded through pipeline.AdvanceTicket
Then pipeline.Advanced.status is "done", pipeline.Advanced.next is null, and stdout's second line is "status: done"
And the branch holds one commit per stage, newest first: "BUG-301 reviewer: Fix matches PRV-002/R2", "BUG-301 implementer: …", "BUG-301 tester: …"
And the working tree is clean and `spec lint --ci` exits 0

### S4: A multi-line summary becomes one line
Given a done report whose summary is "Did it" and "well" on two lines
When it is recorded through pipeline.AdvanceTicket for "TASK-101"
Then the commit's subject and pipeline.StageRecord.summary are both "Did it well" (R1)

### S5: A long summary is cut in the commit only
Given a done report whose summary is 215 characters
When it is recorded through pipeline.AdvanceTicket
Then the commit's subject is its first 119 characters, trailing spaces trimmed, followed by "…"
And pipeline.StageRecord.summary keeps all 215 characters (R1)

### S6: A blocked stage turns its blockers into questions
Given "TASK-101" has no questions, and its implementer reports blocked with one pipeline.Blocker {text "Needs a meta field", cites ["conversation.Message.meta"]}
When it is recorded through pipeline.AdvanceTicket
Then tickets.Ticket.questions is exactly [{id "Q1", kind "blocker", text "Needs a meta field", default null, cites ["conversation.Message.meta"], answer null, raised_by "implementer"}] (R2)
And tickets.Ticket.status is "blocked", stdout's second line is "status: blocked", the exit code is 0 and the stage is committed
And a new question takes the number after the highest one the ticket already has

### S7: Changed units accumulate
Given "TASK-101" has an empty changed list
When a done implementer report with changed ["PRV-002/S1", "PRV-001/S1"] is recorded through pipeline.AdvanceTicket
Then tickets.Ticket.changed is ["PRV-001/S1", "PRV-002/S1"]: earlier entries kept, duplicates dropped, in ID order (R3)
But a blocked report adds nothing to it

### S8: The spec-writer's changes are read from the tree
Given "PROP-201" is in its "spec-writer" stage, the branch added "PRV-001/S4" and "SET-001/S4", and the report's changed is only ["providers.ProviderConfig"]
When it is recorded through pipeline.AdvanceTicket
Then tickets.Ticket.changed holds "providers.ProviderConfig", "PRV-001/S4" and "SET-001/S4" (R3)

### S9: Defaults applied are kept
Given a done implementer report on "PROP-202" with assumed [{ question: "PROP-202#Q1", value: alphabetical }]
When it is recorded through pipeline.AdvanceTicket
Then the new pipeline.StageRecord.assumed is that same list

### S10: A report that fails its checks blocks the ticket
Given "TASK-101" is in its "implementer" stage and its report is refused with the problem "tests fail (exit 1): PRV-001/S1 Streams tokens"
When it is recorded through pipeline.AdvanceTicket
Then it fails with pipeline.InvalidReport: stderr is "report rejected:", the problems as "- " lines, "TASK-101 is blocked; nothing was committed." and "stash: TASK-101 implementer: blocked"; the exit code is 1
And HEAD is unchanged, and the stage's changes are no longer in the tree but in the git stash "TASK-101 implementer: blocked" (R4, R9)
But a changed "src/generated/assets.ts", which format.Config.generated names, is put back as HEAD has it and is not in the stash (R9)
And tickets.Ticket.status is "blocked", tickets.Ticket.stage is null, and the history ends with {role "implementer", result "blocked", summary "invalid report", verdict null, assumed []}
And the new tickets.Question is a blocker raised by "implementer" with text "The implementer stage ended with an invalid report: tests fail (exit 1): PRV-001/S1 Streams tokens. Its changes are kept in git stash ''TASK-101 implementer: blocked''; the next implementer stage gets them back. Answer to resume."
And with `--format json`, stdout is the pipeline.Advanced with status "blocked", next null and the problems, still exit 1
And for "PROP-215" in a build stage the stash is "PROP-215 build: blocked", in the output line and in the question, which ends "; the next build stage gets them back. Answer to resume." (R9, PIP-021/R11)

### S11: No report anywhere
Given "TASK-103" is in its "implementer" stage, stdin is empty and no report is stored
When the developer runs `spec ticket advance TASK-103` through pipeline.AdvanceTicket
Then it fails with pipeline.NoReport: stderr starts "no report for the implementer stage of TASK-103: pass the role's final message on stdin. Nothing was recorded; the stage is still running." and the exit code is 2
And tickets.Ticket.status is still "in_progress", tickets.Ticket.stage still "implementer", and HEAD is unchanged (R5)

### S12: Report YAML that lost its fence
Given "TASK-103" is in its "implementer" stage and stdin is the bare lines "role: implementer", "ticket: TASK-103", "result: done", "summary: Nothing to simplify safely", with no fence
When it is recorded through pipeline.AdvanceTicket
Then it is read as if fenced, and pipeline.Advanced is next "reviewer", status "open", problems [] (R5)
But bare text that is not a valid report counts as no report, as in S11

### S13: The report stored by the finish check
Given "TASK-103" is in its "reviewer" stage, stdin is empty, and the finish check stored a reviewer report at ".git/spec/reports/TASK-103.md"
When the developer runs `spec ticket advance TASK-103` through pipeline.AdvanceTicket
Then that report is recorded: pipeline.Advanced.status "done"
And the stored report is deleted (R5)

### S14: A fenced report on stdin wins
Given a report is stored for "TASK-103" and stdin also holds a fenced report block
When it is recorded through pipeline.AdvanceTicket
Then the report on stdin is the one checked, and the stored one is deleted (R5)

### S15: Only this ticket's files are committed
Given "TASK-101" is being recorded and another ticket's file "tickets/TASK-102.md" is also uncommitted
When the stage is recorded through pipeline.AdvanceTicket
Then the commit holds every other change in the tree and "tickets/TASK-101.md", and "tickets/TASK-102.md" stays uncommitted (R6)

### S16: A stage that changed nothing still commits
Given a reviewer stage on a ticket kept in a tracker, so no ticket file changes
When it is recorded through pipeline.AdvanceTicket
Then an empty commit "<ID> reviewer: <summary>" is added (R6)

### S17: No stage running
Given "TASK-101" has tickets.Ticket.status "open"
When the developer runs `spec ticket advance TASK-101` through pipeline.AdvanceTicket
Then it fails with pipeline.NoStageRunning: stderr "TASK-101 has no stage running; spec ticket start begins one", exit code 1

### S18: The generated files are rebuilt before the commit
Given a done spec-writer stage that changed a feature's title
When it is recorded through pipeline.AdvanceTicket
Then the commit includes the rebuilt `index.md`
And if the build fails, it fails with pipeline.RecordFailed and stderr "build failed after the spec-writer stage: <errors>" after the ticket was already updated

### S19: The features the gate's scope rule requires are added
Given "PROP-201" is in its "spec-writer" stage, the feature "SET-002" writes "settings.ApiKey", the stage extended "settings.ApiKey", and neither the ticket's touches nor the report's changed names "SET-002"
When it is recorded through pipeline.AdvanceTicket
Then tickets.Ticket.changed holds "settings.ApiKey" and "SET-002" (R7)
And stdout's third line is "scope: added SET-002 to changed" (R7)
And `spec gate PROP-201` through tickets.Gate holds no "scope_gap" blocker for "SET-002"

### S20: A stage's duration is recorded
Given "BUG-301" is in its "tester" stage since "2026-10-27T12:00:00.000Z", and the clock reads "2026-10-27T12:20:30.000Z"
When the developer runs "spec ticket advance BUG-301" through pipeline.AdvanceTicket
Then the new pipeline.StageRecord has pipeline.StageRecord.duration_s 1230 (R8), and with the clock at "2026-10-27T11:59:00.000Z", before the start, it has duration_s 0 (R8)
And a blocked report, and a report refused by its checks, record pipeline.StageRecord.duration_s too (R8)
And the record's pipeline.StageRecord.model and pipeline.StageRecord.cost_usd are as PIP-025 says, read from the transcript given with "--transcript" (pipeline.AdvanceTicket.transcript) or kept by the finish hook, or from what "spec next" remembered for the stage (R8)

### S21: A blocked stage's changes are kept in a stash
Given "TASK-103" is in its "implementer" stage, "src/app.ts" is changed and "src/extra.ts" is new, both uncommitted, and its report is blocked with one pipeline.Blocker {text "Needs a meta field", cites ["conversation.Message.meta"]}
When it is recorded through pipeline.AdvanceTicket
Then stdout's lines are "TASK-103 implementer: Stuck", "status: blocked" and "stash: TASK-103 implementer: blocked", and the exit code is 0 (R9)
And the stage's commit holds only "tickets/TASK-103.md", and nothing is left uncommitted
And the git stash "TASK-103 implementer: blocked" holds "src/app.ts" and "src/extra.ts", and never the ticket file (R9)
And the new tickets.Question has the text "Needs a meta field. Its changes are kept in git stash ''TASK-103 implementer: blocked''; the next implementer stage gets them back."
And once the question is answered, the next `spec ticket start TASK-103 implementer` through pipeline.StartStage brings both files back and drops the stash
But a blocked stage that changed nothing stashes nothing: pipeline.Advanced.stash is left out and the question is the blocker's text alone

### S22: What the worktree's setup made never rides in a stage's commit
Given "PROP-205" is in its "spec-writer" stage in its worktree, whose setup left "vendor-modules", which git does not ignore, recorded in "spec/setup/PROP-205.txt" in the repository's git directory
When a done spec-writer report that changed nothing is recorded through pipeline.AdvanceTicket
Then the stage's commit holds only "tickets/PROP-205.md", and "vendor-modules" is still untracked (R6)

### S23: A reviewer's findings are kept in its record
Given "PROP-201" is in its "reviewer" stage and its report has verdict "changes" and findings [{ cites: ["PRV-001/S3"], text: "no scenario covers a second rate limit", spec: true, class: C1 }]
When it is recorded through pipeline.AdvanceTicket
Then stdout is "PROP-201 reviewer: <summary>" then "next: spec-writer", and the exit code is 0 (R10)
And tickets.Ticket.history ends with a pipeline.StageRecord with verdict "changes" and pipeline.StageRecord.findings [{ cites ["PRV-001/S3"], text "no scenario covers a second rate limit", spec true, class "C1" }] (R10)
But a stage of any other role, or a reviewer's approval with no findings, records no pipeline.StageRecord.findings

### S24: A spec-writer's documented scenarios are kept in its record
Given "PROP-201" is in its "spec-writer" stage, its branch added "PRV-001/S4" and "SET-001/S4", and its done report has pipeline.Report.documents ["SET-001/S4"]
When it is recorded through pipeline.AdvanceTicket
Then tickets.Ticket.history ends with a pipeline.StageRecord with role "spec-writer" and pipeline.StageRecord.documents ["SET-001/S4"] (R11)
And tickets.Ticket.changed holds "PRV-001/S4" and "SET-001/S4"
But a spec-writer report with no documents, or a blocked one, records no pipeline.StageRecord.documents (R11)

### S25: Advance reuses the test run check-report made on the same tree
Given "TASK-101" is in its "implementer" stage, and "spec check-report implementer TASK-101" ran the test command at "2026-10-31T09:00:00.000Z", every test passed, and it kept that run in "spec/test-runs/TASK-101.json" in the repository's common git directory
And since then nothing tracked has changed and no untracked file git does not ignore was added, changed or removed
When the developer runs "spec ticket advance TASK-101" through pipeline.AdvanceTicket
Then the test command does not run, and every check reads the kept run (R12)
And stderr's first line is "tests: reused the test run made at 2026-10-31T09:00:00.000Z on this tree", and stdout is what it would be had the tests run (R12)
And each command of format.Config.checkCommands still runs (R12)

### S26: Anything that differs runs the tests again
Given the kept run of S25
When "spec ticket advance TASK-101" runs through pipeline.AdvanceTicket after any one of these: a tracked file changed, staged or not, or was deleted; an untracked file git does not ignore was added, changed or removed; format.Config.testCommand changed; or the stage running is another role's
Then the test command runs over every test, and stderr holds no line starting "tests: reused" (R12)
And the same holds when the kept run was made for another spec root in the same repository with its own "TASK-101", and when the kept file cannot be read (R12)
And when the kept implementer run had a failed test or a non-zero exit, advance runs the tests again although nothing differs (R12)
And when a later check of the stage, by "spec check-report" or advance, gives no results, no run is kept, so the next advance runs the tests (R12)

### S27: A blocker marked external becomes an external question
Given "PROP-201" is in its "spec-writer" stage with no questions, the stage changed nothing, and its report is blocked with one pipeline.Blocker {text "Does Claude Code expand CLAUDE_PLUGIN_ROOT in skill text?", cites ["PROP-201"], external true}
When it is recorded through pipeline.AdvanceTicket
Then tickets.Ticket.questions is exactly [{id "Q1", kind "external", text "Does Claude Code expand CLAUDE_PLUGIN_ROOT in skill text?", default null, cites ["PROP-201"], answer null, raised_by "spec-writer"}] (R2)
And tickets.Ticket.status is "blocked", and `spec gate PROP-201` through tickets.Gate lists "- question PROP-201#Q1: Does Claude Code expand CLAUDE_PLUGIN_ROOT in skill text?" until the question has an answer (INV-006)
But a blocker with external false, or left out, becomes a question of kind "blocker", as in S6 (R2)

### S28: An implementer blocked only on tests hands its work to the tester
Given "PROP-201" is in its "implementer" stage after its done "tester" stage, "src/app.ts" is changed and "src/extra.ts" is new, both uncommitted
And its report is blocked with summary "Code done; one test is wrong" and one pipeline.Blocker {text "The test for PRV-001/S4 expects status 200; the scenario says 201", cites ["PRV-001/S4"], tests true}
When it is recorded through pipeline.AdvanceTicket
Then stdout is "PROP-201 implementer: Code done; one test is wrong" then "next: tester", and the exit code is 0 (R13)
And the stage's commit holds "src/app.ts", "src/extra.ts" and "tickets/PROP-201.md", nothing is left uncommitted, and "git stash list" holds no "PROP-201 implementer: blocked" (R6, R9, R13)
And tickets.Ticket.questions is unchanged, tickets.Ticket.status is "open", and tickets.Ticket.history ends with a pipeline.StageRecord with role "implementer", result "blocked" and pipeline.StageRecord.blockers holding that blocker whole (R2, R13)
And with `--format json`, stdout is the pipeline.Advanced {"ticket": "PROP-201", "next": "tester", "status": "open", "problems": []}, with no stash (R13)
But when the same report has a second blocker with no tests mark, it is recorded as in S21: both files are stashed, each blocker becomes a question of kind "blocker", and tickets.Ticket.status is "blocked" (R2, R9, R13)
And when the history already holds two implementer records with pipeline.StageRecord.blockers, the report is recorded as in S21 too (R13)

### S29: The tester after a hand-off records whether the tests pass
Given "PROP-201" is in its "tester" stage, and the last implementer or reviewer stage in its history is the implementer record of S28
And the tester's done report is accepted and every test passes
When it is recorded through pipeline.AdvanceTicket
Then the new pipeline.StageRecord has pipeline.StageRecord.passed true, and stdout's second line is "next: reviewer" (R14)
But with "PRV-001/S4 Created" failing, pipeline.StageRecord.passed is false and stdout's second line is "next: implementer" (R14)
And with every test passing but a command of format.Config.checkCommands exiting 1, or a "SPEC-STUB" line the branch added still in "src/app.ts", pipeline.StageRecord.passed is false and stdout's second line is "next: implementer" (R14)
And a done tester stage whose last implementer or reviewer stage is not a hand-off records no pipeline.StageRecord.passed (R14)

### S31: A hand-off whose code fails an implementer check is an ordinary block
Given the "PROP-201" of S28, whose stage also changed "tests/PRV-001.test.ts", a file under testGlobs, and whose one blocker is marked tests true
When it is recorded through pipeline.AdvanceTicket
Then stdout's lines are "PROP-201 implementer: Code done; one test is wrong", "status: blocked", "not handed to the tester: on a proposal the tests are the tester's and the implementer changes code only; revert tests/PRV-001.test.ts, or report a blocker that cites the scenario whose test is wrong" and "stash: PROP-201 implementer: blocked" (R13, INV-003)
And the git stash "PROP-201 implementer: blocked" holds "src/app.ts", "src/extra.ts" and "tests/PRV-001.test.ts", the blocker is a question of kind "blocker" whose text ends " Not handed to the tester: " followed by that problem, tickets.Ticket.status is "blocked", and the record holds no pipeline.StageRecord.blockers (R2, R9, R13)
And the same holds, with that command's problem, when a command of format.Config.checkCommands exits 1, and when a "SPEC-STUB" line the branch added is left in "src/app.ts" (R13)

### S30: The implementer's and tester's prompts say how to hand off a test fix
Given "spec/roles/implementer.md" and "spec/roles/tester.md" are this version's prompts
When `spec next` prepares an implementer task and a tester task for "PROP-201"
Then the implementer's prompt says that when its code is done and only a test is wrong, it reports blocked with each blocker marked tests: true and citing the scenario whose test is wrong, and that the hand-off is refused when its changes touch a test or spec file, fail a check command or leave a "SPEC-STUB", and its report block form's blockers line shows "tests: true" (R15)
And the tester's prompt says that after such a hand-off the implementer's code is committed on the branch and its blockers are listed in "## Implementer's test blockers", to fix only the tests they cite, and to run them against that code (R15)

## Rules
- R15: This version's implementer prompt asks for blockers marked tests: true when the code is done and only a test is wrong, each citing the scenario whose test is wrong, says the hand-off is refused when its changes break a done implementer check other than the tests (R13), and shows the mark in its report block form. This version's tester prompt says that after a hand-off the implementer's code is committed and its blockers are in the brief, and to fix only the tests they cite, running them against that code.
- R14: A done tester stage recorded while the last implementer or reviewer stage in the history (a reopened entry is not a stage) is a hand-off keeps pipeline.StageRecord.passed: true only when the tree, the implementer's committed code with the tester's tests, passes every check a done implementer stage gets (PIP-006/R5, R6, R7): the test run it was checked on exited 0 with no failed test, every command of format.Config.checkCommands exits 0, and no "SPEC-STUB" line the branch added is left; false otherwise; the next stage is the one PIP-001/R8 names. Every other record leaves passed out.
- R13: A blocked implementer report on a proposal or a bug whose every blocker has pipeline.Blocker.tests true is a hand-off, unless the history already holds two implementer records with pipeline.StageRecord.blockers, or the stage's changes fail a check a done implementer stage gets, failing tests aside: the path rules (PIP-005, INV-003), each command of format.Config.checkCommands (PIP-006/R7) and the SPEC-STUB check (PIP-006/R6); the test command does not run. A report refused this way is recorded as R2 and R9 say, its output adds the line "not handed to the tester: <problems joined by '; '>" after "status: blocked", and its last question ends " Not handed to the tester: <problems>". A hand-off stashes nothing and raises no question: the stage is committed with the tree's changes as a done stage is (R6), its generated files rebuilt, and its record keeps the blockers whole in pipeline.StageRecord.blockers. The ticket's status becomes "open", the output's second line is "next: tester", and pipeline.Advanced has next "tester", status "open" and no stash. Any other blocked report, one that mixes marked and unmarked blockers or a third hand-off included, is recorded as R2 and R9 say.
- R12: The kept run is "spec/test-runs/<ID>.json" in the repository's common git directory. Every check of a done tester or implementer report, by `check-report` or by advance (a `--report-file` intake included), first deletes it, then keeps the run it checked when that run gave results, whatever the stage's outcome. It keeps it with the time it ran and its context: the spec root's absolute path, the ticket, the role, the exact test command, and the tree. The tree is git's tree object for the working tree: every tracked change and every untracked file git does not ignore, staged into a temporary index, never the real one, and written with `git write-tree`, so its paths are relative to the repository root. Advance uses the kept run in place of running the test command only when its whole context matches advance's own. An implementer run with a failed test or a non-zero exit is kept but never reused. In every other case, a kept file it cannot read included, advance runs every test. Only the test run is reused: every check is made again on it, and checkCommands run again. A reused run adds the first stderr line "tests: reused the test run made at <time> on this tree"; stdout and pipeline.Advanced do not change.
- R11: A done spec-writer stage's documents are kept in its pipeline.StageRecord.documents, which is where the tester's check (PIP-006/R10) and brief (PIP-014) read them; a stage with none, or a blocked one, records none.
- R10: A reviewer stage's findings are kept whole, each with its class, in its pipeline.StageRecord.findings, so the stages that follow, and their briefs (PIP-012), see what the review found, and the next stage is the one PIP-001/R5 names.
- R8: Every recorded stage, blocked ones and a report refused by its checks included, carries duration_s: whole seconds elapsed from the stage's start to its recording, any wait for a test-run turn (PIP-009) included and not subtracted (PIP-025/S6), and 0 when the clock reads earlier than the start, never below 0. Its model and cost_usd are recorded as PIP-025 says.
- R9: Before a blocked stage is recorded, a hand-off aside (R13), whether its report says blocked or fails its checks, its uncommitted changes, new files included, outside the tickets folder and the paths its worktree's setup made, are stashed as "<ID> <role>: blocked", or as PIP-021/R11 says for a build stage, one that gives up its lane with a done report included; the project's own generated files are left out and put back as HEAD has them (WSP-009/R5). The output adds the line "stash: <name>", pipeline.Advanced.stash names it, and the last question the stage adds says where its changes are kept. When there is nothing to stash, nothing is stashed. The stash is made under the repository's stash lock (PIP-002/R4). When git refuses, or the lock stays held, nothing is recorded and the stage is still running
- R1: A stage's commit subject is "<ID> <role>: <summary>", the summary on one line with runs of whitespace as one space, cut to 120 characters with "…"; the history keeps the whole one-line summary. The message ends with a blank line and exactly one trailer line "Spec-Ticket: <ID>", for done and blocked stages alike, whether or not spec's git hooks are installed (INS-016/R12).
- R2: Each blocker of a blocked report, a hand-off's aside (R13), becomes a question on the ticket, raised by the role, with no default and no answer: of kind "external" when its pipeline.Blocker.external is true, else of kind "blocker"; the ticket's status becomes "blocked".
- R3: A done stage adds its report's changed units, and on a proposal's spec stage every unit its branch added, changed or reworded except features and modules, to the ticket's changed list.
- R4: A report that was read but fails its checks blocks the ticket with a question listing the problems, records a blocked stage, and commits nothing; its changes go to the stash R9 names.
- R5: The report is taken from a fenced block on stdin, else from the one the finish check stored for this ticket, else from stdin as bare report YAML; with none of these, nothing changes. The stored report is deleted once read.
- R6: Every recorded stage is one commit holding the tree's changes outside the tickets folder and the paths its worktree's setup made, plus this ticket's own file, even when that is nothing (ADR-002).
- R7: After a done spec-writer stage, every active feature that writes or emits a contract in the ticket's touches or changed, and is in neither, is added to changed, and the output names each on a line "scope: added <IDs> to changed" after the "next:" line; the gate then finds no scope gap for what the stage changed.

## Out of scope
- Which stage comes next (PIP-001)
- The main session's report transport and optional transcript path: CLI-007
- Answering the questions it raises: `spec ticket answer` (tickets)
