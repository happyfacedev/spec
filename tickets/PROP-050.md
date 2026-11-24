---
id: PROP-050
type: proposal
title: A merge that dies after its commit leaves no worktree or setup state behind
status: done
stage: null
touches: [WSP-006]
violates: []
depends_on: []
changed: [WSP-001, WSP-002, WSP-002/R3, WSP-002/S11, WSP-002/S12, WSP-003, WSP-003/R1, WSP-003/S9, WSP-007, WSP-007/R1, WSP-007/S1, WSP-007/S2, WSP-007/S3, WSP-007/S4, WSP-007/S5, WSP-007/S6, WSP-007/S7, WSP-007/S8, WSP-007/S9, WSP-007/S10, WSP-007/S11, WSP-007/S12, WSP-007/S13, WSP-007/S14, WSP-007/S15, workspace.AlreadyMerged, workspace.ListWorktrees, workspace.WorktreeBusy, workspace.WorktreeRow, workspace.WorktreeRow.merged]
questions:
  - id: Q1
    kind: blocker
    text: 'Both findings fixed in code; the tester adds regressions for an orphan .failed with no worktree and for list marking with an external ticket store. Its changes are kept in git stash "PROP-050 implementer: blocked"; the next implementer stage gets them back.'
    default: null
    cites:
      - WSP-007/R1
      - WSP-003/R1
    answer: "Agreed: the tester adds the two regressions."
    raised_by: implementer
history:
  - at: 2026-10-30T20:01:44.177Z
    role: spec-writer
    result: done
    summary: Re-merge and worktree remove clean a merged ticket's leftovers idempotently; list marks them; WSP-006 needs no split
    verdict: null
    documents:
      - WSP-002/S11
      - WSP-007/S14
    assumed:
      - new: Where does the re-merge cleanup go, with WSP-006 at 246 of 250 lines?
        value: WSP-007, beside the AlreadyMerged refusal (S6) it extends; WSP-006 is left unchanged, so no split is needed
      - new: Does a re-merge that finishes the cleanup still refuse?
        value: "Yes: the S6 refusal and exit code 1 stay, with '; removed its worktree <path>' or the WorktreeBusy message added only when there was something to remove or the lock stayed busy"
      - new: Does spec worktree list clean leftovers?
        value: "No: it only marks a done ticket's worktree whose branch is merged, with a hint to run spec worktree remove, and 'merged': true in JSON"
      - new: Does spec orchestrate clean a merged ticket's leftovers?
        value: "No: it never merges an already landed ticket again, so it leaves them to spec merge or spec worktree remove, as today"
      - new: What happens to the setup record spec/setup/<ID>.txt?
        value: Kept by merge, re-merge and remove alike, as today; only the .failed file, the tree and the lock are leftovers
      - new: What does remove do with a .failed file when the ticket has no worktree?
        value: Deletes it and still fails with NoWorktree, exit 1
    duration_s: 552
  - at: 2026-10-30T20:34:38.603Z
    role: tester
    result: done
    summary: Tests for merge leftovers cleanup, remove of a .failed file, and list marking; S11 and S14 pass now
    verdict: null
    assumed: []
    duration_s: 1089
  - at: 2026-10-30T20:47:45.835Z
    role: implementer
    result: done
    summary: Re-merge, remove and list now clean or mark a merged ticket's leftover worktree and .failed; suite, lint, typecheck pass
    verdict: null
    assumed: []
    duration_s: 786
  - at: 2026-10-30T20:55:26.157Z
    role: reviewer
    result: done
    summary: PROP-049 preserved; e2e 9/9 and regressions 78/78 pass; orphan cleanup and external-store marking need fixes
    verdict: changes
    findings:
      - cites:
          - WSP-007/R1
          - workspace.AlreadyMerged
        text: src/cli/merge.ts:59-64 clears the .failed marker only after removing an existing worktree. If a merge or cleanup dies after git removes the tree but before clearSetupFailed, every re-merge leaves the orphan marker forever. Clear it under the ticket lock when no worktree exists too, while retaining it when git refuses removal and preserving the .txt record. tests/cli/merge-leftovers.test.ts:91 always restores a worktree, so its retry assertion misses this partial-cleanup state; add a regression with only .failed and a dead lock, then retry twice.
      - cites:
          - WSP-003/R1
          - workspace.WorktreeRow.merged
        text: "src/cli/worktree.ts:112 consults ws.ticketGit.mergedIntoBase, but src/io/workspace.ts:45 sets ws.ticketGit to NO_TICKET_GIT for a files store outside the repository, including --tickets outside it. Such a done ticket with a merged branch is listed without either the text hint or merged: true. Obtain merge membership from the same independent git state used to enumerate worktrees. The S9 test at tests/cli/merge-leftovers.test.ts:181 uses only an in-repository store; add text and JSON coverage for an external store."
    assumed: []
    duration_s: 459
  - at: 2026-10-30T21:01:24.541Z
    role: implementer
    result: blocked
    summary: Both review findings fixed in code; suite, lint and typecheck pass; regressions for them are the tester's
    verdict: null
    assumed: []
    duration_s: 358
  - at: 2026-10-30T21:01:25.933Z
    role: tester
    result: reopened
    summary: reopened by PROP-050#Q1
    verdict: null
    assumed: []
  - at: 2026-10-30T21:11:23.339Z
    role: tester
    result: done
    summary: "Added regressions: no-worktree marker and dead lock cleaned on first re-merge; list marks merged with outside tickets"
    verdict: null
    assumed: []
    duration_s: 596
  - at: 2026-10-30T21:23:06.304Z
    role: implementer
    result: done
    summary: Merged-ticket leftovers are cleaned or marked, incl. orphan .failed and external stores; suite, lint, typecheck pass
    verdict: null
    assumed: []
    duration_s: 702
  - at: 2026-10-30T21:26:25.184Z
    role: reviewer
    result: done
    summary: Both fixes verified; PROP-049 preserved; external-store merge remains a separate follow-up in PROP-053
    verdict: approve
    assumed: []
    duration_s: 198
---
Candidate from PROP-049's review. `spec merge` commits the merge, then removes the ticket's worktree and setup state under the per-ticket lock. If the process dies between the commit and that cleanup (killed, crashed, machine off), the ticket is merged but its worktree, `.failed` marker and lock can stay behind, and nothing cleans them up later. Define what the next `spec merge`, `spec worktree list` or `spec worktree remove` does with a merged ticket's leftovers, and make the cleanup idempotent.
