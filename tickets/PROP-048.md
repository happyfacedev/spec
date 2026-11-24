---
id: PROP-048
type: proposal
title: A proposal whose new scenarios document behaviour the code already has can pass its tester stage
status: done
stage: null
touches: [PIP-006]
violates: []
depends_on: []
changed: [INV-004, PIP-003, PIP-003/R4, PIP-003/S13, PIP-006, PIP-006/R3, PIP-006/R8, PIP-006/R9, PIP-006/R10, PIP-006/R11, PIP-006/S26, PIP-006/S27, PIP-006/S28, PIP-006/S29, PIP-006/S30, PIP-006/S31, PIP-006/S32, PIP-006/S33, PIP-006/S34, PIP-008, PIP-008/R11, PIP-008/S24, PIP-014, PIP-014/R4, PIP-014/S1, PIP-014/S2, PIP-014/S3, PIP-014/S4, PIP-014/S5, PIP-014/S6, PIP-014/S7, PIP-014/S8, pipeline.Report, pipeline.Report.documents, pipeline.StageRecord, pipeline.StageRecord.documents]
questions:
  - id: Q1
    kind: preference
    text: How does a proposal say its new scenarios document existing behaviour?
    default: "the spec-writer lists them under a new report key, documents: [<scenario IDs>], after running the current build on each; the tester stage then accepts passing tests for exactly those scenarios, and every other new or changed scenario still needs a failing test"
    cites: []
    answer: null
    raised_by: null
history:
  - at: 2026-10-30T02:48:34.170Z
    role: spec-writer
    result: done
    summary: "Spec-writer lists documents: scenarios it added; kept in its history record; tester exempts them from test first"
    verdict: null
    assumed:
      - question: PROP-048#Q1
        value: "documents: [<scenario IDs>] in the spec-writer's report, kept in pipeline.StageRecord.documents; the tester's check and brief read it from the history"
      - new: Must a documented scenario's test pass after the implementer has run too?
        value: "yes: a failing documented test is refused in every tester stage (PIP-006/R10)"
      - new: Who updates the bundled role prompts roles/spec-writer.md and roles/tester.md and the compiled .claude/agents files?
        value: the implementer mirrors the spec/roles edits into roles/ (and src/generated/assets.ts); .claude/agents is recompiled by compile-roles at merge
    duration_s: 235
  - at: 2026-10-30T04:21:13.475Z
    role: tester
    result: done
    summary: "Tests for documents: S26-S31, PIP-003/S13, PIP-008/S24, PIP-014/S1-S8, e2e case i; the new ones fail on the missing key"
    verdict: null
    assumed:
      - new: Must a documented scenario's test pass after the implementer has run too?
        value: yes, as the spec says (PIP-006/R10); tested before the first implementer stage only
    duration_s: 1157
  - at: 2026-10-30T04:41:50.142Z
    role: implementer
    result: done
    summary: Report documents key, history record, tester check and brief; roles mirrored, assets rebuilt
    verdict: null
    assumed: []
    duration_s: 1236
  - at: 2026-10-30T04:50:19.563Z
    role: reviewer
    result: done
    summary: "Changes: stale/skipped exemptions and lost error detail; 1144 tests, lint and typecheck pass"
    verdict: changes
    findings:
      - cites:
          - INV-004
          - PIP-006/R10
          - pipeline.StageRecord.documents
          - PIP-014/R4
        text: "[P1] src/core/report.ts:290 and src/core/brief.ts:273 union documents from every done spec-writer stage indefinitely. Before any implementer runs, reopen the spec-writer, change a previously documented scenario's steps to require new behaviour, and finish with documents: []. The old ID still exempts it from red and the brief still says its test must pass; a correct failing test is refused. R10 explicitly prescribes this union, so the spec needs revocation/revalidation semantics tied to the current scenario steps, with a reopened-stage scenario."
        spec: true
      - cites:
          - INV-004
          - PIP-006/R10
          - PIP-006/S29
        text: "[P1] src/core/report.ts:291-299 checks documented tests only for status failed; coverage at line 272 accepts skipped tests. With every new scenario documented and its only test skipped/pending, coverage succeeds, no documented failure is found, and no red test is required: the tester is accepted without any passing test of that scenario. Require an actual passing test for each documented scenario and cover the skipped-only case."
      - cites:
          - PIP-006/R8
        text: "[P2] src/core/report.ts:297 now removes documented scenarios from covering, but lines 303-306 reuse that filtered set for R8. A documented new test failing with failureKind error gets only the documents diagnostic, losing the mandatory diagnostic containing firstErrorLine. Exclude documented scenarios only from the red-test requirement, not from error validation."
    assumed: []
    duration_s: 509
  - at: 2026-10-30T04:55:40.582Z
    role: spec-writer
    result: done
    summary: "documents: only the latest done spec-writer stage counts; documented tests must run and pass; R8 still applies"
    verdict: null
    assumed:
      - new: How is a documents exemption revoked?
        value: only the latest done spec-writer stage's documents count (PIP-006/R10); no per-scenario step snapshot, since on a proposal only the spec-writer changes spec files (INV-003), so steps cannot change after the stage that last listed them
      - new: What order do problems come in for a documented test that fails by an error?
        value: the R10 documented-failure problem, then R8's error problem (PIP-006/S34)
      - new: Who mirrors the new role wording into the bundled prompts?
        value: the implementer updates roles/spec-writer.md, roles/tester.md and src/generated/assets.ts to match spec/roles; .claude/agents is recompiled at merge
    duration_s: 320
  - at: 2026-10-30T05:04:01.366Z
    role: tester
    result: done
    summary: Added tests for PIP-006/S32, S33, S34 (latest documents, skipped, error); all three fail on the current code
    verdict: null
    assumed: []
    duration_s: 500
  - at: 2026-10-30T05:15:36.315Z
    role: implementer
    result: done
    summary: Only the latest spec-writer's documents count; skipped-only documented tests refused; R8 still applies to them
    verdict: null
    assumed: []
    duration_s: 694
  - at: 2026-10-30T05:21:26.936Z
    role: reviewer
    result: done
    summary: "Approved: three findings fixed; test-first predicate holds; 1152 tests, lint and typecheck pass"
    verdict: approve
    assumed: []
    duration_s: 350
---
Self-hosting finding P28. PROP-043's spec-writer added GRF-010/S11 after running today's build and finding it already holds. The tester's test therefore passes, and INV-004 (PIP-006/R2, R3) refuses the tester stage before the first implementer stage. `ticket answer --back implementer` is refused because no implementer stage has run, and answering without --back reruns the tester into the same refusal: the ticket has no route forward. A proposal must be able to pin existing behaviour (follow-ups, spec gaps the reviewer found, P27). The exemption must be explicit and narrow, so test-first still protects every scenario that changes behaviour.
