---
id: FMT-008
title: Derive a feature's links from its steps
module: format
status: active
writes: [format.Link]
---
## Intent
A feature's steps already say what it uses: the CLI reads each contract a step names as a link, and its verb follows from the contract's kind and the step that names it. The frontmatter lists only the three facts no step can state: what the feature's code changes (`writes`), the operations it implements (`provides`) and the contracts its tests touch while its code does not (`observes`).

## Behaviour
### S1: An entity or type named in a step is read
Given the feature "BET-001" lists only "writes: [beta.Order.total]" and has the step "And alpha.Widget.size is 2" after a Given
When `spec show "alpha.Widget.size"` runs
Then format.Link.kind from "BET-001" is "reads", listed as "- BET-001 reads — Order a widget" under "Used by:" (R1)

### S2: An event named in a Given is consumed
Given the feature "BET-001" has the step "Given alpha.WidgetMade was emitted for a widget"
When `spec show "alpha.WidgetMade"` runs
Then its "Used by:" list holds "- BET-001 consumes — Order a widget", a format.Link of kind "consumes" (R1)

### S3: An operation named in a step is called
Given the feature "BET-001" has the step "When the user orders it through alpha.MakeWidget" and does not provide it
When `spec show "alpha.MakeWidget"` runs
Then its "Used by:" list holds "- BET-001 calls — Order a widget", a format.Link of kind "calls" (R1)

### S4: An error named only in a Then is emitted
Given the feature "BET-001" has the step "Then ordering fails with alpha.TooSmall" and names it in no When
When `spec show "alpha.TooSmall"` runs
Then its "Used by:" list holds "- BET-001 emits — Order a widget", a format.Link of kind "emits" (R1)

### S5: An event named in a When and a Then is consumed
Given the feature "BET-001" names the event "alpha.WidgetMade" in a When step and in a Then step
When `spec show "alpha.WidgetMade"` runs
Then its "Used by:" list holds "- BET-001 consumes — Order a widget" (R1)
And no format.Link of kind "emits" from "BET-001" to it

### S6: An error named in a Given and a Then is emitted
Given the feature "BET-001" names the error "alpha.TooSmall" in a Given step and in a Then step, and in no When
When `spec show "alpha.TooSmall"` runs
Then its "Used by:" list holds "- BET-001 emits — Order a widget" (R1)

### S7: And and But take the keyword before them
Given the feature "BET-001" has a Then step followed by the step "And alpha.WidgetMade was emitted before", and names the event nowhere else
When `spec show "alpha.WidgetMade"` runs
Then its "Used by:" list holds "- BET-001 emits — Order a widget" (R2)

### S8: A quoted string is data
Given the feature "BET-001" has the step `Then the exported text is "alpha.Size"` and names that contract nowhere else
When `spec build` writes "_generated/graph.json"
Then format.Scenario.cites of "BET-001/S1" does not hold "alpha.Size" (R3)
And its "edges" hold no format.Link from "BET-001" to "alpha.Size"

### S9: A member named in a step is covered by a link to its contract
Given the feature "ALP-001" lists "writes: [alpha.Widget]" and a step names "alpha.Widget.size"
When `spec show "alpha.Widget.size"` runs
Then its "Used by:" list holds "- ALP-001 writes alpha.Widget — Make a widget" (R4)
And no format.Link of kind "reads" from "ALP-001" to it

### S10: A written contract named only in a Then is the write it checks
Given the feature "BET-001" lists "writes: [beta.Order.total]" and adds the step "And no other beta.Order is added" after its Then
When `spec show "beta.Order"` runs
Then its "Used by:" list holds only "- BET-001 writes beta.Order.total — Order a widget" (R5)

### S11: A written contract named in a Given is read as well
Given the feature "BET-001" lists "writes: [beta.Order.total]" and has the step "And beta.Order is empty" before its When
When `spec show "beta.Order"` runs
Then its "Used by:" list holds "- BET-001 reads — Order a widget" and "- BET-001 writes beta.Order.total — Order a widget" (R5)

### S12: Observes covers what the steps name
Given the feature "BET-001" lists "observes: [alpha.WidgetMade]" and has the step "Given alpha.WidgetMade was emitted for a widget"
When `spec show "alpha.WidgetMade"` runs
Then its "Used by:" list holds "- BET-001 observes — Order a widget" (R6)
And no format.Link of kind "consumes" from "BET-001" to it

### S13: An observed event checked in a Then is not emitted
Given the feature "BET-001" lists "observes: [alpha.WidgetMade]" and has the step "And alpha.WidgetMade was emitted before" after a Then
When `spec build` writes "_generated/graph.json"
Then its "edges" hold no format.Link of kind "emits" from "BET-001" (R6)

### S14: Provides covers the operation its When invokes
Given the feature "ALP-001" lists "provides: [alpha.MakeWidget]" and has the step "When the user makes a widget of size 2 through alpha.MakeWidget"
When `spec show "alpha.MakeWidget"` runs
Then its "Used by:" list holds "- ALP-001 provides — Make a widget" (R6)
And no format.Link of kind "calls" from "ALP-001" to it

### S15: A hand-written derived link is kept
Given the feature "BET-001" lists "reads: [alpha.Widget.size]" and "consumes: [alpha.WidgetMade]" beside "writes: [beta.Order.total]"
When `spec show "alpha.Widget.size"` runs
Then its "Used by:" list holds "- BET-001 reads — Order a widget" (R7)
And `spec show "alpha.WidgetMade"` lists "- BET-001 consumes — Order a widget"

## Rules
- R1: A contract a step names, and no written link covers, is linked by its kind: an entity or type is read; an operation is called; an event or error is consumed when a When names it or only a Given does, and emitted otherwise.
- R2: And and But count as the Given, When or Then before them.
- R3: A quoted string, in a step or its data, is a value and names nothing.
- R4: A link to a contract covers all its members, and a link to a member covers its contract.
- R5: A contract the feature writes and names only in Thens adds no other link; named in a Given or When too, it is also read.
- R6: Writes, provides and observes are written in the frontmatter, and cover the steps that name what they list.
- R7: Reads, calls, consumes and emits written by hand are kept as written; a written link wins over a derived one.

## Out of scope
- Which link a contract's kind allows, where a written link must be named, and the warning on a hand-written derived link: lint
- Module dependencies derived from these links: graph
- Impact through these links: graph
