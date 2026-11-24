---
id: GRF-006
title: Find units by words
module: graph
status: active
provides: [graph.Find]
writes: [graph.FindResult]
questions:
  - id: Q1
    kind: preference
    text: A query of several words scores each word on its own, so `spec find rate limit` ranks the contract "providers.RateLimited" (80) above the glossary term "Rate limit" (60), and a term's name only earns its 50 when one word equals it whole. Should a query whose words together equal a term or alias score that term as a name match?
    default: Keep scoring word by word.
    cites: [GRF-006/S7]
    answer: 'Change requested in review (2026-10-29): Score a query that equals a term or alias as a name match.'
    raised_by: null
---
## Intent
`spec find <words>` finds the units and glossary terms a few words point at, so a person or an agent can go from a vague idea ("fallback") to the IDs to `show`. It searches IDs, titles and terms, ranks the hits the same way every time, and prints the best 20.

## Behaviour
### S1: An exact ID ranks first
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec find "PRV-002" through graph.Find
Then the first line of stdout is "PRV-002  feature  Fall back when a provider rate-limits": the ID, its type and its title, two spaces apart (R1)
And the command exits 0

### S2: IDs holding the word follow, ties in natural ID order
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec find "PRV-002" through graph.Find
Then the next lines are, in order, "PRV-002/R1  rule  The fallback is used only when it is enabled in this workspace (INV-001)", "PRV-002/R2  rule  One fallback per reply. No chains.", then "PRV-002/S1  scenario  Fallback enabled" through "PRV-002/S4  scenario  Fallback provider not enabled", each scored 30 (R1)

### S3: A glossary term by its name
Given the "chat-mini" fixture spec is the spec root, whose glossary defines "Fallback" as "The one provider that finishes a reply when the active provider rate-limits, if the workspace has set one."
When the developer runs spec find "fallback" through graph.Find
Then the first line of stdout is "Fallback  term  The one provider that finishes a reply when the active provider rate-limits, if the workspace has set one."
And graph.FindResult.hits starts with the term "Fallback" scored 150: 100 for its name as the ID and 50 for the name (R1)

### S4: A glossary term by its alias
Given the "chat-mini" fixture spec is the spec root, whose glossary term "Rate limit" has the alias "rate-limit"
When the developer runs spec find "rate-limit" through graph.Find
Then the first line of stdout is "Rate limit  term  A refusal by a provider to serve a request now, with a time after which to retry.", scored 50 (R1)

### S5: Whole words in titles, plurals included, rank above parts of words
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec find "rate-limit" through graph.Find
Then the scenario "PRV-001/S2", titled "Provider rate-limits", is scored 10
And the member "conversation.DeliveryMeta.fallbackFrom", whose description holds "rate-limited", is scored 4, and listed after every hit scored 10 (R1)

### S6: Case does not matter
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec find "FALLBACK" through graph.Find
Then stdout is the same as for spec find "fallback"

### S7: Several words add up
Given the "chat-mini" fixture spec is the spec root
When the developer runs "spec find rate limit" through graph.Find
Then graph.FindResult.hits starts with the term "Rate limit" scored 210, 60 for the two words in its ID and 150 for the query spelling its name, then "providers.RateLimited" scored 80 (R1)
And graph.FindResult.query is "rate limit"

### S8: At most 20 hits
Given the "chat-mini" fixture spec is the spec root, where more than 20 units and terms hold the letter "a"
When the developer runs spec find "a" through graph.Find
Then stdout is exactly 20 lines (R2)

### S9: No match
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec find "zebra" through graph.Find
Then stdout is the one line: no matches for "zebra"
And the command exits 0

### S10: The hits as JSON
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec find "provider" --format json through graph.Find
Then stdout is one JSON document with the keys "spec", "query" and "hits", in that order, and graph.FindResult.query is "provider"
And graph.FindResult.hits starts with:
```json
{
  "id": "Provider",
  "type": "term",
  "title": "A fake model backend that streams a reply for a conversation.",
  "score": 150
}
```

### S11: No match as JSON
Given the "chat-mini" fixture spec is the spec root
When the developer runs spec find "zebra" --format json through graph.Find
Then graph.FindResult.hits is empty, and the command exits 0

### S12: No words
Given the "chat-mini" fixture spec is the spec root
When the developer runs "spec find" with no words through graph.Find
Then the command fails with cli.UsageError
And stderr is "usage: spec find <words>", a blank line and the usage text, and the command exits 2

### S13: A glossary term by a multi-word alias
Given the "chat-mini" fixture spec is the spec root, whose glossary term "Rate limit" has the alias "rate limits"
When the developer runs "spec find rate limits" through graph.Find
Then graph.FindResult.hits starts with the term "Rate limit" scored 80: 30 for the word "rate" in its ID and 50 for the query spelling the alias (R1), then "providers.RateLimited" scored 50

## Rules
- R1: Hits are ranked by score, highest first, and ties in natural ID order. Each word adds 100 to an ID equal to it or 30 to one holding it, 50 to a term or alias equal to it, and 10 to a title holding it as a whole word, plurals in s or es included, or else 4 to a title holding it at all. A query of two or more words also scores the words joined by single spaces: 100 for an ID equal to them and 50 for a term or alias equal to them, on top of each word's own score. So a query that spells out a term's name scores that term 150 for the name, and one that spells out an alias scores it 50.
- R2: At most 20 hits are printed.

## Out of scope
- Searching scenario steps or contract text beyond the summary line
- Tickets: `spec queue` lists them
