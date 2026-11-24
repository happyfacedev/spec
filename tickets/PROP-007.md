---
id: PROP-007
type: proposal
title: --depth is checked only by impact and orchestrate
status: done
stage: null
touches: [CLI-001, CLI-003]
violates: []
depends_on: []
changed: [CLI-001, CLI-001/S1, CLI-001/S2, CLI-001/S3, CLI-001/S4, CLI-001/S5, CLI-001/S6, CLI-003, CLI-003/R2, CLI-003/R4, CLI-003/S1, CLI-003/S2, CLI-003/S3, CLI-003/S4, CLI-003/S5, CLI-003/S6, CLI-003/S7, CLI-003/S8, CLI-003/S9, CLI-003/S10, CLI-003/S11, CLI-003/S12, CLI-003/S13, CLI-003/S14, CLI-003/S15, CLI-003/S16, CLI-003/S17, CLI-003/S18, CLI-006, CLI-006/S1, PIP-015, PIP-015/S11, cli.InvalidDepth]
questions:
  - id: Q1
    kind: blocker
    text: 'CLI-006/S1 is in the re-verify ring and expects spec brief --depth x to print the depth error; the proposal makes brief ignore --depth, so it must change. Left unchanged for a person to decide. Its changes are kept in git stash "PROP-007 spec-writer: blocked"; the next spec-writer stage gets them back.'
    default: null
    cites:
      - CLI-006/S1
      - CLI-003/R4
    answer: "Change CLI-006/S1 to keep its point (a malformed command line still exits 0 with the problem on stdout) with an input brief still refuses: spec brief --format xml, whose stdout today is '--format is text or json, not xml', an empty line, then the usage text, with exit 0. --depth was only S1's example."
    raised_by: spec-writer
history:
  - at: 2026-10-29T19:42:54.683Z
    role: spec-writer
    result: blocked
    summary: "Blocked: --depth moves to impact and orchestrate; re-verify CLI-006/S1 still expects brief to report it"
    verdict: null
    assumed:
      - new: How the orchestrate line of the usage text names --depth
        value: "[--depth n] after [--restart], as the impact line does"
      - new: How PIP-015/S11 shows brief given a --depth it does not take
        value: the same stdout as without --depth, citing CLI-003/R4
    duration_s: 296
  - at: 2026-10-29T19:44:19.926Z
    role: spec-writer
    result: done
    summary: --depth checked only by impact and orchestrate; CLI-006/S1 now uses brief --format xml; lint 0 errors
    verdict: null
    assumed:
      - new: How the orchestrate line of the usage text names --depth
        value: "[--depth n] after [--restart], as the impact line does"
      - new: How PIP-015/S11 shows brief given a --depth it does not take
        value: the same stdout as without --depth, citing CLI-003/R4
      - new: Fix the orchestrate syntax in workspace/contracts.md and workspace/_module.md (pre-existing drift)
        value: "left unchanged: the brief does not name those files; --max is a real option and stays"
    duration_s: 71
  - at: 2026-10-29T20:32:22.312Z
    role: tester
    result: done
    summary: CLI-003 tests added; CLI-001/S1, CLI-006/S1, PIP-015/S11 updated; 8 fail on the current code
    verdict: null
    assumed:
      - new: Which path stands for /none in CLI-003/S15
        value: a path that does not exist, inside a temp folder
      - new: How CLI-003/S16 shows the tracker command never ran
        value: a tools/tickets.mjs that writes a marker file, which must not exist afterwards
    duration_s: 1353
  - at: 2026-10-29T21:01:32.805Z
    role: implementer
    result: done
    summary: --depth is checked only by impact and orchestrate; usage lists it; full suite, typecheck and lint pass
    verdict: null
    assumed:
      - new: Is a bare --depth with no value refused on a command that does not take it?
        value: "No: the depth is ignored there, as CLI-003/R4 says, and a following option is not taken as its value"
    duration_s: 1750
  - at: 2026-10-29T21:18:45.353Z
    role: reviewer
    result: done
    summary: "approve: every checklist item holds; candidates: stale WSP-008 Q1 answer, workspace orchestrate syntax lacks --depth"
    verdict: approve
    assumed:
      - new: Run orchestrate with a valid --depth against the real spec?
        value: "No: used a missing --tickets folder so nothing dispatches"
      - new: Run npx tsx and node spec.cjs, which the reviewer command list omits?
        value: "Yes: the caller asked for them, and they are read-only"
    duration_s: 1031
---
Review 2026-10-29, CLI-003#Q2: like every other unused option, --depth is ignored by commands that do not take it; impact and orchestrate still refuse a depth that is not a whole number of 1 or more.

Moved here from PROP-027 (its Q2): the usage text names --depth on the orchestrate line (CLI-001/S1), the way the impact line already does.
