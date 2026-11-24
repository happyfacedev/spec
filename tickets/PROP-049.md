---
id: PROP-049
type: proposal
title: spec merge takes the per-ticket lock before it removes the merged ticket's worktree
status: done
stage: null
touches: [WSP-006]
violates: []
depends_on: []
changed: [WSP-001, WSP-002, WSP-006, WSP-006/R8, WSP-006/S2, WSP-006/S8, WSP-006/S9, WSP-006/S29, WSP-006/S30, WSP-006/S31, WSP-006/S32, workspace.MergeResult, workspace.MergeResult.worktreeBusy, workspace.WorktreeBusy]
questions:
  - id: Q1
    kind: blocker
    text: 'The implementer stage ended with an invalid report: tests fail (exit 1): WSP-005/S3 Independent tickets start together, the others wait. Its changes are kept in git stash "PROP-049 implementer: blocked"; the next implementer stage gets them back. Answer to resume.'
    default: null
    cites: []
    answer: The failure was WSP-005/S3, a test that was still load-sensitive; it now uses a barrier on main (no timing). Restarting the stage syncs the fix in. Resume.
    raised_by: implementer
  - id: Q2
    kind: blocker
    text: The findings ask only for stronger WSP-006 R8 tests (S30/S31 boundary and state, afterMerge and undo lock order, dirty failed-setup tree); the tester must write them
    default: null
    cites:
      - WSP-006/R8
      - WSP-006/S30
      - WSP-006/S29
    answer: "Agreed: the tester strengthens the R8 tests."
    raised_by: implementer
history:
  - at: 2026-10-30T07:04:12.491Z
    role: spec-writer
    result: done
    summary: "WSP-006/R8: merge takes worktree-<ID>.lock after merge.lock to remove the worktree and .failed; 15-min wait, no deadlock"
    verdict: null
    assumed:
      - new: What does merge do when the ticket's lock is still held after 15 minutes?
        value: "The ticket stays merged, the worktree and setup state are left, the line ends ', but its worktree was not removed: another spec worktree add for <ID> is still running (pid <pid>)', JSON member worktreeBusy, exit code 0"
      - new: Which setup state does merge clear after removing the worktree?
        value: Only spec/setup/<ID>.failed, as spec worktree remove does (WSP-002/R2); the setup record <ID>.txt is kept, and .failed stays when git keeps a tree with uncommitted changes
    duration_s: 200
  - at: 2026-10-30T07:13:39.981Z
    role: tester
    result: done
    summary: Tests for WSP-006 S29-S32 added to merge-scenarios.test.ts; all four fail on the missing merge ticket lock
    verdict: null
    assumed: []
    duration_s: 567
  - at: 2026-10-30T07:26:39.260Z
    role: implementer
    result: blocked
    summary: invalid report
    verdict: null
    assumed: []
    duration_s: 778
  - at: 2026-10-30T19:09:17.280Z
    role: implementer
    result: done
    summary: spec merge holds worktree-<ID>.lock under merge.lock to remove the worktree and .failed; 15-min wait, busy reported
    verdict: null
    assumed: []
    duration_s: 42108
  - at: 2026-10-30T19:15:13.308Z
    role: reviewer
    result: done
    summary: "R8 regression tests need strengthening; 90 tests pass. Candidate bug ticket: post-commit crash cleanup."
    verdict: changes
    findings:
      - cites:
          - WSP-006/S30
          - WSP-006/S31
          - WSP-006/R8
        text: tests/cli/merge-scenarios.test.ts:572-583,636-653 advances Date.now but never asserts elapsed time, so a merge-specific timeout of zero or one minute would still pass. Neither case seeds or snapshots .failed or the setup record, and S30 only checks that the tree exists. Pin the 900000 ms boundary and unchanged tree, setup files and holder lock, alongside merged ancestry, exit 0 and worktreeBusy.
      - cites:
          - WSP-006/R8
          - WSP-006/R6
          - WSP-006/R1
          - WSP-006/S23
          - WSP-006/S29
        text: tests/cli/merge-scenarios.test.ts:586-666 has no afterMerge case and only checks final lock absence; existing afterMerge and guarded-undo cases never contend with a held ticket lock. These tests would accept retaining the ticket lock through afterMerge or waiting for it before undo. Observe ownership and release order, assert afterMerge runs with merge.lock held and this merge's ticket lock released, exercise afterMerge on timeout including its failure exit, and prove a refused merge undoes without waiting on or changing another holder's ticket lock.
      - cites:
          - WSP-006/S9
          - WSP-006/R8
        text: tests/cli/merge-scenarios.test.ts:231-237 checks a dirty worktree but has no .failed marker; S29 checks marker removal only for a clean tree. Unconditionally clearing .failed after a refused git worktree remove would pass all these tests and lose the setup retry state. Add a dirty, failed-setup worktree case asserting its edits, .failed contents and setup record survive, with both merge-owned locks released.
    assumed: []
    duration_s: 355
  - at: 2026-10-30T19:15:44.197Z
    role: implementer
    result: blocked
    summary: Review asks only for stronger WSP-006 R8 tests; the tester must write them, no code change
    verdict: null
    assumed: []
    duration_s: 30
  - at: 2026-10-30T19:15:44.606Z
    role: tester
    result: reopened
    summary: reopened by PROP-049#Q2
    verdict: null
    assumed: []
  - at: 2026-10-30T19:31:28.283Z
    role: tester
    result: done
    summary: "Stronger WSP-006/R8 tests: 900000 ms boundary, state unchanged, lock order, refused undo, dirty failed-setup tree"
    verdict: null
    assumed: []
    duration_s: 943
  - at: 2026-10-30T19:45:05.708Z
    role: implementer
    result: done
    summary: Code unchanged; strengthened WSP-006 R8 tests pass with full suite, lint and typecheck clean
    verdict: null
    assumed: []
    duration_s: 815
  - at: 2026-10-30T19:47:55.606Z
    role: reviewer
    result: done
    summary: "All three R8 findings resolved; 96 regression/e2e tests pass. Crash cleanup follow-up: PROP-050."
    verdict: approve
    assumed: []
    duration_s: 169
---
Follow-up from PROP-045's review. Since PROP-023 and PROP-045, `spec worktree add` and `spec worktree remove` hold `<common>/spec/worktree-<ID>.lock`. `spec merge` removes the merged ticket's worktree with `git worktree remove` directly (src/cli/merge.ts), under merge.lock only, so it can race an add for the same ticket that is creating or retrying setup. Merge takes the per-ticket lock (after merge.lock, never the other way round, so the two cannot deadlock) for the removal and the setup-state cleanup.
