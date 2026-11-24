---
id: CRT-002
title: Show the total
module: cart
status: active
writes: [cart.Cart.totalCents]
invariants: [INV-001]
---
## Intent
Show the shopper what the cart costs, exactly, in cents.

## Behaviour
### S1: Total of several lines
Given cart.Cart.lines holds "apple" at 120 cents with quantity 2 and "pear" at 75 cents with quantity 1
When the shopper reads the total
Then cart.Cart.totalCents is exactly 315 (INV-001)

### S2: Empty cart
Given an empty cart
When the shopper reads the total
Then cart.Cart.totalCents is 0

## Rules
None

## Out of scope
- Taxes and discounts
