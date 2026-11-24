---
id: LNT-013
title: Report unused, overused and unowned contracts (L009, L012)
module: lint
status: active
writes: [lint.Report.findings]
---
## Intent
A contract nothing uses is dead weight or a missing feature, and an entity every feature uses as a whole makes every change to it reach every feature. An operation is a boundary one feature implements: one that features call while none provides it, or that two features provide, is a gap or a clash. These are warnings: L009 for an entity referenced whole by many features, L012 for what nothing references and for an operation without exactly one provider. Each scenario starts from the base spec of LNT-001 and runs lint.Lint.

## Behaviour
### S1: An entity eight features reference as a whole
Given the base spec with seven more active features "ALP-002" to "ALP-008", each naming "alpha.Widget" in a Given, besides "ALP-001", which writes it
When lint.Lint runs
Then lint.Report.findings is exactly: warning "L009" at "modules/alpha/contracts.md" line 3, id "alpha.Widget" (R1)
And its message is "8 features reference alpha.Widget as a whole"
And its fix is "reference the fields each feature uses, such as alpha.Widget.<field>"

### S2: Seven features are not too many
Given the base spec with six more active features "ALP-002" to "ALP-007" that each name "alpha.Widget"
When lint.Lint runs
Then lint.Report.findings is empty (R1)

### S3: A contract nothing references
Given the base spec with an event "beta.Refunded" on line 10 of "modules/beta/contracts.md", with a member "beta.Refunded.orderId", which no feature names
When lint.Lint runs
Then lint.Report.findings is exactly: warning "L012" at "modules/beta/contracts.md" line 10, id "beta.Refunded" (R2)
And its message is "nothing references beta.Refunded"
And its fix is "reference it from the features that read or write it, or deprecate it"

### S4: An operation called but never provided
Given the base spec with an operation "alpha.MakeWidget" on line 13 of "modules/alpha/contracts.md" that "BET-001" names in its When, and that no feature provides
When lint.Lint runs
Then lint.Report.findings is exactly: warning "L012" at "modules/alpha/contracts.md" line 13, id "alpha.MakeWidget" (R3)
And its message is "BET-001 calls alpha.MakeWidget, which no feature provides"
And its fix is "add alpha.MakeWidget to provides of the feature that implements it"

### S5: An operation two features provide
Given the base spec with the operation "alpha.MakeWidget" of S4 listed under provides by both "ALP-001" and "BET-001", each invoking it in its When
When lint.Lint runs
Then lint.Report.findings is exactly: warning "L012" at "modules/alpha/contracts.md" line 13, id "alpha.MakeWidget" (R3)
And its message is "alpha.MakeWidget is provided by ALP-001 and BET-001; one feature implements an operation"
And its fix is "keep provides on the feature that implements it, and calls on the others; two implementations are two operations"
And cli.CommandResult.exitCode is 0

### S6: An external operation needs no provider
Given the base spec with "external: true" on module "beta", without "BET-001", and an operation "beta.Pay" that "ALP-001" calls in its When
When lint.Lint runs
Then lint.Report.findings holds no "L012" warning for "beta.Pay" (R3)

## Rules
- R1: An active entity referenced as a whole, not through its members, by eight or more active features is an L009 warning
- R2: An active contract that no link reaches, neither to it nor to one of its members, and an active invariant, decision or screen no link reaches, is an L012 warning; a superseded_by link does not count
- R3: A live operation of this product that live features call while none provides it is an L012 warning for each caller, and one that two or more live features provide is an L012 warning; an external module's operations are exempt

## Out of scope
- Listing unused contracts for a person to confirm: adopt (spec gaps)
