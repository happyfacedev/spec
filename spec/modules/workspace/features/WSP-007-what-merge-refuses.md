---
id: WSP-007
title: What merge refuses before it merges
module: workspace
status: active
invariants: [INV-002]
questions:
  - id: Q1
    kind: preference
    text: spec merge checks each argument's ID form only when it reaches it, so "spec merge TASK-101 cart" merges TASK-101 and then exits 2 with the usage text, without printing TASK-101's result. Should every argument be checked before anything merges?
    default: Check each argument when it is reached (current behaviour)
    cites: [WSP-007/S10]
    answer: 'Changed in review (2026-10-29): every argument is checked before anything merges (R2, S16).'
    raised_by: null
---
## Intent
Try a merge only when it can be clean and is wanted: in the tree that has the base branch checked out with no uncommitted change to a tracked file and no untracked file where the merge would write one, with a test command to check the merged result, for every argument a ticket ID, for a ticket that is done and whose branch is not merged yet. Each refusal says what to do, and leaves the base branch as it was. Merging an already merged ticket again finishes the cleanup that a merge which ended early left undone. Untracked notes and drafts that the merge does not touch never block it, and the merge leaves them as they are.

## Behaviour
### S1: The base branch is not checked out here
Given the tree has "ticket/PROP-205" checked out
When "spec merge TASK-101" runs through workspace.Merge
Then merging "TASK-101" fails with workspace.NotOnBaseBranch
And stdout is "TASK-101: not merged, merging happens on main; this tree has ticket/PROP-205 checked out" and the exit code is 1

### S2: Uncommitted changes on the base branch
Given "main" is checked out with uncommitted changes to "a.ts", "b.ts", "c.ts", "d.ts", "e.ts" and an untracked "f.ts"
When "spec merge TASK-101" runs through workspace.Merge
Then merging "TASK-101" fails with workspace.BaseBranchDirty
And stdout is "TASK-101: not merged, main has uncommitted changes: a.ts, b.ts, c.ts, d.ts, e.ts"
And "main" and its uncommitted changes are as they were (INV-002)

### S3: A ticket that is not done
Given ticket "TASK-102" is blocked
When "spec merge TASK-102" runs through workspace.Merge
Then merging "TASK-102" fails with workspace.TicketNotDone, and stdout is "TASK-102: not merged, TASK-102 is blocked, not done" (INV-002)

### S4: A ticket in progress
Given tickets.Ticket.status of "TASK-103" is in_progress
When "spec merge TASK-103" runs through workspace.Merge
Then merging "TASK-103" fails with workspace.TicketNotDone, and stdout is "TASK-103: not merged, TASK-103 is in progress, not done"

### S5: Done is read from the ticket's live state
Given ticket "TASK-101" is done on "ticket/TASK-101", while "/work/app/tickets/TASK-101.md" on "main" still says open
When "spec merge TASK-101" runs through workspace.Merge
Then the ticket counts as done and is merged (WSP-004)

### S6: Already merged
Given "ticket/TASK-101" is already merged into "main"
When "spec merge TASK-101" runs through workspace.Merge
Then merging "TASK-101" fails with workspace.AlreadyMerged, and stdout is "TASK-101: not merged, ticket/TASK-101 is already merged into main"

### S7: The ticket has no branch
Given ticket "TASK-107" is done and no branch "ticket/TASK-107" exists
When "spec merge TASK-107" runs through workspace.Merge
Then merging "TASK-107" fails with workspace.NoTicketBranch, and stdout is "TASK-107: not merged, ticket/TASK-107 does not exist"

### S8: No such ticket
Given no ticket "TASK-999" exists
When "spec merge TASK-999" runs through workspace.Merge
Then merging "TASK-999" fails with workspace.TicketNotFound, stdout is "TASK-999: not merged, unknown ticket TASK-999", and the exit code is 1

### S9: No tickets
When "spec merge" runs through workspace.Merge
Then the command fails with cli.UsageError
And stderr starts with "usage: spec merge <TICKET>..." and the exit code is 2

### S10: An argument that is not a ticket ID
When "spec merge cart" runs through workspace.Merge
Then the command fails with workspace.UnknownTicket
And stderr starts with "Unknown cart." and the exit code is 2

### S11: Not a git repository
Given the project root "/work/plain" is not inside a git repository
When "spec merge TASK-101" runs through workspace.Merge
Then merging "TASK-101" fails with workspace.NotARepository, and stdout is "TASK-101: not merged, /work/plain is not a git repository"

### S12: Another base branch
Given format.Config.baseBranch is "develop", and the tree has "main" checked out
When "spec merge TASK-101" runs through workspace.Merge
Then merging "TASK-101" fails with workspace.NotOnBaseBranch, and stdout is "TASK-101: not merged, merging happens on develop; this tree has main checked out"

### S13: Already merged, with what a merge that ended early left behind
Given ticket "TASK-101" is done and "ticket/TASK-101" is merged into "main", by a merge that ended after its commit and before it removed the ticket's worktree
And "/work/app.worktrees/TASK-101" has "ticket/TASK-101" checked out with nothing uncommitted, "/work/app/.git/spec/setup/TASK-101.failed" exists, and "/work/app/.git/spec/worktree-TASK-101.lock" names a process that has ended
When "spec merge TASK-101" runs in "/work/app" through workspace.Merge
Then merging "TASK-101" fails with workspace.AlreadyMerged, stdout is "TASK-101: not merged, ticket/TASK-101 is already merged into main; removed its worktree /work/app.worktrees/TASK-101", and the exit code is 1 (R1)
And "/work/app.worktrees/TASK-101", "/work/app/.git/spec/setup/TASK-101.failed" and "/work/app/.git/spec/worktree-TASK-101.lock" no longer exist, and "ticket/TASK-101" is kept (R1)
And in the JSON form workspace.MergeResult.error is "ticket/TASK-101 is already merged into main; removed its worktree /work/app.worktrees/TASK-101"
And a second "spec merge TASK-101" prints "TASK-101: not merged, ticket/TASK-101 is already merged into main" and changes nothing (R1)

### S14: A leftover worktree with uncommitted changes stays
Given ticket "TASK-101" is done, "ticket/TASK-101" is merged into "main", and its worktree "/work/app.worktrees/TASK-101" has an uncommitted file "notes.txt"
When "spec merge TASK-101" runs through workspace.Merge
Then merging "TASK-101" fails with workspace.AlreadyMerged, and stdout is "TASK-101: not merged, ticket/TASK-101 is already merged into main" (R1)
And "/work/app.worktrees/TASK-101/notes.txt" still exists

### S15: A leftover worktree behind a busy lock
Given ticket "TASK-101" is done, "ticket/TASK-101" is merged into "main", and its worktree "/work/app.worktrees/TASK-101" has nothing uncommitted
And "/work/app/.git/spec/worktree-TASK-101.lock" is held by a process, pid "4242", that keeps running for more than 15 minutes
When "spec merge TASK-101" runs through workspace.Merge
Then after waiting 15 minutes for the ticket's lock, the refusal names workspace.WorktreeBusy: stdout is "TASK-101: not merged, ticket/TASK-101 is already merged into main; its worktree was not removed: another spec worktree add for TASK-101 is still running (pid 4242)" (R1)
And the exit code is 1, and "/work/app.worktrees/TASK-101" and the lock are left as they were

### S16: Every argument is checked before anything merges
Given ticket "TASK-101" is done and "ticket/TASK-101" is not merged into "main", and "main" is at commit "a1b2c3d"
When "spec merge TASK-101 cart" runs through workspace.Merge
Then the command fails with workspace.UnknownTicket, stderr starts with "Unknown cart." and the exit code is 2 (R2)
And stdout is empty, "main" is still at "a1b2c3d", and "ticket/TASK-101" is not merged into "main" (R2)

### S17: No test command to run on the merged result
Given "/work/app/spec" has no "config.json", so format.Config.testCommand is not set
And ticket "TASK-101" is done, "ticket/TASK-101" is not merged into "main", and "main" is at commit "a1b2c3d" with nothing uncommitted
When "spec merge TASK-101" runs in "/work/app" through workspace.Merge
Then merging "TASK-101" fails with workspace.NoTestCommand, stdout is "TASK-101: not merged, config.json has no testCommand to run on the merged result", and the exit code is 1 (R3)
And "main" is still at "a1b2c3d", with nothing uncommitted and no merge in progress (INV-002, R3)

### S18: Already merged, with tickets in a folder outside the repository
Given tickets.StoreConfig is a tickets.FilesStore with tickets.FilesStore.dir "../tickets", a folder outside the repository "/work/app"
And ticket "TASK-101" is done in "/work/tickets/TASK-101.md", "ticket/TASK-101" is merged into "main", and "main" is at commit "a1b2c3d" with nothing uncommitted
And "/work/app.worktrees/TASK-101" has "ticket/TASK-101" checked out with nothing uncommitted
When "spec merge TASK-101" runs in "/work/app" through workspace.Merge
Then merging "TASK-101" fails with workspace.AlreadyMerged, stdout is "TASK-101: not merged, ticket/TASK-101 is already merged into main; removed its worktree /work/app.worktrees/TASK-101", and the exit code is 1 (R1)
And "/work/app.worktrees/TASK-101" no longer exists, "ticket/TASK-101" is kept, and "main" is still at "a1b2c3d" (R1)

### S19: Untracked files the merge does not touch stay as they are
Given "/work/app" has "main" checked out with no tracked file changed, and untracked "T3_CODE_ANALYSIS.md" and "design/options/a.html", which "ticket/TASK-101" does not have
And ticket "TASK-101" is done and "ticket/TASK-101" is not merged into "main"
When "spec merge TASK-101" runs in "/work/app" through workspace.Merge
Then stdout is "TASK-101: merged (<abbreviated HEAD>)" and the exit code is 0 (R4)
And "T3_CODE_ANALYSIS.md" and "design/options/a.html" are still untracked with the content they had, and the merge commit holds neither (R4)

### S20: An untracked file where the ticket's branch adds one
Given "main" is at commit "a1b2c3d" with no tracked file changed and an untracked "docs/plan.md", and "ticket/TASK-101" adds a file "docs/plan.md"
And ticket "TASK-101" is done and "ticket/TASK-101" is not merged into "main"
When "spec merge TASK-101" runs through workspace.Merge
Then merging "TASK-101" fails with workspace.BaseBranchDirty, stdout is "TASK-101: not merged, main has uncommitted changes: docs/plan.md", and the exit code is 1 (R4)
And "main" is still at "a1b2c3d", and "docs/plan.md" is still untracked with the content it had (INV-002, R4)

### S21: Tracked changes still refuse, and only what blocks is listed
Given "main" has "a.ts" modified, "b.ts" modified and staged, and "c.ts" deleted, and an untracked "notes.md" that "ticket/TASK-101" does not add
And ticket "TASK-101" is done and "ticket/TASK-101" is not merged into "main"
When "spec merge TASK-101" runs through workspace.Merge
Then merging "TASK-101" fails with workspace.BaseBranchDirty, stdout is "TASK-101: not merged, main has uncommitted changes: a.ts, b.ts, c.ts", and the exit code is 1 (R4)
And "a.ts", "b.ts", "c.ts" and "notes.md" are as they were, "b.ts" still staged and "notes.md" still untracked (INV-002)

### S22: An untracked file at a generated path
Given format.Config.generated is {"globs": ["plugin/generated/**"]}, and "main" has no tracked file changed and an untracked "plugin/generated/extra.js" that "ticket/TASK-101" does not add
And ticket "TASK-101" is done and "ticket/TASK-101" is not merged into "main"
When "spec merge TASK-101" runs through workspace.Merge
Then merging "TASK-101" fails with workspace.BaseBranchDirty, stdout is "TASK-101: not merged, main has uncommitted changes: plugin/generated/extra.js", and the exit code is 1 (R4)
And "plugin/generated/extra.js" is still untracked with the content it had

### S23: A refused merge leaves untracked files as they were
Given "/work/app" has "main" at commit "a1b2c3d" with no tracked file changed and an untracked "T3_CODE_ANALYSIS.md" that "ticket/TASK-105" does not have
And ticket "TASK-105" is done, and "ticket/TASK-105" breaks scenario "CNV-003/S1"
And while the tests run on the merged result, someone creates an untracked "scratch.md" in "/work/app"
When "spec merge TASK-105" runs in "/work/app" through workspace.Merge
Then merging "TASK-105" fails with workspace.MergedTestsFail, and "main" is back at "a1b2c3d" (INV-002)
And "T3_CODE_ANALYSIS.md" and "scratch.md" are still untracked with the content they had (R4)

### S24: The afterMerge commit never holds an untracked file from before the merge
Given format.Config.afterMerge changes "tools/spec.cjs", and "main" has no tracked file changed and an untracked "T3_CODE_ANALYSIS.md" that "ticket/TASK-112" does not have
And ticket "TASK-112" is done and "ticket/TASK-112" is not merged into "main"
When "spec merge TASK-112" runs through workspace.Merge
Then stdout is "TASK-112: merged (<abbreviated HEAD>)" and the exit code is 0
And the commit "TASK-112: after merge" holds "tools/spec.cjs" and not "T3_CODE_ANALYSIS.md", which is still untracked with the content it had (R4)

### S25: Ignored files never count
Given ".gitignore" holds "node_modules", and "main" has no tracked file changed and an ignored file "node_modules/cache.bin"
And ticket "TASK-101" is done and "ticket/TASK-101" is not merged into "main"
When "spec merge TASK-101" runs through workspace.Merge
Then stdout is "TASK-101: merged (<abbreviated HEAD>)", the exit code is 0, and "node_modules/cache.bin" is as it was (R4)

### S26: An untracked file created where the branch adds one, while the merge starts
Given "/work/app" has "main" at commit "a1b2c3d" with nothing uncommitted, ticket "TASK-101" is done, and "ticket/TASK-101" adds a file "docs/plan.md" and changes "src/app.ts"
When "spec merge TASK-101" runs in "/work/app" through workspace.Merge
And while it runs, after it has checked "main" for uncommitted changes and before it merges "ticket/TASK-101", someone creates an untracked "docs/plan.md" in "/work/app"
Then merging "TASK-101" fails with workspace.BaseBranchDirty, stdout is "TASK-101: not merged, main has uncommitted changes: docs/plan.md", and the exit code is 1 (R4)
And "main" is still at "a1b2c3d" with no merge in progress, "src/app.ts" is as "main" has it, and "docs/plan.md" is still untracked with the content it had (INV-002, R4)

### S27: An untracked file created at a generated path while the merge runs
Given "/work/app" has "main" at commit "a1b2c3d" with nothing uncommitted, and format.Config.generated is {"globs": ["plugin/generated/**"], "command": "npm run build --silent"}
And ticket "TASK-103" is done, and "main" and "ticket/TASK-103" both changed "plugin/generated/app.js", so it conflicts
When "spec merge TASK-103" runs in "/work/app" through workspace.Merge
And while it runs, after it has checked "main" for uncommitted changes and before it rebuilds the generated files, someone creates an untracked "plugin/generated/extra.js" in "/work/app"
Then merging "TASK-103" fails with workspace.BaseBranchDirty, stdout is "TASK-103: not merged, main has uncommitted changes: plugin/generated/extra.js", and the exit code is 1 (R4)
And "npm run build --silent" did not run, "main" is still at "a1b2c3d" with no merge in progress, and "plugin/generated/extra.js" is still untracked with the content it had (INV-002, R4)

## Rules
- R1: A done ticket whose branch is already merged is refused (S6), wherever its tickets live: whether the branch is merged is read from the repository's own branches, also when the ticket files are in a folder outside the repository, through tickets.FilesStore.dir or "--tickets" (S18). But first the merge does what WSP-006/R8 does after a merge, so what a merge that ended between its commit and that cleanup left is gone once merge runs again: holding the merge lock, it takes the ticket's lock, "spec/worktree-<ID>.lock" (WSP-001/R6, WSP-002/R2), taking over one whose process has ended as PIP-002/R7 says, removes the ticket's worktree and its "spec/setup/<ID>.failed" file, and releases the lock. git keeps a tree with uncommitted changes, and then the ".failed" file stays too; the setup record "spec/setup/<ID>.txt" is kept, as every remove keeps it. The line adds "; removed its worktree <path>" when a tree was removed, and "; its worktree was not removed: " with the workspace.WorktreeBusy message when the lock is still held after 15 minutes; otherwise it is S6's line. It stays a refusal, with exit code 1
- R2: Every argument is checked to be a ticket ID before any ticket is merged: one that is not refuses the whole command with workspace.UnknownTicket, so no ticket is merged, no ticket's line is printed and stdout is empty
- R3: A merge is never tried without a test command (INV-002): when format.Config.testCommand is not set, because the spec has no "config.json", each ticket is refused with workspace.NoTestCommand before anything is merged. The check comes after the project root is found to be a git repository (S11) and before every other refusal of this feature
- R4: The base branch must be clean where the merge works (INV-002). Every uncommitted change to a tracked file, modified, staged or deleted, refuses the merge with workspace.BaseBranchDirty (S2, S21). An untracked file refuses it only when the merge would write a file at its path, or at a folder that holds it: a file the ticket's branch adds that the base branch does not have (S20), or a generated path the merge or format.Config.afterMerge rebuilds: the spec root's "index.md", the project-pinned ".spec/bin/" CLI, and every path format.Config.generated (or an old config's "generatedGlobs", FMT-002/R9) matches (S22). Paths are compared as git compares them in that repository, so on a file system that ignores case, paths that differ only in case are the same path. The refusal lists the tracked changes and those untracked files together, the first five in sorted order. An untracked file created at a path the branch adds after that check and before the merge writes the branch's files is never overwritten: git refuses to merge over it and changes nothing, and the merge is refused with workspace.BaseBranchDirty naming the paths git names, undone completely, with no merge in progress and the file unchanged (S26); once the merge has written a path, a file there is a tracked file, and a refused merge keeps an edit to it as WSP-006/R1 says. Generated paths are checked again for untracked files immediately before the merge rebuilds generated files and again immediately before format.Config.afterMerge runs: an untracked file found there refuses the merge with workspace.BaseBranchDirty naming it, before anything is rebuilt or afterMerge runs, the merge is undone completely as WSP-006/R1 says, and the file is kept unchanged (S27). Every other untracked file stays exactly as it was, untracked and with the content it had, whether the merge succeeds or is refused and undone, and a refused merge also keeps one created while it ran; no commit the merge makes, the merge commit or the afterMerge commit, holds an untracked file that was there before the merge (S19, S23, S24). Ignored files never count and are never committed (S25)

## Out of scope
- Merging in a tree other than the one that has the base branch checked out
