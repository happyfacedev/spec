---
id: PROP-113
type: proposal
title: "One full test run at a time per repository: a second one waits its turn and says so"
status: done
stage: null
touches: [PIP-009]
violates: []
depends_on: []
changed: [INS-001, INV-016, PIP-009, PIP-009/R2, PIP-009/R3, PIP-009/R4, PIP-009/R5, PIP-009/S11, PIP-009/S13, PIP-009/S14, PIP-009/S15, PIP-009/S16, PIP-009/S17, PIP-009/S18, PIP-009/S19, PIP-009/S20, PIP-009/S21, PIP-009/S22, PIP-009/S23, PIP-009/S24, PIP-009/S25, PIP-009/S26, PIP-009/S27, PIP-009/S28, PIP-009/S29, format.Config, format.Config.maxTestRuns, pipeline.RunTests, pipeline.TestRunSettings, pipeline.TestRunSettings.SPEC_TEST_RUN_NOTICE_INTERVAL_MS, pipeline.TestRunSettings.SPEC_TEST_RUN_POLL_INTERVAL_MS, pipeline.TestRunSettings.SPEC_TEST_RUN_TIMEOUT_MS, pipeline.TestRunTurn, pipeline.TestRunTurn.command, pipeline.TestRunTurn.location, pipeline.TestRunTurn.pid, pipeline.TestRunTurn.startedAt, pipeline.TestRunTurn.ticket]
questions:
  - id: Q1
    kind: preference
    text: Should the number of test runs allowed at once be configurable?
    default: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
    cites: [PIP-009]
    answer: null
    raised_by: null
  - id: Q2
    kind: preference
    text: How long does a run wait for its turn before it gives up?
    default: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
    cites: [PIP-009]
    answer: null
    raised_by: null
  - id: Q3
    kind: blocker
    text: 'The five test-runs file runs took 75.69–77.09s (about 4.5s/test), each timing out at PIP-009/S14. Its setup can call readdirSync(markerDirectory) before any starter creates the directory; if absent, the predicate throws before writing the shared go file, then finally waits on wrappers gated by that file instead of checking the scenario. Its changes are kept in git stash "PROP-113 implementer: blocked"; the next implementer stage gets them back.'
    default: null
    cites: [PIP-009/S14]
    answer: "Agreed, a test defect: S14's setup must not read the marker folder before a starter has made it (treat a missing folder as no markers yet) and must always write the go file. Back to the tester; the implementer's work stays in its stash."
    raised_by: implementer
  - id: Q4
    kind: blocker
    text: "tests/cli/test-runs.test.ts:456 failed with 'timeout waiter did not wait'. In timeout mode line 448 sets SPEC_TEST_RUN_TIMEOUT_MS=500, then starts the waiter; under load the 500 ms can expire before the waiter reaches the turn gate. Once the holder's command ends the turn is correctly free, so no waiting notice is required. Gate the timeout command's end on the waiter's waiting-notice event before testing this ending. Its changes are kept in git stash \"PROP-113 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites: [PIP-009/S17]
    answer: "Agreed, a test defect: S17's time-limit ending races under load (a 500 ms limit can expire before the waiter arrives). Make every ending order-independent: wait for the event that the holder's check command has started (so its test command has ended, by whatever ending), then start the second run and assert it runs its test command while the holder is still held open. Back to the tester; the implementer's work stays in its stash."
    raised_by: implementer
history:
  - at: 2026-11-10T09:24:44.359Z
    role: spec-writer
    result: done
    summary: "PIP-009: every test run takes a repo-wide turn (maxTestRuns, default 1); a waiter names its holder on stderr"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-009/S16, PIP-009/S21, PIP-009/S13]
        reason: spec impact reaches ADP-003, PIP-006 and PIP-010 through pipeline.RunTests and pipeline.NoTestResults; their scenarios are unchanged because a wait changes no result, output or exit code (S16, R4), a refused run never waits (S21), and a lone run starts at once (S13); ADP-003/S4, PIP-006/S16 and PIP-010/S1-S15 stay true
      - item: C2
        outcome: scenarios
        ids: [PIP-009/S15, PIP-009/S20]
        reason: the turn is shared by the main checkout and every worktree of the repository (S15, R3); each run reads maxTestRuns from its own tree's config (R5); an older config without maxTestRuns means 1 (S20); one machine and POSIX /bin/sh as today, no new platform axis
      - item: C3
        outcome: scenarios
        ids: [PIP-009/S14, PIP-009/S15, PIP-009/S17, PIP-009/S19, PIP-009/S20]
        reason: while one run holds the turn a second waits (S14, S15); two asking at the same moment never both get it (S14); the turn is given back however the holder ends (S17); a waiter stopped mid-wait holds nothing (S19); limit above 1 (S20)
      - item: C4
        outcome: invariant
        ids: [INV-016]
        reason: "shown by PIP-009/S22: a turn's record is written by any local process; a forged one can only make a run wait or be taken over, nothing in it is run, the notice shows only a ticket ID, a known command and a pid, else 'an unknown run'; the run itself decides results"
      - item: C5
        outcome: scenarios
        ids: [PIP-009/S18, PIP-009/S20, PIP-009/S21]
        reason: maxTestRuns of 0, 1.5 or a string is a lint finding (S20); an invalid filter or no config is refused before any wait (S21); a record that cannot be read or names a dead holder is a free turn (S18), which keeps tests running rather than hanging
      - item: C6
        outcome: scenarios
        ids: [PIP-009/S13, PIP-009/S16, PIP-009/S21]
        reason: a lone run starts at once with no stderr notice (S13, checked on the current build); a waiting run gives exactly the result, stdout, problems and exit code it would without the wait, and the 10-minute limit starts with the command (S16, R2); S1-S12 unchanged
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool or service is involved; the turn is spec's own and the test command is run as today
    documents: [PIP-009/S13, PIP-009/S21]
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
      - new: What is the config key called?
        value: format.Config.maxTestRuns, beside maxParallel
      - new: What exactly does the waiting notice say?
        value: "'<command>: waiting for a test run to finish: \"<command>\" on <ticket> (pid <pid>)', or 'in the main checkout' for a run there, holders in turn order joined by ', '"
      - new: Does spec gaps take a turn too?
        value: "Yes: every run of the test command spec starts, including spec gaps; check commands, worktreeSetup, afterMerge and the generated command do not"
      - new: Which config's maxTestRuns applies when the main checkout and worktrees differ?
        value: The config of the checkout or worktree the command runs in
      - new: Is a turn record that cannot be read held or free?
        value: Free and taken over, like one whose holder is not alive, so a crash mid-write cannot hang every run
      - new: Does 'spec config set' accept maxTestRuns?
        value: "No change: config set's key list (CLI-008/R4) is left as is; the key is set by editing config.json"
    duration_s: 311
  - at: 2026-11-10T14:05:45.331Z
    role: spec-review
    result: done
    summary: "Turn design is sound; one case missing: a run's behaviour when maxTestRuns is invalid at run time (0 hangs forever)"
    verdict: changes
    findings:
      - cites: [PIP-009/S20, PIP-009/R5, PIP-009/R3, format.Config.maxTestRuns]
        text: 'Only `spec lint` is said to react to `"maxTestRuns": 0`, `1.5` or `"2"` (S20). No scenario says what a test run does when it reads such a value (a person who never ran lint, or who sets 0 to switch the limit off). Read literally, R3 with a limit of 0 means no run can ever hold a turn, so every `spec test`, `check-report`, `ticket advance` and `spec merge` waits forever with a notice that names no holder, and the person decides how long to wait (INV-016) is the only way out. The C5 answer cites S20, which covers lint only. Add a scenario (and say it in R5) for what a run does with an invalid value: it is refused at once with a named error and does not wait, or it is treated as the default 1; either way it must not hang. Say too which one, so a tester can write it.'
        class: C5
      - cites: [PIP-009/R3, PIP-009/S17, PIP-009/S18]
        text: "Follow-up: S17 lists the ways a holder's run ends (tests passed, a test failed, no report, 10-minute stop) and S18 covers a holder killed without giving the turn back. A holder that the person interrupts (Ctrl-C, SIGTERM) is neither: no scenario says the turn is given back, nor whether the holder's test command is stopped with it. An orphaned test command that keeps running after its turn is free brings back the overload this ticket exists to prevent."
        class: C3
      - cites: [PIP-009/R3, PIP-009/S18, PIP-009/S22]
        text: "Follow-up: R3 says a record that cannot be read is free and taken over, and also that two runs asking at the same moment never both take the last free turn. A live holder that is still writing its record may be read as unreadable and taken over, so the two rules can disagree unless the record is written atomically. No scenario or rule says a record being written by a live run is not unreadable."
        class: C3
      - cites: [PIP-009/S18, PIP-009/S22, INV-016]
        text: "Follow-up: 'alive' is decided by a process number. A stale record left by a killed run or a reboot whose pid is now used by an unrelated process (S22 itself uses pid 1) makes every run wait with a plausible-looking notice, and nothing names where the record is or how a person clears it. A holder in another process namespace (a container or sandbox) reads as dead and is taken over, so the limit is not kept. Say where the record lives, or how a person removes a stale one."
        class: C2
      - cites: [PIP-009/R3, PIP-009/S15, PIP-009/R4]
        text: "Follow-up: 'every worktree of the repository' includes worktrees that are not ticket worktrees (a person's own `git worktree add`), and the repository may be reached through a symlinked or non-canonical path or with --root. R4 names a holder 'on <ticket>' or 'in the main checkout' only, so a run in such a worktree would show as 'an unknown run' although it is a real one, and no scenario says such a run shares the turn."
        class: C2
      - cites: [PIP-009/S20, PIP-009/R3, format.Config]
        text: "Follow-up: an upgrade state is missing. A worktree whose pinned CLI (.spec/bin) is older than this change takes no turn, so the limit is not kept while old and new CLIs mix, and an old CLI refuses a config.json that holds maxTestRuns as an unknown key (format.Config: unknown keys are refused). S20 covers an older config, not an older CLI."
        class: C2
      - cites: [PIP-009/R3, PIP-009/S14]
        text: "Follow-up: no scenario covers a run started inside a holder's test command in the same repository (a project whose tests call `spec test` or `check-report` on that repository). It would wait for the turn its own parent holds and never finish."
        class: C3
      - cites: [PIP-009/R3, PIP-009/R4]
        text: "Follow-up: R3 names the commands as `spec test`, `check-report`, `ticket advance`, `spec merge`, `spec gaps` (some with the `spec` prefix, some without), while R4 says a record whose command 'is not one of R3's' is shown as unknown, and S14/S15/S20 show the notice with the `spec` prefix for all. A tester can read the allowed names two ways; list the exact five strings once."
        class: C9
    assumed: []
    duration_s: 151
  - at: 2026-11-10T14:09:11.432Z
    role: spec-writer
    result: done
    summary: "PIP-009 per review: invalid maxTestRuns refused at once, interrupt frees turn, record path, any worktree, nested run"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-009/S13, PIP-009/S16, PIP-009/S21, PIP-009/S23]
        reason: spec impact reaches ADP-003, PIP-006, PIP-010, PIP-022, WSP-006/007 through pipeline.RunTests, and FMT-002, INS-001-004, CLI-007 and others through format.Config; a lone run starts at once (S13), a wait changes no result, output, problem or exit code (S16), refused runs never wait (S21), and an invalid config is refused exactly as any schema mismatch is today (S23); format.Config gains only an optional key that init does not write, so FMT-002 and INS-001 scenarios stay true
      - item: C2
        outcome: scenarios
        ids: [PIP-009/S15, PIP-009/S25, PIP-009/S26, PIP-009/S23]
        reason: the turn is shared by the main checkout and every worktree, ticket or not, and the repository is found by its git folder after symlinks, whatever path or --root reached it (S26, R3); records live in '<git folder>/spec-test-runs/<pid>' and a record from before the last machine start is free (S25); an older pinned CLI takes no turn and refuses a config holding maxTestRuns with 'config.json has no testCommand' (R5, the same refusal checked on today's build for S23); turns hold within one machine's process namespace (R3)
      - item: C3
        outcome: scenarios
        ids: [PIP-009/S14, PIP-009/S17, PIP-009/S18, PIP-009/S19, PIP-009/S24, PIP-009/S27]
        reason: while one run holds the turn a second waits, and two asking together never both get it (S14); the turn comes back however the holder ends (S17), including Ctrl-C/SIGTERM, which first stops the whole test command (S24); a record being written is never taken as unreadable (S18); a stopped waiter holds nothing (S19); a run nested in the holder's test command runs under its parent's turn (S27)
      - item: C4
        outcome: invariant
        ids: [INV-016]
        reason: "shown by PIP-009/S22: any local process can write a record; a forged or stale one only makes a run wait or is taken over, nothing in it is run, the notice shows only a ticket ID, one of the five command names and a pid, else 'an unknown run', and the person frees a turn held by a reused pid by removing the file the notice names"
      - item: C5
        outcome: scenarios
        ids: [PIP-009/S23, PIP-009/S21, PIP-009/S20]
        reason: maxTestRuns of 0, 1.5 or a string makes the config fail the schema, so every run is refused at once with pipeline.MissingTestCommand and never waits (S23, R5), and lint reports it (S20); an invalid filter or no config is refused before any wait (S21)
      - item: C6
        outcome: scenarios
        ids: [PIP-009/S13, PIP-009/S16, PIP-009/S21]
        reason: a lone run starts at once with nothing on stderr (S13, checked on the current build); a waiting run's result, stdout, problems and exit code are those of a run with no wait, and the 10-minute limit starts with the command (S16, R2); S1-S12 are unchanged
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool or service; the old CLI's refusal of an unknown config key was checked by running today's build
    documents: [PIP-009/S13, PIP-009/S21, PIP-009/S23]
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
      - new: What does a run do with an invalid maxTestRuns?
        value: Refused at once with 'config.json has no testCommand', exit 1, as for any config that fails the schema today; it never waits
      - new: Where are turns kept, and how does a person free one?
        value: One file per held turn, '<git folder>/spec-test-runs/<pid>'; removing it frees the turn; the first notice names the folder
      - new: Is a record from before a machine restart still held?
        value: "No: a record written before the machine last started is free, so a pid reused after a reboot holds nothing"
      - new: What does Ctrl-C or SIGTERM on a holder do?
        value: It stops the test command and every process it started, removes the record, and frees the turn
      - new: How is a run in a worktree without a ticket named?
        value: "'\"<name>\" in a worktree without a ticket (pid <pid>)'; it shares the turn like any other"
      - new: What does a run nested in a holder's test command do?
        value: It runs at once under its parent's turn and takes none of its own
      - new: Is the limit kept across process namespaces (containers)?
        value: "No: turns hold among processes on one machine that see each other's pids; this is stated as a limit in R3"
      - new: What is the config key called?
        value: format.Config.maxTestRuns, beside maxParallel
      - new: Which config's maxTestRuns applies when the main checkout and worktrees differ?
        value: The config of the checkout or worktree the command runs in
      - new: Is a turn record that cannot be read held or free?
        value: Free and taken over; a record is written whole at once, so one being written is never unreadable
      - new: Does 'spec config set' accept maxTestRuns?
        value: "No change: config set's key list (CLI-008/R4) is left as is; the key is set by editing config.json"
    duration_s: 203
  - at: 2026-11-10T14:10:52.662Z
    role: spec-review
    result: done
    summary: "Fixes cover the earlier findings: invalid maxTestRuns refused at once, interrupt, record path, nested run; approved with follow-ups"
    verdict: approve
    findings:
      - cites: [PIP-009/S27, PIP-009/R3, INV-016]
        text: "Follow-up: S27 and R3 let a run 'started inside a holder's test command' skip the turn, but nothing says how a run knows it is inside one. If that is a marker the holder hands down (for example an inherited environment value), it is an input any process can set, and INV-016 speaks only of the record. A forged or left-over marker (a daemon the test command started, which outlives the holder) can only make a run skip waiting, never change a result, but INV-016 or R3 should say that, and S27 could add that a run outside a holder's test command gets no such pass."
        class: C4
      - cites: [PIP-009/S18, PIP-009/S24, PIP-009/R3]
        text: "Follow-up: S24 stops the test command and its processes when the holder is interrupted by Ctrl-C or SIGTERM, but S18 (a holder killed without giving the turn back, as by SIGKILL) takes the turn over while that holder's test command may still be running. The overload this ticket removes can come back that way; R3 or S18 could say so as a known limit."
        class: C3
      - cites: [PIP-009/R3, PIP-009/R4, PIP-009/S25]
        text: "Follow-up: R3 and R4 say '<git folder>/spec-test-runs', and S25 shows '/work/app/.git/spec-test-runs' for a run in a ticket's worktree, so the folder is the repository's common git folder; a worktree's own git folder (.git/worktrees/<name>) is a different one. Say 'the repository's common git folder' so a tester does not read it as the worktree's."
        class: C9
      - cites: [PIP-009/S23, PIP-009/R5, pipeline.MissingTestCommand]
        text: "Follow-up: a person who writes `\"maxTestRuns\": 0` sees 'config.json has no testCommand', which is true of every schema failure today but points at the wrong key. The scenario keeps today's refusal on purpose; a later ticket may want a message that names maxTestRuns."
        class: C9
      - cites: [PIP-009/S25, PIP-009/R3]
        text: "Follow-up: 'a record written before the machine last started is free' is stated in S25 as a bare And, with no Given that makes a record older than the machine start. A tester needs a record dated before the last start (for example a file whose time is older); S25 could add that to its Given."
        class: C2
    assumed: []
    duration_s: 98
  - at: 2026-11-11T10:07:57.156Z
    role: tester
    result: done
    summary: Added short CLI tests for PIP-009/S13-S27; the unimplemented turn behavior remains red.
    verdict: null
    mutations:
      - scenario: PIP-009/S13
        wrong: Prints a waiting notice for a lone run even though no other test command holds a turn.
      - scenario: PIP-009/S14
        wrong: Starts a second test command before the first holder ends.
      - scenario: PIP-009/S15
        wrong: Uses a checkout-local lock so a main checkout and its ticket worktree run at once.
      - scenario: PIP-009/S16
        wrong: Counts time waiting as a failed check or an extra report refusal.
      - scenario: PIP-009/S17
        wrong: Leaves the turn held after a failed or report-less test command.
      - scenario: PIP-009/S18
        wrong: Never reclaims a turn whose holder died or whose record is unreadable.
      - scenario: PIP-009/S19
        wrong: Keeps a stopped waiter in the queue so the later run cannot start.
      - scenario: PIP-009/S20
        wrong: Ignores maxTestRuns and permits only one run or all runs at once.
      - scenario: PIP-009/S21
        wrong: Prints a waiting notice for an invalid filter or missing testCommand before refusing it.
      - scenario: PIP-009/S22
        wrong: Trusts or executes forged ticket and command fields instead of showing an unknown run.
      - scenario: PIP-009/S23
        wrong: "Accepts maxTestRuns: 0 and runs the configured test command instead of refusing."
      - scenario: PIP-009/S24
        wrong: Stops only the CLI and leaves its test-command child running while releasing the turn.
      - scenario: PIP-009/S25
        wrong: Stores turns under a worktree's private git folder or omits the removal advice.
      - scenario: PIP-009/S26
        wrong: Uses the symlinked path as a separate lock namespace instead of the common repository.
      - scenario: PIP-009/S27
        wrong: Makes a nested test run wait for its own parent and deadlock.
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
      - new: Turn-record encoding for forged-record tests
        value: JSON with pid, command, ticket, and startedAt fields.
      - new: How to simulate a pre-restart record
        value: A record file whose mtime predates the OS uptime-derived boot time represents a record written before machine start.
    duration_s: 71819
    refusals: 1
  - at: 2026-11-11T10:58:16.460Z
    role: implementer
    result: blocked
    summary: Turn coordination implemented; only tester assertion/timing blockers remain.
    verdict: null
    blockers:
      - text: The tests use 0.5–0.8s holders and start a new CLI whose workspace setup can take longer; when the waiter reaches RunTests the holder has ended, so no waiting notice is correct. Keep the holder active through the lock boundary.
        cites: [PIP-009/S14, PIP-009/S15, PIP-009/S16, PIP-009/S17, PIP-009/S19, PIP-009/S20, PIP-009/S25, PIP-009/S26]
        tests: true
      - text: S17 leaves the same mode for holder and waiter, so the waiter must also fail or report no results in those modes; the scenario only requires that its turn is released.
        cites: [PIP-009/S17]
        tests: true
      - text: S16 expects a literal backslash-n in report ok\n, while the existing check-report output is report ok followed by a newline.
        cites: [PIP-009/S16]
        tests: true
      - text: S18 asserts the TSX wrapper's signal even though the fixture kills its inner CLI via $PPID; the wrapper exits with code 137 and no signal, while the scenario only requires that the holder is gone.
        cites: [PIP-009/S18]
        tests: true
      - text: S24 expects the test command's active-* directory to be removed, but stopping its process group terminates the shell before its rmdir; the scenario requires the processes to stop, not that shell cleanup runs.
        cites: [PIP-009/S24]
        tests: true
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
    duration_s: 3002
  - at: 2026-11-11T11:36:57.819Z
    role: tester
    result: done
    summary: S25 test fails on the code's unnormalised notice path; implementer must print the common git folder's path.
    verdict: null
    mutations:
      - scenario: PIP-009/S14
        wrong: Starts the merge test command while the check-report holder still holds its turn.
      - scenario: PIP-009/S15
        wrong: Uses a checkout-local turn so main and ticket worktree runs overlap.
      - scenario: PIP-009/S16
        wrong: Treats waiting as CheckCouldNotRun or increments the report refusal count.
      - scenario: PIP-009/S17
        wrong: Releases a turn only after a passing result, leaving failed or report-less runs blocking waiters.
      - scenario: PIP-009/S18
        wrong: Keeps a record owned by a dead holder as occupied.
      - scenario: PIP-009/S19
        wrong: Leaves a stopped waiter in the queue so it blocks the later spec gaps run.
      - scenario: PIP-009/S20
        wrong: Ignores maxTestRuns and allows a third test command while two turns are occupied.
      - scenario: PIP-009/S21
        wrong: Makes invalid-filter and no-config refusals wait for a free turn.
      - scenario: PIP-009/S24
        wrong: Terminates the holder CLI but leaves its test-command child running after the merge starts.
      - scenario: PIP-009/S25
        wrong: Prints a ticket worktree's unnormalized private path instead of the specified common git-folder notice path.
      - scenario: PIP-009/S26
        wrong: Uses the symlinked worktree path as a distinct lock namespace.
    passed: false
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
      - new: Turn-record encoding for forged-record tests
        value: JSON with pid, command, ticket, and startedAt fields.
      - new: How to simulate a pre-restart record
        value: A record file whose mtime predates the OS uptime-derived boot time represents a record written before machine start.
    duration_s: 2297
  - at: 2026-11-11T12:36:46.528Z
    role: implementer
    result: blocked
    summary: Restored Git-fact caching and fixed canonical turn paths and same-repository nesting.
    verdict: null
    blockers:
      - text: On this Darwin host, /var resolves to /private/var. With the required realpath canonical common-Git-folder path, PIP-009/S22 and S25 assert the noncanonical /var/.../.git/spec-test-runs notice path; update those tester assertions to canonicalize the fixture folder.
        cites: [PIP-009/S22, PIP-009/S25]
        tests: true
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
    duration_s: 3580
    refusals: 1
  - at: 2026-11-11T13:15:02.753Z
    role: tester
    result: done
    summary: Removed the 1s nested-run timeout race; S27 20/20 and full file 10/10 pass.
    verdict: null
    mutations:
      - scenario: PIP-009/S22
        wrong: Prints the fixture's lexical .git path instead of its canonical realpath in the notice.
      - scenario: PIP-009/S25
        wrong: Prints the fixture's lexical common-Git-folder path instead of its canonical realpath in the notice.
      - scenario: PIP-009/S27
        wrong: Does not propagate the parent turn marker, so the nested run waits for its holder and never starts the test command.
    passed: true
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
      - new: Turn-record encoding for forged-record tests
        value: JSON with pid, command, ticket, and startedAt fields.
      - new: How to simulate a pre-restart record
        value: A record file whose mtime predates the OS uptime-derived boot time represents a record written before machine start.
    duration_s: 2277
  - at: 2026-11-11T13:25:41.374Z
    role: reviewer
    result: done
    summary: "Turn lock holds under probes; changes: nested marker unspecified, 4 scenarios' tests pass on a wrong build"
    verdict: changes
    findings:
      - cites: [PIP-009/S27, PIP-009/R3, INV-016]
        text: "src/io/test-run-turn.ts:29,181-194,471 adds an observable mechanism no scenario, rule or invariant states: every test command gets the environment value SPEC_TEST_RUN_PARENT = {pid, repository}, and a run whose environment holds such a value for its own repository, with a live record for that pid, takes no turn and does not wait. Any process can set that value, so it is an input like the record; INV-016 speaks only of the record, and a forged marker lets a run skip waiting (never the test command or a result; probes confirm a dead pid, a pid with no record, garbage and another repository's path all still wait). R3/INV-016 must say how a nested run is recognised, that the value is handed to the test command, and that a forged or left-over one can only make a run skip waiting. The spec-review raised this as a follow-up; the code now makes it real."
        spec: true
        class: C4
      - cites: [PIP-009/S27, PIP-009/R3, INV-016]
        text: "Nothing in tests/cli/test-runs.test.ts checks that nesting is tied to the repository. A build that accepts the marker whatever repository it names (the first implementation's failure mode: the suite runs inside this repository's turn while its fixtures are other repositories), or that trusts a marker whose pid holds no record, passes every test, because S27 only runs one nested run on the same repository. Scratch probes show the current code is right (a run in another repository under the same parent holds its own record; dead-pid, record-less, garbage and other-repository markers all wait), but a test must say so: a test command that starts `spec test` on a second repository and sees that repository's own record, and a run with a marker for a dead pid or another repository that waits."
        tests: true
        class: C7
      - cites: [PIP-009/S17, PIP-009/R3]
        text: "S17's test cannot tell whether the record is removed when the test command ends: each holder is a CLI process that exits at once, and a record of a dead process is taken over anyway, so a build that never removes the record (the turn then stays held until the process exits, e.g. through spec merge's afterMerge or a second step) still passes. The test needs a holder that stays alive after its test command has ended (for example spec merge with a slow afterMerge) and a waiter that must start before the holder exits, for the pass, fail, no-report and timeout endings."
        tests: true
        class: C7
      - cites: [PIP-009/S21, PIP-009/R3]
        text: "S21's last And (format.Config.checkCommands, worktreeSetup, afterMerge and the generated command run without waiting) is not tested for checkCommands, afterMerge or generated.command at all, and the worktreeSetup part passes even if the command waited: the holder lasts 0.7 s and nothing asserts the setup ran while it was still held. Hold the turn until released by a marker file, run each command, and assert it finished before the release."
        tests: true
        class: C7
      - cites: [PIP-009/S14, PIP-009/R3]
        text: "'Two runs that ask at the same moment never both take the last free turn' is checked by starting two processes one after the other (test-runs.test.ts:223-235). Without the directory gate in underGate the window is a few hundred microseconds, so the test passes for a non-atomic implementation almost every time. Start many runs (8 or more) after a shared go-file, or hold the gate by hand and assert nothing starts, and check that never more than maxTestRuns test commands are active."
        tests: true
        class: C7
      - cites: [PIP-009/S16, PIP-009/R2]
        text: S16's claim that once the turn is free the test command still has its full 10 minutes is checked only by expect(TEST_TIMEOUT_MS).toBe(600000), a constant compared with itself. A build that starts the 10-minute timer before the wait passes. Some check that the timer starts with the command is needed (for example a test seam for the limit).
        tests: true
        class: C7
      - cites: [PIP-009/R3, PIP-009/S24]
        text: "Follow-up: the test command now runs in its own process group (detached), so it no longer receives the terminal's SIGHUP. Scratch probe: `kill -HUP` of the CLI (as when a terminal closes) or SIGKILL leaves the test command and its children running and the record of the dead CLI is taken over, so a second test run can start on top of it. Before this change the terminal's SIGHUP reached the test command. Handle SIGHUP like SIGTERM (S24), or state in R3 that only Ctrl-C and SIGTERM stop it. SIGKILL is the known limit the spec-review noted for S18."
        class: C3
      - cites: [PIP-009/R3, PIP-009/S18]
        text: "Follow-up: when the folder <git folder>/spec-test-runs cannot be created or written (a read-only .git, as in some sandboxes) every test run now ends with 'spec: internal error: Error: EACCES ... mkdir' and a stack trace, where it ran before (probe with chmod a-w .git). The spec names no such case; decide whether such a run goes without a turn or is refused with a plain message."
        class: C5
      - cites: [PIP-009/R3]
        text: "Follow-up: staleGate removes a gate whose owner is dead and then creates its own, so two waiters that both judged the same dead gate stale can remove each other's fresh gate and both enter the section that decides the last free turn. Needs a gate left by a killed run to start; 16 simultaneous runs over a planted dead gate, four times, gave no overlap. Also the single SPEC_TEST_RUN_PARENT value names one repository: a chain repository A (holds) -> test command runs spec in B -> its test command runs spec in A makes the last run wait for its own ancestor."
        class: C3
      - cites: [PIP-009/R4, PIP-022/R1]
        text: "Follow-up: src/cli/report.ts:313-316 runs the full check (a test run, with its wait) before finishReport for any report naming a found ticket when this ticket is not running that role; finishReport then refuses such a report without any test run ('no <role> stage runs in this tree', finish-report.ts:40), so the result is the same but a test run and a turn are spent for nothing. Run the check only in the cases where finishReport would call checkReport."
        class: C6
      - cites: [PIP-009/R2, PIP-009/S11]
        text: "Follow-up: runShell keeps behaviour of the old spawnSync (probes: ENOBUFS text and time the same at 70 MB, 4 git calls for a lone run, same as main, no fixed delay), with small differences: maxBuffer is now counted over stdout and stderr together, not each; chunks are decoded to text one by one so a multi-byte character cut at a chunk edge is damaged in the failure tail; the 10-minute stop and overflow now also kill the whole process group after 150 ms. Also turnProcessId() (argv[1] ends in .ts -> parent pid) and the `spawnSync !== builtinSpawnSync` branch are test seams in the shipped source, so the tests run the tsx path, not the bundle's path."
        class: C6
    assumed: []
    duration_s: 625
  - at: 2026-11-11T13:28:14.629Z
    role: spec-writer
    result: done
    summary: "PIP-009: nesting via SPEC_TEST_RUN_PARENT stated, SIGHUP frees turn, unwritable git folder runs turnless, sharper S14-S21"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-009/S13, PIP-009/S16, PIP-009/S21, PIP-009/S23, PIP-009/S28]
        reason: spec impact reaches ADP-003, PIP-006, PIP-010, PIP-022, WSP-004/006/007 through pipeline.RunTests and the format/install neighbours through format.Config; a lone run starts at once (S13), a wait changes no result, problem or exit code (S16), refused runs and the other configured commands never wait (S21), an invalid config is refused as any schema mismatch is (S23), and a git folder where no turn can be kept still gives the same result (S28)
      - item: C2
        outcome: scenarios
        ids: [PIP-009/S15, PIP-009/S25, PIP-009/S26, PIP-009/S27, PIP-009/S28]
        reason: every worktree, ticket or not, shares the turn however it is reached (S26); records live under the git folder and one from before the last restart is free (S25); a test command that runs spec on a second repository takes that repository's own turn (S27); a read-only git folder, as in some sandboxes, runs without a turn and says so instead of an internal error (S28); older pinned CLIs take no turn and refuse the key (R5)
      - item: C3
        outcome: scenarios
        ids: [PIP-009/S14, PIP-009/S17, PIP-009/S18, PIP-009/S19, PIP-009/S24, PIP-009/S27]
        reason: 8 runs asking at the same moment never overlap (S14); the turn is given back when the test command ends while the merge goes on with afterMerge (S17); a record being written is never unreadable (S18); a stopped waiter holds nothing (S19); Ctrl-C, SIGTERM and SIGHUP stop the whole test command before the turn is freed, SIGKILL being the stated limit (S24, R3); a nested run in the same repository does not wait for its parent (S27)
      - item: C4
        outcome: invariant
        ids: [INV-016]
        reason: "shown by PIP-009/S22 and PIP-009/S27: a turn's record and the SPEC_TEST_RUN_PARENT environment value can both be set by any local process; a forged record only makes a run wait, and a forged or left-over value counts only when it names the run's own repository and a live process holding a record there, and then only lets the run skip waiting; the run still runs its test command and reads its own results"
      - item: C5
        outcome: scenarios
        ids: [PIP-009/S23, PIP-009/S27, PIP-009/S21]
        reason: an invalid maxTestRuns refuses the run at once (S23); a SPEC_TEST_RUN_PARENT naming a dead process, a process with no record, another repository or garbage is not trusted and the run waits (S27); an invalid filter or no config is refused before any wait (S21)
      - item: C6
        outcome: scenarios
        ids: [PIP-009/S13, PIP-009/S16, PIP-009/S28]
        reason: a lone run behaves as before (S13, checked on the main build); a waited run's result, output and 10-minute limit from its own start are as before (S16, R2); a project whose git folder is read-only keeps running its tests with the same result rather than failing with an internal error (S28)
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool or service; signal and environment behaviour is spec's own and was probed by the reviewer on the implementation
    documents: [PIP-009/S13, PIP-009/S21, PIP-009/S23]
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
      - new: Does SIGHUP (a terminal closing) stop the holder's test command?
        value: "Yes, like Ctrl-C and SIGTERM: the whole test command is stopped and the turn freed; only SIGKILL cannot be handled, as R3 states"
      - new: What does a run do when <git folder>/spec-test-runs cannot be made or written?
        value: "It prints one plain line on stderr ('<command>: no turn can be kept in <dir>: <reason>; running without one') and runs its test command without a turn, with the same result; refusing would break test runs in sandboxes with a read-only .git, and the turn never decides a result (INV-016)"
      - new: How is a nested run recognised?
        value: By SPEC_TEST_RUN_PARENT, which the holder hands to its test command and so to every process it starts, naming the holder's pid and the repository's git folder; only a value for the run's own repository and a live pid holding a record there counts
      - new: What does a run nested in a holder's test command do?
        value: It runs at once under its parent's turn and takes none of its own; a run on another repository takes that repository's turn
      - new: What does a run do with an invalid maxTestRuns?
        value: Refused at once with 'config.json has no testCommand', exit 1, as for any config that fails the schema today; it never waits
      - new: Where are turns kept, and how does a person free one?
        value: One file per held turn, '<git folder>/spec-test-runs/<pid>'; removing it frees the turn; the first notice names the folder
      - new: Is a record from before a machine restart still held?
        value: "No: a record written before the machine last started is free"
      - new: How is a run in a worktree without a ticket named?
        value: "'\"<name>\" in a worktree without a ticket (pid <pid>)'; it shares the turn like any other"
      - new: Is the limit kept across process namespaces (containers)?
        value: "No: turns hold among processes on one machine that see each other's pids, as R3 states"
      - new: What is the config key called?
        value: format.Config.maxTestRuns, beside maxParallel
      - new: Which config's maxTestRuns applies when the main checkout and worktrees differ?
        value: The config of the checkout or worktree the command runs in
      - new: Does 'spec config set' accept maxTestRuns?
        value: "No change: config set's key list (CLI-008/R4) is left as is; the key is set by editing config.json"
    duration_s: 150
  - at: 2026-11-11T13:30:40.579Z
    role: spec-review
    result: done
    summary: "Nesting, SIGHUP and S28 are sound; changes: S14/S16/S17 durations force slow tests, S21 last line cannot be set up, S28 holders"
    verdict: changes
    findings:
      - cites: [PIP-009/S16, PIP-009/S17, PIP-009/S14, PIP-009/R2]
        text: "The durations the scenarios pin cannot be checked in seconds. S16 names a 15-minute wait, a 9-minute test command and 24 minutes since the advance began; S17 names a 5-minute afterMerge and a command 'stopped after 10 minutes'; S14 asks for the same line 'once a minute'. Run for real, S16 alone takes 24 minutes and the suite (about 5.5 minutes today, with a 10-minute limit) cannot hold it. The tester can only check them through a clock or limit it sets, and the spec names none, so the tester is left to choose between a slow test and a test that compares a constant with itself (the weakness the code review found in S16). Restate each as the property it means, with the numbers as examples: the 10 minutes of R2 count from the test command's own start, whatever time the wait took; the turn is back when the test command ends, while the command that ran it is still busy; the notice repeats at a fixed interval (one minute) while the wait lasts. Say in R2 and R4 that the limit and the interval are the defaults of values a test may set, so a scaled-down check is a valid check of the scenario. The 10-minute stop ending in S17 needs this too: it cannot be run for real."
        class: C7
      - cites: [PIP-009/S21, PIP-009/R3, PIP-006/R7]
        text: "S21's last And cannot be arranged as written. 'Another run holds the only turn' is the Given, so a `spec merge` cannot reach format.Config.afterMerge, which runs only after its own test run on the merged result has passed (WSP-006), and a `spec check-report` cannot reach its checkCommands for the same reason; the only way is a holder that takes the turn after the merge's or check's own test run ended, which the scenario does not say. The sentence 'prints no line with \"waiting for a test run to finish\"' is also ambiguous: the configured command never prints spec's notice, so as read for the command it asserts nothing, and read for `spec check-report` or `spec merge` as a whole it fails whenever their own test run waits. Say who prints and who holds, and when: for each of checkCommands, worktreeSetup, afterMerge and the generated command, that the command starts and ends while a turn is held by a run that is not the one running it, and that the running spec command does not wait for that turn on its account (for the generated command, which runs before the merge's tests, the merge's own later test run still waits, as S14 says)."
        class: C7
      - cites: [PIP-009/S28, PIP-009/R3, INV-016]
        text: "S28's choice holds: INV-016 makes the turn an ordering device that never decides a result, a read-only git folder is a real sandbox case, and the run prints a plain line on stderr, so the overload is not silent for the run that causes it. One case is left open that a person plausibly hits: the folder exists and is readable, with live records of other runs in it (the main session holds the turn), but this run cannot write its own record (a sandboxed subagent with a read-only .git). S28 says 'runs without waiting' and R3 says 'runs its test command without a turn', so that run starts on top of a full suite, which is exactly the case this ticket exists for. Say what it does when it can read but not write: wait for the visible live holders without taking a turn, or run at once. Recommend the first (a holder it can read and whose process it can see is still an order it can respect), and run at once only when the folder can be neither read nor written. Also say in S28's Given how a test makes the folder unwritable that works for a user who can write anyway (for example a regular file in the folder's place), since a mode change does nothing for a root user."
        class: C5
      - cites: [PIP-009/R3, PIP-009/S27, INV-016]
        text: "Follow-up: the chain left out on purpose (repository A holds a turn, its test command runs spec in B, B's test command runs spec in A) is plausible only for a project that tests tools across repositories; it is not a case most users hit. It is a deadlock, not a wrong result: SPEC_TEST_RUN_PARENT is one value, B's holder replaces A's, so the last run waits for its own ancestor, and the notice names that ancestor, which the person can stop (INV-016). State it as a known limit in R3, next to the SIGKILL limit; a scenario is not needed."
        class: C3
      - cites: [PIP-009/R3, PIP-009/S25, PIP-008/R12]
        text: "Follow-up: the common git directory now holds `spec-test-runs/` (turns, PIP-009/R3) beside `spec/test-runs/<ID>.json` (kept runs, PIP-008/R12). The names differ by one character and mean different things; a person told to 'remove a file in spec-test-runs' (the notice, S25) can open the wrong folder. Consider a name that does not resemble the other, or say in R3 that the two are unrelated."
        class: C9
      - cites: [PIP-009/R4, PIP-022/R1, PIP-009/S21]
        text: "Follow-up: the code review found that `spec check-report` for a report naming a ticket whose stage does not run that role spends a full test run, and now a turn and a wait, before it is refused without having used the result (src/cli/report.ts:313-316). S21 lists the runs refused before the test command (an invalid filter, no config) that do not wait; a report refused for that reason is the same kind. Add it to R4's list of runs that do not wait, or leave it to a later ticket."
        class: C6
    assumed: []
    duration_s: 143
  - at: 2026-11-11T13:34:31.764Z
    role: spec-writer
    result: done
    summary: "PIP-009: durations as settable defaults, S17/S21 buildable, read-only turn folder waits, chain limit, folder names"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-009/S13, PIP-009/S16, PIP-009/S21, PIP-009/S23, PIP-009/S28]
        reason: spec impact reaches ADP-003, PIP-006, PIP-010, PIP-022, WSP-004/006/007 and the format/install neighbours; a lone run starts at once (S13), a wait changes no result, problem or exit code and the time limit counts from the command's start (S16), the configured commands of check-report, worktree add and merge never wait on their own account (S21), an invalid config is refused as any schema mismatch (S23), and a turn folder that does not work still gives the same result (S28); PIP-008/R12's spec/test-runs is named as unrelated to spec-test-runs (R3); a check-report that refuses without using its tests is left to PIP-004 in Out of scope
      - item: C2
        outcome: scenarios
        ids: [PIP-009/S15, PIP-009/S25, PIP-009/S26, PIP-009/S27, PIP-009/S28]
        reason: every worktree shares the turn however reached (S26); a record whose file predates the last boot is free (S25); a second repository takes its own turn (S27); a turn folder that is a regular file runs at once with a plain line, and one readable but not writable waits for the live holders it can see (S28); older pinned CLIs and the A-B-A chain across repositories are stated limits (R3, R5)
      - item: C3
        outcome: scenarios
        ids: [PIP-009/S14, PIP-009/S17, PIP-009/S18, PIP-009/S19, PIP-009/S21, PIP-009/S24, PIP-009/S27]
        reason: 8 runs asking at once never overlap (S14); the turn is back when the test command ends while check-report still runs its check command, for every ending (S17); a record being written is never unreadable (S18); a stopped waiter holds nothing (S19); configured commands run while another run holds the turn (S21); Ctrl-C, SIGTERM and SIGHUP stop the whole test command first (S24); a nested run does not wait for its parent (S27); durations are settable defaults (R2, R4), so each is a seconds-long check
      - item: C4
        outcome: invariant
        ids: [INV-016]
        reason: "shown by PIP-009/S22 and PIP-009/S27: a turn's record and SPEC_TEST_RUN_PARENT can be set by any local process; a forged record only makes a run wait, and a forged or left-over value counts only for the run's own repository and a live holder with a record, and then only lets the run skip waiting"
      - item: C5
        outcome: scenarios
        ids: [PIP-009/S23, PIP-009/S27, PIP-009/S21, PIP-009/S28]
        reason: an invalid maxTestRuns refuses at once (S23); an untrusted SPEC_TEST_RUN_PARENT is ignored and the run waits (S27); an invalid filter or no config is refused before any wait (S21); a run that cannot write its record still respects the live records it can read (S28)
      - item: C6
        outcome: scenarios
        ids: [PIP-009/S13, PIP-009/S16, PIP-009/S23, PIP-009/S28]
        reason: a lone run behaves as before (S13) and an invalid maxTestRuns gives today's schema refusal (S23), both run on the worktree build; a waited run's result and time limit are as before (S16); a broken turn folder runs the tests with the same result instead of an internal error (S28)
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool or service; file modes, process numbers and signals are spec's own handling, probed by the reviewer on the implementation
    documents: [PIP-009/S13, PIP-009/S23]
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
      - new: Are the 10-minute limit and the one-minute notice interval fixed?
        value: "No: they are defaults a test may set lower (R2, R4), so a check scaled to seconds is a valid check; users see the defaults"
      - new: How soon does a waiting run take a freed turn?
        value: Within 2 seconds (R4); the implementation polls every 100 ms
      - new: What does a run do when it can read the turn folder but cannot write its record?
        value: Prints the 'no turn can be kept' line, waits for the live records it can read as R4 says, then runs without a record; it runs at once only when the folder can be neither read nor written
      - new: Does a check-report that refuses a report without using its tests skip the test run?
        value: "Not in this ticket: Out of scope names it for PIP-004; while it runs the tests, that run takes and waits for a turn like any other"
      - new: Should spec-test-runs be renamed away from spec/test-runs?
        value: "No: R3 says the two folders are unrelated; the code and tests already use spec-test-runs"
      - new: Does SIGHUP stop the holder's test command?
        value: Yes, like Ctrl-C and SIGTERM; SIGKILL and the A-B-A chain across repositories are the known limits in R3
      - new: How is a nested run recognised?
        value: By SPEC_TEST_RUN_PARENT, handed by the holder to its test command and every process it starts, naming the holder's pid and the repository's git folder; only a value for the run's own repository and a live holder with a record counts
      - new: What does a run do with an invalid maxTestRuns?
        value: Refused at once with 'config.json has no testCommand', exit 1, as for any config that fails the schema; it never waits
      - new: Where are turns kept, and how does a person free one?
        value: One file per held turn, '<git folder>/spec-test-runs/<pid>'; removing it frees the turn; the first notice names the folder
      - new: How is a run in a worktree without a ticket named?
        value: "'\"<name>\" in a worktree without a ticket (pid <pid>)'; it shares the turn like any other"
      - new: Is the limit kept across process namespaces (containers)?
        value: "No: turns hold among processes on one machine that see each other's pids, as R3 states"
      - new: What is the config key called?
        value: format.Config.maxTestRuns, beside maxParallel
      - new: Which config's maxTestRuns applies when the main checkout and worktrees differ?
        value: The config of the checkout or worktree the command runs in
      - new: Does 'spec config set' accept maxTestRuns?
        value: "No change: config set's key list (CLI-008/R4) is left as is; the key is set by editing config.json"
    duration_s: 228
  - at: 2026-11-11T13:36:37.414Z
    role: spec-review
    result: done
    summary: "Round-3 findings fixed: S14-S17 state properties, S21 steps buildable, S28 waits on readable records; approved, 5 follow-ups"
    verdict: approve
    findings:
      - cites: [PIP-009/R2, PIP-009/R4, PIP-009/S14, PIP-009/S16, PIP-009/S17]
        text: "Follow-up: R2 and R4 say the 10-minute limit and the one-minute notice interval are 'a default a test may set lower', but name no way to set them. Tests of S16, S17 and S14 start real CLI processes, so an in-process constant (TEST_TIMEOUT_MS in src/io/test-command.ts is one today) cannot be reached; the tester has to invent an environment value or config key, and the implementer has to guess the same one from the tests. Name the two settings once in R2 and R4 (for example one environment value each) and say a lower value only ends a test command sooner or repeats the notice sooner, so INV-016 is untouched."
        class: C7
      - cites: [PIP-009/S20, PIP-009/S22, PIP-009/S18, PIP-009/S25, PIP-009/R3]
        text: "Follow-up: S18, S22 and S25 need a test to write a record by hand (a pid, a ticket, a command, a start order), but the spec says only that a record is the file '<git folder>/spec-test-runs/<pid>' 'written whole at once'; its content is nowhere stated. The tester has already had to assume a JSON shape. State the fields a record holds (process number, command name, ticket or location, order of taking the turn), or say a test must build such a holder by starting a real run. S22 also needs 'process 1 is alive' to hold for a user who may not signal it, so say a process that exists but cannot be signalled counts as alive."
        class: C7
      - cites: [PIP-009/S25, PIP-009/R4]
        text: "Follow-up: 'takes the freed turn within 2 seconds' (S25, R4) is a bound the suite cannot hold on a loaded machine (this repository's own load is what the ticket is about), so a test of it fails by timing luck. Make the polling interval another default a test may set (as R2 and R4 do for the limit and the notice) and word the check as 'without waiting for the next notice', or state a bound a loaded test run can meet."
        class: C7
      - cites: [PIP-009/S17, PIP-009/S21, PIP-006/R7]
        text: "Follow-up: S17 and S21 rest on `check-report` running its checkCommands after its own test run has ended. src/cli/report.ts computes the tests before checkCommandProblems, so the current build does this, but PIP-006/R7 says only that the commands run 'in order, for a done stage' and PIP-004 states no order against the test run. Say in PIP-009 (R3 or the two scenarios) that this is the order, so a later change of it breaks a scenario instead of making S17 and S21 impossible to build."
        class: C6
      - cites: [PIP-009/S28, PIP-009/R3]
        text: "Follow-up: S28's second case (a readable folder that this user cannot write) can only be built by a user who is not root, so on a root build machine its test either skips or passes without checking anything. Say the test skips for root rather than passes, so a build that never waits there cannot pass on that machine unnoticed. A run that cannot add its own record is also invisible to the others, so two such runs can start together; R3 states the run is 'without a turn of its own', which is enough, and this is the known cost of the choice."
        class: C7
    assumed: []
    duration_s: 123
  - at: 2026-11-11T15:00:43.583Z
    role: tester
    result: done
    summary: "Three runs repeat six assertion failures: timer seams, SIGHUP handling, and S28 folder fallbacks."
    verdict: null
    mutations:
      - scenario: PIP-009/S13
        wrong: Prints a waiting notice for a lone run even though no other test command holds a turn.
      - scenario: PIP-009/S14
        wrong: Uses a non-atomic turn acquisition, allowing multiple of eight synchronized test commands to be active together.
      - scenario: PIP-009/S15
        wrong: Keeps separate turn folders for the main checkout and ticket worktrees.
      - scenario: PIP-009/S16
        wrong: Starts the test timeout before the run has waited for its turn, so the wait consumes the test command's time limit.
      - scenario: PIP-009/S17
        wrong: Keeps the turn record until check-report's checkCommands finish instead of releasing it when the test command ends.
      - scenario: PIP-009/S18
        wrong: Treats an unreadable live record as occupied instead of taking it over.
      - scenario: PIP-009/S19
        wrong: Leaves a stopped waiter queued so the later spec gaps run cannot start after the holder ends.
      - scenario: PIP-009/S20
        wrong: "Ignores maxTestRuns: 2 and allows a third test command to run while two are active."
      - scenario: PIP-009/S21
        wrong: Makes checkCommands, worktreeSetup, afterMerge, or generated.command wait for a test turn.
      - scenario: PIP-009/S22
        wrong: Runs or displays untrusted command and ticket text from a forged record instead of rendering an unknown run.
      - scenario: PIP-009/S23
        wrong: "Treats maxTestRuns: 0 as a turn limit that waits forever rather than refusing the run immediately."
      - scenario: PIP-009/S24
        wrong: Handles Ctrl-C and SIGTERM but leaves the test command running when its holder receives SIGHUP.
      - scenario: PIP-009/S25
        wrong: Keeps a live PID record whose mtime predates 2000, or waits for another notice after its file is removed.
      - scenario: PIP-009/S26
        wrong: Uses the path used to reach a worktree as a separate lock namespace instead of its canonical common git folder.
      - scenario: PIP-009/S27
        wrong: Trusts SPEC_TEST_RUN_PARENT without checking the repository and a live record for its PID.
      - scenario: PIP-009/S28
        wrong: Throws an internal error on EEXIST or EACCES instead of running turnless and waiting on readable live records.
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
      - new: How tests lower the test-command time limit
        value: Set SPEC_TEST_RUN_TIMEOUT_MS in milliseconds below the 600000 ms default.
      - new: How tests lower the notice interval
        value: Set SPEC_TEST_RUN_NOTICE_INTERVAL_MS in milliseconds below the 60000 ms default.
      - new: How tests lower the polling interval
        value: Set SPEC_TEST_RUN_POLL_INTERVAL_MS in milliseconds below the 100 ms default.
      - new: Turn-record encoding and ordering
        value: JSON contains pid, command, ticket, startedAt, and location when needed for display; filesystem mtime orders records.
      - new: How to test taking a freed turn
        value: Use a 10 ms polling interval and assert the waiter starts before the next notice, rather than asserting a wall-clock bound.
    duration_s: 5043
  - at: 2026-11-11T16:29:06.581Z
    role: implementer
    result: blocked
    summary: Implemented turn timing, signal cleanup, turnless fallback and UTF-8-safe output; S14's test setup races.
    verdict: null
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
      - new: Why the turnProcessId and spawnSync test seams remain
        value: The tsx source CLI tests assert the wrapper PID, and PIP-022 tests replace spawnSync to simulate timeout/start errors and concurrent advances.
    duration_s: 5294
  - at: 2026-11-11T16:29:20.738Z
    role: tester
    result: reopened
    summary: reopened by PROP-113#Q3
    verdict: null
    assumed: []
  - at: 2026-11-11T16:42:15.642Z
    role: tester
    result: done
    summary: S14 setup no longer hangs; three runs consistently reached its notice assertion.
    verdict: null
    mutations:
      - scenario: PIP-009/S14
        wrong: Uses non-atomic turn acquisition, allowing multiple of eight synchronized test commands to be active together.
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
      - new: How tests lower the test-command time limit
        value: Set SPEC_TEST_RUN_TIMEOUT_MS in milliseconds below the 600000 ms default.
      - new: How tests lower the notice interval
        value: Set SPEC_TEST_RUN_NOTICE_INTERVAL_MS in milliseconds below the 60000 ms default.
      - new: How tests lower the polling interval
        value: Set SPEC_TEST_RUN_POLL_INTERVAL_MS in milliseconds below the 100 ms default.
      - new: Turn-record encoding and ordering
        value: JSON contains pid, command, ticket, startedAt, and location when needed for display; filesystem mtime orders records.
      - new: How to test taking a freed turn
        value: Use a 10 ms polling interval and assert the waiter starts before the next notice, rather than asserting a wall-clock bound.
    duration_s: 772
  - at: 2026-11-11T17:02:48.017Z
    role: implementer
    result: blocked
    summary: Loaded reproduction exposes an S17 timeout-fixture race; the other 151 focused tests passed.
    verdict: null
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
      - new: Why the turnProcessId and spawnSync test seams remain
        value: The tsx source CLI tests assert the wrapper PID, and PIP-022 tests replace spawnSync to simulate timeout/start errors and concurrent advances.
    duration_s: 1221
    refusals: 1
  - at: 2026-11-11T17:02:50.394Z
    role: tester
    result: reopened
    summary: reopened by PROP-113#Q4
    verdict: null
    assumed: []
  - at: 2026-11-11T17:21:45.362Z
    role: tester
    result: done
    summary: S17 now orders on the check marker; solo and loaded runs kept the same six assertion failures.
    verdict: null
    mutations:
      - scenario: PIP-009/S17
        wrong: Keeps the turn until check-report exits, so its waiter cannot finish while checkCommands is held open.
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
      - new: How tests lower the test-command time limit
        value: Set SPEC_TEST_RUN_TIMEOUT_MS in milliseconds below the 600000 ms default.
      - new: How tests lower the notice interval
        value: Set SPEC_TEST_RUN_NOTICE_INTERVAL_MS in milliseconds below the 60000 ms default.
      - new: How tests lower the polling interval
        value: Set SPEC_TEST_RUN_POLL_INTERVAL_MS in milliseconds below the 100 ms default.
      - new: Turn-record encoding and ordering
        value: JSON contains pid, command, ticket, startedAt, and location when needed for display; filesystem mtime orders records.
      - new: How to test taking a freed turn
        value: Use a 10 ms polling interval and assert the waiter starts before the next notice, rather than asserting a wall-clock bound.
    duration_s: 1132
  - at: 2026-11-11T17:39:52.023Z
    role: implementer
    result: done
    summary: PIP-009 turn behavior verified alone and under load; all requested focused checks pass.
    verdict: null
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
      - new: Why the turnProcessId and spawnSync test seams remain
        value: The tsx source CLI tests assert the wrapper PID, and PIP-022 tests replace spawnSync to simulate timeout/start errors and concurrent advances.
    duration_s: 1076
  - at: 2026-11-11T17:56:53.310Z
    role: reviewer
    result: done
    summary: "Code holds under probes; changes: 3 env values unspecified, 6 tests fail by timing at load 55"
    verdict: changes
    findings:
      - cites: [PIP-009/R2, PIP-009/R4, PIP-009/S16, PIP-009/S17, INV-016]
        text: "src/io/test-run-turn.ts:34-40 adds three environment values the spec never names: SPEC_TEST_RUN_TIMEOUT_MS, SPEC_TEST_RUN_NOTICE_INTERVAL_MS and SPEC_TEST_RUN_POLL_INTERVAL_MS. R2 and R4 say only 'a default a test may set lower'; the spec-review's earlier follow-up asked to name the settings and the spec-writer did not. They are an observable option that every process of the user can set and that reaches every process the test command starts (the CLI passes process.env on, so a project's own fixture runs inherit a value exported in the shell). Probed against the bundle: only an integer of 1 or more below the default is used (0, negative, empty, text, 1.5, 1e12, 99999999999, Infinity, 600000 and 700000 all give the default; '0x10' and ' 7 ' are accepted as 16 and 7); with every value tried the second run still waited and printed its notice, nothing skipped a wait or ran past 10 minutes, and a limit of 1000 ms on a 3 s command gives 'spawnSync /bin/sh ETIMEDOUT' (no results, so it can never pass). R2/R4/INV-016 must name the three values, say that a value that is not a whole number of milliseconds below the default is ignored, that a lower time limit can only turn a run into one with no results, and that the poll interval is also how often a waiter retries."
        spec: true
        class: C4
      - cites: [PIP-009/S18, PIP-009/S22, PIP-009/S24, PIP-009/S27, PIP-009/S28]
        text: "Tests that need a process to reach a point before a deadline in the test file expires, with a process start (tsx, about 0.5 s alone) inside the deadline: S18 test-runs.test.ts:506 (1.5 s for the run to start or print), S22 :746 and :757 (1.5 s for the first notice, twice), S27 :932 (3 s for the nested bundle run), :948 and :954 (2 s each for the second repository's nested run), S28 :1071 (1.5 s for the notice) and :1087 (2 s), S24 :801 (2 s), :802 (1 s) and :809 (1.5 s after the signal). Measured: the file passes alone (3 runs), and with 30 busy processes (load about 14); with 80 busy processes (load about 55, the load PROP-113 is about) S18 ('unreadable live record was not taken over promptly'), S22 ('forged holder was not rendered as unknown'), S27 ('second-repository nested run did not resolve its own turn') and the second S28 test ('did not announce its missing write turn') fail on exactly these deadlines. Make each wait one for an event with the 10 s default or more (or none), and keep only lower bounds (at least X ms passed) as timing checks."
        tests: true
        class: C7
      - cites: [PIP-009/S27, PIP-009/R2]
        text: S27's holder is started with SPEC_TEST_RUN_TIMEOUT_MS=5000 (test-runs.test.ts:926), and that limit covers the holder's whole test command, which includes the nested same-repository run, the wait for the test to start a second tsx holder in another repository and write 'allow-other', and the second-repository nested run. Under load that choreography is stopped by the time limit and the check fails with no results. The limit adds nothing the test needs (a nested run that waited on its parent would fail the test on its own deadline); drop it or make it larger than any wait in the test.
        tests: true
        class: C7
      - cites: [PIP-009/S14, PIP-009/S16, PIP-009/S17, PIP-009/S25, PIP-009/R4]
        text: "Tests whose pass depends on a timer inside the CLI against a timer in the test: S14 :293 needs 4 notices of a 100 ms interval within 1.5 s; S16 :417 needs 12 notices within 2.5 s, and the advance's own test command has a 1000 ms limit (:409) that must not expire between its start and the test's release of it (start-to-release latency under load is not bounded by 1 s); S17 timeout ending :448 sets a 500 ms limit that the command's first steps (mkdir, touch, mkdir) must beat before it is stopped, or 'starts' never gets its line; S25 :847 expects the waiter to take the freed turn before its next 500 ms notice and asserts exactly one waiting line (:849), which fails when the waiter process is stopped for 500 ms by load. Replace deadlines by lower bounds (hold the holder until at least limit+margin has passed, measured from the waiter's first notice, with no upper bound), start the test command's clock from a marker written by the command's first statement, and for S25 use the default 60 s notice interval and assert no second notice, with the poll interval at 10 ms."
        tests: true
        class: C7
      - cites: [PIP-009/S17, PIP-009/S21, PIP-009/S24]
        text: S17 (four endings), S21 (five arranged steps) and S24 (three signals) are each one `it` that starts 8 to 12 tsx processes one after the other; at load about 55 S17 and S21 hit vitest's 30 s testTimeout (30054 ms and 30098 ms) and S24 took 27.5 s. Split each into one test per ending, step and signal (an it.each), so a slow machine fails none of them for the sum of the others.
        tests: true
        class: C7
      - cites: [PIP-009/S14, PIP-009/S16, PIP-009/S17, PIP-009/S21, PIP-009/S27]
        text: "Mutations tried on a scratch copy, each against the file's own test: S14 'no directory gate in underGate' fails 3 of 3 runs (the 8-run release sees 2 or 3 starts); S16 'time limit counted from the request, not from the command's start' fails; S17 and S21 'record not removed until the process exits' both fail; S27 'a marker is trusted without a live record for its pid' fails (the dead-pid and no-record cases do not wait). These now fail on a wrong build. Not mutated: S27 'marker accepted whatever repository it names', because its nested run uses the fixture's bundled CLI, not the source under test, so only the marker cases in the loop (:985-1021) test it; they do catch it when the foreign holder's record is live."
        class: C7
      - cites: [PIP-009/R3, PIP-009/S28]
        text: "Follow-up: when the folder '<git folder>/spec-test-runs' is removed while a run waits in it (a person who reads 'each turn is a file in ...' and removes the whole folder), the waiter's next gate call fails with ENOENT, falls into the S28 branch ('no turn can be kept ...; running without one') and starts its test command while the old holder's command is still running. Probed on the bundle. A person who removes the folder frees every turn on purpose, so it is rare and harmless to results, but the run could make the folder again once before it decides no turn can be kept."
        class: C3
      - cites: [PIP-009/R3]
        text: "Follow-up (unchanged since the last review): underGate (src/io/test-run-turn.ts:255-287) removes a gate whose owner is dead and then makes its own, so two waiters that judged the same dead gate stale can remove each other's fresh gate and both run the section that decides the last free turn; it needs a gate left by a killed run and was not reproduced (16 runs over a planted dead gate, 4 times, in the last review). A killed run can also leave '.turn-gate-<pid>-XXXXXX' folders (mkdtemp before rename) that nothing removes."
        class: C3
      - cites: [PIP-009/R3, PIP-022/S4]
        text: "Follow-up on the two test seams, judged: turnProcessId() (argv[1] ends in .ts -> parent pid) is acceptable, it changes nothing in the bundle and the tests assert the tsx launcher's pid; the hazard is that `node --import tsx src/cli/main.ts` run from a shell names the shell's pid, so two such runs from one shell share one record file (development only). The `childProcess.spawnSync !== builtinSpawnSync` branch (test-run-turn.ts:593-605) is acceptable for the same reason but is a second path: it takes none of the process-group, signal, UTF-8 and lowered-limit behaviour, so the PIP-022 tests that replace spawnSync check the old path, and anything that patches child_process.spawnSync in a real run (a preload that instruments it) would silently drop the interruptible path. The shipped path's time-out, ENOBUFS and spawn-error mapping is covered only by S17's real time-out ending and by probes (same message and time as main at 70 MB). Consider a named test seam instead of comparing function identity."
        class: C6
    assumed: []
    duration_s: 1011
  - at: 2026-11-11T17:59:45.617Z
    role: spec-writer
    result: done
    summary: "PIP-009: names the three SPEC_TEST_RUN_*_MS settings, the turn record's fields, folder re-made, deadlines as lower bounds"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-009/S13, PIP-009/S16, PIP-009/S21, PIP-009/S23, PIP-009/S29]
        reason: spec impact reaches ADP-003, PIP-006, PIP-010, PIP-022, WSP-004/006/007 and the format/install neighbours; a lone run starts at once (S13), a wait changes no result and the time limit counts from the command's start (S16), configured commands never wait and check-report runs its check commands after its own test run (S21, R3), an invalid config is refused as any schema mismatch (S23), and a lowered time limit gives PIP-022's no-results case, never a pass (S29); the check-report that refuses without using its tests stays in Out of scope for PIP-004
      - item: C2
        outcome: scenarios
        ids: [PIP-009/S25, PIP-009/S26, PIP-009/S27, PIP-009/S28, PIP-009/S29]
        reason: a turn folder removed while a run waits is made again (S25, R3); every worktree shares the turn however reached (S26); a second repository takes its own turn (S27); a broken or read-only turn folder (S28), skipped rather than passed when the test runs as a user who can write anyway; settings in the environment reach every process the test command starts (S29, pipeline.TestRunSettings)
      - item: C3
        outcome: scenarios
        ids: [PIP-009/S14, PIP-009/S17, PIP-009/S18, PIP-009/S24, PIP-009/S25, PIP-009/S29]
        reason: 8 runs at once never overlap and notices are a lower bound (S14); the turn is back when the test command ends while check-report runs its check command (S17); a record being written is never unreadable (S18); signals stop the whole test command first (S24); a freed turn is taken at the waiter's next look, an order of events, not a deadline (S25, R4); with notice and poll intervals of 1 ms a second run still waits (S29)
      - item: C4
        outcome: invariant
        ids: [INV-016]
        reason: "shown by PIP-009/S22, PIP-009/S27 and PIP-009/S29: the turn record (pipeline.TestRunTurn), SPEC_TEST_RUN_PARENT and the three pipeline.TestRunSettings values can be set by any local process; a forged record only makes a run wait, a forged parent value only lets a run skip waiting, and a setting only lowers a default, a lower time limit giving no results, never a pass"
      - item: C5
        outcome: scenarios
        ids: [PIP-009/S29, PIP-009/S23, PIP-009/S27, PIP-009/S18]
        reason: a setting that is not plain decimal digits below its default ('0x10', ' 7 ', '1e3', '1.5', '0', '', '700000') is ignored (S29); an invalid maxTestRuns refuses at once (S23); an untrusted parent value is ignored (S27); a record that is not a well-formed pipeline.TestRunTurn is free (S18)
      - item: C6
        outcome: scenarios
        ids: [PIP-009/S13, PIP-009/S16, PIP-009/S23, PIP-009/S29]
        reason: a lone run behaves as before (S13) and an invalid maxTestRuns gives today's refusal (S23), both run on the worktree build; with no settings in the environment the defaults (10 minutes, 1 minute, 100 ms) apply as before (S29, R2, R4)
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool or service; the settings, record and signals are spec's own, and the reviewer probed them on the built CLI
    documents: [PIP-009/S13, PIP-009/S23]
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
      - new: Which spellings of a SPEC_TEST_RUN_*_MS value are used?
        value: Only plain decimal digits (no sign, spaces, point, exponent or 0x prefix) for 1 or more below the default; '0x10', ' 7 ' and '1e3', which the code accepts today, are ignored
      - new: What does a run do when the turn folder disappears while it waits?
        value: It makes the folder again once and takes a turn there; only a folder that still cannot be made or written leads to S28's line
      - new: What does a turn record hold?
        value: A JSON object with pid (the file's name), command, ticket or null, startedAt (ISO time) and an optional location ticket/main/worktree; holders are ordered by file modification time; anything else is unreadable and free
      - new: Is a process this user may not signal alive?
        value: "Yes: a process that exists counts as alive whether or not it may be signalled"
      - new: What about the gate race over a dead gate, leftover .turn-gate folders and the two test seams?
        value: Implementation matters with no behaviour the spec states beyond R3's 'never both take the last free turn'; left to the implementer and reviewer, not specified
      - new: What about the tests' deadlines under load?
        value: For the tester; the spec now words S14, S25 and S16 as lower bounds or orders of events, so no scenario forces a deadline
      - new: What does a run do when it can read the turn folder but cannot write its record?
        value: Prints the 'no turn can be kept' line, waits for the live records it can read, then runs without a record; at once only when the folder can be neither read nor written
      - new: Does SIGHUP stop the holder's test command?
        value: Yes, like Ctrl-C and SIGTERM; SIGKILL and the A-B-A chain across repositories are the known limits in R3
      - new: How is a nested run recognised?
        value: By SPEC_TEST_RUN_PARENT, handed by the holder to its test command and every process it starts; only a value for the run's own repository and a live holder with a record counts
      - new: What does a run do with an invalid maxTestRuns?
        value: Refused at once with 'config.json has no testCommand', exit 1, as for any config that fails the schema; it never waits
      - new: Where are turns kept, and how does a person free one?
        value: One file per held turn, '<git folder>/spec-test-runs/<pid>', unrelated to spec/test-runs; removing it frees the turn
      - new: Is the limit kept across process namespaces (containers)?
        value: "No: turns hold among processes on one machine that see each other's pids, as R3 states"
      - new: What is the config key called?
        value: format.Config.maxTestRuns, beside maxParallel
      - new: Which config's maxTestRuns applies when the main checkout and worktrees differ?
        value: The config of the checkout or worktree the command runs in
      - new: Does 'spec config set' accept maxTestRuns?
        value: "No change: config set's key list (CLI-008/R4) is left as is; the key is set by editing config.json"
    duration_s: 169
  - at: 2026-11-11T18:02:05.104Z
    role: spec-review
    result: done
    summary: "Settings, record contract and event-based S14/S25 hold: no setting skips a wait or makes a pass; approved, 7 follow-ups"
    verdict: approve
    findings:
      - cites: [pipeline.TestRunSettings, pipeline.TestRunSettings.SPEC_TEST_RUN_TIMEOUT_MS, PIP-009/S29, PIP-009/R2]
        text: "Follow-up: the settings can only lower a default and a value that is not plain digits below it is ignored without a word. The case a person plausibly meets is the opposite wish: after a 21-minute suite hit its limit (the story behind this ticket) someone exports SPEC_TEST_RUN_TIMEOUT_MS=1200000 to allow more, nothing changes, and nothing says why. The reverse also happens: a lowered value left in a shell makes every run end with no results and a timeout text that does not say a setting set the limit. State that the no-results reason names the limit in effect (for example 'timed out after <n> ms') or that an ignored value is reported in one stderr line. On the trust side the contract holds: nothing in S29 or INV-016 lets a setting skip a wait, lengthen a run past its default, or turn a failure into a pass."
        class: C9
      - cites: [pipeline.TestRunSettings, PIP-009/S29]
        text: "Follow-up: 'plain decimal digits' leaves two inputs open that S29's list does not pin: leading zeros ('0007') and digits that are not ASCII. Say whether '0007' counts as 7 and that only the ASCII digits 0 to 9 count. S29 also says the command 'would pass after running for 3 seconds'; ten values of it run one after another take 30 seconds, so the scenario should say 'longer than the lowered limit' and let a test run the ignored values with a short command, except '1e3' and '0x10', which only differ from the default when the command outlasts 1 second."
        class: C9
      - cites: [PIP-009/R2, PIP-009/S17, PIP-009/S24, PIP-009/S11]
        text: "Follow-up: S24 says the interrupted holder's test command and every process it started are stopped before the turn is freed, but R2, S11 and the time-limit ending of S17 say only 'stopped'. A suite that is stopped at its limit under heavy load (the very incident this ticket is about) can leave its workers running while the waiting run starts at full load, which is the overload the turn exists to prevent. The code stops the whole group after the limit; the spec should say the time-limit stop reaches every process the command started, as S24 does, and S17's timeout ending should check that none is still running."
        class: C3
      - cites: [pipeline.TestRunTurn, PIP-009/R3, PIP-009/S20, PIP-009/S14]
        text: "Follow-up: holders are ordered by the files' modification times (R3, pipeline.TestRunTurn), which only decides the order of names in the notice (S20), since no rule picks which waiter gets a freed turn. Two records written within one timestamp tick (a coarse file system, or two runs that start together under maxTestRuns 2) have no stated tie-break, so S20's 'in the order they took their turns' can come out either way for a correct build. Say the tie goes to the lower process number, and that waiters are not served in any order (so S19, S14's eight runs and the S28 wait assert none)."
        class: C3
      - cites: [PIP-009/R3, PIP-009/S25, pipeline.TestRunTurn]
        text: "Follow-up: 'modified before the machine last started' compares a file's modification time with the boot time. A clock that is stepped forward after boot (a machine that starts with a wrong date and then reaches a time server, a resumed virtual machine) puts a live holder's record before the computed boot time, so a live holder is taken over and two runs start together. Rare on a developer's own machine; say in R3 whether the check also needs the record's process to have started before the boot time, or accept it as a known limit beside the other two."
        class: C2
      - cites: [PIP-009/S13, PIP-009/S18, PIP-009/S21, PIP-009/S23, PIP-009/S28]
        text: "Follow-up: 'starts at once', 'fails at once' and 'runs at once, without waiting' (S13, S18, S21, S23, S28) read as a time bound; the code review's S18 and S28 tests failed on 1.5 to 2 second deadlines under load. Say once in the Rules (or in each scenario) that 'at once' means with no wait on another run and no waiting line, checked by the event that the command ran, never by a deadline. Likewise S14's 'a wait that lasts at least 3 intervals prints it at least 4 times' is not guaranteed for a correct build whose timer is late under load (a stalled process fires one late tick, not three); word it as 'a waiting run keeps printing the line, no two lines closer than one interval', so the test waits for the nth line as an event and holds the holder until it has seen it, with a lower bound only."
        class: C7
      - cites: [PIP-009/R4, pipeline.TestRunTurn, pipeline.TestRunTurn.location]
        text: "Follow-up: R4 says a holder is shown as 'an unknown run' when its ticket is not a ticket ID or its command is not one of the five, while pipeline.TestRunTurn says a record with no location is shown as unknown. R4 has no rule for a record whose location is 'ticket' with a ticket of null, 'main' with a ticket, or a location outside the three values. Put the whole rule in one place: a holder is named only when command is one of the five and location is one of the three and, for 'ticket', ticket is a ticket ID; anything else is an unknown run."
        class: C9
    assumed: []
    duration_s: 137
  - at: 2026-11-11T18:54:31.860Z
    role: tester
    result: done
    summary: Event-driven, split tests passed implemented behavior under load; S25/S29 show four assertion failures.
    verdict: null
    mutations:
      - scenario: PIP-009/S13
        wrong: Prints a waiting notice or waits even though no other test command holds a turn.
      - scenario: PIP-009/S14
        wrong: Omits the atomic turn gate, allowing multiple of eight simultaneously released test commands to overlap.
      - scenario: PIP-009/S15
        wrong: Keys turns by checkout path instead of common git directory, so a main checkout and its worktree can run concurrently.
      - scenario: PIP-009/S16
        wrong: Starts the test-command timer when a run begins waiting, so the command is already expired when its turn is freed.
      - scenario: PIP-009/S17
        wrong: Keeps the holder's turn record until check-report exits, preventing a waiter from finishing during its held checkCommands command.
      - scenario: PIP-009/S18
        wrong: Treats an unreadable record for a live process as an occupied turn instead of taking it over.
      - scenario: PIP-009/S19
        wrong: Leaves a canceled waiter queued, so it starts its test command after the holder ends and blocks spec gaps.
      - scenario: PIP-009/S20
        wrong: Ignores maxTestRuns=2 and allows only one active test-command turn.
      - scenario: PIP-009/S21
        wrong: Makes checkCommands, worktreeSetup, afterMerge and generated commands acquire or wait for a test-run turn.
      - scenario: PIP-009/S22
        wrong: Trusts forged record fields as holder metadata instead of displaying an unknown run and waiting.
      - scenario: PIP-009/S23
        wrong: "Treats maxTestRuns: 0 as a zero-capacity queue instead of refusing the invalid config immediately."
      - scenario: PIP-009/S24
        wrong: Forwards the interrupt only to the CLI wrapper, leaving its test-command child alive when the waiter starts.
      - scenario: PIP-009/S25
        wrong: Does not recreate a removed turn folder, so the waiter runs without taking a turn of its own.
      - scenario: PIP-009/S26
        wrong: Uses the literal --root or symlink path as lock identity instead of the common git directory.
      - scenario: PIP-009/S27
        wrong: Trusts SPEC_TEST_RUN_PARENT by pid alone and lets a nested run in another repository skip that repository's turn.
      - scenario: PIP-009/S28
        wrong: When a readable turn folder is not writable, starts without a turn instead of waiting for the live record.
      - scenario: PIP-009/S29
        wrong: Uses Number() for timeout settings, so '0x10', ' 7 ' and '1e3' lower the timeout instead of being ignored.
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
      - new: Test-run setting values
        value: Only plain decimal values of 1 or more below each default are used; other spellings are ignored.
      - new: Turn-record format
        value: A JSON object holds pid, command, ticket or null, startedAt and optional location; file modification time orders holders.
      - new: Taking a freed turn
        value: Use a 10 ms polling interval and assert the waiter starts before the next notice, not a wall-clock bound.
      - new: Test watchdogs
        value: Wait for markers, stderr lines or exits; use a 30-second watchdog and 60-second test timeout (180 seconds for S27).
      - new: Removed turn folder
        value: A waiter recreates the folder and takes its own recorded turn.
      - new: Readable but unwritable turn folder
        value: A non-root test waits for readable live records without recording its own turn; root skips this case.
    duration_s: 3144
    refusals: 1
  - at: 2026-11-11T19:36:49.359Z
    role: implementer
    result: done
    summary: Strict settings, validated records, folder recreation, and group/stale-gate cleanup; focused checks pass.
    verdict: null
    assumed:
      - question: PROP-113#Q1
        value: "Yes: an optional whole number in spec/config.json, 1 or more, default 1"
      - question: PROP-113#Q2
        value: It does not give up on its own; the notice repeats every minute so a person or the session can stop it
      - new: Why the turnProcessId and spawnSync test seams remain
        value: The tsx source CLI tests assert the wrapper PID, and PIP-022 tests replace spawnSync to simulate timeout/start errors and concurrent advances.
    duration_s: 2535
  - at: 2026-11-12T03:25:24.024Z
    role: reviewer
    result: done
    summary: "Approve: 39 tests pass at 80 busy processes, S25/S29 mutations fail, parsing and gate probes hold; follow-ups only"
    verdict: approve
    findings:
      - cites: [PIP-009/S25, PIP-009/S29, PIP-009/R3, PIP-009/R4, INV-016]
        text: "Follow-up: checks done this round, all held. (1) tests/cli/test-runs.test.ts, 39 tests, with 80 busy processes: all 39 pass in 356 s (S27 44.7 s, the longest; no test near its 60 s limit); alone and earlier loads also pass. A run with 160 and one with 144 busy processes (load 130 to 216) did not finish within the tool's limits and was stopped, so nothing is known above about 80. (2) Parsing against the bundle: '0007' and '00000000000000000000001' are used (ETIMEDOUT), while '+5', '5 ', an Arabic digit, '', '600000', '0600000', '1e3', '0x10', ' 7 ', '-1' and '0' are ignored; '599999' and '1000' are used and do not stop a 0.8 s command. (3) 16 and 20 runs started together, over a clean folder and over a planted dead gate (owner 999999, 2, 4 and 16 runs): every run passed, never more than one test command active, no record left; a gate with no owner file is taken over; an abandoned '.turn-gate-<dead pid>-*' folder is removed. (4) A folder removed while a run waits: the waiter makes it again, takes a turn with a record and prints no 'no turn can be kept' line. (5) Mutations on a scratch copy: Number() in place of the digit check fails the three S29 cases '1e3', '0x10' and ' 7 '; a recreateRunDirectory that does nothing fails 'S25 A waiter restores a turn folder removed while it waits'. Earlier mutations (S14 gate, S16 timer, S17/S21 record kept, S27 marker) were caught last round and their tests are only restructured."
        class: C7
      - cites: [PIP-009/S29, PIP-009/S16, PIP-009/S17]
        text: "Follow-up: three tests still tie a limit inside the CLI to a pace outside it, all passed at 80 busy processes and fail only if a process is stopped for seconds. S29 'A lower time limit gives no results' (test-runs.test.ts:1170) stops a 3 s command with a 1000 ms limit: a CLI stalled for 2 s after the spawn lets the command finish and gives a pass. S16 (:437) gives the advance's own test command a 3000 ms limit; the command is two statements, but its start-to-finish time is bounded by that limit. S17 timeout (:474) gives a 5000 ms limit to a command that must start a node child and write its pid within it (:481). Make the command wait on a marker the test writes after it sees the stop, as the other tests do. Also waitForStarted and waitForOutput still default to 10 s (:126, :239) where the other waits use the 30 s watchdog; raise them to it."
        class: C7
      - cites: [PIP-009/R3, PIP-009/S18]
        text: "Follow-up: a gate folder whose owner file names a live process that is not a run (a process number reused after a crash or a reboot) is never taken over now (staleGate dropped the 30 s age fallback), and the waiters wait for it silently: a lone run was still stuck after 6 s with no line on stderr (probe against the bundle). The gate exists for microseconds in a normal run, so only a run killed inside it plus a reused number reaches this; the notice names the turn folder, not the gate. Restore an age limit for a gate (or compare the gate's time with the machine's start as records are) and print a line when a wait for the gate lasts more than a few seconds."
        class: C5
      - cites: [PIP-009/R2, PIP-009/R3]
        text: "Follow-up: waitForProcessGroupExit (src/io/test-run-turn.ts, runShell's close handler) polls every 10 ms until the test command's process group is gone, with no limit; a process of the group that cannot die after SIGKILL (a stuck file system call) keeps the run, and so its turn, until the machine is restarted. Cap it (for example at the notice interval) and go on."
        class: C3
      - cites: [PIP-009/R3]
        text: "Follow-up: reclaimStaleGate renames a stale-looking gate away and puts it back if it was not stale after all; if another waiter made a new gate in between, the rename back fails and two gates holders can overlap for that moment. It needs a gate left by a killed run and two waiters judging it at the same instant; 16 runs over a planted dead gate gave no overlap. The two test seams (turnProcessId, the spawnSync identity branch) were accepted last round and are unchanged."
        class: C3
    assumed: []
    duration_s: 28105
---
Review of 2026-11-10. docs/SELF-HOSTING.md records the same failure in batch 6 (P78: three or four suites at once, load average 40-50 on 12 cores, a merge's test run hit ETIMEDOUT after 21 minutes) and again in batch 7 (telling every subagent to run check-report brought the overload back). The fix so far is practice: only one stage at a time should run the full suite. The same document's root cause R4 says a rule that matters must be a check, not a prompt. What I want: every run of the project's test command that spec starts (spec test, check-report, ticket advance, merge) takes one lock shared by the main tree and every ticket worktree of the repository. While another run holds it, the command waits and prints one notice on stderr saying which ticket and command it waits for, instead of running at the same time. A lock whose holder is no longer alive is taken over. Waiting is not a test result: it uses no report attempt and is not 'could not run' (PIP-022).
