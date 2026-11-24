---
id: LNT-006
title: Report malformed IDs and misplaced units (L002, L019)
module: lint
status: active
writes: [lint.Report.findings]
---
## Intent
An ID is how every link, test and ticket finds a unit, so lint refuses one that is malformed, that disagrees with the file or folder holding it, or that sits in the wrong place. L002 is the ID format rule; L019 says a contract or a member sits in another one's home. Each scenario starts from the base spec of LNT-001 and runs lint.Lint. Inside a quoted message or fix, '' stands for a double quote the text holds.

## Behaviour
### S1: A feature file not named after its ID
Given the base spec with "BET-001" saved as "modules/beta/features/order-a-widget.md"
When lint.Lint runs
Then lint.Report.findings holds: error "L002" at "modules/beta/features/order-a-widget.md" line 2, id "BET-001" (R1)
And its message is "file name order-a-widget.md does not start with BET-001"
And its fix is "rename the file to BET-001-<slug>.md"

### S2: A frontmatter link that is not an ID
Given the base spec with "decisions: [adr-1]" on line 7 of the frontmatter of "BET-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L002" at "modules/beta/features/BET-001-order-a-widget.md" line 7, id "BET-001" (R1)
And its message is "decisions[0]: ''adr-1'' is not a valid decision ID"
And its fix is "write it like ADR-001"

### S3: A frontmatter link to an ID of another kind
Given the base spec with "invariants: [INV-001, ADR-001]" on line 7 of "ALP-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L002" at "modules/alpha/features/ALP-001-make-a-widget.md" line 7, id "ALP-001", fix "write it like INV-001" (R1)
And its message is "invariants[1]: ''ADR-001'' is not a valid invariant ID"

### S4: A feature whose module is not its folder
Given the base spec with "module: beta" on line 4 of "ALP-001", which is in "modules/alpha/"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L002" at "modules/alpha/features/ALP-001-make-a-widget.md" line 4, id "ALP-001" (R1)
And its message is "module is beta but the file is in modules/alpha/"
And its fix is "set module: alpha, or move the file"

### S5: A module id that is not its folder
Given the base spec with "id: betas" on line 2 of "modules/beta/_module.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L002" at "modules/beta/_module.md" line 2, id "betas", message "module id betas does not match its folder modules/beta/", fix "set id: beta, or rename the folder" (R1)

### S6: A decision file not named after its ID
Given the base spec with "ADR-001" saved as "decisions/widgets.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L002" at "decisions/widgets.md" line 2, id "ADR-001", message "file name widgets.md does not start with ADR-001", fix "rename the file to ADR-001-<slug>.md" (R1)

### S7: A screen file not named after its ID
Given the base spec with "UI-001" saved as "ui/card.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L002" at "ui/card.md" line 2, id "UI-001", message "file name card.md does not start with UI-001", fix "rename the file to UI-001-<slug>.md" (R1)

### S8: A contract heading that is not module and name
Given the base spec with "### alpha.widget_made" as the heading on line 13 of "modules/alpha/contracts.md"
When lint.Lint runs
Then lint.Report.findings holds: error "L002" at "modules/alpha/contracts.md" line 13, id "alpha.widget_made" (R1)
And its message is "contract heading ''alpha.widget_made'' is not <module>.<Name>"
And its fix is "write the heading as ''### <module>.<Name>''"

### S9: A member heading that is not module, name and member
Given the base spec with "#### alpha.Widget" as the heading on line 10 of "modules/alpha/contracts.md"
When lint.Lint runs
Then lint.Report.findings holds: error "L002" at "modules/alpha/contracts.md" line 10, id "alpha.Widget" (R1)
And its message is "field heading ''alpha.Widget'' is not <module>.<Name>.<field>"
And its fix is "write the heading as ''#### alpha.Widget.<field>''"

### S10: A Decisions line that names no decision
Given the base spec with "Decisions: adr-1" on line 6, under "alpha.Widget"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L002" at "modules/alpha/contracts.md" line 6, id "alpha.Widget", fix "list ADR-<NNN> IDs, comma-separated" (R1)
And its message is "''adr-1'' in the Decisions line is not an ADR ID"

### S11: An invariant heading without an INV ID
Given the base spec with "### INV-1 A widget always has a size" as the heading on line 3 of "core/invariants.md"
When lint.Lint runs
Then lint.Report.findings holds: error "L002" at "core/invariants.md" line 3, id "INV-1 A widget always has a size" (R1)
And its message is "invariant heading ''INV-1 A widget always has a size'' is not ''INV-<NNN>: <title>''"
And its fix is "write the heading as ''### INV-<NNN>: <title>''"

### S12: A file in no known place
Given the base spec with a file "notes/todo.md" in the spec root
When lint.Lint runs
Then lint.Report.findings is exactly: error "L002" at "notes/todo.md" line 1, id null, message "notes/todo.md is not in a known place in the spec" (R1)
And its fix is "move it to core/, modules/<m>/, ui/ or decisions/, or delete it"

### S13: A role file not named after its role
Given the base spec with the role prompts in "spec/roles/", the reviewer's saved as "roles/review.md"
When lint.Lint runs with "--ci"
Then lint.Report.findings holds: error "L002" at "roles/review.md" line 1, id "reviewer", message "role file roles/review.md is not named reviewer.md", fix "rename it roles/reviewer.md" (R1)

### S14: A contract in another module's contracts file
Given the base spec where "modules/beta/contracts.md" holds an event "alpha.Gizmo" on line 13
When lint.Lint runs
Then lint.Report.findings holds: error "L019" at "modules/beta/contracts.md" line 13, id "alpha.Gizmo" (R1)
And its message is "alpha.Gizmo is defined in the beta contracts file"
And its fix is "move it to modules/alpha/contracts.md, or rename it beta.Gizmo"

### S15: A member under another contract
Given the base spec where "modules/beta/contracts.md" holds a member "alpha.Widget.colour" under "beta.Order" on line 10
When lint.Lint runs
Then lint.Report.findings holds: error "L019" at "modules/beta/contracts.md" line 10, id "alpha.Widget.colour" (R1)
And its message is "field alpha.Widget.colour sits under beta.Order"
And its fix is "rename it beta.Order.colour, or move it under its entity"

### S16: Role files are checked only with --ci
Given the spec of S13
When lint.Lint runs without "--ci"
Then lint.Report.findings is empty (R2)

### S17: A file name that starts with a longer number
Given the base spec with "ALP-001" saved as "modules/alpha/features/ALP-0011-widget.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L002" at "modules/alpha/features/ALP-0011-widget.md" line 2, id "ALP-001", message "file name ALP-0011-widget.md does not start with ALP-001", fix "rename the file to ALP-001-<slug>.md" (R1)

### S18: A retired entry that is not a scenario or rule number
Given the base spec with "retired: [S0x]" on line 10 of the frontmatter of "ALP-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L002" at "modules/alpha/features/ALP-001-make-a-widget.md" line 10, id "ALP-001" (R1)
And its message is "retired[0]: ''S0x'' is not a valid retired scenario or rule number (S<n> or R<n>) ID"
And its fix is "write a valid retired scenario or rule number (S<n> or R<n>) ID"

## Rules
- R1: Every L002 and L019 finding is an error
- R2: The role files are read, and their findings reported, only with --ci

## Out of scope
- The ID patterns themselves: format
- A ticket file not named after its ID: L020
