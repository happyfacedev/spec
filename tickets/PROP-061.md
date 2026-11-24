---
id: PROP-061
type: proposal
title: The spec-writer works through the case checklist and reports each item
status: done
stage: null
touches: [PIP-007, PIP-012, PIP-003]
violates: []
depends_on: []
changed: [ADP-002, ADP-002/S19, INV-006, PIP-003, PIP-003/R5, PIP-003/R6, PIP-003/S15, PIP-003/S16, PIP-003/S17, PIP-004, PIP-004/R7, PIP-004/S21, PIP-007, PIP-007/R5, PIP-007/R6, PIP-007/R7, PIP-007/R8, PIP-007/S11, PIP-007/S12, PIP-007/S13, PIP-007/S14, PIP-007/S15, PIP-007/S16, PIP-007/S17, PIP-007/S18, PIP-008, PIP-008/R2, PIP-008/S27, PIP-012, PIP-012/R9, PIP-012/S2, PIP-012/S20, PIP-017, PIP-017/R5, PIP-017/R6, PIP-017/S7, PIP-017/S8, PIP-017/S9, TKT-001, TKT-001/R6, TKT-001/R8, TKT-001/S15, TKT-001/S19, TKT-001/S29, TKT-002/S7, TKT-002/S12, TKT-005/R2, TKT-007, TKT-007/R2, TKT-007/S16, adopt.GapReport, adopt.GapReport.questions, pipeline.Blocker, pipeline.Blocker.external, pipeline.CaseItem, pipeline.ChecklistItem, pipeline.ChecklistItem.ids, pipeline.ChecklistItem.item, pipeline.ChecklistItem.outcome, pipeline.ChecklistItem.reason, pipeline.ChecklistOutcome, pipeline.Report, pipeline.Report.checklist, tickets.Question, tickets.Question.cites, tickets.Question.kind, tickets.QuestionKind]
questions:
  - id: Q1
    kind: blocker
    text: The test expects PROP-208 to ignore PRV-001#Q1 even though PROP-208 touches PRV-001; in-scope external questions must block.
    default: null
    cites:
      - TKT-007/S16
      - TKT-007/R2
    answer: "The spec is right: an in-scope external question blocks (TKT-007/S16, R2). The tester fixes tests/cli/external-questions.test.ts so it expects the block."
    raised_by: implementer
  - id: Q2
    kind: blocker
    text: 'Existing tests expect done spec-writer reports without checklists to pass or report only older errors; the updated spec requires missing-item problems. Its changes are kept in git stash "PROP-051 implementer: blocked"; the next implementer stage gets them back.'
    default: null
    cites:
      - PIP-007/S12
      - PIP-007/R5
    answer: "The spec is right: a done spec-writer report on a proposal needs the checklist (PIP-007/S12, R5). The tester updates every existing test that builds a done spec-writer report without a checklist (sweep all such fixtures), calling each rewrite out in its commit body."
    raised_by: implementer
  - id: Q3
    kind: blocker
    text: 'tests/cli/external-questions.test.ts expects PROP-208 to be ready after answering its ticket question, while the in-scope PRV-001#Q1 external question remains open. Its changes are kept in git stash "PROP-051 implementer: blocked"; the next implementer stage gets them back.'
    default: null
    cites:
      - TKT-007/S16
      - TKT-007/R2
      - INV-006
    answer: "The spec is right (TKT-007/S16: PROP-208's Q1 'and nothing else stops it'). The tester's earlier fix put the open in-scope PRV-001#Q1 into PROP-208's own fixture; the tester separates the fixtures: PROP-208 has only its own Q1 (answer → ready), and the in-scope/out-of-scope cases use other tickets. Check every assertion in that test against S16 line by line."
    raised_by: implementer
  - id: Q4
    kind: blocker
    text: syncing ticket/PROP-051 with plugin-integration conflicts in tests/cli/next.test.ts; a person must merge
    default: null
    cites: []
    answer: "Merged plugin-integration into ticket/PROP-051 by hand (009066d): next.test.ts keeps both test sets; PIP-017 tests follow the merged spec."
    raised_by: tester
  - id: Q5
    kind: blocker
    text: 'git stash "PROP-051 implementer: blocked" does not apply to ticket/PROP-051: it conflicts in .spec/bin/spec.cjs, plugin/scripts/spec.cjs, src/generated/assets.ts. A person must apply it by hand (git stash list names it), then answer to resume.'
    default: null
    cites: []
    answer: Applied the implementer stash by hand; the three conflicting files were generated bundles (.spec/bin/spec.cjs, plugin/scripts/spec.cjs, src/generated/assets.ts) — kept the branch versions; the implementer rebuilds them.
    raised_by: implementer
  - id: Q6
    kind: blocker
    text: "Tests needed: main's tests added after this ticket began build done spec-writer reports on proposals with no checklist and now fail with 'the checklist has no entry for C1..C8': tests/cli/ticket-unknown-keys.test.ts (TKT-001/S19), tests/cli/ticket-unknown-keys-order.test.ts (TKT-001/S19, three cases), tests/cli/ticket-flow-style.test.ts (TKT-002/S7 twice, TKT-002/S12). The tester adds the checklist to each, as PROP-061#Q2 already asked for the older ones. Its changes are kept in git stash \"PROP-061 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites: [PIP-007/S12, PIP-007/R5]
    answer: "Yes: the tester adds the checklist to every listed test, and to any other test that builds a done spec-writer report on a proposal."
    raised_by: implementer
  - id: Q7
    kind: blocker
    text: the reviewer asked for changes 3 times; a person must decide. How should PROP-061 proceed?
    default: null
    cites: []
    answer: One more round for the one remaining finding (ticket new accepts kind external), tester first; any further finding becomes a follow-up ticket.
    raised_by: overseer
history:
  - at: 2026-10-31T00:41:11.987Z
    role: spec-writer
    result: done
    summary: Case checklist in brief and report, checked by check-report; external blockers raise external questions that gate
    verdict: null
    assumed:
      - new: Where does the checklist text live?
        value: "In the spec-writer brief's Case checklist group (PIP-012/R9); this version's role prompt points to it and its report form has checklist:"
      - new: "How is 'type: external' modelled?"
        value: "A new tickets.QuestionKind value external, raised by a blocker marked external: true and gated like a blocker"
      - new: Is the checklist checked on blocked spec-writer reports?
        value: No; only done ones (PIP-007/R8)
      - new: Must checklist IDs fit their outcome?
        value: "Yes: scenarios cite scenarios, invariant cites invariants, question cites <owner>#Q<n>; non-na needs at least one ID"
    duration_s: 9076
  - at: 2026-10-31T02:43:02.370Z
    role: tester
    result: done
    summary: Added missing scenario IDs and focused coverage for ticket and gate rules.
    verdict: null
    assumed: []
    duration_s: 7284
  - at: 2026-10-31T03:00:03.966Z
    role: implementer
    result: blocked
    summary: Implemented the checklist and external-question behavior; existing tests conflict with the updated spec
    verdict: null
    assumed: []
    duration_s: 1007
  - at: 2026-10-31T03:00:22.521Z
    role: tester
    result: reopened
    summary: reopened by PROP-051#Q2
    verdict: null
    assumed: []
  - at: 2026-10-31T03:32:48.355Z
    role: tester
    result: done
    summary: Corrected in-scope external-question and proposal-checklist test fixtures.
    verdict: null
    assumed: []
    duration_s: 1932
  - at: 2026-10-31T03:52:57.727Z
    role: implementer
    result: blocked
    summary: Implemented checklist and external-question handling; one gate test expects readiness with an open in-scope question
    verdict: null
    assumed: []
    duration_s: 1201
  - at: 2026-10-31T03:52:59.036Z
    role: tester
    result: reopened
    summary: reopened by PROP-051#Q3
    verdict: null
    assumed: []
  - at: 2026-10-31T04:11:23.028Z
    role: tester
    result: reopened
    summary: reopened by PROP-051#Q4
    verdict: null
    assumed: []
  - at: 2026-10-31T04:21:38.801Z
    role: tester
    result: done
    summary: Separated ticket and unit external-question fixtures; PIP-017 tests follow the merged spec.
    verdict: null
    assumed: []
    duration_s: 613
  - at: 2026-10-31T04:39:31.206Z
    role: implementer
    result: done
    summary: Implemented case checklists and external questions; all checks pass
    verdict: null
    assumed: []
    duration_s: 1031
  - at: 2026-10-31T04:48:19.454Z
    role: reviewer
    result: done
    summary: Checklist and external questions work and checks pass; fix prompt duplication, a weak test, and two unspecified behaviours
    verdict: changes
    findings:
      - cites:
          - PIP-017/R5
          - PIP-017/S7
        text: src/cli/next.ts:74 guard /report each under checklist:/ never matches the shipped roles/spec-writer.md (it writes `checklist:` in backticks), so a project on this version's prompt gets the appended checklist sentence a second time; probed with spec next PROP-201. PIP-017/S7's test uses the old fixture prompt and cannot see it. Make the guard match the shipped text and test a task built from this version's prompt for one occurrence.
      - cites:
          - PIP-007/R7
          - PIP-007/S16
        text: tests/cli/report-checklist.test.ts S16 only opens a question of kind external, so a version that refuses just external questions passes. R7 says a C8 item cites no open question whatever its kind. Add a case where C8 cites an open blocker or preference and is refused.
      - cites:
          - PIP-017/R5
          - PIP-017/S7
        text: "src/cli/next.ts adds behaviour no scenario or rule states: for a project prompt that predates the checklist it appends a sentence to the role prompt, and it inserts documents: [] and checklist: [] into a report form that lacks them. S7 promises only that the brief still carries the checklist. The spec must say it."
        spec: true
      - cites:
          - tickets.Question.cites
          - TKT-001/R6
          - PIP-008/S25
        text: src/core/schemas.ts (TicketQuestionSchema and its superRefine) lets a ticket's question cite its own ticket ID and refuses any other ticket ID ('a ticket question may cite only its own ticket ID'). tickets.Question.cites says only unit IDs, and TKT-001/R6 does not list this refusal, although PIP-008/S25 relies on the own-ID case. The spec must state it.
        spec: true
    assumed: []
    duration_s: 520
  - at: 2026-10-31T04:51:03.943Z
    role: spec-writer
    result: done
    summary: PIP-017 states the old-prompt paragraph, form insertion and once-only checklist; tickets cite only their own ID
    verdict: null
    documents:
      - TKT-001/S29
    assumed:
      - new: When does spec next count a spec-writer prompt as predating the checklist?
        value: "When it says checklist: nowhere outside its report block, in backticks or not"
    duration_s: 155
  - at: 2026-10-31T05:33:13.994Z
    role: tester
    result: done
    summary: Added follow-up coverage for current/legacy prompts, report forms, citations and open questions.
    verdict: null
    assumed: []
    duration_s: 2527
  - at: 2026-10-31T05:47:30.563Z
    role: implementer
    result: done
    summary: Recognize backticked checklist instructions and avoid duplicating them in spec-writer tasks
    verdict: null
    assumed: []
    duration_s: 854
  - at: 2026-10-31T05:54:52.577Z
    role: reviewer
    result: done
    summary: "Round-1 findings resolved; old-prompt guard still tests one phrase, not R6's condition of no checklist: outside the form"
    verdict: changes
    findings:
      - cites:
          - PIP-017/R6
          - PIP-017/S8
        text: "src/cli/next.ts:74 appends the checklist paragraph unless the prompt contains 'report each under checklist:' (backticks optional), but R6 and S8 append only when the prompt says 'checklist:' nowhere outside its report block. Probe: roles/spec-writer.md with 'put the `checklist:` key in your report as' in place of 'report each under `checklist:` as' still got the paragraph appended, so the instruction appears twice. Test the R6 condition (any 'checklist:' outside the report block), and add a test for a prompt that mentions it in other words."
    assumed: []
    duration_s: 439
  - at: 2026-10-31T11:30:45.462Z
    role: implementer
    result: blocked
    summary: After the sync with main, main's newer tests build done spec-writer reports for proposals without the checklist PIP-007 now requires
    verdict: null
    assumed: []
    duration_s: 13
  - at: 2026-10-31T11:30:50.948Z
    role: tester
    result: reopened
    summary: reopened by PROP-061#Q6
    verdict: null
    assumed: []
  - at: 2026-10-31T11:53:46.738Z
    role: tester
    result: done
    summary: Added the case checklist to 7 done spec-writer reports in 3 tests from main; full suite, lint and typecheck pass
    verdict: null
    assumed: []
    duration_s: 1367
  - at: 2026-10-31T11:59:33.189Z
    role: implementer
    result: done
    summary: "No code change after the sync: the checklist and external-question code from before passes the full suite with the swept tests"
    verdict: null
    assumed: []
    duration_s: 338
  - at: 2026-10-31T12:08:36.302Z
    role: reviewer
    result: done
    summary: "Guard and ID sync hold; ticket new rejects external; candidate bug: history warns on tests"
    verdict: changes
    findings:
      - cites: [tickets.QuestionKind, tickets.NewQuestion.kind, TKT-005/R2]
        text: 'src/core/schemas.ts:66 adds external to tickets.QuestionKind, which tickets.NewQuestion.kind also uses, but src/core/ticket-new.ts:20 still accepts only blocker and preference. A valid proposal with questions: [{kind: external, text: "Does the external API paginate?", cites: [PIP-007]}] fails `.spec/bin/spec ticket new --dry-run --root spec external.json` with exit 1 and `questions.0.kind: Invalid option: expected one of "blocker"|"preference"`, rather than producing a ticket whose external question blocks its gate. Update new-ticket input validation and add a CLI regression for this newly supported question kind.'
        tests: true
      - cites: [tickets.Question.cites, TKT-001/R6, TKT-012/R2]
        text: "Follow-up: Combining a never-started, hand-authored ticket whose open question cites its own ticket ID is refused. src/core/ticket-combine.ts:88 copies the question into INTO with its original cite, which src/core/schemas.ts:257 then rejects as a foreign-ticket citation. Confirmed by applying planCombine and reparsing its output. Handle self-citations when moving questions and cover this corner case; ordinary blockers recorded by stages already have history and are ineligible for combine."
    assumed: []
    duration_s: 541
  - at: 2026-10-31T12:08:46.498Z
    role: tester
    result: reopened
    summary: reopened by PROP-061#Q7
    verdict: null
    assumed: []
  - at: 2026-10-31T12:15:45.466Z
    role: tester
    result: done
    summary: Added TKT-005/R2 ticket new regression for an external question (dry run and real); fails until ticket-new accepts external
    verdict: null
    assumed: []
    duration_s: 418
  - at: 2026-10-31T12:35:03.767Z
    role: implementer
    result: done
    summary: ticket new accepts kind external from the shared QUESTION_KINDS list; question cites stay on one line
    verdict: null
    assumed: []
    duration_s: 1157
  - at: 2026-10-31T12:37:26.240Z
    role: reviewer
    result: done
    summary: External questions can be created and block the gate; one-line cites preserve TKT-005/R2
    verdict: approve
    assumed: []
    duration_s: 141
---
From docs/RETRO-PLUGIN-WORK.md (classes C1-C8). The spec-writer role prompt gains the case checklist: run `spec impact <ticket>` and cover each reached feature (C1); environment axes (C2); concurrency and ordering (C3); trust boundaries (C4); fail closed (C5); preserved behaviour as scenarios on the unchanged path (C6); external facts cited or asked (C8).

The spec-writer's report block gains `checklist:` with one entry per item C1-C6 and C8: `{ item: C1, outcome: scenarios|invariant|question|na, ids: [...], reason: "..." }`. check-report refuses a spec-writer report on a proposal or bug whose checklist is missing an item, or has `na` without a reason, or cites IDs that don't exist. Tasks are exempt.

An external fact the spec-writer could not verify becomes a ticket question (type: external), so the gate blocks until a person or a spike answers it.
