---
id: CRT-001
title: Edit the cart
module: cart
status: active
writes: [cart.Cart.lines]
provides: [cart.AddItem]
invariants: [INV-001]
---
## Intent
Let the shopper put items in the cart, with a quantity of at least one.

## Behaviour
### S1: Add an item
Given an empty cart
When the shopper adds "apple" at 120 cents with quantity 2 through cart.AddItem
Then cart.Cart.lines is exactly one line: name "apple", priceCents 120, quantity 2

### S2: Quantity below 1
Given an empty cart
When the shopper adds "apple" at 120 cents with quantity 0 through cart.AddItem
Then adding fails with cart.InvalidQuantity (R1)
And cart.Cart.lines is empty

## Rules
- R1: Every line has a quantity of at least 1

## Out of scope
- Merging two lines with the same name
