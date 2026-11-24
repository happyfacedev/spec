---
id: PROP-040
type: proposal
title: A reviewer's changes verdict goes back to the spec-writer when a finding names a gap in the spec
status: done
stage: null
touches: [PIP-008]
violates: []
depends_on: []
changed: [INV-004, PIP-001/R3, PIP-001/R5, PIP-001/S10, PIP-001/S13, PIP-001/S14, PIP-001/S15, PIP-001/S16, PIP-001/S17, PIP-003/R3, PIP-003/S11, PIP-003/S12, PIP-004/R6, PIP-004/S19, PIP-006/R2, PIP-006/R3, PIP-006/R9, PIP-006/S26, PIP-008/R10, PIP-008/S23, PIP-012/R8, PIP-012/S2, PIP-012/S18, pipeline.ReviewFinding, pipeline.ReviewFinding.spec, pipeline.StageRecord, pipeline.StageRecord.findings, pipeline.Verdict]
questions:
  - id: Q1
    kind: preference
    text: How does a reviewer mark a finding as a gap in the spec rather than in the code?
    default: "the finding carries spec: true; any such finding sends the ticket to the spec-writer, otherwise to the implementer as today"
    cites: []
    answer: null
    raised_by: null
  - id: Q2
    kind: blocker
    text: INV-004 and PIP-006/R3 require a proposal's tester to leave at least one new-scenario test failing on the ticket branch. After a spec-gap round the implementer's code is already on the branch, so a scenario the code already delivers makes every new test pass and check-report refuses the tester. The e2e case PIP-001/S13 h) hits this. The spec must say the test-first check on a tester rerun after a review round is judged against the base branch, or accepts passing tests there.
    default: null
    cites:
      - INV-004
      - PIP-004
      - PIP-006
      - PIP-006/R3
      - PIP-001/R5
    answer: "Decided by the user: the test-first check applies only before the implementer's first stage on the ticket. On a tester stage after the implementer has run (a rerun after a review round), new tests may pass, since a pass means the code already delivers that scenario; lint and typecheck still apply. Change INV-004 and PIP-006/R3 to say so, with a scenario for the rerun case."
    raised_by: tester
  - id: Q3
    kind: blocker
    text: "tests/core/review-gap.test.ts PIP-006/S26 passes PRV-001/S4 as a new scenario, but fixture PRV-001 has only S1-S3, so no test name can cover it and checkReport (PIP-006/R1) reports 'no test covers PRV-001/S4'. The test contradicts S26, whose tests cover every scenario in scope. Use a scenario the fixture has (or a name list that includes S4). Everything else passes, including e2e case h). Its changes are kept in git stash \"PROP-040 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites:
      - PIP-006/S26
      - PIP-006/R1
      - PIP-006/R9
    answer: "Right: the PIP-006/S26 test must use a scenario the fixture has (or a name list that includes the one it adds), so it fails only on the rerun rule. Back to the tester."
    raised_by: implementer
  - id: Q4
    kind: blocker
    text: "The reviewer's two findings ask for tests only (blocked reviewer reports with spec: true; a multiline finding folded in briefs); the tester must add them"
    default: null
    cites:
      - PIP-004/S19
      - PIP-012/S18
    answer: "Agreed: the two findings need tests only. Back to the tester."
    raised_by: implementer
history:
  - at: 2026-10-29T21:26:37.799Z
    role: spec-writer
    result: done
    summary: "A reviewer finding marked spec: true sends a proposal back to the spec-writer (a bug: the tester); findings ride in the next briefs"
    verdict: null
    assumed:
      - question: PROP-040#Q1
        value: "the finding carries spec: true; any such finding sends the ticket to the spec-writer, otherwise to the implementer as today"
      - new: Where does a task go on a spec-gap finding? A task has no spec-writer and no tester stage
        value: to the implementer, as for any finding
      - new: How do the next stages see the findings, given history keeps none today?
        value: the reviewer's StageRecord keeps them whole, and the spec-writer, tester and implementer briefs list them in a Review findings group until a reviewer runs again
    duration_s: 335
  - at: 2026-10-29T21:40:49.676Z
    role: tester
    result: blocked
    summary: Tests for the spec-gap routing are written and fail; the spec does not say how a tester rerun after a review round is judged
    verdict: null
    assumed:
      - new: "Which message prefix does a finding with spec: yes give?"
        value: any 'report findings' prefix, with or without an index, is accepted
    duration_s: 849
  - at: 2026-10-29T21:40:50.057Z
    role: spec-writer
    result: reopened
    summary: reopened by PROP-040#Q2
    verdict: null
    assumed: []
  - at: 2026-10-29T21:46:33.730Z
    role: spec-writer
    result: done
    summary: Test-first (INV-004, PIP-006/R2, R3) applies only before the implementer's first stage; a later tester may pass (S26, R9)
    verdict: null
    assumed:
      - new: Does a blocked implementer stage count as having run?
        value: yes, any implementer stage in the history, whatever its result
    duration_s: 343
  - at: 2026-10-29T22:03:55.867Z
    role: tester
    result: done
    summary: Tests for the spec-gap routing, findings in records and briefs, and a tester rerun after the implementer; they fail now
    verdict: null
    assumed:
      - new: "Which message prefix does a finding with spec: yes give?"
        value: any 'report findings' prefix, with or without an index, is accepted
    duration_s: 1041
  - at: 2026-10-29T22:15:47.986Z
    role: implementer
    result: blocked
    summary: Routing, findings record, briefs, test-first R9 done; one test (PIP-006/S26) names PRV-001/S4, absent from the fixture
    verdict: null
    assumed: []
    duration_s: 711
  - at: 2026-10-29T22:15:48.542Z
    role: tester
    result: reopened
    summary: reopened by PROP-040#Q3
    verdict: null
    assumed: []
  - at: 2026-10-29T22:27:03.806Z
    role: tester
    result: done
    summary: Fixed the PIP-006/S26 test to use PRV-001/S3, which the fixture has; it now fails only on the rerun rule (R9)
    verdict: null
    assumed: []
    duration_s: 674
  - at: 2026-10-29T22:46:31.005Z
    role: implementer
    result: done
    summary: Spec-gap findings route to the spec-writer or tester, are kept in records and briefs; test-first applies only before the implementer
    verdict: null
    assumed: []
    duration_s: 1166
  - at: 2026-10-29T22:53:55.044Z
    role: reviewer
    result: done
    summary: Changes needed for blocked-report validation and multiline findings; e2e and regression checks pass.
    verdict: changes
    assumed: []
    duration_s: 443
  - at: 2026-10-29T23:18:50.301Z
    role: implementer
    result: done
    summary: "spec: true is refused without verdict changes in blocked reports too; briefs fold each finding to one line"
    verdict: null
    assumed: []
    duration_s: 1494
  - at: 2026-10-29T23:26:58.518Z
    role: reviewer
    result: done
    summary: Both fixes verified in memory; changes needed for two missing regression tests.
    verdict: changes
    assumed: []
    duration_s: 487
  - at: 2026-10-29T23:35:51.028Z
    role: implementer
    result: blocked
    summary: "No code change: the reviewer's two findings ask for regression tests only, which the tester must add"
    verdict: null
    assumed: []
    duration_s: 530
  - at: 2026-10-29T23:35:52.439Z
    role: tester
    result: reopened
    summary: reopened by PROP-040#Q4
    verdict: null
    assumed: []
  - at: 2026-10-29T23:50:57.095Z
    role: tester
    result: done
    summary: Added the two regression tests; both pass now and both fail when the fix is undone in a temp copy
    verdict: null
    assumed: []
    duration_s: 903
  - at: 2026-10-30T00:09:46.547Z
    role: implementer
    result: done
    summary: All tests pass with the new regression tests; no code change needed after the review fixes
    verdict: null
    assumed: []
    duration_s: 1128
  - at: 2026-10-30T00:21:45.259Z
    role: reviewer
    result: done
    summary: Both regression tests pass and catch the original bugs; focused tests, e2e, typecheck and lint pass.
    verdict: approve
    assumed: []
    duration_s: 718
---
Self-hosting finding P13. PROP-019's second review found a regression no scenario covered. The changes verdict sent the ticket to the implementer, who may not add scenarios or tests, so a person had to reopen the spec-writer by re-answering an old question with --back.

With this change, a reviewer finding can say the spec lacks a scenario or rule; ticket advance then sends a proposal with such a finding back to the spec-writer (a bug or task, which has no spec-writer stage, to the tester), with the findings in the next brief. Findings about the code keep sending the ticket to the implementer. The reviewer role text says when to mark a finding this way.
