---
id: TKT-003
title: Tickets as files in the repository
module: tickets
status: active
retired: [S5, S6, S7, S8, R3, R4]
---
## Intent
By default each ticket is one Markdown file in the repository's ticket folder, committed with each stage on the ticket's own branch. The store finds that folder, reads every ticket file in it, and saves new tickets without ever writing over one.

## Behaviour
### S1: The default folder
Given `spec/config.json` has no `tickets` key, so tickets.StoreConfig is a tickets.FilesStore with tickets.FilesStore.dir "tickets"
And "tickets/TASK-101.md" exists in the project root
When the developer runs `spec queue` through tickets.Queue
Then tickets.QueueResult.ready holds "TASK-101"

### S2: A folder named in the config
Given tickets.StoreConfig is a tickets.FilesStore with tickets.FilesStore.dir "work/tickets"
And "work/tickets/TASK-101.md" exists
When the developer runs `spec gate TASK-101` through tickets.Gate
Then cli.CommandResult.exitCode is 0

### S3: The --tickets option wins over the config
Given tickets.StoreConfig is a tickets.CommandStore
When the developer runs `spec queue --tickets other` through tickets.Queue
Then tickets are read from the files in "other", relative to the working directory, and the command is never run (R1)

### S4: Only Markdown files are tickets
Given the tickets folder holds "TASK-101.md", "README.txt" and "notes/TASK-102.md"
When the developer runs `spec queue` through tickets.Queue
Then the tickets read are "TASK-101" and "TASK-102", and "README.txt" is ignored (R2)

### S9: A ticket ID that is taken is never written over
Given "tickets/TASK-101.md" exists
When a new ticket "TASK-101" is saved to the store
Then saving fails with tickets.StoreRefused, saying "TASK-101 already exists" (R5)

## Rules
- R1: The ticket folder is `--tickets <dir>` when given, else the config's tickets.FilesStore.dir, else "tickets"; with `--tickets`, a tickets.CommandStore in the config is not used
- R2: Every `.md` file under the folder, at any depth, is read as a ticket; other files are ignored
- R5: Creating a ticket never replaces one: an ID already in the store, or an existing file at its path, is refused

## Out of scope
- Which copy of a ticket is live when its branch is checked out in another worktree or not yet merged, and where a write to it goes: WSP-004
- Making, listing and removing worktrees: workspace
- The commits a stage makes: pipeline
