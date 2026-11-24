---
id: GRF-005
title: Show a unit with its backlinks
module: graph
status: active
provides: [graph.Show]
writes: [graph.ShownUnit]
---
## Intent
`spec show <ID>` prints one unit exactly as its file stores it, with where it is, and then the units that point at it: what uses it and what cites it. Nobody has to grep the spec to learn who depends on a contract. It also shows a glossary term or a ticket by name. An argument it does not know is refused with the closest known ID, and is never used for anything but a lookup.

## Behaviour
### S1: A contract, with what uses and cites it
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec show "providers.RateLimited" through graph.Show
Then stdout starts with the line "modules/providers/contracts.md:40", a blank line, and the contract's section as stored, from "### providers.RateLimited" to the end of its last member
And then a blank line and "## Backlinks (generated)"
And then "Used by:" and the lines "- PRV-001 emits — Stream a reply from the active provider" and "- PRV-002 consumes — Fall back when a provider rate-limits"
And then "Cited by:" and one line per scenario that cites it, in ID order, from "- PRV-001/S2 — Provider rate-limits" to "- PRV-002/S4 — Fallback provider not enabled"
And the command exits 0

### S2: A member shows the links to its whole contract
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec show "providers.RateLimited.retryAfterMs" through graph.Show
Then stdout starts with "modules/providers/contracts.md:47", a blank line, and "#### providers.RateLimited.retryAfterMs"
And graph.ShownUnit.usedBy holds "- PRV-001 emits providers.RateLimited — Stream a reply from the active provider", naming the contract the link names (R1)

### S3: A contract shows the links to its members
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec show "conversation.Message" through graph.Show
Then graph.ShownUnit.usedBy holds "- CNV-002 writes conversation.Message.content — Stop a reply mid-stream" and "- CNV-002 writes conversation.Message.meta — Stop a reply mid-stream" (R1)
And it holds "- CNV-003 reads — Export a conversation to Markdown", for the link to the whole contract
And its lines are sorted by ID, then kind

### S4: A type shows the members typed by it
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec show "conversation.DeliveryMeta" through graph.Show
Then graph.ShownUnit.usedBy is the one line "- conversation.Message.meta uses — Delivery details. Type: conversation.DeliveryMeta"

### S5: An invariant, with the features that hold it and what cites it
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec show "INV-001" through graph.Show
Then graph.ShownUnit.usedBy is "- CNV-001 invariants — Send a message", "- PRV-002 invariants — Fall back when a provider rate-limits" and "- SET-001 invariants — Enable providers"
And graph.ShownUnit.citedBy is "- CNV-001/S2 — Active provider disabled", "- PRV-002/R1 — The fallback is used only when it is enabled in this workspace (INV-001)", "- PRV-002/S4 — Fallback provider not enabled" and "- SET-001/S2 — Disable stops new messages to it"

### S6: A scenario is its heading and steps
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec show "PRV-002/S3" through graph.Show
Then stdout is "modules/providers/features/PRV-002-fall-back-on-rate-limit.md:30", a blank line, then the lines from "### S3: Fallback provider also rate-limits" to its last step
And stdout holds no "## Backlinks (generated)", since nothing links to it

### S7: A rule is its own line
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec show "PRV-002/R1" through graph.Show
Then graph.ShownUnit.text is "- R1: The fallback is used only when it is enabled in this workspace (INV-001)"
And graph.ShownUnit.citedBy is the one line "- PRV-002/S4 — Fallback provider not enabled"

### S8: A module is its whole file
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec show "providers" through graph.Show
Then stdout is "modules/providers/_module.md:1", a blank line, and the whole file, from its "---" line on
And stdout holds no backlinks

### S9: A tombstone pointer is not a backlink
Given feature "SET-002" is deprecated with superseded_by "SET-001", and nothing else links to "SET-001"
When the developer runs spec show "SET-001" through graph.Show
Then stdout holds no "## Backlinks (generated)" (R2)

### S10: A glossary term, by name or alias, in any case
Given the "chat-mini" fixture spec is the spec root, whose glossary has "Message" with the alias "messages"
When the developer runs spec show "MESSAGES" through graph.Show
Then stdout is "core/glossary.md:18", a blank line, "### Message", "One entry in a conversation, with the same shape for every provider." and "Aliases: messages"
And graph.ShownUnit.type is "term", graph.ShownUnit.id is "Message" and graph.ShownUnit.status is null

### S11: A ticket
Given the "chat-mini" fixture tickets hold "BUG-301" with status open
When the developer runs spec show "BUG-301" through graph.Show
Then stdout starts with "tickets/BUG-301.md:1", a blank line, and the ticket file's whole text from its "---" line on
And graph.ShownUnit.type is "ticket" and graph.ShownUnit.status is "open"

### S12: The unit as JSON
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec show "SET-002" --format json through graph.Show
Then stdout is one JSON document whose keys are, in order, "spec", "id", "type", "file", "line", "status", "text", "usedBy" and "citedBy"
And graph.ShownUnit is "id" "SET-002", "type" "feature", "file" "modules/settings/features/SET-002-manage-api-keys.md", "line" 1, "status" "active", "text" the whole file, and empty "usedBy" and "citedBy"

### S13: A backlink as JSON
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec show "providers.RateLimited.retryAfterMs" --format json through graph.Show
Then graph.ShownUnit.usedBy starts with { "id": "PRV-001", "kind": "emits providers.RateLimited", "title": "Stream a reply from the active provider" }
And graph.ShownUnit.citedBy starts with { "id": "PRV-001/S2", "title": "Provider rate-limits" }

### S14: An unknown ID, with the closest known one
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec show "PRV-02" through graph.Show
Then the command fails with graph.UnknownId
And stderr starts with "Unknown PRV-02. Did you mean PRV-002?", then a blank line and the usage text
And stdout is empty and the command exits 2

### S15: An unknown ID with nothing close
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec show "zzzzqqq" through graph.Show
Then the command fails with graph.UnknownId
And stderr starts with the line "Unknown zzzzqqq." and holds no "Did you mean"

### S16: A well-formed ID the spec does not hold
Given the "chat-mini" fixture tickets hold no "TASK-999"
When the developer runs spec show "TASK-999" through graph.Show
Then the command fails with graph.UnknownId, and stderr starts with "Unknown TASK-999."
And the command exits 2

### S17: Shell text is never run
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec show with the one argument x'; touch /tmp/pwned; ' through graph.Show
Then the command fails with graph.UnknownId, and stderr starts with the line "Unknown x'; touch /tmp/pwned; '."
And no file "/tmp/pwned" is created, and the command exits 2

### S18: No ID
Given the "chat-mini" fixture spec is the spec root
When the developer runs "spec show" with no ID through graph.Show
Then the command fails with cli.UsageError
And stderr is "usage: spec show <ID>", a blank line and the usage text, and the command exits 2

### S19: More than one word
Given the "chat-mini" fixture spec is the spec root, whose glossary has the term "Rate limit"
When the developer runs "spec show rate limit" through graph.Show, with the term as two words
Then the command fails with cli.UsageError, and stderr starts with "usage: spec show <ID>"
And the command exits 2

## Rules
- R1: A contract and its members reach each other: a link to the whole contract shows on each member, and a link to a member shows on the contract, naming what it links.
- R2: A `superseded_by` link is not a backlink.

## Out of scope
- Showing a unit through the skill loader (`/<name>-spec <ID>`): pipeline (`spec brief`)
- Tickets that name the unit in `touches` or `violates`: they are not backlinks
