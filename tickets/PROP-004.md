---
id: PROP-004
type: proposal
title: spec confirm prints its problems on stderr
status: done
stage: null
touches: [ADP-005]
violates: []
depends_on: []
changed: [ADP-005, ADP-005/S1, ADP-005/S2, ADP-005/S3, ADP-005/S4, ADP-005/S5, ADP-005/S6, ADP-005/S7, ADP-005/S8, ADP-005/S9, ADP-005/S10, ADP-005/S11, ADP-005/S12, ADP-005/S13, ADP-005/S14, adopt.Confirm]
questions: []
history:
  - at: 2026-10-29T23:51:11.084Z
    role: spec-writer
    result: done
    summary: "ADP-005: spec confirm prints each problem on stderr; confirmed lines stay on stdout; exit codes unchanged"
    verdict: null
    assumed:
      - new: Where does --format json put problems?
        value: Still in one JSON document on stdout, stderr empty, as today
    duration_s: 538
  - at: 2026-10-30T00:18:00.167Z
    role: tester
    result: done
    summary: "ADP-005 tests per scenario: S6-S12 fail on stream routing; S1-S5, S13, S14 pass; lint and typecheck clean"
    verdict: null
    assumed:
      - new: Does each problem line on stderr end with a newline?
        value: "Yes: one line per problem, as the stdout lines do"
      - new: Keep the gate-passes check from the old confirm test?
        value: "No: it tests the ticket gate, not ADP-005, so it is dropped"
    duration_s: 1606
  - at: 2026-10-30T00:37:45.830Z
    role: implementer
    result: done
    summary: spec confirm prints each problem on stderr; confirmed lines stay on stdout; exit codes unchanged
    verdict: null
    assumed: []
    duration_s: 1185
  - at: 2026-10-30T00:45:50.904Z
    role: reviewer
    result: done
    summary: "ADP-005 verified: 18 CLI comparisons, callers and lint/typecheck pass; full tests/build skipped (read-only)."
    verdict: approve
    assumed: []
    duration_s: 484
---
Review 2026-10-29, ADP-005#Q1: problems go to stderr; confirmed lines stay on stdout; exit code unchanged.
