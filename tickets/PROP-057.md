---
id: PROP-057
type: proposal
title: A failing test run with no failed assertion names the files and suite errors
status: done
stage: null
touches: [PIP-006]
violates: []
depends_on: []
changed: [PIP-006, PIP-006/R12, PIP-006/S8, PIP-006/S35, PIP-006/S36]
questions: []
history:
  - at: 2026-10-30T21:38:35.502Z
    role: spec-writer
    result: done
    summary: PIP-006 names failed test files and suite errors in a failing run, else keeps the last 5 output lines (R12)
    verdict: null
    assumed:
      - new: How many output lines to keep, and how joined
        value: last 5 non-blank lines, stderr then stdout, trimmed, joined by ' | ' (as the no-report tail joins today)
      - new: Which failed files are named
        value: only a file or suite the report marks failed with a non-empty message of its own; named by path relative to the project root, after failed tests, first 5 names in all
      - new: Does the tester's check change too
        value: no; only the implementer's 'tests fail' problem, the one that said 'see the test output'
      - new: Do pipeline.TestRun or spec test output gain fields
        value: no contract change; how the run carries file errors and the output tail is left to the implementer
    duration_s: 215
  - at: 2026-10-30T21:57:40.563Z
    role: tester
    result: done
    summary: tests/cli/failed-files.test.ts covers S8, S35, S36; S35 and S36 fail on today's code
    verdict: null
    assumed: []
    duration_s: 1144
  - at: 2026-10-30T22:35:53.049Z
    role: implementer
    result: done
    summary: Implementer's failing-run problem names failed files and suites, else keeps the last 5 output lines
    verdict: null
    assumed: []
    duration_s: 2292
  - at: 2026-10-30T22:45:53.162Z
    role: reviewer
    result: done
    summary: Implementer diagnostics match S8/S35/S36, but spec test JSON gains unspecified fields
    verdict: changes
    findings:
      - cites:
          - PIP-006/R12
          - pipeline.TestRun
          - PIP-009/S5
        text: src/io/test-command.ts:33 returns failedFiles and outputTail to every caller, and src/cli/report.ts:114 serializes the whole run for spec test --format json. A load-failure report now exposes both new fields; an ordinary nonzero run with output also exposes outputTail. R12 specifies implementer refusal messages only, and neither pipeline.TestRun nor any scenario specifies these CLI JSON additions. Keep the diagnostics internal to stage checking, or specify the new JSON members and their output scenarios before merging.
        spec: true
    assumed: []
    duration_s: 599
  - at: 2026-10-30T23:22:55.086Z
    role: spec-writer
    result: done
    summary: "R12: the failed-file and output-tail diagnostics stay in the problem text; spec test output is as before"
    verdict: null
    assumed:
      - new: Specify the new JSON members of spec test, or keep the diagnostics internal?
        value: "Keep them internal: spec test prints what it printed before, in text and in JSON"
    duration_s: 150
  - at: 2026-10-30T23:32:41.733Z
    role: tester
    result: done
    summary: tests/cli/failed-files.test.ts adds a PIP-006/S35 test that spec test --format json has no failedFiles or outputTail; it fails on today's code
    verdict: null
    assumed: []
    duration_s: 581
  - at: 2026-10-30T23:45:49.421Z
    role: implementer
    result: done
    summary: spec test JSON drops failedFiles and outputTail; the implementer's problem text still uses them
    verdict: null
    assumed: []
    duration_s: 787
  - at: 2026-10-30T23:49:53.957Z
    role: reviewer
    result: done
    summary: Prior finding fixed; spec test preserves its text and JSON output
    verdict: approve
    assumed: []
    duration_s: 243
---
Self-hosting finding P23. When a test file fails to load or a hook throws, the stage check says only "tests fail (exit 1): see the test output", and src/core/test-report.ts finds no failed test to name. Name the failed files and suite errors from the test report, and when the report names nothing, keep the last lines of the test output in the question, so the role knows what broke without rerunning.
