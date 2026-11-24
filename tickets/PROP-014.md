---
id: PROP-014
type: proposal
title: A misconfigured hook exits 1 so the session goes on
status: done
stage: null
touches: [INS-007]
violates: []
depends_on: []
changed: [INS-006, INS-007, INS-007/R1, INS-007/S1, INS-007/S2, INS-007/S3, INS-007/S4, INS-007/S5, install.UnknownHarness, install.UnknownHookEvent]
questions: []
history:
  - at: 2026-10-29T21:35:02.355Z
    role: spec-writer
    result: done
    summary: "INS-007: a misconfigured hook (unknown harness or event) exits 1, not 2; deliberate blocks keep exit 2"
    verdict: null
    assumed:
      - new: Does install.UnknownHarness keep exit 2 for spec compile-roles, as INS-006 S11 and S12 require?
        value: "Yes: the contract names exit 2 from spec compile-roles and exit 1 from spec hook"
      - new: Should INS-007 Q1's answer keep saying the spec states today's behaviour until the change lands?
        value: "No: the answer now reads as decided in review"
      - new: Do CLI-005 R1 and core/conventions.md still hold with spec hook exiting 1 on a misconfiguration?
        value: "Yes: spec hook stays the named exception and exits 2 only to block a tool call (INS-010 S1), so those files are unchanged"
    duration_s: 528
  - at: 2026-10-29T22:09:47.937Z
    role: tester
    result: done
    summary: INS-007/S1-S3 tests fail on exit 2 (want 1); S4-S5 pass, unchanged; lint and typecheck clean
    verdict: null
    assumed:
      - new: Is INS-007/S4's stderr the whole line, with its trailing newline?
        value: "Yes: compared exactly, as the INS-006 S13 tests do"
      - new: Should S4 and S5 fail now, since they are new tests?
        value: "No: their behaviour is unchanged, so they pass; only S1 to S3 change"
      - new: Does R1 need its own test, since it is a rule and not a scenario?
        value: "No: S1 to S4 each check the exit code R1 names"
    duration_s: 1194
  - at: 2026-10-29T22:30:36.784Z
    role: implementer
    result: done
    summary: "INS-007: spec hook exits 1 for an unknown harness or event; compile-roles and deliberate blocks keep exit 2"
    verdict: null
    assumed:
      - new: Should spec hook's no-spec-root refusal also exit 1, as R1 asks for a misconfigured hook?
        value: "No: R1 defines a misconfigured hook as an unknown harness or event, so the no-root refusal keeps exit 2"
    duration_s: 1248
  - at: 2026-10-29T22:39:02.907Z
    role: reviewer
    result: done
    summary: "Approve: lint/typecheck and 11 CLI comparisons pass; pre-existing no-root blocking is a candidate bug ticket."
    verdict: approve
    assumed:
      - new: Does INS-007/R1 or PROP-014 also intend the no-spec-root refusal to become non-blocking?
        value: No. R1 explicitly enumerates unknown harness/event and unreadable payloads; the ticket requests those paths. src/cli/run.ts:62-63 refuses an absent or unavailable root before cmdHook. Both branch and base still exit 2, which blocks Claude Code. This predates the diff; broader fail-open behavior needs a separate bug ticket.
      - new: Should verification run fixture-writing tests or a build despite the read-only constraint?
        value: "No. Reviewed every checklist item and the unchanged reverify paths; npm run lint, npm run typecheck, and git diff --check passed. Eleven branch/base CLI comparisons passed with identical stdout/stderr: unknown/missing harness and unknown/missing event change 2 to 1; unreadable JSON stays 1; empty input stays 0; compile-roles INS-006/S11-S12 and deliberate block INS-010/S1 stay 2; absent/unavailable roots stay 2. The deliberate block used the recorded broken scenario through an in-memory read overlay. Full fixture-writing test suite and build were skipped."
    duration_s: 505
---
Review 2026-10-29, INS-007#Q1: an unknown harness or event exits 1 with its message, like unreadable input, instead of 2, which Claude Code treats as blocking. Blocking an edit on purpose keeps exit 2.
