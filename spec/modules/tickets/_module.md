---
id: tickets
prefix: TKT
domain: work
status: active
---
Tickets, where they live, and whether each may start: the unit of work that changes the spec, the tests or the code.

## Owns
- The ticket format: proposal, bug and task; questions; history
- Ticket stores: `files` (one Markdown file per ticket) and `command` (any tracker, through the list/put protocol)
- `spec ticket new`, `spec ticket answer`, `spec ticket combine`, `spec ticket close`
- `spec gate`, `spec queue`, `spec plan`

## Non-goals
- Running a ticket's stages: pipeline
- Worktrees and merging: workspace
