---
id: PROP-037
type: proposal
title: Merge rebuilds what is generated; tests must fail on their assertion
status: done
stage: null
touches: [WSP-006, PIP-006, LNT-003]
violates: []
depends_on: []
changed: [LNT-001, LNT-001/S1, LNT-001/S2, LNT-001/S3, LNT-001/S4, LNT-001/S5, LNT-001/S6, LNT-001/S7, LNT-001/S8, LNT-001/S9, LNT-001/S10, LNT-003, LNT-003/R4, LNT-003/R5, LNT-003/S1, LNT-003/S2, LNT-003/S3, LNT-003/S4, LNT-003/S5, LNT-003/S6, LNT-003/S7, LNT-003/S8, LNT-003/S9, LNT-003/S10, LNT-003/S11, LNT-003/S12, LNT-003/S13, LNT-003/S14, PIP-006, PIP-006/R8, PIP-006/S23, PIP-006/S24, PIP-006/S25, PIP-010, PIP-010/R4, PIP-010/S1, PIP-010/S2, PIP-010/S3, PIP-010/S4, PIP-010/S5, PIP-010/S6, PIP-010/S7, PIP-010/S8, PIP-010/S9, PIP-010/S10, PIP-010/S11, WSP-006, WSP-006/R2, WSP-006/R4, WSP-006/R5, WSP-006/S1, WSP-006/S2, WSP-006/S3, WSP-006/S4, WSP-006/S5, WSP-006/S6, WSP-006/S7, WSP-006/S8, WSP-006/S9, WSP-006/S10, WSP-006/S11, WSP-006/S12, WSP-006/S13, WSP-006/S14, WSP-006/S15, WSP-006/S16, WSP-006/S17, lint.Lint, lint.Lint.ci, lint.RuleCode, pipeline.TestCase, pipeline.TestCase.failureKind, pipeline.TestCase.firstErrorLine, pipeline.TestFailureKind, workspace.MergeResult, workspace.MergeResult.agentsCompiled, workspace.MergeResult.bundleRebuilt, workspace.MergedBundleDoesNotBuild, workspace.MergedSpecDoesNotBuild, workspace.MergedTestsFail]
questions:
  - id: Q1
    kind: preference
    text: Should a test reported as flaky by merge still refuse the merge?
    default: yes, refuse, and say it is flaky
    cites: []
    answer: "Yes, refuse, and say it is flaky (the default). Also: the implementer found five older tests that contradict the new spec (test-report.test.ts expects exact {name, status}; test-first.test.ts uses evals/reference/PROP-201.tester.patch whose new test fails with an error). Tester: update those tests and the reference patch. The implementer's code is stashed as 'PROP-037 implementer: blocked' and returns when its stage restarts."
    raised_by: null
history:
  - at: 2026-10-29T13:49:20.225Z
    role: spec-writer
    result: done
    summary: Merge rebuilds agents and bundle and reruns failed tests; tester refuses error-failing tests; lint L027 checks dispatchCommand
    verdict: null
    assumed:
      - question: PROP-037#Q1
        value: yes, refuse, and say it is flaky
      - new: Does a stub's thrown error (first line holds SPEC-STUB) count as an error for the assertion check?
        value: no, it is accepted
      - new: When is L027 checked?
        value: only when dispatchCommand allows at least one Bash(...) entry; entries match by equality or trailing * prefix
      - new: What refuses a merge whose bundle fails to build?
        value: new error workspace.MergedBundleDoesNotBuild; agent compile failure reuses workspace.MergedSpecDoesNotBuild
  - at: 2026-10-29T14:01:24.167Z
    role: tester
    result: done
    summary: Tests for WSP-006 S1-17, LNT-001/003, PIP-010 S1-11, PIP-006 S23-25; 10 fail on assertions, lint and typecheck clean
    verdict: null
    assumed:
      - new: What is the project's build that the merge runs to rebuild the bundled CLI?
        value: npm run build (package.json scripts.build); the bundle is the skill folder's scripts/spec.cjs
      - new: In WSP-006/S15 the first three lines of the build output may start with npm's own header lines
        value: the test checks the prefix and that the output contains 'type error', not the exact joined text
      - new: LNT-003/S11 lists the typecheck error before the git stash push one, but findings sort by message
        value: the test accepts the two in any order
      - new: How are Bash(...) entries found inside dispatchCommand?
        value: as quoted Bash(...) tokens anywhere in the string; the tests write them as --allowedTools "Bash(x)" ...
  - at: 2026-10-29T14:14:43.019Z
    role: tester
    result: reopened
    summary: reopened by PROP-037#Q1
    verdict: null
    assumed: []
  - at: 2026-10-29T14:39:48.974Z
    role: tester
    result: done
    summary: test-report.test.ts made tolerant of failureKind; PROP-201.tester.patch reverted to HEAD, needs a non-tester fix
    verdict: null
    assumed:
      - new: Who updates evals/reference/PROP-201.tester.patch so its new PRV-001/S4 test fails on an assertion?
        value: someone allowed to edit it; the tester's hook forbids it
  - at: 2026-10-29T14:51:17.650Z
    role: implementer
    result: done
    summary: Merge rebuilds agents/bundle, reruns failed tests; L027; failureKind; PROP-201 reference tester patch fixed; all tests pass
    verdict: null
    assumed: []
  - at: 2026-10-29T14:53:32.235Z
    role: reviewer
    result: done
    summary: Diff meets WSP-006, PIP-006, PIP-010, LNT-001/003; 823 tests pass; note build does not write the skill bundle here
    verdict: approve
    assumed: []
---
Self-hosting findings I21, I23, I24, I25 and I26 (docs/SELF-HOSTING.md). (1) After merging, spec merge recompiles the agents (as compile-roles would) and, when the project's skill bundles the CLI, rebuilds that bundle from the merged source, instead of merging either as text; their changes are committed with the merge (I24, I25). (2) When a test fails on the merged result, merge reruns it once; a test that then passes is reported as flaky with both results, and the merge is still refused (I21). (3) For a proposal's new or changed scenarios, the tester stage is refused when a failing test of theirs failed with an error rather than an assertion (vitest and jest report the failure's type, JUnit separates error from failure), naming the test and its first error line (I23). (4) spec lint --ci reports an error when a command the pipeline requires of a role is not allowed by dispatchCommand: the test command, each checkCommands entry, and git stash push (I26).
