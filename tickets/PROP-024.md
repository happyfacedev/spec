---
id: PROP-024
type: proposal
title: worktree list and remove work wherever tickets live
status: done
stage: null
touches: [WSP-003]
violates: []
depends_on: []
changed: [WSP-002, WSP-002/S1, WSP-002/S2, WSP-002/S3, WSP-002/S4, WSP-002/S5, WSP-002/S6, WSP-002/S7, WSP-003, WSP-003/S1, WSP-003/S2, WSP-003/S3, WSP-003/S4, WSP-003/S5, WSP-003/S6, WSP-003/S7, WSP-003/S8]
questions: []
history:
  - at: 2026-10-29T21:57:28.420Z
    role: spec-writer
    result: done
    summary: "Spec: list and remove cover a ticket folder outside the repo and trackers (WSP-002, WSP-003)"
    verdict: null
    assumed:
      - new: Which status does worktree list print for a ticket whose folder is outside the repository?
        value: The status its file in that folder holds, as spec queue reads it from the same tree
      - new: Does remove belong in this proposal, though touches lists only WSP-003?
        value: "Yes: the ticket title names remove, so WSP-002 is changed too"
    duration_s: 431
  - at: 2026-10-29T22:23:02.040Z
    role: tester
    result: done
    summary: 15 tests for WSP-002 and WSP-003; 2 fail on tickets outside the repository, 13 pass on current code
    verdict: null
    assumed:
      - new: Which folder outside the repository holds the tickets for WSP-002/S6 and WSP-003/S7?
        value: A sibling of each throwaway copy, named <copy>-tickets, instead of a shared ../tickets
      - new: Which tracker program answers the tickets command for WSP-003/S8 and WSP-002/S7?
        value: examples/ticket-adapters/json-file.mjs, as tests/cli/parallel.test.ts uses
    duration_s: 1533
  - at: 2026-10-29T22:38:26.076Z
    role: implementer
    result: done
    summary: worktree list and remove read worktrees from git, so a ticket folder outside the repository works
    verdict: null
    assumed: []
    duration_s: 923
  - at: 2026-10-29T22:46:58.484Z
    role: reviewer
    result: done
    summary: All scenarios hold; non-ticket worktrees protected; in-repo behavior and real-repo base output unchanged
    verdict: approve
    assumed: []
    duration_s: 511
---
Review 2026-10-29, WSP-003#Q1: ticket worktrees are found from git, so list and remove work with a ticket store outside the repository.
