---
id: LNT-011
title: Report scenarios that are not Given, When, Then (L007)
module: lint
status: active
writes: [lint.Report.findings]
---
## Intent
A scenario is a `### S<n>: <title>` heading over step lines, each starting with Given, When, Then, And or But, with at least one When and one Then, and each step may carry one table or fenced block. Tests are written from scenarios, so L007 reports every scenario that breaks this shape. Each scenario starts from the base spec of LNT-001 and runs lint.Lint. Inside a quoted message or fix, '' stands for a double quote the text holds.

## Behaviour
### S1: A scenario with no When
Given the base spec where S1 of "BET-001", on line 12, has Given, And and Then steps but no When
When lint.Lint runs
Then lint.Report.findings holds: error "L007" at "modules/beta/features/BET-001-order-a-widget.md" line 12, id "BET-001/S1" (R1)
And its message is "scenario BET-001/S1 has no When step"
And its fix is "add a When step for the action"

### S2: A scenario with no Then
Given the base spec where the Then of S1 of "BET-001" is written "And beta.Order.total is 20"
When lint.Lint runs
Then lint.Report.findings holds: error "L007" at "modules/beta/features/BET-001-order-a-widget.md" line 12, id "BET-001/S1", message "scenario BET-001/S1 has no Then step", fix "add a Then step for the outcome" (R1)

### S3: A step with another keyword
Given the base spec with the step "Afterwards nothing else happens" on line 16 of "BET-001"
When lint.Lint runs
Then lint.Report.findings holds: error "L007" at "modules/beta/features/BET-001-order-a-widget.md" line 16, id "BET-001/S1" (R1)
And its message is "step ''Afterwards nothing else happens'' does not start with Given, When, Then, And or But"
And its fix is "start the step with Given, When, Then, And or But"

### S4: A scenario number used twice
Given the base spec with a second scenario "### S1: Order again" on line 18 of "BET-001"
When lint.Lint runs
Then lint.Report.findings holds: error "L007" at "modules/beta/features/BET-001-order-a-widget.md" line 18, id "BET-001/S1", message "scenario number S1 is used twice in BET-001" (R1)
And its fix is "give each scenario a new number; never reuse one"

### S5: A scenario heading without its number
Given the base spec with "### Order priced by size" as the scenario heading on line 12 of "BET-001"
When lint.Lint runs
Then lint.Report.findings holds: error "L007" at "modules/beta/features/BET-001-order-a-widget.md" line 12, id "BET-001" (R1)
And its message is "scenario heading ''Order priced by size'' is not ''S<n>: <title>''"
And its fix is "write the heading as ''### S<n>: <title>''"

### S6: A scenario that starts with a table
Given the base spec with a table line on line 13 of "BET-001", right under the heading of S1
When lint.Lint runs
Then lint.Report.findings is exactly: error "L007" at "modules/beta/features/BET-001-order-a-widget.md" line 13, id "BET-001/S1" (R1)
And its message is "scenario BET-001/S1 starts with a table or block, not a step"
And its fix is "put it under the step it belongs to"

### S7: A scenario that holds a list
Given the base spec with a bullet "- a bullet" on line 18 of "BET-001", after the steps of S1
When lint.Lint runs
Then lint.Report.findings is exactly: error "L007" at "modules/beta/features/BET-001-order-a-widget.md" line 18, id "BET-001/S1" (R1)
And its message is "scenario BET-001/S1 holds a list; scenarios are step lines, each with an optional table or fenced block"
And its fix is "rewrite it as Given / When / Then / And / But lines"

## Rules
- R1: Every L007 finding is an error

## Out of scope
- How steps link a feature to contracts: L008
