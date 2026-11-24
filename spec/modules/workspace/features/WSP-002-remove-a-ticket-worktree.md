---
id: WSP-002
title: Remove a ticket's worktree
module: workspace
status: active
writes: [workspace.Worktree]
provides: [workspace.RemoveWorktree]
observes: [format.Config, workspace.SetupFailed]
---
## Intent
Take away a ticket's checkout once it is no longer needed, without ever losing work: the branch stays, and git refuses to remove a tree with uncommitted changes. Running it again over what is left, such as what a merge that ended early left of a merged ticket, ends in the same state.

## Behaviour
### S1: Remove a worktree and keep its branch
Given ticket "BUG-301" has its worktree at "/work/app.worktrees/BUG-301" with nothing uncommitted
When "spec worktree remove BUG-301" runs in "/work/app" through workspace.RemoveWorktree
Then "/work/app.worktrees/BUG-301" no longer exists
And workspace.Worktree.branch "ticket/BUG-301" still exists with every commit it had (R1)
And stdout is "BUG-301: removed /work/app.worktrees/BUG-301; ticket/BUG-301 is kept" and the exit code is 0

### S2: A ticket with no worktree
Given no worktree has "ticket/TASK-101" checked out
When "spec worktree remove TASK-101" runs through workspace.RemoveWorktree
Then the command fails with workspace.NoWorktree
And stderr is "TASK-101 has no worktree" and the exit code is 1

### S3: Removing the tree the command runs in
Given the tree the command runs in has "ticket/TASK-101" checked out
When "spec worktree remove TASK-101" runs there through workspace.RemoveWorktree
Then the command fails with workspace.OwnWorktree
And stderr is "TASK-101's worktree is this one; run remove from another tree" and the exit code is 1

### S4: Uncommitted changes keep the worktree
Given ticket "BUG-301" has its worktree at "/work/app.worktrees/BUG-301" with an uncommitted change to "src/export.ts"
When "spec worktree remove BUG-301" runs through workspace.RemoveWorktree
Then the command fails with workspace.GitRefused
And stderr starts with "git could not remove /work/app.worktrees/BUG-301: " followed by git's message, and the exit code is 1
And the change to "src/export.ts" is still in "/work/app.worktrees/BUG-301" (R1)

### S5: No ticket, or not a ticket ID
When "spec worktree remove" runs, or "spec worktree remove cart" runs, through workspace.RemoveWorktree
Then the command fails with cli.UsageError
And stderr starts with "usage: spec worktree add <TICKET> | remove <TICKET> | list" and the exit code is 2

### S6: Tickets in a folder outside the repository
Given tickets.StoreConfig is a tickets.FilesStore with tickets.FilesStore.dir "../tickets", a folder outside the repository
And ticket "BUG-301" has its worktree at "/work/app.worktrees/BUG-301" with nothing uncommitted
When "spec worktree remove BUG-301" runs in "/work/app" through workspace.RemoveWorktree
Then "/work/app.worktrees/BUG-301" no longer exists
And stdout is "BUG-301: removed /work/app.worktrees/BUG-301; ticket/BUG-301 is kept" and the exit code is 0

### S7: Tickets in a tracker
Given tickets.StoreConfig is a tickets.CommandStore
And ticket "TASK-103" has its worktree at "/work/app.worktrees/TASK-103" with nothing uncommitted
When "spec worktree remove TASK-103" runs in "/work/app" through workspace.RemoveWorktree
Then "/work/app.worktrees/TASK-103" no longer exists
And stdout is "TASK-103: removed /work/app.worktrees/TASK-103; ticket/TASK-103 is kept" and the exit code is 0

### S8: A remove waits for an add in progress
Given "spec worktree add BUG-301" is running in "/work/app" on the worktree "/work/app.worktrees/BUG-301" whose earlier setup failed, and holds "/work/app/.git/spec/worktree-BUG-301.lock" while its format.Config.worktreeSetup runs again and fails again
When "spec worktree remove BUG-301" runs in "/work/app" through workspace.RemoveWorktree while that add is running
Then the remove waits, and removes nothing until the add has ended with workspace.SetupFailed and released the lock (R2)
And "/work/app.worktrees/BUG-301" no longer exists and "/work/app/.git/spec/setup/BUG-301.failed" does not exist once the remove ends
And stdout is "BUG-301: removed /work/app.worktrees/BUG-301; ticket/BUG-301 is kept" and the exit code is 0
And "/work/app/.git/spec/worktree-BUG-301.lock" does not exist once the remove ends (R2)

### S9: An add that holds the lock too long
Given "spec worktree add BUG-301" holds "/work/app/.git/spec/worktree-BUG-301.lock" and its process, pid "4242", keeps running for more than 15 minutes
And ticket "BUG-301" has its worktree at "/work/app.worktrees/BUG-301" with nothing uncommitted
When "spec worktree remove BUG-301" runs in "/work/app" through workspace.RemoveWorktree
Then after waiting 15 minutes the command fails with workspace.WorktreeBusy
And stderr is "another spec worktree add for BUG-301 is still running (pid 4242)" and the exit code is 1
And "/work/app.worktrees/BUG-301" is left as it was (R2)

### S10: A lock left by a process that has ended
Given "/work/app/.git/spec/worktree-BUG-301.lock" names a process that has ended
And ticket "BUG-301" has its worktree at "/work/app.worktrees/BUG-301" with nothing uncommitted
When "spec worktree remove BUG-301" runs in "/work/app" through workspace.RemoveWorktree
Then the remove takes the lock over without waiting, and "/work/app.worktrees/BUG-301" no longer exists (R2)
And stdout is "BUG-301: removed /work/app.worktrees/BUG-301; ticket/BUG-301 is kept" and the exit code is 0

### S11: What a merge that ended early left of a merged ticket
Given ticket "TASK-101" is done and "ticket/TASK-101" is merged into "main", by a merge that ended after its commit and before it removed the ticket's worktree
And "/work/app.worktrees/TASK-101" has nothing uncommitted, "/work/app/.git/spec/setup/TASK-101.txt" exists, and "/work/app/.git/spec/worktree-TASK-101.lock" names a process that has ended
When "spec worktree remove TASK-101" runs in "/work/app" through workspace.RemoveWorktree
Then "/work/app.worktrees/TASK-101" and "/work/app/.git/spec/worktree-TASK-101.lock" no longer exist, and "/work/app/.git/spec/setup/TASK-101.txt" is kept (R2, R3)
And stdout is "TASK-101: removed /work/app.worktrees/TASK-101; ticket/TASK-101 is kept" and the exit code is 0

### S12: A setup failure left with no worktree
Given no worktree has "ticket/TASK-101" checked out, and "/work/app/.git/spec/setup/TASK-101.failed" exists
When "spec worktree remove TASK-101" runs in "/work/app" through workspace.RemoveWorktree
Then the command fails with workspace.NoWorktree, stderr is "TASK-101 has no worktree", and the exit code is 1
And "/work/app/.git/spec/setup/TASK-101.failed" no longer exists (R3)

## Rules
- R1: Removing a worktree never loses work: the branch is kept, and a tree with uncommitted changes is not removed
- R2: A remove holds the ticket's lock, "spec/worktree-<ID>.lock" in the repository's common git directory, the one `spec worktree add` holds (WSP-001), from before it looks for the ticket's worktree until it has removed the tree and the ticket's "spec/setup/<ID>.failed" file. It waits up to 15 minutes for an add or another remove of the same ticket that holds the lock, then fails with "another spec worktree add for <ID> is still running (pid <pid>)", the message an add that waits too long prints, and changes nothing. A lock whose process has ended is taken over atomically, as PIP-002/R7 says
- R3: A remove deletes the ticket's "spec/setup/<ID>.failed" file whether or not it finds a worktree, but not when git keeps the tree; it always keeps the setup record "spec/setup/<ID>.txt". So a remove of a merged ticket whose merge ended before its cleanup (WSP-006/R8) leaves what a completed merge leaves: no tree, no ".failed" file and no lock, and a remove run again changes nothing more

## Out of scope
- Deleting the ticket's branch
