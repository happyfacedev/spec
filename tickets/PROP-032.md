---
id: PROP-032
type: proposal
title: Run logs show each stage, not only the overseer's summary
status: done
stage: null
touches: [WSP-005]
violates: []
depends_on: []
changed: [WSP-005, WSP-005/R7, WSP-005/S1, WSP-005/S2, WSP-005/S3, WSP-005/S4, WSP-005/S5, WSP-005/S6, WSP-005/S7, WSP-005/S8, WSP-005/S9, WSP-005/S10, WSP-005/S12, WSP-005/S13, WSP-005/S14, WSP-005/S15, WSP-005/S16, WSP-005/S17, WSP-005/S22, WSP-005/S23, WSP-005/S24, workspace.StageEntry, workspace.StageEntry.ended, workspace.StageEntry.problems, workspace.StageEntry.report, workspace.StageEntry.role, workspace.StageEntry.started, workspace.StageEntry.transcript]
questions:
  - id: Q1
    kind: blocker
    text: "The implementer stage ended with an invalid report: tests fail (exit 1): WSP-005/S9 Each run is logged under the repository's git folder. Review the uncommitted changes, then answer to resume."
    default: null
    cites: []
    answer: "Not flaky: your change loses stderr in the run log. WSP-005/S9 fails 3 of 3 runs of tests/cli in this worktree and passes 3 of 3 on main (expected the log to contain to-err). Keep stdout and stderr both piped into the log until the run closes, then finish."
    raised_by: implementer
history:
  - at: 2026-10-29T11:55:03.033Z
    role: spec-writer
    result: done
    summary: WSP-005 gains S22-S24 and R7 so run logs get a per-stage entry; workspace.StageEntry added; lint clean
    verdict: null
    assumed:
      - new: Which command appends the stage entry to the log?
        value: The before-finish hook (install.Hook) does it, since it has the transcript path and the report check. INS-011 is not edited; the entry rules sit in WSP-005 only.
      - new: How many entries does a stage get, and when?
        value: One for each time the role finishes or is sent back. A refused report adds a problems entry. An accepted report adds a report entry.
      - new: What is the entry's start time?
        value: The time pipeline.StartStage marked the stage.
      - new: What happens with no run record?
        value: No log is written (S24, R7).
  - at: 2026-10-29T12:00:29.626Z
    role: tester
    result: done
    summary: Added tests for WSP-005 S1-S10, S12-S17 and S22-S24; S22, S23 fail now, lint and typecheck clean
    verdict: null
    assumed:
      - new: Which clock gives the entry's ended time?
        value: The CLI's now, since the hook runs through run()
      - new: Where does the entry's started time come from?
        value: The now of the ticket start command, which the implementer must store
  - at: 2026-10-29T12:04:29.799Z
    role: implementer
    result: blocked
    summary: invalid report
    verdict: null
    assumed: []
  - at: 2026-10-29T12:26:47.474Z
    role: implementer
    result: done
    summary: Stage entries are appended to the dispatched run's log; all 563 tests, typecheck and lint pass; S9 passes and did not reproduce
    verdict: null
    assumed: []
  - at: 2026-10-29T12:27:10.407Z
    role: reviewer
    result: done
    summary: Stage entries match S22-S24 and R7; dispatch scenarios untouched; log append is safe; approve
    verdict: approve
    assumed: []
---
Self-hosting finding I12. Each dispatched run's log records, per stage, the role, the start and end time, the subagent transcript path, and the stage's report or the problems check-report found. Today the log holds only the overseer's final message, so a failed stage has to be diagnosed from transcripts by hand.
