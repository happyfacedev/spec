---
id: PROP-126
type: proposal
title: spec stats shows each stage's brief size against its role budget, and how often briefs ran over
status: open
stage: null
touches: [PIP-020, PIP-025, PIP-013]
violates: []
depends_on: []
changed: []
questions:
  - id: Q1
    kind: preference
    text: Where is a stage's brief size recorded?
    default: in the stage record ticket advance writes, as the brief's size in tokens and the role's budget at the time, taken from the task spec next built
    cites: [PIP-025]
    answer: null
    raised_by: null
history: []
---
Scale review of 2026-11-22. Before building anything to keep briefs small as the spec grows, measure where they are already too big. spec stats records time, model and cost per role (PIP-025), but not the size of the brief each stage started from, so nobody can tell which roles or which tickets run over budget, or whether a change made briefs smaller.

What I want: each recorded stage keeps the size of its brief and the role's budget. spec stats shows, per ticket and per role, the brief size, the budget, and how many stages started over budget, with the largest ones first. Like every measure it is data only and never decides anything (INV-017).
