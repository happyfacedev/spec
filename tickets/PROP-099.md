---
id: PROP-099
type: proposal
title: "Light-lane wording follow-ups: stats minimum contract, brief recovery paths, first-stage lane sampling"
status: done
stage: null
touches: [PIP-020, PIP-012, PIP-021]
violates: []
depends_on: []
changed: [PIP-012/S30, PIP-021/R2, PIP-021/S8, pipeline.TicketStats, pipeline.TicketStats.minimum]
questions: []
history:
  - at: 2026-11-01T14:17:49.769Z
    role: spec-writer
    result: done
    summary: Spec now states minimum 3/5 in TicketStats, qualified light-lane brief rules, and the pre-first-stage lane edit.
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-012/S30, PIP-021/S8, PIP-020/S7]
        reason: Only wording changed in contracts.md, PIP-012/S30 and PIP-021/R2 and S8; neighbours keep their scenarios.
      - item: C2
        outcome: na
        ids: []
        reason: Wording only; no paths, platforms or install layouts are involved.
      - item: C3
        outcome: scenarios
        ids: [PIP-021/S8]
        reason: S8 now says an edit made while the first stage is running is the lane the first record keeps.
      - item: C4
        outcome: invariant
        ids: [INV-013]
        reason: "Unchanged: INV-013 still decides who may set the lane; the new S8 step only states what a person's edit does."
      - item: C5
        outcome: scenarios
        ids: [PIP-021/S6]
        reason: "Unchanged: a report lane other than full is still refused."
      - item: C6
        outcome: scenarios
        ids: [PIP-021/S7, PIP-021/S8, PIP-012/S30, PIP-020/S7]
        reason: Reviewer routing, the fixed lane after the first record and the stats minimum behave as before.
      - item: C8
        outcome: na
        ids: []
        reason: No other tool's or service's facts are involved.
    assumed:
      - new: Item 3 is stated by editing PIP-021/R2 and S8 (new And step) rather than adding a scenario S9; tests/cli/ticket-lanes.test.ts already covers it under S8 and passes today, but S8 is changed, so it is not listed under documents
        value: edit S8 in place
      - new: "Brief rule wording: docs says the tester does not run; tests says the spec review does not run; both say the implementer runs only if the reviewer asks for changes and marks no finding for the spec or the tests; widening says the ticket goes on from the reporting stage"
        value: exact text in PIP-012/S30; src/core/brief.ts and its exact-text tests in tests/cli/ticket-lanes.test.ts must change to match
    duration_s: 115
  - at: 2026-11-01T14:19:35.449Z
    role: spec-review
    result: done
    summary: Approved wording fixes for stats minimum, light-lane recovery and first-record lane sampling.
    verdict: approve
    assumed: []
    duration_s: 103
  - at: 2026-11-01T14:32:15.161Z
    role: tester
    result: done
    summary: PIP-012/S30 test moved to the new light-lane wording; it fails on brief.ts text. PIP-021/S8 already covered and passing.
    verdict: null
    mutations:
      - scenario: PIP-012/S30
        wrong: keeps the old docs and tests wording, so the implementer is still said never to run and the spec review or tester is still said to run
      - scenario: PIP-021/S8
        wrong: records the lane the ticket had when the first stage started, so an edit made while it runs is dropped
    assumed: []
    duration_s: 757
  - at: 2026-11-01T14:53:18.300Z
    role: implementer
    result: done
    summary: brief.ts light-lane rules now match PIP-012/S30 exactly; build, lint, typecheck and 1965 tests pass
    verdict: null
    assumed: []
    duration_s: 1257
  - at: 2026-11-01T14:58:04.431Z
    role: reviewer
    result: done
    summary: Approved light-lane wording follow-ups; spec alignment and mutation coverage checked, 30 targeted tests pass.
    verdict: approve
    assumed: []
    duration_s: 281
---
Follow-ups from PROP-092's spec review and review (approved). (1) pipeline.TicketStats.minimum's description in spec/modules/pipeline/contracts.md still documents only the old 5/3/2 and legacy 4 calculation; add minimum 3 while a proposal is in a light lane and 5 once it has left it (PIP-020/R2, S7 already say so). (2) The light-lane brief rule (PIP-012/S30, src/core/brief.ts) says the implementer never runs and that asking for lane full runs every stage; unmarked reviewer findings can run an implementer while still light (PIP-021/S7), and widening resumes from the recorded role (PIP-021/R3). Qualify the spec wording and the brief text and its exact-text tests. (3) PIP-021/R2 and S8: say plainly that an edit to the ticket's lane before the first stage is recorded is the lane that first record keeps (the build already does this and tests/cli/ticket-lanes.test.ts covers it).
