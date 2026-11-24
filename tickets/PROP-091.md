---
id: PROP-091
type: proposal
title: A close of a ticket whose status is quoted passes verify-history
status: done
stage: null
touches: [INS-015, TKT-012]
violates: []
depends_on: []
changed: [INS-015/R6, INS-015/S11, TKT-012/R10, TKT-012/S12]
questions: []
history:
  - at: 2026-11-01T07:37:16.587Z
    role: spec-writer
    result: done
    summary: A close keeps the status quote marks; verify-history stays byte-exact, so a quoted close passes
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [TKT-012/S12, TKT-012/S1, TKT-012/S13, INS-015/S11]
        reason: impact reaches TKT-012 errors and tickets.Ticket members; the unquoted close path is unchanged and still shown by S12 and S1
      - item: C2
        outcome: scenarios
        ids: [TKT-012/S12, INS-015/S11]
        reason: double- and single-quoted status covered; the older-shape file (no stage/history) is the same scenario
      - item: C3
        outcome: na
        ids: []
        reason: no new shared state; the close lock and races stay in TKT-012/S14
      - item: C4
        outcome: scenarios
        ids: [INS-015/S11]
        reason: "verifier stays strictest: any change of the status quote marks is an extra byte and an offender; only the writer changes"
      - item: C5
        outcome: scenarios
        ids: [INS-015/S11]
        reason: a hand-edited quote change in a close commit is rejected like any other extra byte
      - item: C6
        outcome: scenarios
        ids: [TKT-012/S12]
        reason: unquoted status, comment keeping and every other byte unchanged
      - item: C8
        outcome: na
        ids: []
        reason: "no external fact; reproduced with the current build in a scratch repo with hooks: close wrote unquoted 'status: absorbed' and verify-history exited 1 (changes more than its status and absorbed_into)"
    assumed: []
    duration_s: 88
  - at: 2026-11-01T07:39:23.797Z
    role: spec-review
    result: done
    summary: Quoted closes retain their quote marks without weakening byte-exact history verification
    verdict: approve
    assumed: []
    duration_s: 125
  - at: 2026-11-01T07:46:07.476Z
    role: tester
    result: done
    summary: "Quoted-status close tests: writer must keep quotes (fail now); verify-history quote-change offenders and accepts added."
    verdict: null
    mutations:
      - scenario: TKT-012/S12
        wrong: "patchTicketText writes status: absorbed bare, dropping the double or single quotes of a quoted status"
      - scenario: INS-015/S11
        wrong: verify-history ignores quote marks on the status scalar, so a close that drops, adds or swaps them is accepted
      - scenario: INS-015/S11
        wrong: verify-history rejects the close commit spec ticket close writes for a quoted status
    assumed: []
    duration_s: 402
  - at: 2026-11-01T07:58:00.436Z
    role: implementer
    result: done
    summary: A close keeps a quoted status's quote marks via a keepQuotes option; the verifier is unchanged
    verdict: null
    assumed: []
    duration_s: 711
  - at: 2026-11-01T08:00:05.224Z
    role: reviewer
    result: done
    summary: Close preserves both quote styles and comments; verifier and other ticket writers stay unchanged
    verdict: approve
    assumed: []
    duration_s: 122
---
Found by PROP-089's reviewer as a follow-up. For a hand-authored `status: "open"` (or single-quoted), patchTicketText writes `status: absorbed` without the quotes, and verify-history's exact-transition check (INS-015/R6) rejects that command-generated close commit even though nothing else changed. Align the writer and the verifier: either the writer keeps the original quoting, or the verifier accepts a quote change on the status scalar alone. Cover a quoted status in INS-015/S11 and TKT-012/S12.
