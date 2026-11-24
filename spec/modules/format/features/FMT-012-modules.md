---
id: FMT-012
title: Divide the spec into modules
module: format
status: active
observes: [lint.Finding.id, lint.Finding.message]
retired: [S2, S3, S4, S6, S7, R2, R3]
---
## Intent
A module owns a part of the product: its folder holds a `_module.md` that says what it owns and does not, its contracts, and its features, numbered with its prefix. Another system's API is a module of its own, marked external, that records only the contracts this product uses. Which module depends on which is never written; it follows from the contracts features use.

## Behaviour
### S1: A module is its folder's _module.md
Given "modules/alpha/_module.md" has "id: alpha", "prefix: ALP", "domain: make" and "status: active"
When `spec show "alpha" --format json` runs
Then format.Unit.kind is "module" and format.Unit.file is "modules/alpha/_module.md" (R1)
And format.Module.prefix is "ALP" and format.Module.domain is "make"

### S5: An external module holds contracts and no features
Given "modules/pay/_module.md" has format.Module.external true, and "pay.Charge" is an operation no feature provides
And the feature "BET-001" has the step "And pay.Charge charges 20"
When `spec lint` runs
Then it reports no finding whose lint.Finding.id is "BET-001" or "pay.Charge" (R4)

### S8: A feature may pass on an external error
Given the feature "BET-001" names the external error "pay.Declined" only in Then steps
When `spec lint` runs
Then no lint.Finding.message names "pay.Declined" (R4)

## Rules
- R1: modules/<module>/_module.md holds id (the folder name), prefix, domain and status, and optionally external, superseded_by and questions; then a paragraph on what it owns, "## Owns" and "## Non-goals".
- R4: An external module holds only the contracts this product uses: no features, no feature provides its operations or emits its events, and a feature may pass on its errors.

## Out of scope
- Deriving module dependencies: graph
- Grouping modules by domain in index.md: graph
- Reserved and duplicate prefixes: lint
- The findings for a module id that is not its folder, a written dependency, an unregistered prefix, a feature in an external module, and providing an external operation or emitting an external event: LNT-004, LNT-005, LNT-006, LNT-007, LNT-008
