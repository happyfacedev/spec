---
id: FMT-003
title: Recognise a unit by the shape of its ID
module: format
status: active
writes: [format.Unit.kind]
retired: [S11, R5]
---
## Intent
Every unit has an ID whose shape alone says what kind of unit it is, so a person, a test name, a ticket and the CLI can all point at any unit without saying where it lives. The shapes leave room for big specs (four-digit numbers) and for any stack's member names, and the IDs sort the way a person counts.

## Behaviour
### S1: Features take three or four digits
Given the module "alpha" with prefix "ALP" holds the features "ALP-001" and "ALP-1000"
When `spec show "ALP-1000" --format json` runs
Then format.Unit.kind is "feature" (R1)

### S2: Scenarios and rules are numbered inside their feature
Given the feature "ALP-001" has the scenario heading "### S1: Widget made" and the rule line "- R1: Every widget has a size"
When `spec show "ALP-001/S1" --format json` and `spec show "ALP-001/R1" --format json` run
Then format.Unit.kind is "scenario" for the first and "rule" for the second (R1)

### S3: Contracts and members
Given "modules/alpha/contracts.md" defines "alpha.Widget" with the member "alpha.Widget.size"
When `spec show "alpha.Widget" --format json` and `spec show "alpha.Widget.size" --format json` run
Then format.Unit.kind is "contract" for the first and "field" for the second (R1)

### S4: A member name may start with a capital or hold underscores
Given "alpha.Widget" has the members "alpha.Widget.SizeCm" and "alpha.Widget.size_cm"
When `spec show` runs with `--format json` for each
Then format.Unit.kind is "field" for both (R1)

### S5: Invariants, decisions and screens go past 999
Given "INV-1000", "ADR-1000" and "UI-1000" are defined
When `spec show` runs with `--format json` for each
Then format.Unit.kind is "invariant", "decision" and "screen" (R1)

### S6: A module is its folder name
Given the folder "modules/alpha/" holds "_module.md"
When `spec show "alpha" --format json` runs
Then format.Unit.kind is "module" and format.Unit.file is "modules/alpha/_module.md" (R1)

### S7: A reserved prefix never makes a feature
Given the spec holds the scenario "ALP-001/S1"
When `spec show "PROP-001/S1"` runs
Then stderr starts with "Unknown PROP-001/S1." and it exits 2 (R2)

### S8: A malformed ID is never looked up
Given the spec holds the feature "ALP-001"
When `spec show "alp-001"` runs
Then stderr starts with "Unknown alp-001." and it exits 2 (R1)

### S9: IDs sort by the value of their numbers
Given the feature "ALP-001" has the scenarios "S2" and "S10"
When `spec build` writes "_generated/graph.json"
Then its "scenarios" list "ALP-001/S2" before "ALP-001/S10" (R3)

### S10: A feature keeps its ID when it moves
Given the feature "BET-001" of module "beta" moves to "modules/alpha/features/BET-001-order-a-widget.md" with "module: alpha"
When `spec show "BET-001" --format json` runs
Then format.Unit.kind is "feature" and format.Unit.file is "modules/alpha/features/BET-001-order-a-widget.md" (R4)
And `spec lint` reports no finding on that file

## Rules
- R1: The shapes: a feature is two to four capital letters, a hyphen and three or four digits; a scenario or rule adds /S or /R and a number; a contract is a module name, a dot and a name starting with a capital; a member adds a dot and a name of letters, digits and underscores; an invariant, decision or screen is INV-, ADR- or UI- and three or four digits; a module is lowercase letters, digits and hyphens starting with a letter.
- R2: INV, ADR, UI, PROP, BUG and TASK are reserved: an ID with one of them is never a feature, scenario or rule.
- R3: IDs sort by their runs of digits as numbers and by the rest as text, so 2 sorts before 10.
- R4: A feature's prefix says which module created it, not where it lives now.

## Out of scope
- Suggesting the closest ID for a near miss: graph
- Ticket and question IDs: tickets
- Which IDs in prose lint checks: lint
- The findings for a malformed ID or a file not named after its ID: LNT-006
