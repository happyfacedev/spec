---
id: PROP-053
type: proposal
title: spec merge knows a ticket is already merged when its tickets live outside the repository
status: done
stage: null
touches: [WSP-007]
violates: []
depends_on: [PROP-050]
changed: [WSP-007, WSP-007/R1, WSP-007/S18]
questions: []
history:
  - at: 2026-10-30T22:56:41.974Z
    role: spec-writer
    result: done
    summary: WSP-007 R1 reads merged state from the repo's branches wherever tickets live; S18 shows it for an outside store
    verdict: null
    assumed: []
    duration_s: 85
  - at: 2026-10-30T23:06:05.231Z
    role: tester
    result: done
    summary: WSP-007/S18 test added; fails now with "git could not commit the merge" instead of AlreadyMerged plus removed worktree
    verdict: null
    assumed: []
    duration_s: 562
  - at: 2026-10-30T23:26:18.926Z
    role: implementer
    result: done
    summary: spec merge reads already-merged from the repo's own branches (ticketGitState, as worktree list does), so S18 passes with tickets outside the repo
    verdict: null
    assumed: []
    duration_s: 1211
  - at: 2026-10-30T23:32:56.676Z
    role: reviewer
    result: done
    summary: merge.ts:93 now reads mergedIntoBase from the repo own branches, so an already merged ticket with tickets outside the repository is refused with the cleanup (S18, R1). Both test files pass, 60 of 60.
    verdict: approve
    findings:
      - cites:
          - WSP-007/S6
          - WSP-007/S13
        text: "Checked: ticketGitState with ticketsRel null still fills mergedIntoBase and worktrees, so tickets inside the repository behave as before (S6, S13, S14, S15 pass)."
      - cites:
          - WSP-007/R1
        text: "Follow-up: mergeLocked now runs ticketGitState a second time per ticket, a few extra git calls; harmless."
    assumed: []
    duration_s: 396
---
Found by PROP-050's implementer. With a files ticket store outside the repository (`--tickets` or `tickets.dir` outside it), src/io/workspace.ts sets ticketGit to NO_TICKET_GIT, so `spec merge`'s already-merged check (`mergeLocked`, reading `ws.ticketGit.mergedIntoBase`) never sees a merged branch. A re-merge of such a ticket is not refused as already merged and does not run the leftover cleanup of WSP-007/R1. Take merge membership from the repository's own branches, as `spec worktree list` does since PROP-050.
