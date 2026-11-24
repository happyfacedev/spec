---
id: GRF-008
title: Reach of a change to a contract or member
module: graph
status: active
writes: [graph.Impact.mustChange, graph.Impact.reverify]
---
## Intent
Contracts are where features meet, so a change to one reaches exactly the features linked to it. A feature that writes, emits or provides the contract must change with it; one that reads, consumes, calls or observes it must be checked again. A link to one member is narrow: it is reached by changes to that member or to the whole contract, never by a sibling member. A change to a type reaches every contract typed by it, and the invariants and screens that rest on the contract come along.

## Behaviour
### S1: The emitter must change, the consumer re-verifies
Given the "chat-mini" fixture spec, where "PRV-001" emits "providers.RateLimited" in "PRV-001/S2" and "PRV-002" consumes it in all four scenarios
When the developer runs spec impact "providers.RateLimited" through graph.ComputeImpact
Then graph.Impact.mustChange is "PRV-001" via "emits providers.RateLimited" with scenarios "PRV-001/S2" (R1)
And graph.Impact.reverify is "PRV-002" via "consumes providers.RateLimited" with scenarios "PRV-002/S1" to "PRV-002/S4"

### S2: A member reaches its writers and the readers of the whole contract
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "conversation.Message.meta" through graph.ComputeImpact
Then graph.Impact.mustChange is "CNV-002" with scenarios "CNV-002/S2", and "PRV-002" with scenarios "PRV-002/S1" to "PRV-002/S4" (R1, R2)
And graph.Impact.reverify is exactly one item, "CNV-003" via "reads conversation.Message (whole)" with scenarios "CNV-003/S1" and "CNV-003/S2"

### S3: A sibling member is not reached
Given the "chat-mini" fixture spec, where "PRV-003" writes "conversation.Message.usage" and "CNV-002" and "PRV-002" write "conversation.Message.meta"
When the developer runs spec impact "conversation.Message.usage" through graph.ComputeImpact
Then graph.Impact.mustChange is "PRV-003" alone, with scenarios "PRV-003/S1" (R2)
And graph.Impact.reverify is "CNV-003" alone

### S4: A whole contract reaches the writers of every member
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "conversation.Message" through graph.ComputeImpact
Then graph.Impact.mustChange is "CNV-001", "CNV-002", "PRV-001", "PRV-002" and "PRV-003", in that order (R2)

### S5: Only the scenarios that cite it are reached
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "providers.ProviderConfig" through graph.ComputeImpact
Then graph.Impact.mustChange is "SET-001" via "reads providers.ProviderConfig" and "writes providers.ProviderConfig", with scenarios "SET-001/S1", "SET-001/S2" and "SET-001/S3"
And graph.Impact.reverify holds "CNV-001" with scenarios "CNV-001/S1" and "CNV-001/S2", "PRV-001" with "PRV-001/S1" to "PRV-001/S3", "PRV-002" with "PRV-002/S1" to "PRV-002/S4", and "PRV-003" with "PRV-003/S1": each item's scenarios are those citing the contract or one of its members

### S6: An invariant that applies to it re-verifies, with the scenarios that show it
Given the "chat-mini" fixture spec, where "INV-001" applies to "providers.ProviderConfig.enabled" and is shown by "CNV-001/S2", "SET-001/S2", and "PRV-002/S4" through the rule "PRV-002/R1"
When the developer runs spec impact "providers.ProviderConfig" through graph.ComputeImpact
Then graph.Impact.reverify holds "INV-001" via "INV-001 applies to providers.ProviderConfig.enabled" with scenarios "CNV-001/S2", "PRV-002/S4" and "SET-001/S2" (R4)

### S7: A type reaches every contract typed by it
Given the "chat-mini" fixture spec, where "conversation.Message.meta" is typed "conversation.DeliveryMeta"
When the developer runs spec impact "conversation.DeliveryMeta" through graph.ComputeImpact
Then graph.Impact.mustChange is "CNV-002" and "PRV-002", each via "writes conversation.Message.meta (uses conversation.DeliveryMeta)" (R3)
And graph.Impact.reverify is "CNV-003" via "reads conversation.Message (whole) (uses conversation.DeliveryMeta)"

### S8: A type reached through a whole contract
Given contract "alpha.Widget" has the member "alpha.Widget.size" typed "alpha.Size", feature "ALP-001" writes "alpha.Widget", and feature "BET-001" reads "alpha.Widget.size"
When the developer runs spec impact "alpha.Size" through graph.ComputeImpact
Then graph.Impact.mustChange is "ALP-001" via "writes alpha.Widget (whole) (uses alpha.Size)" (R3)
And graph.Impact.reverify is "BET-001" via "reads alpha.Widget.size (uses alpha.Size)"

### S9: An operation's provider must change, its callers re-verify
Given feature "ALP-001" provides the operation "alpha.MakeWidget" and feature "BET-001" calls it in its When
When the developer runs spec impact "alpha.MakeWidget" through graph.ComputeImpact
Then graph.Impact.mustChange is "ALP-001" and graph.Impact.reverify is "BET-001" (R1)

### S10: An observer re-verifies
Given feature "BET-001" observes "alpha.Widget.size" and "alpha.WidgetMade" in "BET-001/S1", and its code uses neither
When the developer runs spec impact "alpha.Widget.size" through graph.ComputeImpact
Then graph.Impact.reverify is exactly one item, "BET-001" via "observes alpha.Widget.size" with scenarios "BET-001/S1" (R1)

### S11: A screen that shows it re-verifies, with no scenarios
Given screen "UI-001" shows "alpha.Widget.size"
When the developer runs spec impact "alpha.Widget.size" through graph.ComputeImpact
Then graph.Impact.reverify holds "UI-001" via "UI-001 shows alpha.Widget.size" with no scenarios (R4)

### S12: A deprecated feature is still reached
Given feature "BET-001" reads "alpha.Widget.size", and is deprecated
When the developer runs spec impact "alpha.Widget.size" through graph.ComputeImpact
Then graph.Impact.reverify is "BET-001" (R4)

### S13: A removed feature is not reached
Given feature "BET-001" reads "alpha.Widget.size", and is removed
When the developer runs spec impact "alpha.Widget.size" through graph.ComputeImpact
Then graph.Impact.reverify holds no "BET-001" (R4)

## Rules
- R1: A feature that writes, emits or provides the contract must change, and lists every link it has to it; one that only reads, consumes, calls or observes it re-verifies.
- R2: A member and its whole contract reach each other; two different members never do. A link to the whole contract that reaches a member says "(whole)".
- R3: A contract or member typed by the target, directly or through another, is reached as the target is, and each path says "(uses <target>)".
- R4: Only units that are not removed are reached: features, invariants and screens. An invariant re-verifies with the scenarios that show it, citing it or a rule that cites it; a screen re-verifies with none.

## Out of scope
- Reaching features through a contract's description: only `Type:` and `Output:` link
