---
id: PROP-110
type: proposal
title: A JUnit report whose DOCTYPE holds a quoted ']' is read
status: done
stage: null
touches: [PIP-010]
violates: []
depends_on: []
changed: [PIP-010, PIP-010/R3, PIP-010/S15]
questions: []
history:
  - at: 2026-11-01T20:55:47.524Z
    role: spec-writer
    result: done
    summary: "PIP-010 S15 and R3: a JUnit report whose DOCTYPE subset holds a quoted ']' is read, not refused."
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-010/S12, PIP-010/S13, ADP-003/S4, PIP-006/S16]
        reason: spec impact PROP-110 reaches pipeline.NoTestResults, ADP-003 and PIP-006. The contract text is unchanged and still true; S12 and S13 still refuse incomplete XML. The ADP-003 and PIP-006 scenarios do not involve XML, so they are untouched.
      - item: C2
        outcome: na
        ids: []
        reason: This is a pure text parsing rule on the report content. Paths, install layouts, platforms and upgrades do not matter.
      - item: C3
        outcome: na
        ids: []
        reason: The report is read once from a finished file. No state is shared across an await or process boundary.
      - item: C4
        outcome: na
        ids: []
        reason: The report is written by the project's own test command. This change reads a valid prolog and adds no new input, and nothing in the report is run or fetched, including entities.
      - item: C5
        outcome: scenarios
        ids: [PIP-010/S12, PIP-010/S13, PIP-010/S7]
        reason: Non-JUnit XML, cut-off XML and text that is no report are still refused. S15 loosens only the quoted-literal case inside a DOCTYPE.
      - item: C6
        outcome: scenarios
        ids: [PIP-010/S6, PIP-010/S12, PIP-010/S13, PIP-010/S14]
        reason: Plain JUnit, non-JUnit XML, cut-off and empty reports behave as before.
      - item: C8
        outcome: na
        ids: []
        reason: No other tool or service is involved. The XML DOCTYPE rule (a quoted literal in the subset may hold brackets) is standard XML 1.0, and S15 pins no tool output.
    assumed:
      - new: Is an unterminated quote inside a DOCTYPE refused as incomplete?
        value: Not written into the spec; R3 states only that a quoted ']' or '[' does not end or open the subset. A quote that never closes falls under the existing fail-closed rule for incomplete XML (S12, S13).
    duration_s: 74
  - at: 2026-11-01T20:56:22.924Z
    role: spec-review
    result: done
    summary: "Approve S15 and R3: quoted DOCTYPE brackets preserve JUnit parsing and existing report behaviour."
    verdict: approve
    assumed: []
    duration_s: 33
  - at: 2026-11-01T21:05:48.144Z
    role: tester
    result: done
    summary: "Added PIP-010/S15 test: a quoted ']' in the DOCTYPE is read; fails today on the refused report."
    verdict: null
    mutations:
      - scenario: PIP-010/S15
        wrong: the DOCTYPE scan ends the internal subset at the first ']' even inside quotes, so the report is refused as not a complete JUnit report (today's behaviour)
    assumed: []
    duration_s: 562
  - at: 2026-11-01T21:31:03.006Z
    role: implementer
    result: done
    summary: isCompleteJUnit's DOCTYPE scan tracks quoted literals, so a quoted ']' or '[' no longer ends or opens the subset.
    verdict: null
    assumed:
      - new: Does a quote inside a comment or instruction in the DOCTYPE subset open a literal?
        value: "No: comments and instructions in the subset are skipped whole, so an apostrophe in a comment does not break the scan. An unterminated quote or comment is incomplete (fail-closed)."
    duration_s: 1512
  - at: 2026-11-01T21:37:30.506Z
    role: reviewer
    result: done
    summary: "Approve: quoted DOCTYPE literals and whole comments/PIs scan correctly; both requested files pass (38 tests)."
    verdict: approve
    assumed: []
    duration_s: 385
---
Follow-up from PROP-102's reviewer, picked by the person on 2026-11-01. isCompleteJUnit in src/core/test-report.ts counts brackets inside quoted DOCTYPE literals while it skips the doctype, so a valid report whose internal subset holds <!ENTITY example "a]b"> is refused as 'not a complete JUnit report'. Track quoted literals while scanning the doctype so a ']' inside quotes does not end the internal subset. Add the case to PIP-010 (the S6/R3 JUnit reading).
