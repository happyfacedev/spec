# spec

## Purpose
spec keeps a project's specification as a graph of small Markdown units with stable IDs (features with Given/When/Then scenarios, contracts, invariants, decisions, screens), and ships a CLI that lints it, computes the reach of any change, refuses work without a clear path, builds a small brief for each stage role, and checks and records every ticket stage. Tickets run spec first and test first (spec-writer, tester, implementer, reviewer), each in its own git worktree, and merge into the base branch when lint and every test pass. The core knows no harness; Claude Code is the first adapter, installed as `spec@happyface` from the happyface plugin marketplace, with `spec init` putting a pinned CLI into each project.

## Actors
- Developer: installs spec in a repository, writes and confirms the spec, files tickets, answers their questions and reviews merged work. Works through the project's `.spec/bin/spec` CLI and the plugin's `/spec-init`, `/feature`, `/change`, `/bug` and `/brief` skills.
- Main session: plans tickets, asks `spec next` for a stage and delegates the returned task through its harness.
- Stage role: spec-writer, tester, implementer or reviewer; it reads its brief, changes only permitted files, and ends with a report block the CLI checks.
- Harness: the agent runtime (Claude Code) through which the main session delegates tasks and the plugin hooks run.
- Ticket tracker: where tickets live, either Markdown files in the repository or any tracker reached through a command adapter.
