---
id: PROP-052
type: proposal
title: Ticket rewrites keep comments and untouched records as they were, and write new lists on one line
status: done
stage: null
touches: [TKT-002]
violates: []
depends_on: [PROP-051]
changed: [TKT-002/R2, TKT-002/R3, TKT-002/R4, TKT-002/S7, TKT-002/S10, TKT-002/S11, TKT-002/S12]
questions: []
history:
  - at: 2026-10-30T23:40:55.012Z
    role: spec-writer
    result: done
    summary: TKT-002 R2/R3 widened, new R4 (comments kept, untouched records keep keys); S7 extended, S10-S12 added
    verdict: null
    documents:
      - TKT-002/S12
    assumed: []
    duration_s: 183
  - at: 2026-10-30T23:49:38.460Z
    role: tester
    result: done
    summary: S7 extended, S10/S11 fail on today's code as intended, S12 passes now; lint and typecheck clean
    verdict: null
    assumed: []
    duration_s: 523
  - at: 2026-10-31T00:03:26.795Z
    role: implementer
    result: done
    summary: Rewrites write new cites on one line, add no keys to untouched records and keep every comment; check passes
    verdict: null
    assumed: []
    duration_s: 827
  - at: 2026-10-31T00:08:52.303Z
    role: reviewer
    result: done
    summary: "Approved; separate bug candidate: null/omitted lists bypass inline cites and comment preservation."
    verdict: approve
    assumed: []
    duration_s: 324
---
Found by PROP-051's spec-writer, both outside that ticket. 1) A question added from a blocker writes its `cites` as a block (`cites:` then `- PRV-001`), though TKT-002/R2 writes such lists on one line. 2) `spec ticket advance` adds `verdict: null` to existing history records that did not have it, so a rewrite changes records it did not touch. A rewrite writes new lists on one line as R2 says, and leaves the keys of untouched records exactly as they were.

Absorbed from PROP-054 (same code, src/core/ticket-edit.ts, and the same TKT-002 rewrite rules). 3) `spec ticket answer` loses comments in the ticket file when it rewrites the answered question, though TKT-002 says rewrites keep the file's comments and spacing; a comment anywhere in the frontmatter, including inside or after the answered question's record, survives an answer where it was. 4) Owed by PROP-051, merged without them under the proportionate review bar: tests that a single- or double-quoted `questions`/`history` key with a commented flow list keeps its flow style and comments on `ticket answer` and on a stage append (the code already handles them, so list that scenario under `documents:`).
