---
id: WSP-001
title: Give a ticket its own worktree
module: workspace
status: active
writes: [workspace.Worktree]
provides: [workspace.AddWorktree]
decisions: [ADR-001]
questions: []
---
## Intent
Give each ticket its own git checkout on its own branch, so tickets can run at the same time without sharing a working tree, and make that checkout ready to run the ticket's stages: the bundled CLI is there and the project's dependencies are set up.

## Behaviour
### S1: A new worktree on a new branch from the base branch
Given the repository "/work/app" is on "main", ticket "TASK-101" exists, and no branch "ticket/TASK-101" exists
When "spec worktree add TASK-101" runs through workspace.AddWorktree
Then branch "ticket/TASK-101" is created from "main" and checked out at "/work/app.worktrees/TASK-101" (R1)
And workspace.Worktree.path is "/work/app.worktrees/TASK-101" and workspace.Worktree.branch is "ticket/TASK-101"
And stdout is "TASK-101: created /work/app.worktrees/TASK-101 on ticket/TASK-101" and the exit code is 0

### S2: The JSON form
Given ticket "BUG-301" exists in "/work/app" and has no worktree
When "spec worktree add BUG-301 --format json" runs through workspace.AddWorktree
Then stdout is the workspace.WorktreeAdded {"ok": true, "path": "/work/app.worktrees/BUG-301", "project": "/work/app.worktrees/BUG-301", "created": true}

### S3: The worktrees folder set in the config
Given format.Config.worktrees is "../trees" in the project "/work/app"
When "spec worktree add TASK-101" runs through workspace.AddWorktree
Then workspace.Worktree.path is "/work/trees/TASK-101", resolved from the project root (R1)

### S4: Another base branch
Given format.Config.baseBranch is "develop", and no branch "ticket/TASK-101" exists
When "spec worktree add TASK-101" runs through workspace.AddWorktree
Then branch "ticket/TASK-101" is created from "develop" (R1)

### S5: An existing branch is checked out as it is
Given branch "ticket/TASK-101" exists with commits "main" does not have, and no worktree has it checked out
When "spec worktree add TASK-101" runs through workspace.AddWorktree
Then the new worktree has "ticket/TASK-101" checked out at its existing tip, with those commits (R1)

### S6: A ticket that already has a worktree
Given ticket "BUG-301" already has its worktree at "/work/app.worktrees/BUG-301", and its setup did not fail
When "spec worktree add BUG-301 --format json" runs through workspace.AddWorktree
Then workspace.WorktreeAdded.created is false and workspace.WorktreeAdded.path is "/work/app.worktrees/BUG-301"
And worktreeSetup is not run again (R2)
And the text form prints "BUG-301: already at /work/app.worktrees/BUG-301 on ticket/BUG-301"

### S7: worktreeSetup runs in the new tree
Given format.Config.worktreeSetup is "ln -s \"$SPEC_MAIN_ROOT/node_modules\" node_modules"
When "spec worktree add BUG-301" runs through workspace.AddWorktree from "/work/app"
Then the command ran with "/bin/sh -c" in workspace.Worktree.project, with SPEC_MAIN_ROOT "/work/app" and SPEC_TICKET "BUG-301" in its environment (R2)
And "/work/app.worktrees/BUG-301/node_modules" exists

### S8: worktreeSetup fails
Given format.Config.worktreeSetup is a command that prints "npm ERR! a", "npm ERR! b", "npm ERR! c" and exits 1
When "spec worktree add TASK-101" runs through workspace.AddWorktree
Then the command fails with workspace.SetupFailed
And stderr is "worktreeSetup failed in /work/app.worktrees/TASK-101: npm ERR! a | npm ERR! b | npm ERR! c" and the exit code is 1
But the worktree at "/work/app.worktrees/TASK-101" is left in place
And "/work/app/.git/spec/setup/TASK-101.failed" exists and "/work/app/.git/spec/setup/TASK-101.txt" is not written (R5)

### S9: The bundled CLI is copied into the new tree
Given the project's skill is "app-spec" and ".claude/skills/app-spec/scripts" exists in "/work/app" but is git-ignored
When "spec worktree add TASK-101" runs through workspace.AddWorktree
Then ".claude/skills/app-spec/scripts" in workspace.Worktree.project holds a copy of the main tree's folder (R3)

### S10: A project inside a larger repository
Given the project root is "/work/mono/apps/chat" inside the repository "/work/mono"
When "spec worktree add TASK-101 --format json" runs through workspace.AddWorktree
Then workspace.WorktreeAdded.path is "/work/mono.worktrees/TASK-101"
And workspace.WorktreeAdded.project is "/work/mono.worktrees/TASK-101/apps/chat"

### S11: A ticket that does not exist
Given no ticket "TASK-999" exists
When "spec worktree add TASK-999" runs through workspace.AddWorktree
Then the command fails with workspace.UnknownTicket
And stderr starts with "Unknown TASK-999." and the exit code is 2
And no branch "ticket/TASK-999" is created

### S12: No ticket, or not a ticket ID
When "spec worktree add" runs, or "spec worktree add cart" runs, through workspace.AddWorktree
Then the command fails with cli.UsageError
And stderr starts with "usage: spec worktree add <TICKET> | remove <TICKET> | list" and the exit code is 2

### S13: Not a git repository
Given the project root "/work/plain" is not inside a git repository
When "spec worktree add TASK-101" runs through workspace.AddWorktree
Then the command fails with workspace.NotARepository
And stderr is "/work/plain is not a git repository" and the exit code is 1

### S14: git refuses to add the worktree
Given "/work/app.worktrees/TASK-101" already exists as a folder that is not empty and is not a worktree
When "spec worktree add TASK-101" runs through workspace.AddWorktree
Then the command fails with workspace.GitRefused
And stderr starts with "git could not add a worktree for TASK-101: " followed by git's message, and the exit code is 1

### S15: What setup made is recorded
Given format.Config.worktreeSetup is "ln -s \"$SPEC_MAIN_ROOT/node_modules\" vendor-modules" and git ignores no "vendor-modules"
When "spec worktree add PROP-205" runs through workspace.AddWorktree from "/work/app"
Then "/work/app/.git/spec/setup/PROP-205.txt" holds the line "vendor-modules": every untracked path in the new worktree once it is set up, one per line, relative to the repository root (R4)
And a second "spec worktree add PROP-205" leaves that file as it is

### S16: A failed setup runs again on the next add
Given "spec worktree add TASK-101" made "/work/app.worktrees/TASK-101" in "/work/app" and its format.Config.worktreeSetup failed there, after creating the untracked file "partial.log"
And format.Config.worktreeSetup now exits 0
When "spec worktree add TASK-101" runs through workspace.AddWorktree from "/work/app"
Then worktreeSetup runs again in workspace.Worktree.project, with SPEC_MAIN_ROOT "/work/app" and SPEC_TICKET "TASK-101" in its environment, and no new worktree or branch is made (R2, R5)
And stdout is "TASK-101: set up /work/app.worktrees/TASK-101 on ticket/TASK-101" and the exit code is 0
And "/work/app/.git/spec/setup/TASK-101.txt" lists every untracked path in the worktree once this setup succeeds, "partial.log" included, and "/work/app/.git/spec/setup/TASK-101.failed" is removed (R4)
And a third "spec worktree add TASK-101" prints "TASK-101: already at /work/app.worktrees/TASK-101 on ticket/TASK-101" and does not run worktreeSetup

### S17: The JSON form after a failed setup
Given the setup of ticket "BUG-301"'s worktree "/work/app.worktrees/BUG-301" failed, and format.Config.worktreeSetup now exits 0
When "spec worktree add BUG-301 --format json" runs through workspace.AddWorktree
Then stdout is the workspace.WorktreeAdded {"ok": true, "path": "/work/app.worktrees/BUG-301", "project": "/work/app.worktrees/BUG-301", "created": false}
And worktreeSetup ran again in "/work/app.worktrees/BUG-301" (R5)

### S18: Setup fails again
Given the setup of ticket "TASK-101"'s worktree "/work/app.worktrees/TASK-101" failed, and format.Config.worktreeSetup still prints "npm ERR! a" and exits 1
When "spec worktree add TASK-101" runs through workspace.AddWorktree
Then the command fails with workspace.SetupFailed
And stderr is "worktreeSetup failed in /work/app.worktrees/TASK-101: npm ERR! a" and the exit code is 1
And the worktree is left in place, "/work/app/.git/spec/setup/TASK-101.failed" still exists and "/work/app/.git/spec/setup/TASK-101.txt" is not written, so the next add runs worktreeSetup again (R5)

### S19: A second add waits for the first
Given format.Config.worktreeSetup is "sleep 6; touch made.txt" in "/work/app", and ticket "TASK-101" has no worktree
And "spec worktree add TASK-101" is running in "/work/app", inside its worktreeSetup, and holds "/work/app/.git/spec/worktree-TASK-101.lock", which holds that process's pid
When a second "spec worktree add TASK-101" runs in "/work/app" through workspace.AddWorktree while the first is running
Then the second add waits until the first has ended and released the lock, and never runs worktreeSetup while the first one's runs (R6)
And the first add prints "TASK-101: created /work/app.worktrees/TASK-101 on ticket/TASK-101" and the exit code is 0
And the second add prints "TASK-101: already at /work/app.worktrees/TASK-101 on ticket/TASK-101", does not run worktreeSetup, and the exit code is 0
And "/work/app/.git/spec/worktree-TASK-101.lock" does not exist once both have ended (R6)

### S20: An add that waits too long
Given "/work/app/.git/spec/worktree-TASK-101.lock" is held by a process, pid "4242", that keeps running for more than 15 minutes, and ticket "TASK-101" has no worktree
When "spec worktree add TASK-101" runs in "/work/app" through workspace.AddWorktree
Then after waiting 15 minutes the command fails with workspace.WorktreeBusy
And stderr is "another spec worktree add for TASK-101 is still running (pid 4242)" and the exit code is 1
And no branch "ticket/TASK-101" and no "/work/app.worktrees/TASK-101" is made, and the lock is left as it was (R6)

### S21: A lock left by a process that has ended
Given "/work/app/.git/spec/worktree-TASK-101.lock" names a process that has ended, and ticket "TASK-101" has no worktree
When "spec worktree add TASK-101" runs in "/work/app" through workspace.AddWorktree
Then the add takes the lock over without waiting (R6)
And stdout is "TASK-101: created /work/app.worktrees/TASK-101 on ticket/TASK-101" and the exit code is 0
And "/work/app/.git/spec/worktree-TASK-101.lock" does not exist once the add ends

### S22: An untracked pinned CLI is copied into a new worktree
Given `.spec/bin/spec` and `.spec/bin/spec.cjs` exist in the main tree but are not tracked, and no `.spec/bin/` exists in the new worktree
When `spec worktree add TASK-101` runs through workspace.AddWorktree
Then it copies both pinned CLI files into the new worktree

## Rules
- R1: A ticket's worktree has `ticket/<ID>` checked out; the branch is made from `baseBranch` only when it does not exist yet
- R2: worktreeSetup runs when the worktree is made, and again on each later add until it succeeds; once it has succeeded, or for a worktree whose setup never failed, it does not run again. It runs in the worktree's project root, with SPEC_MAIN_ROOT set to the project root of the tree that ran the command and SPEC_TICKET set to the ticket ID
- R3: An untracked `.spec/bin/` is copied only when the main tree has it and the new tree does not; committed copies arrive from the checked-out branch. An older `.claude/skills/<name>/scripts/` CLI is copied for legacy installs only when it exists in the main tree and not the new tree
- R4: Once a worktree's setup succeeds, whether when the worktree is made or on a later add, its untracked paths, untracked symlinks included, are recorded in "spec/setup/<ID>.txt" in the repository's common git directory, so no stage's check counts them (PIP-005); after a re-run they include what the failed runs left
- R5: A failed worktreeSetup leaves "spec/setup/<ID>.failed" in the repository's common git directory and no "spec/setup/<ID>.txt"; an add that finds the ".failed" file runs worktreeSetup in the existing worktree instead of answering "already at", and removes the file when setup succeeds
- R6: An add holds the ticket's lock, "spec/worktree-<ID>.lock" in the repository's common git directory, the one `spec worktree remove` holds (WSP-002), from before it looks for the ticket's worktree until it has made the worktree, run worktreeSetup and recorded or marked the setup (R4, R5), so one add or remove of a ticket runs at a time. The lock holds the pid of the process that holds it. An add waits up to 15 minutes for another add or a remove of the same ticket that holds the lock, then fails with "another spec worktree add for <ID> is still running (pid <pid>)" and changes nothing. A lock whose process has ended is taken over atomically, as PIP-002/R7 says

## Out of scope
- Installing dependencies: that is whatever worktreeSetup does
- Running the ticket in the worktree (WSP-005)
