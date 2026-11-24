---
id: PROP-047
type: proposal
title: WSP-001 states the per-ticket lock that worktree add already holds
status: done
stage: null
touches: [WSP-001]
violates: []
depends_on: []
changed: [WSP-001, WSP-001/R6, WSP-001/S19, WSP-001/S20, WSP-001/S21, WSP-002, workspace.AddWorktree, workspace.WorktreeBusy]
questions:
  - id: Q1
    kind: blocker
    text: The finding asks only for a stronger WSP-001/S20 test (add still pending before 900000 ms, failing at the deadline); the tester must write it
    default: null
    cites:
      - WSP-001/S20
      - WSP-001/R6
    answer: "Agreed: the tester strengthens the S20 test."
    raised_by: implementer
history:
  - at: 2026-10-30T05:40:59.518Z
    role: spec-writer
    result: done
    summary: "WSP-001 R6 and S19-S21 state the per-ticket add lock: wait, 15-minute WorktreeBusy, takeover of a dead lock"
    verdict: null
    documents:
      - WSP-001/S19
      - WSP-001/S20
      - WSP-001/S21
    assumed:
      - new: Does an add that times out on the lock fail with the error WSP-002 uses?
        value: "yes: workspace.WorktreeBusy, now named in workspace.AddWorktree's output and covering add as well as remove"
    duration_s: 1010
  - at: 2026-10-30T05:49:54.234Z
    role: tester
    result: done
    summary: Tests for WSP-001/S19, S20, S21 (documents current behaviour) added in tests/cli/worktree-add-lock.test.ts; all pass now
    verdict: null
    assumed: []
    duration_s: 534
  - at: 2026-10-30T06:03:07.943Z
    role: implementer
    result: done
    summary: WSP-001 R6 and S19-S21 already hold in code; spec test 1156 passed, typecheck and lint clean
    verdict: null
    assumed: []
    duration_s: 793
  - at: 2026-10-30T06:13:01.067Z
    role: reviewer
    result: done
    summary: Spec matches code; 1156 tests/lint/typecheck pass; S20 lacks deadline coverage; build skipped (read-only).
    verdict: changes
    findings:
      - cites:
          - WSP-001/S20
          - WSP-001/R6
        text: "[P2] tests/cli/worktree-add-lock.test.ts:134-148 advances Date.now by a minute per read but asserts only the final error and unchanged state. A one-minute or one-hour timeout would still pass, so the test does not pin the documented 15-minute wait. Control the wait clock/sleep and assert that the add remains pending before 900000 ms and fails at the deadline."
    assumed: []
    duration_s: 592
  - at: 2026-10-30T06:13:27.814Z
    role: implementer
    result: blocked
    summary: Review finding asks only for a stronger WSP-001/S20 test; the tester must write it
    verdict: null
    assumed: []
    duration_s: 26
  - at: 2026-10-30T06:13:28.244Z
    role: tester
    result: reopened
    summary: reopened by PROP-047#Q1
    verdict: null
    assumed: []
  - at: 2026-10-30T06:25:48.918Z
    role: tester
    result: done
    summary: WSP-001/S20 test now pins the 15-minute wait with a controlled clock; 1-minute and 1-hour timeouts fail it
    verdict: null
    assumed: []
    duration_s: 740
  - at: 2026-10-30T06:38:45.788Z
    role: implementer
    result: done
    summary: WSP-001 R6 and S19-S21 already hold in code; spec test 1156 passed, typecheck and lint clean
    verdict: null
    assumed: []
    duration_s: 776
  - at: 2026-10-30T06:42:39.663Z
    role: reviewer
    result: done
    summary: R6/S19-S21 match code; S20 deadline verified; 1156 tests/lint/typecheck pass; build skipped (read-only).
    verdict: approve
    assumed: []
    duration_s: 233
---
Self-hosting finding P27. PROP-023's final round added a per-ticket lock to `spec worktree add` (`<common>/spec/worktree-<ID>.lock`, held across the whole add, setup and retry-state change; waits up to 15 minutes, then fails with "another spec worktree add for <ID> is still running (pid <pid>)"; a lock whose process has ended is taken over). The code and its concurrency tests are on main, but WSP-001 never says so, so the behaviour is unspecified. Write it into WSP-001 as it is today (a rule and scenarios matching the existing tests in tests/cli/worktree-setup-concurrent.test.ts), consistent with WSP-002's remove lock from PROP-045. No behaviour change.
