---
id: PIP-009
title: Run the project's tests, one line per test
module: pipeline
status: active
provides: [pipeline.RunTests]
observes: [pipeline.CheckCouldNotRun, pipeline.StageRecord.refusals]
invariants: [INV-016]
questions:
  - id: Q1
    kind: preference
    text: The summary line counts a skipped test as passed ("<total - failed> passed"). Should skipped tests be counted apart, for example "3 passed, 1 failed, 2 skipped"?
    default: Keep counting them as passed, as the code does today
    cites: [PIP-009/S2]
    answer: 'Change requested in review (2026-10-29): Print them apart: "3 passed, 1 failed, 2 skipped". Specified by PROP-017.'
    raised_by: null
---
## Intent
Roles run the tests without knowing the stack: `spec test` runs the config's `testCommand` and prints one line per test, and `spec test <scenario ID>` runs only that scenario's tests. The command is the project's own, so it runs in a shell; the CLI fills in two placeholders, `{filter}` and `{report}`, and reads the report file the command writes. The same run is what `check-report` uses to check tester and implementer stages. A full test run loads the whole machine, and several at once (one stage's `check-report`, another ticket's `ticket advance`, a `spec merge`) slowed each other until they timed out. So every run of the test command that spec starts takes a turn shared by the main checkout and every worktree of the repository: by default one run at a time, or as many as format.Config.maxTestRuns allows. A run that must wait says on stderr whose run it waits for, and waits as long as it takes; waiting is not a test result.

## Behaviour
### S1: Run one scenario's tests
Given the config's `testCommand` is "npx vitest run -t \"{filter}\" --reporter=json --outputFile=\"{report}\"" and a test "PRV-002/S1 Fallback enabled" passes
When the developer runs `spec test PRV-002/S1` through pipeline.RunTests
Then the command runs with "{filter}" replaced by "PRV-002/S1"
And stdout holds the line "PASS PRV-002/S1 Fallback enabled" and the exit code is 0

### S2: One line per test, then a summary
Given the run's report holds "A" passed, "B" failed and "C" skipped, and the command exits 1
When the developer runs `spec test` through pipeline.RunTests
Then stdout is exactly:
```text
PASS A
FAIL B
SKIP C
1 passed, 1 failed, 1 skipped (exit 1)
```
And the exit code is 1 (R1)

### S3: Every test with no filter
Given any `testCommand`
When the developer runs `spec test` through pipeline.RunTests
Then "{filter}" is replaced by the empty string in every place it appears

### S4: The report path
Given any `testCommand`
When the developer runs `spec test` through pipeline.RunTests
Then every "{report}" is replaced by the path of a file named "report" in a new temporary folder, which is deleted after the run (R2)

### S5: JSON output
Given the run of S2
When the developer runs `spec test --format json` through pipeline.RunTests
Then stdout is the pipeline.TestRun {"exitCode": 1, "tests": [{"name": "A", "status": "passed"}, {"name": "B", "status": "failed"}, {"name": "C", "status": "skipped"}], "error": null} and the exit code is 1

### S6: Exit 0 only when everything passes
Given the test command exits 0 and its report has no failed test
When the developer runs `spec test` through pipeline.RunTests
Then the exit code is 0
But a command that exits non-zero with no failed test in its report gives exit code 1 (R1)

### S7: Not a scenario ID
Given any spec
When the developer runs `spec test not-an-id` through pipeline.RunTests
Then it fails with pipeline.InvalidScenarioFilter: stderr starts "Unknown not-an-id. spec test takes a scenario ID, or nothing for every test." and the exit code is 2
And the test command does not run (R2)

### S8: The command wrote no report
Given a `testCommand` that prints "boom" on stderr, writes no file at "{report}" and exits 1
When the developer runs `spec test` through pipeline.RunTests
Then it fails with pipeline.NoTestResults: stderr is "spec test: the test command wrote no report to {report}: boom" and the exit code is 1
And the text after the colon is the last 3 lines of the command's stderr then stdout, joined by " | "

### S9: A report in no known format
Given a `testCommand` that writes "not a report" to "{report}"
When the developer runs `spec test` through pipeline.RunTests
Then it fails with pipeline.NoTestResults and stderr "spec test: the test report is neither JSON nor JUnit XML"

### S10: No config
Given the spec root has no readable config
When the developer runs `spec test` through pipeline.RunTests
Then it fails with pipeline.MissingTestCommand: stderr "config.json has no testCommand" and exit code 1

### S11: The command runs in the project root, in a shell, with a time limit
Given a `testCommand` of "pwd > out.txt"
When the developer runs `spec test` through pipeline.RunTests
Then the command ran under "/bin/sh -c", and "out.txt" in the project root holds the project root's path
And a command still running after 10 minutes is stopped, and the run fails with pipeline.NoTestResults (R2)

### S12: In JSON, a failed run still prints its result
Given a `testCommand` that writes no report
When the developer runs `spec test --format json` through pipeline.RunTests
Then stdout is a pipeline.TestRun with pipeline.TestRun.tests [] and pipeline.TestRun.error starting "the test command wrote no report", and the exit code is 1

### S13: A run that finds no other starts at once
Given no run of the test command is in progress in the main checkout or any worktree of the repository
When the developer runs `spec test` through pipeline.RunTests
Then the test command starts at once and stderr holds no line with "waiting for a test run to finish" (R3)

### S14: A second run waits its turn and says so
Given format.Config.maxTestRuns is not set, and in the worktree of "PROP-112" "spec check-report" is running the test command as process 4242
When "spec merge TASK-101" in the main checkout reaches its test run through pipeline.RunTests
Then stderr holds the line "spec merge: waiting for a test run to finish: ''spec check-report'' on PROP-112 (pid 4242)" and the merge's test command does not start until the test command of "PROP-112" has ended (R3, R4)
And while it waits the same line is printed again once per notice interval (one minute by default), so a wait that lasts at least 3 intervals prints it at least 4 times, and nothing is added to stdout by the wait (R4)
And the merge's test command then runs, and the merge uses its result exactly as it would have with no wait (R4)
And when 8 runs ask for a free turn at the same moment, with format.Config.maxTestRuns not set, their test commands run one after another: at no moment is more than one of them running (R3)

### S15: The turn is shared by the main checkout and every worktree
Given "spec test" is running the test command in the main checkout as process 4300
When "spec ticket advance TASK-101" in the worktree of "TASK-101" reaches its test run through pipeline.RunTests
Then stderr holds the line "spec ticket advance: waiting for a test run to finish: ''spec test'' in the main checkout (pid 4300)" (R3, R4)
And the same holds whichever of "spec test", "spec check-report", "spec ticket advance", "spec merge" and "spec gaps" holds the turn and whichever waits, in the main checkout or in any two worktrees of the repository (R3)

### S16: Waiting is not a test result
Given "TASK-101" is in its "implementer" stage with a valid done implementer report in "report.md", one earlier intake of its report was refused, and another worktree's run holds the turn for longer than the test command's time limit (R2)
When the main session runs "spec ticket advance TASK-101 --report-file report.md" and its test command, once the turn is free, runs for less than the time limit but long enough that the wait and the run together exceed it, through pipeline.RunTests
Then the advance does not fail with pipeline.CheckCouldNotRun because of the wait (R4)
And its test command is not stopped: the time limit counts from the test command's own start, whatever time the wait took; with the 10-minute default, for example, a 15-minute wait and then a 9-minute run (R2)
But a test command that itself runs past the time limit is stopped, as in S11, however short the wait was (R2)
And when every test then passes the stage is recorded with pipeline.StageRecord.refusals 1: the wait used none of the report's attempts (R4, PIP-022/R1)
And "spec check-report implementer TASK-101 --report-file report.md" that waits the same way prints the same problems and exits with the same code as it would with no wait (R4)

### S17: The turn is given back however a run ends
Given "spec check-report implementer TASK-101" holds the only turn for a done implementer report, and after its test command ends it goes on running a format.Config.checkCommands command that does not end until the person lets it, and "spec test" is waiting for the turn
When the check's test command ends through pipeline.RunTests because its tests passed, a test failed, it wrote no report, or it was stopped at its time limit (R2)
Then in each case the check's record is removed and the waiting run's test command starts while the check is still running its check command: the turn is given back when the test command ends, not when the command that ran it exits (R3)

### S18: A turn whose holder is gone is taken over
Given the run that held the only turn was killed before it gave the turn back, so process 4242 named as its holder is no longer alive
When the developer runs `spec test` through pipeline.RunTests
Then the test command starts at once and stderr holds no line with "waiting for a test run to finish" (R3)
And a turn whose record cannot be read, for example a file named after a live process that holds "not a record", is taken over the same way (R3)
But a record that a live run is still writing is never read as one that cannot be read: a run's record is whole from the moment it can be seen, so of two runs that start together one waits (R3)

### S19: Stopping a run that waits
Given "spec test" in the worktree of "TASK-101" is waiting for the turn that "PROP-112" holds, and "spec gaps" in the main checkout waits after it
When the person stops the waiting "spec test" of "TASK-101" while it waits in pipeline.RunTests
Then its test command never starts and it holds no turn, so when the run of "PROP-112" ends the test command of "spec gaps" starts (R4)

### S20: More than one run at a time
Given format.Config.maxTestRuns is 2, and "spec check-report" on "PROP-112" as process 4242 and then "spec merge" in the main checkout as process 4300 are running the test command
When the developer runs `spec test` in the worktree of "TASK-101" through pipeline.RunTests
Then stderr holds the line "spec test: waiting for a test run to finish: ''spec check-report'' on PROP-112 (pid 4242), ''spec merge'' in the main checkout (pid 4300)", the holders in the order they took their turns (R4, R5)
And when only one of the two is running the test command starts at once (R5)
And without format.Config.maxTestRuns at most one run holds a turn (R5)
And when config.json holds `"maxTestRuns": 0`, `"maxTestRuns": 1.5` or `"maxTestRuns": "2"`, `spec lint` reports a finding on format.Config.maxTestRuns (R5)

### S21: A run refused before it starts does not wait
Given another run holds the only turn
When the developer runs `spec test not-an-id` through pipeline.RunTests
Then it fails at once with pipeline.InvalidScenarioFilter, as in S7, and stderr holds no line with "waiting for a test run to finish" (R4)
And with no config it fails at once with pipeline.MissingTestCommand, as in S10 (R4)
And "spec check-report implementer TASK-101", whose own test run has ended and given its turn back, runs its format.Config.checkCommands command while "spec test" in the main checkout holds the turn, taken after the check's test run ended and kept until after the check command has ended, and finishes with no line with "waiting for a test run to finish" on its stderr (R3)
And "spec worktree add TASK-101", which runs no test command, runs format.Config.worktreeSetup and finishes while "spec test" in the main checkout holds the turn, with no such line (R3)
And "spec merge TASK-101", whose own test run on the merged result has passed and given its turn back, runs format.Config.afterMerge while "spec test" in the main checkout holds the turn, taken after the merge's test run ended and kept until after afterMerge has ended, and finishes with no such line (R3)
And "spec merge TASK-101" runs format.GeneratedConfig.command for a conflict in a generated file while "spec test" in the main checkout holds the turn, and the command ends before that turn is free; only the merge's own later test run then waits, as in S14 (R3)

### S22: A forged record can only make a run wait
Given a turn's record, written by some other process as a well-formed pipeline.TestRunTurn in the file named "1", names process 1, which is alive though this user may not signal it, with the ticket "x; rm -rf ." and the command "anything at all"
When the developer runs `spec test` through pipeline.RunTests
Then stderr holds the line "spec test: waiting for a test run to finish: an unknown run (pid 1)" (INV-016)
And no part of the record is run, and when the person stops the waiting run no test result is printed, so nothing reads it as passed (INV-016)
And when the person removes the record's file, named in the notice, the waiting run takes the turn and its test command starts (INV-016)

### S23: An invalid maxTestRuns refuses the run at once
Given config.json holds `"maxTestRuns": 0`, `"maxTestRuns": 1.5` or `"maxTestRuns": "2"`, and no other run is in progress
When the developer runs `spec test` through pipeline.RunTests
Then it fails at once with pipeline.MissingTestCommand: stderr "config.json has no testCommand" and exit code 1, as for any config.json that does not match the config schema (R5)
And the test command does not run, no turn is taken, and stderr holds no line with "waiting for a test run to finish", so a value of 0 never makes a run wait for a turn that can never be free (R5)

### S24: Interrupting the holder stops its test command and frees the turn
Given "spec test" in the worktree of "TASK-101" holds the only turn and its test command is running, and "spec merge TASK-102" in the main checkout waits for it
When the person interrupts that "spec test" with Ctrl-C, SIGTERM, or SIGHUP as when its terminal closes, while it runs the test command through pipeline.RunTests
Then the test command and every process it started are stopped, the turn's record is removed, and the merge's test command starts (R3)
And no process of the stopped test command is still running once the merge's test command has started (R3)

### S25: Where a turn is kept, and how a person frees one
Given the repository's main checkout is "/work/app", so its git folder is "/work/app/.git", and "spec check-report" on "PROP-112" holds the only turn as process 4242
When "spec test" in the worktree of "TASK-101" starts to wait through pipeline.RunTests
Then the turn is the file "/work/app/.git/spec-test-runs/4242", and the first notice is followed by the line "spec test: each turn is a file in /work/app/.git/spec-test-runs; remove one whose process is not a spec run to free its turn" (R3, R4)
And when the person removes "/work/app/.git/spec-test-runs/4242" the waiting run takes the turn at its next look, so with the default notice interval its test command starts with no second waiting line printed before it (R3, R4)
And when the person instead removes the whole folder "/work/app/.git/spec-test-runs", the waiting run makes it again, takes the turn with a record of its own there, and prints no "no turn can be kept" line (R3)
And a record whose file was last modified before the machine last started, for example one whose modification time is set to the year 2000 while it names a live process, is free and taken over, so a process number reused after a restart does not hold a turn (R3)

### S26: Every worktree of the repository shares the turn, however it is reached
Given "spec merge" in the main checkout "/work/app" holds the only turn as process 4300, and "/work/scratch" is a worktree the person added with "git worktree add" that belongs to no ticket
When "spec test" runs there through pipeline.RunTests, once with "--root /work/scratch/spec" and once from "/links/scratch", a symlink to "/work/scratch"
Then each time it waits, and its stderr holds "spec test: waiting for a test run to finish: ''spec merge'' in the main checkout (pid 4300)" (R3, R4)
And while that "spec test" holds the turn, a run that waits for it names it "''spec test'' in a worktree without a ticket (pid <pid>)" (R4)

### S27: A run inside a holder's test command does not wait for its own parent
Given a project whose test command itself runs "spec test PRV-002/S1" on the same repository, and "spec check-report" on "PROP-112" holds the only turn and runs that test command
When the nested "spec test PRV-002/S1" reaches its test run through pipeline.RunTests
Then it runs at once under its parent's turn, takes no turn of its own, and stderr holds no line with "waiting for a test run to finish" (R3)
And the check of "PROP-112" finishes rather than waiting for itself (R3)
And the environment of the test command, and of every process it starts, holds "SPEC_TEST_RUN_PARENT", naming the holder's process number and the repository's git folder (R3)
But when that test command runs "spec test" on a second repository, that run takes the second repository's own turn: its record appears in the second repository's "spec-test-runs" folder, and it waits while another run holds that turn (R3)
And a run whose "SPEC_TEST_RUN_PARENT" names a process that is no longer alive, a process that holds no turn's record, another repository, or text that is not such a value, waits for its turn like any other (R3, INV-016)

### S28: A git folder where no turn can be kept
Given "<git folder>/spec-test-runs" is a regular file, so the turn folder can be neither made, read nor written, whoever the user is
When the developer runs `spec test` through pipeline.RunTests
Then stderr holds one line "spec test: no turn can be kept in <git folder>/spec-test-runs: <reason>; running without one", and no "internal error" and no stack trace (R3)
And the test command runs at once, without waiting, and stdout, the result and the exit code are those of the same run where the turn folder works (R3)
But when the turn folder can be read and holds the live record of "spec check-report" on "PROP-112", and this run cannot add its own record to it (the folder's mode forbids this user to write there, a case a test builds only as a user who is not root; run as a user who can write anyway, such a test is skipped, never counted as passed), the run prints the same line, then waits as in S14, naming that holder, until fewer live records than format.Config.maxTestRuns remain, and only then runs its test command, without a record of its own (R3, R4)

### S29: The settings can only lower a default
Given the environment holds pipeline.TestRunSettings.SPEC_TEST_RUN_TIMEOUT_MS "1000" and a `testCommand` that would pass after running for 3 seconds
When the developer runs `spec test` through pipeline.RunTests
Then the command is stopped and the run fails with pipeline.NoTestResults and exit code 1: a lower limit never turns a run into a pass (R2, INV-016)
And with "700000", "600000", "0", "-5", "1.5", "1e3", "0x10", " 7 ", "abc" or "" instead, the value is ignored, the 10-minute default applies and the run passes (R2)
And with SPEC_TEST_RUN_NOTICE_INTERVAL_MS and SPEC_TEST_RUN_POLL_INTERVAL_MS each "1", a run started while another holds the only turn still waits and prints its waiting line (R4, INV-016)

## Rules
- R1: `spec test` exits 0 only when the command gave results, exited 0 and no test failed; the summary is "<passed> passed, <failed> failed, <skipped> skipped (exit <code>)", with "?" for a command that ended with no exit code.
- R2: Only a validated scenario ID, or nothing, and the temporary report path are put into the command; it runs in "/bin/sh" in the project root and is stopped when its time limit has passed since it started; time spent waiting for a turn (R3) does not count. The time limit is 10 minutes; pipeline.TestRunSettings.SPEC_TEST_RUN_TIMEOUT_MS can only lower it, so a check of these rules with a limit of a few seconds is a valid check, and a lower limit can only turn a run into one with no results (pipeline.NoTestResults), never into a pass.
- R3: Every run of the test command started by one of exactly these five commands, "spec test", "spec check-report", "spec ticket advance", "spec merge" and "spec gaps", first takes a turn shared by the main checkout and every worktree of the repository, ticket worktrees and others alike. The repository is the one its git folder names after symlinks are resolved, however the run reached it (a symlinked path, a relative path or `--root`). At most format.Config.maxTestRuns runs hold a turn at once, 1 when it is not set; two runs that ask at the same moment never both take the last free turn. Each held turn is the file "<git folder>/spec-test-runs/<pid>" holding a pipeline.TestRunTurn, written whole at once, so a record a live run is still writing is never read as one that cannot be read; holders are ordered by the files' modification times, and removing the file frees the turn. A process that exists but that this user may not signal counts as alive. A run gives its turn back when its test command ends, however it ends, even when the command that ran it goes on with other work; a run interrupted by Ctrl-C, SIGTERM or SIGHUP first stops its test command and every process that command started. A run killed outright (SIGKILL) cannot: its test command may go on, and its record is taken over as one whose holder is gone. A turn whose holder process is no longer alive, whose record's file was last modified before the machine last started, or whose record cannot be read, is free and taken over. A holder hands its test command, and so every process that command starts, the environment value "SPEC_TEST_RUN_PARENT" naming the holder's process number and the repository's git folder. A run whose value names its own repository and a live process that holds a record there is nested: it runs under that turn without taking or waiting for one. Any other value (a process gone or holding no record, another repository, or unreadable text) is ignored, and the run takes its own repository's turn. A run that finds the folder gone, also while it waits (a person removed it, which frees every turn), makes it again once before deciding anything. When "<git folder>/spec-test-runs" still cannot be made or written, a run says so in one line on stderr and runs its test command without a turn of its own, with the result it would have had with one: at once when the folder cannot be read either, and otherwise only after waiting, as R4 says, until the live records it can read number fewer than maxTestRuns. The folder "spec-test-runs" is unrelated to "spec/test-runs" in the same git folder, where kept test runs live (PIP-008/R12). Two limits are known: a run killed outright, as above, and a chain across repositories (a holder in repository A whose test command runs spec in B, whose test command runs spec in A again): the environment value names only the nearest holder, so the last run waits for its own ancestor, which its notice names and the person can stop (INV-016). Turns are kept among processes of one machine that see each other's process numbers, by a CLI that has this rule: a run by an older pinned CLI takes no turn and is not waited for. Only the test command takes a turn: check commands, worktree setup, afterMerge and the generated files' command do not. `spec check-report` runs its check commands only after its own test run has ended and given its turn back, as `spec merge` runs afterMerge only after its test run (S17, S21).
- R4: A run that must wait prints on stderr "<command>: waiting for a test run to finish: <holders>" when it starts to wait and again once per notice interval while it waits (one minute, which pipeline.TestRunSettings.SPEC_TEST_RUN_NOTICE_INTERVAL_MS can only lower), where <command> is the R3 name of the command that waits; after the first such line it prints once "<command>: each turn is a file in <git folder>/spec-test-runs; remove one whose process is not a spec run to free its turn". Each holder is "''<name>'' on <ticket>" for a run in a ticket's worktree, "''<name>'' in the main checkout" for a run there, or "''<name>'' in a worktree without a ticket", then " (pid <pid>)", where <name> is one of R3's five names; a record whose ticket is not a ticket ID or whose command is not one of those five names is shown as "an unknown run (pid <pid>)"; holders are listed in the order they took their turns, joined by ", ". A run never gives up waiting on its own; one stopped while it waits starts nothing and holds no turn. Waiting adds nothing to stdout and changes no result, problem or exit code; it is never a run that gave no results (PIP-022/R1) and uses no report attempt. A run refused before its test command would start (an invalid filter, no testCommand) does not wait. A waiting run looks for a free turn once per poll interval (100 ms, which pipeline.TestRunSettings.SPEC_TEST_RUN_POLL_INTERVAL_MS can only lower) and takes a freed one at its next look.
- R5: maxTestRuns, when set, is a whole number of 1 or more; each run reads it from the config of the checkout or worktree it runs in. A config.json whose maxTestRuns is anything else does not match the config schema, so, as for any such config, every run of the test command is refused at once with "config.json has no testCommand" and takes no turn, and `spec lint` reports the value. An older CLI refuses a config.json that holds maxTestRuns at all, as it refuses any key it does not know, so the key is set only once every checkout's pinned CLI has this rule.

## Out of scope
- Reading the report file (PIP-010)
- Which tests cover which scenario (PIP-011)
- Whether `spec check-report` runs the tests at all for a report it refuses without using their result, such as one for a role whose stage is not running (PIP-004); while it does, that run takes and waits for a turn like any other
