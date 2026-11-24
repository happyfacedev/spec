---
id: PROP-069
type: proposal
title: ticket combine rewrites a moved question's cite of its own ticket to the ticket it moves into
status: done
stage: null
touches: [TKT-012]
violates: []
depends_on: [PROP-061]
changed: [TKT-012/R7, TKT-012/S8]
questions: []
history:
  - at: 2026-10-31T15:34:21.870Z
    role: spec-writer
    result: done
    summary: "TKT-012 R7 and S8: a moved question's cite of its FROM's own ID becomes INTO's ID; lint 0 errors"
    verdict: null
    assumed:
      - new: Does a moved question's text change when its cite changes?
        value: "No: only the cite changes; text, kind, default and answer stay"
    duration_s: 212
  - at: 2026-10-31T15:41:43.445Z
    role: tester
    result: done
    summary: TKT-012/S8 test added after S7; fails on combine with the questions[0].cites schema error, as the ticket says
    verdict: null
    assumed: []
    duration_s: 437
  - at: 2026-10-31T16:00:18.073Z
    role: implementer
    result: done
    summary: "TKT-012/R7: a moved question's cite of FROM's ID becomes INTO's ID; build, check, typecheck, lint pass"
    verdict: null
    assumed:
      - new: Does a cite of FROM's ID in a moved question with a '#Q<n>' suffix (a ticket question ref) also become INTO's ID?
        value: "No: R7 names the bare FROM ID only, so only exact matches are rewritten"
      - new: If a moved question cites both FROM and INTO, is the rewritten cite list de-duplicated?
        value: "No: the cite list is only mapped in place, so INTO may appear twice"
    duration_s: 1111
  - at: 2026-10-31T16:02:12.133Z
    role: reviewer
    result: done
    summary: R7 and S8 are delivered; positional cite mapping matches the spec; all 15 combine tests pass
    verdict: approve
    assumed: []
    duration_s: 112
---
Follow-up from PROP-061's review (a C1 pair: PROP-061 lets a ticket's question cite only its own ticket, TKT-001/R6; PROP-038 moves open questions from FROM into INTO, TKT-012/R2). A never-started ticket whose open question cites its own ID (hand-written) cannot be combined: src/core/ticket-combine.ts copies the question into INTO with the cite unchanged, and the schema then rejects it as a foreign-ticket citation. When a question moves, a cite of its FROM's ID becomes INTO's ID; test it through `spec ticket combine` and a reparse of INTO.
