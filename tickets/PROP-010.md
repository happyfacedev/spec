---
id: PROP-010
type: proposal
title: Impact on an invariant reaches only the scenarios that show it
status: done
stage: null
touches: [GRF-010]
violates: []
depends_on: []
changed: [GRF-010, GRF-010/R1, GRF-010/S1, GRF-010/S2, GRF-010/S3, GRF-010/S4, GRF-010/S5, GRF-010/S6, GRF-010/S7, GRF-010/S8, GRF-010/S9, GRF-010/S10]
questions: []
history:
  - at: 2026-10-29T20:16:07.189Z
    role: spec-writer
    result: done
    summary: "GRF-010: impact on an invariant reaches only the scenarios that cite it or a rule that cites it"
    verdict: null
    assumed:
      - new: When no scenario cites the invariant or a rule that cites it, does the feature still reach every scenario (S2, S4)?
        value: yes, every scenario, as today
      - new: Should GRF-010#Q1, answered as this change, stay on the feature?
        value: yes, left in place with its answer
    duration_s: 332
  - at: 2026-10-29T20:47:30.222Z
    role: tester
    result: done
    summary: "GRF-010 tests in tests/cli/impact-scenarios.test.ts: 9 pass, S3 fails as the new rule requires"
    verdict: null
    assumed:
      - new: "Drive graph.ComputeImpact through the CLI, since its contract has no Code: line?"
        value: spec impact --format json through run, on a git copy of chat-mini
      - new: Which fixture holds ALP-001 for S4, S9 and S10, since chat-mini has no ALP-001?
        value: the lint-case base, with ALP-001 rewritten for each scenario
    duration_s: 1881
  - at: 2026-10-29T21:08:13.301Z
    role: implementer
    result: done
    summary: Invariant impact reaches only scenarios citing it or a rule citing it; spec test 936 passed, 0 failed
    verdict: null
    assumed: []
    duration_s: 1242
  - at: 2026-10-29T21:21:50.487Z
    role: reviewer
    result: done
    summary: GRF-010 holds; impact reaches only citing or rule-citing scenarios; 936 tests pass; real-spec INV-001 to 005 unchanged
    verdict: approve
    assumed:
      - new: May the reviewer run spec impact through npx tsx and spec.cjs, which are outside its allowed command list?
        value: yes, read-only and as the orchestrator asked; no file changed
      - new: Is .claude/skills/spec-spec/scripts/spec.cjs the base build?
        value: yes, scripts/** is unchanged between main and HEAD
      - new: Is the stale text of GRF-010 question Q1 a finding?
        value: no, it cites no checklist item; noted for the spec-writer
      - new: Does DECISIONS.md X97 conflict with the code?
        value: no, X116 and docs/FORMAT.md say citing or a rule that cites it; X97 is stale
    duration_s: 816
---
Review 2026-10-29, GRF-010#Q1: impact on an invariant reaches the scenarios that cite it or cite a rule that cites it, as docs/FORMAT.md says and as impact on a contract already does, instead of every scenario of a feature where only a rule cites it.
