---
id: INS-008
title: Keep session-start context light
module: install
status: active
retired: [S2, S4]
---
## Intent
A main session knows how work is started and the size of the live queue without receiving the whole ticket list. A subagent gets its task context only.

## Behaviour
### S1: The main session receives workflow guidance and queue counts
Given the "chat-mini" fixture with seven ready tickets and one ticket blocked on Q1
When Claude Code runs `spec hook claude-code session-start` with a main-session payload
Then additionalContext states every behaviour, spec and test change goes through a ticket
And it names /spec:feature, /spec:change, /spec:bug and /spec:brief
And it says to run `.spec/bin/spec queue` for the full queue
And one line counts ready, in progress, waiting for a person and blocked tickets
And it adds one hooks-status line only when required Git hooks are missing or not integrated
And it does not include a ticket ID or the full queue
And it is no more than eight lines (R1)

### S6: The payload can carry Astro session metadata
Given a main session at the project root
When session-start receives `agent: "main"`, a `run_id`, and the project `cwd`
Then the same short context is emitted as one Claude Code SessionStart JSON payload

### S3: A subagent session is silent
Given a project with the new pinned CLI installed and a cwd outside any ticket worktree
When session-start receives `agent: "subagent"` and a `run_id`
Then it emits no stdout, stderr or context

### S5: A ticket worktree session is silent
Given the "chat-mini" fixture with a ticket worktree checked out
When session-start receives a `cwd` inside that worktree
Then it emits no stdout, stderr or context

### S7: One line names the model of each stage role
Given the project sets the claude-code lists spec-writer opus medium; tester sonnet high, then haiku high; implementer "opus" as one text; and no reviewer
When Claude Code runs `spec hook claude-code session-start` with a main-session payload
Then additionalContext holds the line "Models: spec-writer opus medium · spec-review not set · tester sonnet high · implementer opus · reviewer not set" and is at most eight lines, when the installed Claude Code is 2.1.292 or later (R1, R2)
And when that is not known, the line holds no effort and ends " · effort not sent: Claude Code 2.1.292 or later was not found" (R2)
And with sonnet marked unavailable, the tester is shown as "tester haiku high (sonnet marked unavailable)", and with haiku marked too, as "tester none available (sonnet, haiku marked unavailable)" (R2)
And with no claude-code model set, with a config that cannot be read, or in an Astro session (CLI-007/R6), there is no such line and the rest of the context is as before (R2)

## Rules
- R1: The main session context is at most eight lines and never includes the rendered ticket queue.
- R2: When a claude-code model is set and the harness is not Astro, one line gives each stage role's selected model and effort, and the models skipped because they are marked unavailable, as `spec detect` reports them (CLI-008/R13). It asks no model or service, and waits at most the 3 seconds of CLI-007/R19, once, and only when a selected entry sets an effort.

## Out of scope
- What `spec queue` holds and how it is grouped: tickets
