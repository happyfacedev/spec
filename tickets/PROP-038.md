---
id: PROP-038
type: proposal
title: spec ticket combine folds tickets into one; an absorbed ticket keeps its file and ID
status: done
stage: null
touches: [TKT-001, TKT-005, TKT-011]
violates: []
depends_on: []
changed: [CLI-001/S1, PIP-002, PIP-008, TKT-001/R12, TKT-001/S27, TKT-001/S28, TKT-002/R1, TKT-002/R2, TKT-002/S2, TKT-002/S13, TKT-005/R1, TKT-005/S27, TKT-006, TKT-007/R4, TKT-007/S9, TKT-007/S10, TKT-010/R6, TKT-010/S12, TKT-011/R1, TKT-011/S24, TKT-012, TKT-012/R1, TKT-012/R2, TKT-012/R3, TKT-012/R4, TKT-012/R5, TKT-012/R6, TKT-012/S1, TKT-012/S2, TKT-012/S3, TKT-012/S4, TKT-012/S5, TKT-012/S6, TKT-012/S7, WSP-004, WSP-005, tickets.AbsorbedTicket, tickets.AbsorbedTicket.added, tickets.AbsorbedTicket.id, tickets.AbsorbedTicket.questions, tickets.BlockerKind, tickets.CombineRefused, tickets.CombineResult, tickets.CombineResult.absorbed, tickets.CombineResult.gate, tickets.CombineResult.ticket, tickets.CommitRefused, tickets.MovedQuestion, tickets.MovedQuestion.from, tickets.MovedQuestion.to, tickets.NotOnBaseBranch, tickets.Ticket, tickets.Ticket.absorbed_into, tickets.TicketCombine, tickets.TicketCombine.from, tickets.TicketCombine.into, tickets.TicketStatus]
questions:
  - id: Q1
    kind: preference
    text: May a ticket be combined after a stage of it or of the ticket it goes into is recorded?
    default: "no: combine is refused once any of the tickets has a history entry"
    cites: []
    answer: null
    raised_by: null
  - id: Q2
    kind: blocker
    text: "TKT-012/S3 test makes main checked out nowhere (git checkout -b elsewhere in the only tree) and expects stderr to start 'file tickets from main: run spec ticket combine in ', but tickets.NotOnBaseBranch says 'check out main first' when no tree has the base branch; the scenario and the contract disagree"
    default: null
    cites: [TKT-012/S3, TKT-012/R5, tickets.NotOnBaseBranch]
    answer: "The scenario is wrong: S3 will say the other branch case has main checked out in another tree, which is what that message is for."
    raised_by: implementer
  - id: Q3
    kind: blocker
    text: 'TKT-011/S24 test expects PROP-201 in tickets.PlanResult.now for the whole `spec plan` on chat-mini, but PROP-201 reaches PRV-001, PRV-002 and CNV-002 through providers.ProviderId and waits in wave 2 for BUG-301 and TASK-101..103 whether or not PROP-202 is absorbed; only `spec plan PROP-202 PROP-201` puts it in now. Its changes are kept in git stash "PROP-038 implementer: blocked"; the next implementer stage gets them back.'
    default: null
    cites: [TKT-011/S24, TKT-011/R1, TKT-011/S1]
    answer: "The scenario is wrong: S24 will expect PROP-201 in now only for spec plan PROP-202 PROP-201, and for the whole plan only that no entry waits after PROP-202."
    raised_by: implementer
  - id: Q4
    kind: blocker
    text: "The review found combine half-saves a FROM whose live copy is in its own worktree, and leaves an absorbed_into chain when an earlier INTO becomes a FROM. R1 should refuse both: a ticket a worktree holds, and a FROM other tickets are absorbed into. Spec first, then tests; the dependency filter and one-line ID lists follow R2 and TKT-002/R2 as written."
    default: null
    cites: [TKT-012/R1, TKT-012/R5, TKT-001/R12]
    answer: "Yes: refuse both in R1; the overseer writes the spec change."
    raised_by: implementer
history:
  - at: 2026-10-31T02:32:06.827Z
    role: spec-writer
    result: done
    summary: spec ticket combine (TKT-012), absorbed status and absorbed_into; gate, plan, queue and lint handle absorbed tickets
    verdict: null
    documents: [TKT-005/S27]
    assumed:
      - question: PROP-038#Q1
        value: "no: combine is refused once any of the tickets has a history entry"
      - new: Must INTO itself be open with no history?
        value: yes, the same checks apply to INTO and every FROM
      - new: Does INTO also take over a FROM's violates and depends_on?
        value: yes, IDs it does not list yet, never INTO or a FROM in depends_on
      - new: What does the gate say for an absorbed ticket?
        value: one blocker of the new kind absorbed naming INTO, so brief and ticket start refuse it
      - new: What about a ticket that depends on an absorbed ticket?
        value: the gate refuses it with an unresolved blocker naming INTO; combine does not rewrite other tickets
      - new: What does spec plan do with an absorbed ticket it is asked for?
        value: leaves it out silently, as it does a done ticket
      - new: Does a FROM lose the questions that moved?
        value: no, only status and absorbed_into change; its file stays as the record
    duration_s: 385
  - at: 2026-10-31T02:50:29.536Z
    role: tester
    result: done
    summary: Tests for combine, absorbed status, gate, queue, plan, lint, usage; new ones fail now except documented TKT-005/S27
    verdict: null
    assumed:
      - new: TKT-007/S10 says one ticket refused for every kind, but absorbed excludes all other blockers
        value: the other seven kinds are checked on one ticket and the absorbed line on a separate absorbed ticket
      - new: TKT-012/R2 does not fix the blank lines around the From line in the body
        value: tests compare the non-blank body lines in order
      - new: TKT-012/S4 does not fix the order of two problems on stderr
        value: tests compare the two lines sorted
    duration_s: 1102
  - at: 2026-10-31T02:58:15.278Z
    role: implementer
    result: blocked
    summary: Combine, absorbed status, gate, queue, plan, lint and usage done; 2 tests contradict their scenarios (TKT-012/S3, TKT-011/S24)
    verdict: null
    assumed: []
    duration_s: 465
  - at: 2026-10-31T02:58:20.555Z
    role: spec-writer
    result: reopened
    summary: reopened by PROP-038#Q3
    verdict: null
    assumed: []
  - at: 2026-10-31T02:58:41.188Z
    role: spec-writer
    result: done
    summary: "TKT-012/S3: the other-branch case has main in another worktree; TKT-011/S24: PROP-201 in now only when asked for"
    verdict: null
    assumed: []
    duration_s: 20
  - at: 2026-10-31T03:02:51.102Z
    role: tester
    result: done
    summary: Fixed TKT-012/S3 (main in another worktree) and TKT-011/S24 (PROP-201 in now only when asked); new tests still fail now
    verdict: null
    assumed: []
    duration_s: 249
  - at: 2026-10-31T03:13:12.414Z
    role: implementer
    result: done
    summary: spec ticket combine and the absorbed status; gate, queue, plan, lint and usage handle them; npm run check passes
    verdict: null
    assumed: []
    duration_s: 620
  - at: 2026-10-31T03:20:05.268Z
    role: reviewer
    result: done
    summary: Request changes for live-copy persistence, internal dependencies, chained absorption, and ID-list formatting
    verdict: changes
    findings:
      - cites: [TKT-012/R5, tickets.CommitRefused]
        text: "[P1] src/cli/tickets.ts:278-296 snapshots, commits and restores only local tickets. With PROP-202 in a worktree on ticket/PROP-202, combining it into local PROP-201 and refusing the commit restores PROP-201 but leaves the live PROP-202 absorbed, although its work and questions were rolled out of PROP-201. The command says nothing was saved. On success, only PROP-201 is committed; PROP-202 remains open on main and its absorption stays uncommitted in the other worktree. Include all live copies in the persistence and rollback transaction, with regression tests for both success and commit refusal."
      - cites: [TKT-012/R2]
        text: "[P2] src/core/ticket-combine.ts:53 copies INTO's depends_on unchanged and line 62 filters internal IDs only while adding FROM dependencies. If PROP-201 already depends on PROP-202, combine PROP-201 PROP-202 succeeds but leaves that dependency on the now-absorbed ticket. Its gate then tells PROP-201 to depend on itself. Filter INTO and every FROM out of the existing dependency list as well."
      - cites: [TKT-001/R12, tickets.Ticket.absorbed_into]
        text: "[P2] src/core/ticket-combine.ts:30-45 and 79-80 allow an earlier combine destination to become a FROM without maintaining its existing absorbed references. Running combine PROP-201 PROP-202, then combine PROP-205 PROP-201, returns 0 both times but leaves PROP-202 pointing at the now-absorbed PROP-201. Lint immediately reports L020 for the invalid chain. Preserve the rule that every absorbed_into names a surviving, non-absorbed ticket when combining an earlier destination."
      - cites: [TKT-002/R2]
        text: "[P3] src/core/ticket-edit.ts:135-138 preserves a block-style ID sequence's flow=false when merging it in place. Combining a ticket with block-style touches leaves that list as a block; rewriting block-style changed with another ID likewise emits multiple lines, regressing the previous one-line rendering. Mark updated ID sequences as flow style while retaining their comments."
    assumed: []
    duration_s: 412
  - at: 2026-10-31T03:20:06.520Z
    role: implementer
    result: blocked
    summary: "Two review findings need spec first: tickets held by a worktree, and a FROM that has absorbed tickets"
    verdict: null
    assumed: []
    duration_s: 0
  - at: 2026-10-31T03:20:10.307Z
    role: spec-writer
    result: reopened
    summary: reopened by PROP-038#Q4
    verdict: null
    assumed: []
  - at: 2026-10-31T03:20:31.506Z
    role: spec-writer
    result: done
    summary: TKT-012 R1/S4 refuse tickets a worktree holds and a FROM others are absorbed into; R2 drops INTO's depends_on on a FROM
    verdict: null
    assumed:
      - new: Combine a ticket whose live copy is in its own worktree, or re-point tickets absorbed into a FROM?
        value: "Refuse both: remove the worktree first, or combine into the earlier INTO; simpler and nothing is half-saved"
    duration_s: 20
  - at: 2026-10-31T03:25:01.664Z
    role: tester
    result: done
    summary: Four regressions for combine review defects (worktree, absorbed FROM, own dependency, block-style touches); all fail now
    verdict: null
    assumed:
      - new: Where do comments of a block-style list go when it is rewritten on one line
        value: test only requires they stay in the frontmatter
    duration_s: 269
  - at: 2026-10-31T03:36:40.484Z
    role: implementer
    result: done
    summary: Combine refuses worktree and absorbed-into FROMs, drops INTO's dependency on a FROM, writes ID lists on one line with comments
    verdict: null
    assumed:
      - new: TKT-012/R1 says every problem is printed, but S4 row 'combine PROP-206 PROP-201' expects only the blocked line although PROP-201 has absorbed PROP-208
        value: the 'has absorbed' line is left out when INTO itself is refused, since nothing would be absorbed
    duration_s: 698
  - at: 2026-10-31T03:40:51.608Z
    role: reviewer
    result: done
    summary: All four fixes verified; approve with a diagnostic-precedence documentation follow-up
    verdict: approve
    findings:
      - cites: [TKT-012/R1, TKT-012/S4]
        text: "Follow-up: Align R1's \"every problem\" wording with S4's combine PROP-206 PROP-201 row. src/core/ticket-combine.ts:53 follows S4 by printing INTO's refusal while suppressing FROM's \"has absorbed\" diagnostic. The refusal keeps every ticket unchanged, so this is a documentation clarification rather than a safety defect. State that diagnostic precedence in R1 so the rule and example agree."
    assumed: []
    duration_s: 250
---
Self-hosting finding P16: combining two related tickets today means deleting one ticket file, so spec forgets the absorbed ID and why.

- New command `spec ticket combine <INTO> <FROM>...`: INTO takes over each FROM's body (under a line naming it), its touches and its open questions (renumbered after INTO's). Each FROM gets the new final status `absorbed` with `absorbed_into: <INTO>`, and its file stays. The command commits, like ticket new.
- Refused with a message when a ticket is unknown, is INTO itself, is not open, has a recorded stage, or when the types differ.
- An absorbed ticket is never planned, queued, gated or dispatched, counts as taken for the next free ID, and lint accepts it; `absorbed_into` must name an existing ticket that is not itself absorbed.
- Text and JSON output name what moved.
