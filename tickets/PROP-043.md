---
id: PROP-043
type: proposal
title: Impact covers an invariant cited both directly and through a rule; stale answers and decisions are brought up to date
status: done
stage: null
touches: [GRF-010]
violates: []
depends_on: []
changed: [GRF-010, GRF-010/S11]
questions:
  - id: Q1
    kind: blocker
    text: "GRF-010/S11 documents behaviour the code already has. Its test passes on current code, so no test can fail first, and INV-004 needs at least one failing test on a proposal's tester stage. Its changes are kept in git stash \"PROP-043 tester: blocked\"; the next tester stage gets them back."
    default: null
    cites:
      - GRF-010/S11
      - INV-004
    answer: "PROP-048 has merged: a spec-writer report may list documents. Back to the spec-writer, which lists GRF-010/S11 under documents; the S11 test is already committed (7677a07)."
    raised_by: tester
history:
  - at: 2026-10-30T02:32:46.544Z
    role: spec-writer
    result: done
    summary: GRF-010 S11 pins the union of direct and rule cites; Q1 brought up to date; DECISIONS.md X97 left for the implementer
    verdict: null
    assumed:
      - new: May the spec-writer mark DECISIONS.md X97 as superseded by X116?
        value: "No: it is a repo-root doc, not a spec unit the brief names; left for the implementer"
      - new: What does impact INV-001 print when PRV-002/S4 cites INV-001 only and PRV-002/S1 cites R1 only?
        value: "As today (run on a scratch copy of chat-mini): PRV-002 with scenarios PRV-002/S1, PRV-002/S4"
    duration_s: 264
  - at: 2026-10-30T02:40:07.949Z
    role: tester
    result: blocked
    summary: S11 test added; it passes on today's code, so no new test fails (INV-004)
    verdict: null
    assumed:
      - new: Which step of PRV-002/S1 cites PRV-002/R1?
        value: The Then step that says gpt is called with the same messages as claude
    duration_s: 441
  - at: 2026-10-30T05:24:07.043Z
    role: spec-writer
    result: reopened
    summary: reopened by PROP-043#Q1
    verdict: null
    assumed: []
  - at: 2026-10-30T05:24:49.035Z
    role: spec-writer
    result: done
    summary: "Reran the build on GRF-010/S11: PRV-002 reaches S1 and S4 as stated; S11 listed under documents"
    verdict: null
    documents:
      - GRF-010/S11
    assumed:
      - new: May the spec-writer mark DECISIONS.md X97 as superseded by X116?
        value: "No: it is a repo-root doc, not a spec unit the brief names; left for the implementer"
      - new: What does impact INV-001 print when PRV-002/S4 cites INV-001 only and PRV-002/S1 cites R1 only?
        value: "As today (rerun on a scratch copy of chat-mini): PRV-002 with scenarios PRV-002/S1, PRV-002/S4"
    duration_s: 41
  - at: 2026-10-30T05:31:05.043Z
    role: tester
    result: done
    summary: GRF-010/S11 test passes on current code, as documented; lint and typecheck clean
    verdict: null
    assumed:
      - new: Which step of PRV-002/S1 cites PRV-002/R1?
        value: The Then step that says gpt is called with the same messages as claude
    duration_s: 375
  - at: 2026-10-30T05:40:28.353Z
    role: implementer
    result: done
    summary: Marked DECISIONS.md X97 superseded by X116; no code change, S11 already holds; tests, typecheck, lint pass
    verdict: null
    assumed:
      - new: How does DECISIONS.md mark a superseded decision?
        value: "A line after X97: Status: superseded · Superseded by: X116., the X6 meta-line form"
    duration_s: 563
  - at: 2026-10-30T05:44:20.784Z
    role: reviewer
    result: done
    summary: S11/Q1/X97 verified; 118 tests, typecheck/lint pass; full suite/build skipped to keep files unchanged.
    verdict: approve
    assumed: []
    duration_s: 232
---
Follow-ups from PROP-010's review.

1. GRF-010/R1 makes impact on an invariant reach the scenarios that cite it and those that cite a rule citing it. No scenario shows a feature where both happen; add one, so the union is pinned.
2. GRF-010/Q1's question and answer still describe the behaviour before PROP-010 ("counts only scenarios that cite it directly", "until it lands, the spec states today's behaviour"); bring the answer up to date.
3. DECISIONS.md X97 says impact on an invariant reaches only the citing scenarios; X116 supersedes it. Mark X97 as superseded by X116.
