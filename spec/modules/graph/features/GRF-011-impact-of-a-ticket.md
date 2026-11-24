---
id: GRF-011
title: Reach of a ticket
module: graph
status: active
writes: [graph.Impact]
---
## Intent
Before a ticket starts, `spec impact <TICKET>` shows what the whole ticket reaches: the reach of every unit in its scope, merged, with the features it names marked as changed. It also lists the scope gaps, features that produce a contract the ticket touches but that the ticket does not name, and the IDs in its scope that name nothing. A task changes no behaviour, so for a task the inner ring is what must keep holding rather than what must change.

## Behaviour
### S1: A task's features are reworked, and what they produce must hold
Given the "chat-mini" fixture ticket "TASK-102", a task that touches "conversation.Message.meta", "PRV-002" and "CNV-002"
When the developer runs spec impact "TASK-102" through graph.ComputeImpact
Then graph.Impact.changed is ["CNV-002", "PRV-002"] and graph.Impact.holds is true (R3)
And stdout holds, after the heading, "Reworked: CNV-002, PRV-002", an empty line, "A task changes no behaviour: everything below must hold exactly as it is.", an empty line and "## Must hold (3)"

### S2: The rings of a task
Given the "chat-mini" fixture ticket "TASK-102"
When the developer runs spec impact "TASK-102" through graph.ComputeImpact
Then graph.Impact.mustChange is, in order (R2):
| id | scenarios |
| "conversation.Message.content" | "CNV-002/S1" |
| "conversation.Message.meta" | "CNV-002/S2", "PRV-002/S1", "PRV-002/S2", "PRV-002/S3", "PRV-002/S4" |
| "providers.FallbackTriggered" | "PRV-002/S1" |
And graph.Impact.reverify is "CNV-003" with scenarios "CNV-003/S1" and "CNV-003/S2", then "UI-001" with none
And neither ring holds "CNV-002" or "PRV-002", though both write the touched member (R2)

### S3: A bug changes the feature of the scenario it violates
Given the "chat-mini" fixture ticket "BUG-301", a bug that violates "PRV-002/S3" and touches nothing
When the developer runs spec impact "BUG-301" through graph.ComputeImpact
Then graph.Impact.changed is ["PRV-002"] and graph.Impact.holds is false (R1)
And stdout holds "Changed: PRV-002" and "## Must change (2)"

### S4: A proposal's scope gap
Given a proposal "PROP-900" that touches "providers.ProviderConfig.enabled" and "PRV-001", where "SET-001", which is not in its scope, writes "providers.ProviderConfig"
When the developer runs spec impact "PROP-900" through graph.ComputeImpact
Then graph.Impact.scopeGaps is [{ "id": "SET-001", "text": "SET-001 writes providers.ProviderConfig: add it to touches" }] (R4)
And stdout holds "## Scope gaps (1)" followed by "- SET-001 writes providers.ProviderConfig: add it to touches"

### S5: A scenario in scope puts its feature in scope
Given a proposal "PROP-901" that touches "providers.ProviderConfig" and "SET-001/S3"
When the developer runs spec impact "PROP-901" through graph.ComputeImpact
Then graph.Impact.scopeGaps is empty and graph.Impact.changed is ["SET-001"] (R1, R4)

### S6: IDs that name nothing are reported
Given a task "TASK-900" that touches "PRV-099" and "providers.Ghost", neither of which exists
When the developer runs spec impact "TASK-900" through graph.ComputeImpact
Then graph.Impact.unresolved is ["PRV-099", "providers.Ghost"]
And stdout ends with an empty line and "Unresolved: PRV-099, providers.Ghost"
And the command exits 0

### S7: A ticket with an empty scope
Given the "chat-mini" fixture ticket "BUG-302", which touches, violates and lists as changed nothing
When the developer runs spec impact "BUG-302" through graph.ComputeImpact
Then graph.Impact.changed, graph.Impact.mustChange, graph.Impact.reverify, graph.Impact.scopeGaps and graph.Impact.unresolved are all empty
And stdout holds no "Changed:" line, and "None" under each of its three sections

### S8: What the ticket lists as changed counts as scope
Given a proposal "PROP-902" that touches nothing and lists "PRV-001" under changed
When the developer runs spec impact "PROP-902" through graph.ComputeImpact
Then graph.Impact.changed is ["PRV-001"] (R1)

## Rules
- R1: A ticket's scope is its touches, violates and changed, in that order. Its changed features are the features it names, and the features of the scenarios and rules it names.
- R2: The rings of a ticket are the merged reach of every unit in its scope. A changed feature leaves both rings, and a unit in both rings stays only under must change.
- R3: For a task, `holds` is true, the changed features are "Reworked" and the inner ring is "Must hold".
- R4: A feature that is not removed and not in scope, but writes, emits or provides a contract or member the ticket touches or lists as changed, is a scope gap: "<feature> <link> <contract>: add it to touches".

## Out of scope
- Refusing to start a ticket with scope gaps: tickets (`spec gate`)
- Tickets that depend on each other: tickets (`spec plan`)
