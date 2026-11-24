---
id: TKT-009
title: A ticket waits for the tickets it depends on
module: tickets
status: active
---
## Intent
A ticket can name tickets whose work must land first. It waits until each is done and its branch is merged into the base branch. Waiting on another ticket needs no person: it clears by itself, so the queue and the plan show it apart from tickets a person must unblock.

## Behaviour
### S1: The dependency is open
Given "TASK-901" has tickets.Ticket.depends_on ["BUG-301"], and "BUG-301" is open
When the developer runs `spec gate TASK-901` through tickets.Gate
Then tickets.GateResult.blockers is exactly one tickets.GateBlocker: kind "dependency", id "BUG-301", text "waits for BUG-301, which is open" (R1)

### S2: The dependency is in progress
Given "TASK-901" depends on "BUG-301", which is in_progress
When the developer runs `spec gate TASK-901` through tickets.Gate
Then tickets.GateResult.blockers holds kind "dependency", id "BUG-301", text "waits for BUG-301, which is in progress" (R1)

### S3: Done, but its branch is not merged
Given "TASK-901" depends on "BUG-301", which is done, and branch "ticket/BUG-301" exists and is not merged into the base branch
When the developer runs `spec gate TASK-901` through tickets.Gate
Then tickets.GateResult.blockers holds kind "dependency", id "BUG-301", text "waits for BUG-301: it is done, but ticket/BUG-301 is not merged into the base branch yet" (R1)

### S4: Done and merged
Given "TASK-901" depends on "BUG-301", which is done, and branch "ticket/BUG-301" is merged into the base branch
When the developer runs `spec gate TASK-901` through tickets.Gate
Then tickets.GateResult.blockers is empty (R1)

### S5: Done, with no branch
Given "TASK-901" depends on "BUG-301", which is done, and there is no branch "ticket/BUG-301"
When the developer runs `spec gate TASK-901` through tickets.Gate
Then tickets.GateResult.blockers is empty (R1)

### S6: A dependency that is not a ticket, with a suggestion
Given the store holds "TASK-101" and no "TASK-1010"
And "TASK-939" depends on "TASK-1010"
When the developer runs `spec gate TASK-939` through tickets.Gate
Then tickets.GateResult.blockers holds kind "unresolved", id "TASK-1010", text "depends_on TASK-1010, which is not a ticket; did you mean TASK-101?" (R2)

### S7: The base branch is the config's
Given `spec/config.json` sets "baseBranch" to "trunk", and "BUG-301" is done with its branch merged into "trunk" but not into "main"
And "TASK-901" depends on "BUG-301"
When the developer runs `spec gate TASK-901` through tickets.Gate
Then tickets.GateResult.blockers is empty

### S8: lint names bad dependencies
Given "TASK-911" depends on "TASK-912" and "TASK-999", "TASK-912" depends on "TASK-911", and there is no "TASK-999"
When `spec lint` reads the store
Then it reports findings with lint.Finding.rule "L020" and these lint.Finding.message values (R3):
| message |
| depends_on TASK-999, which is not a ticket |
| TASK-911 depends on itself through depends_on |
| TASK-912 depends on itself through depends_on |

### S9: A ticket that depends on itself
Given "TASK-940" has tickets.Ticket.depends_on ["TASK-940"]
When `spec lint` reads the store
Then it reports a finding with lint.Finding.rule "L020", lint.Finding.message "TASK-940 depends on itself" and lint.Finding.fix "remove it from depends_on" (R3)

## Rules
- R1: A dependency is met once its ticket is done and its work is in the base branch: its branch `ticket/<ID>` is merged into the base branch, or it never had one
- R2: Every ID in depends_on is a ticket in the store
- R3: depends_on never names the ticket itself, directly or through a cycle

## Out of scope
- How the queue and the plan show a ticket that only waits (TKT-010, TKT-011)
- Merging: workspace
