# Conventions

## Scenario style

A scenario is one paragraph of step lines. Every line starts with Given, When, Then, And or But. Each scenario has at least one When and at least one Then.

Steps write contract IDs verbatim, for example `cart.AddItem`. The steps link the feature to what it reads, calls, consumes and emits; the frontmatter lists only `writes`, `provides` and `observes`, each written in at least one step.

## Error model

Operations return an error value from `CartError`, or null on success. They never throw for a bad input. Each error value is a `Kind: error` contract, such as `cart.InvalidQuantity`, named in the operation's `Output:`.
