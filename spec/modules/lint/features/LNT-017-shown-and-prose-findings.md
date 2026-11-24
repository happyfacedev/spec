---
id: LNT-017
title: Report unshown rules and invariants, and dangling prose IDs (L023, L025, L026)
module: lint
status: active
writes: [lint.Report.findings]
---
## Intent
A rule or an invariant only holds when a test checks it, and a test exists only for a scenario, so lint warns about a rule no scenario of its feature cites (L023) and an invariant no scenario shows, directly or through a rule it shows (L025), unless the invariant says how it is shown instead. An ID written in prose makes no link, but it must still name a unit that exists (L026). All three are warnings. Each scenario starts from the base spec of LNT-001 and runs lint.Lint. Inside a quoted message or fix, '' stands for a double quote the text holds.

## Behaviour
### S1: A rule no scenario cites
Given the base spec where the Then of "ALP-001" no longer cites its rule, which is on line 23 and still cites "INV-001"
When lint.Lint runs
Then lint.Report.findings holds: warning "L023" at "modules/alpha/features/ALP-001-make-a-widget.md" line 23, id "ALP-001/R1" (R1)
And its message is "no scenario of ALP-001 shows ALP-001/R1"
And its fix is "cite it, (R1), in a step of the scenario that shows it, or add one"

### S2: An invariant shown only through an unshown rule
Given the spec of S1
When lint.Lint runs
Then lint.Report.findings also holds: warning "L025" at "core/invariants.md" line 3, id "INV-001", message "no scenario shows INV-001" (R2)
And its fix is "cite it, (INV-001), in a step that checks it, or in a rule a scenario shows; if no scenario can, say how it is checked: ''Shown by: <benchmark, review, …>''"
And cli.CommandResult.exitCode is 0

### S3: A listed invariant no step shows
Given the base spec with an invariant "INV-002" on line 7 of "core/invariants.md", listed in the invariants of "ALP-001" but cited by no step or rule
When lint.Lint runs
Then lint.Report.findings is exactly: warning "L025" at "core/invariants.md" line 7, id "INV-002", message "no scenario shows INV-002" (R2)

### S4: An invariant shown another way
Given the spec of S3 with "Shown by: the size check in CI" under "INV-002"
When lint.Lint runs
Then lint.Report.findings is empty (R2)

### S5: An ID in prose that names no unit
Given the base spec with "- Bulk orders, which BET-099 handles" under "## Out of scope" of "ALP-001", on line 26, and no feature "BET-099"
When lint.Lint runs
Then lint.Report.findings is exactly: warning "L026" at "modules/alpha/features/ALP-001-make-a-widget.md" line 26, id "ALP-001" (R3)
And its message is "ALP-001 mentions BET-099, which does not exist"
And its fix is "correct the ID, or write the name without an ID"

### S6: What prose may hold without a finding
Given the base spec with "- Bulk orders, ''BET-099'', SHA-256, BUG-777" under "## Out of scope" of "ALP-001", the missing feature ID in double quotes
When lint.Lint runs
Then lint.Report.findings is empty, since a quoted string is a value, "SHA" is no module's prefix and "BUG-777" is a ticket ID (R3)

### S7: A contract ID in prose
Given the spec of S6 with ", alpha.Gadget" added to that line
When lint.Lint runs
Then lint.Report.findings is exactly: warning "L026" at "modules/alpha/features/ALP-001-make-a-widget.md" line 26, id "ALP-001", message "ALP-001 mentions alpha.Gadget, which does not exist" (R3)

### S8: An ID in a contract description
Given the base spec with "One widget, see INV-404." as the summary of "alpha.Widget", on line 5
When lint.Lint runs
Then lint.Report.findings is exactly: warning "L026" at "modules/alpha/contracts.md" line 5, id "alpha.Widget", message "alpha.Widget mentions INV-404, which does not exist" (R3)

## Rules
- R1: A rule of a live feature that no scenario of that feature cites is an L023 warning
- R2: An active invariant without a Shown by line that no scenario of a live feature cites, directly or through a rule it cites, is an L025 warning
- R3: An ID in the prose of a module, feature, decision, screen, contract or invariant that names no unit and no link target is an L026 warning; quoted strings, headings, frontmatter and ticket IDs are skipped, and a feature, scenario or rule ID counts only with one of this spec's prefixes

## Out of scope
- Checking that a changed rule or invariant changes a scenario too: pipeline (check-report)
