---
id: WSP-004
title: Every tree sees every ticket's live state
module: workspace
status: active
writes: [tickets.Ticket.questions]
---
## Intent
A ticket runs on its own branch, often in its own worktree, so the copy of its file in any other tree goes stale. Every command reads, and writes, each ticket where its newest copy is, so `spec queue`, `spec plan`, `spec gate` and `spec ticket answer` are right from any tree.

## Behaviour
### S1: A stage running in another worktree, not yet committed
Given ticket "BUG-301" has its worktree at "/work/app.worktrees/BUG-301"
And "spec ticket start BUG-301 tester" ran there, so its file there says status in_progress and stage tester, uncommitted
When "spec queue" runs in the main tree "/work/app"
Then it lists "BUG-301" under "## In progress (1)" as "- BUG-301 bug · stage tester" (R1)
And tickets.Ticket.status read for "BUG-301" in "/work/app" is in_progress
But "/work/app/tickets/BUG-301.md" still says status open

### S2: A branch no tree has checked out
Given ticket "BUG-301" recorded its tester stage on "ticket/BUG-301", and its worktree was then removed
And "ticket/BUG-301" is not merged into the main tree's HEAD
When "spec queue" runs in "/work/app"
Then it lists "BUG-301" as "- BUG-301 bug · next implementer", read from the tip of "ticket/BUG-301" (R1)
And tickets.Ticket.history read for "BUG-301" has one entry, role tester

### S3: A branch already merged here
Given "ticket/TASK-101" is merged into the main tree's HEAD and no worktree has it checked out
When "spec queue" runs in "/work/app"
Then tickets.Ticket.status read for "TASK-101" is the one in "/work/app/tickets/TASK-101.md" (R1)

### S4: The tree that has the branch checked out reads its own file
Given the main tree "/work/app" has "ticket/PROP-205" checked out
When "spec queue" runs in "/work/app"
Then "PROP-205" is read from "/work/app/tickets/PROP-205.md"

### S5: An update to a ticket running in another worktree
Given ticket "PROP-206" has its worktree at "/work/app.worktrees/PROP-206" and an open question "Q1"
When "spec ticket answer PROP-206 Q1 yes" runs in "/work/app"
Then tickets.Ticket.questions in "/work/app.worktrees/PROP-206/tickets/PROP-206.md" holds answer "yes" for "Q1", uncommitted (R2)
And "/work/app/tickets/PROP-206.md" is unchanged

### S6: An update to a ticket whose branch no tree has checked out
Given "ticket/PROP-206" exists, is not merged into the main tree's HEAD, and no worktree has it checked out
And "/work/app" has a clean working tree
When "spec ticket answer PROP-206 Q1 yes" runs in "/work/app"
Then "ticket/PROP-206" has a new commit "PROP-206: answer Q1" whose tickets.Ticket.questions holds answer "yes" for "Q1" (R2)
And that commit's message ends in the one trailer line "Spec-Ticket: PROP-206" (R2)
And "git status --porcelain" in "/work/app" prints nothing, and the main tree's HEAD and index are unchanged

### S7: The branch moved while it was being updated
Given "ticket/PROP-206" is not checked out anywhere
When another process moves "ticket/PROP-206" between the read of its tip and the commit of "spec ticket answer PROP-206 Q1 yes"
Then the command fails with workspace.BranchMoved
And stderr is "ticket/PROP-206 moved while it was being updated; try again", the exit code is 1, and the answer is on no branch

### S8: A ticket closed on the base branch, with its worktree kept
Given "PROP-073" has its worktree at "/work/app.worktrees/PROP-073", whose uncommitted file says status blocked, and "spec ticket close PROP-073 --superseded-by PROP-063" has committed it absorbed on "main"
When "spec queue" runs in "/work/app", in "/work/app.worktrees/PROP-073", or in "/work/app.worktrees/PROP-090", whose branch was made from "main" before that commit
Then tickets.Ticket.status read for "PROP-073" is "absorbed" in each, and "PROP-073" is in no group (R1)
And the worktree's file still says status blocked

### S9: A ticket done and merged on the base branch, with a leftover worktree
Given "ticket/PROP-051" is checked out in "/work/app.worktrees/PROP-051", whose uncommitted file says status in_progress and stage implementer
And "ticket/PROP-051" is merged into "main", and "tickets/PROP-051.md" at the tip of "main" says status done
When "spec queue" runs in "/work/app", in "/work/app.worktrees/PROP-051", or in "/work/app.worktrees/PROP-090", whose branch was made from "main" before "PROP-051" was done there
Then tickets.Ticket.status read for "PROP-051" is "done" in each, read from "main" (R1)
And "PROP-051" is in no group, and is counted in the "Done:" line
And the worktree's file still says status in_progress and stage implementer

### S10: An update to a ticket done and merged on the base branch
Given "PROP-051" is done and merged on "main" with its leftover worktree, as in S9, and has an open question "Q1"
And the main tree "/work/app" has "main" checked out
When "spec ticket answer PROP-051 Q1 yes" runs in "/work/app.worktrees/PROP-090"
Then tickets.Ticket.questions in "/work/app/tickets/PROP-051.md" holds answer "yes" for "Q1", uncommitted (R2)
And "/work/app.worktrees/PROP-051/tickets/PROP-051.md" and "/work/app.worktrees/PROP-090/tickets/PROP-051.md" are unchanged

### S11: An update to a ticket read from the base branch, which no tree has checked out
Given "PROP-051" is done and merged on "main" with its leftover worktree, as in S9, and has an open question "Q1"
And no tree has "main" checked out
When "spec ticket answer PROP-051 Q1 yes" runs in "/work/app.worktrees/PROP-090"
Then "main" has a new commit "PROP-051: answer Q1" whose tickets.Ticket.questions holds answer "yes" for "Q1" (R2)
And that commit's message ends in the one trailer line "Spec-Ticket: PROP-051" (R2)
And no working tree, index or HEAD changes, and "/work/app.worktrees/PROP-051/tickets/PROP-051.md" is unchanged

### S12: The base branch moved while a ticket read from it was being updated
Given "PROP-051" is done and merged on "main", and no tree has "main" checked out
When another process moves "main" between the read of its tip and the commit of "spec ticket answer PROP-051 Q1 yes"
Then the command fails with workspace.BranchMoved
And stderr is "main moved while it was being updated; try again", the exit code is 1, and the answer is on no branch

### S13: A ticket done on its branch but not merged yet
Given "ticket/BUG-301" is checked out in "/work/app.worktrees/BUG-301", where a commit set its file to status done
And "ticket/BUG-301" is not merged into "main", whose "tickets/BUG-301.md" says status open
When "spec queue" runs in "/work/app"
Then tickets.Ticket.status read for "BUG-301" is "done", read from "/work/app.worktrees/BUG-301" (R1)
And "BUG-301" is in no group, and is counted in the "Done:" line

### S14: A base branch that does not exist reads nothing from it
Given format.Config.baseBranch is "trunk" and the repository has no branch "trunk"
And "ticket/PROP-051" is checked out in "/work/app.worktrees/PROP-051", whose uncommitted file says status in_progress and stage implementer, and "/work/app/tickets/PROP-051.md" says status done
When "spec queue" runs in "/work/app"
Then it lists "PROP-051" under "## In progress (1)" with "stage implementer", read from "/work/app.worktrees/PROP-051" (R1)

### S15: A second update to a ticket read from the base branch keeps the first
Given "PROP-051" is done and merged on "main" with its leftover worktree, as in S9, and has open questions "Q1" and "Q2"
And the main tree "/work/app" has "main" checked out, and "spec ticket answer PROP-051 Q1 yes" has written its answer there, uncommitted, as in S10
When "spec ticket answer PROP-051 Q2 no" runs in "/work/app.worktrees/PROP-090"
Then tickets.Ticket.questions in "/work/app/tickets/PROP-051.md" holds answer "yes" for "Q1" and answer "no" for "Q2", uncommitted (R2)
And tickets.Ticket.questions read for "PROP-051" in "/work/app" and in "/work/app.worktrees/PROP-090" holds both answers (R1)

### S16: A ticket done on the base branch whose branch has new work
Given "tickets/PROP-051.md" at the tip of "main" says status done
And "ticket/PROP-051" has commits "main" lacks, so it is not merged into "main", and is checked out in "/work/app.worktrees/PROP-051", whose uncommitted file says status in_progress and stage implementer, and has an open question "Q1"
When "spec queue" runs in "/work/app", and then "spec ticket answer PROP-051 Q1 yes" runs there
Then the queue lists "PROP-051" under "## In progress (1)" with "stage implementer", read from "/work/app.worktrees/PROP-051" (R1)
And tickets.Ticket.questions in "/work/app.worktrees/PROP-051/tickets/PROP-051.md" holds answer "yes" for "Q1", uncommitted (R2)
And "/work/app/tickets/PROP-051.md" is unchanged

### S17: A ticket done on the base branch with no branch of its own
Given "tickets/TASK-102.md" at the tip of "main" says status done, and the repository has no branch "ticket/TASK-102"
And "/work/app.worktrees/PROP-090", whose branch was made from "main" before "TASK-102" was done there, has "tickets/TASK-102.md" saying status open
When "spec queue" runs in "/work/app.worktrees/PROP-090"
Then it lists "TASK-102" under "## Ready", read from "/work/app.worktrees/PROP-090/tickets/TASK-102.md" (R1)

### S18: The leftover worktree of a ticket done and merged on the base branch is listed as merged
Given "PROP-051" is done and merged on "main" with its leftover worktree, as in S9
When "spec worktree list" runs in "/work/app" through workspace.ListWorktrees
Then stdout includes "PROP-051 done /work/app.worktrees/PROP-051 (merged into main; spec worktree remove PROP-051 removes it)" (R1, WSP-003/R1)
And "/work/app.worktrees/PROP-051" still exists, and its file still says status in_progress

## Rules
- R1: A ticket is read from format.Config.baseBranch, wherever else a copy is, when its file at that branch's tip says absorbed (TKT-012/R10), or when its file there says done and its branch "ticket/<ID>" exists and is merged into that branch; it is read there from the file of the tree that has that branch checked out, committed or not, else from the tip. Any other ticket is read from the worktree that has its branch checked out (its file there, committed or not); else, when its branch is not merged into this tree's HEAD, from the branch tip; else from this tree's file. A base branch that does not exist holds no ticket
- R2: A ticket is written where it is read from: the other worktree's file, uncommitted, or a new commit on its branch that touches no working tree and no index and whose message ends in exactly one trailer line "Spec-Ticket: <ID>" (INS-016/R12). A ticket read from the tip of format.Config.baseBranch is written in the file of the tree that has that branch checked out, uncommitted, or, when no tree has it checked out, as such a commit on that branch

## Out of scope
- Tickets in a tracker: the tracker holds their one live copy
- Where "spec ticket start" may run a ticket's stage
