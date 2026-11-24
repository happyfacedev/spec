---
id: PROP-106
type: proposal
title: A test hand-off is not refused for check failures only in test files; the tester check lints its test files
status: done
stage: null
touches: [PIP-008]
violates: []
depends_on: []
changed: [PIP-006/R7, PIP-006/S19, PIP-008/R13, PIP-008/R15, PIP-008/S30, PIP-008/S31, PIP-008/S32]
questions: []
history:
  - at: 2026-11-01T17:29:54.629Z
    role: spec-writer
    result: done
    summary: A hand-off goes ahead when check failures name only test files; failure files are read from output paths, absolute ones included
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-008/S28, PIP-008/S29, PIP-008/S31, PIP-008/S32, PIP-006/S19, PIP-006/S20, PIP-006/S21, PIP-021/S3]
        reason: impact reaches PIP-008 only; its hand-off scenarios S28 and S29 are unchanged and S31 and S32 cover the changed check; PIP-006 and PIP-021 keep S19, S20, S21 and the tests lane
      - item: C2
        outcome: scenarios
        ids: [PIP-006/S19, PIP-008/S32]
        reason: relative, ./-prefixed and absolute paths are read as one project-relative form; case and symlinks follow the project's own path matching and are not changed
      - item: C3
        outcome: na
        ids: []
        reason: no state shared across a process boundary changes; the check commands run inside one advance or check-report call
      - item: C4
        outcome: invariant
        ids: [INV-003]
        reason: a command's output is untrusted text; it can only widen the hand-off to test files, which the implementer cannot change and the tester must fix, and a forged path to a non-project file names nothing
      - item: C5
        outcome: scenarios
        ids: [PIP-008/S31, PIP-008/S32]
        reason: a failure that names no file, or any file outside testGlobs, is an ordinary block
      - item: C6
        outcome: scenarios
        ids: [PIP-006/S20, PIP-006/S21, PIP-008/S28, PIP-008/S31, PIP-008/S29]
        reason: tester non-test failures, implementer refusal on any failing command, the plain hand-off and the passed flag are unchanged
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool or service; the decision uses only the check command's own output paths
    assumed:
      - new: Does a check command that fails naming no file hand off?
        value: "No: it is an ordinary block, because only a failure that positively names test files is treated as the tester's to fix"
      - new: Does a failure naming both a test file and a non-test file hand off?
        value: "No: every named file must be under testGlobs"
      - new: Is PIP-006 in scope although the ticket touches only PIP-008?
        value: "Yes: the tester's check rule R7 lives in PIP-006, so I edited it"
    duration_s: 246
  - at: 2026-11-01T19:53:48.532Z
    role: spec-review
    result: done
    summary: Output-path scanning can misclassify a non-test check failure as a test-only hand-off
    verdict: changes
    findings:
      - cites: [PIP-006/R7, PIP-008/R13, PIP-008/S32, INV-003]
        text: "R7 collects paths anywhere in untrusted stdout/stderr without establishing that they identify failures. A command can exit 1 with stdout 'checking tests/PRV-001.test.ts' (an existing test file) and stderr 'fatal: lint configuration could not be loaded'. R13 then commits and hands off this non-test failure because its only collected file is a test. An incidental or forged line thus converts an ordinary fileless block into a hand-off. Define conservative failure-attribution evidence and cover a global/unclassified failure accompanied by an incidental test path. INV-003 enforces edit ownership, not failure attribution; the tester can be refused by the same output while lacking permission to repair the underlying failure. The later all-checks passed flag prevents an unchecked reviewer transition, but not this incorrect committed hand-off."
        class: C4
    assumed: []
    duration_s: 207
  - at: 2026-11-01T19:54:57.938Z
    role: spec-writer
    result: done
    summary: The tester's check reads failing check-command files from output paths, absolute ones included; the hand-off relaxation is dropped
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-006/S19, PIP-006/S20, PIP-006/S21, PIP-008/S28, PIP-008/S29, PIP-008/S31, PIP-021/S3]
        reason: impact reaches PIP-008 only, now unchanged; its hand-off scenarios stay as on main, and PIP-006 keeps S20 and S21 with S19 now covering absolute paths
      - item: C2
        outcome: scenarios
        ids: [PIP-006/S19]
        reason: relative, ./-prefixed and absolute paths are read as one project-relative form; case and symlinks follow the project's own path matching and are not changed
      - item: C3
        outcome: na
        ids: []
        reason: no state shared across a process boundary changes; the check commands run inside one check-report or advance call
      - item: C4
        outcome: invariant
        ids: [INV-003]
        reason: a command's output is untrusted text; it now only decides whether the tester is refused, a fail-safe direction, and it attributes nothing in the implementer's hand-off, which is unchanged from main
      - item: C5
        outcome: scenarios
        ids: [PIP-006/S20, PIP-008/S31]
        reason: a tester failure that names no test file does not refuse it, as before, and a hand-off whose changes fail a check command is still an ordinary block
      - item: C6
        outcome: scenarios
        ids: [PIP-006/S20, PIP-006/S21, PIP-008/S28, PIP-008/S31, PIP-008/S29]
        reason: tester non-test failures, implementer refusal on any failing command, the plain hand-off and the passed flag are unchanged
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool or service; the rule uses only the check command's own output paths
    assumed:
      - new: Does the implementer's hand-off go ahead when a check command fails only in test files?
        value: "No: the hand-off stays as on main, because output paths cannot attribute a failure safely; the tester's own check stops the tester from leaving such failures"
      - new: Is PIP-006 in scope although the ticket touches only PIP-008?
        value: "Yes: the tester's check rule R7 lives in PIP-006, so I edited it"
    duration_s: 66
  - at: 2026-11-01T19:55:56.620Z
    role: spec-review
    result: done
    summary: "C4 resolved: output paths only affect tester refusal; failing checks still prevent an implementer hand-off"
    verdict: approve
    assumed: []
    duration_s: 56
  - at: 2026-11-01T20:02:33.028Z
    role: tester
    result: done
    summary: PIP-006/S19 test now also covers an absolute project path printed on its own line, ESLint style; it fails on an assertion today
    verdict: null
    mutations:
      - scenario: PIP-006/S19
        wrong: reads only project-relative paths from check output, so an absolute path inside the project names no test file and the tester is not refused
    assumed: []
    duration_s: 394
  - at: 2026-11-01T20:13:33.529Z
    role: implementer
    result: done
    summary: The tester check reads failing check-command files from relative or project-absolute output paths, root matched as given and by realpath
    verdict: null
    assumed:
      - new: Must a path exist on disk to count?
        value: No; only the testGlobs match on the project-relative form decides, as for relative paths before
      - new: What of an absolute path outside the project?
        value: Ignored, as is a path that resolves above the root
    duration_s: 658
  - at: 2026-11-01T20:19:10.447Z
    role: reviewer
    result: done
    summary: "Approved: tester check normalizes project-absolute output paths before matching testGlobs"
    verdict: approve
    assumed: []
    duration_s: 334
---
Self-hosting finding P74. On PROP-098 the implementer finished the code and reported a tests blocker: `npm run lint` failed only on two errors in the tester's test file, which the implementer may not edit. The hand-off (PIP-008/R13) was refused because a check command failed on the whole tree ('not handed to the tester: npm run lint fails'), so the ticket blocked on a person's answer and the implementer's code was stashed. The failure was exactly what the tester had to fix. Meanwhile the tester's own report had passed check-report with that lint error in place. Fix: when a check command's failures name only test files (testGlobs), the hand-off goes ahead; and the tester's report check runs the project's check commands so a tester cannot leave lint errors in its own test files.
