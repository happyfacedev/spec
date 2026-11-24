---
id: FMT-004
title: Give every unit a status and keep removed IDs
module: format
status: active
writes: [format.Unit.status]
invariants: [INV-001]
observes: [lint.Finding.file]
retired: [S6, S7, S8, S10, S11, R4, R6]
---
## Intent
A unit is current, still served but not for new use, or removed. Removing never deletes: a removed scenario or rule leaves its number in its feature's retired list, and every other removed unit stays as a tombstone, so no ID is ever reused and old tests, tickets and history keep pointing at what they meant.

## Behaviour
### S1: A feature's status is its frontmatter status
Given the feature "BET-001" has "status: deprecated"
When `spec show "BET-001" --format json` runs
Then format.Unit.status is "deprecated" (R1)

### S2: Scenarios and rules take their feature's status
Given the feature "BET-001" has "status: deprecated" and the scenario "S1"
When `spec show "BET-001/S1" --format json` runs
Then format.Unit.status is "deprecated" (R2)

### S3: A member takes its contract's status unless it has its own
Given "alpha.Widget" has "Kind: entity · Status: active"
And its member "alpha.Widget.size" starts with the line "Status: deprecated · Superseded by: alpha.Widget.name"
When `spec show` runs with `--format json` for "alpha.Widget.size" and "alpha.Widget.name"
Then format.Unit.status is "deprecated" for the first and "active" for the second (R2)

### S4: An invariant without a status line is active
Given "INV-001" has no status line and "INV-002" has the line "Status: removed"
When `spec show` runs with `--format json` for each
Then format.Unit.status is "active" for "INV-001" and "removed" for "INV-002" (R1)

### S5: A removed feature is a tombstone
Given the feature "BET-001" has "status: removed", "retired: [S1]" and "None" under "## Behaviour"
When `spec build` writes "_generated/graph.json"
Then its "scenarios" hold none of "BET-001" (R3)
And `spec show "BET-001" --format json` prints format.Unit.status "removed", so the ID stays taken (INV-001)
And `spec lint` reports no finding whose lint.Finding.file is its file

### S9: A tombstone points at its replacement
Given "INV-002" has the line "Status: removed · Superseded by: INV-003"
When `spec build` writes "_generated/graph.json"
Then its "edges" hold a format.Link from "INV-002" to "INV-003" of kind "superseded_by" (R5)

## Rules
- R1: A status is active (current), deprecated (still served and tested, not for new use) or removed (a tombstone that keeps its ID).
- R2: A scenario or rule has its feature's status. A member has its own status line's status, else its contract's.
- R3: A removed feature holds no scenarios: their numbers are all retired, and Behaviour may say None.
- R5: A tombstone keeps superseded_by (or a Superseded by: part) naming what replaced it.

## Out of scope
- Refusing a spec stage that deletes a unit, takes a number off retired, or revives a removed unit: pipeline
- Which superseded_by chains lint accepts: lint
- The findings for a removed feature that holds scenarios, a retired number used again, a malformed retired list, a live link to a deprecated or removed unit, and a live unit in a removed module: LNT-006, LNT-007, LNT-009, LNT-010
- An ID a branch reuses or drops against its base branch: LNT-018
- Decision statuses: FMT-010
