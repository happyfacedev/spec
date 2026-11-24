---
id: TKT-010
title: See every ticket with spec queue
module: tickets
status: active
provides: [tickets.Queue]
---
## Intent
One short list of every ticket, grouped by what it needs: ready to start (with the stage to run next), waiting for another ticket, blocked on a person (with the first reason), or in progress. The harness injects it at session start, so it is capped in size and says what it left out.

## Behaviour
### S1: The groups
Given the store holds the chat-mini fixture's tickets, none started
When the developer runs `spec queue` through tickets.Queue
Then cli.CommandResult.stdout is exactly (R1, R2):
```text
# Queue · spec@3f8f2372

## Ready (7)
- BUG-301 bug · next tester · Fallback moves on to a third provider
- PROP-201 proposal · next spec-writer · Add a "gemini" fake provider
- PROP-202 proposal · next spec-writer · List enabled providers in the model picker
- PROP-205 proposal · next spec-writer · Add a copy-message action
- TASK-101 task · next implementer · Extract provider selection into its own module
- TASK-102 task · next implementer · Record which provider produced each message
- TASK-103 task · next implementer · Simplify the fallback code

## Blocked (2)
- BUG-302 bug · Export looks ugly
  schema BUG-302: a bug must name the scenario it violates; without one the behaviour is unspecified: add the violated scenario IDs to violates, or turn the ticket into a proposal
- PROP-206 proposal · Let users rename providers
  question PROP-206#Q1: Do renamed providers keep their usage history?

## In progress (0)
None

Done: 0
```
And cli.CommandResult.exitCode is 0

### S2: A ticket in progress shows its running stage
Given "BUG-301" has tickets.Ticket.status "in_progress" and tickets.Ticket.stage "tester"
When the developer runs `spec queue` through tickets.Queue
Then cli.CommandResult.stdout holds "## In progress (1)" followed by the line "- BUG-301 bug · stage tester · Fallback moves on to a third provider" (R1)

### S3: A ticket that only waits for other tickets
Given "TASK-901", titled "After BUG-301", depends on "BUG-301", which is open, and nothing else stops it
When the developer runs `spec queue` through tickets.Queue
Then tickets.QueueResult.waiting holds "TASK-901" and tickets.QueueResult.blocked does not (R3)
And cli.CommandResult.stdout holds "## Waiting (1)" followed by the lines "- TASK-901 task · After BUG-301" and "  waits for BUG-301, which is open" (R3)

### S4: No Waiting section when nothing waits
Given no ticket waits only for other tickets
When the developer runs `spec queue` through tickets.Queue
Then cli.CommandResult.stdout has no "## Waiting" line (R2)

### S5: A ticket blocked by a person and a dependency is Blocked
Given "TASK-941" depends on "BUG-301", which is open, and has an open blocker question Q1 "Which name?"
When the developer runs `spec queue` through tickets.Queue
Then tickets.QueueResult.blocked holds "TASK-941" with tickets.QueueEntry.reason "question TASK-941#Q1: Which name?" (R3)

### S6: Done tickets are counted, not listed
Given three tickets are done
When the developer runs `spec queue` through tickets.Queue
Then cli.CommandResult.stdout ends with the line "Done: 3" and lists none of them

### S7: A ticket file that does not parse
Given "tickets/TASK-942.md" does not parse, because its tickets.Ticket.type is "chore"
When the developer runs `spec queue` through tickets.Queue
Then tickets.QueueResult.blocked holds tickets.QueueEntry id "TASK-942", type "unknown", title "(does not parse)", and a reason that starts "schema TASK-942: type: Invalid option" (R4)

### S8: A ticket whose reviews went round too often
Given "TASK-943" is open and its history ends with three reviewer stages that asked for changes
When the developer runs `spec queue` through tickets.Queue
Then tickets.QueueResult.blocked holds "TASK-943" with tickets.QueueEntry.reason "the reviewer asked for changes 3 times; a person must decide"

### S9: The output is capped
Given 400 ready tickets with long titles, so the full list is over 10,000 characters
When the developer runs `spec queue` through tickets.Queue
Then cli.CommandResult.stdout is at most 10,000 characters (R5)
And it shows as many tickets as fit, in group order, then the line "… <n> more tickets not shown (capped at 10000 characters); run spec queue --format json for all", where n is how many it left out (R5)
And running it again prints the same text

### S10: The JSON result is never capped
Given 400 ready tickets
When the developer runs `spec queue --format json` through tickets.Queue
Then cli.CommandResult.stdout is a tickets.QueueResult whose tickets.QueueResult.ready holds all 400, each a tickets.QueueEntry with tickets.QueueEntry.stage the next stage and tickets.QueueEntry.reason null

### S11: The queue takes no arguments
Given the store holds "TASK-101"
When the developer runs `spec queue TASK-101` through tickets.Queue
Then the command fails with cli.UsageError, and cli.CommandResult.stderr starts "usage: spec queue"
And cli.CommandResult.exitCode is 2

### S12: Absorbed tickets are left out
Given "PROP-202" and "PROP-205" are absorbed into "PROP-201", which is open and ready, and no ticket is done
When the developer runs `spec queue --format json` through tickets.Queue
Then no list of the tickets.QueueResult holds "PROP-202" or "PROP-205", tickets.QueueResult.ready holds "PROP-201", and tickets.QueueResult.done is 0 (R6)

## Rules
- R1: Each group lists its tickets in natural ID order: ready as `- <ID> <type> · next <stage> · <title>`, in progress as `- <ID> <type> · stage <stage> · <title>`, waiting and blocked as `- <ID> <type> · <title>` then the reason indented by two spaces
- R2: The output starts `# Queue · <spec version>`, lists Ready, Waiting, Blocked and In progress, each headed `## <name> (<count>)` with "None" when empty, except Waiting, which appears only when a ticket waits; it ends `Done: <count>`
- R3: A ticket refused only by dependencies is Waiting, with every dependency reason joined by "; "; one with any other blocker is Blocked, with its first blocker as `<kind> <id>: <text>`
- R4: A ticket file that does not parse is Blocked on its first schema error
- R5: The text output is at most 10,000 characters: when the tickets do not all fit, it keeps the most that do and says how many it left out ("ticket" when one)
- R6: An absorbed ticket is in no group and is not counted as done

## Out of scope
- Which ready tickets may run at the same time (TKT-011)
- Injecting the queue at session start: install (the harness hooks)
