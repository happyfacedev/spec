---
id: GRF-003
title: Write graph.json, the whole graph
module: graph
status: active
writes: [graph.Graph]
invariants: [INV-005]
---
## Intent
`_generated/graph.json` holds the whole spec as data: every unit with its file and line, every link, every scenario with what it cites, every question and every glossary term with the features that use it. It is for people and other tools; no command reads it back, and git ignores it. The same spec files always give the same bytes, so two builds can be compared.

## Behaviour
### S1: The top-level keys
Given the "chat-mini" fixture spec is the spec root
When the developer runs "spec build" through graph.Build
Then graph.Graph is one JSON object with the keys "spec", "nodes", "edges", "scenarios", "questions" and "terms", in that order
And graph.Graph.spec is "spec@" followed by 8 lowercase hex digits

### S2: A contract node
Given the "chat-mini" fixture spec is the spec root
When the developer runs "spec build" through graph.Build
Then graph.Graph.nodes holds, with its keys in this order:
```json
{
  "id": "conversation.DeliveryMeta",
  "type": "contract",
  "kind": "type",
  "module": "conversation",
  "title": "How a reply was delivered. A member that does not apply is left out.",
  "status": "active",
  "file": "modules/conversation/contracts.md",
  "line": 24
}
```

### S3: A rule node takes its feature's module and status
Given the "chat-mini" fixture spec is the spec root
When the developer runs "spec build" through graph.Build
Then graph.Graph.nodes holds:
```json
{
  "id": "PRV-002/R1",
  "type": "rule",
  "module": "providers",
  "title": "The fallback is used only when it is enabled in this workspace (INV-001)",
  "status": "active",
  "file": "modules/providers/features/PRV-002-fall-back-on-rate-limit.md",
  "line": 46
}
```

### S4: Modules and members carry no title
Given the "chat-mini" fixture spec is the spec root
When the developer runs "spec build" through graph.Build
Then the node of "providers" has only the keys "id", "type", "status", "file" and "line"
And the node of "conversation.Message.meta" has the keys "id", "type", "module", "status", "file" and "line", with "type" "field" and "module" "conversation"

### S5: Scenarios are listed apart, with what they cite
Given the "chat-mini" fixture spec is the spec root
When the developer runs "spec build" through graph.Build
Then graph.Graph.nodes holds no scenario
And graph.Graph.scenarios starts with:
```json
{
  "id": "CNV-001/S1",
  "feature": "CNV-001",
  "title": "Send to active provider",
  "cites": ["providers.ProviderConfig", "providers.StreamReply", "conversation.Message.content"]
}
```

### S6: A scenario's cites are not edges, a rule's are
Given the "chat-mini" fixture spec is the spec root
When the developer runs "spec build" through graph.Build
Then graph.Graph.edges holds no edge from "PRV-002/S4"
And graph.Graph.edges holds the edge from "PRV-002/R1" to "INV-001" of kind "cites"

### S7: Edges are sorted and each is listed once
Given a feature "ALP-001" whose two scenarios both cite "alpha.Widget.size" in a Given
When the developer runs "spec build" through graph.Build
Then graph.Graph.edges holds exactly one edge from "ALP-001" to "alpha.Widget.size" of kind "reads"
And graph.Graph.edges is sorted by from, then to, then kind, in natural ID order

### S8: An open question and an answered one
Given feature "ALP-001" has question "Q1" of kind blocker with answer null, and question "Q2" of kind preference with answer "yes"
When the developer runs "spec build" through graph.Build
Then graph.Graph.questions holds, in this order:
```json
[
  { "owner": "ALP-001", "id": "Q1", "kind": "blocker", "open": true },
  { "owner": "ALP-001", "id": "Q2", "kind": "preference", "open": false }
]
```

### S9: A question's cites are edges from the question
Given feature "ALP-001" has question "Q1" citing "alpha.Widget.size"
When the developer runs "spec build" through graph.Build
Then graph.Graph.edges holds the edge from "ALP-001#Q1" to "alpha.Widget.size" of kind "cites"

### S10: Terms list the features that use them
Given the "chat-mini" fixture spec is the spec root, whose glossary has "Fallback" with no aliases and "Message" with the alias "messages"
When the developer runs "spec build" through graph.Build
Then graph.Graph.terms holds the term "Fallback" with "usedBy" ["PRV-001", "PRV-002", "SET-001"]
And graph.Graph.terms holds the term "Message" with "aliases" ["messages"] and "usedBy" ["CNV-001", "CNV-002", "CNV-003", "PRV-001", "PRV-002", "PRV-003", "SET-001"]: the features whose text holds "message" or "messages" as a whole word, in any case
And "SET-002" is not among them

### S11: Two builds give the same bytes
Given the "chat-mini" fixture spec is the spec root
When the developer runs "spec build" through graph.Build twice, the second time with the spec files loaded in reverse order
Then graph.Graph is byte-identical both times, and graph.Graph.spec is the same (INV-005, R1)

### S12: The file's layout
Given the "chat-mini" fixture spec is the spec root
When the developer runs "spec build" through graph.Build
Then graph.Graph is indented by two spaces, ends its lines with LF and ends with a single newline (INV-005, R1)

## Rules
- R1: The same spec files give a byte-identical `graph.json`, whatever order they are read in (INV-005).

## Out of scope
- The module dependencies among the edges: GRF-004
- Reading `graph.json` back: no command does
