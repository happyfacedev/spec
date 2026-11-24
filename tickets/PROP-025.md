---
id: PROP-025
type: proposal
title: merge refuses without a test command, checks every argument first, and says when it keeps a worktree
status: done
stage: null
touches: [WSP-006, WSP-007]
violates: []
depends_on: []
changed: [WSP-006, WSP-006/R8, WSP-006/S9, WSP-007, WSP-007/R2, WSP-007/R3, WSP-007/S16, WSP-007/S17, workspace.Merge, workspace.MergeResult, workspace.MergeResult.worktreeKept, workspace.NoTestCommand]
questions: []
history:
  - at: 2026-10-30T21:37:16.816Z
    role: spec-writer
    result: done
    summary: merge checks all args first (WSP-007 S16/R2), refuses with no test command (S17/R3), reports a kept worktree (WSP-006 S9/R8)
    verdict: null
    assumed:
      - new: Where and how is a merge with no test command refused?
        value: "Per ticket, before anything merges, after the not-a-repository check and before every other refusal: workspace.NoTestCommand 'config.json has no testCommand to run on the merged result', exit 1"
      - new: How is a worktree kept after a merge reported?
        value: "Ticket stays merged, exit 0; line adds ', but its worktree was kept: <path> has uncommitted changes: <first five sorted paths>', or git's reason; JSON member workspace.MergeResult.worktreeKept"
      - new: Should a re-merge of an already merged ticket (WSP-007/S14) also say its leftover worktree was kept?
        value: No, WSP-007/S14 is unchanged; the ticket asks only about the line after a merge
    duration_s: 251
  - at: 2026-10-30T22:11:46.548Z
    role: tester
    result: done
    summary: Tests for WSP-007 S16/S17 and WSP-006 S9 (text, JSON, setup-failed variant) written; all fail on the changed behaviour
    verdict: null
    assumed:
      - new: How does S17 remove config.json?
        value: Commit its deletion on main after the ticket branch is made, so main is clean and has no config
      - new: Does the existing S9 test of a dirty worktree with failed setup also change?
        value: "Yes: its merged line now ends with the kept-worktree suffix listing notes.txt, src/state.ts"
    duration_s: 2065
  - at: 2026-10-30T22:48:49.610Z
    role: implementer
    result: done
    summary: merge checks all args first, refuses without config (NoTestCommand), and reports a kept worktree on the line and in JSON
    verdict: null
    assumed: []
    duration_s: 2221
  - at: 2026-10-30T22:52:10.444Z
    role: reviewer
    result: done
    summary: Spec and implementation agree; 59 merge tests pass; afterAll timeout judged load-related, not a hang
    verdict: approve
    assumed: []
    duration_s: 196
---
Review 2026-10-29. WSP-006#Q2: a merge with no test command (no config.json) is refused, as INV-002 requires. WSP-006#Q3: after a merge, a worktree kept because it has uncommitted changes is reported, with why.

Absorbed from PROP-026 (same spec merge command). Review 2026-10-29, WSP-007#Q1: "spec merge TASK-101 cart" refuses with the usage error before merging TASK-101.
