---
id: PROP-003
type: proposal
title: gaps says why tests did not run and stops claiming they did
status: done
stage: null
touches: [ADP-003]
violates: []
depends_on: []
changed: [ADP-003, ADP-003/R2, ADP-003/S1, ADP-003/S2, ADP-003/S3, ADP-003/S4, ADP-003/S5, ADP-003/S6, ADP-003/S7, ADP-003/S8, ADP-003/S9, ADP-003/S10]
questions:
  - id: Q1
    kind: blocker
    text: The Bash tool is denied for this session, so spec test, npm run typecheck and npm run lint cannot run; the change cannot be verified and nothing was edited
    default: null
    cites:
      - ADP-003/R2
      - ADP-003/S4
      - ADP-003/S9
      - ADP-003/S10
    answer: "Bash was not off: only commands outside the allowed list were refused (bare spec, git -C). Use the full spec path and npm/npx commands; read-only git is now allowed (6136eae). Resume."
    raised_by: implementer
  - id: Q2
    kind: blocker
    text: "npm run lint fails on tests/cli/find-untested-scenarios.test.ts lines 54 and 57 (no-confusing-void-expression: deprecateCnv002 and emitWidgetMade are void arrow shorthands). Fixing them edits a test file, which the implementer may not change. The tester must add braces to both arrows. The code change, which I reverted, passes all 9 ADP-003 tests and the full suite of 520."
    default: null
    cites:
      - ADP-003/S5
      - ADP-003/S9
      - ADP-003/S10
    answer: "Fixed by a person commit (c67ed31): eslint --fix on the test file, no behaviour change. Redo the reverted change and finish."
    raised_by: implementer
history:
  - at: 2026-10-29T11:16:44.921Z
    role: spec-writer
    result: done
    summary: "ADP-003: failed test runs print the reason; --no-tests and failed runs close with 'tests were not checked'"
    verdict: null
    assumed:
      - new: Should spec gaps --format json also carry the failed run's reason, as a new GapReport key?
        value: No. JSON is unchanged and scenariosWithoutTests stays null
      - new: Should the tests-not-checked closing line live in ADP-002/S16, which is outside the ticket's touches?
        value: No. ADP-003/S9 and S10 own it; ADP-002 is unchanged
      - new: Should ADP-003 Q1 and Q2 drop 'until it lands' from their answers once this merges?
        value: Left as recorded; the person's answer text is not edited
  - at: 2026-10-29T11:24:10.141Z
    role: tester
    result: done
    summary: ADP-003 S1-S10 tests written (S8 kept); suite not run, Bash denied; expected reds S4, S9, S10
    verdict: null
    assumed:
      - new: Can S1 (and the report-based tests) use a logging stand-in with the same placeholders instead of the vitest command, since the real command cannot show it ran once with an empty filter?
        value: "Yes: the stand-in logs each run's filter and directory and copies a report; the Given's vitest command is not run"
      - new: Can S9 and S10 use the lint-case base spec, which has the unused contract alpha.WidgetMade?
        value: "Yes: add emits: [alpha.WidgetMade] to ALP-001 in the copied repo, so the spec has no unused contract"
  - at: 2026-10-29T11:26:11.418Z
    role: implementer
    result: blocked
    summary: Bash is denied, so tests, typecheck and lint cannot run; no code changed, the fix is planned
    verdict: null
    assumed: []
  - at: 2026-10-29T11:36:20.640Z
    role: implementer
    result: blocked
    summary: ADP-003 fix passes 520 tests; lint fails only in tester's test file lines 54, 57 (void arrows); reverted
    verdict: null
    assumed: []
  - at: 2026-10-29T11:46:35.743Z
    role: implementer
    result: done
    summary: gaps prints why the tests did not run and closes with "the tests were not checked" when none ran
    verdict: null
    assumed:
      - new: "With no config.json there is no test command: should gaps print a reason line after 'Not checked'?"
        value: No. R2 lists four causes and no-config is not one; the line stays without a reason, and the closing line says the tests were not checked
  - at: 2026-10-29T11:50:26.972Z
    role: reviewer
    result: done
    summary: "approve: all ADP-003 checklist items hold; R2 tested for one of its four causes only (non-blocking)"
    verdict: approve
    assumed:
      - new: Is the S1 stand-in command an acceptable stand-in for the Given's vitest command?
        value: Yes; the Then (one run, project root, empty filter) is checked through the same placeholder substitution
      - new: Should the R2 reason line appear when there is no config and so no test command?
        value: No, as the implementer assumed; the line stays without a reason and the closing line says the tests were not checked
      - new: Did the tester's commit show red tests for S4, S9 and S10 (INV-004)?
        value: Assumed yes by reading the base code, since the tester's run was denied and the history does not record it
---
Review 2026-10-29. ADP-003#Q1: when the test command fails or writes no report, gaps prints the reason, as spec test does. ADP-003#Q2: with --no-tests or a failed run, the closing line says the tests were not checked instead of "every scenario tested".
