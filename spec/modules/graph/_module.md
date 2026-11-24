---
id: graph
prefix: GRF
domain: authoring
status: active
---
The spec as a graph of units and links, and the commands that read it: `build`, `show`, `find` and `impact`.

## Owns
- `spec build`: `index.md` (committed) and `_generated/graph.json` (ignored)
- `spec show <ID>`, `spec find <words>`
- `spec impact <ID|TICKET> [--depth n]`: what must change, what must be re-verified, which scenarios are affected
- Module dependencies, derived from the contracts features use

## Non-goals
- Deciding whether a ticket may start: tickets (`gate`)
