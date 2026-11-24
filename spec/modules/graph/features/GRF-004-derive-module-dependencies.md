---
id: GRF-004
title: Derive module dependencies from contract use
module: graph
status: active
writes: [graph.Graph.edges]
---
## Intent
Which module depends on which is never written by hand, because a hand-kept list drifts from what the features say. `spec build` derives it from the contracts each module's features use, and lists each dependency as a `depends_on` edge in `graph.json`. Only what a feature's code uses counts: a contract its tests only set up or check (`observes`) is no dependency of the code.

## Behaviour
### S1: The fixture's dependencies
Given the "chat-mini" fixture spec is the spec root
When the developer runs "spec build" through graph.Build
Then the edges of kind "depends_on" in graph.Graph.edges are exactly, in this order:
| from | to |
| conversation | providers |
| providers | conversation |
| providers | settings |
| settings | providers |

### S2: Reading another module's contract is a dependency
Given module "alpha" defines "alpha.Widget.size", and feature "BET-001" of module "beta" reads it in a Given
When the developer runs "spec build" through graph.Build
Then graph.Graph.edges holds the edge from "beta" to "alpha" of kind "depends_on" (R1)

### S3: Each dependency is listed once
Given feature "BET-001" of module "beta" reads "alpha.Widget.size" and consumes "alpha.WidgetMade", and feature "BET-002" of module "beta" also reads "alpha.Widget.size"
When the developer runs "spec build" through graph.Build
Then graph.Graph.edges holds exactly one edge from "beta" to "alpha" of kind "depends_on"

### S4: A contract only observed is no dependency
Given feature "BET-001" of module "beta" lists "alpha.Widget.size" and "alpha.WidgetMade" under observes, and uses no other contract of "alpha"
When the developer runs "spec build" through graph.Build
Then graph.Graph.edges holds no edge of kind "depends_on" (R1)

### S5: A module's own contracts are no dependency
Given every contract the features of module "alpha" use is defined in "alpha"
When the developer runs "spec build" through graph.Build
Then graph.Graph.edges holds no "depends_on" edge from "alpha" (R1)

### S6: A removed feature adds none
Given the only feature of module "beta" that reads a contract of "alpha" is "BET-001", and it is removed
When the developer runs "spec build" through graph.Build
Then graph.Graph.edges holds no edge from "beta" to "alpha" of kind "depends_on" (R1)

### S7: A deprecated feature still does
Given the only feature of module "beta" that reads a contract of "alpha" is "BET-001", and it is deprecated
When the developer runs "spec build" through graph.Build
Then graph.Graph.edges holds the edge from "beta" to "alpha" of kind "depends_on" (R1)

### S8: Calling an external system's operation is a dependency on it
Given module "pay" is external, and feature "BET-001" of module "beta" calls "pay.Charge" in its When
When the developer runs "spec build" through graph.Build
Then graph.Graph.edges holds the edge from "beta" to "pay" of kind "depends_on" (R1)

## Rules
- R1: Module A depends on module B when a feature of A that is not removed reads, writes, emits, consumes, provides or calls a contract or member of B. `observes` does not count.

## Out of scope
- A `depends_on:` list written in `_module.md`: lint refuses it as format 1
- Ticket dependencies (`depends_on` on a ticket): tickets
