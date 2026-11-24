---
name: orchestrate
description: Deliver tickets in chat hands-off. Runs every ticket that can start, in parallel waves, each through its stages in its own worktree, and merges each one when its tests and spec still pass. Use with ticket IDs, a goal, or nothing for all ready tickets.
argument-hint: [<ticket IDs> | <goal>]
allowed-tools: Bash(.claude/skills/chat-spec/scripts/spec *)
---
# /orchestrate: deliver tickets, hands-off

The queue now:

!`.claude/skills/chat-spec/scripts/spec plan`

1. Decide the tickets.
   - With ticket IDs, use them.
   - With nothing, use every ticket under "Start now" and "Later".
   - With a goal in words, match it to tickets in the plan. If tickets for it are missing, file them first with `/feature`, `/change` or `/bug`.
2. Show the user what will run, and in which waves, then run:
   `.claude/skills/chat-spec/scripts/spec orchestrate <IDs>`
   It runs each wave in parallel, merges every ticket that finishes once tests and lint pass on the merged result, and starts the next wave. It can take a while; run it in the background if your harness allows, and tell the user when it ends.
3. Report:
   - what was merged;
   - every ticket that waits for a person, with its question. Answers go in with `.claude/skills/chat-spec/scripts/spec ticket answer <ID> <Q> <answer>`; then run `/orchestrate` again.

Never answer a ticket's question yourself, and never merge by hand around a refusal.
