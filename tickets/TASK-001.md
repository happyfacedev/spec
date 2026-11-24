---
id: TASK-001
type: task
title: Tests remove the temp folders and stop the processes they create
status: done
stage: null
touches: [PIP-009]
violates: []
depends_on: []
changed: []
questions: []
history:
  - at: 2026-11-01T21:56:17.741Z
    role: implementer
    result: done
    summary: Tests remove their temp folders and stop their child processes via tests/tmp.ts; SPEC_KEEP_TMP=1 keeps folders
    verdict: null
    assumed: []
    duration_s: 3700
  - at: 2026-11-01T22:03:52.182Z
    role: reviewer
    result: done
    summary: "Changes: scenario-filtered test runs still leak module-scope fixture folders"
    verdict: changes
    findings:
      - cites: [TASK-001, PIP-009/S1]
        text: tests/setup.ts:5 relies solely on afterAll, which Vitest skips for files whose tests are all filtered out. With a fresh private TMPDIR and SPEC_KEEP_TMP=0, spec test PIP-009/S4 exits 0 but leaves 43 fixture folders (including spec-failed-files-*, spec-merge-* and spec-lock-*). Module-scope tempDir/gitFixture calls run during collection, while finishFile never runs for those skipped files. Complete TASK-001 cleanup for this routine scenario-filtered path and add a regression check; use an always-run cleanup lifecycle or defer those fixtures until running hooks/tests.
        class: C6
    assumed: []
    duration_s: 450
  - at: 2026-11-01T22:11:08.943Z
    role: implementer
    result: done
    summary: "Filtered runs now leave no temp folders: a manifest plus global teardown backs up the per-file hook; regression test added"
    verdict: null
    assumed: []
    duration_s: 435
  - at: 2026-11-01T22:16:47.582Z
    role: reviewer
    result: done
    summary: "Approve: filtered-run fixture cleanup is fixed; probe and both regression tests pass"
    verdict: approve
    assumed: []
    duration_s: 337
---
Self-hosting finding P78, decided by the person on 2026-11-01. The test helpers (tests/helpers.ts:80 and the many mkdtempSync calls across tests/) create temp git repositories and never remove them: 34,538 spec-* folders had piled up in the temp folder, and Spotlight indexing them helped push test runs past their timeouts. Two `spec-orchestrate-replan-run-*/run.sh` scripts from a test had been running for three days. Make every test remove the temp folders it creates (afterEach/onTestFinished, or a shared helper that registers cleanup), and stop child processes it starts when the test ends, including on failure. No behaviour of spec changes: this is test code only, and every existing test must keep passing. Keep a way to keep a failing test's folder for debugging (e.g. an env var), if cheap.
