---
id: LNT-010
title: Report missing, extra and malformed sections (L006)
module: lint
status: active
writes: [lint.Report.findings]
questions:
  - id: Q1
    kind: preference
    text: "A decision's sections must come in the order Decision, Consequences, Context, Alternatives, which docs/FORMAT.md does not state. Keep that order?"
    default: "Yes: Decision, Consequences, Context, Alternatives"
    cites: [LNT-010/S18]
    answer: 'Keep today''s behaviour; fix the docs or wording only (decided in review, 2026-10-29).'
    raised_by: null
---
## Intent
Every unit file has a fixed set of `##` sections in a fixed order, so a reader and a brief always find the same thing in the same place. A feature has Intent, Behaviour, Rules and Out of scope; a module a responsibility paragraph, Owns and Non-goals; a decision Decision, Consequences, Context and Alternatives; a screen Layout, States and an optional Copy. L006 reports each section that is missing, extra, repeated, out of order, empty, or not in its shape. Each scenario starts from the base spec of LNT-001 and runs lint.Lint. Inside a quoted message or fix, '' stands for a double quote the text holds.

## Behaviour
### S1: Sections out of order
Given the base spec with "## Rules" moved above "## Behaviour" in "ALP-001", whose first section is on line 11
When lint.Lint runs
Then lint.Report.findings holds: error "L006" at "modules/alpha/features/ALP-001-make-a-widget.md" line 11, id "ALP-001", message "sections are out of order" (R1)
And its fix is "order them: ## Intent, ## Behaviour, ## Rules, ## Out of scope"

### S2: An empty section that may say None
Given the base spec with nothing under "## Out of scope" on line 25 of "ALP-001"
When lint.Lint runs
Then lint.Report.findings holds: error "L006" at "modules/alpha/features/ALP-001-make-a-widget.md" line 25, id "ALP-001", message "section ''## Out of scope'' is empty", fix "write None under it" (R1)

### S3: A section that may not say None
Given the base spec with "None" as the whole of "## Intent" of "ALP-001", on line 11
When lint.Lint runs
Then lint.Report.findings is exactly: error "L006" at "modules/alpha/features/ALP-001-make-a-widget.md" line 11, id "ALP-001", message "section ''## Intent'' cannot be None", fix "fill it in" (R1)

### S4: A section that is missing
Given the base spec with "## Out of scope" removed from "ALP-001", whose last line is then 23
When lint.Lint runs
Then lint.Report.findings is exactly: error "L006" at "modules/alpha/features/ALP-001-make-a-widget.md" line 23, id "ALP-001", message "missing section ''## Out of scope''" (R1)
And its fix is "add ''## Out of scope'', or write None under it"

### S5: A section that does not belong
Given the base spec with a section "## Notes" on line 25 of "ALP-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L006" at "modules/alpha/features/ALP-001-make-a-widget.md" line 25, id "ALP-001", message "unexpected section ''## Notes''" (R1)
And its fix is "use only these sections, in order: ## Intent, ## Behaviour, ## Rules, ## Out of scope"

### S6: A section written twice
Given the base spec with a second "## Rules" on line 28 of "ALP-001", after "## Out of scope"
When lint.Lint runs
Then lint.Report.findings holds: error "L006" at "modules/alpha/features/ALP-001-make-a-widget.md" line 28, id "ALP-001", message "section ''## Rules'' appears twice", fix "merge the two sections" (R1)
And it holds the "sections are out of order" error on line 11

### S7: Text before the first section
Given the base spec with "Stray text." on line 11 of "ALP-001", above "## Intent"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L006" at "modules/alpha/features/ALP-001-make-a-widget.md" line 11, id "ALP-001", message "content before ''## Intent''", fix "move it into a section" (R1)

### S8: An Intent of two paragraphs
Given the base spec with two paragraphs under "## Intent" of "ALP-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L006" at "modules/alpha/features/ALP-001-make-a-widget.md" line 11, id "ALP-001", message "''## Intent'' is one paragraph", fix "merge it into one paragraph" (R1)

### S9: Text before the first scenario
Given the base spec with "Some text." on line 15 of "ALP-001", between "## Behaviour" and its first scenario
When lint.Lint runs
Then lint.Report.findings is exactly: error "L006" at "modules/alpha/features/ALP-001-make-a-widget.md" line 15, id "ALP-001", message "content before the first scenario" (R1)
And its fix is "move it into a ''### S<n>: <title>'' scenario"

### S10: A Behaviour with no scenarios
Given the base spec with the heading of the only scenario of "ALP-001" removed, so "## Behaviour" on line 14 holds only step lines
When lint.Lint runs
Then lint.Report.findings holds: error "L006" at "modules/alpha/features/ALP-001-make-a-widget.md" line 14, id "ALP-001", message "''## Behaviour'' has no scenarios" (R1)
And its fix is "add ''### S1: <title>'' with Given / When / Then steps"

### S11: Rules written as prose
Given the base spec with "Rules are prose." as the whole of "## Rules" of "ALP-001", on line 23
When lint.Lint runs
Then lint.Report.findings holds: error "L006" at "modules/alpha/features/ALP-001-make-a-widget.md" line 23, id "ALP-001", message "''## Rules'' holds ''- R<n>: …'' lines, or None" (R1)
And its fix is "turn this text into a ''- R<n>: …'' line"

### S12: A rule without its number
Given the base spec with a second rule "- Every widget is blue" on line 24 of "ALP-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L006" at "modules/alpha/features/ALP-001-make-a-widget.md" line 24, id "ALP-001", message "rule ''Every widget is blue'' is not ''R<n>: <text>''" (R1)
And its fix is "write the rule as ''- R<n>: <text>''"

### S13: An Out of scope that is not bullets
Given the base spec with "Bulk orders." as the whole of "## Out of scope" of "ALP-001", on line 26
When lint.Lint runs
Then lint.Report.findings is exactly: error "L006" at "modules/alpha/features/ALP-001-make-a-widget.md" line 26, id "ALP-001", message "''## Out of scope'' holds bullets or None" (R1)
And its fix is "turn this text into a bullet, or write None"

### S14: A removed feature that still holds scenarios
Given the base spec with "status: removed" on "BET-001", whose "## Behaviour" on line 11 still holds S1
When lint.Lint runs
Then lint.Report.findings is exactly: error "L006" at "modules/beta/features/BET-001-order-a-widget.md" line 11, id "BET-001" (R1, R2)
And its message is "removed BET-001 still holds S1; retire it (retired: [S1]) and write None under ## Behaviour"
And its fix is "a removed feature describes no behaviour; its tests go with it"

### S15: A module with no responsibility paragraph
Given the base spec with the paragraph above "## Owns" removed from "modules/beta/_module.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L006" at "modules/beta/_module.md" line 8, id "beta", message "the module has no responsibility paragraph" (R1)
And its fix is "start the body with one paragraph on what this module owns"

### S16: A module that owns None
Given the base spec with "None" as the whole of "## Owns" in "modules/beta/_module.md", on line 9
When lint.Lint runs
Then lint.Report.findings is exactly: error "L006" at "modules/beta/_module.md" line 9, id "beta", message "section ''## Owns'' cannot be None", fix "fill it in" (R1)

### S17: Text before the first section of a decision or a screen
Given the base spec with "Stray." above "## Decision" on line 7 of "ADR-001", and above "## Layout" on line 6 of "UI-001"
When lint.Lint runs
Then lint.Report.findings is exactly two "L006" errors, each with fix "move it into a section" (R1):
| file | line | id | message |
| "decisions/ADR-001-widgets-have-sizes.md" | 7 | "ADR-001" | "content before ''## Decision''" |
| "ui/UI-001-widget-card.md" | 6 | "UI-001" | "content before ''## Layout''" |

### S18: A decision with a section missing
Given the base spec with "## Alternatives" and the line under it removed from "ADR-001", whose last line is then 14
When lint.Lint runs
Then lint.Report.findings is exactly: error "L006" at "decisions/ADR-001-widgets-have-sizes.md" line 14, id "ADR-001", message "missing section ''## Alternatives''" (R1, R3)
And its fix is "add ''## Alternatives'', or write None under it"

## Rules
- R1: Every L006 finding is an error
- R2: A removed feature's Behaviour says None, and every scenario number it held is in its retired list
- R3: A decision file is frontmatter, then "## Decision", "## Consequences", "## Context" and "## Alternatives", in that order; all but Decision may say None

## Out of scope
- What each section holds: format
