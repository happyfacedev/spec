---
id: PROP-076
type: proposal
title: An implementer's test-side blocker goes to the tester with the implementer's code kept in place
status: done
stage: null
touches: [PIP-002, PIP-007]
violates: []
depends_on: [PROP-060]
changed: [INV-003, PIP-001/R2, PIP-001/R8, PIP-001/S25, PIP-004/R9, PIP-004/S23, PIP-008/R2, PIP-008/R9, PIP-008/R13, PIP-008/R14, PIP-008/R15, PIP-008/S28, PIP-008/S29, PIP-008/S30, PIP-008/S31, PIP-012/R14, PIP-012/S2, PIP-012/S27, PIP-019/R1, PIP-019/R4, PIP-019/S4, PIP-019/S5, pipeline.Blocker, pipeline.Blocker.tests, pipeline.StageRecord, pipeline.StageRecord.blockers, pipeline.StageRecord.mutations, pipeline.StageRecord.passed]
questions:
  - id: Q1
    kind: blocker
    text: syncing ticket/PROP-076 with main conflicts in spec/modules/pipeline/features/PIP-012-brief-a-role-on-a-ticket.md; a person must merge
    default: null
    cites: []
    answer: "Merged main by hand: kept PROP-078's PIP-012 S24-S26/R13 and this ticket's S27/R14."
    raised_by: spec-review
history:
  - at: 2026-10-31T21:41:28.959Z
    role: spec-writer
    result: done
    summary: Implementer blockers marked tests hand committed code to the tester; later tester rounds inherit earlier mutations
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-001/S25, PIP-002/S19, PIP-002/S20, PIP-006/S26, PIP-008/S28, PIP-012/S27, PIP-019/S5]
        reason: spec impact PROP-076 reaches PIP-002 (start) and its re-verify ring. The tester's start after a hand-off finds a clean tree and no stash to restore (PIP-002/S19, S20 stay true); a blocked implementer counts as an implementer stage, so the hand-off tester may leave tests passing (PIP-006/S26, unchanged); stage order, advance, brief and mutation checks change with it (PIP-001/S25, PIP-008/S28, PIP-012/S27, PIP-019/S5). PIP-020 counts a hand-off as one blocked stage, as recorded.
      - item: C2
        outcome: scenarios
        ids: [PIP-001/S25]
        reason: "upgrade from older histories: a blocked implementer record without blockers is followed by the implementer as before, and a tester record without passed by the implementer; paths, platforms and install layouts are untouched"
      - item: C3
        outcome: na
        ids: []
        reason: "no new shared state across processes: a hand-off is one advance under the existing per-ticket flow, and it stops touching the stash list rather than adding to it"
      - item: C4
        outcome: invariant
        ids: [INV-003]
        reason: "the tests mark is set by the implementer (a model). A forged mark cannot widen what any stage may change: the tester that follows still changes only test files (INV-003), the CLI decides the next stage from the tester's own test run (passed), failing tests send it back to the implementer, and a third hand-off falls back to questions for a person"
      - item: C5
        outcome: scenarios
        ids: [PIP-004/S23, PIP-008/S28]
        reason: "tests: true on a task, on any other role's blocker, or with external: true is refused; a report that mixes marked and unmarked blockers, or a third hand-off, is stashed and asked as today"
      - item: C6
        outcome: scenarios
        ids: [PIP-008/S6, PIP-008/S21, PIP-001/S5, PIP-001/S18, PIP-019/S1]
        reason: unmarked blockers still become questions and stash the work; a blocked stage still resumes itself; a reviewer tests finding still runs tester then implementer; a first tester round still needs a mutation per changed scenario
      - item: C8
        outcome: na
        ids: []
        reason: "no fact about another tool or service: the hand-off uses git commit as every done stage already does"
    assumed:
      - new: How many test hand-offs may a ticket take before a test blocker needs a person?
        value: two; a third is stashed and raised as questions (PIP-008/R13)
      - new: Does a later spec-writer round reset the mutations earlier tester rounds named?
        value: yes; on a proposal only tester stages recorded after the latest done spec-writer stage count (PIP-019/R1)
      - new: "May a task's implementer mark a blocker tests: true?"
        value: no; a task has no tester stage and its implementer may change tests itself, so check-report refuses it (PIP-004/R9)
      - new: Which tester stage records passed?
        value: a done tester stage while the last implementer or reviewer stage is a hand-off; reopened entries are not stages (PIP-008/R14)
    duration_s: 427
  - at: 2026-10-31T23:26:44.423Z
    role: spec-review
    result: done
    summary: Hand-offs bypass implementer safeguards; the tester mutation prompt omits the spec-writer reset
    verdict: changes
    findings:
      - cites: [PIP-008/R13, PIP-008/S28, PIP-001/S25, PIP-005/S5, PIP-005/S10, PIP-006/R6, PIP-006/R7, INV-003]
        text: "The hand-off commits a blocked implementer's tree and can then skip directly from a passing tester to the reviewer, but the delta never requires the implementer's non-test-success safeguards on this path. PIP-005 checks a done stage's uncommitted changes, while PIP-006/R7 explicitly runs checkCommands only for done stages and permits the tester to ignore failures outside test files. A forged tests: true can therefore commit forbidden test/spec/protected edits; even an honest hand-off can bypass a code lint/typecheck failure or the implementer's remaining SPEC-STUB check. The tester's own path checks against its HEAD do not recheck the committed implementer edits. The C4 checklist's INV-003 citation does not cover this new bypass. Specify and show which implementer safeguards must pass before committing a hand-off and before taking its reviewer shortcut, allowing the intended failing tests but not these other violations."
        class: C4
      - cites: [PIP-019/R1, PIP-019/R4, PIP-019/S4, PIP-019/S5]
        text: S5 and R1 reset inherited mutations after the latest done spec-writer round, but the changed tester prompt says without qualification that earlier tester stages still count, including in its report template. After a reviewer sends a proposal back through the spec-writer, the tester following that instruction may omit mutations for unchanged tests previously covered, although CheckReport now requires them again. Align the tester prompt and its prompt scenario/rule with the reset, so it distinguishes eligible earlier tester rounds from those before the latest done spec-writer.
        class: C9
    assumed: []
    duration_s: 189
  - at: 2026-10-31T23:28:52.599Z
    role: spec-writer
    result: done
    summary: Hand-off needs every done-implementer check but the tests; reviewer shortcut needs them on the combined tree; prompt reset aligned
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-001/S25, PIP-002/S19, PIP-002/S20, PIP-006/S26, PIP-008/S28, PIP-008/S31, PIP-012/S27, PIP-019/S5]
        reason: spec impact PROP-076 reaches PIP-002 and its ring. The tester's start after a hand-off finds a clean tree and no stash (PIP-002/S19, S20 stay true); a blocked implementer counts as an implementer stage, so the hand-off tester may leave tests passing (PIP-006/S26); the PIP-005 path rules and PIP-006/R6, R7 checks now gate the hand-off (PIP-008/S31) and the reviewer shortcut (PIP-008/S29); order, brief and mutations change with it (PIP-001/S25, PIP-012/S27, PIP-019/S5)
      - item: C2
        outcome: scenarios
        ids: [PIP-001/S25]
        reason: "older histories: a blocked implementer record without blockers is followed by the implementer, and a tester record without passed by the implementer; paths, platforms and install layouts are untouched"
      - item: C3
        outcome: na
        ids: []
        reason: "no new shared state across processes: a hand-off is one advance under the existing per-ticket flow, and a refused one stashes under the existing stash lock (PIP-002/R4)"
      - item: C4
        outcome: invariant
        ids: [INV-003]
        reason: the tests mark is set by the implementer (a model). INV-003 now says a blocked stage's changes are committed only on a hand-off that keeps the role's path rules; a forged mark over test, spec or protected edits, a failing check command or a left SPEC-STUB is stashed for a person (PIP-008/S31). The reviewer shortcut needs the full done-implementer checks on the combined tree (PIP-008/S29), so the CLI, not the mark, decides; a third hand-off goes to a person
      - item: C5
        outcome: scenarios
        ids: [PIP-004/S23, PIP-008/S28, PIP-008/S31]
        reason: "tests: true on a task, on another role's blocker, or with external: true is refused; a mixed blocker list, a third hand-off, or changes that fail any done-implementer check other than the tests are stashed and asked as today"
      - item: C6
        outcome: scenarios
        ids: [PIP-008/S6, PIP-008/S21, PIP-001/S5, PIP-001/S18, PIP-019/S1]
        reason: unmarked blockers still become questions and stash the work; a blocked stage still resumes itself; a reviewer tests finding still runs tester then implementer; a first tester round still needs a mutation per changed scenario
      - item: C8
        outcome: na
        ids: []
        reason: "no fact about another tool or service: the hand-off uses git commit and stash as advance already does"
    assumed:
      - new: How many test hand-offs may a ticket take before a test blocker needs a person?
        value: two; a third is stashed and raised as questions (PIP-008/R13)
      - new: Does a later spec-writer round reset the mutations earlier tester rounds named?
        value: yes; on a proposal only tester stages recorded after the latest done spec-writer stage count (PIP-019/R1), and the tester prompt says so (PIP-019/R4)
      - new: "May a task's implementer mark a blocker tests: true?"
        value: no; a task has no tester stage and its implementer may change tests itself, so check-report refuses it (PIP-004/R9)
      - new: How does a person learn why a hand-off was refused?
        value: "stdout adds 'not handed to the tester: <problems>' and the last question ends ' Not handed to the tester: <problems>' (PIP-008/R13)"
      - new: Does the hand-off check run the test command?
        value: no; the tests are known wrong, so only the path rules, checkCommands and the SPEC-STUB check run (PIP-008/R13)
    duration_s: 126
  - at: 2026-10-31T23:30:14.944Z
    role: spec-review
    result: done
    summary: Safeguards and mutation reset are covered; the passed contract still contradicts the strengthened routing guard
    verdict: changes
    findings:
      - cites: [pipeline.StageRecord.passed, PIP-008/R14, PIP-008/S29, PIP-001/R8]
        text: The C4 fix strengthens R14 and S29, but pipeline.StageRecord.passed still says true when the test run exits 0 with no failed test, false otherwise. For the newly specified case where every test passes but a check command fails or a branch-added SPEC-STUB remains, that contract requires true while R14/S29 require false. Since this value selects reviewer versus implementer, these are conflicting routing requirements, not merely different descriptions. Align the contract with the combined-tree safeguards in R14. The hand-off refusal safeguards and the tester mutation-reset prompt otherwise address the previous findings.
        class: C9
    assumed: []
    duration_s: 80
  - at: 2026-10-31T23:31:14.831Z
    role: spec-writer
    result: done
    summary: "pipeline.StageRecord.passed now matches PIP-008/R14: true only when the combined tree passes every done-implementer check"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-001/S25, PIP-002/S19, PIP-002/S20, PIP-006/S26, PIP-008/S28, PIP-008/S31, PIP-012/S27, PIP-019/S5]
        reason: spec impact PROP-076 reaches PIP-002 and its ring. The tester's start after a hand-off finds a clean tree and no stash (PIP-002/S19, S20 stay true); a blocked implementer counts as an implementer stage, so the hand-off tester may leave tests passing (PIP-006/S26); the PIP-005 path rules and PIP-006/R6, R7 checks now gate the hand-off (PIP-008/S31) and the reviewer shortcut (PIP-008/S29); order, brief and mutations change with it (PIP-001/S25, PIP-012/S27, PIP-019/S5)
      - item: C2
        outcome: scenarios
        ids: [PIP-001/S25]
        reason: "older histories: a blocked implementer record without blockers is followed by the implementer, and a tester record without passed by the implementer; paths, platforms and install layouts are untouched"
      - item: C3
        outcome: na
        ids: []
        reason: "no new shared state across processes: a hand-off is one advance under the existing per-ticket flow, and a refused one stashes under the existing stash lock (PIP-002/R4)"
      - item: C4
        outcome: invariant
        ids: [INV-003]
        reason: the tests mark is set by the implementer (a model). INV-003 now says a blocked stage's changes are committed only on a hand-off that keeps the role's path rules; a forged mark over test, spec or protected edits, a failing check command or a left SPEC-STUB is stashed for a person (PIP-008/S31). The reviewer shortcut needs the full done-implementer checks on the combined tree (PIP-008/S29), so the CLI, not the mark, decides; a third hand-off goes to a person
      - item: C5
        outcome: scenarios
        ids: [PIP-004/S23, PIP-008/S28, PIP-008/S31]
        reason: "tests: true on a task, on another role's blocker, or with external: true is refused; a mixed blocker list, a third hand-off, or changes that fail any done-implementer check other than the tests are stashed and asked as today"
      - item: C6
        outcome: scenarios
        ids: [PIP-008/S6, PIP-008/S21, PIP-001/S5, PIP-001/S18, PIP-019/S1]
        reason: unmarked blockers still become questions and stash the work; a blocked stage still resumes itself; a reviewer tests finding still runs tester then implementer; a first tester round still needs a mutation per changed scenario
      - item: C8
        outcome: na
        ids: []
        reason: "no fact about another tool or service: the hand-off uses git commit and stash as advance already does"
    assumed:
      - new: How many test hand-offs may a ticket take before a test blocker needs a person?
        value: two; a third is stashed and raised as questions (PIP-008/R13)
      - new: Does a later spec-writer round reset the mutations earlier tester rounds named?
        value: yes; on a proposal only tester stages recorded after the latest done spec-writer stage count (PIP-019/R1), and the tester prompt says so (PIP-019/R4)
      - new: "May a task's implementer mark a blocker tests: true?"
        value: no; a task has no tester stage and its implementer may change tests itself, so check-report refuses it (PIP-004/R9)
      - new: How does a person learn why a hand-off was refused?
        value: "stdout adds 'not handed to the tester: <problems>' and the last question ends ' Not handed to the tester: <problems>' (PIP-008/R13)"
      - new: Does the hand-off check run the test command?
        value: no; the tests are known wrong, so only the path rules, checkCommands and the SPEC-STUB check run (PIP-008/R13)
    duration_s: 58
  - at: 2026-10-31T23:35:29.472Z
    role: spec-review
    result: done
    summary: "Approved: passed contract and stage-order intent now match the combined-tree safeguards in PIP-008/R14"
    verdict: approve
    assumed: []
    duration_s: 253
  - at: 2026-10-31T23:50:20.086Z
    role: tester
    result: done
    summary: Tests for hand-off, passed routing, tests-mark refusals, tester brief, mutation inheritance and prompts
    verdict: null
    mutations:
      - scenario: PIP-001/S25
        wrong: after a blocked implementer record that holds blockers the implementer runs again, or a tester record with passed true still goes to the implementer
      - scenario: PIP-004/S23
        wrong: "tests: true is accepted on a task, on a tester, reviewer, spec-writer or spec-review blocker, or together with external: true"
      - scenario: PIP-008/S28
        wrong: "a blocked implementer report whose every blocker has tests: true still stashes its changes and raises a question instead of committing and printing next: tester"
      - scenario: PIP-008/S29
        wrong: the tester's passed is true whenever the tester's report is accepted, whatever the test run, a check command or a SPEC-STUB line says
      - scenario: PIP-008/S30
        wrong: "the implementer prompt never asks for tests: true blockers and its report form omits the mark, and the tester prompt never says the code is committed and the blockers are in the brief"
      - scenario: PIP-008/S31
        wrong: a hand-off is committed although its changes touch a test or spec file, fail a check command or leave a SPEC-STUB, with no not handed to the tester line
      - scenario: PIP-012/S2
        wrong: the tester brief puts Implementer's test blockers after Review findings, or leaves it out of the tester's group table
      - scenario: PIP-012/S27
        wrong: the Implementer's test blockers group shows in every role's brief, or stays after the tester stage is done, or drops the cites from its lines
      - scenario: PIP-019/S4
        wrong: the tester and reviewer prompts count tester rounds from the start of the history and never mention the latest done spec-writer stage
      - scenario: PIP-019/S5
        wrong: a later tester round must name a mutation for every changed scenario again, or an earlier tester round still counts after a later done spec-writer stage
    assumed:
      - new: Which scenario do the test fixtures cite where the brief cites PRV-001/S4 in a blocker?
        value: "PRV-001/S3: the plain chat-mini spec has no S4, and check-report refuses a blocker that cites a unit the spec lacks"
      - new: Does the hand-off's third-attempt block print a not handed to the tester line?
        value: no; PIP-008/R13 adds that line only to a report refused by a failed check, so the tests expect S21's three lines for a third hand-off
    duration_s: 889
  - at: 2026-11-01T00:02:42.179Z
    role: implementer
    result: done
    summary: Test hand-offs with tests mark, hand-off commit, passed routing, tester brief group, mutation reset, prompts
    verdict: null
    assumed:
      - new: How does the implementer's report form show the tests mark?
        value: a new optional `blockers:` key in the role template frontmatter fills a {blockers} placeholder in roles/_shared.md; only the implementer sets it, other roles keep the old line
      - new: Does the hand-off check run lint?
        value: no; only the path rules, check commands and SPEC-STUB run (PIP-008/R13)
    duration_s: 740
    refusals: 1
  - at: 2026-11-01T00:07:18.226Z
    role: reviewer
    result: done
    summary: "Approved: guarded, bounded hand-offs and combined-tree routing match the spec"
    verdict: approve
    assumed: []
    duration_s: 272
---
Measured on this repo (SELF-HOSTING P39, P42): of the 10 tickets merged on 2026-10-31, the clean ones took 4 stages and the churned ones 7-10. The main cause, in 5 of 6 churned tickets (PROP-062, 064, 065, 066, 060), was the same loop. The implementer finishes the code, and existing or new tests turn out wrong for the changed behaviour: old tests that encode the old flow pass on the old code, so the tester could not see them fail. The implementer may not edit tests, so it blocks. Advance stashes its code, and the person must answer with `--back tester`, or the ticket goes back to the implementer for nothing. The tester then works without the code it is fixing tests for, and restoring the stash later conflicts on generated files. Change: an implementer blocker can carry `tests: true`, the same mark review findings use. When every blocker of a blocked implementer report is marked tests, advance commits the implementer's work on the ticket branch instead of stashing it. The ticket goes straight to a tester stage without a question, and the blockers go into the tester's brief. That tester runs against the real code and fixes only tests. When its tests pass, the ticket goes to the reviewer; when they fail, it goes to the implementer. The implementer prompt says to mark a blocker tests when the fix is only in tests.
