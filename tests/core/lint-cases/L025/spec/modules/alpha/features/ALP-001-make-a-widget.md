---
id: ALP-001
title: Make a widget
module: alpha
status: active
writes: [alpha.Widget]
invariants: [INV-001, INV-002]
decisions: [ADR-001]
ui: [UI-001]
---
## Intent
Make a widget when the user asks for one.

## Behaviour
### S1: Widget made
Given no widget exists
When the user makes a widget of size 2
Then alpha.Widget holds a widget of size 2 (R1)
And alpha.WidgetMade is emitted
And UI-001 is shown

## Rules
- R1: Every widget has a size (INV-001)

## Out of scope
None
