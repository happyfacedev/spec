---
id: PROP-029
type: proposal
title: compile-roles writes the allowed commands into each agent
status: done
stage: null
touches: [INS-006]
violates: []
depends_on: []
changed: [INS-006/R3, INS-006/S1, INS-006/S2, INS-006/S3, INS-006/S4, INS-006/S5, INS-006/S6, INS-006/S7, INS-006/S8, INS-006/S9, INS-006/S10, INS-006/S11, INS-006/S12, INS-006/S13, INS-006/S14, INS-006/S15, INS-006/S16, INS-006/S17, INS-006/S18]
questions: []
history:
  - at: 2026-10-29T11:54:46.341Z
    role: spec-writer
    result: done
    summary: INS-006 gains S16-S18 and R3, so stage agents list the dispatchCommand Bash entries and a config change makes L021 stale
    verdict: null
    assumed: []
  - at: 2026-10-29T11:58:13.766Z
    role: tester
    result: done
    summary: Tests for INS-006 S1-S18; S16 and S18 fail now as expected, S1-S15 and S17 pass
    verdict: null
    assumed: []
  - at: 2026-10-29T12:01:36.837Z
    role: implementer
    result: done
    summary: compile-roles lists dispatchCommand Bash entries in stage agents; config change makes L021 stale
    verdict: null
    assumed: []
  - at: 2026-10-29T12:02:06.561Z
    role: reviewer
    result: done
    summary: Code meets R3 and S16-S18; repo's own .claude/agents not regenerated, so lint --ci reports L021 there
    verdict: changes
    assumed: []
  - at: 2026-10-29T12:04:03.445Z
    role: implementer
    result: done
    summary: R3 and S16-S18 hold; agents up to date, lint --ci clean, 562 tests pass, typecheck and lint clean
    verdict: null
    assumed: []
  - at: 2026-10-29T12:04:25.171Z
    role: reviewer
    result: done
    summary: R3 and S16-S18 hold, S1-S15 unchanged; lint --ci clean in the repo; no checklist item broken
    verdict: approve
    assumed: []
---
Self-hosting finding I13. compile-roles reads the Bash(...) entries of config dispatchCommand and writes them into every stage agent's instructions as the commands it may run, with spec written as its full bundled path, and a line that a refused command is refused on its own. Then a model never guesses a command form that is not allowed, and never concludes Bash is off. lint --ci (L021) treats the agents as stale when dispatchCommand changes.
