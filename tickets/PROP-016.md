---
id: PROP-016
type: proposal
title: Answering the overseer's question grants one more review round
status: done
stage: null
touches: [PIP-002]
violates: []
depends_on: []
changed: [PIP-002, PIP-002/R8, PIP-002/S8, PIP-002/S29]
questions:
  - id: Q1
    kind: blocker
    text: 'S8 test (tests/cli/ticket-start-rules.test.ts:90) expects created false but never creates ticket/TASK-101 as S4 does; a fresh start gives created true. Tester must create the branch. Its changes are kept in git stash "PROP-016 implementer: blocked"; the next implementer stage gets them back.'
    default: null
    cites:
      - PIP-002/S8
      - PIP-002/S4
      - pipeline.StageStarted.created
    answer: "Right: the S8 test must create ticket/TASK-101 first, as the S4 test does, so it fails only on the round limit. Back to the tester."
    raised_by: implementer
history:
  - at: 2026-10-29T20:11:57.990Z
    role: spec-writer
    result: done
    summary: "PIP-002: answering the overseer review-round question grants one more round; S8 reworked, S29 and R8 added"
    verdict: null
    assumed:
      - new: Does each further answered review-round question grant exactly one more round?
        value: Yes, the limit is 2 plus the answered overseer questions
    duration_s: 86
  - at: 2026-10-29T20:20:34.811Z
    role: tester
    result: done
    summary: Tests for PIP-002/S8 (one more round after answer) and S29 (each round needs its own answer); S8 fails now
    verdict: null
    assumed: []
    duration_s: 516
  - at: 2026-10-29T20:32:32.798Z
    role: implementer
    result: blocked
    summary: "R8 coded: answered overseer round questions raise the limit; S8 test expects created false but never creates the branch"
    verdict: null
    assumed: []
    duration_s: 716
  - at: 2026-10-29T20:32:33.371Z
    role: tester
    result: reopened
    summary: reopened by PROP-016#Q1
    verdict: null
    assumed: []
  - at: 2026-10-29T20:50:57.483Z
    role: tester
    result: done
    summary: S8 test now creates ticket/TASK-101 first, so it fails only on the review-round limit; S29 unchanged
    verdict: null
    assumed: []
    duration_s: 1104
  - at: 2026-10-29T21:11:54.057Z
    role: implementer
    result: done
    summary: nextStage grants one more review round per answered overseer question (R8); S8 and S29 pass, all 927 tests green
    verdict: null
    assumed: []
    duration_s: 1256
  - at: 2026-10-29T21:13:40.962Z
    role: reviewer
    result: done
    summary: All four nextStage callers pass the ticket's questions; only answered overseer round questions count; e2e and start tests pass
    verdict: approve
    assumed: []
    duration_s: 106
---
Review 2026-10-29, PIP-002#Q2 (bug found in drafting: a dead end). After a third "changes" verdict, answering the overseer's question lets the ticket start the implementer again for one more review round, instead of every start being refused forever.
