---
id: PROP-116
type: proposal
title: A small proposal can run its tests and code in one build stage, with test first proved by the check
status: done
stage: null
touches: [PIP-021, PIP-001, PIP-006]
violates: []
depends_on: []
changed: [INS-020/S24, INV-003, INV-004, INV-013, PIP-001, PIP-001/R2, PIP-001/R9, PIP-001/S35, PIP-002/R4, PIP-002/S19, PIP-004/R9, PIP-004/S23, PIP-005/R1, PIP-005/S14, PIP-006, PIP-006/R9, PIP-006/S26, PIP-008/R9, PIP-008/S10, PIP-012/S30, PIP-014/R5, PIP-014/S10, PIP-017/R18, PIP-017/S22, PIP-019/R1, PIP-019/R4, PIP-019/R5, PIP-019/S4, PIP-019/S6, PIP-020/R2, PIP-020/S7, PIP-021, PIP-021/R1, PIP-021/R2, PIP-021/R3, PIP-021/R9, PIP-021/R10, PIP-021/R11, PIP-021/R12, PIP-021/S6, PIP-021/S9, PIP-021/S10, PIP-021/S11, PIP-021/S12, PIP-021/S13, PIP-021/S14, PIP-021/S15, PIP-021/S16, PIP-022/R1, PIP-022/S3, PIP-024, PIP-024/R1, PIP-024/R2, PIP-024/R3, PIP-024/R4, PIP-024/R5, PIP-024/R6, PIP-024/S1, PIP-024/S2, PIP-024/S3, PIP-024/S4, PIP-024/S5, PIP-024/S6, PIP-024/S7, PIP-024/S8, PIP-024/S9, PIP-024/S10, PIP-024/S11, PIP-024/S12, PIP-024/S13, PIP-024/S14, TKT-001/R14, TKT-001/S31, TKT-001/S32, TKT-001/S33, TKT-012/R12, TKT-012/S12, pipeline.Advanced, pipeline.Advanced.stash, pipeline.Blocker, pipeline.Blocker.tests, pipeline.Report, pipeline.Report.mutations, pipeline.Role, pipeline.StageRecord, pipeline.StageRecord.lane, pipeline.StageRecord.mutations, pipeline.TicketStats, pipeline.TicketStats.minimum, tickets.CloseResult, tickets.CloseResult.stashes, tickets.KeptStash, tickets.KeptStash.name, tickets.Lane]
questions:
  - id: Q1
    kind: preference
    text: Which role runs the build stage?
    default: The implementer, which in this lane may also change test files; no new role, prompt or delegation key
    cites: [PIP-021]
    answer: null
    raised_by: null
  - id: Q2
    kind: preference
    text: What is the lane called in the ticket's frontmatter?
    default: build
    cites: [PIP-021]
    answer: null
    raised_by: null
  - id: Q3
    kind: preference
    text: May a bug ticket use the lane too?
    default: "No: light lanes stay for proposals only, as PIP-021 says"
    cites: [PIP-021]
    answer: null
    raised_by: null
history:
  - at: 2026-11-23T14:31:31.119Z
    role: spec-writer
    result: done
    summary: "Add the build lane: the implementer writes tests and code in one stage, proved test first by the CLI's proof run"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-001/S35, PIP-002/S19, PIP-004/S23, PIP-005/S14, PIP-008/S21, PIP-012/S30, PIP-014/S10, PIP-017/S22, PIP-019/S6, PIP-020/S7, PIP-022/S3, INS-020/S24, TKT-001/S31, TKT-012/S12, PIP-025/S1, WSP-009/S5]
        reason: spec impact reaches PIP-008/S21, PIP-025/S1, S3, S7 and WSP-009/S3, S5, S6, S7 through StageRefused, whose form does not change; none needs to change. Each other neighbour the lane meets is changed with it
      - item: C2
        outcome: scenarios
        ids: [PIP-021/S9, PIP-017/S22, TKT-001/S33]
        reason: older histories keep the full order; an older role prompt is covered by the brief and the form; a CLI refuses a lane it does not know (TKT-001/R14); the proof tree is set up by worktreeSetup
      - item: C3
        outcome: scenarios
        ids: [PIP-024/S8, PIP-024/S11, PIP-024/S12, PIP-021/S13, INS-020/S24]
        reason: concurrent checks, base merges between builds, changes before reuse, a restart, and two deliveries of one report
      - item: C4
        outcome: invariant
        ids: [INV-003, INV-004, INV-013]
        reason: a person sets the lane; git and the CLI's own runs decide test first; a forged test is left to the reviewer, stated as the cost
      - item: C5
        outcome: scenarios
        ids: [PIP-024/S3, PIP-024/S4, PIP-024/S5, PIP-024/S10, PIP-024/S13, PIP-021/S14, TKT-001/S33]
      - item: C6
        outcome: scenarios
        ids: [PIP-024/S14, PIP-001/S34, PIP-005/S5, PIP-006/S26, PIP-019/S3, PIP-021/S1, PIP-021/S2, PIP-017/S22]
      - item: C8
        outcome: na
        ids: []
        reason: "no new fact about another tool or service: failure kinds are those PIP-010 already reads and the hook events those INS-020 already uses"
    assumed:
      - question: PROP-116#Q1
        value: The implementer, which in this lane may also change test files; no new role, prompt or delegation key
      - question: PROP-116#Q2
        value: build
      - question: PROP-116#Q3
        value: "No: light lanes stay for proposals only, as PIP-021 says"
      - new: Which tree is 'the tree as it was before the stage' on a second build stage?
        value: "Every build stage is proved, on its tree with everything outside testGlobs, the spec and tickets folders as at the merge base: the code before the first build stage plus what the base brought (PIP-024/R2)"
      - new: Is a failing test with no failure kind accepted as failing on an assertion?
        value: "No: it is refused, since the ticket asks for an assertion and the CLI cannot see one (PIP-024/R3); PIP-006/R8 stays as it is for testers"
      - new: What happens to a build stage's work when it asks for the full lane?
        value: "It is stashed as '<ID> build: blocked', which no full-lane stage restores, and the tester runs next, held to test first; a done report raises no question (PIP-021/R10, R11)"
      - new: May a build stage hand a wrong test to the tester?
        value: "No: tests: true is refused there, as the stage fixes its own tests (PIP-021/R12)"
      - new: Is the proof run repeated by ticket advance after check-report made it?
        value: "No: it is kept and reused like the whole-tree run, on the same trees only (PIP-024/R6)"
      - new: Minimum stages for spec stats in the build lane?
        value: "4"
    duration_s: 510
    model: claude
  - at: 2026-11-23T14:35:57.798Z
    role: spec-review
    result: done
    summary: "Approve: the build lane keeps test first through the CLI's proof run, the neighbours stay true, and what is left is follow-ups"
    verdict: approve
    findings:
      - cites: [INS-020/S24, INS-020/R12, PIP-024/R4]
        text: "Follow-up: a build stage's check now makes two full test runs (the whole tree, then the proof run), each with its own 10-minute limit (PIP-009/R2) and its own wait for a turn, inside one SubagentStop or handback hook whose timeout is 3600 seconds (INS-020/R12). A slow suite under a busy turn queue could pass that timeout, and INS-020/R19 then leaves the stage in progress with nothing recorded. No scenario or rule says the timeout is enough for two runs, or that a timed-out hook after the whole-tree run reuses the kept run on the retry."
        class: C3
      - cites: [PIP-024/R4, PIP-024/S1]
        text: "Follow-up: R4 calls the proof tree a folder of its own outside every worktree, while S1 says 'git worktree list' shows no worktree the check made, so it is unclear whether the proof tree is a registered git worktree. If it is, a check killed outright (SIGKILL) leaves a folder and a registration behind; if it is not, only a folder. No scenario says what the next check or a person sees after such a kill, or that a leftover never reaches a later check or a stage's tree."
        class: C3
      - cites: [PIP-021/S15, PIP-021/R8, PIP-019/R4]
        text: "Follow-up (design): the reviewer is asked to check mutations and mark a weak test finding tests: true, and in the build lane R8 sends every such finding to the full lane (tester, then implementer, then reviewer). The commonest build-lane review finding therefore brings back the tester and implementer round trip that PROP-116 exists to remove. S15 states this on purpose, so it is not a defect of the delta; consider a later ticket that lets a build stage fix a tests-only finding in its own stage."
        class: other
      - cites: [PIP-021/R10, PIP-019/R1, PIP-019/R5]
        text: "Follow-up: R10 says a build stage's lane-full record holds no mutations, and PIP-019/R5 exempts such a report from R1 to R3. Neither says what happens when that done or blocked report does hold mutations: refused, or accepted and dropped. Also R1's body still reads 'a done tester stage' for an earlier round, and only R5's tail 'its done record counts as an earlier round' extends it to a build stage; fold that into R1's wording so a tester reading R1 alone gets it right."
        class: C9
      - cites: [PIP-024/S3, PIP-010/R4]
        text: "Follow-up: S3 pins the problem text with pipeline.TestCase.firstErrorLine, but PIP-010/R4 leaves firstErrorLine out when the report gives no message. No scenario gives the text for a test that fails first by an error with no first line, so a tester could read the pinned sentence two ways."
        class: C9
    assumed: []
    duration_s: 261
    model: claude
  - at: 2026-11-23T15:01:26.575Z
    role: tester
    result: done
    summary: Tests for the build lane, its proof run, give-up, stash and hooks; each fails now on an assertion
    verdict: null
    mutations:
      - scenario: INS-020/S24
        wrong: the hooks record a build stage's done report without the proof run, or count a proof run with no results as a refusal that uses an attempt
      - scenario: PIP-001/S35
        wrong: a blocked or done build-lane implementer record with lane full is followed by the implementer again instead of the tester, or a third reviewer changes does not block
      - scenario: PIP-002/S19
        wrong: "a stage named PROP-215 build: blocked is restored by the full lane's implementer stage, or never restored by a build stage"
      - scenario: PIP-004/S23
        wrong: a blocker marked tests in a build stage is accepted and handed to a tester the lane does not have
      - scenario: PIP-005/S14
        wrong: a build stage's change to a test file is refused as on any proposal, or its change to spec/config.json or a protected file is let through
      - scenario: PIP-006/S26
        wrong: a build stage that gave up its lane counts as the implementer's first stage, so the tester after it may leave every test passing
      - scenario: PIP-008/S10
        wrong: "a refused build stage's changes are stashed as PROP-215 implementer: blocked, or its question says the next implementer stage gets them back"
      - scenario: PIP-012/S30
        wrong: a build-lane proposal's brief carries the full lane's rule, or one that left the lane keeps the build lane's
      - scenario: PIP-014/S10
        wrong: a build stage's brief still says do not change any test file, or leaves out the documented-scenario mark and the removed-scenario lines
      - scenario: PIP-017/S22
        wrong: a build stage's task has no mutations line in its report block, or edits a project's older implementer prompt file
      - scenario: PIP-019/S4
        wrong: the reviewer's prompt takes mutations only from done tester stages and ignores the build lane's implementer stages
      - scenario: PIP-019/S6
        wrong: a build stage is not asked for a wrong implementation per scenario, or a later build stage is asked again for the same scenarios, or the implementer's mutations are not kept in its record
      - scenario: PIP-020/S7
        wrong: a build-lane proposal has the minimum 3 or 5, or one that left the lane still has 4
      - scenario: PIP-021/S6
        wrong: a report with lane build, docs or tests is accepted, or a build-lane spec review cannot move the ticket to the full lane
      - scenario: PIP-021/S9
        wrong: a build-lane proposal runs the tester, or its first record does not keep the lane, or the build stage's commit leaves out the test files
      - scenario: PIP-021/S10
        wrong: a spec review's changes or a reopened spec stage sends a build-lane ticket to the tester after the spec review
      - scenario: PIP-021/S11
        wrong: a done build report with lane full runs the tests, commits the stage's changes, raises a question, or hands the ticket to the implementer instead of the tester
      - scenario: PIP-021/S12
        wrong: a blocked build stage that asks for the full lane runs the implementer again, or its question says the next build stage gets its changes back
      - scenario: PIP-021/S13
        wrong: a blocked build stage's changes are not restored by the next build stage, or a restart or third refusal stashes them under the implementer's name
      - scenario: PIP-021/S14
        wrong: a build stage's blocker marked tests is accepted, or is still refused once the ticket has left the lane
      - scenario: PIP-021/S15
        wrong: a reviewer finding marked tests in the build lane goes back to the implementer, or one marked neither moves the ticket to the tester
      - scenario: PIP-021/S16
        wrong: a later build stage that gives up its lane drops the earlier build stage's commit, or its changes are not stashed
      - scenario: PIP-022/S3
        wrong: a proof run that gives no results refuses the report and counts an attempt, or records the stage
      - scenario: PIP-024/S1
        wrong: the proof tree is a registered worktree or changes the stage's tree, index or stash, or holds the stage's code instead of the code before the build
      - scenario: PIP-024/S2
        wrong: a scenario whose test passes on the code before the build is accepted because another scenario's test fails there, or a skipped test counts as failing
      - scenario: PIP-024/S3
        wrong: a test that fails first by an error counts as failing, so it proves the scenario
      - scenario: PIP-024/S4
        wrong: a failure that does not say whether it is an assertion is accepted as one
      - scenario: PIP-024/S5
        wrong: a scenario with no test in the proof run, because its file did not load, is not refused
      - scenario: PIP-024/S6
        wrong: a documented scenario that fails on the code before the build, or whose only test is skipped, is accepted
      - scenario: PIP-024/S7
        wrong: the proof run is made though the whole-tree checks have a problem, or a whole-tree problem is not reported alone
      - scenario: PIP-024/S8
        wrong: a second build stage is proved against the first build stage's code, or without what main brought
      - scenario: PIP-024/S9
        wrong: a branch that only rewords a scenario still makes the proof run
      - scenario: PIP-024/S10
        wrong: a proof run with no results is read as passing or failing, so advance records or refuses the report instead of failing with exit 3
      - scenario: PIP-024/S11
        wrong: the proof run starts without waiting for its turn, shares a tree with another check, or counts its time limit from the start of the whole-tree run
      - scenario: PIP-024/S12
        wrong: advance runs the whole-tree and proof runs again though nothing changed, or reuses them after a file changed
      - scenario: PIP-024/S13
        wrong: a report whose summary claims every new test failed first is accepted, or a spec-folder change by the stage still makes a proof run
      - scenario: PIP-024/S14
        wrong: an implementer stage of a full-lane proposal, a bug, a task or a docs-lane proposal also makes a proof run
      - scenario: TKT-001/S31
        wrong: a proposal with lane build is refused by the gate or flagged by lint
      - scenario: TKT-001/S32
        wrong: a bug or a task with lane build is let through the gate
      - scenario: TKT-001/S33
        wrong: the fix for an unknown lane does not list build
      - scenario: TKT-012/S12
        wrong: "the close does not keep a stash named PROP-074 build: blocked, or leaves out its kept stash line"
    assumed:
      - new: Where the spec names tests/prv_001.test.ts and src/providers.ts, the tests use chat-mini's tests/PRV-001.test.ts and src/providers/config.ts
        value: the structure of each problem text is pinned, the file names are the fixture's
      - new: PIP-024/S11 checks two simultaneous check-report runs for separate proof trees, not a check-report beside a ticket advance, which would race on the tree it commits
        value: two check-report runs
      - new: PIP-024/S11 takes the turn order after the whole-tree run to be first come first served (the spec's scenario says the holder gets it)
        value: the earlier waiter gets the turn
      - new: "PIP-024/S12 does not test a change of the base branch's tip, of worktreeSetup or an unreadable kept proof run: the kept file's name is not in the spec and the config cannot change inside a stage"
        value: only a changed tracked file is tested
      - new: "PIP-021/S13 reads 'keeps and restores through a stash of that name' of --restart as: the stage's files are still in the tree afterwards and no 'implementer: blocked' stash exists"
        value: no stash pinned after the restart
      - new: PIP-021/S10 and S13 seed the reopened and left-the-lane states as history records and stashes, as the lane tests of PROP-092 seed theirs
        value: seeded records
      - new: "PIP-005/S14 and PIP-006/S26 leave the build lane by a seeded record or by a real give-up report with lane full and no mutations (a report that holds both is not pinned: a spec-review follow-up)"
        value: no mutations beside lane full
      - new: PIP-017/S22 checks that the implementer prompt names the build lane and the writing of tests by pattern, since the scenario gives no exact sentence
        value: pattern match
    duration_s: 1524
    model: claude
  - at: 2026-11-23T15:24:53.204Z
    role: implementer
    result: blocked
    summary: The build lane and its proof run are done; seven build-lane tests contradict their scenarios
    verdict: null
    blockers:
      - text: "The test for PIP-014/S10 removes SET-001/S3 in build-lane-fixture.ts (removeS3) without adding S3 to the feature's retired list, so the fixture's spec-writer report is refused before the brief is read; add retired: [S3]"
        cites: [PIP-014/S10]
        tests: true
      - text: The test for PIP-021/S11 advances the tester on the same tree its check-report just ran on, after changing only proof.json outside the tree, so advance reuses the kept passing run as PIP-008/R12 says; change a file in the tree between the two
        cites: [PIP-021/S11, PIP-008/R12]
        tests: true
      - text: The last part of the test for PIP-021/S14 cites PRV-001/S4 in a plainFixture whose spec does not have it, so the report is refused for the cite (PIP-004/R3); cite a scenario that exists, such as PRV-001/S1
        cites: [PIP-021/S14]
        tests: true
      - text: The TASK-101 part of the test for PIP-004/S23 cites PRV-001/S4 in a plainFixture whose spec does not have it, giving a second problem; cite a scenario that exists, such as PRV-001/S1
        cites: [PIP-004/S23]
        tests: true
      - text: The test for INS-020/S24 (a valid done report) runs spec next, which starts the reviewer's stage, before the second delivery; INS-020/R18 acknowledges only while no stage of the ticket is running, so move spec next after the second delivery
        cites: [INS-020/S24, INS-020/R18]
        tests: true
      - text: The test for PIP-024/S10 reads the could-not-run line from stderr of an advance run with --format json, where the reason is in stdout's problems; the scenario runs advance without --format json, so run it so, for both the no-report and the setup-fail advance
        cites: [PIP-024/S10]
        tests: true
      - text: The test for PIP-022/S3 (the proof run of a build stage) reads the could-not-run line from stderr of an advance run with --format json; run it without, as the scenario does
        cites: [PIP-022/S3]
        tests: true
    assumed:
      - question: PROP-116#Q1
        value: The implementer, which in this lane may also change test files; no new role, prompt or delegation key
      - question: PROP-116#Q2
        value: build
      - question: PROP-116#Q3
        value: "No: light lanes stay for proposals only, as PIP-021 says"
      - new: What if a give-up report (lane full) holds mutations?
        value: It is accepted and they are not recorded
      - new: Does a done give-up report's changed list join the ticket's?
        value: Yes, as for any done stage (PIP-008/R3)
      - new: Which tree is SPEC_MAIN_ROOT in the proof tree's setup?
        value: The repository's primary worktree, which a ticket's worktree is set up from
      - new: Is the proof tree a git checkout?
        value: "No: a plain temporary folder written from a temporary index; its run takes its turn in the stage's repository"
      - new: What if the spec at the merge base cannot be read?
        value: A check that could not run, never nothing to prove
      - new: What is said of a documented scenario with no test in the proof run?
        value: The 'no test of X passes' problem, naming the failed files in parentheses
    duration_s: 1401
    model: claude
  - at: 2026-11-23T15:36:39.732Z
    role: tester
    result: done
    summary: Seven build-lane tests fixed to match their scenarios; full suite 2259 passed, 0 failed, 0 skipped
    verdict: null
    mutations:
      - scenario: PIP-014/S10
        wrong: a build stage's brief still says do not change any test file, or leaves out the documented-scenario mark and the removed-scenario lines
      - scenario: PIP-021/S11
        wrong: a done build report with lane full runs the tests, commits the stage's changes, raises a question, or hands the ticket to the implementer instead of the tester
      - scenario: PIP-021/S14
        wrong: a build stage's blocker marked tests is accepted, or is still refused once the ticket has left the lane
      - scenario: PIP-004/S23
        wrong: a blocker marked tests in a build stage is accepted and handed to a tester the lane does not have
      - scenario: INS-020/S24
        wrong: the hooks record a build stage's done report without the proof run, or count a proof run with no results as a refusal that uses an attempt
      - scenario: PIP-024/S10
        wrong: a proof run with no results is read as passing or failing, so advance records or refuses the report instead of failing with exit 3
      - scenario: PIP-022/S3
        wrong: a proof run that gives no results refuses the report and counts an attempt, or records the stage
    passed: true
    assumed:
      - new: "Blockers 1 to 7 each name a defect of my tests that the scenarios and rules decide: PIP-007/S1 (a removed scenario goes into retired), PIP-008/R12 (advance reuses a kept run of the same tree), PIP-004/R3 (a cite must exist), INS-020/R18 (acknowledged only while no stage runs), and PIP-024/S10 and PIP-022/S3 (advance run without --format json)"
        value: all seven claims accepted, none disputed
    duration_s: 690
    model: claude
  - at: 2026-11-23T15:45:20.428Z
    role: reviewer
    result: done
    summary: Code delivers the build lane and proof run; three tests cannot fail on the reuse, refusal-count and cleanup claims
    verdict: changes
    findings:
      - cites: [PIP-024/S12, PIP-024/R6]
        text: "The only test of S12 changes one tracked file between check and advance. R6 and S12's But-line also make the proof run again after the merge base moves, after format.Config.worktreeSetup changes, and when the kept proof run cannot be read. reusable() in src/io/test-run-store.ts and readTestRun() carry those conditions, but no test fails if either condition were dropped: with `c.base !== now.base || c.worktreeSetup !== now.worktreeSetup` removed, or a corrupt kept proof file reused, tests/cli/build-lane-proof.test.ts still passes. Add cases to S12: main merged into the ticket branch with the tree unchanged (merge base moved), worktreeSetup edited in a way that leaves the tree as it is, and a kept `<ID>.proof.json` that is truncated or holds no tests array, each ending in a second proof run."
        tests: true
        class: C7
      - cites: [PIP-022/S3, PIP-024/S10, PIP-024/R5]
        text: The 'no refusal is counted' check in the PIP-022/S3 build test is `history(c).some(h => h.role === 'implementer')` being false, which the preceding history-length check already implies, so a CLI that bumped the stage's refusal count while still exiting 3 passes. PIP-024/S10's test checks the ticket file, status and history only, not the count. Only the hook test shows the count (attempt 2 after a no-results run). The S3 test also covers two of the four ways a run gives no results (no report, unknown format), not a test command that fails to start or times out. Assert the count (the next refused report is attempt 1 of 3, or the later record has no refusals key) in both tests and add the other two ways to the S3 loop.
        tests: true
        class: C7
      - cites: [PIP-024/R4, PIP-024/S11, PIP-024/S10]
        text: R4 says the proof tree is removed when the check ends. The only test that looks for the folder is S1's normal end (existsSync(proof.dir) is false). The Ctrl-C case in S11 checks that the test command stopped, the turn went and the stage's tree and git are as before, and the worktreeSetup-failure and no-results cases in S10 check nothing about the folder, though proofRun and withInterruptCleanup have separate cleanup code for each. A change that left the folder behind after an interrupt or a failed setup would pass every test. Assert the folder named in the run log is gone in those two cases.
        tests: true
        class: C7
      - cites: [PIP-021/R10, PIP-008/R3, PIP-021/S11]
        text: "Follow-up: a build stage's done report with lane full is recorded as a done stage, so planAdvance adds its `changed` units to the ticket's changed list (PIP-008/R3) although its code is stashed and never committed. R10 says only that it is checked as a blocked report is, whose changed list is not joined; no scenario says which. The tester that follows then has units in scope for work no stage holds. Either state in R10 that a give-up's changed list joins (as the diff does) or leave it out for a give-up; the second matches 'checked as a blocked report is'."
        class: C9
      - cites: [PIP-024/R6, INV-016]
        text: "Follow-up: a kept proof run is read from `<git dir>/spec/test-runs/<ID>.proof.json` and its test rows then decide the problems, as the whole-tree run's file does, so a stage that writes that file with the tree key of its own final tree gets its tests accepted without a proof run. This is no weaker than the whole-tree run's existing trust (PIP-008/R12), but the proof run is now the only guard for test first, so INV-013 could name it next to the forged-test cost."
        class: C4
    assumed: []
    duration_s: 515
    model: claude
  - at: 2026-11-23T15:56:57.988Z
    role: tester
    result: done
    summary: Tests added for proof-run reuse, no-results refusal count and proof folder cleanup; full suite 2265 passed, 0 failed
    verdict: null
    mutations:
      - scenario: PIP-024/S12
        wrong: reusable() drops the merge base or the worktreeSetup comparison, or readTestRun accepts a cut-short kept proof file or one with no tests array, so advance reuses a proof run that no longer holds
      - scenario: PIP-022/S3
        wrong: a proof run that gives no results, whether it writes no report, writes an unknown format, fails to start or times out, bumps the stage's refusal count while still exiting 3, or leaves its proof folder behind
      - scenario: PIP-024/S10
        wrong: a proof run with no report, or a worktreeSetup that fails in the proof tree, raises the refusal count (the next refused report is then attempt 2) or leaves the proof folder behind
      - scenario: PIP-024/S11
        wrong: a check interrupted with Ctrl-C during its proof run stops the test command but leaves the proof folder behind
    assumed:
      - new: "PIP-024/S12: a changed worktreeSetup that leaves the tree as it is is made by marking spec/config.json skip-worktree before editing it, because the tree key sees no tracked file with that mark; a moved merge base is an empty commit on main merged into the ticket branch"
        value: both leave the tree key unchanged
      - new: PIP-022/S3 and PIP-024/S10 advance by --report - to read the refusal count, since only that intake counts attempts; the next refused report must be attempt 1
        value: attempt 1
      - new: "PIP-022/S3: a test command that fails to start or times out is simulated for the proof run alone, through the child_process module, as the existing could-not-run suite does it for a whole run"
        value: ENOENT and ETIMEDOUT reasons
      - new: "PIP-024/S10: the proof folder of a failed worktreeSetup is found from the folder the setup command logged (its cwd), since the run never started"
        value: setup-dirs log
    duration_s: 692
    model: claude
  - at: 2026-11-23T16:01:36.902Z
    role: implementer
    result: done
    summary: "No code change needed: the tester's new tests pass on the committed code, and the bundles match a fresh build"
    verdict: null
    assumed:
      - question: PROP-116#Q1
        value: The implementer, which in this lane may also change test files; no new role, prompt or delegation key
      - question: PROP-116#Q2
        value: build
      - question: PROP-116#Q3
        value: "No: light lanes stay for proposals only, as PIP-021 says"
      - new: Does a done give-up report's changed list join the ticket's (the reviewer's follow-up)?
        value: "Left as it is: it joins, as for any done stage (PIP-008/R3), until the spec says otherwise"
    duration_s: 274
    model: claude
  - at: 2026-11-23T16:09:11.238Z
    role: reviewer
    result: done
    summary: "Approve: the new tests fail for the wrong implementations they name; the three round 1 findings are met"
    verdict: approve
    findings:
      - cites: [PIP-021/R10, PIP-008/R3, PIP-021/S11]
        text: "Follow-up: still open from round 1. A build stage's done report with lane full adds its `changed` units to the ticket's changed list (PIP-008/R3) although its code is stashed and never committed; R10 says only that it is checked as a blocked report is. The implementer left it as it is, so the spec should say which: state that a give-up's changed list joins, or leave it out."
        class: C9
      - cites: [PIP-024/R6, INV-016]
        text: "Follow-up: still open from round 1. A kept proof run is read from `<git dir>/spec/test-runs/<ID>.proof.json` and its test rows decide the problems, as the whole-tree run's file does, so a stage that writes that file with the tree key of its own final tree gets its tests accepted without a proof run. No weaker than PIP-008/R12's existing trust, but INV-013 could name it beside the forged-test cost."
        class: C4
      - cites: [PIP-022/S3]
        text: "Follow-up: the old PIP-022/S3 build test in tests/cli/build-lane-proof.test.ts still ends each way with `history(c).some(h => h.role === 'implementer')` as its 'no refusal is counted' check, which the history-length check above it already implies. The new build-lane-proof-failures.test.ts counts the refusal for real, so the old line only misleads; drop it, or the whole old test."
        class: C7
    assumed: []
    duration_s: 449
    model: claude
---
Review of 2026-11-10. spec stats over all 109 measured tickets: 776 stages for a minimum of 472, 63 blocked, 47 reopened. docs/SELF-HOSTING.md names the dominant churn (P32, P42, and D11, D12, D18 in docs/PROCESS-LEDGER.md): the implementer finds a wrong test and may not edit it, the tester fixes it without seeing the code, and the ticket goes back and forth; PROP-076 and PROP-077 shortened that loop but kept it. No ticket has ever used a light lane. What I want: a third light lane, set by a person in the ticket's frontmatter like docs and tests, in which one stage writes the tests and the code together, between the spec review and the reviewer. Test first stays, as a check instead of a split between two roles: the stage's check takes the stage's test files alone on the tree as it was before the stage, and each new or changed scenario's test must fail there on an assertion; on the stage's whole tree every test must pass. The mutations a tester names (PIP-019) are still named, and the reviewer still checks some. Like the other light lanes, the CLI keeps it honest, and any stage can send the ticket to the full order. The cost to weigh in the spec: no independent tester reads the scenarios before the code exists.
