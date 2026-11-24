---
id: pipeline
prefix: PIP
domain: work
status: active
---
Running one ticket's stages: which roles run in which order, what each role is told, and how each finished stage is checked and recorded.

## Owns
- The stage order for each ticket type
- `spec brief [<role>] [<ID>] [--base <ref>] [--query <text>]`
- `spec next <TICKET>`: the started stage's self-contained delegation task
- `spec ticket start`, `spec check-report`, `spec ticket advance` (including report intake)
- `spec test [<scenario ID>]` and reading the test report of any stack

## Non-goals
- Whether a ticket may start: tickets (`gate`)
- Where a ticket runs: workspace
