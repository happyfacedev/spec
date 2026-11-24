---
id: PROP-017
type: proposal
title: spec test counts skipped tests apart
status: done
stage: null
touches: [PIP-009]
violates: []
depends_on: []
changed: [PIP-009, PIP-009/R1, PIP-009/S1, PIP-009/S2, PIP-009/S3, PIP-009/S4, PIP-009/S5, PIP-009/S6, PIP-009/S7, PIP-009/S8, PIP-009/S9, PIP-009/S10, PIP-009/S11, PIP-009/S12]
questions: []
history:
  - at: 2026-10-29T21:27:40.695Z
    role: spec-writer
    result: done
    summary: "PIP-009: the summary line counts passed, failed and skipped apart; S2 and R1 now say so"
    verdict: null
    assumed:
      - new: Print the skipped count when no test was skipped?
        value: "Yes: the summary always has all three counts, 0 included"
    duration_s: 397
  - at: 2026-10-29T21:45:49.177Z
    role: tester
    result: done
    summary: PIP-009 tests for S1-S12 added; the two S2 tests fail on the skipped count, the other 11 pass
    verdict: null
    assumed:
      - new: Can S11's 10-minute time limit be tested for real?
        value: "No: asserted as TEST_TIMEOUT_MS = 10 minutes; a real stop takes 10 minutes"
      - new: Does R1's (exit ?) summary need its own test?
        value: "Yes: a second PIP-009/S2 test"
    duration_s: 1088
  - at: 2026-10-29T22:01:03.523Z
    role: implementer
    result: done
    summary: spec test prints passed, failed and skipped apart; typecheck, lint and all 981 tests pass
    verdict: null
    assumed: []
    duration_s: 913
  - at: 2026-10-29T22:10:02.246Z
    role: reviewer
    result: done
    summary: "Approve: skipped counts and signal exits match PIP-009; typecheck, lint, 91 tests and 14 CLI comparisons pass."
    verdict: approve
    assumed: []
    duration_s: 538
---
Review 2026-10-29, PIP-009#Q1: the summary line counts skipped tests separately, for example "3 passed, 1 failed, 2 skipped", instead of counting them as passed.
