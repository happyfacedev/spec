---
id: PROP-070
type: proposal
title: Every commit the pipeline makes on a ticket branch carries Spec-Ticket, so verify-history accepts a merged ticket
status: done
stage: null
touches: [PIP-008, PIP-002, INS-016]
violates: []
depends_on: []
changed: [INS-016, INS-016/R12, INS-016/S9, PIP-002, PIP-002/R6, PIP-002/S23, PIP-008, PIP-008/R1, PIP-008/S1, PIP-008/S4, PIP-008/S5, WSP-004, WSP-004/R2, WSP-004/S6]
questions: []
history:
  - at: 2026-10-31T12:47:10.718Z
    role: spec-writer
    result: done
    summary: Stage, sync and ticket-store commits on a ticket branch carry exactly Spec-Ticket; INS-016/S9 merges a piped ticket clean
    verdict: null
    assumed:
      - new: The answer commit spec makes on a branch no tree has checked out is specified in WSP-004 (S6, R2), outside the ticket's touches; may this stage change it?
        value: "Yes: the ticket asks for every commit spec makes on a ticket branch, so WSP-004/S6 and R2 now require the trailer"
      - new: Why were only two of PROP-061's side commits flagged?
        value: They weren't. In this repo the current build lists all 33 trailerless governed side commits of the merge, PROP-061's and the PROP-051 commits it pulled in. The text output shown was truncated, so only the last two lines (6e151c6, 0201786) were visible. No check change is needed; INS-016/R12 states the uniform rule
    duration_s: 355
  - at: 2026-10-31T13:05:25.814Z
    role: tester
    result: done
    summary: Trailer tests for PIP-008 S1/S4/S5, PIP-002/S23, WSP-004/S6 and INS-016/S9 (hooked and bare); all fail on main for the missing trailer
    verdict: null
    assumed: []
    duration_s: 1094
  - at: 2026-10-31T13:31:12.585Z
    role: implementer
    result: done
    summary: Stage, sync and ticket-store branch commits now end in exactly one Spec-Ticket trailer, hooked or bare
    verdict: null
    assumed: []
    duration_s: 1546
  - at: 2026-10-31T13:36:31.033Z
    role: reviewer
    result: done
    summary: All ticket-branch commit paths preserve one trailer; hooked and hook-free pipelines pass history verification
    verdict: approve
    assumed: []
    duration_s: 317
---
Found landing PROP-061, the first ticket merged through `spec next` / `ticket advance` / `spec merge` with S3 enforcement on main (a C1 pair: S3 x the pipeline's own commits). After `spec merge PROP-061`, `spec verify-history` reports its stage commits as offenders: "invalid side commit: side commit must carry exactly Spec-Ticket: PROP-061 and cite the same ticket PROP-061" (6e151c6 implementer, 0201786 reviewer). `ticket advance` commits the stage with `plan.commitMessage` and no trailer (src/cli/report.ts, src/core/advance.ts), and neither do the stage-start sync merge ("<ID>: sync with <base>", src/cli/tickets.ts) nor the ticket store's own commits on the ticket branch (`ticket answer`, a blocked stage's record). S3's tests built side commits with the trailer by hand, so no test merged a real pipeline ticket and verified history. Every commit spec makes on a ticket branch must carry exactly `Spec-Ticket: <ID>`; a test runs a ticket through start, advance (done and blocked), answer and a sync, merges it with `spec merge`, and checks that `spec verify-history` is clean. Also look at why only two of PROP-061's eight trailer-less side commits were flagged: the check should treat every governed side commit the same.
