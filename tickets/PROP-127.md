---
id: PROP-127
type: proposal
title: spec split moves scenarios into a new feature and leaves each old ID pointing at its new one
status: open
stage: null
touches: [FMT-004, FMT-003, FMT-005, GRF-005]
violates: []
depends_on: []
changed: []
questions:
  - id: Q1
    kind: preference
    text: Who renames the tests that name a moved scenario?
    default: split changes no test file; it prints the old-to-new ID map, a test named by an old ID is reported by spec gaps, and a tester stage renames it
    cites: [FMT-004, FMT-003]
    answer: null
    raised_by: null
  - id: Q2
    kind: preference
    text: Can split run outside a ticket?
    default: "no: split is a spec edit, so it runs in a proposal's spec-writer stage like any other change to the spec"
    cites: [FMT-005]
    answer: null
    raised_by: null
history: []
---
Scale review of 2026-11-22. Features grow by accretion: INS-014 holds 38 scenarios and 17 rules, and its S7 alone has six Then/And lines. The line budget pushes new work into new features (PROP-125 created INS-019 that way), but moving existing scenarios out of a big feature is manual: each moved scenario gets a new ID, nothing points from the old ID to the new one, and every test, ticket and cite that named the old ID silently stops matching. So big features keep growing, because splitting one costs more than adding to it.

What I want: `spec split <feature> <scenario or rule IDs...> --into <new feature title>` creates a new feature in the same module with the next free ID, moves the named scenarios and rules into it in their order with new numbers, and leaves each old scenario and rule ID as a tombstone that points at its new ID (as FMT-004 already does for removed features). `spec show` on an old ID shows where it went. The rules a moved scenario cites move with it or stay cited across features; say which. Lint keeps INV-001: an old ID is never reused. The command prints the old-to-new map so the person, or the next stage, can follow it.
