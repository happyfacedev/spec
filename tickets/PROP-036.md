---
id: PROP-036
type: proposal
title: Plan keeps unmerged tickets apart and resumes paused ones
status: done
stage: null
touches: [TKT-011, WSP-008, PIP-008]
violates: []
depends_on: []
changed: [PIP-008/R7, PIP-008/S1, PIP-008/S2, PIP-008/S3, PIP-008/S4, PIP-008/S5, PIP-008/S6, PIP-008/S7, PIP-008/S8, PIP-008/S9, PIP-008/S10, PIP-008/S11, PIP-008/S12, PIP-008/S13, PIP-008/S14, PIP-008/S15, PIP-008/S16, PIP-008/S17, PIP-008/S18, PIP-008/S19, TKT-011/R5, TKT-011/R8, TKT-011/S1, TKT-011/S2, TKT-011/S3, TKT-011/S4, TKT-011/S5, TKT-011/S6, TKT-011/S7, TKT-011/S8, TKT-011/S9, TKT-011/S10, TKT-011/S11, TKT-011/S12, TKT-011/S13, TKT-011/S14, TKT-011/S15, TKT-011/S16, TKT-011/S17, TKT-011/S18, TKT-011/S19, TKT-011/S20, TKT-011/S21, WSP-008/R6, WSP-008/S1, WSP-008/S2, WSP-008/S3, WSP-008/S4, WSP-008/S5, WSP-008/S6, WSP-008/S7, WSP-008/S8, WSP-008/S9, WSP-008/S10, WSP-008/S11, WSP-008/S12, WSP-008/S13, WSP-008/S18]
questions:
  - id: Q1
    kind: blocker
    text: "The implementer stage ended with an invalid report: a blocked stage leaves no uncommitted changes; stash src/cli/merge.ts, src/cli/report.ts, src/core/gate.ts, src/core/plan.ts as 'PROP-036 implementer: blocked'. Review the uncommitted changes, then answer to resume."
    default: null
    cites: []
    answer: "The implementer is right: the existing TKT-011 test still expects the old reason, but under the new R8 and S21 BUG-301 is in flight, so the reason starts with 'after BUG-301'. Tester: update that test. The implementer's work is stashed as 'PROP-036 implementer: blocked' (the harness had refused git stash; it is now allowed) and comes back when the implementer stage restarts."
    raised_by: implementer
history:
  - at: 2026-10-29T13:01:55.066Z
    role: spec-writer
    result: done
    summary: Plan counts unmerged-stage tickets as in flight; advance adds scope-required features; orchestrate replans held tickets
    verdict: null
    assumed:
      - new: Does an in-flight ticket that is not running appear under Running?
        value: No; it is planned as usual but takes priority in wave assignment
      - new: Output wording for advance's scope additions
        value: "third stdout line: scope: added <IDs> to changed"
      - new: Orchestrate replan when depth limit or empty wave ends the loop
        value: unchanged from today
  - at: 2026-10-29T13:20:03.781Z
    role: tester
    result: done
    summary: Added a test per scenario for TKT-011, PIP-008 and WSP-008; the four new-behaviour tests fail now
    verdict: null
    assumed:
      - new: How can WSP-008/S18 be produced in a test?
        value: The stand-in run for TASK-104 exits open while TASK-103 is really in progress; the test expects wave 2 to dispatch it again.
      - new: What state does an in-flight ticket have on its branch?
        value: A branch ticket/PROP-201 with one history entry and status open or blocked, left unmerged.
      - new: Does the PIP-008/S5 commit cut apply to the whole subject?
        value: Yes, the whole subject is cut to 119 characters plus an ellipsis (PIP-008/R1).
  - at: 2026-10-29T13:28:51.398Z
    role: implementer
    result: blocked
    summary: invalid report
    verdict: null
    assumed: []
  - at: 2026-10-29T13:29:21.165Z
    role: tester
    result: reopened
    summary: reopened by PROP-036#Q1
    verdict: null
    assumed: []
  - at: 2026-10-29T13:37:20.123Z
    role: tester
    result: done
    summary: Updated the parallel dispatch test to expect BUG-301 in flight (after BUG-301 first) per TKT-011/R8
    verdict: null
    assumed: []
  - at: 2026-10-29T13:41:45.595Z
    role: implementer
    result: done
    summary: Plan holds unmerged tickets in flight; advance adds scope features; orchestrate replans held tickets
    verdict: null
    assumed: []
  - at: 2026-10-29T13:42:09.798Z
    role: reviewer
    result: done
    summary: Diff meets TKT-011 R5/R8, PIP-008 R7 and WSP-008 R6 and their scenarios; no checklist item broken
    verdict: approve
    assumed: []
---
Self-hosting findings I19, I20 and I22 (docs/SELF-HOSTING.md). (1) spec plan counts a ticket as in flight, for every conflict rule, while its branch holds a recorded stage that is not merged into the base branch, whatever its status (open, blocked or in progress). Today only in-progress tickets count, so a ticket that dropped back to open let a later wave start overlapping spec stages, which took the same new scenario and rule numbers. (2) After a spec-writer stage, spec ticket advance adds to the ticket's changed every unit the gate's scope rule requires for what the stage changed (for example a feature that writes a contract the stage extended), and names them in its output, instead of leaving the gate to stop the tester with a scope gap. (3) orchestrate plans again, in the next wave, a ticket that ended a wave open only because another ticket it waited for was running, instead of listing it as waiting for a person.
