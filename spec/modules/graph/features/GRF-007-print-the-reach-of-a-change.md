---
id: GRF-007
title: Print the reach of a change
module: graph
status: active
provides: [graph.ComputeImpact]
writes: [graph.Impact]
observes: [cli.InvalidDepth]
invariants: [INV-005]
---
## Intent
`spec impact <ID|TICKET>` says, from the spec files alone, what a change reaches before anyone writes it: the features it changes, what must change with them, what must be checked again, and the exact scenarios whose tests are affected. It prints two rings, must change and re-verify, plus the scope gaps of a ticket, as text for a person or as JSON for a tool. What each ring holds for each kind of target is in GRF-008 to GRF-012.

## Behaviour
### S1: The text layout
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "providers.RateLimited" through graph.ComputeImpact
Then stdout is, line by line:
| line |
| "# Impact · providers.RateLimited · <the spec version>" |
| an empty line |
| "## Must change (1)" |
| "- PRV-001 Stream a reply from the active provider" |
| "  via: emits providers.RateLimited" |
| "  scenarios: PRV-001/S2" |
| an empty line |
| "## Re-verify (1)" |
| "- PRV-002 Fall back when a provider rate-limits" |
| "  via: consumes providers.RateLimited" |
| "  scenarios: PRV-002/S1, PRV-002/S2, PRV-002/S3, PRV-002/S4" |
| an empty line |
| "## Scope gaps (0)" |
| "None" |
And graph.Impact.mustChange and graph.Impact.reverify are the two rings it shows
And the command exits 0

### S2: An empty ring says None
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "UI-001" through graph.ComputeImpact
Then graph.Impact.reverify is empty, and stdout holds "## Re-verify (0)" followed by the line "None"

### S3: An item with no scenarios has no scenarios line
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "ADR-002" through graph.ComputeImpact
Then stdout holds "- providers.ProviderConfig The provider settings of one workspace: which provider is active, which are enabled, and the optional fallback." followed directly by "  via: decisions ADR-002" and then an empty line

### S4: A member is titled by its description line
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "TASK-102" through graph.ComputeImpact
Then stdout holds the item line "- conversation.Message.content The text of the message. Type: string"

### S5: Several paths are joined
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "providers.ProviderConfig" through graph.ComputeImpact
Then stdout holds "  via: reads providers.ProviderConfig; writes providers.ProviderConfig", the paths sorted and joined by "; "

### S6: The reach as JSON
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "UI-001" --format json through graph.ComputeImpact
Then stdout is graph.Impact as one JSON document, with its keys in this order:
```json
{
  "target": "UI-001",
  "spec": "<the spec version>",
  "holds": false,
  "changed": [],
  "mustChange": [
    { "id": "PRV-002", "via": ["PRV-002/S1 cites UI-001", "ui UI-001"], "scenarios": ["PRV-002/S1"] }
  ],
  "reverify": [],
  "scopeGaps": [],
  "unresolved": []
}
```
And no item has a "depth" key

### S7: The same reach every time
Given the "chat-mini" fixture spec and tickets
When the developer runs spec impact through graph.ComputeImpact for every contract, member, feature, invariant, decision, screen and ticket, twice
Then graph.Impact is byte-identical both times, as JSON (INV-005, R1)

### S8: A module is not a target
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "providers" through graph.ComputeImpact
Then the command fails with graph.NotAnImpactTarget
And stderr starts with "impact takes a feature, scenario, rule, contract, field, invariant, decision, screen or ticket, not module providers", and the command exits 2

### S9: An unknown unit, with the closest known one
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "PRV-009" through graph.ComputeImpact
Then the command fails with graph.UnknownId
And stderr starts with "Unknown PRV-009. Did you mean PRV-001?", then a blank line and the usage text, and the command exits 2

### S10: An unknown ticket
Given the "chat-mini" fixture tickets hold no "TASK-999"
When the developer runs spec impact "TASK-999" through graph.ComputeImpact
Then the command fails with graph.UnknownId, stderr starts with "Unknown TASK-999.", and the command exits 2

### S11: A question ID is not a target
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "Q1" through graph.ComputeImpact
Then the command fails with graph.UnknownId, and stderr starts with "Unknown Q1."

### S12: No target, or two
Given the "chat-mini" fixture spec is the spec root
When the developer runs "spec impact" with no target, or spec impact "PRV-001" "PRV-002", through graph.ComputeImpact
Then the command fails with cli.UsageError
And stderr starts with "usage: spec impact <ID|TICKET> [--depth n]", and the command exits 2

### S13: A depth below 1 is refused
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "PRV-001" --depth 0 through graph.ComputeImpact
Then the command fails with cli.InvalidDepth
And stderr starts with "--depth is a whole number of 1 or more", and the command exits 2

### S14: A depth that is not a number is refused
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec impact "PRV-001" --depth x through graph.ComputeImpact
Then the command fails with cli.InvalidDepth, and the command exits 2

## Rules
- R1: Impact is computed from the spec files alone, and the same files always give the same output: rings, items, paths and scenarios in a fixed order (INV-005).

## Out of scope
- Whether a ticket may start: tickets (`spec gate`)
- Running the affected tests: pipeline (`spec test`)
