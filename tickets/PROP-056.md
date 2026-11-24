---
id: PROP-056
type: proposal
title: The usage text lists --max for dispatch and orchestrate
status: done
stage: null
touches: [CLI-001]
violates: []
depends_on: []
changed: [CLI-001, CLI-001/S1]
questions: []
history:
  - at: 2026-10-30T21:35:52.982Z
    role: spec-writer
    result: done
    summary: CLI-001/S1 usage text now lists [--max <n>] on the dispatch and orchestrate lines
    verdict: null
    assumed:
      - new: Where does [--max <n>] sit on each usage line?
        value: after [--restart], as in the workspace module's own synopses; one space before the description where it overflows the column, like the orchestrate line
    duration_s: 56
  - at: 2026-10-30T22:06:24.518Z
    role: tester
    result: done
    summary: CLI-001/S1 expects [--max <n>] on dispatch and orchestrate; fails only on that missing text
    verdict: null
    assumed:
      - new: Should S2-S6 also check the new text? They reuse the S1 USAGE constant.
        value: "Yes, unchanged: the shared constant now holds the new text, so S2-S6 fail on the same missing --max."
    duration_s: 1831
  - at: 2026-10-30T22:36:07.672Z
    role: implementer
    result: done
    summary: Added [--max <n>] to the dispatch and orchestrate usage lines in src/cli/args.ts; npm run check passes
    verdict: null
    assumed: []
    duration_s: 1782
  - at: 2026-10-30T22:36:40.593Z
    role: reviewer
    result: done
    summary: CLI-001/S1 usage text and src/cli/args.ts now list [--max <n>] after [--restart] on dispatch and orchestrate, identical in spec, code and tests; orchestrate does take --max (src/cli/merge.ts:231). tests/cli/usage.test.ts passes, 11 of 11. S2-S6 share the constant and hold. No new behaviour; no findings.
    verdict: approve
    assumed: []
    duration_s: 32
---
The CLI accepts `--max <n>` (src/cli/args.ts), and `spec dispatch` with no ticket prints "usage: spec dispatch <TICKET>... [--restart] [--max <n>]" (WSP-005), but the usage text of CLI-001/S1 lists neither `--max` on the dispatch line nor on the orchestrate line. Add it to both lines, in the usage text and in CLI-001/S1. Check src/cli for whether orchestrate takes --max today before writing it in.
