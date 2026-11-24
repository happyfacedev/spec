---
id: LNT-012
title: Report links the steps do not state (L008)
module: lint
status: active
writes: [lint.Report.findings]
---
## Intent
The steps are where a feature's links live: a link written in the frontmatter must be named by a step, and a step that names it must be of the kind the link takes. What the feature writes or emits is checked in a Then, what it consumes arrives in a Given or When, an operation it provides is what a When invokes, and one it calls is named in a When or a Then. A screen or an invariant a step cites must be listed under `ui` or `invariants`. L008 reports each mismatch. Each scenario starts from the base spec of LNT-001 and runs lint.Lint.

## Behaviour
### S1: A listed screen no step shows
Given the base spec where the step of "ALP-001" that showed "UI-001" now reads "And beta.Order is not touched", and "ui: [UI-001]" stays on line 9
When lint.Lint runs
Then lint.Report.findings is exactly: error "L008" at "modules/alpha/features/ALP-001-make-a-widget.md" line 9, id "ALP-001" (R1)
And its message is "UI-001 is in ui but no step cites it"
And its fix is "write UI-001 in the step that shows it, or remove it from ui"

### S2: A step shows a screen the feature does not list
Given the base spec with "And UI-001 is shown" on line 17 of "BET-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L008" at "modules/beta/features/BET-001-order-a-widget.md" line 17, id "BET-001/S1" (R1)
And its message is "BET-001/S1 cites UI-001, which is not in ui"
And its fix is "add UI-001 to ui, or remove it from the step"

### S3: A step cites an invariant the feature does not list
Given the base spec with "Then beta.Order.total is 20 (INV-001)" on line 16 of "BET-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L008" at "modules/beta/features/BET-001-order-a-widget.md" line 16, id "BET-001/S1" (R1)
And its message is "BET-001/S1 cites INV-001, which is not in invariants"
And its fix is "add INV-001 to invariants, or remove it from the step"

### S4: A written link no step names
Given the base spec with "observes: [beta.Order]" on line 7 of "ALP-001", whose steps never name it
When lint.Lint runs
Then lint.Report.findings is exactly: error "L008" at "modules/alpha/features/ALP-001-make-a-widget.md" line 7, id "ALP-001" (R1)
And its message is "beta.Order is in observes but no step cites it"
And its fix is "write beta.Order in the step that depends on it, or remove it from observes"

### S5: A write named only before the outcome
Given the base spec where "BET-001" names "beta.Order.total" only in a Given and its Then reads "Then the order is made"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L008" at "modules/beta/features/BET-001-order-a-widget.md" line 6, id "BET-001" (R2)
And its message is "BET-001 writes beta.Order.total, but no Then step cites it"
And its fix is "a write is an outcome: cite it in the Then that checks it, or list it under reads or observes if the feature does not write it"

### S6: A provided operation not invoked in a When
Given the base spec with an operation "alpha.MakeWidget", "provides: [alpha.MakeWidget]" on line 7 of "ALP-001", and the operation named only in its Given
When lint.Lint runs
Then lint.Report.findings is exactly: error "L008" at "modules/alpha/features/ALP-001-make-a-widget.md" line 7, id "ALP-001" (R2)
And its message is "ALP-001 provides alpha.MakeWidget, but no When step cites it"
And its fix is "a provided operation is what the When invokes: cite it there, or list it under calls or observes if the feature does not implement it"

### S7: A called operation named only in a Given
Given the base spec with an operation "alpha.MakeWidget" that no feature provides, named only in the Given on line 13 of "BET-001"
When lint.Lint runs
Then lint.Report.findings holds: error "L008" at "modules/beta/features/BET-001-order-a-widget.md" line 13, id "BET-001" (R2)
And its message is "BET-001 calls alpha.MakeWidget, but no When or Then step cites it"
And its fix is "a call is part of what happens: cite it in the When that makes it or the Then that checks it, or list it under observes if the scenario only sets it up"

### S8: An emitted event named only in a Given
Given the base spec with "emits: [alpha.WidgetMade]" on line 7 of "BET-001", which names the event only in its Given
When lint.Lint runs
Then lint.Report.findings holds: error "L008" at "modules/beta/features/BET-001-order-a-widget.md" line 7, id "BET-001" (R2)
And its message is "BET-001 emits alpha.WidgetMade, but no Then step cites it"
And its fix is "an emitted event or error is an outcome: cite it in the Then that checks it, or list it under consumes or observes if the feature does not emit it"

### S9: A consumed event named only in a Then
Given the base spec with "consumes: [alpha.WidgetMade]" on line 7 of "BET-001", which names the event only in "And alpha.WidgetMade is not emitted" after its Then
When lint.Lint runs
Then lint.Report.findings holds: error "L008" at "modules/beta/features/BET-001-order-a-widget.md" line 7, id "BET-001" (R2)
And its message is "BET-001 consumes alpha.WidgetMade, but no Given or When step cites it"
And its fix is "a consumed event or error arrives before the outcome: cite it in the Given or When, or list it under observes if the scenario only checks it"

### S10: An observed contract may be named anywhere
Given the base spec with "observes: [alpha.WidgetMade]" on "BET-001", which names the event only in its Given
When lint.Lint runs
Then lint.Report.findings is empty (R2)

## Rules
- R1: Every L008 finding is an error
- R2: And and But count as the keyword before them; writes and emits need a Then, consumes a Given or When, provides a When, calls a When or Then, and reads and observes any step

## Out of scope
- Which links a step derives: format
