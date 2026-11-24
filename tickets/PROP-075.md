---
id: PROP-075
type: proposal
title: ticket combine maps a moved question's FROM#Qn cite to its new question in INTO
status: done
stage: null
touches: [TKT-012]
violates: []
depends_on: []
changed: [TKT-012/R8, TKT-012/S9]
questions: []
history:
  - at: 2026-10-31T16:22:42.060Z
    role: spec-writer
    result: done
    summary: "TKT-012: a moved question's FROM#Qn cite becomes INTO#Qm (R8, S9); the build refuses such a combine today"
    verdict: null
    assumed:
      - new: "A moved question cites a FROM question that did not move (answered, or not on FROM): keep the cite in INTO, or leave it out?"
        value: Leave it out of INTO's copy; FROM keeps its question and cite (TKT-012/R8)
    duration_s: 632
  - at: 2026-10-31T16:37:35.563Z
    role: tester
    result: done
    summary: TKT-012/S9 test added after S8; fails on combine with the questions[1] and [2] cites schema error, as R8 says
    verdict: null
    assumed: []
    duration_s: 891
  - at: 2026-10-31T16:53:34.871Z
    role: implementer
    result: done
    summary: "TKT-012/R8: a moved question's FROM#Qn cite becomes INTO#Qm; cites of unmoved FROM questions are dropped"
    verdict: null
    assumed: []
    duration_s: 956
  - at: 2026-10-31T16:55:21.253Z
    role: reviewer
    result: done
    summary: R8 and S9 are delivered; moved question refs map correctly and unmoved refs drop; 16 combine tests pass
    verdict: approve
    assumed: []
    duration_s: 100
---
Follow-up from PROP-069's review. TKT-012/R7 maps a moved question's cite of FROM's bare ID to INTO's ID. A cite of a FROM question (`FROM#Q2`) is left as is, and can still make INTO fail its schema after the move, as the bare ID did before PROP-069. When a question moves, a `FROM#Qn` cite becomes the `INTO#Qm` that question n was renumbered to. Test it through `spec ticket combine` and a reparse of INTO.
