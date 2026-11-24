---
id: PIP-006
title: Hold the tester and implementer to test first
module: pipeline
status: active
invariants: [INV-004]
decisions: [ADR-001]
---
## Intent
Behaviour changes are test first: the tester's tests describe the new or broken behaviour and fail before the implementer starts, and the implementer is done only when every test passes. When a tester or implementer reports done, `check-report` runs the project's test command over every test and checks the result. When the implementer's run fails, the problem says what broke: the failed tests, the test files that failed to load or whose hooks threw, or, when the report names none, the end of the test output. On a proposal in a compiled language, a test against code that does not exist yet does not compile, so the tester may add stubs: the smallest code that compiles and throws, each change marked `SPEC-STUB`. The implementer must replace every one the ticket's branch added; the marker in code and docs that were already on the base branch is not a stub. A test name that starts with another spec's ID, such as a fixture's, names data, not a scenario of this spec. When the project's config lists `checkCommands` (lint, type check), `check-report` also runs them for a done tester or implementer, so a lint error in a test never reaches the implementer. A new test must fail on its assertion: one that fails by an error, such as a missing function, is refused, because it fails for any code. A proposal may also pin behaviour the code already has: the spec-writer lists each such scenario it added under `documents:` in its report, after running the current build on it, and `ticket advance` keeps that list in the spec-writer's record in the ticket's history. The tester's check reads it from the latest done spec-writer record only, so a spec-writer stage that runs again revokes whatever it no longer lists. Until the ticket's first implementer stage, a documented scenario still needs a test that runs and passes, and is still checked for errors, while every other new or changed scenario is still held to test first; once the implementer has run, a documented scenario is checked like any other new scenario, so its test may fail on its assertion. Only the spec-writer may list a scenario, and only one its branch added. On a proposal in the build lane one build stage writes the tests and the code, and PIP-024 holds it to test first.

## Behaviour
### S1: Every in-scope scenario has a test
Given "BUG-301" violates "PRV-002/S3", its feature has scenarios S1 to S4, and the tester's run has tests only for S1, S3 and S4
When the tester's done report is checked through pipeline.CheckReport
Then the only problem is "no test covers PRV-002/S2; name it \"PRV-002/S2 <scenario title>\"" (R1)

### S2: A bug's test fails before the fix
Given "BUG-301" is in its "tester" stage and the run has "PRV-002/S1 Fallback enabled", "PRV-002/S2 Fallback disabled" and "PRV-002/S4 Fallback provider not enabled" passing and "PRV-002/S3 Fallback provider also rate-limits" failing
When the tester's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true (INV-004)

### S3: A bug's test that already passes is refused
Given "BUG-301" is in its "tester" stage and every test of "PRV-002" passes
When the tester's done report is checked through pipeline.CheckReport
Then the only problem is "the test for PRV-002/S3 passes on the current code; a bug's test must fail before the fix" (R2, INV-004)

### S4: A proposal's new behaviour starts red
Given the spec-writer of "PROP-201" added "PRV-001/S4" and "SET-001/S4", and the tester's run fails "PRV-001/S4 Streams from gemini" while "SET-001/S4 Enable gemini" and every other test pass
When the tester's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true: one failing test among the new scenarios is enough (R3, INV-004)

### S5: A proposal whose new tests all pass is refused
Given the same "PROP-201" with every test passing, "PRV-001/S4" and "SET-001/S4" included
When the tester's done report is checked through pipeline.CheckReport
Then the only problem is "every test of the new or changed scenarios (PRV-001/S4, SET-001/S4) passes on the current code; tests come before the code, so at least one must fail until the implementer's change" (R3, INV-004)

### S6: A new scenario without a test
Given the same "PROP-201" whose run has no test named for "SET-001/S4"
When the tester's done report is checked through pipeline.CheckReport
Then the only problem is "no test covers SET-001/S4; name it \"SET-001/S4 <scenario title>\"" (R1)

### S7: A test named after a scenario the spec does not have
Given the tester's run holds "PRV-001/S9 Removed long ago" and the spec has no "PRV-001/S9"
When the tester's done report is checked through pipeline.CheckReport
Then a problem is "test \"PRV-001/S9 Removed long ago\" names PRV-001/S9, which is not in the spec; delete or rename it" (R4)

### S8: The implementer is done when every test passes
Given "TASK-101" is in its "implementer" stage and the test command exits 1 with "PRV-001/S1 Streams tokens" failing
When the implementer's done report is checked through pipeline.CheckReport
Then the only problem is "tests fail (exit 1): PRV-001/S1 Streams tokens" (R5)
And with more failures it names the first 5, joined by "; "

### S9: The test command gave no results
Given the test command wrote no report
When an implementer or tester done report is checked through pipeline.CheckReport
Then the only test problem starts "the test command gave no results: " followed by the reason (R5)
And with no config at all the reason is "config.json has no testCommand"

### S10: Tests run only when they are needed
Given a done reviewer or spec-writer report, or a blocked report of any role
When it is checked through pipeline.CheckReport
Then the test command does not run (R5)

### S11: A tester's stub marked SPEC-STUB is accepted
Given "PROP-205" is in its "tester" stage, "src/app.ts" gains one hunk whose added lines include "    throw new Error('SPEC-STUB PROP-205');", and "CNV-001/S3 Copy a message" fails
When the tester's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true (R6)

### S12: A tester's code change without the marker is refused
Given "PROP-205" is in its "tester" stage and "src/app.ts" gains one hunk whose first non-blank added line is "copyMessage(messageId: string): string {" and that holds no "SPEC-STUB"
When the tester's done report is checked through pipeline.CheckReport
Then a problem is "src/app.ts changes code without the SPEC-STUB marker (\"copyMessage(messageId: string): string {\"); the tester adds only stubs that throw, each marked SPEC-STUB — revert anything else" (R6)
And a hunk that only removes lines is named by "(removed) " and its first removed line

### S13: Blank lines between stubs are not changes
Given a tester's hunk on a proposal that adds only blank lines and removes nothing
When the tester's done report is checked through pipeline.CheckReport
Then that hunk gives no problem (R6)

### S14: A bug's tester adds no stubs
Given "BUG-301" is in its "tester" stage and "src/providers/fallback.ts" gains the line "// SPEC-STUB BUG-301"
When the tester's done report is checked through pipeline.CheckReport
Then the only problem is "the tester changes test files only; revert src/providers/fallback.ts" (R6)

### S15: The implementer replaces every stub
Given "PROP-205" is in its "implementer" stage, every test passes, and a line its branch added to "src/app.ts" since it left "main" still holds "SPEC-STUB", committed or not
When the implementer's done report is checked through pipeline.CheckReport
Then the only problem is "SPEC-STUB is still in src/app.ts; replace every stub with the real code" (R6)
And a file holding "SPEC-STUB" that the branch added and git does not track yet is named the same way

### S16: Test first in Dart
Given a Dart project on a proposal, and the tester added a test "CRT-001/S3 Remove an item" that calls a method the code does not have
When `spec test` runs through pipeline.RunTests
Then the only result for that file is "FAIL loading test/crt_001_test.dart", so check-report says "no test covers CRT-001/S3" and "no test covers CRT-001/S1"
And once the tester adds a stub marked SPEC-STUB, "FAIL CRT-001/S3 Remove an item" and "PASS CRT-001/S1 Add an item" are printed and the tester's stage is accepted (R6, INV-004)

### S17: A test named with another spec's ID claims no scenario
Given this spec's modules have the prefixes "ALP" and "BET", and the tester's run also holds a passing test "PRV-002/S1 is a fixture scenario"
When the tester's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true, and no problem names "PRV-002/S1" (R4)

### S18: A marker already on the base branch is no stub
Given "src/notes.ts" holds the comment "// Stubs are marked SPEC-STUB." on "main", and "TASK-101" is in its "implementer" stage on a branch from "main" with every test passing
When the implementer's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true (R6)
And a line that held "SPEC-STUB" on "main" and that the branch only edited is no stub either

### S19: A lint error in a tester's own test file is refused
Given format.Config.checkCommands is ["npm run lint"], "PROP-205" is in its "tester" stage, and "npm run lint" exits 1 with the line "test/cnv_001.test.ts:12 no-unused-vars" in its output, a file under testGlobs
When the tester's done report is checked through pipeline.CheckReport
Then the only problem is "npm run lint fails on test/cnv_001.test.ts: test/cnv_001.test.ts:12 no-unused-vars; fix it before the implementer starts" (R7)
And with the project at "/work/app" and the output's line "/work/app/test/cnv_001.test.ts" on its own, above "12:5 error no-unused-vars", the only problem is "npm run lint fails on test/cnv_001.test.ts: /work/app/test/cnv_001.test.ts; fix it before the implementer starts", an absolute path being read as its form relative to the project (R7)

### S20: A failure outside the test files does not refuse the tester
Given format.Config.checkCommands is ["npm run lint"], "PROP-205" is in its "tester" stage, and "npm run lint" exits 1 naming only "src/app.ts", a file outside testGlobs
When the tester's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true (R7)

### S21: An implementer is refused when any check command fails
Given format.Config.checkCommands is ["npm run lint", "npm run typecheck"], "TASK-101" is in its "implementer" stage, every test passes, and "npm run typecheck" exits 1 with the first output line "src/app.ts:3 type error"
When the implementer's done report is checked through pipeline.CheckReport
Then the only problem is "npm run typecheck fails (exit 1): src/app.ts:3 type error" (R7)
And the output is cut to its first 5 lines, joined by "; "

### S22: Without checkCommands nothing changes
Given format.Config.checkCommands is not set, or the report is a blocked one, or a done reviewer or spec-writer one
When it is checked through pipeline.CheckReport
Then no check command runs and no problem comes from one (R7)

### S23: A new test that fails by an error is refused
Given the spec-writer of "PROP-201" added "PRV-001/S4", and the tester's run fails "PRV-001/S4 Streams from gemini" with pipeline.TestCase.failureKind "error" and pipeline.TestCase.firstErrorLine "TypeError: gemini.stream is not a function", while every other test passes
When the tester's done report is checked through pipeline.CheckReport
Then the only problem is "the test \"PRV-001/S4 Streams from gemini\" fails with an error, not an assertion: TypeError: gemini.stream is not a function; make it fail on what it asserts" (R8, INV-004)

### S24: A stub's error is not an error of the test
Given the spec-writer of "PROP-205" added "CNV-001/S3", "src/app.ts" gains one hunk holding "SPEC-STUB", and "CNV-001/S3 Copy a message" fails with pipeline.TestCase.failureKind "error" and pipeline.TestCase.firstErrorLine "Error: SPEC-STUB PROP-205"
When the tester's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true (R8)

### S25: Errors outside the new scenarios, or unlabelled, are not refused
Given the same "PROP-201", a failing test of an older scenario with pipeline.TestCase.failureKind "error", and a failing "PRV-001/S4 Streams from gemini" with no pipeline.TestCase.failureKind
When the tester's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true (R8)

### S26: A tester stage after the implementer may pass
Given "PROP-201" has a done "implementer" stage in its history, then a reviewer "changes" sent it back to the "tester", and the spec-writer added "PRV-001/S5"
And the tester's run has a test for every scenario in scope, "PRV-001/S5 Second rate limit" included, and every test passes
When the tester's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true: the code already delivers "PRV-001/S5" (R9, INV-004)
And on "BUG-301", whose history holds a done "implementer" stage, a violated scenario whose tests all pass is accepted the same way (R9, INV-004)
But a test that fails with an error is still refused (R8), and lint and the check commands still apply (R7)
And before the first implementer stage, as in S3 and S5, passing tests are still refused (R2, R3), as they are when the only "implementer" records are build stages that blocked or have pipeline.StageRecord.lane "full" (R9, PIP-021/R10)

### S27: A proposal whose new scenarios only document today's behaviour passes its tester stage
Given "PROP-201" is in its "tester" stage with no "implementer" stage in its history, its branch added "PRV-001/S4" and "SET-001/S4", and its done "spec-writer" pipeline.StageRecord has pipeline.StageRecord.documents ["PRV-001/S4", "SET-001/S4"]
And the tester's run has a test for every scenario in scope, "PRV-001/S4 Streams from gemini" and "SET-001/S4 Enable gemini" included, and every test passes
When the tester's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true: no new or changed scenario is left that must start red (R3, R10, INV-004)

### S28: An undocumented new scenario in the same proposal still starts red
Given the same "PROP-201", but its spec-writer's pipeline.StageRecord.documents is ["PRV-001/S4"] only, and every test passes
When the tester's done report is checked through pipeline.CheckReport
Then the only problem is "every test of the new or changed scenarios (SET-001/S4) passes on the current code; tests come before the code, so at least one must fail until the implementer's change" (R3, R10, INV-004)
And with "SET-001/S4 Enable gemini" failing instead, pipeline.ReportCheck.ok is true (R3)

### S29: Before the implementer, a documented scenario still needs a passing test
Given the "PROP-201" of S27, whose run has no test named for "SET-001/S4" and whose "PRV-001/S4 Streams from gemini" fails
When the tester's done report is checked through pipeline.CheckReport
Then the problems are "no test covers SET-001/S4; name it \"SET-001/S4 <scenario title>\"" and "the test \"PRV-001/S4 Streams from gemini\" fails, but the spec-writer listed PRV-001/S4 under documents as behaviour the code already has; make the test check what the code does, or report a blocker that cites PRV-001/S4" (R1, R10)

### S30: A spec-writer may list only scenarios it added
Given "PROP-201" is in its "spec-writer" stage, the base spec has "PRV-001/S1", and the branch added "PRV-001/S4" and changed the steps of "PRV-001/S1"
And the report's pipeline.Report.documents is ["PRV-001/S4", "PRV-001/S1", "PRV-001/S9"], and the spec has no "PRV-001/S9"
When the spec-writer's done report is checked through pipeline.CheckReport
Then the problems are "documents lists PRV-001/S1, which this branch did not add; list only new scenarios whose behaviour the current build already has" and "documents lists PRV-001/S9, which this branch did not add; list only new scenarios whose behaviour the current build already has" (R11)
And the test command does not run (R5)

### S31: Only the spec-writer lists documents
Given "PROP-201" is in its "tester" stage and the tester's report has pipeline.Report.documents ["PRV-001/S4"]
When the tester's done report is checked through pipeline.CheckReport
Then a problem is "only the spec-writer lists documents; leave it out of the tester's report" (R11)
And "PRV-001/S4" is held to test first as if it were not listed (R3)

### S32: A reopened spec-writer stage revokes what it no longer lists
Given "PROP-201" has no "implementer" stage in its history, and its history holds, in order, a done "spec-writer" stage with pipeline.StageRecord.documents ["PRV-001/S4", "SET-001/S4"], a done "tester" stage, a reviewer "changes" whose finding has pipeline.ReviewFinding.spec true, and a done "spec-writer" stage with no pipeline.StageRecord.documents that changed the steps of "SET-001/S4" to require new behaviour
And the tester's run fails "SET-001/S4 Enable gemini" on its assertion while every other test, "PRV-001/S4 Streams from gemini" included, passes
When the tester's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true: only the latest done spec-writer stage's documents count, so neither scenario is documented and one failing test among them is enough (R10, R3, INV-004)
And had the latest done spec-writer stage listed pipeline.StageRecord.documents ["SET-001/S4"], the only problem would be "the test \"SET-001/S4 Enable gemini\" fails, but the spec-writer listed SET-001/S4 under documents as behaviour the code already has; make the test check what the code does, or report a blocker that cites SET-001/S4" (R10)
But a blocked "spec-writer" stage recorded after the latest done one changes nothing: its record holds no documents and it is not the latest done stage (R10)

### S33: A documented scenario whose only test is skipped is refused
Given the "PROP-201" of S27, whose only test for "SET-001/S4" is "SET-001/S4 Enable gemini" with pipeline.TestCase.status "skipped", and every other test passes
When the tester's done report is checked through pipeline.CheckReport
Then the only problem is "no test of SET-001/S4 passes, but the spec-writer listed it under documents as behaviour the code already has; a skipped test does not count, so make one run and pass" (R10)
And a documented scenario with one passing and one skipped test gives no problem (R10)

### S34: A documented test that fails by an error keeps the error's problem
Given the "PROP-201" of S27, whose "PRV-001/S4 Streams from gemini" fails with pipeline.TestCase.failureKind "error" and pipeline.TestCase.firstErrorLine "TypeError: gemini.stream is not a function", and every other test passes
When the tester's done report is checked through pipeline.CheckReport
Then the problems are, in order, "the test \"PRV-001/S4 Streams from gemini\" fails, but the spec-writer listed PRV-001/S4 under documents as behaviour the code already has; make the test check what the code does, or report a blocker that cites PRV-001/S4" and "the test \"PRV-001/S4 Streams from gemini\" fails with an error, not an assertion: TypeError: gemini.stream is not a function; make it fail on what it asserts" (R8, R10)

### S35: A test file that fails to load or a hook that throws is named
Given "TASK-101" is in its "implementer" stage, the test command exits 1, and its vitest JSON report holds no failed test
And the report gives "<project>/tests/core/app.test.ts" the status "failed", no tests and the message "Cannot find module './nope' imported from <project>/tests/core/app.test.ts", and gives "<project>/tests/core/db.test.ts" the status "failed" and the message "db is down" from a "beforeAll" hook that throws, with its one test "PRV-001/S2 Saves a draft" skipped
When the implementer's done report is checked through pipeline.CheckReport
Then the only problem is "tests fail (exit 1): tests/core/app.test.ts: Cannot find module './nope' imported from <project>/tests/core/app.test.ts; tests/core/db.test.ts: db is down" (R12)
And a failed file is named by its path relative to the project root, a colon and the first non-blank line of its message, after every failed test, and the first 5 names in all are kept, joined by "; " (R5, R12)
But a failed file whose message is empty, because only its tests failed, is not named: with "PRV-001/S1 Streams tokens" also failing in such a file, the problem is "tests fail (exit 1): PRV-001/S1 Streams tokens; tests/core/app.test.ts: Cannot find module './nope' imported from <project>/tests/core/app.test.ts; tests/core/db.test.ts: db is down" (R12)

### S36: A failing run that names nothing keeps the end of the test output
Given "TASK-101" is in its "implementer" stage, and the test command exits 1 with a report that holds no failed test and no failed file, after printing the non-blank lines "RUN v3", "Error: coverage threshold for lines (80%) not met", "  at check (cov.js:3)", "Tests 12 passed", "Exit 1" and "Done"
When the implementer's done report is checked through pipeline.CheckReport
Then the only problem is "tests fail (exit 1): the test report names no failed test or file; the test output ends: Error: coverage threshold for lines (80%) not met | at check (cov.js:3) | Tests 12 passed | Exit 1 | Done" (R12)
And with an empty output the problem is "tests fail (exit 1): the test report names no failed test or file, and the test command printed nothing" (R12)
And when "spec ticket advance" blocks "TASK-101" on this refusal, its question holds the same problem text, so the role sees what broke without running the tests again (R12)

### S37: After the implementer, a documented scenario's failing test is held like any test
Given "PROP-201" has a done "implementer" stage in its history, then a reviewer "changes" sent it back to the "tester", and its latest done "spec-writer" stage has pipeline.StageRecord.documents ["PRV-001/S4", "SET-001/S4"]
And the tester's run has a test for every scenario in scope, "PRV-001/S4 Streams from gemini" fails on its assertion with pipeline.TestCase.failureKind "assertion", and every other test passes
When the tester's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true: the exemption of S29 ended with the implementer's first stage, so the failing test gives no problem (R9, R10, INV-004)
But had the test failed by an error, with pipeline.TestCase.failureKind "error" and pipeline.TestCase.firstErrorLine "TypeError: gemini.stream is not a function", the only problem would be "the test \"PRV-001/S4 Streams from gemini\" fails with an error, not an assertion: TypeError: gemini.stream is not a function; make it fail on what it asserts" (R8)
And had the run no test named for "SET-001/S4", the only problem would be "no test covers SET-001/S4; name it \"SET-001/S4 <scenario title>\"" (R1)

### S38: A documented test left failing cannot pass the implementer
Given the "PROP-201" of S37, in its "implementer" stage, with "PRV-001/S4 Streams from gemini" still failing and the test command exiting 1
When the implementer's done report is checked through pipeline.CheckReport
Then the only problem is "tests fail (exit 1): PRV-001/S4 Streams from gemini", as in S8, so the ticket reaches its reviewer only with every test passing, documented ones included (R5, INV-004)

## Rules
- R12: When the implementer's test run fails, its problem names the run's failed tests, then each file or suite the report marks failed with a message of its own (a test file that fails to load, a hook that throws), as its path relative to the project root, ": " and the first non-blank line of that message; the first 5 names are kept, joined by "; ". When it names none, the problem keeps the last 5 non-blank lines of the test command's output, stderr then stdout, each trimmed and joined by " | ", or says the command printed nothing. These diagnostics live only in the problem text: `spec test` prints what it printed before, in text and in JSON.
- R11: Only a done spec-writer stage on a proposal may give pipeline.Report.documents; a done report of any other role that lists any is refused. Each scenario it lists must be one its branch added, compared with the merge base of HEAD and the config's `baseBranch`; one that was already in the base spec, or that the spec does not have, is refused, one problem each.
- R10: The documented scenarios of a proposal are those in pipeline.StageRecord.documents of the latest done "spec-writer" stage in the ticket's history; an earlier stage's list never counts, so a spec-writer stage that runs again lists every scenario it still vouches for, and leaving one out revokes it. On a proposal only the spec-writer changes spec files (INV-003), so no scenario's steps can change after the stage that last listed it. Documented scenarios are left out of R3's red-test requirement only: R1 and R8 apply to them as to any new scenario, R8's problem included. Only before the ticket's first implementer stage (R9), the tester's stage is refused for each failing test of a documented scenario, and for each documented scenario that has tests but none that passes, whatever the reason (skipped, pending); these problems come before R3's and R8's. Once the implementer has run, a documented scenario is checked like any new scenario: a failing test on its assertion is accepted, since the implementer's own stage is refused until every test passes (R5).
- R9: R2 and R3 apply only to a tester stage with no "implementer" stage in the ticket's history, whatever its result, except that a build stage counts only when its record is done without lane "full" (PIP-021/R10): any other left no code on the branch; once the implementer has run, a tester stage may leave every test passing. R10's passing requirement for documented scenarios ends at the same point; every other check on the tester stands, R1, R7 and R8 included.
- R1: The tester's stage has a test for every scenario of every feature in the ticket's scope (its touches, violates and changed), and for every scenario its branch added or changed.
- R2: On a bug, before the implementer's first stage, a violated scenario that has tests has at least one failing (R9).
- R3: On a proposal, before the implementer's first stage, at least one test of the scenarios its branch added or changed fails; a reworded scenario, whose steps are the same, is not among them, nor is a documented scenario (R10). When every added or changed scenario is documented, no test need fail (R9).
- R4: No test names a scenario the spec does not have, unless the branch just added it. A test name claims a scenario only when its feature ID has the prefix of one of this spec's modules.
- R5: A done tester or implementer stage needs results from the test command, run over every test; the implementer's needs exit 0 and no failed test.
- R6: On a proposal, every hunk the tester makes to a file under `codeGlobs` and not under `testGlobs` adds a line holding "SPEC-STUB"; on a bug none may change; the implementer finishes only when no such file holds a "SPEC-STUB" line the ticket's branch added since the merge base with `baseBranch`, committed, uncommitted or untracked. A line that held the marker on the base branch never counts, even when the branch edits it.
- R7: Each command of format.Config.checkCommands runs, in order, only for a done tester or implementer stage. The implementer is refused when any command exits non-zero. The tester is refused only for a failure on a file under `testGlobs`, which the problem names with the command; a failure that names no such file does not refuse it. With no checkCommands, no command runs. A command's output has no fixed form, so the files a failing command names are read from the paths in its stdout and stderr: each path relative to the project root, or absolute inside it, that is a file of the project, with a leading "./" and a trailing ":<line>" or ":<line>:<col>" dropped. A path is judged by its form relative to the project root, so a command that prints absolute paths is read exactly as one that prints relative ones. So a tester cannot finish with a check command failing on a file of its own tests, which is what keeps the implementer from meeting it.
- R8: On a proposal, the tester's stage is refused for each failing test of a scenario its branch added or changed whose pipeline.TestCase.failureKind is "error", unless its pipeline.TestCase.firstErrorLine holds "SPEC-STUB"; the problem names the test and that line. A documented scenario (R10) is among them. A test with no failureKind is not refused.

## Out of scope
- How test names are matched to scenarios (PIP-011)
- How the scenarios a branch added or changed are found (PIP-007)
- The wrong implementation each test of a changed scenario must catch, which the tester's report names (PIP-019), and a build stage's proof run (PIP-024)
