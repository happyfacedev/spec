---
id: PROP-129
type: proposal
title: A scenario about wording lists the phrases its files must hold, and spec checks them instead of a hand-written test
status: open
stage: null
touches: [FMT-005, PIP-011, ADP-003, PIP-006]
violates: []
depends_on: []
changed: []
questions:
  - id: Q1
    kind: preference
    text: Does a scenario whose phrases spec checks still need a test?
    default: "no: spec's own phrase check counts as that scenario's test for test-first (PIP-006) and for spec gaps (ADP-003); a missing phrase fails the stage the way a failing test does"
    cites: [PIP-006, ADP-003]
    answer: null
    raised_by: null
  - id: Q2
    kind: preference
    text: Can a scenario also say a phrase must be absent?
    default: "yes: each entry is either a phrase the file must hold or one it must not hold"
    cites: [FMT-005]
    answer: null
    raised_by: null
history: []
---
Scale review of 2026-11-22. Many scenarios describe what a skill or a doc says: INS-019/S2, INS-014/S7 and most of INS-014's setup scenarios. Their tests are hand-written `toContain` checks on exact wording, such as 'Marketplaces > happyface', which the tester has to guess before the docs exist. The implementer may not change tests, so any rewording of a doc goes back to the tester as a blocker, and the wording lives in two places: the scenario and the test.

What I want: a scenario can list, under a fixed heading, the file each phrase must appear in and the phrases themselves, quoted. spec checks them itself, in check-report, the finish hook and merge, so the scenario is the only place the wording lives. Changing the wording then means changing the scenario, in a spec stage, with no tester round trip. Scenarios that describe behaviour keep ordinary tests.
