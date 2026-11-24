---
id: FMT-005
title: Write a feature as scenarios and rules
module: format
status: active
observes: [lint.Finding.file, lint.Finding.message]
retired: [S9]
---
## Intent
A feature file holds one behaviour of the product: frontmatter with its ID and the links no step can state, then its intent, its scenarios as Given/When/Then steps, the rules several scenarios show, and what it leaves out. Each scenario and rule gets its own ID inside the feature, and the IDs its steps write are what the CLI reads as its cites.

## Behaviour
### S1: A scenario heading makes a scenario
Given the feature "ALP-001" has the heading "### S1: Widget made" under "## Behaviour"
When `spec build` writes "_generated/graph.json"
Then its "scenarios" hold format.Scenario.id "ALP-001/S1" with format.Scenario.title "Widget made" and feature "ALP-001" (R1)

### S2: The IDs a step writes are its cites
Given the scenario "ALP-001/S1" has the steps "Then alpha.Widget holds a widget of size 2" and "And UI-001 is shown"
When `spec build` writes "_generated/graph.json"
Then format.Scenario.cites of "ALP-001/S1" holds "alpha.Widget" and then "UI-001" (R2)

### S3: A table under a step is its data
Given the scenario "BET-001/S1" has the step "Then the order holds:" and under it the lines "| total |" and "| 20 |"
And the table's first line is "| beta.Order.total |" instead
When `spec build` writes "_generated/graph.json"
Then format.Scenario.cites of "BET-001/S1" holds "beta.Order.total" (R3)
And format.Step.data of that step is the two table lines

### S4: A fenced block under a step is its data
Given the scenario "ALP-001/S1" has the step "And the widget is announced with:" and under it a fenced json block holding the line `{ "name": "w1" }`
When `spec lint` runs
Then it reports no finding whose lint.Finding.file is the feature's file (R3)
And format.Step.data of that step is the fenced block

### S5: A heading inside a fenced block is not a scenario
Given the scenario "ALP-001/S1" has a step whose fenced block holds the line "### S2: Not a scenario"
When `spec build` writes "_generated/graph.json"
Then its "scenarios" hold "ALP-001/S1" and no "ALP-001/S2" (R6)

### S6: A rule line makes a rule
Given the feature "ALP-001" has the line "- R1: Every widget has a size (INV-001)" under "## Rules"
When `spec show "ALP-001/R1"` runs
Then the output is "modules/alpha/features/ALP-001-make-a-widget.md:23", a blank line, and "- R1: Every widget has a size (INV-001)" (R4)
And format.Rule.text is "Every widget has a size (INV-001)"

### S7: A rule cites the IDs in its text
Given the rule "ALP-001/R1" is "Every widget has a size (INV-001)"
When `spec show "INV-001"` runs
Then its "Cited by:" list holds "- ALP-001/R1 — Every widget has a size (INV-001)" (R4)

### S8: A step cites a rule short or in full
Given the scenario "ALP-001/S1" has the step "Then alpha.Widget holds a widget of size 2 (R1)"
When `spec show "ALP-001/R1"` runs
Then its "Cited by:" list holds "- ALP-001/S1 — Widget made" (R5)
And it holds the same line when the step ends "(ALP-001/R1)" instead

### S10: The frontmatter keys a feature may hold
Given the feature "ALP-001" sets format.Feature.id, format.Feature.title, format.Feature.module and format.Feature.status
And it sets format.Feature.writes, format.Feature.provides, format.Feature.observes, format.Feature.invariants, format.Feature.decisions, format.Feature.ui, format.Feature.retired, format.Feature.superseded_by and format.Feature.questions
When `spec lint` runs and each value names a unit of the right kind
Then it reports no finding whose lint.Finding.file is the feature's file and whose lint.Finding.message starts "unknown field" (R7)

## Rules
- R1: A scenario is a "### S<n>: <title>" heading under ## Behaviour and its step lines; its ID is <feature>/S<n>.
- R2: A step starts with Given, When, Then, And or But. Its cites are the contract, member, screen, invariant and rule IDs written in it and its data, in order of first appearance; a quoted string cites nothing.
- R3: Lines starting with a pipe, or a fenced block, right under a step are that step's data.
- R4: A rule is a "- R<n>: <text>" line under ## Rules; its ID is <feature>/R<n>, and every ID in its text is a cite.
- R5: A step cites a rule of its own feature as R<n> inside parentheses, or by its full ID.
- R6: Files are read as CommonMark: what a fenced block holds is never a heading.
- R7: A feature's frontmatter holds id, title, module and status, and optionally superseded_by, writes, provides, observes, the derived reads, calls, consumes and emits, invariants, decisions, ui, retired, questions, draft and sources; any other key is refused.

## Out of scope
- How steps link a feature to contracts: FMT-008
- Draft markers (draft and sources): adopt
- Lint findings on section order, step keywords, missing When or Then, scenario numbering and unknown frontmatter keys: lint
