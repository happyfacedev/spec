---
id: PROP-092
type: proposal
title: "A light lane: a ticket that changes only text or only tests skips the stages it has nothing for"
status: done
stage: null
touches: [PIP-001, TKT-001]
violates: []
depends_on: []
changed: [INV-013, PIP-001, PIP-001/R9, PIP-001/R10, PIP-001/R11, PIP-001/S26, PIP-001/S27, PIP-001/S28, PIP-001/S29, PIP-001/S30, PIP-001/S31, PIP-001/S32, PIP-001/S33, PIP-001/S34, PIP-002, PIP-008, PIP-012/R16, PIP-012/S30, PIP-020/R2, PIP-020/S7, PIP-021, PIP-021/R1, PIP-021/R2, PIP-021/R3, PIP-021/R4, PIP-021/R5, PIP-021/R6, PIP-021/R7, PIP-021/R8, PIP-021/S1, PIP-021/S2, PIP-021/S3, PIP-021/S4, PIP-021/S5, PIP-021/S6, PIP-021/S7, PIP-021/S8, TKT-001, TKT-001/R14, TKT-001/S31, TKT-001/S32, TKT-001/S33, TKT-005, TKT-006, TKT-012, WSP-004, pipeline.Report, pipeline.Report.lane, pipeline.StageRecord, pipeline.StageRecord.lane, tickets.Lane, tickets.Ticket, tickets.Ticket.lane]
questions: []
history:
  - at: 2026-11-01T12:22:34.586Z
    role: spec-writer
    result: done
    summary: "Add ticket lane full|docs|tests: light lanes skip empty stages, CLI falls back to the full order for good"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-001/S3, PIP-001/S24, PIP-001/S34, PIP-008/S21]
        reason: spec impact reaches PIP-008 and WSP-009 only through pipeline.StartStage/StageRefused; existing refusal messages are unchanged and a ticket with no lane runs the same order (S34). PIP-008/S21 is a task with no lane and is untouched; WSP-009/S3, S5, S6, S7 only start stages of tickets with no lane
      - item: C2
        outcome: scenarios
        ids: [PIP-001/S23, PIP-001/S34, PIP-001/S33]
        reason: "Upgrade from older states: a ticket written before lanes has no lane key and reads as full (S34); older histories are read as they stand (S23); a history that already holds a stage the lane skips reads as full (S33). Paths and platforms do not apply"
      - item: C3
        outcome: na
        ids: []
        reason: The lane is read when a stage starts or is recorded, and only one stage of a ticket runs at a time (PIP-002); no new state is shared across a process boundary
      - item: C4
        outcome: invariant
        ids: [INV-013]
        reason: A person sets the lane in the frontmatter; a report can only widen it to full; the CLI decides the fallback from git, its own test run and recorded findings; a lane cannot be narrowed after work has run; INV-002 and INV-003 and the reviewer hold in every lane
      - item: C5
        outcome: scenarios
        ids: [PIP-001/S28, PIP-001/S31, TKT-001/S32, TKT-001/S33]
        reason: Tests that cannot be run or read send the ticket to the full lane; a report lane other than full is refused; an unknown lane value or a light lane on a bug or task is refused by lint and the gate
      - item: C6
        outcome: scenarios
        ids: [PIP-001/S1, PIP-001/S2, PIP-001/S3, PIP-001/S24, PIP-001/S34, PIP-001/S32]
        reason: Full-lane, bug and task orders are unchanged; a reviewer changes with no marks still goes implementer then reviewer
      - item: C8
        outcome: na
        ids: []
        reason: No fact about another tool or service is involved
    assumed:
      - new: What is the frontmatter field called, and which lanes are there?
        value: "lane: full | docs | tests; left out reads as full"
      - new: Which stages does each light lane run?
        value: "docs: spec-writer, spec-review, reviewer; tests: spec-writer, tester, reviewer (the spec-writer stays in the tests lane to diagnose, as on PROP-090)"
      - new: Which ticket types may use a light lane?
        value: Proposals only; a bug's test-first rule needs a failing test and a task already runs only implementer and reviewer
      - new: How does a docs-lane ticket keep INV-002 (existing tests cover changed scenarios)?
        value: When the spec-writer's done stage is recorded, the CLI checks that every scenario the branch added or changed has a covering test (PIP-011) that passes and that no test fails; otherwise the ticket moves to the full lane
    duration_s: 606
    refusals: 1
  - at: 2026-11-01T12:27:42.011Z
    role: spec-review
    result: done
    summary: Light lanes leave guard gaps, conflicting failure routing, and unchanged full-lane instructions
    verdict: changes
    findings:
      - cites: [INV-013, PIP-001/R10, PIP-001/R11, PIP-001/S33]
        text: The no-narrowing guarantee misses a lane changed after a full-lane spec-writer finishes but before any skipped role finishes. Setting tests then skips spec review despite the recorded spec changes; setting docs after spec review skips the tester without ever running the docs coverage guard. R11 checks only completed skipped roles, and R10 checks the spec-writer only when recording it. Specify and show how an already-started ticket cannot bypass those guards through a later frontmatter edit.
        class: C4
      - cites: [PIP-001/S30, PIP-001/R10, PIP-006/S19, PIP-006/R7, PIP-008/R4]
        text: S30 sends a tests-lane tester to the implementer whenever a check command exits 1, including a lint failure in its own test file. The unchanged tester check refuses that report, and advance records a blocked stage instead. Specify which checks must first accept the tester report and which failures trigger lane fallback; otherwise the same input requires both blocked and next implementer, where the implementer cannot edit the failing test.
        class: C1
      - cites: [PIP-001/R10, PIP-001/S26, PIP-001/S28, PIP-007/R4, PIP-014/R2]
        text: The docs guard requires coverage only for scenarios the branch added or changed, but the existing comparison distinguishes reworded scenarios from changed ones. A title-only rewording with no covering test and unrelated tests passing can therefore skip the tester. S28 covers a reworded scenario with a failing test, not one with no test. Explicitly include rewordings in the coverage requirement and show the uncovered case.
        class: C5
      - cites: [PIP-001/R10, PIP-001/S28, PIP-006/S36]
        text: The docs guard does not require the test command to exit 0. A readable report can contain only passing tests while the command exits 1, for example because its coverage threshold failed as in PIP-006/S36. None of the listed fallback conditions clearly covers that case. Specify and show fallback for a non-zero test-command exit even when no individual test is reported failed.
        class: C5
      - cites: [PIP-001/R9, PIP-001/S27, PIP-012/S4, PIP-012/R3]
        text: The generated brief still tells every proposal that the spec changes first, tests then fail, and code changes until they pass. That instruction conflicts with both new lanes, particularly the tests-lane spec-writer whose successful path must leave the spec unchanged. Define lane-aware stage instructions, including how a role requests full-lane fallback, while preserving the existing full-lane wording.
        class: C9
      - cites: [PIP-001/S26, PIP-001/S27, PIP-020/R2]
        text: "Follow-up: stats still assigns minimum 5 to a clean docs proposal and misidentifies a tests-lane proposal as the older four-stage pipeline because it has a done tester and no spec review. Define how light lanes and permanent fallback affect the reported minimum so clean three-stage tickets are measured accurately."
        class: C1
    assumed: []
    duration_s: 303
  - at: 2026-11-01T12:31:54.784Z
    role: spec-writer
    result: done
    summary: Fix lane at first record, tighten docs/tests guards, lane-aware briefs and stats; move lanes to PIP-021
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-001/S34, PIP-021/S8, PIP-021/S5, PIP-012/S30, PIP-020/S7, PIP-008/S21]
        reason: "The new members are optional: reports, records and tickets without them behave as before (PIP-001/S34, PIP-021/S8 last step). The tester's own checks run unchanged before the tests-lane guard (PIP-021/S5). Briefs and stats follow the lane (PIP-012/S30, PIP-020/S7). PIP-008/S21, a task with no lane, is untouched"
      - item: C2
        outcome: scenarios
        ids: [PIP-021/S8, PIP-001/S34, PIP-001/S23]
        reason: "Upgrade: a history recorded before lanes has no lane on its first record and runs the full order; a ticket with no lane key runs the full order; older histories are read as they stand. Paths and platforms do not apply"
      - item: C3
        outcome: scenarios
        ids: [PIP-021/S8]
        reason: The only state that changes while work is in progress is the frontmatter lane; it is read only until the first record, so an edit during or after a stage changes nothing. Only one stage of a ticket runs at a time (PIP-002)
      - item: C4
        outcome: scenarios
        ids: [PIP-021/S8, PIP-021/S6, TKT-001/S32]
        reason: "INV-013: a person sets the lane, it is fixed at the first record, a report can only widen it to full, the CLI decides the fallback from git and its own test run, and the gate refuses a light lane on a bug or task"
      - item: C5
        outcome: scenarios
        ids: [PIP-021/S3, PIP-021/S5, PIP-021/S6, TKT-001/S33]
        reason: A non-zero test-command exit, an uncovered added/changed/reworded scenario, or tests that cannot be run or read move a docs-lane ticket to full; a tests-lane tree that fails an implementer check moves it to full; a report lane other than full and an unknown lane value are refused
      - item: C6
        outcome: scenarios
        ids: [PIP-001/S34, PIP-001/S1, PIP-001/S2, PIP-001/S3, PIP-012/S4, PIP-021/S7]
        reason: Full-lane, bug and task orders are unchanged, the full-lane brief rule keeps its wording, and a reviewer changes with no marks still goes implementer then reviewer
      - item: C8
        outcome: na
        ids: []
        reason: No fact about another tool or service is involved
    assumed:
      - new: What is the frontmatter field called, and which lanes are there?
        value: "lane: full | docs | tests; left out reads as full"
      - new: Which stages does each light lane run?
        value: "docs: spec-writer, spec-review, reviewer; tests: spec-writer, tester, reviewer"
      - new: Which ticket types may use a light lane?
        value: Proposals only
      - new: Can a person widen a lane by editing the frontmatter after the first stage is recorded?
        value: "No: the lane is fixed at the first record; a stage widens it with lane: full in its report"
    duration_s: 249
  - at: 2026-11-01T12:34:01.902Z
    role: spec-review
    result: done
    summary: Earlier behavioral findings resolved; approve with minor contract, brief, and checklist follow-ups
    verdict: approve
    findings:
      - cites: [pipeline.TicketStats.minimum, PIP-020/R2, PIP-020/S7]
        text: "Follow-up: stats now correctly specifies minimum 3 for light lanes, but pipeline.TicketStats.minimum still documents only the old 5/3/2 and legacy 4 calculation. Align the member's description with the updated feature."
        class: C9
      - cites: [PIP-012/S30, PIP-021/R3, PIP-021/S7]
        text: "Follow-up: the lane-aware brief says the implementer does not run and that requesting full runs every stage. S7 permits an implementer after unmarked reviewer findings without leaving the light lane, and R3 resumes full order from the recorded role rather than replaying every stage. Qualify the brief wording for these recovery paths."
        class: C9
      - cites: [PIP-021/S8, PIP-021/R2]
        text: "Follow-up: the C3 checklist answer says an edit during a stage changes nothing, but R2 still reads frontmatter while the first stage has no record. S8 covers edits only after recording. Clarify first-stage sampling and add coverage for an edit while that stage is in progress, including keeping the lane used for guards consistent with the lane recorded."
        class: C3
    assumed: []
    duration_s: 125
  - at: 2026-11-01T12:52:12.141Z
    role: tester
    result: done
    summary: "Tests for the light lanes: lane schema, docs/tests/full orders, fallbacks to full, lane-aware briefs and stats"
    verdict: null
    mutations:
      - scenario: PIP-001/S34
        wrong: a proposal with no lane key, or lane full, runs a light lane's order
      - scenario: PIP-012/S30
        wrong: a proposal in a light lane still gets the full-lane rule of PIP-012/S4 in its brief
      - scenario: PIP-020/S7
        wrong: stats still gives a light-lane proposal the minimum 5 (or 4)
      - scenario: PIP-021/S1
        wrong: the docs lane runs the tester and implementer after the spec review instead of going to the reviewer
      - scenario: PIP-021/S2
        wrong: the tests lane sends the spec-writer's ticket to the spec review instead of the tester
      - scenario: PIP-021/S3
        wrong: a docs-lane spec-writer stays in the lane though a changed scenario has no passing test or the test command exits 1
      - scenario: PIP-021/S4
        wrong: a tests-lane spec-writer that changes a spec file stays in the tests lane and goes on to the tester
      - scenario: PIP-021/S5
        wrong: a tests-lane tester whose tree fails a test, a check command or leaves a SPEC-STUB stays in the lane and goes to the reviewer
      - scenario: PIP-021/S6
        wrong: a report with lane docs is accepted and makes the ticket lighter, or lane full is ignored
      - scenario: PIP-021/S7
        wrong: a reviewer finding marked tests or spec keeps a light-lane ticket in its lane
      - scenario: PIP-021/S8
        wrong: the order reads tickets.Ticket.lane on every call, so a later frontmatter edit changes the lane
      - scenario: TKT-001/S31
        wrong: lint warns that lane is an unknown key on a proposal in a light lane
      - scenario: TKT-001/S32
        wrong: the gate accepts a light lane on a bug or a task
      - scenario: TKT-001/S33
        wrong: a lane outside full, docs and tests gives only an unknown-key warning and the gate stays ready
    assumed:
      - new: Does a full-lane proposal's report with lane full add lane to its record?
        value: "No: the record carries lane only when it moved the ticket out of a light lane (pipeline.StageRecord.lane)"
      - new: Which check-report problem text refuses a report lane other than full?
        value: "any problem starting 'report lane: ' (PIP-021/S6)"
    duration_s: 1085
  - at: 2026-11-01T13:26:04.954Z
    role: implementer
    result: done
    summary: "Light lanes: lane schema, lane-aware order, CLI guards, briefs and stats; tests, typecheck and lint pass"
    verdict: null
    assumed:
      - new: Does a blocked docs-lane spec-writer run the docs test guard?
        value: "No: only a done spec-writer stage is guarded (PIP-021/R5)"
      - new: Which delta does the docs guard read for added, changed and reworded scenarios?
        value: The branch's spec delta against the merge base; if it cannot be read the ticket moves to the full lane
      - new: Can a docs-lane implementer hand off to the tester?
        value: "No: hand-offs need a tester in the lane, so a test blocker there is an ordinary block"
    duration_s: 2028
  - at: 2026-11-01T13:39:04.091Z
    role: reviewer
    result: done
    summary: Fix stats minimum after tests-lane fallback; trust boundary holds, with three existing follow-ups
    verdict: changes
    findings:
      - cites: [PIP-020/R2, PIP-020/S7, PIP-021/S5]
        text: "src/core/stats.ts:75-77 applies the legacy minimum of 4 after a tests-lane tester widens to full: history [spec-writer lane tests, tester lane full] has a done tester and no spec review. Reproduced minimum=4; R2 explicitly requires 5 after leaving a light lane. Fix departure precedence while preserving legacy full-lane histories. tests/cli/ticket-lanes.test.ts:440 covers only a docs-lane departure that already has a spec review, so add the tests-lane fallback regression."
        tests: true
        class: C1
      - cites: [pipeline.TicketStats.minimum, PIP-020/R2, PIP-020/S7]
        text: "Follow-up: spec/modules/pipeline/contracts.md:403 still documents only the old 5/3/2 and legacy 4 calculation. The approved contract-description follow-up remains; document minimum 3 while light and 5 after departure."
        class: C9
      - cites: [PIP-012/S30, PIP-021/R3, PIP-021/S7]
        text: "Follow-up: src/core/brief.ts:308-309 faithfully copies S30, but still says the implementer never runs and requesting full runs every stage. Unmarked reviewer findings can run an implementer without leaving the light lane, and widening resumes from the recorded role. Qualify the approved spec wording, then align the brief and its exact-text tests."
        class: C9
      - cites: [PIP-021/R2, PIP-021/S8, INV-013]
        text: "Follow-up: first-stage sampling is sensible but remains untested. Advance reads frontmatter while history is empty; laneWidens and recordedLane use the same loaded ticket, keeping guards and the first record consistent. An edit before advance can therefore change the first stage's lane, contrary to the C3 checklist claim that edits during a stage change nothing. Clarify that claim and add an in-progress first-stage edit test; tests/cli/ticket-lanes.test.ts:380 currently checks only seeded histories after recording."
        class: C3
    assumed: []
    duration_s: 770
  - at: 2026-11-01T13:49:50.302Z
    role: tester
    result: done
    summary: Add tests-lane stats regression (minimum 5 after tester widens) and in-progress first-stage lane edit test
    verdict: null
    mutations:
      - scenario: PIP-001/S34
        wrong: a proposal with no lane key, or lane full, runs a light lane's order
      - scenario: PIP-012/S30
        wrong: a proposal in a light lane still gets the full-lane rule of PIP-012/S4 in its brief
      - scenario: PIP-020/S7
        wrong: stats gives a tests-lane proposal that widened to full at the tester the legacy minimum 4 instead of 5
      - scenario: PIP-021/S1
        wrong: the docs lane runs the tester and implementer after the spec review instead of going to the reviewer
      - scenario: PIP-021/S2
        wrong: the tests lane sends the spec-writer's ticket to the spec review instead of the tester
      - scenario: PIP-021/S3
        wrong: a docs-lane spec-writer stays in the lane though a changed scenario has no passing test or the test command exits 1
      - scenario: PIP-021/S4
        wrong: a tests-lane spec-writer that changes a spec file stays in the tests lane and goes on to the tester
      - scenario: PIP-021/S5
        wrong: a tests-lane tester whose tree fails a test, a check command or leaves a SPEC-STUB stays in the lane and goes to the reviewer
      - scenario: PIP-021/S6
        wrong: a report with lane docs is accepted and makes the ticket lighter, or lane full is ignored
      - scenario: PIP-021/S7
        wrong: a reviewer finding marked tests or spec keeps a light-lane ticket in its lane
      - scenario: PIP-021/S8
        wrong: the first record keeps the lane sampled when the stage started, not the frontmatter lane at the first record, or a later edit changes the order
      - scenario: TKT-001/S31
        wrong: lint warns that lane is an unknown key on a proposal in a light lane
      - scenario: TKT-001/S32
        wrong: the gate accepts a light lane on a bug or a task
      - scenario: TKT-001/S33
        wrong: a lane outside full, docs and tests gives only an unknown-key warning and the gate stays ready
    assumed:
      - new: What does PIP-021/R2 say happens to an edit of tickets.Ticket.lane while the first stage runs?
        value: The first record keeps the edited value, and the lane guards use that same value
    duration_s: 644
  - at: 2026-11-01T14:05:43.684Z
    role: implementer
    result: done
    summary: "Stats: a proposal that left its light lane gets minimum 5, ahead of the legacy rule of 4; suite, lint, typecheck pass"
    verdict: null
    assumed: []
    duration_s: 949
  - at: 2026-11-01T14:07:38.823Z
    role: reviewer
    result: done
    summary: "Approved: stats fallback fixed, legacy minimum preserved, and first-stage lane sampling covered"
    verdict: approve
    findings:
      - cites: [pipeline.TicketStats.minimum, PIP-020/R2, PIP-020/S7]
        text: "Follow-up: spec/modules/pipeline/contracts.md:403 still documents only the old minimum calculation. Align the description with minimum 3 while light and 5 after departure; the implementation and regression test now handle these correctly."
        class: C9
      - cites: [PIP-012/S30, PIP-021/R3, PIP-021/S7]
        text: "Follow-up: src/core/brief.ts:308-309 matches the approved wording but says the implementer never runs and requesting full runs every stage. Qualify the spec and brief for unmarked reviewer findings, which can run an implementer while light, and widening, which resumes from the recorded role."
        class: C9
      - cites: [PIP-021/R2, PIP-021/S8, INV-013]
        text: "Follow-up: correct the spec-writer's C3 checklist claim that edits during a stage change nothing. Before the first record, advance samples the edited frontmatter lane. The new test at tests/cli/ticket-lanes.test.ts:408 now verifies this sampling, consistent guards and recording, and immunity to later edits; only the wording follow-up remains."
        class: C3
    assumed: []
    duration_s: 112
---
Self-hosting findings P40 and P62 (docs/SELF-HOSTING.md). Every proposal runs spec-writer, spec-review, tester, implementer and reviewer. Two kinds of tickets spend stages with nothing to do: (1) a ticket that only aligns scenario text with behaviour the code already has (PROP-073): no test can fail first, so the tester and implementer have nothing to change; (2) a test-only fix (PROP-090): spec review and the implementer have nothing to review or change. The person decided (2026-11-01) that small tickets should get a lighter pipeline. Let a ticket declare its lane in its frontmatter, so the stage order skips the empty stages, with checks that keep it honest: lint or the gate refuses a lane whose ticket shape doesn't fit, and a stage that turns out to need a skipped stage can still send the ticket back to the full lane. The reviewer always runs. Keep INV-002 (nothing merges untested): a text-only ticket's existing tests must still cover the scenarios it changes. Decide the field name, the allowed lanes and the fallback in the spec.
