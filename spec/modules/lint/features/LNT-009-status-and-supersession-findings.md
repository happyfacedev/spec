---
id: LNT-009
title: Report links to retired units and broken replacements (L005, L016)
module: lint
status: active
writes: [lint.Report.findings]
---
## Intent
A removed unit is a tombstone and a deprecated one is on its way out, so lint tells every live unit that still links to one where to point instead, and reports what a module's status says about the units it holds (L005). A unit that names a replacement must name a unit of its own kind, without a loop, and a deprecated one must lead to a current unit (L016). Each scenario starts from the base spec of LNT-001 and runs lint.Lint.

## Behaviour
### S1: A live link to a removed member
Given the base spec with "Status: removed · Superseded by: alpha.Widget.name" as the first line of member "alpha.Widget.size", which "BET-001" cites on line 14
When lint.Lint runs
Then lint.Report.findings is exactly two "L005" errors at "modules/beta/features/BET-001-order-a-widget.md" line 14, each with fix "point to alpha.Widget.name instead" (R1):
| id | message |
| "BET-001" | "active BET-001 reads alpha.Widget.size, which is removed" |
| "BET-001/S1" | "active BET-001/S1 cites alpha.Widget.size, which is removed" |

### S2: A live link to a deprecated member
Given the base spec with "Status: deprecated · Superseded by: alpha.Widget.name" as the first line of member "alpha.Widget.size"
When lint.Lint runs
Then lint.Report.findings is exactly two "L005" warnings at "modules/beta/features/BET-001-order-a-widget.md" line 14, with the messages of S1 ending "which is deprecated" (R2)
And cli.CommandResult.exitCode is 0

### S3: A removed unit with no replacement
Given the base spec with "Status: removed" as the first line of "INV-001", which "ALP-001" lists on line 7 and its rule cites on line 23
When lint.Lint runs
Then lint.Report.findings is exactly two "L005" errors, each with fix "point to the unit that replaces INV-001" (R1):
| line | id | message |
| 7 | "ALP-001" | "active ALP-001 invariants INV-001, which is removed" |
| 23 | "ALP-001/R1" | "active ALP-001/R1 cites INV-001, which is removed" |

### S4: Live units in a deprecated module
Given the base spec with "status: deprecated" in "modules/beta/_module.md"
When lint.Lint runs
Then lint.Report.findings is exactly two "L005" warnings (R2):
| file | line | id | message | fix |
| "modules/beta/contracts.md" | 3 | "beta.Order" | "active beta.Order is in deprecated module beta" | "move beta.Order to the module that replaces beta" |
| "modules/beta/features/BET-001-order-a-widget.md" | 1 | "BET-001" | "active BET-001 is in deprecated module beta" | "move BET-001 to the module that replaces beta" |

### S5: Live units in a removed module
Given the base spec with "status: removed" in "modules/beta/_module.md"
When lint.Lint runs
Then lint.Report.findings is exactly two "L005" errors on "beta.Order" and "BET-001", with messages "active beta.Order is in removed module beta" and "active BET-001 is in removed module beta" (R1)
And their fixes are "remove beta.Order too (status: removed), or move it to a live module" and "remove BET-001 too (status: removed), or move it to a live module"

### S6: A replacement of another kind
Given the base spec with an invariant "INV-003" on line 11 of "core/invariants.md" whose status line, line 12, is "Status: removed · Superseded by: ADR-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L016" at "core/invariants.md" line 12, id "INV-003", message "INV-003 is superseded by ADR-001, which is a decision", fix "point superseded_by to another invariant" (R3)

### S7: A removed unit may have no replacement
Given the base spec with an invariant "INV-002" whose status line is "Status: removed"
When lint.Lint runs
Then lint.Report.findings is empty (R3)

### S8: An active unit with a replacement
Given the base spec with "Status: active · Superseded by: INV-001" on line 4 of "core/invariants.md", under "INV-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L016" at "core/invariants.md" line 4, id "INV-001", message "active INV-001 has superseded_by", fix "deprecate it, or remove superseded_by" (R3)

### S9: A replacement chain that loops
Given the base spec with removed invariants "INV-002", superseded by "INV-003" on line 8, and "INV-003", superseded by "INV-002" on line 12
When lint.Lint runs
Then lint.Report.findings is exactly two "L016" errors, each with fix "point the last unit of the chain to the current, active unit" (R3):
| line | id | message |
| 8 | "INV-002" | "INV-002 is superseded in a cycle: INV-002 → INV-003 → INV-002" |
| 12 | "INV-003" | "INV-003 is superseded in a cycle: INV-003 → INV-002 → INV-003" |

### S10: A deprecated unit whose chain ends at a removed one
Given the base spec with "INV-002" deprecated and superseded by "INV-003" on line 8, "INV-003" removed and superseded by "INV-004", and "INV-004" removed with no replacement
When lint.Lint runs
Then lint.Report.findings is exactly: error "L016" at "core/invariants.md" line 8, id "INV-002", fix "callers of a deprecated unit need a live replacement" (R3)
And its message is "deprecated INV-002 is superseded by INV-003, whose chain ends at INV-004, which is removed; point it at the unit that replaces it now"

## Rules
- R1: A live unit's link to a removed unit is an L005 error, and so is a live feature or contract in a removed module; links from removed units and superseded_by links are not checked
- R2: An active unit's link to a deprecated unit is an L005 warning, and so is a live feature or contract in a deprecated module; a deprecated unit may link to a deprecated one
- R3: Every L016 finding is an error: a replacement must be a unit of the same kind, an active unit has none, no chain loops, and a deprecated unit's chain reaches an active unit

## Out of scope
- When a unit may be deprecated or removed: format
