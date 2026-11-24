---
id: LNT-015
title: Report bad questions, oversized units and doubled terms (L010, L011, L018)
module: lint
status: active
writes: [lint.Report.findings]
---
## Intent
Three rules keep the spec usable by the agents that read it. A question is a blocker or a preference with a default, and one about a contract, a member, an invariant or a decision is a blocker (L010). Each unit has a line budget so a brief stays small, with a warning from 80% of it (L011). Each glossary term and alias is defined once (L018). Each scenario starts from the base spec of LNT-001 and runs lint.Lint. Inside a quoted message or fix, '' stands for a double quote the text holds.

## Behaviour
### S1: A preference without a default
Given the base spec where the preference "Q1" of "TASK-001", on line 11, has "default: null"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L010" at "tickets/TASK-001.md" line 11, id "TASK-001#Q1" (R1)
And its message is "preference TASK-001#Q1 has no default"
And its fix is "add the default work proceeds on, or make it a blocker"

### S2: A preference that cites an invariant
Given the base spec with a preference "Q1" on line 11 of "ALP-001", with a default, citing "INV-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L010" at "modules/alpha/features/ALP-001-make-a-widget.md" line 11, id "ALP-001#Q1" (R1)
And its message is "ALP-001#Q1 cites INV-001, so it is a blocker"
And its fix is "set kind: blocker"

### S3: A glossary entry over its budget
Given the base spec with the entry "Widget" on line 3 of "core/glossary.md" grown to 6 lines
When lint.Lint runs
Then lint.Report.findings holds: error "L011" at "core/glossary.md" line 3, id "Widget" (R2)
And its message is "glossary entry ''Widget'' is 6 lines, over its 4-line budget"
And its fix is "split it into smaller units"

### S4: A glossary entry at its budget
Given the base spec with the entry "Order" on line 10 of "core/glossary.md" grown to 4 lines
When lint.Lint runs
Then lint.Report.findings holds: warning "L011" at "core/glossary.md" line 10, id "Order", fix "consider splitting it before it grows further" (R2)
And its message is "glossary entry ''Order'' is 4 lines, 100% of its 4-line budget"

### S5: A budget set in config.json
Given the base spec with "budgets": {"size.feature": 20} in "config.json"; "ALP-001" is 26 lines and "BET-001" 22
When lint.Lint runs
Then lint.Report.findings is exactly two "L011" errors at line 1, each with fix "split it into smaller units" (R2, R3):
| file | id | message |
| "modules/alpha/features/ALP-001-make-a-widget.md" | "ALP-001" | "feature ALP-001 is 26 lines, over its 20-line budget" |
| "modules/beta/features/BET-001-order-a-widget.md" | "BET-001" | "feature BET-001 is 22 lines, over its 20-line budget" |

### S6: The skill file at its budget
Given the base spec, whose "SKILL.md" is 7 lines, with "budgets": {"size.skill": 7} in "config.json"
When lint.Lint runs
Then lint.Report.findings is exactly: warning "L011" at "SKILL.md" line 1, id null, message "SKILL.md is 7 lines, 100% of its 7-line budget", fix "consider splitting it before it grows further" (R2, R3)

### S7: An alias another term already claims
Given the base spec with "Aliases: Widgets" on line 9 of "core/glossary.md", under "Order", while "Widget" has the alias "widgets"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L018" at "core/glossary.md" line 9, id "Order" (R4)
And its message is "''Widgets'' is already defined by ''Widget''"
And its fix is "define each term and alias once; merge the entries or drop the alias"

## Rules
- R1: Every L010 finding is an error; it applies to the questions of features, modules, decisions, screens and tickets
- R2: A unit over its budget is an L011 error, and one at 80% of it or more, rounded up, an L011 warning; the budgets are 20 lines for "SKILL.md", 250 for a feature, 600 for a contracts file, 15 for an invariant, 120 for a decision and 4 for a glossary entry
- R3: "budgets" in "config.json" overrides a budget, keyed "size.skill", "size.feature", "size.contracts", "size.invariant", "size.adr" or "size.glossary"
- R4: Terms and aliases are compared ignoring case, in file order, and the later definition is the one reported, as an L018 error

## Out of scope
- Answering questions: tickets
