---
id: LNT-007
title: Report reused IDs and unregistered prefixes (L003, L014)
module: lint
status: active
writes: [lint.Report.findings]
invariants: [INV-001]
---
## Intent
An ID is never reused (INV-001), so lint reports an ID defined twice, a retired scenario or rule number taken again, and a ticket ID used by two tickets (L003). Feature IDs are numbered with a module's prefix, so it also reports a prefix two modules claim, a reserved prefix, and a feature whose prefix no module registers (L014). Each scenario starts from the base spec of LNT-001 and runs lint.Lint.

## Behaviour
### S1: A contract defined twice in one module
Given the base spec with a second "alpha.WidgetMade" on line 3 of "modules/alpha/contracts/extra.md"; the first is on line 13 of "modules/alpha/contracts.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L003" at "modules/alpha/contracts/extra.md" line 3, id "alpha.WidgetMade" (INV-001, R1)
And its message is "alpha.WidgetMade is already defined in modules/alpha/contracts.md:13"
And its fix is "IDs are never reused; give this unit a new ID"

### S2: The later file of a duplicate is the one reported
Given the base spec with a copy of "ALP-001" saved as "modules/alpha/features/ALP-001-copy.md"
When lint.Lint runs
Then lint.Report.findings is three "L003" errors in "modules/alpha/features/ALP-001-make-a-widget.md", for "ALP-001" on line 1, "ALP-001/S1" on line 15 and "ALP-001/R1" on line 23 (R1)
And the first message is "ALP-001 is already defined in modules/alpha/features/ALP-001-copy.md:1"

### S3: A retired scenario number used again
Given the base spec with "retired: [S1]" in the frontmatter of "ALP-001", which still has a scenario S1 on line 16
When lint.Lint runs
Then lint.Report.findings is exactly: error "L003" at "modules/alpha/features/ALP-001-make-a-widget.md" line 16, id "ALP-001/S1" (INV-001)
And its message is "ALP-001/S1 is retired; its number is never used again"
And its fix is "give it the next unused number, or remove S1 from retired if it was never released"

### S4: A rule number used twice
Given the base spec with a second rule "R1: Again" on line 24 of "ALP-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L003" at "modules/alpha/features/ALP-001-make-a-widget.md" line 24, id "ALP-001/R1" (R1)
And its message is "rule ALP-001/R1 is defined twice"
And its fix is "give the rule a new number; never reuse one"

### S5: Two tickets with one ID
Given the base spec with a copy of "TASK-001" saved as "tickets/TASK-009.md"
When lint.Lint runs
Then lint.Report.findings holds: error "L003" at "tickets/TASK-009.md" line 1, id "TASK-001", message "ticket TASK-001 is also defined in tickets/TASK-001.md" (R1)
And its fix is "IDs are never reused; give this ticket a new ID"

### S6: Two modules with one prefix
Given the base spec with "prefix: ALP" in "modules/beta/_module.md"
When lint.Lint runs
Then lint.Report.findings is, in this order (R2):
| rule | severity | file | line | id | message | fix |
| "L014" | "error" | "modules/beta/_module.md" | 1 | "beta" | "prefix ALP is already registered by alpha" | "give each module its own prefix" |
| "L014" | "error" | "modules/beta/features/BET-001-order-a-widget.md" | 1 | "BET-001" | "BET-001 has prefix BET, which no module registers" | "number it with its module's prefix, or register BET on a module" |

### S7: A reserved prefix
Given the base spec with "prefix: INV" in "modules/beta/_module.md"
When lint.Lint runs
Then lint.Report.findings holds: error "L014" at "modules/beta/_module.md" line 1, id "beta", message "prefix INV is reserved", fix "pick a prefix other than INV, ADR, UI, PROP, BUG, TASK" (R2)
And it holds the "L014" error for "BET-001", whose prefix no module registers

### S8: A retired rule number used again
Given the base spec with "retired: [R1]" in the frontmatter of "ALP-001", which still has the rule R1 on line 24
When lint.Lint runs
Then lint.Report.findings is exactly: error "L003" at "modules/alpha/features/ALP-001-make-a-widget.md" line 24, id "ALP-001/R1" (INV-001)
And its message is "ALP-001/R1 is retired; its number is never used again"
And its fix is "give it the next unused number, or remove R1 from retired if it was never released"

## Rules
- R1: Every L003 finding is an error, reported at the definition whose file path sorts later
- R2: Every L014 finding is an error; the prefixes INV, ADR, UI, PROP, BUG and TASK are reserved

## Out of scope
- A feature that moves to another module keeps its ID and prefix: format
