---
id: PROP-088
type: proposal
title: A documented scenario's test may fail once the ticket's implementer has run
status: done
stage: null
touches: [PIP-006]
violates: []
depends_on: []
changed: [INV-004, PIP-006, PIP-006/R9, PIP-006/R10, PIP-006/S26, PIP-006/S29, PIP-006/S37, PIP-006/S38, PIP-014, PIP-014/R4, PIP-014/S8, PIP-014/S9]
questions: []
history:
  - at: 2026-11-01T04:14:25.868Z
    role: spec-writer
    result: done
    summary: Documents exemption (passing test required) ends at the ticket's first implementer stage; later a documented test is held like any.
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-006/S26, PIP-006/S29, PIP-006/S33, PIP-006/S34, PIP-006/S37]
        reason: spec impact PROP-088 reaches no other feature; S26, S29, S33 and S34 keep the before-implementer behaviour (S33 and S34 start from the no-implementer ticket of S27) and S37 shows the new after-implementer case
      - item: C2
        outcome: na
        ids: []
        reason: no paths, platforms or install layouts are involved; a ticket with no implementer stage in its history behaves as before
      - item: C3
        outcome: na
        ids: []
        reason: the check reads the ticket history once per report; no state is shared across an await or a process
      - item: C4
        outcome: scenarios
        ids: [PIP-006/S38, PIP-006/S37]
        reason: "a tester cannot leave a documented test failing: the failure is accepted only after an implementer stage, and the implementer is refused while any test fails (R5, S8); an error-kind failure is still refused (R8)"
      - item: C5
        outcome: scenarios
        ids: [PIP-006/S37]
        reason: an error failure or a documented scenario with no test is still refused after the implementer (R8, R1)
      - item: C6
        outcome: scenarios
        ids: [PIP-006/S29, PIP-006/S33, PIP-006/S34, PIP-006/S27, PIP-006/S32]
        reason: before the first implementer stage the documented checks are unchanged; their texts and orders stand
      - item: C8
        outcome: na
        ids: []
        reason: no external tool or service fact is involved; the current refusal text was read from the build's source and tests
    assumed:
      - new: Does a documented scenario whose only test is skipped stay refused after the implementer?
        value: "No: the whole passing requirement ends at the first implementer stage, as for any new scenario (R9, R10)"
      - new: PIP-014/R4 tells the tester a documented scenario's test must pass now; is that wording touched?
        value: "No: PIP-014 is outside touches, the wording stays true before the implementer, and a follow-up ticket can adjust it"
    duration_s: 117
  - at: 2026-11-01T04:15:25.255Z
    role: spec-review
    result: done
    summary: Post-implementer checks are sound, but the tester brief still requires documented tests to pass.
    verdict: changes
    findings:
      - cites: [PIP-014/R4, PIP-014/S8, PIP-006/S37]
        text: PIP-014/R4 and S8 still require the tester's brief to say a documented test must pass now, without a before-implementer restriction. In S37's normal reviewer-to-tester loop, that directs the tester to make the regression test pass or block instead of submitting the assertion failure this change accepts. The spec-writer's assumption that the wording stays true before the implementer does not cover this newly permitted path. Align the brief rule and cover its post-implementer interaction in this delta rather than deferring it.
        class: C1
    assumed: []
    duration_s: 54
  - at: 2026-11-01T04:16:15.851Z
    role: spec-writer
    result: done
    summary: Tester brief says a documented test must pass now only before the first implementer stage; after it, documented scenarios get no special line.
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-014/S8, PIP-014/S9, PIP-006/S37]
        reason: "PIP-014's brief now matches PIP-006/R10: S8 keeps the before-implementer wording, S9 shows the after-implementer brief; S1 to S7 are unchanged"
      - item: C2
        outcome: na
        ids: []
        reason: no paths, platforms or install layouts are involved; a ticket with no implementer stage in its history behaves as before
      - item: C3
        outcome: na
        ids: []
        reason: the brief reads the ticket history once; no state is shared across an await or a process
      - item: C4
        outcome: scenarios
        ids: [PIP-006/S38, PIP-006/S37]
        reason: "a tester cannot leave a documented test failing: the failure is accepted only after an implementer stage, and the implementer is refused while any test fails (PIP-006/R5, S8); an error-kind failure is still refused (R8)"
      - item: C5
        outcome: scenarios
        ids: [PIP-006/S37]
        reason: an error failure or a documented scenario with no test is still refused after the implementer (R8, R1)
      - item: C6
        outcome: scenarios
        ids: [PIP-014/S8, PIP-006/S29, PIP-006/S33, PIP-006/S34, PIP-006/S27, PIP-006/S32]
        reason: before the first implementer stage the documented checks and the brief wording are unchanged
      - item: C8
        outcome: na
        ids: []
        reason: no external tool or service fact is involved
    assumed:
      - new: Does a documented scenario whose only test is skipped stay refused after the implementer?
        value: "No: the whole passing requirement ends at the first implementer stage, as for any new scenario (PIP-006/R9, R10)"
      - new: After the implementer, what group text does the tester's brief show when every listed scenario was documented?
        value: The ordinary group text, as for any added scenario; PIP-014/S9 pins the scenario line only
    duration_s: 48
  - at: 2026-11-01T04:17:02.790Z
    role: spec-review
    result: done
    summary: "Prior finding resolved: the tester brief now ends the documented-test passing requirement at the first implementer stage."
    verdict: approve
    assumed: []
    duration_s: 45
  - at: 2026-11-01T04:31:01.284Z
    role: tester
    result: done
    summary: Tests for PIP-006 S29/S37/S38 and PIP-014/S9; S29, S37 and S9 fail now, S38 guards the implementer refusal.
    verdict: null
    mutations:
      - scenario: PIP-006/S26
        wrong: still refuses a failing documented test in the But clause, so S26 keeps the old refusal
      - scenario: PIP-014/S8
        wrong: drops the 'must pass now' text even before any implementer stage
      - scenario: PIP-006/S29
        wrong: ends the documents exemption only on a done implementer stage, not a blocked one
      - scenario: PIP-006/S37
        wrong: keeps refusing a documented test that fails on its assertion after the implementer has run
      - scenario: PIP-006/S37
        wrong: drops the error-kind refusal and the missing-test refusal for documented scenarios after the implementer
      - scenario: PIP-006/S38
        wrong: lets the implementer pass while a documented test still fails
      - scenario: PIP-014/S9
        wrong: keeps '(added; documents current behaviour, so its test must pass now)' and the each-must-pass text after an implementer stage
    assumed:
      - new: Does a blocked implementer stage end the documents exemption?
        value: "Yes: R9 and R4 say 'whatever its result'"
    duration_s: 836
    refusals: 1
  - at: 2026-11-01T04:49:34.013Z
    role: implementer
    result: done
    summary: The documents exemption and the brief's must-pass wording now apply only while the ticket has no implementer stage; npm run build and npm run check pass (138 files, 1883 tests)
    verdict: null
    assumed: []
    duration_s: 1111
  - at: 2026-11-01T05:07:27.585Z
    role: reviewer
    result: done
    summary: Code and regression tests match PIP-006/R9, R10 and PIP-014/R4; no findings.
    verdict: approve
    assumed: []
    duration_s: 1070
---
Measured on this repo (SELF-HOSTING P60). PROP-083 listed PIP-012/S29 under `documents:` because the build before it always gave the full delta. The ticket's own narrowing code then made S29 breakable, and the reviewer's C4 regression tests for it had to fail first. check-report refused them ('the spec-writer listed PIP-012/S29 under documents as behaviour the code already has'). Routing it cost a blocked tester stage, a spec-writer round that only rewrote the documents list, and a spec review of an unchanged spec. Change: the documents exemption (a documented scenario's tests must pass) applies only until the ticket's first implementer stage. After that, a failing test of a documented scenario is checked like any test-first test.
