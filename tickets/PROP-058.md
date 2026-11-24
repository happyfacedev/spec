---
id: PROP-058
type: proposal
title: A reviewer finding that asks only for tests goes straight to the tester
status: done
stage: null
touches: [PIP-001, PIP-003, PIP-004, PIP-008]
violates: []
depends_on: []
changed: [PIP-001, PIP-001/R3, PIP-001/R6, PIP-001/S10, PIP-001/S18, PIP-001/S19, PIP-003, PIP-003/R3, PIP-003/S14, PIP-004, PIP-004/R6, PIP-004/S20, PIP-012, PIP-012/R8, PIP-012/S19, pipeline.ReviewFinding, pipeline.ReviewFinding.tests, pipeline.StageRecord, pipeline.StageRecord.findings, pipeline.Verdict]
questions: []
history:
  - at: 2026-10-31T03:47:48.781Z
    role: spec-writer
    result: done
    summary: A finding marked tests true sends a proposal or bug to the tester, then implementer; spec true wins when both
    verdict: null
    assumed:
      - new: "roles/reviewer.md and roles/tester.md are code (codeGlobs roles/**), which the spec-writer may not change (INV-003); who carries the tests: true bullet into the shipped templates?"
        value: the implementer copies the new spec/roles/reviewer.md and spec/roles/tester.md bullets into roles/reviewer.md and roles/tester.md
      - new: "May one finding carry both spec: true and tests: true?"
        value: yes; routing takes the earliest stage named (PIP-001/R6, PIP-004/R6)
    duration_s: 196
  - at: 2026-10-31T03:52:57.197Z
    role: tester
    result: done
    summary: Tests for the tests mark on routing, reading, checking and the brief; six fail on today's code
    verdict: null
    assumed: []
    duration_s: 308
  - at: 2026-10-31T04:02:18.338Z
    role: implementer
    result: done
    summary: tests true on findings routes proposals and bugs to the tester, is checked, listed in briefs and shipped in role templates
    verdict: null
    assumed: []
    duration_s: 560
  - at: 2026-10-31T04:09:17.820Z
    role: reviewer
    result: done
    summary: tests true preserves stage order, spec precedence and review-round limits
    verdict: approve
    assumed: []
    duration_s: 419
---
Self-hosting finding P32. Today a reviewer `changes` verdict goes to the implementer, and a finding marked `spec: true` goes to the spec-writer (PROP-040). A finding that needs only new or stronger tests has no route, so it takes four stages: the implementer fixes the code, blocks because it may not edit tests (its fix is stashed), the overseer answers with `--back tester`, the tester adds the tests, and then the implementer restarts to restore the stash and rerun the suite. PROP-051 paid this twice, and PROP-016, 046 and 050 once each. Add a finding mark (for example `tests: true`) that routes the ticket to the tester first, then to the implementer as usual, with the finding in both briefs. Under INV-004's rerun rule (PIP-006/R9), the tester's new tests may pass when the code already holds. The round count is unchanged: one review round.
