---
id: WSP-003
title: List ticket worktrees
module: workspace
status: active
provides: [workspace.ListWorktrees]
questions:
  - id: Q1
    kind: preference
    text: With a files ticket store outside the repository (tickets.dir starting with ".."), the CLI reads no ticket branches at all, so "spec worktree list" prints "no ticket worktrees" and "spec worktree remove" says "has no worktree" even when ticket worktrees exist. Should worktrees be listed regardless of where tickets live?
    default: List nothing in that case (current behaviour)
    cites: [WSP-003/S1]
    answer: 'Change requested in review (2026-10-29): List worktrees from git, wherever tickets live. Filed as a proposal; until it lands, the spec states today''s behaviour.'
    raised_by: null
---
## Intent
Show which tickets have a checkout and where, with each ticket's live status, so a person can find a running ticket's tree, and see which trees a merge left behind.

## Behaviour
### S1: No ticket worktrees
Given no worktree of the repository has a "ticket/" branch checked out
When "spec worktree list" runs through workspace.ListWorktrees
Then stdout is "no ticket worktrees" and the exit code is 0

### S2: One line per ticket worktree
Given ticket "BUG-301" is in_progress with its worktree at "/work/app.worktrees/BUG-301"
And ticket "TASK-103" is open with its worktree at "/work/app.worktrees/TASK-103"
When "spec worktree list" runs through workspace.ListWorktrees
Then stdout is:
```text
BUG-301 in_progress /work/app.worktrees/BUG-301
TASK-103 open /work/app.worktrees/TASK-103
```

### S3: The JSON form
Given ticket "BUG-301" is in_progress with its worktree at "/work/app.worktrees/BUG-301"
When "spec worktree list --format json" runs through workspace.ListWorktrees
Then stdout is a list of workspace.WorktreeRow: [{"ticket": "BUG-301", "path": "/work/app.worktrees/BUG-301", "status": "in_progress"}]

### S4: The main tree on a ticket branch is listed too
Given the main tree "/work/app" has "ticket/PROP-205" checked out
When "spec worktree list" runs through workspace.ListWorktrees
Then stdout includes "PROP-205 open /work/app"

### S5: A branch with no ticket
Given a worktree at "/work/app.worktrees/TASK-900" has "ticket/TASK-900" checked out and no ticket "TASK-900" exists
When "spec worktree list" runs through workspace.ListWorktrees
Then stdout includes "TASK-900 ? /work/app.worktrees/TASK-900"
And in the JSON form workspace.WorktreeRow.status is null

### S6: An unknown subcommand
When "spec worktree prune" runs
Then the command fails with cli.UsageError
And stderr starts with "usage: spec worktree add <TICKET> | remove <TICKET> | list" and the exit code is 2

### S7: Tickets in a folder outside the repository
Given tickets.StoreConfig is a tickets.FilesStore with tickets.FilesStore.dir "../tickets", a folder outside the repository
And ticket "BUG-301" is in_progress in "/work/tickets/BUG-301.md", with its worktree at "/work/app.worktrees/BUG-301"
When "spec worktree list" runs through workspace.ListWorktrees
Then stdout is "BUG-301 in_progress /work/app.worktrees/BUG-301" and the exit code is 0

### S8: Tickets in a tracker
Given tickets.StoreConfig is a tickets.CommandStore
And ticket "BUG-301" is in_progress with its worktree at "/work/app.worktrees/BUG-301"
When "spec worktree list" runs through workspace.ListWorktrees
Then stdout is "BUG-301 in_progress /work/app.worktrees/BUG-301" and the exit code is 0

### S9: A merged ticket's worktree is marked, not removed
Given ticket "TASK-101" is done and "ticket/TASK-101" is merged into "main", and its worktree "/work/app.worktrees/TASK-101" is still there because the merge ended before it removed it
And ticket "BUG-301" is in_progress with its worktree at "/work/app.worktrees/BUG-301"
When "spec worktree list" runs in "/work/app" through workspace.ListWorktrees
Then stdout is:
```text
BUG-301 in_progress /work/app.worktrees/BUG-301
TASK-101 done /work/app.worktrees/TASK-101 (merged into main; spec worktree remove TASK-101 removes it)
```
And in the JSON form the row of "TASK-101" has workspace.WorktreeRow.merged true, and the row of "BUG-301" has no "merged" (R1)
And "/work/app.worktrees/TASK-101" still exists, and the exit code is 0 (R1)

## Rules
- R1: A worktree whose ticket is done and whose branch is merged into the base branch is left over from its merge: the text form ends its line with " (merged into <base>; spec worktree remove <ID> removes it)" and the JSON form sets "merged": true. List only reports it; it removes nothing

## Out of scope
- Worktrees on branches that are not "ticket/" branches
