---
id: LNT-001
title: Lint the spec and the tickets
module: lint
status: active
writes: [lint.Report]
provides: [lint.Lint]
questions:
  - id: Q1
    kind: preference
    text: core/conventions.md says spec lint --ci exits non-zero only on errors, which reads as if plain spec lint never fails; the code exits 1 on any error with or without --ci. Should plain spec lint keep exiting 1 on errors?
    default: yes, spec lint exits 1 on any error, with or without --ci
    cites: []
    answer: 'Keep today''s behaviour (decided in review, 2026-10-29).'
    raised_by: null
---
## Intent
`spec lint` checks the whole spec and every ticket, and names each problem with a stable rule code, a file and line, a severity and a fix, so a person or an agent can correct it without reading the format document. It is the gate before every merge, so its output and exit code are what scripts and agents rely on. The rule features of this module all start from the base spec of S1 and change one thing in it.

## Behaviour
### S1: The base spec lints clean
Given the base spec, which holds:
| file | holds |
| "config.json" | "formatVersion": 2, tickets in "tickets/" of the project root |
| "modules/alpha/_module.md" | module "alpha", prefix "ALP" |
| "modules/alpha/contracts.md" | entity "alpha.Widget" with members "name" and "size", event "alpha.WidgetMade" with member "name" |
| "modules/alpha/features/ALP-001-make-a-widget.md" | feature "ALP-001", writing "alpha.Widget", with rule "R1" citing "INV-001" and one scenario showing "UI-001" |
| "modules/beta/_module.md" | module "beta", prefix "BET" |
| "modules/beta/contracts.md" | entity "beta.Order" with member "total" |
| "modules/beta/features/BET-001-order-a-widget.md" | feature "BET-001", writing "beta.Order.total" |
| "core/invariants.md" | invariant "INV-001", with decision "ADR-001" |
| "core/glossary.md" | terms "Widget" (alias "widgets") and "Order" |
| "decisions/ADR-001-widgets-have-sizes.md" | decision "ADR-001" |
| "ui/UI-001-widget-card.md" | screen "UI-001" |
| "tickets/TASK-001.md" | ticket "TASK-001", a task touching "ALP-001" with a preference question that has a default |
When the developer runs lint.Lint
Then cli.CommandResult.stdout is "lint clean" and a newline
And cli.CommandResult.exitCode is 0 (R1)

### S2: JSON output of a clean spec
Given the base spec
When the developer runs lint.Lint with "--format json"
Then lint.Report.spec is "spec@" followed by 8 hex digits
And lint.Report.findings is empty
And cli.CommandResult.exitCode is 0

### S3: An error without a unit
Given the base spec with "formatVersion": 3 in "config.json"
When the developer runs lint.Lint
Then cli.CommandResult.stdout is these three lines (R2):
| line |
| "config.json:1 error L001: config.json is format 3, newer than this spec CLI (format 2)" |
| "  fix: update the spec CLI" |
| "1 error, 0 warnings" |
And cli.CommandResult.exitCode is 1 (R1)

### S4: Warnings alone pass
Given the base spec with a second event "beta.Refunded" on line 10 of "modules/beta/contracts.md", which nothing references
When the developer runs lint.Lint
Then cli.CommandResult.stdout is these three lines (R2):
| line |
| "modules/beta/contracts.md:10 warning L012 beta.Refunded: nothing references beta.Refunded" |
| "  fix: reference it from the features that read or write it, or deprecate it" |
| "0 errors, 1 warning" |
And cli.CommandResult.exitCode is 0 (R1)

### S5: Findings are sorted by file, then line, then rule
Given the base spec where "modules/beta/contracts.md" also holds a member "alpha.Widget.colour" under "beta.Order" on line 10 and an event "alpha.Gizmo" on line 13
When the developer runs lint.Lint
Then lint.Report.findings is, in this order (R3):
| rule | severity | file | line | id |
| "L019" | "error" | "modules/beta/contracts.md" | 10 | "alpha.Widget.colour" |
| "L012" | "warning" | "modules/beta/contracts.md" | 13 | "alpha.Gizmo" |
| "L019" | "error" | "modules/beta/contracts.md" | 13 | "alpha.Gizmo" |
And the last line of cli.CommandResult.stdout is "2 errors, 1 warning"

### S6: JSON keys of a finding
Given the base spec with the unreferenced event "beta.Refunded" of S4
When the developer runs lint.Lint with "--format json"
Then lint.Report.findings is one object with exactly these keys, in this order: "rule", "severity", "file", "line", "id", "message", "fix"
And its values are "L012", "warning", "modules/beta/contracts.md", 10, "beta.Refunded", "nothing references beta.Refunded" and "reference it from the features that read or write it, or deprecate it"
And cli.CommandResult.exitCode is 0

### S7: JSON output exits 1 on an error
Given the base spec with "formatVersion": 3 in "config.json"
When the developer runs lint.Lint with "--format json"
Then lint.Report.findings holds the one "L001" error of S3
And cli.CommandResult.exitCode is 1 (R1)

### S8: Ticket findings name the file from the project root
Given the base spec where the question of "TASK-001" has default null
When the developer runs lint.Lint
Then lint.Report.findings is one "L010" error in "tickets/TASK-001.md" on line 11 (R5)

### S9: L013 is retired
Given the base spec with "requires: [BET-001]" on line 10 of the frontmatter of "ALP-001"
When the developer runs lint.Lint
Then lint.Report.findings is one "L001" error on line 10 with message "unknown field requires in feature" and fix "remove requires or fix its spelling", and no finding has rule "L013" (R4)

### S10: L015 is retired
Given the base spec where "core/overview.md" also holds a "## Modules" list naming "alpha" and "gamma"
When the developer runs lint.Lint
Then cli.CommandResult.stdout is "lint clean" and a newline, and no finding has rule "L015" (R4)

## Rules
- R1: spec lint exits 1 when any finding is an error, and 0 when there are none, whatever the warnings
- R2: The text output prints each finding as its location, severity, rule and unit, a colon and the message, then an indented fix line, and ends with "lint clean" or the count of errors and warnings, each pluralized
- R3: Findings are sorted by file, then line, then rule code, then unit ID, then message, and a finding found twice is listed once
- R4: The retired codes L013 and L015 are never reported
- R5: A finding's file is relative to the spec root, except a ticket's, which is relative to the project root

## Out of scope
- The global options and the usage error of an unknown --format value: cli
- What each rule checks: the other features of this module
