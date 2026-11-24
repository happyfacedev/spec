---
id: PROP-045
type: proposal
title: worktree remove takes the per-ticket lock that worktree add holds
status: done
stage: null
touches: [WSP-002]
violates: []
depends_on: []
changed: [WSP-002, WSP-002/R2, WSP-002/S8, WSP-002/S9, WSP-002/S10, workspace.RemoveWorktree, workspace.WorktreeBusy]
questions: []
history:
  - at: 2026-10-30T02:23:06.552Z
    role: spec-writer
    result: done
    summary: worktree remove holds the add's per-ticket lock, waits up to 15 min, same timeout message (WSP-002 R2, S8-S10)
    verdict: null
    assumed:
      - new: WSP-001 in the spec does not state the add lock; is the wait and message taken from today's add?
        value: "yes: 15 minutes and 'another spec worktree add for <ID> is still running (pid <pid>)', read from the current add; WSP-001 left unchanged"
      - new: Does remove print the add's timeout text even when the lock holder is another remove?
        value: yes, the same text, as the ticket asks for the same timeout message
      - new: Which error does the remove timeout raise?
        value: a new workspace.WorktreeBusy, exit 1, added to workspace.RemoveWorktree's output
    duration_s: 458
  - at: 2026-10-30T02:32:26.370Z
    role: tester
    result: done
    summary: Tests for WSP-002 S8-S10 in tests/cli/worktree-remove-lock.test.ts; all three fail now on the missing remove lock
    verdict: null
    assumed:
      - new: How is the 15-minute wait of S9 driven, since the code exposes no timeout?
        value: Date.now is mocked to move a minute per reading, so the real wait loop reaches its limit in about a second; the lock is held by a live sleep process whose pid is in the message
      - new: Does S10 expect the lock file gone after the remove?
        value: "yes: the remove takes the dead lock over, holds it, and releases it, so no worktree-BUG-301.lock file is left"
    duration_s: 559
  - at: 2026-10-30T02:44:36.990Z
    role: implementer
    result: done
    summary: worktree remove now holds the per-ticket add lock, waits 15 min, same busy message (WSP-002 R2, S8-S10)
    verdict: null
    assumed:
      - new: Does spec merge need the ticket lock when it removes the worktree?
        value: "no: merge calls git worktree remove directly under its own merge.lock, so no shared lock and no deadlock"
    duration_s: 728
  - at: 2026-10-30T02:55:31.638Z
    role: reviewer
    result: done
    summary: "WSP-002 verified; 1123 tests pass. Candidate follow-up: pre-existing merge/add race (src/cli/merge.ts:123)."
    verdict: approve
    assumed: []
    duration_s: 654
---
Follow-up from PROP-023's final review. Since PROP-023, `spec worktree add` holds a per-ticket lock (`<common>/spec/worktree-<ID>.lock`) across the whole add, setup and retry-state change. `spec worktree remove` clears the same retry state (the .failed marker) without taking the lock, so a remove that overlaps an add for the same ticket can clear or race the state the add is writing. Remove takes the same lock for its whole run and waits for an add in progress, with the same timeout message.
