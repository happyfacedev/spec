---
id: GRF-001
title: Build the generated files
module: graph
status: active
provides: [graph.Build]
writes: [graph.Index, graph.Graph, graph.BuildSummary]
---
## Intent
`spec build` turns the spec files into the two generated files: `index.md`, the committed map of modules and features, and `_generated/graph.json`, the whole graph for people and other tools. It rewrites a file only when its content changed, so an unchanged spec leaves both files alone, and it refuses to write anything from a spec it cannot parse.

## Behaviour
### S1: A first build writes both files
Given the "chat-mini" fixture spec is the spec root, with no "index.md" and no "_generated" folder
When the developer runs "spec build" through graph.Build
Then graph.Graph is written to "_generated/graph.json" and graph.Index to "index.md" under the spec root (R2)
And stdout is three lines: the spec version followed by ": 54 nodes, 61 edges, 19 scenarios", then "wrote _generated/graph.json", then "wrote index.md"
And the command exits 0

### S2: A second build writes nothing
Given the "chat-mini" fixture spec has just been built
When the developer runs "spec build" through graph.Build again
Then neither graph.Graph nor graph.Index is rewritten (R2)
And stdout is the spec version followed by ": 54 nodes, 61 edges, 19 scenarios", then the line "up to date"
And the command exits 0

### S3: Only the file whose content changed is written
Given the "chat-mini" fixture spec has just been built
And the text of one scenario step has since changed, while no module, feature title or feature status has
When the developer runs "spec build" through graph.Build
Then graph.Graph is rewritten, since its spec version changed, and graph.Index is not (R2)
And stdout ends with the single line "wrote _generated/graph.json"

### S4: The summary as JSON
Given the "chat-mini" fixture spec has just been built
When the developer runs "spec build --format json" through graph.Build
Then stdout is one JSON document, and graph.BuildSummary.written is empty:
```json
{
  "spec": "<the spec version>",
  "written": [],
  "nodes": 54,
  "edges": 61,
  "scenarios": 19
}
```
And the command exits 0

### S5: A spec that does not parse stops the build
Given the "chat-mini" fixture spec has just been built
And the frontmatter of "modules/settings/features/SET-002-manage-api-keys.md" is "id: SET-002" then "title: [broken"
When the developer runs "spec build" through graph.Build
Then the build fails with graph.SpecDoesNotParse, and neither graph.Graph nor graph.Index is written (R1)
And stderr starts with the line "build stopped: the spec does not parse"
And the next line is "modules/settings/features/SET-002-manage-api-keys.md:3 error L001: invalid YAML: Flow sequence in block collection must be sufficiently indented and end with a ]"
And stdout is empty and the command exits 1

### S6: The parse failure as JSON
Given the frontmatter of "modules/settings/features/SET-002-manage-api-keys.md" in the "chat-mini" fixture spec is "id: SET-002" then "title: [broken"
When the developer runs "spec build --format json" through graph.Build
Then stdout is one JSON document with the keys "spec", "written" and "findings", in that order (R1)
And "written" is empty, and graph.SpecDoesNotParse.findings holds only parse errors, the first with "rule" "L001", "severity" "error", "file" "modules/settings/features/SET-002-manage-api-keys.md" and "line" 3
And stderr is empty and the command exits 1

### S7: Lint errors that are not parse errors do not stop the build
Given the "chat-mini" fixture spec, where "modules/settings/features/SET-002-manage-api-keys.md" writes "settings.Nope", which no contract defines
When the developer runs "spec build" through graph.Build
Then graph.Graph and graph.Index are written, and the command exits 0
But "spec lint" on the same spec still exits 1

## Rules
- R1: A build that cannot parse the spec writes nothing, and exits 1.
- R2: Each generated file is written only when its content differs from what is on disk.

## Out of scope
- What `index.md` holds: GRF-002
- What `graph.json` holds: GRF-003
- Checking that the committed `index.md` is fresh: `spec lint --ci`
