---
id: workspace
prefix: WSP
domain: work
status: active
---
Where tickets run and how they land: one git worktree and branch per ticket, listing startable work for the session, and merging done tickets.

## Owns
- `spec worktree add|remove|list`
- `spec next [<TICKET>] [--start]` prepares stage tasks for session delegation
- `spec merge <TICKET>...`
- Worktree setup records under the repository's common git directory (`spec/setup/`)

## Non-goals
- Which tickets may run together: tickets (`plan`)
