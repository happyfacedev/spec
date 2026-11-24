---
id: BET-001
title: Order a widget
module: beta
status: active
writes: [beta.Order.total]
---
## Intent
Let the user order a widget once it is made.

## Behaviour
### S1: Order priced by size
Given alpha.WidgetMade was emitted for a widget
And alpha.Widget.size is 2
Then beta.Order.total is 20
Afterwards nothing else happens

### S1: Order again
Given beta.Order.total is 20
When the user orders again
Then a second order is made

## Rules
None

## Out of scope
- Discounts
