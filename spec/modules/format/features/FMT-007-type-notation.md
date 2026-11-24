---
id: FMT-007
title: Write types in one portable notation
module: format
status: active
observes: [lint.Finding.rule, lint.Finding.id]
retired: [S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13, R3, R4, R5, R6]
---
## Intent
Every `Type:` and `Output:` line uses the same small notation whatever the project's language, so a type means one thing to every reader and every stack maps it once.

## Behaviour
### S1: Primitives, literals, references, lists, maps, unions and null
Given "alpha.Size" is a type and the members of "alpha.Widget" have the types `"small" | "large" | null` and "map<string, alpha.Size[]> | (int | number)[]"
When `spec lint` runs
Then it reports no lint.Finding.rule "L022" (R1)
And each format.Member.type is read as written

### S2: A member may be absent
Given the members of "alpha.Widget" have the types "string?" and "(decimal | null)?"
When `spec lint` runs
Then it reports no lint.Finding.rule "L022" (R2)

### S14: A quoted literal names no contract
Given the member "alpha.Widget.name" has the type `"vendor.Cancelled" | "done"`
When `spec build` writes "_generated/graph.json"
Then its "edges" hold no format.Link of kind "uses" from "alpha.Widget.name" (R7)
And `spec lint` reports no finding whose lint.Finding.id is "alpha.Widget.name"

## Rules
- R1: A type is built from the primitives string, int, number, decimal, bool, bytes, date, datetime, duration and null; quoted or numeric literals; qualified contract names; T[] lists; map<K, V>; A | B unions; and parentheses.
- R2: T? marks a member that may be left out, apart from T | null, which is always there and may be null. Only a member may be optional, and a union takes parentheses before the question mark.
- R7: A quoted literal is a value, never a reference.

## Out of scope
- Mapping the notation to a language's types: each project's tester and implementer
- The findings for a type outside the notation, a native spelling and its portable form, a member with no type or two, and a contract named bare: LNT-016
