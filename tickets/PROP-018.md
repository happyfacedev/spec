---
id: PROP-018
type: proposal
title: A test named exactly after a scenario covers it
status: done
stage: null
touches: [PIP-011]
violates: []
depends_on: []
changed: [PIP-011, PIP-011/R2, PIP-011/S1, PIP-011/S2, PIP-011/S3, PIP-011/S4, PIP-011/S5, PIP-011/S6, PIP-011/S7]
questions: []
history:
  - at: 2026-10-29T11:15:20.697Z
    role: spec-writer
    result: done
    summary: Bare grouped test name covers its scenario (R2), shown by new S7; S6 adds the bare removed-scenario form
    verdict: null
    assumed:
      - new: Should the PIP-011 Q1 answer text be rewritten now that the bare name counts?
        value: left as recorded, as landed answers are elsewhere
      - new: Should S6 also show the bare grouped name for the removed-scenario check?
        value: yes, added PRV-001 S9 to S6's Given
  - at: 2026-10-29T11:21:52.553Z
    role: tester
    result: done
    summary: PIP-011 tests run through check-report; S7 fails (bare group name) as expected, S1-S6 and the other 505 pass
    verdict: null
    assumed:
      - new: "pipeline.CheckReport has no Code: line, so the PIP-011 tests drive spec check-report through run; should the runner be the real vitest/Dart run?"
        value: canned runner report copied by the test command, in each runner's format (vitest JSON; Dart event stream, Dart not run)
  - at: 2026-10-29T11:24:56.213Z
    role: implementer
    result: done
    summary: coversScenario accepts a bare grouped name (PRV-002 S1), PIP-011/R2; 506 tests, typecheck and lint pass
    verdict: null
    assumed: []
  - at: 2026-10-29T11:28:02.550Z
    role: reviewer
    result: done
    summary: approve - bare group name covers its scenario (R2, S7); S1-S7 and R1-R4 hold in code and tests
    verdict: approve
    assumed:
      - new: Must S3's covers-no-scenario be checked across the whole spec?
        value: checked over the in-scope PRV-002 scenarios, since check-report names only in-scope scenarios
      - new: Must the reviewer re-run the suite?
        value: no; relied on code reading and the stage reports (506 passing, S7 red before the change)
---
Review 2026-10-29, PIP-011#Q1: a grouped test name that is exactly "<FEATURE> S<n>" with nothing after it covers that scenario, matching how the removed-scenario check already reads it.
