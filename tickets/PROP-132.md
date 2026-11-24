---
id: PROP-132
type: proposal
title: A stage subagent that stops without its report is asked for it instead of leaving the stage running
status: open
stage: null
touches: [INS-020, INS-020/S10, INS-020/R9, INS-020/R19, PIP-017]
violates: []
depends_on: []
changed: []
questions:
  - id: Q1
    kind: preference
    text: How does the stop hook know that a subagent is a stage's, since SubagentStop carries no prompt?
    default: From something Claude Code itself reports for that subagent, such as its agent ID or the first message of its own transcript; when that cannot be read, the subagent stops as today
    cites: [INS-020/R9]
    answer: null
    raised_by: null
  - id: Q2
    kind: preference
    text: How many times is a stage subagent asked for a missing report?
    default: Once, using no attempt of the refusal budget; then it stops and the next request is denied as today
    cites: [INS-020/R9]
    answer: null
    raised_by: null
history: []
---
Seen live on 2026-11-23, Claude Code 2.1.312, throwaway copy of chat-mini, stage started by spec:TASK-101 on haiku low. The implementer finished the work, saved its report to the report file as the task says, and ended with a prose message that held no report block. INS-020/S10 and R9 let it stop in silence, so nothing was recorded and the stage stayed in progress with nobody working on it. A second run in the same project (TASK-103, blocked) ended with a report block and was recorded. The saved report file itself was not a valid report either: it had no report fence, and check-report refused it.

The next spec:TASK-101 request is denied as running and its reason tells the main session how to relay or restart (R19), so nothing is lost, but the main agent has to step in, and the person wanted the stages to run without that.

What I want: a subagent known to be running a stage that stops with no report block is sent back, once, told to end with its report block (and that the report file alone does not record the stage). Subagents that are not a stage's are never held. The saved report file is not trusted in place of the message without the same checks. The delegated task's wording should also stop suggesting that saving the file is enough: it says the main session records the stage from the file, while on Claude Code the hooks record it from the message.

Must still hold: recorded at most once; an unrelated subagent's stop is never blocked or delayed; the harness-neutral relay is unchanged.
