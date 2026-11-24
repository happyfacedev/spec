---
id: FMT-010
title: Record decisions
module: format
status: active
retired: [S5, R4]
questions:
  - id: Q1
    kind: preference
    text: "A decision's status is accepted or superseded, read as active or removed; docs/FORMAT.md says every unit's status is active, deprecated or removed. Keep accepted and superseded for decisions?"
    default: "Yes: decisions keep accepted and superseded"
    cites: [FMT-010/S1, FMT-010/S2]
    answer: 'Keep today''s behaviour; fix the docs or wording only (decided in review, 2026-10-29).'
    raised_by: null
---
## Intent
A decision records why the spec is the way it is, so a later change can see what was weighed. Features, contracts and invariants link the decisions behind them, and a decision that is replaced stays as history.

## Behaviour
### S1: An accepted decision is active
Given "decisions/ADR-001-widgets-have-sizes.md" has "status: accepted"
When `spec show "ADR-001" --format json` runs
Then format.Unit.kind is "decision" and format.Unit.status is "active" (R1)

### S2: A superseded decision is removed
Given "ADR-001" has format.Decision.status "superseded"
When `spec show "ADR-001" --format json` runs
Then format.Unit.status is "removed" (R1)

### S3: Supersedes takes one ID or a list
Given "ADR-002" has "supersedes: ADR-001" and "ADR-003" has "supersedes: [ADR-001, ADR-002]"
When `spec build` writes "_generated/graph.json"
Then its "edges" hold a format.Link of kind "supersedes" from "ADR-002" to "ADR-001" (R2)
And from "ADR-003" to "ADR-001" and to "ADR-002"

### S4: A feature links the decisions behind it
Given the feature "ALP-001" lists "decisions: [ADR-001]"
When `spec show "ADR-001"` runs
Then its "Used by:" list holds "- ALP-001 decisions — Make a widget" (R3)

## Rules
- R1: A decision's status is accepted or superseded; accepted reads as active and superseded as removed.
- R2: supersedes names one decision or a list of them; superseded_by names the one that replaced it.
- R3: Features (decisions:), contracts and invariants (a Decisions: line) link the decisions behind them.

## Out of scope
- Where an ID written in a decision's prose must exist: lint
- The sections a decision file holds, and the finding when one is missing or out of order: LNT-010
