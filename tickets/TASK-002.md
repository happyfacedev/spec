---
id: TASK-002
type: task
title: The merge lock probe tests pass where /bin/sh is dash
status: done
stage: null
touches: [WSP-006]
violates: []
depends_on: []
changed: [WSP-006/S8, WSP-006/S30]
questions: []
history:
  - at: 2026-11-10T13:55:08.928Z
    role: implementer
    result: done
    summary: Use exec in lockProbe so its probe reports afterMerge's starting PID under dash
    verdict: null
    assumed: []
    duration_s: 2708
  - at: 2026-11-10T13:56:28.510Z
    role: reviewer
    result: done
    summary: exec in lockProbe makes the probe's parent the merge process under bash and dash; no assertion weakened, no source change
    verdict: approve
    assumed: []
    duration_s: 67
---
Review of 2026-11-10: CI on ubuntu has failed on all 129 runs. Four tests in tests/cli/merge-scenarios.test.ts (WSP-006/S8 twice, WSP-006/S30 twice, lines 804-845) assert that the afterMerge probe's $PPID is the merge process's pid. lockProbe (line 723) returns the command sh '<script>', and merge runs afterMerge as /bin/sh -c (src/cli/merge.ts:168). bash, which is /bin/sh on macOS, execs a lone command, so the script's parent is the merge process; dash, which is /bin/sh on ubuntu, forks first, so $PPID is the intermediate shell. CI shows: expected '42233 absent 42233', got '42233 absent 47669'. Make the probe report the process that started afterMerge under either shell (for example exec sh '<script>'). No behaviour, scenario or source file changes; only the test helper. It cannot be reproduced on macOS, so the reviewer checks the reasoning and CI confirms after the push. The other CI failure (INS-012/S27 needs zsh) is fixed in .github/workflows/ci.yml, outside this ticket.
