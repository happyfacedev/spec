---
id: PROP-030
type: proposal
title: Dispatch caps how many tickets run at once
status: done
stage: null
touches: [WSP-005, WSP-008, FMT-002, INS-001]
violates: []
depends_on: []
changed: [FMT-002/R5, FMT-002/S14, WSP-005/R8, WSP-005/S16, WSP-005/S25, WSP-005/S26, WSP-005/S27, WSP-008/R7, WSP-008/S19, WSP-008/S20, WSP-008/S21, format.Config, format.Config.maxParallel, workspace.Dispatch, workspace.Dispatch.max, workspace.Orchestrate, workspace.Orchestrate.max]
questions:
  - id: Q1
    kind: preference
    text: What should maxParallel default to when it is not set?
    default: no cap, as today
    cites: []
    answer: null
    raised_by: null
history:
  - at: 2026-10-29T13:47:08.896Z
    role: spec-writer
    result: done
    summary: Added maxParallel config key and --max flag to dispatch and orchestrate; lint clean
    verdict: null
    assumed:
      - question: PROP-030#Q1
        value: no cap, as today
      - new: Reason text for tickets held by the cap
        value: waiting for a free slot (at most <n> run at once)
      - new: Leave CLI-001's help text and INS-001 unchanged (init writes no maxParallel; help already omits --depth)
        value: unchanged
  - at: 2026-10-29T14:19:14.072Z
    role: tester
    result: done
    summary: Tests for maxParallel and --max written; five dispatch/config tests fail on current code, orchestrate ones not run
    verdict: null
    assumed:
      - new: Third independent ticket in WSP-008/S19 is a new task touching CNV-003 with no dependencies
        value: assumed independent of TASK-101 and TASK-103 in the plan
  - at: 2026-10-29T14:26:34.506Z
    role: implementer
    result: done
    summary: Added maxParallel config and --max to dispatch and orchestrate; tests, typecheck and lint pass
    verdict: null
    assumed: []
  - at: 2026-10-29T14:26:58.827Z
    role: reviewer
    result: done
    summary: maxParallel and --max implemented as specified in dispatch and orchestrate; no checklist item broken
    verdict: approve
    assumed: []
---
Self-hosting finding I11. A new optional config key maxParallel (a whole number of 1 or more), and a --max <n> flag on dispatch and orchestrate that overrides it, cap how many tickets one wave starts. The tickets the plan could start beyond the cap wait for the next wave, in plan order, and are reported as waiting for a free slot. Without either, every startable ticket starts, as today.
