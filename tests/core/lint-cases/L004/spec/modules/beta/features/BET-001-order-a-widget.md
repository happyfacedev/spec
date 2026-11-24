---
id: BET-001
title: Order a widget
module: beta
status: active
writes: [beta.Order.total]
invariants: [INV-009]
---
## Intent
Let the user order a widget once it is made.

## Behaviour
### S1: Order priced by size
Given alpha.WidgetMade was emitted for a widget
And alpha.Widget.size is 2 and alpha.Widget.colour is red
When the user orders it
Then beta.Order.total is 20

## Rules
None

## Out of scope
- Discounts
