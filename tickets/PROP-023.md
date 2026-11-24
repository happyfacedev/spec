---
id: PROP-023
type: proposal
title: worktree add runs a failed setup again
status: done
stage: null
touches: [WSP-001]
violates: []
depends_on: []
changed: [WSP-001, WSP-001/R2, WSP-001/R4, WSP-001/R5, WSP-001/S1, WSP-001/S2, WSP-001/S3, WSP-001/S4, WSP-001/S5, WSP-001/S6, WSP-001/S7, WSP-001/S8, WSP-001/S9, WSP-001/S10, WSP-001/S11, WSP-001/S12, WSP-001/S13, WSP-001/S14, WSP-001/S16, WSP-001/S17, WSP-001/S18, workspace.AddWorktree, workspace.SetupFailed]
questions:
  - id: Q1
    kind: blocker
    text: "Code for all findings is done; the reviewer's regression tests (marker binding and removal cleanup, move and recreation identity, /var vs /private/var and symlink aliases, setup-state reset after recreation, monotonic records) are the tester's. Its changes are kept in git stash \"PROP-023 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites:
      - WSP-001/R2
      - WSP-001/R5
      - WSP-001/S16
    answer: "Agreed: code is done; the tester writes the reviewer's regression tests."
    raised_by: implementer
  - id: Q2
    kind: blocker
    text: the reviewer asked for changes 3 times; a person must decide. How should PROP-023 proceed?
    default: null
    cites: []
    answer: "One more round. Both races are real and share one fix: hold a per-ticket lock (src/io/lock.ts, as the start lock does) across the whole add, setup and state transition, and re-read the retry state after taking it. The tester adds deterministic concurrent-failure and concurrent-success tests. After this round, any further finding goes to a follow-up ticket, not another round."
    raised_by: overseer
  - id: Q3
    kind: blocker
    text: "Per-ticket lock added; deterministic concurrent-failure and concurrent-success tests are the tester's. Its changes are kept in git stash \"PROP-023 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites:
      - WSP-001/R2
      - WSP-001/R4
      - WSP-001/S16
    answer: "Agreed: the lock is in; the tester adds the deterministic concurrent tests."
    raised_by: implementer
history:
  - at: 2026-10-29T23:14:15.659Z
    role: spec-writer
    result: done
    summary: worktree add re-runs a failed worktreeSetup (marked by spec/setup/<ID>.failed) instead of answering already at
    verdict: null
    assumed:
      - new: WSP-001 Q1 was answered in review (run setup again on the next add); keep it in the feature?
        value: Removed from WSP-001 questions, since this proposal resolves it
      - new: How does the next add know the last setup failed, without re-running setup in the main tree or in worktrees made before setup records?
        value: A failed setup leaves spec/setup/<ID>.failed in the common git dir; only an add that finds it re-runs setup, and success removes it
      - new: What does a successful re-run print?
        value: "<ID>: set up <project> on ticket/<ID>, exit 0; JSON form has created false"
      - new: How does a re-run treat setup paths?
        value: spec/setup/<ID>.txt is written only once setup succeeds and lists every untracked path then, including what failed runs left; a failed run writes none (as today, checked on a fixture copy)
    duration_s: 557
  - at: 2026-10-29T23:35:32.503Z
    role: tester
    result: done
    summary: Tests for WSP-001 S1-S14, S16-S18 (S15 kept); setup fails once; S8, S16, S17, S18 fail on no re-run
    verdict: null
    assumed: []
    duration_s: 1276
  - at: 2026-10-30T00:12:53.228Z
    role: implementer
    result: done
    summary: worktree add re-runs a failed worktreeSetup, marked by spec/setup/<ID>.failed, and prints set up
    verdict: null
    assumed: []
    duration_s: 2240
  - at: 2026-10-30T00:28:49.335Z
    role: reviewer
    result: done
    summary: Retry marker/record safety needs changes; 504 tests/checks pass; full suite/build skipped (read-only).
    verdict: changes
    assumed: []
    duration_s: 955
  - at: 2026-10-30T00:45:43.757Z
    role: implementer
    result: done
    summary: Retry is bound to the checkout that failed; new checkouts reset state; setup records are extended, never shrunk
    verdict: null
    assumed:
      - new: Do the two review findings need tests?
        value: "Yes: none cover a removed failed worktree with the branch in the primary tree, or a failed recreation after a good add; the reviewer should route them"
    duration_s: 1013
  - at: 2026-10-30T00:51:48.201Z
    role: reviewer
    result: done
    summary: Original repros fixed; identity/tests still need changes; 523 tests pass; full suite/build skipped (read-only).
    verdict: changes
    findings:
      - cites:
          - WSP-001/R2
          - WSP-001/R5
          - WSP-001/S6
          - WSP-001/S16
        text: "[P1] src/io/ticket-runs.ts:43-51 identifies a checkout only by its canonical pathname. Two temporary-fixture probes fail: after setup fails and git worktree move relocates that same checkout, the next add incorrectly answers already at, never retries, and leaves the failure marker. Conversely, git worktree remove followed by git worktree add at the original pathname leaves a stale marker that authorizes setup in a replacement checkout whose setup never failed. Track checkout identity that survives a move but changes on recreation, and add regression tests for both cases."
      - cites:
          - WSP-001/R2
          - WSP-001/S6
          - WSP-001/S16
        text: "[P2] Tester: add automated regression coverage for the original marker-safety fix. tests/cli/worktree-setup-rerun.test.ts:155-164 checks marker existence, but no test checks its checkout binding or removal cleanup. Cover failed setup, successful removal, then the ticket branch in the primary tree; also cover a stale marker for another checkout against primary/recordless existing trees. Assert already at and no setup execution. Cover successful same-checkout retries through /var versus /private/var and symlink aliases. These fixture probes pass now, but the existing tests do not protect the fix."
      - cites:
          - WSP-001/R4
          - WSP-001/R5
          - WSP-001/S15
          - WSP-001/S16
          - WSP-001/S18
        text: "[P2] Tester: add automated regression coverage for setup-state reset and monotonic records. tests/cli/setup-paths.test.ts:31-37 only exercises the already-at fast path; the retry tests start without a saved record. Cover successful add, clean removal, and failed recreation: the old record must be absent, repeated failure must retain the marker, and success must clear it. Separately seed a prior record for a retry and assert old paths survive while new paths are appended without duplicates; a failed git path listing must not erase the record. Both original reproductions and these preservation probes pass now, but none is protected by committed tests."
    assumed: []
    duration_s: 364
  - at: 2026-10-30T01:01:22.426Z
    role: implementer
    result: blocked
    summary: Marker bound to a token in the worktree's git dir; code for all findings done, regression tests are the tester's
    verdict: null
    assumed: []
    duration_s: 573
  - at: 2026-10-30T01:01:22.876Z
    role: tester
    result: reopened
    summary: reopened by PROP-023#Q1
    verdict: null
    assumed: []
  - at: 2026-10-30T01:13:30.192Z
    role: tester
    result: done
    summary: Regression tests for marker binding, move/recreate identity, aliases, state reset, monotonic records; move and recreate fail now
    verdict: null
    assumed: []
    duration_s: 727
  - at: 2026-10-30T01:23:56.275Z
    role: implementer
    result: done
    summary: Token-bound retry passes the new regression tests; suite, lint and typecheck are clean
    verdict: null
    assumed: []
    duration_s: 625
  - at: 2026-10-30T01:34:40.319Z
    role: reviewer
    result: done
    summary: Prior fixes pass; two retry races remain; 533 tests pass; full suite/build skipped (read-only).
    verdict: changes
    findings:
      - cites:
          - WSP-001/R2
          - WSP-001/R5
          - WSP-001/S18
        text: "[P1] src/io/ticket-runs.ts:53-66 publishes a new token with two independent writes, while src/cli/worktree.ts:43-77 allows overlapping retries. A barrier-controlled throwaway-fixture probe scheduled A writing its admin token, B writing its admin token and shared marker, then A writing its shared marker. Both setups failed, but the token pair disagreed; the next add returned already at with exit 0 and never retried. Coordinate the entire per-ticket add/setup/state transition and re-read retry state after acquiring that coordination; add a deterministic concurrent-failure regression test."
      - cites:
          - WSP-001/R4
          - WSP-001/S16
        text: "[P2] src/io/ticket-runs.ts:25-31 performs an unlocked read-merge-write, so concurrent successful retries can shrink the setup record despite the union. A second barrier-controlled fixture probe let A compute old.txt+a.txt, then B replace the generated a.txt with b.txt and write old.txt+b.txt, then A publish its older snapshot. Both adds succeeded; b.txt still existed but disappeared from <ID>.txt, so stage checks would count setup output as role changes. Protect the snapshot merge with per-ticket coordination covering the retry lifecycle; the same lock can resolve the token race. Add a deterministic concurrent-success regression test."
    assumed: []
    duration_s: 643
  - at: 2026-10-30T01:45:11.601Z
    role: implementer
    result: blocked
    summary: Per-ticket lock held across the whole worktree add; concurrent tests are the tester's
    verdict: null
    assumed: []
    duration_s: 624
  - at: 2026-10-30T01:45:12.074Z
    role: tester
    result: reopened
    summary: reopened by PROP-023#Q3
    verdict: null
    assumed: []
  - at: 2026-10-30T01:52:57.405Z
    role: tester
    result: done
    summary: Two barrier-ordered concurrency tests for overlapping worktree adds (failure, success); both fail without the lock
    verdict: null
    assumed:
      - new: Under the lock, must the second of two overlapping successful retries run setup too?
        value: "No: it may find the setup done and answer already at; the test lists its file only if it ran"
    duration_s: 465
  - at: 2026-10-30T02:03:54.363Z
    role: implementer
    result: done
    summary: Per-ticket lock passes the two concurrency tests; suite, lint and typecheck are clean
    verdict: null
    assumed: []
    duration_s: 656
  - at: 2026-10-30T02:10:45.944Z
    role: reviewer
    result: done
    summary: "Approved; 535 tests pass. Candidate follow-up: serialize remove/add. Full suite/build skipped (read-only)."
    verdict: approve
    assumed: []
    duration_s: 411
---
Review 2026-10-29, WSP-001#Q1: when worktreeSetup failed for a ticket's worktree, the next "spec worktree add" for it runs worktreeSetup again instead of answering "already at".
