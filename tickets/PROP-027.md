---
id: PROP-027
type: proposal
title: orchestrate shows --depth and reports what it left unmerged
status: done
stage: null
touches: [WSP-008]
violates: []
depends_on: []
changed: [WSP-008, WSP-008/R2, WSP-008/R3, WSP-008/S1, WSP-008/S2, WSP-008/S3, WSP-008/S4, WSP-008/S5, WSP-008/S6, WSP-008/S7, WSP-008/S8, WSP-008/S9, WSP-008/S10, WSP-008/S11, WSP-008/S12, WSP-008/S13, WSP-008/S14, WSP-008/S15, WSP-008/S16, WSP-008/S17, WSP-008/S18, WSP-008/S19, WSP-008/S20, WSP-008/S21, WSP-008/S22, WSP-008/S23, workspace.Orchestrate, workspace.OrchestrateResult, workspace.OrchestrateResult.notMerged]
questions:
  - id: Q1
    kind: preference
    text: Under what heading should orchestrate list tickets it left unmerged when the wave limit ran out?
    default: "Not merged:"
    cites: []
    answer: null
    raised_by: null
  - id: Q2
    kind: blocker
    text: "PROP-027 asks for --depth in the orchestrate usage text, which is CLI-001 S1. The brief touches only WSP-008, so CLI-001 was not changed. Add CLI-001 to the ticket's touches, then its usage line can name --depth. Its changes are kept in git stash \"PROP-027 spec-writer: blocked\"; the next spec-writer stage gets them back."
    default: null
    cites:
      - CLI-001
      - WSP-008
    answer: Leave CLI-001 unchanged. Finish PROP-027 without the usage-line change; naming --depth in orchestrate's usage line moves to PROP-007, which already changes how --depth is handled and runs after PROP-006 on CLI-001.
    raised_by: spec-writer
history:
  - at: 2026-10-29T18:57:25.473Z
    role: spec-writer
    result: blocked
    summary: "WSP-008 now lists unmerged asks under Not merged: and exits 1; the usage text in CLI-001 is out of scope"
    verdict: null
    assumed:
      - question: PROP-027#Q1
        value: "Not merged:"
      - new: "Where the Not merged: section sits in the text output"
        value: "last, after Stopped mid-stage:"
      - new: "Which unmerged asks go under Not merged: and which under Waiting for a person:"
        value: the plan's later group goes under Not merged:, its blocked group stays under Waiting
      - new: Whether orchestrate's syntax lines name --depth
        value: yes, in workspace.Orchestrate and the workspace module
    duration_s: 302
  - at: 2026-10-29T18:58:32.945Z
    role: spec-writer
    result: done
    summary: "WSP-008: unmerged asks listed under Not merged: and exit 1; usage line's --depth moves to PROP-007"
    verdict: null
    assumed:
      - question: PROP-027#Q1
        value: "Not merged:"
      - new: "Where the Not merged: section sits in the text output"
        value: "last, after Stopped mid-stage:"
      - new: "Which unmerged asks go under Not merged: and which under Waiting for a person:"
        value: the plan's later group goes under Not merged:, its blocked group stays under Waiting
      - new: Whether orchestrate's syntax lines name --depth
        value: no, left as they were, since the usage line moves to PROP-007
    duration_s: 58
  - at: 2026-10-29T19:26:16.502Z
    role: tester
    result: done
    summary: Tests for WSP-008/S1-S23; S22 and S23 fail on current code as the new spec says; lint and typecheck clean
    verdict: null
    assumed:
      - question: PROP-027#Q1
        value: "Not merged:"
      - new: Which ticket IDs S23 uses for its open and dependent tasks
        value: "the IDs the store assigns: TASK-104 and TASK-105"
      - new: How many chained tickets S10 needs to show the default cap of 10
        value: "13: ten merge in the default run and the eleventh is left"
    duration_s: 1663
  - at: 2026-10-29T19:52:35.195Z
    role: implementer
    result: done
    summary: "orchestrate lists every unmerged asked ticket under Not merged: and exits 1; WSP-008/S22 and S23 pass"
    verdict: null
    assumed:
      - question: PROP-027#Q1
        value: "Not merged:"
      - new: "Reason under Not merged: for a ticket held back only by a later wave, when the plan gives none"
        value: waits for a ticket in an earlier wave
      - new: "Reason under Not merged: for an asked ticket the plan gives no reason, such as a done ticket not merged"
        value: nothing in the plan starts it
      - new: "Reason under Not merged: for a ticket held back once when the run ends"
        value: its start was refused while another ticket ran or was in flight; log <path>
      - new: Without ticket IDs, a ticket the plan holds for a person when the waves run out
        value: "listed under Waiting for a person:"
    duration_s: 1578
  - at: 2026-10-29T20:00:18.692Z
    role: reviewer
    result: done
    summary: WSP-008 S1-S23, R1-R7 and INV-002 hold; the once-held and wave-limit changes follow R3 and R6
    verdict: approve
    assumed:
      - new: Whether the --depth usage line that the PROP-027 title names is in scope now it moved to PROP-007
        value: "out of scope: deferred by a recorded answer, not a WSP-008 checklist item"
      - new: Whether a skipped ticket with no plan reason (worktree error, done but unmerged, held once) gets the plan's reason under R3
        value: "listed under Not merged: with the text dispatch or the depth limit gives"
    duration_s: 463
---
Review 2026-10-29. WSP-008#Q1: the usage text shows orchestrate's --depth. WSP-008#Q2: every asked ticket that was neither merged nor listed for a person is reported, and the run exits 1.
