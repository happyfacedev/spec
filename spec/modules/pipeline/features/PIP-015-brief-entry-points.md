---
id: PIP-015
title: Answer every way of calling spec brief, never with an error
module: pipeline
status: active
retired: [S4, S5]
questions:
  - id: Q1
    kind: preference
    text: "A query whose first word is close to a role name (\"review fallback rules\") gets \"Unknown role review. Did you mean reviewer?\" instead of a search. Should free text search whenever the first word is not exactly a role?"
    default: Treat a near-role first word as a mistyped role, as now
    cites: [PIP-015/S13]
    answer: 'Change requested in review (2026-10-29): Search, unless the first word is exactly a role name.'
    raised_by: null
  - id: Q2
    kind: preference
    text: "Query words of one or two letters are dropped from the search, and a query made only of such words gets \"Unknown role <word>.\" instead of a search. Is that intended?"
    default: Drop words of two letters or fewer, as now
    cites: [PIP-015/S12]
    answer: 'Change requested in review (2026-10-29): Keep dropping short words, but answer "no matches" instead.'
    raised_by: null
---
## Intent
`spec brief` is what a harness's skill loader injects, and a failing injected command aborts the skill, so it always exits 0 and prints any problem as text: a hint on the first line, then the usage line. Each shape of call gets a useful answer: no arguments give the map of the spec and the queue, one ID gives that unit as stored, and free text searches the spec.

## Behaviour
### S1: No arguments
Given a spec whose version is "spec@3f8f2372"
When `spec brief` runs through pipeline.Brief with no role and no ID
Then the first line is "# Brief · spec@3f8f2372" and the groups are exactly "## Modules", "## Queue" and "## Usage" (R1)
And "## Modules" has one "### <domain>" per domain, each module as "- <id> (<PREFIX>, <n> features): <first sentence of its description>", counting active features

### S2: The skill's unfilled placeholders count as empty
Given a harness passes its arguments as the literal texts "$0" and "$1", because none were given
When `spec brief '$0' '$1'` runs through pipeline.Brief
Then the output is the brief of S1 (R2)
And "$ARGUMENTS" given as pipeline.Brief.query also counts as empty

### S3: One ID and no role
Given the scenario "PRV-002/S3" exists
When `spec brief PRV-002/S3` runs through pipeline.Brief
Then the first line is "# PRV-002/S3 · spec@3f8f2372", then the unit as `spec show` prints it, then "For a role's brief: spec brief <spec-writer|spec-review|tester|implementer|reviewer> <ticket or unit ID>"
And a ticket ID alone, such as "TASK-101", shows that ticket the same way

### S6: Free text searches the spec
Given pipeline.Brief.query is "fallback provider also rate-limits" and the first argument is "fallback", no role
When pipeline.Brief runs
Then the first line is "# Search · fallback provider also rate-limits · spec@3f8f2372"
And "## Best matches" quotes up to 3 matching scenarios in full, or the best match when none is a scenario, then "## Other matches" lists the rest as "- <ID> <type> · <title>", then "## Expand" (R4)

### S7: A search that matches nothing
Given a query whose words match no unit
When pipeline.Brief runs with it
Then the brief says "No unit matches. Usage: spec brief <spec-writer|spec-review|tester|implementer|reviewer> <ticket or unit ID>" and lists every module as "- <id> (<PREFIX>): <first sentence>" (R4)

### S8: Bad input gets a hint, never an error
Given the spec holds the role names, "PRV-002", "TASK-101" and "TASK-102", and no "TASK-999"
When pipeline.Brief runs with each input below and no query
Then the output starts with its hint, holds "Usage: spec brief", and the exit code is 0 (R1):
| role | ID | first line |
| implementr | TASK-101 | Unknown role implementr. Did you mean implementer? |
| implementer | PRV-02 | Unknown PRV-02. Did you mean PRV-002? |
| implementer | TASK-102x | Unknown TASK-102x. Did you mean TASK-102? |
| implementer | TASK-999 | Unknown TASK-999. |
| implementer | (none) | implementer needs a ticket or unit ID. |
| implementer | providers | Unknown providers. |
| overseer | TASK-101 | Unknown role overseer. |

### S9: Shell text in an argument is only text
Given the ID "x'; touch /tmp/pwned; '"
When `spec brief implementer` runs with it through pipeline.Brief
Then the first line is "Unknown x'; touch /tmp/pwned; '." and no file is created (R1)

### S10: Extra arguments
Given any spec
When `spec brief implementer TASK-101 extra` runs through pipeline.Brief
Then stdout starts "spec brief takes a role and one ID; ignored: extra" then the usage line, and the exit code is 0 (R1)

### S11: No spec root, or an option brief does not take
Given no `--root`, no SPEC_ROOT and no bundled script
When `spec brief implementer TASK-101` runs through pipeline.Brief
Then stdout starts "no spec root: pass --root, set SPEC_ROOT, use a project .spec/bin/spec launcher, or run from a project with spec/config.json" and the exit code is 0
And `spec brief implementer TASK-101 --depth x` also exits 0 with the same stdout, since brief does not take --depth (CLI-003/R4)

### S12: Short words are left out of a search
Given the "chat-mini" fixture spec
When pipeline.Brief runs with the first argument "what" and pipeline.Brief.query "what happens when a provider rate limits"
Then the first line is "# Search · what happens when provider rate limits · spec@<8 hex digits>", without the word "a" (R4)
And "## Other matches" holds "- providers.RateLimited contract · The provider refused a request because of rate limits."

### S13: A query whose first word is close to a role is searched
Given the "chat-mini" fixture spec
When pipeline.Brief runs with the first argument "review" and pipeline.Brief.query "review fallback rules"
Then the first line is "# Search · review fallback rules · spec@<8 hex digits>" and the output holds no "Unknown role" line (R4)

### S14: A query of only short words matches nothing
Given the "chat-mini" fixture spec
When pipeline.Brief runs with the first argument "to" and pipeline.Brief.query "to be or as"
Then the brief says "No unit matches. Usage: spec brief <spec-writer|spec-review|tester|implementer|reviewer> <ticket or unit ID>" and lists every module as "- <id> (<PREFIX>): <first sentence>" (R4)
And the output holds no "Unknown role" line (R4)

### S15: A unit ID as the first argument is searched when a query is given
Given the "chat-mini" fixture spec
When pipeline.Brief runs with the first argument "PRV-002/S3" and pipeline.Brief.query "PRV-002/S3 fallback provider also rate-limits"
Then the first line is "# Search · PRV-002/S3 fallback provider also rate-limits · spec@<8 hex digits>" and the output holds no "Unknown role" line (R4)
And the output holds "## Best matches" (R4)

### S16: A module ID as the first argument is searched when a query is given
Given the "chat-mini" fixture spec
When pipeline.Brief runs with the first argument "providers" and pipeline.Brief.query "providers rate limits"
Then the first line is "# Search · providers rate limits · spec@<8 hex digits>" and the output holds no line starting "Unknown" (R4)
And the output holds "## Best matches" (R4)

### S17: A lone unit ID given again as the query is shown, not searched
Given the "chat-mini" fixture spec
When pipeline.Brief runs with the first argument "PRV-002/S3" and pipeline.Brief.query "PRV-002/S3", as the skill sends a lone argument
Then the first line is "# PRV-002/S3 · spec@<8 hex digits>" and the output is the same as with no query (R4)
And the output holds no "## Best matches" (R4)

### S18: A lone ticket ID given again as the query is shown, not searched
Given the "chat-mini" fixture spec, which holds the ticket "TASK-101"
When pipeline.Brief runs with the first argument "TASK-101" and pipeline.Brief.query "TASK-101", as the skill sends a lone argument
Then the first line is "# TASK-101 · spec@<8 hex digits>" and the output is the same as with no query (R4)
And the output holds no "## Best matches" (R4)

### S19: A lone module ID given again as the query is shown, not searched
Given the "chat-mini" fixture spec
When pipeline.Brief runs with the first argument "providers" and pipeline.Brief.query "providers", as the skill sends a lone argument
Then the first line is "# providers · spec@<8 hex digits>" and the output is the same as with no query (R4)
And the output holds no "## Best matches" (R4)

### S20: A lone glossary term given again as the query is shown, not searched
Given the "chat-mini" fixture spec, which defines the glossary term "Fallback"
When pipeline.Brief runs with the first argument "Fallback" and pipeline.Brief.query "Fallback", as the skill sends a lone argument
Then the first line is "# Fallback · spec@<8 hex digits>" and the output is the same as with no query (R4)
And the output holds no "## Best matches" (R4)

### S21: The arguments arrive on standard input
Given the "chat-mini" fixture spec
When pipeline.Brief runs with pipeline.Brief.stdin "what's a gate", as the skill sends it
Then the output is the output of pipeline.Brief with the first argument "what's", the second argument "a" and pipeline.Brief.query "what's a gate" (R5)
And pipeline.Brief.stdin "$ARGUMENTS" gives the brief of S1 (R2, R5)

### S22: Brief hints list stage roles only
Given `spec brief` prints a role hint and the plugin brief skill declares an argument hint
When a user requests a unit, ticket, invalid role or loads the skill
Then each hint lists spec-writer, spec-review, tester, implementer and reviewer, in that order, and not overseer
And the usage line reads "Usage: spec brief <spec-writer|spec-review|tester|implementer|reviewer> <ticket or unit ID>" and the skill's argument hint reads "[<spec-writer|spec-review|tester|implementer|reviewer>] <ID> | <question words>" (R6)
And `spec brief spec-review` with a ticket ID still returns that role's brief (PIP-012/S2)
And `spec brief overseer` still returns the internal brief of S4 (R6)

## Rules
- R1: `spec brief` always exits 0; every problem is a hint on stdout's first line, followed by the usage.
- R2: An argument that is exactly "$<digits>" or "$ARGUMENTS" is empty.
- R4: With a query, a first argument that is not exactly a role name is a search, whether it is a unit ID, a module ID, a term or other text. Words of one or two letters are left out of it, and a query of only such words matches nothing. Exception: when the query holds no word beyond the first argument itself and the first argument is anything brief shows on its own (a unit, module, ticket or glossary term), it is shown as it is with no query. A lone argument that matches none of these is searched.
- R5: With `--stdin`, `spec brief` reads standard input as the whole argument text: its first word is the role, its second the ID and all of it the query, and the text is used exactly as sent, with its quotes, dollar signs and backticks. Positional arguments given too are ignored.
- R6: User-facing brief hints enumerate the five stage roles in pipeline order (spec-writer, spec-review, tester, implementer, reviewer); the internal `overseer` role remains accepted by `spec brief` but is not advertised in hints.

## Out of scope
- How the queue is ordered and grouped (tickets)
- The retired ticket-runner brief path is replaced by the main session's stage flow (CLI-007).
- How `spec show` and `spec find` print and rank units (graph)
