---
id: PROP-081
type: proposal
title: Before its spec stage, a ticket's footprint is its touches, not a guess through widely read members
status: done
stage: null
touches: [PIP-011]
violates: []
depends_on: []
changed: [PIP-002, PIP-002/R2, PIP-002/S32, PIP-002/S33, PIP-007, PIP-007/R10, PIP-007/S22, TKT-011, TKT-011/R2, TKT-011/R9, TKT-011/R10, TKT-011/S1, TKT-011/S18, TKT-011/S22, TKT-011/S25, TKT-011/S26]
questions:
  - id: Q1
    kind: blocker
    text: "tests: true. TKT-011/S1, S18, S26 and tests/core/plan.test.ts (plus tests/core/__snapshots__/chat-mini.plan.txt) expect PROP-202 and PROP-205 in wave 3 after PROP-201 only, with BUG-301 and the three tasks in wave 1. R5 (earliest wave in which nothing the ticket conflicts with runs) cannot give that: with no widening, PROP-202 and PROP-205 conflict only with PROP-201, which is in wave 2, so they take wave 1, like TASK-101, which also conflicts only with PROP-201 and is expected in wave 1. The code gives now = BUG-301, PROP-202, PROP-205, TASK-101, TASK-102, TASK-103, and PROP-201 in wave 2 after six tickets. Either S1/S18/S26 and the snapshot are rederived from R5, or R5 states a rule that holds a proposal after the conflicting proposal ahead of it."
    default: null
    cites: [TKT-011/S1, TKT-011/S18, TKT-011/S26, TKT-011/R5, TKT-011/R9]
    answer: "Spec: the spec-writer rederives TKT-011/S1, S18, S26 from R5 by running the implementer's plan logic (stash 'PROP-081 implementer: blocked', or describe it): with no widening, PROP-202, PROP-205 and the tasks take wave 1 and PROP-201 wave 2. Then the tester updates the snapshot and Q3."
    raised_by: implementer
  - id: Q2
    kind: blocker
    text: "tests: true. TKT-011/S22 (tests/core/plan-scenarios.test.ts) cannot pass: (a) it expects now to be PROP-950, TASK-950, PROP-951, but now is sorted by wave and then ID (PROP-950, PROP-951, TASK-950); (b) with the spec-writer stage recorded and conversation.Message.content in changed, the gate gives PROP-950 a scope_gap (CNV-001 writes conversation.Message.content: add it to touches), so PROP-950 goes under Needs a person and is in neither now nor later, and its reach is never compared. The data needs CNV-001 in scope, or the gate must not apply here."
    default: null
    cites: [TKT-011/S22, TKT-011/R9]
    answer: "Spec: the spec-writer fixes TKT-011/S22's data (CNV-001 in scope or no scope gap) and its expected now order (wave, then ID)."
    raised_by: implementer
  - id: Q3
    kind: blocker
    text: "tests: true. PIP-007/S22 (tests/cli/report-number-collision.test.ts) never records PROP-202's spec stage: scene() does text.replace('history: []\\n', ...) but fixtures/chat-mini/tickets/PROP-202.md has no `history:` line, so the replace does nothing and PROP-202 has no history. The same test with the history inserted before `questions:` passes against this code (all six cases, including the unrecorded and merged ones). Its changes are kept in git stash \"PROP-081 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites: [PIP-007/S22, PIP-007/R10]
    answer: "Tests: the tester inserts PROP-202's history so its spec stage is recorded (the fixture has no history: line)."
    raised_by: implementer
  - id: Q4
    kind: blocker
    text: 'git stash "PROP-081 implementer: blocked" does not apply to ticket/PROP-081: it conflicts in .spec/bin/spec.cjs. A person must apply it by hand (git stash list names it), then answer to resume.'
    default: null
    cites: []
    answer: "Restored by hand: the stash now holds only the six source files; the pinned bundle is rebuilt after it applies."
    raised_by: implementer
  - id: Q5
    kind: blocker
    text: "tests: true. TKT-011/S1 (tests/core/plan-scenarios.test.ts) and the plan.test.ts 'the fixture' test compare spec plan's output with tests/core/__snapshots__/chat-mini.plan.txt, which now ends after the last line with one newline. renderPlan has always ended with a blank line (output ends '\\n\\n'; src/core/plan.ts renderPlan is the same as on main, and main's snapshot ended '\\n\\n'), and the S1 block in the spec shows that blank line before its closing fence. The tester dropped the blank line from the snapshot; restore it. Everything else in the output matches."
    default: null
    cites: [TKT-011/S1]
    answer: "Yes: the tester restores the snapshot's trailing blank line."
    raised_by: implementer
  - id: Q6
    kind: blocker
    text: "tests: true. TKT-011/S22 (tests/core/plan-scenarios.test.ts line 293): after PROP-950's spec stage is recorded with conversation.Message.content in changed, the gate gives PROP-950 scope_gap 'CNV-002 writes conversation.Message.content: add it to touches', because in the fixture CNV-002 writes that member (it does not read it, as the scenario's Given says). PROP-950 then goes under Needs a person: now is PROP-951, TASK-950, later is empty. The code is right: the gate's scope-gap rule is unchanged and PROP-950 touches CNV-001 and CNV-003 only. Adding CNV-002 to PROP-950's touches would make PROP-951 (touches CNV-002) conflict with it by R3 before the spec stage, so the scenario's 'now' of all three before the stage would fail. S22 needs data where the feature PROP-951 touches only reads the changed member, or a member no other feature writes. Its changes are kept in git stash \"PROP-081 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites: [TKT-011/S22, TKT-011/R9]
    answer: "Yes: the tester builds S22's data so CNV-002 only reads conversation.Message.content, as the scenario's Given says."
    raised_by: implementer
  - id: Q7
    kind: blocker
    text: "tests: true. TKT-011/S22 (tests/core/plan-scenarios.test.ts:300): after PROP-950's spec stage, the plan puts PROP-950 under blocked with 'scope_gap PRV-001: PRV-001 writes conversation.Message.content: add it to touches'. The test overrides CNV-002 to only read the member, but in chat-mini PRV-001 writes it too. Make PRV-001 only read conversation.Message.content in the test's spec as well, or otherwise leave CNV-001 as the only writer outside PROP-950's touches, so the gate finds no scope gap. Its changes are kept in git stash \"PROP-081 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites: [TKT-011/S22]
    answer: "Yes: the tester makes PRV-001 only read conversation.Message.content in the S22 test spec."
    raised_by: implementer
history:
  - at: 2026-10-31T21:48:10.837Z
    role: spec-writer
    result: done
    summary: Footprint before spec stage is touches; no hold for later starters; check-report refuses numbers another spec stage took
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-002/S15, TKT-011/S2, TKT-011/S3, TKT-011/S26, PIP-002/S33]
        reason: spec impact on TKT-011 and PIP-002 reaches neighbours only through unchanged contracts (tickets.UnknownTicket, pipeline.StartStage, pipeline.StageRefused); spec next shares the start check and is covered in PIP-002/S33
      - item: C2
        outcome: na
        ids: []
        reason: no paths, install layouts or platforms are involved; a ticket with an older recorded spec-writer stage keeps today's footprint (touches plus changed)
      - item: C3
        outcome: scenarios
        ids: [PIP-002/S32, PIP-002/S26, PIP-007/S22]
        reason: while PROP-201 runs its spec-writer stage, TASK-101 (started first) starts its reviewer stage; two starts of one ticket stay serialized by the lock; while PROP-077's recorded spec stage is unmerged, a second spec stage taking its numbers is refused, and one still running unrecorded is not compared (the second to report is refused)
      - item: C4
        outcome: scenarios
        ids: [PIP-008/S8, LNT-018/S1, TKT-011/S22]
        reason: touches is written by the project's own ticket author; an under-declared touches is corrected once the spec stage is recorded, since changed is read from the tree, and a number two branches both took is L035 before merge
      - item: C5
        outcome: scenarios
        ids: [TKT-011/S15, TKT-011/S16, PIP-002/S10]
        reason: unknown tickets are still refused or reported; nothing new is read from outside
      - item: C6
        outcome: scenarios
        ids: [TKT-011/S2, TKT-011/S3, TKT-011/S6, TKT-011/S7, TKT-011/S20, PIP-002/S15]
        reason: reach through touched contracts, both add to, both change, depends_on, in-flight ordering and refusing a conflicting first start are unchanged
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool or service
    assumed:
      - new: The ticket touches PIP-011 (test-name matching), which holds none of this behaviour. Edit PIP-011, or the features that own it?
        value: Changed TKT-011 (spec plan footprint, R9) and PIP-002 (start check, R2); PIP-011 is left as it is and is not in changed
      - new: Which of two running tickets started first?
        value: The one whose first stage started earlier; a ticket starting its first stage started after every running ticket (PIP-002/R2)
      - new: Does 'until its spec stage is done' mean a recorded spec-writer stage of any result, as today's R9 does?
        value: Yes, a recorded spec-writer stage, as today
      - new: "Number collisions between running spec stages: refuse at check-report, or list taken numbers in the brief?"
        value: Refuse at check-report (PIP-007/R10), the simpler of the two. It refuses only an added scenario or rule number that another in-flight ticket's recorded spec stage also added with different text, not any change to the same feature, so taking later numbers clears it as the refusal says
      - new: How does the plan treat widely used members now that nothing widens before the spec stage?
        value: R10 stays only for grouping (R11); TKT-011/S25 now shows it there, and its touched-never-left-out sentence is dropped
    duration_s: 762
  - at: 2026-10-31T21:51:08.237Z
    role: spec-review
    result: done
    summary: "Approved: declared conflicts remain ordered and late conflicts retain report and merge safeguards"
    verdict: approve
    assumed: []
    duration_s: 174
  - at: 2026-10-31T22:08:12.468Z
    role: tester
    result: done
    summary: Tests for the seven changed scenarios; seven existing tests of the replaced "may reach" and wave behaviour updated; they fail on the current code
    verdict: null
    mutations:
      - scenario: TKT-011/S1
        wrong: still widens a proposal before its spec stage through the contracts its features read, so PROP-202 and PROP-205 list tasks and each other with 'may reach' reasons and sit in waves 3 and 4
      - scenario: TKT-011/S22
        wrong: before its spec stage a proposal that touches CNV-003 still reaches CNV-001 through conversation.Message.content, so TASK-950 and PROP-951 wait after PROP-950; or the widening is dropped after the spec stage too, so TASK-950 starts with PROP-950 although PROP-950 changed conversation.Message.content
      - scenario: TKT-011/S25
        wrong: counts the touched features' reads (out.Result.code) as a footprint even when widely used by 12 of 40 features, or never skips a widely used contract when grouping, so PROP-960 holds PROP-961 back, or the two are grouped on out.Result at 12 of 40 readers and are not grouped at 9 readers or 130 features
      - scenario: PIP-002/S32
        wrong: keeps refusing a running ticket's later stage because a conflicting ticket is running, whichever started first, so TASK-101 reviewer is refused while PROP-201 runs; or drops the check altogether so PROP-201 spec-review starts while TASK-101 runs
      - scenario: PIP-002/S33
        wrong: the start check and spec next still use the widened footprint, so PROP-205 must wait for TASK-102; or it also drops the 'both add to SET-001' rule, so a second proposal on SET-001 starts beside PROP-202
      - scenario: PIP-007/S22
        wrong: does not compare with another ticket's recorded spec stage; or compares with a stage that is running but not recorded or a branch already merged; or refuses a scenario both branches added with the same title and steps; or refuses later numbers; or reports the rule without the scenario, or names a different feature or ticket in the message
    assumed:
      - new: How is the order of two running tickets' first stages known when PIP-002/R2 compares them?
        value: Tests give the earlier ticket a history entry whose at minus duration_s is its first stage start, and the later ticket is started through the CLI with an explicit now, so the stage-start record and the history agree. The spec does not name the source
    duration_s: 1022
  - at: 2026-10-31T22:31:40.957Z
    role: implementer
    result: blocked
    summary: Code done for R9, PIP-002/R2, PIP-007/R10; 6 tests fail on wave order, a scope gap and a fixture, not on the code
    verdict: null
    assumed:
      - new: TKT-011/R9 says the footprint adds `changed` only for a proposal with a recorded spec-writer stage. Do bugs and tasks keep `changed` in their footprint?
        value: Yes. Only a proposal without a recorded spec-writer stage drops `changed`; bugs and tasks are as before
      - new: PIP-002/R2 when the first-stage start of the running ticket is unknown, or two start at the same instant
        value: A running ticket with no history and no stage-start record counts as the earliest and so holds others back, as before. A tie goes to the lower ticket ID
    duration_s: 1407
  - at: 2026-10-31T22:31:50.485Z
    role: spec-writer
    result: reopened
    summary: reopened by PROP-081#Q1
    verdict: null
    assumed: []
  - at: 2026-10-31T22:33:50.374Z
    role: spec-writer
    result: done
    summary: TKT-011 S1/S18 rederived from R5 (props wave 1, PROP-201 wave 2 after six); S22 data and now order fixed
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-002/S15, TKT-011/S2, TKT-011/S3, TKT-011/S26, PIP-002/S33]
        reason: spec impact on TKT-011 and PIP-002 reaches neighbours only through unchanged contracts (tickets.UnknownTicket, pipeline.StartStage, pipeline.StageRefused); spec next shares the start check and is covered in PIP-002/S33
      - item: C2
        outcome: na
        ids: []
        reason: no paths, install layouts or platforms are involved; a ticket with an older recorded spec-writer stage keeps today's footprint (touches plus changed)
      - item: C3
        outcome: scenarios
        ids: [PIP-002/S32, PIP-002/S26, PIP-007/S22]
        reason: while PROP-201 runs its spec-writer stage, TASK-101 (started first) starts its reviewer stage; two starts of one ticket stay serialized by the lock; while PROP-077's recorded spec stage is unmerged, a second spec stage taking its numbers is refused
      - item: C4
        outcome: scenarios
        ids: [PIP-008/S8, LNT-018/S1, TKT-011/S22]
        reason: touches is written by the project's own ticket author; an under-declared touches is corrected once the spec stage is recorded, since changed is read from the tree, and a number two branches both took is L035 before merge
      - item: C5
        outcome: scenarios
        ids: [TKT-011/S15, TKT-011/S16, PIP-002/S10]
        reason: unknown tickets are still refused or reported; nothing new is read from outside
      - item: C6
        outcome: scenarios
        ids: [TKT-011/S2, TKT-011/S3, TKT-011/S6, TKT-011/S7, TKT-011/S20, PIP-002/S15]
        reason: reach through touched contracts, both add to, both change, depends_on, in-flight ordering and refusing a conflicting first start are unchanged
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool or service
    assumed:
      - new: Where do the expected plan text and JSON of TKT-011/S1, S18 and S26 come from (Q1)?
        value: "S1, S18 and S26 copy the text and JSON that the implementer's code (stash 'PROP-081 implementer: blocked', applied in a scratch worktree, since deleted) printed for spec plan on the chat-mini fixture: now = BUG-301, PROP-202, PROP-205, TASK-101, TASK-102, TASK-103; PROP-201 in wave 2 after those six. S26 already matched that output and is unchanged"
      - new: How should TKT-011/S22's data avoid the scope gap, and in what order is now listed (Q2)?
        value: "S22: PROP-950 now touches CNV-001 (the writer of conversation.Message.content) as well as CNV-003, so recording that change gives no scope gap; PROP-951 moves to CNV-002, a reader, so it does not share a touched feature with PROP-950; now is listed in wave and then ID order: PROP-950, PROP-951, TASK-950. Not run against code: S22's spec is built by the test"
    duration_s: 118
  - at: 2026-10-31T22:36:19.384Z
    role: spec-review
    result: done
    summary: Approved corrected first-fit outputs; recorded unmerged stages retain priority over unstarted tickets
    verdict: approve
    findings:
      - cites: [TKT-011/S1, TKT-011/R5]
        text: "Follow-up: S1 says PROP-202 and PROP-205 are 'asked before it by ID', but ID order places PROP-201 first. They take wave 1 by first-fit backfilling around PROP-201 in wave 2. Correct that explanatory clause; the pinned waves and six after entries are correct."
        class: C9
    assumed: []
    duration_s: 147
  - at: 2026-10-31T22:41:59.152Z
    role: tester
    result: done
    summary: S1, S18, S22, S26 and plan.test.ts follow the new spec text (six in Start now, PROP-201 alone in wave 2 after six); S22 data and order updated; PIP-007/S22 fixture records PROP-202's stage; they fail on assertions
    verdict: null
    mutations:
      - scenario: TKT-011/S1
        wrong: still widens a proposal before its spec stage through the contracts its features read, so PROP-202 and PROP-205 list tasks and each other with 'may reach' reasons and sit in waves 3 and 4
      - scenario: TKT-011/S18
        wrong: holds PROP-202 and PROP-205 back in later with a wave after PROP-201 instead of leaving them in now at wave 1 with no after items, or lists only four after items for PROP-201 and leaves out PROP-202 and PROP-205
      - scenario: TKT-011/S22
        wrong: before its spec stage a proposal that touches CNV-001 and CNV-003 still reaches CNV-002 through conversation.Message.content, so PROP-951 waits after PROP-950; or the widening is dropped after the spec stage too, so TASK-950 and PROP-951 start with PROP-950 although PROP-950 changed conversation.Message.content
      - scenario: TKT-011/S25
        wrong: counts the touched features' reads (out.Result.code) as a footprint even when widely used by 12 of 40 features, or never skips a widely used contract when grouping, so PROP-960 holds PROP-961 back, or the two are grouped on out.Result at 12 of 40 readers and are not grouped at 9 readers or 130 features
      - scenario: TKT-011/S26
        wrong: changes a wave or an after line when it groups tickets, so PROP-202 or PROP-205 leaves Start now for Later, or groups PROP-205 or BUG-301, or puts the Could run together section before Later
      - scenario: PIP-002/S32
        wrong: keeps refusing a running ticket's later stage because a conflicting ticket is running, whichever started first, so TASK-101 reviewer is refused while PROP-201 runs; or drops the check altogether so PROP-201 spec-review starts while TASK-101 runs
      - scenario: PIP-002/S33
        wrong: the start check and spec next still use the widened footprint, so PROP-205 must wait for TASK-102; or it also drops the 'both add to SET-001' rule, so a second proposal on SET-001 starts beside PROP-202
      - scenario: PIP-007/S22
        wrong: does not compare with another ticket's recorded spec stage; or compares with a stage that is running but not recorded or a branch already merged; or refuses a scenario both branches added with the same title and steps; or refuses later numbers; or reports the rule without the scenario, or names a different feature or ticket in the message
    assumed:
      - new: How is the order of two running tickets' first stages known when PIP-002/R2 compares them?
        value: Tests give the earlier ticket a history entry whose at minus duration_s is its first stage start, and the later ticket is started through the CLI with an explicit now, so the stage-start record and the history agree. The spec does not name the source
    duration_s: 338
  - at: 2026-10-31T22:54:23.917Z
    role: implementer
    result: blocked
    summary: Code unchanged and right; 3 tests fail on a dropped trailing blank line in the snapshot and on S22 data with a scope gap
    verdict: null
    assumed: []
    duration_s: 523
  - at: 2026-10-31T22:54:25.779Z
    role: tester
    result: reopened
    summary: reopened by PROP-081#Q6
    verdict: null
    assumed: []
  - at: 2026-10-31T22:58:55.418Z
    role: tester
    result: done
    summary: The plan snapshot ends with its blank line again, and the S22 test builds its spec with CNV-002 only reading conversation.Message.content, so the gate finds no scope gap after PROP-950's spec stage
    verdict: null
    mutations:
      - scenario: TKT-011/S1
        wrong: still widens a proposal before its spec stage through the contracts its features read, so PROP-202 and PROP-205 list tasks and each other with 'may reach' reasons and sit in waves 3 and 4
      - scenario: TKT-011/S18
        wrong: holds PROP-202 and PROP-205 back in later with a wave after PROP-201 instead of leaving them in now at wave 1 with no after items, or lists only four after items for PROP-201 and leaves out PROP-202 and PROP-205
      - scenario: TKT-011/S22
        wrong: before its spec stage a proposal that touches CNV-001 and CNV-003 still reaches CNV-002 through conversation.Message.content, so PROP-951 waits after PROP-950; or the widening is dropped after the spec stage too, so TASK-950 and PROP-951 start with PROP-950 although PROP-950 changed conversation.Message.content
      - scenario: TKT-011/S25
        wrong: counts the touched features' reads (out.Result.code) as a footprint even when widely used by 12 of 40 features, or never skips a widely used contract when grouping, so PROP-960 holds PROP-961 back, or the two are grouped on out.Result at 12 of 40 readers and are not grouped at 9 readers or 130 features
      - scenario: TKT-011/S26
        wrong: changes a wave or an after line when it groups tickets, so PROP-202 or PROP-205 leaves Start now for Later, or groups PROP-205 or BUG-301, or puts the Could run together section before Later
      - scenario: PIP-002/S32
        wrong: keeps refusing a running ticket's later stage because a conflicting ticket is running, whichever started first, so TASK-101 reviewer is refused while PROP-201 runs; or drops the check altogether so PROP-201 spec-review starts while TASK-101 runs
      - scenario: PIP-002/S33
        wrong: the start check and spec next still use the widened footprint, so PROP-205 must wait for TASK-102; or it also drops the 'both add to SET-001' rule, so a second proposal on SET-001 starts beside PROP-202
      - scenario: PIP-007/S22
        wrong: does not compare with another ticket's recorded spec stage; or compares with a stage that is running but not recorded or a branch already merged; or refuses a scenario both branches added with the same title and steps; or refuses later numbers; or reports the rule without the scenario, or names a different feature or ticket in the message
    assumed:
      - new: How is the order of two running tickets' first stages known when PIP-002/R2 compares them?
        value: Tests give the earlier ticket a history entry whose at minus duration_s is its first stage start, and the later ticket is started through the CLI with an explicit now, so the stage-start record and the history agree. The spec does not name the source
    duration_s: 269
  - at: 2026-10-31T23:02:59.183Z
    role: implementer
    result: blocked
    summary: Code unchanged; 1777 of 1778 pass; S22 test data still gives PROP-950 a scope gap through PRV-001
    verdict: null
    assumed: []
    duration_s: 241
  - at: 2026-10-31T23:03:00.609Z
    role: tester
    result: reopened
    summary: reopened by PROP-081#Q7
    verdict: null
    assumed: []
  - at: 2026-10-31T23:07:36.891Z
    role: tester
    result: done
    summary: The S22 test also makes PRV-001 only read conversation.Message.content, so the gate finds no scope gap after PROP-950's spec stage
    verdict: null
    mutations:
      - scenario: TKT-011/S1
        wrong: still widens a proposal before its spec stage through the contracts its features read, so PROP-202 and PROP-205 list tasks and each other with 'may reach' reasons and sit in waves 3 and 4
      - scenario: TKT-011/S18
        wrong: holds PROP-202 and PROP-205 back in later with a wave after PROP-201 instead of leaving them in now at wave 1 with no after items, or lists only four after items for PROP-201 and leaves out PROP-202 and PROP-205
      - scenario: TKT-011/S22
        wrong: before its spec stage a proposal that touches CNV-001 and CNV-003 still reaches CNV-002 through conversation.Message.content, so PROP-951 waits after PROP-950; or the widening is dropped after the spec stage too, so TASK-950 and PROP-951 start with PROP-950 although PROP-950 changed conversation.Message.content
      - scenario: TKT-011/S25
        wrong: counts the touched features' reads (out.Result.code) as a footprint even when widely used by 12 of 40 features, or never skips a widely used contract when grouping, so PROP-960 holds PROP-961 back, or the two are grouped on out.Result at 12 of 40 readers and are not grouped at 9 readers or 130 features
      - scenario: TKT-011/S26
        wrong: changes a wave or an after line when it groups tickets, so PROP-202 or PROP-205 leaves Start now for Later, or groups PROP-205 or BUG-301, or puts the Could run together section before Later
      - scenario: PIP-002/S32
        wrong: keeps refusing a running ticket's later stage because a conflicting ticket is running, whichever started first, so TASK-101 reviewer is refused while PROP-201 runs; or drops the check altogether so PROP-201 spec-review starts while TASK-101 runs
      - scenario: PIP-002/S33
        wrong: the start check and spec next still use the widened footprint, so PROP-205 must wait for TASK-102; or it also drops the 'both add to SET-001' rule, so a second proposal on SET-001 starts beside PROP-202
      - scenario: PIP-007/S22
        wrong: does not compare with another ticket's recorded spec stage; or compares with a stage that is running but not recorded or a branch already merged; or refuses a scenario both branches added with the same title and steps; or refuses later numbers; or reports the rule without the scenario, or names a different feature or ticket in the message
    assumed:
      - new: How is the order of two running tickets' first stages known when PIP-002/R2 compares them?
        value: Tests give the earlier ticket a history entry whose at minus duration_s is its first stage start, and the later ticket is started through the CLI with an explicit now, so the stage-start record and the history agree. The spec does not name the source
    duration_s: 275
  - at: 2026-10-31T23:14:44.444Z
    role: implementer
    result: done
    summary: Footprint before the spec stage is touches; no hold for later starters; check-report refuses numbers another spec stage took; 1778 tests pass
    verdict: null
    assumed:
      - new: TKT-011/R9 says the footprint adds `changed` only for a proposal with a recorded spec-writer stage. Do bugs and tasks keep `changed` in their footprint?
        value: Yes. Only a proposal without a recorded spec-writer stage drops `changed`; bugs and tasks are as before
      - new: PIP-002/R2 when the first-stage start of the running ticket is unknown, or two start at the same instant
        value: A running ticket with no history and no stage-start record counts as the earliest and so holds others back, as before. A tie goes to the lower ticket ID
    duration_s: 425
  - at: 2026-10-31T23:19:19.468Z
    role: reviewer
    result: done
    summary: Approved footprints, first-start ordering and spec-number guard; real-repo plan has no may-reach holds
    verdict: approve
    assumed: []
    duration_s: 273
---
Measured on this repo (SELF-HOSTING P36, P51). Before a ticket's spec stage, `spec plan` and the start check guess its reach through every contract member its touched features read. tickets.Ticket.status, format.Config.generated, format.Config.baseBranch and pipeline.StageRecord are read almost everywhere, so nearly every pair of tickets 'may reach' each other. On 2026-10-31 such guesses held PROP-064 (mid-pipeline) behind PROP-071, which started after it. They held PROP-068, PROP-076, PROP-078, PROP-079 and PROP-080 at various points, and they serialized the queue to one ticket at a time for hours, with no real conflict found afterwards. Collisions between scenario and rule numbers are what actually needs preventing, and two rules already cover them: 'both add to X' on the touched features, and L035 on merge. Change: until its spec stage is done, a ticket's footprint is the features in its `touches` (plus its depends_on). After the spec stage, it is the features its spec change actually changed, as today. A running ticket is never refused a later stage because of a ticket that started after it (P36).
