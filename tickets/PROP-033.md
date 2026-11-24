---
id: PROP-033
type: proposal
title: Merge can run an afterMerge command, for repos that ship spec itself
status: done
stage: null
touches: [WSP-006, FMT-002, INS-001]
violates: []
depends_on: []
changed: [FMT-002/R7, FMT-002/S16, WSP-006/R6, WSP-006/S18, WSP-006/S19, WSP-006/S20, WSP-006/S21, WSP-006/S22, WSP-006/S23, format.Config, format.Config.afterMerge, workspace.AfterMergeFails, workspace.MergeResult, workspace.MergeResult.afterMergeError]
questions: []
history:
  - at: 2026-10-29T15:27:26.002Z
    role: spec-writer
    result: done
    summary: Added afterMerge config key and WSP-006 S18-S23/R6 for running it after merge; lint clean
    verdict: null
    assumed:
      - new: Does a failing afterMerge undo the merge?
        value: "No: the merge stays and the ticket line says afterMerge failed"
      - new: Where does afterMerge run and what commit is reported?
        value: Project root on the base branch; the reported commit is the HEAD after any 'after merge' commit
      - new: Does INS-001 change?
        value: "No: init does not write afterMerge"
  - at: 2026-10-29T15:32:04.619Z
    role: tester
    result: done
    summary: Tests for FMT-002/S16 and WSP-006/S18-S23 added; they fail on unknown afterMerge key; lint and typecheck clean
    verdict: null
    assumed: []
  - at: 2026-10-29T15:41:20.674Z
    role: implementer
    result: done
    summary: Added afterMerge config key and post-merge run, commit and failure reporting; all 841 tests, lint and typecheck pass
    verdict: null
    assumed: []
  - at: 2026-10-29T15:43:08.383Z
    role: reviewer
    result: done
    summary: Diff satisfies WSP-006/S18-S23/R6 and FMT-002/S16/R7; no checklist item broken
    verdict: approve
    assumed: []
---
Self-hosting finding I10. A new optional config key afterMerge (a shell command) runs on the base branch after each successful merge, for example rebuilding and copying the bundled CLI. When it changes files, merge commits them as "<ID>: after merge". A failing afterMerge leaves the merge in place and is reported, and the run exits 1. Without afterMerge, nothing changes.
