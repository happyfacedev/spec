# Conventions

## Scenario style

A scenario is one paragraph of step lines. Every line starts with Given, When, Then, And or But. Each scenario has at least one When and at least one Then.

Steps write contract and screen IDs verbatim, for example `providers.RateLimited` or `UI-001`. The steps link the feature to what it reads, calls, consumes and emits; the frontmatter lists only `writes`, `provides` and `observes`, each written in at least one step.

## Error model

Errors are values with a code, not thrown surprises. Each error is a `Kind: error` contract, such as `conversation.ProviderDisabled`: the scenario of the feature that fails with it writes it verbatim in a Then. The caller decides what to show. Error values never carry API key material.
