---
id: PROP-034
type: proposal
title: An answer can reopen an earlier stage; a blocked stage keeps its work
status: done
stage: null
touches: [TKT-006, PIP-001, PIP-002]
violates: []
depends_on: []
changed: [PIP-001, PIP-001/R4, PIP-001/S1, PIP-001/S2, PIP-001/S3, PIP-001/S4, PIP-001/S5, PIP-001/S6, PIP-001/S7, PIP-001/S8, PIP-001/S9, PIP-001/S10, PIP-001/S11, PIP-001/S12, PIP-002, PIP-002/R4, PIP-002/S1, PIP-002/S2, PIP-002/S3, PIP-002/S4, PIP-002/S5, PIP-002/S6, PIP-002/S7, PIP-002/S8, PIP-002/S9, PIP-002/S10, PIP-002/S11, PIP-002/S12, PIP-002/S13, PIP-002/S14, PIP-002/S15, PIP-002/S16, PIP-002/S17, PIP-002/S18, PIP-002/S19, PIP-002/S20, PIP-004, PIP-004/S1, PIP-004/S2, PIP-004/S3, PIP-004/S4, PIP-004/S5, PIP-004/S6, PIP-004/S7, PIP-004/S8, PIP-004/S9, PIP-004/S10, PIP-004/S11, PIP-004/S12, PIP-004/S13, PIP-004/S14, PIP-004/S15, PIP-004/S16, PIP-004/S17, PIP-012, PIP-012/R7, PIP-012/S1, PIP-012/S2, PIP-012/S3, PIP-012/S4, PIP-012/S5, PIP-012/S6, PIP-012/S7, PIP-012/S8, PIP-012/S9, PIP-012/S10, PIP-012/S11, PIP-012/S12, PIP-012/S13, PIP-012/S14, PIP-012/S15, PIP-012/S16, PIP-012/S17, TKT-006, TKT-006/R4, TKT-006/S1, TKT-006/S2, TKT-006/S3, TKT-006/S4, TKT-006/S5, TKT-006/S6, TKT-006/S7, TKT-006/S8, TKT-006/S9, TKT-006/S10, TKT-006/S11, TKT-006/S12, TKT-006/S13, TKT-006/S14, TKT-006/S15, TKT-006/S16, TKT-006/S17, TKT-006/S18, TKT-006/S19, TKT-006/S20, pipeline.StageRecord, pipeline.StageRecord.result, tickets.AnswerResult, tickets.AnswerResult.next, tickets.BackRefused, tickets.TicketAnswer, tickets.TicketAnswer.answer, tickets.TicketAnswer.back]
questions:
  - id: Q1
    kind: blocker
    text: tests/cli/ticket-start-stash.test.ts builds BUG-301 as a bug with violates [], which the gate refuses, so PIP-002/S19 cannot pass; the test needs a violates entry
    default: null
    cites:
      - PIP-002/S19
      - PIP-002/R4
    answer: "Fixed by a person commit on the branch: the bug ticket now has violates [PRV-002/S3]. S19 now fails because history result 'reopened' is not parsed yet, which is your change. Resume."
    raised_by: implementer
history:
  - at: 2026-10-29T11:56:54.344Z
    role: spec-writer
    result: done
    summary: Spec adds answer --back (reopened history entry, brief group) and stash-on-block with restore at stage start
    verdict: null
    assumed:
      - new: Which roles can --back name
        value: a role with a done stage in the history; refused while a stage is running
      - new: Stash restore conflicts
        value: left unspecified
      - new: How a blocked report says the work is stashed
        value: role prompt rule only, not checked by check-report
  - at: 2026-10-29T12:33:55.230Z
    role: tester
    result: done
    summary: Tests for every scenario of the 5 features; new PROP-034 scenarios fail now, lint and typecheck clean
    verdict: null
    assumed:
      - new: S19 stash test ticket IDs
        value: BUG-301 and BUG-302, since a task has no tester stage
      - new: Quoting in the PIP-004/S8 message
        value: single quotes around the stash name, not doubled
      - new: Does TKT-006/S18 TASK-101 have a Q1
        value: yes, the test gives it one
      - new: PIP-002/S15 conflicting pair
        value: BUG-301 running in a worktree blocks PROP-201, as in the existing parallel test
  - at: 2026-10-29T12:38:38.297Z
    role: implementer
    result: blocked
    summary: PIP-002/S19 test fixture has a bug ticket with no violates, so the gate refuses it; all other tests passed
    verdict: null
    assumed: []
  - at: 2026-10-29T12:48:27.857Z
    role: implementer
    result: done
    summary: answer --back with reopened history, Reopened by brief group, stash on block and restore at stage start
    verdict: null
    assumed:
      - new: Stash restore conflicts
        value: stash stays, start continues without error
      - new: --back on a done ticket
        value: status set to open
  - at: 2026-10-29T12:49:04.583Z
    role: reviewer
    result: done
    summary: Diff satisfies TKT-006 S15-S20/R4, PIP-001 R4, PIP-002 R4, PIP-004/S8 and PIP-012 R7; no checklist item broken
    verdict: approve
    assumed: []
---
Self-hosting findings I16 and I17. spec ticket answer <TICKET> <Q> <text> --back <role> answers the question and makes <role> the next stage, for a role that ran earlier in the ticket's pipeline (for example tester, when the implementer found a wrong test). The pipeline then continues from there in order, and the reopened stage's brief includes the answered question. Without --back, answering resumes the blocked stage as today. A stage that blocks stashes its uncommitted changes (git stash, named "<ID> <role>: blocked") instead of reverting them, says so in its report, and the next run of the same stage on the ticket restores them first.
