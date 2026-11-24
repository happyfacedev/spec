---
id: PROP-035
type: proposal
title: ticket new saves a title of 81 to 120 characters
status: done
stage: null
touches: [TKT-005]
violates: []
depends_on: []
changed: [TKT-005/R7, TKT-005/S1, TKT-005/S2, TKT-005/S3, TKT-005/S4, TKT-005/S5, TKT-005/S6, TKT-005/S7, TKT-005/S8, TKT-005/S9, TKT-005/S10, TKT-005/S11, TKT-005/S12, TKT-005/S13, TKT-005/S14, TKT-005/S15, TKT-005/S16, TKT-005/S17, TKT-005/S18, TKT-005/S19, TKT-005/S20]
questions: []
history:
  - at: 2026-10-29T11:54:48.979Z
    role: spec-writer
    result: done
    summary: "Added TKT-005/S20 and R7: titles of 81-120 characters are saved on one line and the ticket is created."
    verdict: null
    assumed: []
  - at: 2026-10-29T11:58:38.046Z
    role: tester
    result: done
    summary: Tests for TKT-005/S1-S20 in ticket-new.test.ts; only new S20 fails (long title); lint and typecheck pass.
    verdict: null
    assumed: []
  - at: 2026-10-29T12:01:08.822Z
    role: implementer
    result: done
    summary: Title written with lineWidth 0 so 81-120 character titles stay on one line; all tests, lint and typecheck pass.
    verdict: null
    assumed: []
  - at: 2026-10-29T12:01:22.317Z
    role: reviewer
    result: done
    summary: Title written with lineWidth 0 keeps 81-120 char titles on one line; tests cover S1-S20; no checklist item broken.
    verdict: approve
    assumed: []
---
Bug found while filing the self-hosting tickets (I18). tickets.NewTicket.title allows 1 to 120 characters, and TKT-005/R6 refuses only titles over 120. But spec ticket new folds any title over 80 characters onto a second line (the YAML writer's default line width), which is invalid YAML, so it refuses the ticket with "invalid YAML: Implicit keys need to be on a single line". A title of 81 to 120 characters must be saved on one line and the ticket created. No scenario covers it yet, so this is a proposal, not a bug.
