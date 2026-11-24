---
id: PROP-101
type: proposal
title: A test run that times out does not use up one of a report's three attempts
status: done
stage: null
touches: [PIP-008]
violates: []
depends_on: []
changed: [INV-015, PIP-008, PIP-018, PIP-022, PIP-022/R1, PIP-022/S1, PIP-022/S2, PIP-022/S3, PIP-022/S4, pipeline.AdvanceTicket, pipeline.Advanced, pipeline.Advanced.problems, pipeline.CheckCouldNotRun]
questions: []
history:
  - at: 2026-11-01T15:50:09.279Z
    role: spec-writer
    result: done
    summary: "A test run with no results (timeout, runner not started) is a check that could not run: advance records nothing, counts no attempt (PIP-022)"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-022/S1, PIP-022/S2, PIP-022/S4]
        reason: Ran spec impact PROP-101. The unchanged paths are shown by PIP-022/S4 (a run with results, a missing testCommand, another problem and a reviewer report behave as before); the refusal count of PIP-018 is shown by PIP-022/S1 and S2. PIP-008 and PIP-018 rules and scenarios are unchanged.
      - item: C2
        outcome: scenarios
        ids: [PIP-022/S1, PIP-022/S3]
        reason: Timeout under load, runner that does not start, no report and unknown format are covered (S3); the worktree and the primary checkout are covered (S1); every way the report reaches advance is in R1. No path, platform or upgrade axis changes.
      - item: C3
        outcome: na
        ids: []
        reason: "A check that could not run writes nothing: no ticket, history, refusal count, stash or kept test run, so no state is shared across a retry. The rules for the refusal count (PIP-018/R5, R6) and the kept run (PIP-008/R12) are unchanged."
      - item: C4
        outcome: invariant
        ids: [INV-015]
        reason: The test run's result is set by machine load, the project's own command and whoever edits its config. INV-015 says a run with no results never accepts a report, never counts as an attempt and is never read as passing; the CLI decides, and another problem or a missing testCommand is refused as before.
      - item: C5
        outcome: scenarios
        ids: [PIP-022/S4]
        reason: No testCommand, and a report with another problem, are still refused and counted. A run with no results never records a stage.
      - item: C6
        outcome: scenarios
        ids: [PIP-022/S4]
        reason: A run that gave results, a missing testCommand, a report with another problem and a done reviewer report are unchanged; PIP-008 and PIP-018 scenarios are untouched.
      - item: C8
        outcome: na
        ids: []
        reason: The only external fact is the ETIMEDOUT text 'spawnSync /bin/sh ETIMEDOUT' quoted in the ticket from PROP-098 and PROP-095 and produced by the code from the spawn error message; no other tool or service is relied on.
    assumed:
      - new: Is a test timeout in config worth adding?
        value: No; the timeout stays fixed (a config key would touch the config contract, schema and lint)
      - new: Does the finish hook's own refusal counting and a timeout of checkCommands also count as could not run?
        value: No; the change covers advance's test run only
      - new: Is a missing testCommand an environment failure?
        value: No; a retry cannot fix it, so it is refused and counted as before
      - new: What exit code does a check that could not run use?
        value: 3, so a driver can tell it from a refusal (1)
    duration_s: 323
    refusals: 1
  - at: 2026-11-01T15:58:15.473Z
    role: spec-review
    result: done
    summary: Clarify stdin retry persistence and correct the mixed-problem refusal scenario
    verdict: changes
    findings:
      - cites: [PIP-022/S2, PIP-022/R1, PIP-008/R5, PIP-008/S14]
        text: S2 promises that retrying advance without stdin records a report originally supplied on stdin, but bare stdin need not have any stored report. Creating one contradicts R1's promise that no stored report changes. If an older stored report exists, preserving it can instead retry that older report, despite stdin having won initially. Specify retry transport and persistence separately for stdin and pre-stored reports, including precedence, and reconcile the no-change rule.
        class: C3
      - cites: [PIP-022/S4, PIP-005/S6, PIP-005/R1, INV-003]
        text: S4 uses TASK-101 and expects changing a testGlobs file to supply another refusal problem during a timeout. Tasks permit implementers to change tests, as PIP-005/S6 explicitly shows. This case therefore has only the no-results problem and must exit 3 under R1, contrary to S4's exit 1. Make the mixed-problem case genuinely violate an unchanged role rule so it demonstrates the claimed preserved refusal behaviour.
        class: C6
    assumed: []
    duration_s: 484
  - at: 2026-11-01T15:59:30.141Z
    role: spec-writer
    result: done
    summary: "A test run with no results (timeout, runner not started) is a check that could not run: advance records nothing, counts no attempt (PIP-022)"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-022/S1, PIP-022/S2, PIP-022/S4]
        reason: Ran spec impact PROP-101. The unchanged paths are shown by PIP-022/S4 (a run with results, a missing testCommand, another problem and a reviewer report behave as before); the refusal count of PIP-018 is shown by PIP-022/S1 and S2. PIP-008 and PIP-018 rules and scenarios are unchanged.
      - item: C2
        outcome: scenarios
        ids: [PIP-022/S1, PIP-022/S3]
        reason: Timeout under load, runner that does not start, no report and unknown format are covered (S3); the worktree and the primary checkout are covered (S1); every way the report reaches advance is in R1. No path, platform or upgrade axis changes.
      - item: C3
        outcome: scenarios
        ids: [PIP-022/S2]
        reason: "A check that could not run creates, changes and deletes no stored report, ticket, history, refusal count, stash or kept test run (R1). S2 shows the retry: a stdin report is given again, a report the finish check stored is still there, and PIP-008/R5 precedence is unchanged."
      - item: C4
        outcome: invariant
        ids: [INV-015]
        reason: The test run's result is set by machine load, the project's own command and whoever edits its config. INV-015 says a run with no results never accepts a report, never counts as an attempt and is never read as passing; the CLI decides, and another problem or a missing testCommand is refused as before.
      - item: C5
        outcome: scenarios
        ids: [PIP-022/S4]
        reason: No testCommand, and a report with another problem (a proposal's implementer that changed a test file), are still refused and counted. A run with no results never records a stage.
      - item: C6
        outcome: scenarios
        ids: [PIP-022/S4]
        reason: A run that gave results, a missing testCommand, a report with another problem and a done reviewer report are unchanged; PIP-008 and PIP-018 scenarios are untouched.
      - item: C8
        outcome: na
        ids: []
        reason: The only external fact is the ETIMEDOUT text 'spawnSync /bin/sh ETIMEDOUT' quoted in the ticket from PROP-098 and PROP-095 and produced by the code from the spawn error message; no other tool or service is relied on.
    assumed:
      - new: Is a test timeout in config worth adding?
        value: No; the timeout stays fixed (a config key would touch the config contract, schema and lint)
      - new: Does the finish hook's own refusal counting and a timeout of checkCommands also count as could not run?
        value: No; the change covers advance's test run only
      - new: Is a missing testCommand an environment failure?
        value: No; a retry cannot fix it, so it is refused and counted as before
      - new: What exit code does a check that could not run use?
        value: 3, so a driver can tell it from a refusal (1)
      - new: Is a bound on retries of a check that could not run needed?
        value: No; the spec review said none is needed
    duration_s: 72
  - at: 2026-11-01T16:00:25.759Z
    role: spec-review
    result: done
    summary: "Both findings resolved: retry transport is explicit and the mixed-problem refusal preserves proposal path rules"
    verdict: approve
    assumed: []
    duration_s: 53
  - at: 2026-11-01T16:13:53.960Z
    role: tester
    result: done
    summary: "Tests for PIP-022/S1-S4: a test run with no results exits 3, records nothing and counts no attempt; a mixed case is still refused"
    verdict: null
    mutations:
      - scenario: PIP-022/S1
        wrong: a timed-out test run is refused as report refused (attempt n of 3) with exit 1 and raises the refusal count
      - scenario: PIP-022/S2
        wrong: a run that gave no results deletes the report the finish check stored, or stores the stdin report, so the retry finds a different report state
      - scenario: PIP-022/S3
        wrong: only a timeout is a check that could not run; a command that fails to start, writes no report or writes an unknown format is still refused
      - scenario: PIP-022/S4
        wrong: any run with an error is a check that could not run, so a report with another problem (a proposal's implementer changing a test file) or a project with no testCommand exits 3 instead of being refused
    assumed:
      - new: How is a test timeout produced in a test, as the real timeout is a fixed 10 minutes?
        value: The tests stub the child_process module (process.getBuiltinModule) so spawnSync gives the error a real timeout gives, 'spawnSync /bin/sh ETIMEDOUT'; a command that cannot start is stubbed the same way (ENOENT)
      - new: What is the exact last line of stderr that tells the driver to run the command again?
        value: The spec gives no wording, so the tests check only that the last line mentions 'again'
      - new: Do existing tests pin the old behaviour of a no-results advance being refused as an attempt?
        value: "No: none found; the existing refusal tests (PIP-018/S2-S9, CLI-007/S11) use wrong-role reports, which are refused for another problem and stay so"
    duration_s: 806
  - at: 2026-11-01T16:31:42.137Z
    role: implementer
    result: done
    summary: Advance fails with CheckCouldNotRun (exit 3) when the test run gave no results and nothing else is wrong; nothing recorded or counted
    verdict: null
    assumed:
      - new: Is the stored report put back when a flagged intake (--report-file or --report -) could not run?
        value: "Yes: intake still clears the stored report first, and rewrites the same report and transcript path when the check could not run, so R1's 'not deleted' holds"
      - new: What is the exact last line telling the driver to run the command again?
        value: '"Run the same command again." The spec gives no wording'
    duration_s: 1066
  - at: 2026-11-01T16:38:06.158Z
    role: reviewer
    result: done
    summary: Stored-report restoration races; flagged preservation lacks coverage; empty-result acceptance is a base bug candidate
    verdict: changes
    findings:
      - cites: [PIP-022/R1, PIP-008/R5]
        text: src/cli/report.ts:247-269 snapshots and deletes the stored report before running tests, then unconditionally restores the snapshot after a no-results run. There is no advance-level lock or ownership check. If another advance consumes the report and records the stage while the first command waits, the first command resurrects the consumed report and its old transcript; it can also overwrite a newer stored report. This breaks R1's no-change guarantee. Defer stored-report mutation until classification, or protect it with suitable synchronization, and add an overlapping-advance regression test.
        tests: true
        class: C3
      - cites: [PIP-022/S2, PIP-022/R1]
        text: tests/cli/advance-check-could-not-run.test.ts:225 exercises saved-report preservation only without report flags. All flagged no-results fixtures start without a saved report. Consequently, deleting the restoration at src/cli/report.ts:269 still passes the tests, despite the tester's S2 mutation requiring detection of a deleted stored report. Add cases with a distinct existing report and transcript, then a no-results --report-file or --report - intake, asserting both remain unchanged and usable on retry.
        tests: true
        class: C7
    assumed: []
    duration_s: 381
  - at: 2026-11-01T16:54:53.644Z
    role: tester
    result: done
    summary: "Tests for the review: a stored report and transcript survive a no-results advance, and an overlapping advance is not undone (PIP-022/S2, R1)"
    verdict: null
    mutations:
      - scenario: PIP-022/S2
        wrong: a no-results advance with --report-file or --report - deletes the stored report and transcript path it found, or rewrites them, instead of leaving them as they were
      - scenario: PIP-022/S2
        wrong: a no-results advance deletes the stored report first and puts its earlier copy back afterwards, so a report another advance consumed meanwhile comes back
      - scenario: PIP-022/S2
        wrong: a no-results advance puts back its earlier copy of the stored report after the run, overwriting a newer report stored meanwhile
    assumed:
      - new: How does a test make a second advance run while the first waits for its test run?
        value: "The stubbed test run is synchronous, so a hook runs inside it: a real second ticket advance as a child process (it takes a report from stdin, deletes the stored one and records the stage), or the finish check's saveReport for a newer report"
      - new: What does the first advance return after another advance recorded the stage?
        value: The spec does not say, so the tests assert only the stored files and the ticket, not its exit code
      - new: Do the stored-report tests fail on today's code?
        value: The overlap tests (consumed report comes back, newer report overwritten) fail on assertions; the byte-identical survival test passes today because the code restores its snapshot, and it fails if that restore is removed
    duration_s: 1003
  - at: 2026-11-01T17:10:58.610Z
    role: implementer
    result: done
    summary: "A no-results advance touches nothing: the stored report is consumed only once the check result is known, so no restore can undo another advance"
    verdict: null
    assumed:
      - new: When is the stored report consumed on a flagged intake?
        value: Only after the check ran (ok or refused) or when it was refused before any check; a check that could not run never reads, deletes or rewrites it, so the snapshot-and-restore is gone
      - new: What is the exact last line telling the driver to run the command again?
        value: '"Run the same command again." The spec gives no wording'
    duration_s: 962
  - at: 2026-11-01T17:16:50.109Z
    role: reviewer
    result: done
    summary: Both findings resolved; 19 targeted tests pass; refusal and stored-report paths preserved
    verdict: approve
    findings:
      - cites: [PIP-022/S2, PIP-022/R1]
        text: "Follow-up: Prefix the two overlap regressions in tests/cli/advance-check-could-not-run.test.ts with PIP-022/S2 rather than PIP-022/R1 so targeted spec test runs include them. Their assertions catch the reported restoration races, but spec test rejects rule IDs, preventing their execution through the required targeted CLI path."
        class: C7
    assumed: []
    duration_s: 343
---
Self-hosting finding P71. PROP-098's tester report was refused as attempt 1 of 3 with 'the test command gave no results: spawnSync /bin/sh ETIMEDOUT' while three or four full test suites ran at once on the machine. The same report was accepted unchanged on the retry. A timeout or a test runner that could not start says nothing about the report, but it counts toward the three attempts after which the ticket blocks and its work is stashed. Make advance tell an environment failure (timeout, no results, runner did not start) apart from a refused report: print that the check could not run and to retry, and do not count it as an attempt. Consider also letting the project set the test-run timeout in config.
