---
id: PROP-118
type: proposal
title: The decisions still in force move from DECISIONS.md into the spec's own decision units
status: open
stage: null
touches: [FMT-010]
violates: []
depends_on: []
changed: []
questions:
  - id: Q1
    kind: blocker
    text: "Which of X1 to X142 are still in force and worth a unit? Options: (a) only the ones a current contract, invariant or feature depends on, chosen by the spec-writer and listed for your yes before it writes them; (b) all 142; (c) a list you give."
    default: null
    cites: [FMT-010]
    answer: "(a): only the decisions a current contract, invariant or feature depends on; the spec-writer lists them for the person's yes before writing the units (approved in the 2026-11-22 scale review)"
    raised_by: null
history: []
---
Review of 2026-11-10. DECISIONS.md is 1,387 lines and 110 KB (X1 to X142): too large for a role or a person to read in one go, and outside the spec, so spec show, spec impact and briefs never reach it, while the spec's own decision format (FMT-010, spec/decisions/) holds only ten units, eight of them bypass records. The tool's design decisions live outside the tool's decision format. What I want: each decision that is still in force becomes an ADR unit in spec/decisions/, linked from the contracts and invariants it explains (the Decisions: line), so a brief that quotes a contract can quote why. DECISIONS.md stays as the dated history, with each migrated entry pointing at its ADR. This changes no behaviour, so it should run in the docs lane; a person sets lane: docs in this ticket's frontmatter before it starts.
