# Conventions

## Scenario style

A scenario is one paragraph of step lines. Every line starts with Given, When, Then, And or But. Each scenario has at least one When and at least one Then. Each Then states a value a test can check.

Steps write contract and screen IDs verbatim, and so link the feature to what it reads, calls, consumes and emits. The frontmatter lists only `writes`, `provides` and `observes`, each written in at least one step. A quoted string is data, never an ID: `Then the export is "vendor.Cancelled"` names no contract.

## Member names

Members use one casing across the whole spec: lowerCamel (`priceCents`, `createdAt`). Each stack maps it once, as it maps types: `price_cents` in Python, `PriceCents` in Go. A member ID never changes, so decide this before the first contract.

## Error model

Describe how failures are reported, for example: errors are values with a code, and they never carry secrets. Each error is a `Kind: error` contract, and the step that fails with it names it: "Then adding fails with cart.InvalidQuantity".
