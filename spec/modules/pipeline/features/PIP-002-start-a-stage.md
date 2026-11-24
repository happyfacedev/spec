---
id: PIP-002
title: Start a stage on the ticket's branch
module: pipeline
status: active
writes: [tickets.Ticket.status, tickets.Ticket.stage]
provides: [pipeline.StartStage]
invariants: [INV-003]
decisions: [ADR-002]
questions:
  - id: Q1
    kind: preference
    text: "`spec ticket start` can be called by any session or harness; should it stay open to every caller?"
    default: Yes, any caller may start a stage, as the code does today
    cites: [PIP-002/S1]
    answer: 'Keep today''s behaviour (decided in review, 2026-10-29).'
    raised_by: null
  - id: Q2
    kind: preference
    text: After a third "changes" verdict, answering the stage-limit blocker passes the gate, but the history still holds three rounds, so every start is refused with "is blocked" and no command lets the ticket go on. How should a person resume such a ticket?
    default: As today, it stays refused until a person edits its history by hand
    cites: [PIP-002/S8, PIP-001/R3]
    answer: 'Change requested in review (2026-10-29): Answering the question grants one more review round. Filed as a proposal; until it lands, the spec states today''s behaviour.'
    raised_by: null
---
## Intent
A stage begins only when the ticket may start and the role is the one its pipeline runs next. Starting puts the working tree on the ticket's own branch, `ticket/<ID>`, brings that branch up to the base branch, gives the stage back any work it set aside when it last blocked, and marks the ticket as running that stage, so `check-report` and `ticket advance` know which stage they check. The tree holds nothing else uncommitted, so every change at the end of the stage is the stage's own. Every check runs before anything changes, so a refused start leaves the tree as it was; only a sync or a stash that needs a person also blocks the ticket on a question.

## Behaviour
### S1: Start the first stage of a new ticket
Given a git repository on "main" with no uncommitted changes, and a proposal "PROP-201" that the gate passes, with tickets.Ticket.status "open" and tickets.Ticket.stage null
When the developer runs `spec ticket start PROP-201 spec-writer --format json` through pipeline.StartStage
Then stdout is the pipeline.StageStarted {"ticket": "PROP-201", "branch": "ticket/PROP-201", "created": true, "stage": "spec-writer", "status": "in_progress"} and the exit code is 0
And the current branch is "ticket/PROP-201", created from "main"
And in the ticket file only tickets.Ticket.status changed, to "in_progress", and tickets.Ticket.stage, to "spec-writer"; the body is unchanged

### S2: Text output
Given the same repository and ticket as S1
When the developer runs `spec ticket start PROP-201 spec-writer` through pipeline.StartStage
Then stdout is "PROP-201: stage spec-writer on ticket/PROP-201 (created from main)"

### S3: Starting the running stage again changes nothing
Given "PROP-201" already has its "spec-writer" stage running on "ticket/PROP-201", which is checked out
When the developer runs `spec ticket start PROP-201 spec-writer --format json` through pipeline.StartStage
Then the exit code is 0 and pipeline.StageStarted.created is false (R1)

### S4: An existing branch is checked out, not created
Given the branch "ticket/BUG-301" exists from an earlier stage and the tree is on "main"
When the developer runs `spec ticket start BUG-301 implementer` through pipeline.StartStage
Then the current branch is "ticket/BUG-301" and stdout is "BUG-301: stage implementer on ticket/BUG-301"

### S5: The gate refuses the ticket
Given a ticket "PROP-206" with an unanswered blocker question, so the gate refuses it
When the developer runs `spec ticket start PROP-206 spec-writer` through pipeline.StartStage
Then it fails with pipeline.StageRefused and stderr "PROP-206 is not ready; spec gate PROP-206 lists the blockers. Nothing starts while a blocker is open." (R1)

### S6: A done ticket
Given a ticket "TASK-103" with tickets.Ticket.status "done"
When the developer runs `spec ticket start TASK-103 reviewer` through pipeline.StartStage
Then it fails with pipeline.StageRefused and stderr "TASK-103 is done"

### S7: A role out of order
Given a proposal "PROP-202" with an empty history
When the developer runs `spec ticket start PROP-202 implementer` through pipeline.StartStage
Then it fails with pipeline.StageRefused and stderr "the next stage of PROP-202 is spec-writer, not implementer" (R1)

### S8: Answering the review-round question grants one more round
Given a task whose reviewer has asked for changes 3 times, and whose one tickets.Question has `raised_by` "overseer" and text "the reviewer asked for changes 3 times; a person must decide. How should TASK-101 proceed?", has been answered, so the gate passes
When the developer runs `spec ticket start TASK-101 implementer --format json` through pipeline.StartStage
Then stdout is the pipeline.StageStarted {"ticket": "TASK-101", "branch": "ticket/TASK-101", "created": false, "stage": "implementer", "status": "in_progress"} and the exit code is 0 (R8)

### S29: Each further round needs its own answer
Given a task whose reviewer has asked for changes 4 times, and whose only answered blocker question with `raised_by` "overseer" about the review rounds is one, so the gate passes
When the developer runs `spec ticket start TASK-101 implementer` through pipeline.StartStage
Then it fails with pipeline.StageRefused and stderr "TASK-101 is blocked: the reviewer asked for changes 4 times; a person must decide" (R8)
And tickets.Ticket.status and tickets.Ticket.stage are as they were

### S9: An unknown role
Given any ticket "TASK-101"
When the developer runs `spec ticket start TASK-101 boss` through pipeline.StartStage
Then it fails with pipeline.UnknownRole: stderr "Unknown role boss. Roles: spec-writer, spec-review, tester, implementer, reviewer" and the exit code is 2

### S10: An unknown ticket
Given the tickets hold "TASK-101" and no "TASK-109"
When the developer runs `spec ticket start TASK-109 implementer` through pipeline.StartStage
Then it fails with tickets.UnknownTicket: stderr starts "Unknown TASK-109." followed by the closest ticket ID as "Did you mean <ID>?", and the exit code is 2

### S11: Wrong number of arguments
Given any spec
When the developer runs `spec ticket start TASK-101` through pipeline.StartStage
Then it fails with cli.UsageError: stderr starts "usage: spec ticket new < ticket.json | spec ticket start <TICKET> <role> | spec ticket advance <TICKET> | spec ticket answer <TICKET> <Q> <answer>" and the exit code is 2

### S12: Not a git repository
Given the project root is not a git repository
When the developer runs `spec ticket start TASK-101 implementer` through pipeline.StartStage
Then it fails with pipeline.StageRefused and stderr "<project root> is not a git repository"

### S13: The branch is checked out in another worktree
Given "ticket/TASK-101" is checked out in the workspace.Worktree.path "/work/chat.worktrees/TASK-101", not in this tree
When the developer runs `spec ticket start TASK-101 implementer` in the main tree through pipeline.StartStage
Then it fails with pipeline.StageRefused and stderr "ticket/TASK-101 is checked out in /work/chat.worktrees/TASK-101; run the stages of TASK-101 there" (R2)

### S14: Another ticket's stage is running in this tree
Given this tree is on "ticket/PROP-201", whose "spec-writer" stage is running
When the developer runs `spec ticket start TASK-101 implementer` through pipeline.StartStage
Then it fails with pipeline.StageRefused and stderr "PROP-201 has its spec-writer stage running in this tree; wait for it to finish and run spec ticket advance PROP-201 first, or give TASK-101 its own worktree (spec worktree add TASK-101)" (R2)

### S15: A conflicting ticket is running elsewhere
Given "PROP-201" is in progress in its own worktree and changes a contract that "PROP-202" works on
When the developer runs `spec ticket start PROP-202 spec-writer` through pipeline.StartStage
Then it fails with pipeline.StageRefused and stderr starts "PROP-202 must wait for PROP-201, which is running: " and ends "Start PROP-202 once PROP-201 is done and merged." (R2)

### S16: Uncommitted work outside the tickets folder
Given the tree is on another branch and "src/scratch.ts" is uncommitted
When the developer runs `spec ticket start TASK-101 implementer` through pipeline.StartStage
Then it fails with pipeline.StageRefused and stderr "cannot switch to ticket/TASK-101: uncommitted changes in src/scratch.ts"
And the current branch is unchanged (R3)

### S17: An uncommitted ticket file does not stop the switch
Given the tree is on "main" and only "tickets/TASK-102.md" is uncommitted, because a person answered one of its questions
When the developer runs `spec ticket start TASK-101 implementer` through pipeline.StartStage
Then the exit code is 0 and the current branch is "ticket/TASK-101" (R3)

### S18: A stage that blocked gets its work back
Given "TASK-101" has its "implementer" stage blocked and answered, and "git stash list" holds "TASK-101 implementer: blocked", which holds the change to "src/app.ts" and a new file "src/extra.ts"
When the developer runs `spec ticket start TASK-101 implementer` through pipeline.StartStage
Then the exit code is 0, the current branch is "ticket/TASK-101", and "src/app.ts" and the new "src/extra.ts" are uncommitted in the tree as they were stashed (R4)
And "git stash list" no longer holds "TASK-101 implementer: blocked"
And when format.Config.generated has a format.GeneratedConfig.command, it ran once after the stash was applied, and what it wrote is uncommitted with them (R4)

### S19: Only the same stage on the same ticket restores
Given "git stash list" holds "TASK-101 implementer: blocked" and "TASK-102 implementer: blocked"
When the developer runs `spec ticket start TASK-101 tester` through pipeline.StartStage, after an answer sent the ticket back to "tester"
Then the tree has no restored changes and both stashes remain (R4)
And a later `spec ticket start TASK-101 implementer` restores only "TASK-101 implementer: blocked" (R4)
And on "PROP-215", which has left the build lane with "PROP-215 build: blocked" in "git stash list", the start of its "implementer" stage restores nothing from it, while on a ticket still in that lane the build stage's start restores its own (R4, PIP-021/R11)

### S20: Nothing was stashed
Given "TASK-101" has its "implementer" stage ready to start and "git stash list" holds no entry named "TASK-101 implementer: blocked"
When the developer runs `spec ticket start TASK-101 implementer` through pipeline.StartStage
Then the exit code is 0 and the tree holds no uncommitted change other than the ticket file (R4)

### S21: Uncommitted work on the ticket's own branch
Given this tree already has "ticket/TASK-101" checked out, so no switch happens, and "src/scratch.ts" is uncommitted
When the developer runs `spec ticket start TASK-101 implementer` through pipeline.StartStage
Then it fails with pipeline.StageRefused and stderr "cannot start the implementer stage of TASK-101: uncommitted changes in src/scratch.ts; commit or remove them first" (R3, INV-003)
And the ticket file and "src/scratch.ts" are as they were

### S22: A stash that does not apply blocks the ticket
Given "git stash list" holds "TASK-101 implementer: blocked", which changes a line of "src/app.ts" that "ticket/TASK-101" has since changed too, and holds the new file "src/extra.ts"
When the developer runs `spec ticket start TASK-101 implementer` through pipeline.StartStage
Then it fails with pipeline.StageRefused, and stderr starts "git stash ''TASK-101 implementer: blocked'' does not apply to ticket/TASK-101: it conflicts in src/app.ts. It also holds new files that only git stash show --include-untracked lists: src/extra.ts." (R5)
And "git stash list" still holds "TASK-101 implementer: blocked", with "src/app.ts" and "src/extra.ts" both in it (R5)
And "src/app.ts" is as the branch has it, "src/extra.ts" is not in the tree, and nothing outside the tickets folder is uncommitted
And tickets.Ticket.status is "blocked", tickets.Ticket.stage is null, the history is unchanged, and the new tickets.Question is a blocker raised by "implementer" whose text starts as stderr does (R5)
But a stash with no new files gives the question and stderr no "It also holds" sentence (R5)

### S23: A branch behind the base is synced before the stage starts
Given "ticket/TASK-101" does not hold the tip of "main", and the two changed different files
When the developer runs `spec ticket start TASK-101 implementer` through pipeline.StartStage
Then the exit code is 0 and the newest commit of "ticket/TASK-101" is "TASK-101: sync with main", which holds the tip of "main" (R6)
And that commit's message ends in the one trailer line "Spec-Ticket: TASK-101", whether or not spec's git hooks are installed (R6)
And only the ticket file is uncommitted
But a second start, on a branch that holds the tip of "main", adds no commit

### S24: Generated files that conflict in the sync are rebuilt
Given "ticket/TASK-101" and "main" both changed "spec/index.md", and nothing else conflicts
When the developer runs `spec ticket start TASK-101 implementer` through pipeline.StartStage
Then the exit code is 0, the sync is committed as "TASK-101: sync with main", and "spec/index.md" is what "spec build" writes from the merged spec (R6)
And when "src/generated/assets.ts", which format.Config.generated names, conflicts too, the sync rebuilds it as WSP-009 says, and the exit code is 0 (R6)
And when format.Config.generated names it with no format.GeneratedConfig.command, or an old `generatedGlobs` names it, the sync commit holds the "src/generated/assets.ts" of "main", nothing is rebuilt, and the exit code is 0 (R6)

### S25: Any other conflict in the sync blocks the ticket
Given "ticket/TASK-101" and "main" both changed one line of "src/conversation/export.ts"
When the developer runs `spec ticket start TASK-101 implementer` through pipeline.StartStage
Then it fails with pipeline.StageRefused and stderr "syncing ticket/TASK-101 with main conflicts in src/conversation/export.ts; a person must merge. TASK-101 is blocked; ticket/TASK-101 is as it was." (R6)
And "ticket/TASK-101" is at the commit it had, no merge is in progress, and only the ticket file is uncommitted
And tickets.Ticket.status is "blocked" and the new tickets.Question is a blocker raised by "implementer" with the text "syncing ticket/TASK-101 with main conflicts in src/conversation/export.ts; a person must merge"

### S26: Two starts of one ticket at once
Given "TASK-101" is open, and two runs of `spec ticket start TASK-101 implementer` have both read it before either changed anything
When both go on through pipeline.StartStage
Then exactly one exits 0, and the other fails with pipeline.StageRefused and stderr "TASK-101 already has its implementer stage running; it started after this command read the ticket" (R7)
And tickets.Ticket.status is "in_progress" with tickets.Ticket.stage "implementer", set once
But a lock left by a process that has ended is taken over, and the start goes on
And when many processes find that lock at once, they take it over one at a time: no two ever hold it together (R7, ADR-002)

### S27: The stage's own stash is dropped, though another entry was pushed meanwhile
Given "git stash list" holds "TASK-101 implementer: blocked" at "stash@{0}"
When `spec ticket start TASK-101 implementer` applies it through pipeline.StartStage, and another entry is pushed on top before the drop, so the stage's entry is now "stash@{1}"
Then the stage's entry is the one dropped, and "git stash list" still holds the other one (R4)

### S28: Another ticket's edit never rides in the sync
Given this tree has "ticket/TASK-101" checked out, the branch lacks the tip of "main", and "tickets/TASK-102.md" holds an uncommitted edit a person made
When the developer runs `spec ticket start TASK-101 implementer` through pipeline.StartStage
Then the branch is synced, the commit "TASK-101: sync with main" holds only what "main" brought, and the edit is still uncommitted in "tickets/TASK-102.md" (R6)
But when that edit is staged, it fails with pipeline.StageRefused and stderr "cannot sync ticket/TASK-101 with main: staged changes in tickets/TASK-102.md; commit or unstage them first", the branch is at the commit it had, and the edit stays staged (R6)

### S30: Answering the spec-review round question grants one more spec round
Given a proposal "PROP-201" whose spec review has asked for changes 3 times, and whose blocker question with `raised_by` "overseer" and text "the spec-review asked for changes 3 times; a person must decide. How should PROP-201 proceed?" has been answered, so the gate passes
When the developer runs `spec ticket start PROP-201 spec-writer` through pipeline.StartStage
Then the exit code is 0 and pipeline.StageStarted.stage is "spec-writer" (R8)
But with a fourth spec-review "changes" and still one such answered question, `spec ticket start PROP-201 spec-writer` fails with pipeline.StageRefused and stderr "PROP-201 is blocked: the spec-review asked for changes 4 times; a person must decide" (R8)
And an answered question about the reviewer's rounds grants no spec-review round, nor the other way round (R8)

### S31: A spec review in progress holds the tester back
Given "PROP-201" has its "spec-review" stage running on "ticket/PROP-201", after a done "spec-writer" stage
When the developer runs `spec ticket start PROP-201 tester` through pipeline.StartStage
Then it fails with pipeline.StageRefused and stderr "the next stage of PROP-201 is spec-review, not tester" (R1)
And tickets.Ticket.stage is still "spec-review"

### S32: A running ticket is never held back by a ticket that started after it
Given "TASK-101", which works on "PRV-001", started its first stage and has a recorded "implementer" stage and no stage running
And "PROP-201", whose touches reach "PRV-001", started its first stage after that, while no stage of "TASK-101" was running, and is running its "spec-writer" stage
When the developer runs `spec ticket start TASK-101 reviewer` through pipeline.StartStage
Then the exit code is 0 and pipeline.StageStarted.stage is "reviewer" (R2)
But once the spec-writer stage of "PROP-201" is recorded, while "TASK-101" is running its "reviewer" stage, `spec ticket start PROP-201 spec-review` fails with pipeline.StageRefused and stderr starts "PROP-201 must wait for TASK-101, which is running: " (R2)

### S33: Before its spec stage, a ticket's footprint is what it touches
Given "TASK-102", which works on "CNV-002" and "conversation.Message.meta", is running its "implementer" stage
And the proposal "PROP-205", with no recorded stage, touches only "CNV-001", which reads "conversation.Message.content", which "CNV-002" reads or writes too
When the developer runs `spec ticket start PROP-205 spec-writer` through pipeline.StartStage
Then the exit code is 0 and pipeline.StageStarted.stage is "spec-writer" (R2, TKT-011/R9)
And `spec next PROP-205`, run instead, does not refuse it with "PROP-205 must wait for TASK-102" (R2)
But when "PROP-202", which touches "SET-001", is running, a proposal with no recorded stage that touches "SET-001" too is refused with stderr starting "<ID> must wait for PROP-202, which is running: both add to SET-001, so their new scenario and rule numbers would collide" (R2, TKT-011/R3)

## Rules
- R1: The gate runs again at every start, and the role must be the next stage of the ticket's pipeline; a start of the stage already running succeeds and changes nothing.
- R2: One working tree runs one ticket at a time; a ticket's stages run in the tree that has its branch checked out. A stage is refused, in any tree, while a ticket it conflicts with (TKT-011, by the footprints of TKT-011/R9) is running and started its first stage before this ticket did; a ticket starting its first stage started after every running ticket. So two tickets that conflict never start together, and a running ticket is never refused a later stage because of a ticket that started after it.
- R3: A stage starts only on a tree with no uncommitted change outside the tickets folder and the paths its worktree's setup made, whether or not the start switches branches; ticket files may be uncommitted, as a person answering a question leaves them. So every change at the end of the stage is the stage's own.
- R4: `spec ticket advance` stashes a blocked stage's uncommitted changes, new files included, as "<ID> <role>: blocked" (PIP-008). When that role's stage on that ticket begins, after the checks, the switch and the sync, the stash with that name is applied to the tree, its new files included, and dropped, and the project's own generated files are rebuilt as WSP-009/R6 says; no other stash is touched. A build stage's stash has its own name, and only a build stage restores it (PIP-021/R11). Every change spec makes to the stash list (stashing a blocked stage, restoring it, the stash of `--restart`) runs under one repository-wide lock, and an entry is dropped only once its position is checked to still hold it, so an entry pushed meanwhile by anything else is never dropped in its place.
- R5: A stash that does not apply is kept whole, its new files included: every path it touched is put back as the branch has it, the ticket is blocked with a blocker question raised by the role that names the stash and the files that conflict, and the start is refused. When the stash holds new files, which `git stash show` does not list, the question also names each of them, so a person who applies it by hand loses none.
- R6: When the ticket's branch does not hold the tip of the base branch, the start merges the base into it as "<ID>: sync with <base>", with exactly one trailer line "Spec-Ticket: <ID>" (INS-016/R12), before the stage begins, so the stage runs with the base's role prompts, config and pinned CLI. Conflicts only in generated files (the spec's `index.md` and `_generated/`, the project-pinned `.spec/bin/` CLI, the legacy skill bundle, and the project's own that format.Config.generated names, an old `generatedGlobs` among them) take the base's side and are rebuilt from the merged source, the project's own as WSP-009 says; any other conflict aborts the merge, blocks the ticket with the blocker question "syncing ticket/<ID> with <base> conflicts in <files>; a person must merge", and refuses the start. The sync commit holds only the merge: an unstaged edit stays uncommitted, and a staged change refuses the sync, naming the files, with nothing changed.
- R7: One start of a ticket runs at a time, in any tree, under a lock in the repository's git directory; a lock whose process has ended is taken over, atomically: of the processes that find it, only the one holding the lock's takeover guard removes it, so no two ever hold the lock at once (ADR-002). A start that waited reads the ticket again, and is refused when the ticket's stage started after it first read it.
- R8: A start is refused as blocked when the reviewer's "changes" count in the history exceeds 2 plus the number of answered blocker questions whose `raised_by` value is "overseer" and that ask about the review rounds ("the reviewer asked for changes <n> times; a person must decide…"). So answering that question grants exactly one more review round (the implementer, then the reviewer), and a further "changes" blocks the ticket on a new question that needs its own answer. The spec review's rounds are held the same way, apart: its "changes" count against the answered "overseer" blocker questions that start "the spec-review asked for changes ", and one answer grants one more spec round (the spec-writer, then the spec review).

## Out of scope
- What the gate checks, and when two tickets conflict (tickets)
- Creating a ticket's worktree (workspace)
- The ticket file's write, and committing it: the ticket store (tickets); with the files store the change stays uncommitted until `ticket advance`
