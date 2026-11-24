---
id: TASK-003
type: task
title: CLI tests build their fixture repositories from shared templates, so the suite runs much faster
status: done
stage: null
touches: [PIP-009]
violates: []
depends_on: []
changed: []
questions: []
history:
  - at: 2026-11-10T12:40:28.764Z
    role: implementer
    result: done
    summary: Fixture templates and split test files; suite 865s→596s (31% faster, under 600s).
    verdict: null
    assumed: []
    duration_s: 12064
  - at: 2026-11-10T12:59:26.684Z
    role: reviewer
    result: done
    summary: Test move keeps all 2046 tests once, none weakened; suite passes in 572 s; two follow-ups
    verdict: approve
    findings:
      - cites: [TASK-003]
        text: "Follow-up: nothing checks that the partitioning stays complete. tests/cli/partitioned-it.ts splits a suite by a name hash and by describe order, and a part-N.test.ts file runs each part. If someone raises a suite's part count without adding the matching part file, or adds a describe that shifts the nested ordinal in some parts only, the tests of the missing or shifted part are skipped without any error. Add one test that lists the tests per part and compares them with the full set, or one that checks the part files against the counts."
        class: C7
      - cites: [TASK-003]
        text: "Follow-up: the ticket's aim of at least half the wall-clock is not reached. The full suite took 572 s here (2046 tests, 166 files, all passed) against 865 s on main, which is 34% faster; half would be 432 s or less. The seven named files are split and the fixtures are cloned, but only one test (INS-016/S3/S5) was moved to the in-process CLI. A later task could convert more spawnSync calls in enforcement-suite.ts and next-suite.ts."
        class: other
    assumed: []
    duration_s: 1128
---
Review of 2026-11-10. The full suite (2,046 tests, 147 files) took 14 min 25 s alone on this 10-core Mac; docs/SELF-HOSTING.md P33 measured 3 min 15 s at about 1,270 tests. System time equals user time (874 s against 929 s), so the cost is spawning processes: nearly every test in tests/cli makes a temp git repository with git init, commits and the CLI. tests/cli is 4,776 s of the 4,840 s of summed file time; tests/core runs 576 tests in 18 s. Seven files are half of the time: tests/cli/enforcement.test.ts (856 s, 183 tests), next.test.ts (527 s), merge-scenarios.test.ts (349 s), generated-files.test.ts (267 s), ticket-lanes.test.ts (219 s), advance-scenarios.test.ts (160 s), advance-check-could-not-run.test.ts (146 s). Every tester and implementer stage and every merge pays for this run. What I want: the test helpers build each distinct fixture project once (per file, or once per run under the temp folder) and give each test its own copy (a file copy or a local clone), instead of rebuilding it with git and the CLI every time; and a test calls the CLI in-process where that checks the same thing as spawning it. Start with the seven files above and the shared helpers. Constraints: no source file changes; every test keeps its name; no assertion is removed or weakened; tests stay independent (no test sees another's writes); TASK-001's cleanup still holds (a full run leaves no temp folders or child processes; SPEC_KEEP_TMP=1 still keeps them). Report the full suite's wall-clock before and after on this machine; the aim is at least half.
