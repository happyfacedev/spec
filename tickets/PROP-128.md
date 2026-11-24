---
id: PROP-128
type: proposal
title: The gate warns when a ticket's uncuttable brief is several times its role budget, and suggests splitting it
status: open
stage: null
touches: [TKT-007, PIP-013, TKT-012]
violates: []
depends_on: []
changed: []
questions:
  - id: Q1
    kind: preference
    text: How wide is too wide?
    default: when the part of any role's brief that PIP-013/R3 never cuts is more than 3 times that role's budget; the factor is configurable in budgets
    cites: [PIP-013]
    answer: null
    raised_by: null
  - id: Q2
    kind: preference
    text: Does a wide ticket only warn, or is it refused?
    default: "only a warning: the gate still passes, spec gate and spec next print it with the size and the largest features in scope, and nothing is refused"
    cites: [TKT-007]
    answer: null
    raised_by: null
history: []
---
Scale review of 2026-11-22. A ticket's cost grows with how many features it crosses, not with the size of the spec. PROP-125 touched 19 units and changed 46; its tester brief was 15,768 tokens against a 4,000 budget after every cut ("Nothing required was dropped"), and the delegated task file was 77,000 characters. The budget cuts (PIP-013) can only drop optional detail, so a wide ticket reaches every stage over budget, and nobody is told before the first stage starts.

What I want: the gate measures, for each role, the size of the brief that PIP-013/R3 never cuts, from the ticket's touches, and warns when one is too wide. The warning names the size, the budget and the features that weigh most, and suggests splitting the ticket into narrower ones that depend on each other; `ticket combine` already does the reverse. A warning is data for the person and never refuses the ticket (INV-017).
