---
id: GRF-012
title: Follow the reach deeper with --depth
module: graph
status: active
writes: [graph.Impact.reverify]
---
## Intent
Contracts are the boundary: by default impact stops at the features that use what changes. With `--depth n`, it follows those features' own outputs to their users, step by step, up to n steps, and marks each re-verify item with the step it was first reached at. The inner ring never grows: what is followed only needs checking again.

## Behaviour
### S1: Depth 1 stops at direct consumers
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "providers.RateLimited" through graph.ComputeImpact
Then graph.Impact.reverify is exactly "PRV-002" (R1)

### S2: Depth 2 follows their outputs
Given the "chat-mini" fixture spec, where "PRV-002" consumes "providers.RateLimited", writes "conversation.Message.meta" and emits "providers.FallbackTriggered"
When the developer runs spec impact "providers.RateLimited" --depth 2 through graph.ComputeImpact
Then graph.Impact.reverify is, in order (R1, R2):
| id | depth | via |
| "CNV-003" | 2 | "reads conversation.Message (whole) (from PRV-002)" |
| "PRV-002" | 1 | "consumes providers.RateLimited" |
| "UI-001" | 2 | "UI-001 shows providers.FallbackTriggered (from PRV-002)" |
And graph.Impact.mustChange is the same as at depth 1

### S3: The depth in text
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "providers.RateLimited" --depth 2 through graph.ComputeImpact
Then stdout holds "## Re-verify (3)", then "- CNV-003 Export a conversation to Markdown [depth 2]", and "- PRV-002 Fall back when a provider rate-limits [depth 1]"
And the item lines under "## Must change (1)" carry no depth

### S4: An item is never added twice, nor once it is in the inner ring
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "PRV-001" --depth 5 through graph.ComputeImpact
Then every ID in graph.Impact.reverify appears once, and none is in graph.Impact.mustChange or graph.Impact.changed (R3)
And "CNV-001", which calls the "providers.StreamReply" that "PRV-001" provides, has depth 1

### S5: Depth 1 written out is the default
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "PRV-001" --depth 1 --format json through graph.ComputeImpact
Then stdout is the same as for spec impact "PRV-001" --format json, and no item in graph.Impact.reverify has a "depth" key

## Rules
- R1: At depth n above 1, the re-verify ring also holds, for each step from 2 to n, the features and screens that use the outputs of the features first reached at the step before, each with "(from <feature>)" on its path.
- R2: Every re-verify item carries the smallest step it was reached at, but only when the depth is above 1.
- R3: A deeper step never adds a unit already in either ring, or a changed feature.

## Out of scope
- Following invariants, decisions or screens deeper: only features' outputs are followed
- Growing the inner ring: what is reached deeper only re-verifies
