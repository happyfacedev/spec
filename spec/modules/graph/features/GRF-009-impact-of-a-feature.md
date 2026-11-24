---
id: GRF-009
title: Reach of a change to a feature, scenario or rule
module: graph
status: active
writes: [graph.Impact.changed, graph.Impact.mustChange, graph.Impact.reverify]
---
## Intent
Changing a feature changes what it produces: the contracts it writes, the events and errors it emits, and the operations it provides. Those must change with it, and every other feature or screen that uses them must be checked again. A scenario or a rule is changed through its feature, so it reaches exactly what its feature reaches.

## Behaviour
### S1: The feature is changed
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "PRV-001" through graph.ComputeImpact
Then graph.Impact.changed is ["PRV-001"]
And stdout holds the line "Changed: PRV-001" after the heading and an empty line

### S2: What it produces must change, with the scenarios that cite each
Given the "chat-mini" fixture spec, where "PRV-001" writes "conversation.Message.content", emits "providers.RateLimited" and "providers.TokenStreamed", and provides "providers.StreamReply"
When the developer runs spec impact "PRV-001" through graph.ComputeImpact
Then graph.Impact.mustChange is, in order (R1):
| id | via | scenarios |
| "conversation.Message.content" | "PRV-001 writes conversation.Message.content" | "PRV-001/S1", "PRV-001/S2" |
| "providers.RateLimited" | "PRV-001 emits providers.RateLimited" | "PRV-001/S2" |
| "providers.StreamReply" | "PRV-001 provides providers.StreamReply" | "PRV-001/S1" |
| "providers.TokenStreamed" | "PRV-001 emits providers.TokenStreamed" | "PRV-001/S1" |

### S3: Features that use what it produces re-verify
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "PRV-001" through graph.ComputeImpact
Then graph.Impact.reverify is, in order (R2):
| id | scenarios |
| "CNV-001" | "CNV-001/S1" |
| "CNV-002" | "CNV-002/S1" |
| "CNV-003" | "CNV-003/S1", "CNV-003/S2" |
| "PRV-002" | "PRV-002/S1", "PRV-002/S2", "PRV-002/S3", "PRV-002/S4" |
And "CNV-001" is reached because it calls "providers.StreamReply", which "PRV-001" provides

### S4: A screen that shows what it produces re-verifies
Given the "chat-mini" fixture spec, where "PRV-002" emits "providers.FallbackTriggered" and screen "UI-001" shows it
When the developer runs spec impact "PRV-002" through graph.ComputeImpact
Then graph.Impact.reverify holds "UI-001" via "UI-001 shows providers.FallbackTriggered", with no scenarios (R2)

### S5: Readers of a contract typed by what it writes re-verify
Given the "chat-mini" fixture spec, changed so that "PRV-002" writes the members "conversation.DeliveryMeta.fallbackFrom", "conversation.DeliveryMeta.stopReason" and "conversation.DeliveryMeta.retryAfterMs", and "conversation.Message.meta" is typed "conversation.DeliveryMeta"
When the developer runs spec impact "PRV-002" through graph.ComputeImpact
Then graph.Impact.reverify holds "CNV-003" via "reads conversation.Message (whole) (uses conversation.DeliveryMeta.fallbackFrom)" (R2)

### S6: A scenario reaches what its feature reaches
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "PRV-002/S3" through graph.ComputeImpact
Then graph.Impact is the same as for spec impact "PRV-002", but for graph.Impact.target, which is "PRV-002/S3" (R3)

### S7: A rule reaches what its feature reaches
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "PRV-002/R1" through graph.ComputeImpact
Then graph.Impact.changed is ["PRV-002"], and graph.Impact is the same as for spec impact "PRV-002" but for its target (R3)

## Rules
- R1: A feature's outputs, what it writes, emits or provides, must change, each with the feature's scenarios that cite it.
- R2: A feature, other than the changed one, that reads, consumes, calls or observes an output, or a contract typed by one, re-verifies; so does a screen that shows or calls an output.
- R3: A scenario or rule is changed through its feature.

## Out of scope
- Reaching only the scenarios of the changed scenario: its whole feature is changed
