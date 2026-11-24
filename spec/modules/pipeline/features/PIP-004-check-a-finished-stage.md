---
id: PIP-004
title: Check a finished stage's report
module: pipeline
status: active
provides: [pipeline.CheckReport]
decisions: [ADR-002]
---
## Intent
`spec check-report <role> <TICKET> [--report-file <path>]` reads a stage's final message from the file, or else on stdin, and says whether the stage may be recorded: the report fits the ticket and its running stage, every ID it names exists, a blocked stage says why, a done stage leaves lint clean and fits its role, and a reviewer's approval names no gap. A blocked stage may leave its work in the tree: `ticket advance` keeps it (PIP-008). It changes nothing, so a role or the finish hook can run it as often as it likes. The path, test and spec-stage checks are their own features (PIP-005, PIP-006, PIP-007); this one covers the rest and the output.

## Behaviour
### S1: A valid stage
Given "TASK-101" is in its "implementer" stage, only "src/providers/select.ts" changed, lint has no errors and every test passes
And stdin is a report with role implementer, ticket "TASK-101", result done and changed ["PRV-001/S1"]
When the developer runs `spec check-report implementer TASK-101` through pipeline.CheckReport
Then stdout is "report ok" and the exit code is 0

### S2: A refused stage
Given "TASK-101" is in its "implementer" stage and stdin is a report whose verdict is "approve"
When the developer runs `spec check-report implementer TASK-101` through pipeline.CheckReport
Then stdout is "report rejected:" followed by one "- <problem>" line per problem, and the exit code is 1

### S3: JSON output
Given the stage of S1
When the developer runs `spec check-report implementer TASK-101 --format json` through pipeline.CheckReport
Then stdout is a pipeline.ReportCheck with pipeline.ReportCheck.ok true, pipeline.ReportCheck.problems [] and pipeline.ReportCheck.report the parsed report, and the exit code is 0

### S4: The report names another role
Given "TASK-101" is in its "implementer" stage and the report says role "tester"
When it is checked through pipeline.CheckReport for role implementer
Then the problems are exactly ["the report says role tester, but this stage is implementer"]
And the path rules applied are the implementer's, the stage that is running (R1)

### S5: The report names another ticket
Given "TASK-101" is in its "implementer" stage and the report says ticket "TASK-103"
When it is checked through pipeline.CheckReport
Then the only problem is "the report is for TASK-103, but this stage is for TASK-101"

### S6: The ticket is not in that stage
Given "TASK-101" has tickets.Ticket.status "open" and tickets.Ticket.stage null
When an implementer report for it is checked through pipeline.CheckReport
Then the only problem is "TASK-101 is not in stage implementer (status open, stage none); stages begin with spec ticket start"

### S7: Blocked needs a blocker
Given "TASK-102" is in its "implementer" stage and the report has result blocked and no pipeline.Report.blockers
When it is checked through pipeline.CheckReport
Then the only problem is "result blocked needs at least one blocker: { text, cites }" (R2)

### S8: A blocked stage may leave its changes in the tree
Given "TASK-102" is in its "implementer" stage, "src/conversation/message.ts" is uncommitted, and the report is blocked with one pipeline.Blocker
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true and pipeline.ReportCheck.problems is empty (R2)
And with a clean tree the same report is accepted too

### S9: Done lists no blockers
Given a done report that lists one pipeline.Blocker
When it is checked through pipeline.CheckReport
Then a problem is "result done cannot list blockers; report blocked, or move them to assumed if they have a safe default" (R2)

### S10: Every ID the report names exists
Given a done report with changed ["PRV-001/S9"], where the spec has no "PRV-001/S9"
When it is checked through pipeline.CheckReport
Then the only problem is "changed lists PRV-001/S9, which does not exist" (R3)
And a blocker or finding citing a missing ID gives "a blocker cites <ID>, which does not exist" or "a finding cites <ID>, which does not exist"

### S11: A blocker may cite its own ticket and its questions
Given "TASK-102" is in its "implementer" stage and the report is blocked with one pipeline.Blocker whose pipeline.Blocker.cites are ["conversation.Message.meta", "TASK-102"]
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true (R3)
And "TASK-102#Q1" would also be accepted as a cite

### S12: An assumed question must be an open preference in scope
Given "TASK-101" is in its "implementer" stage and the report has assumed [{ question: "PROP-202#Q1", value: alphabetical }], a question of another ticket
When it is checked through pipeline.CheckReport
Then the only problem is "assumed PROP-202#Q1 is not an open preference of TASK-101"
But on "PROP-202" itself, whose open preference Q1 it is, the same pipeline.AssumedPreference is accepted

### S13: Only the reviewer and the spec review set a verdict or findings
Given an implementer report with verdict "approve"
When it is checked through pipeline.CheckReport
Then the only problem is "only the reviewer and the spec review set verdict and findings"
But a spec-review report with a verdict and findings gives no such problem (PIP-007)

### S14: Lint must be clean when done
Given "PROP-201" is in its "spec-writer" stage and lint reports one error
When a done report is checked through pipeline.CheckReport
Then the only problem starts "lint is not clean: " followed by up to 5 errors as "<file>:<line> <code> <message>" joined by "; ", then "; and <n> more" when there are more
And lint warnings never refuse a stage (R4)

### S15: The reviewer's verdict
Given "TASK-101" is in its "reviewer" stage with a clean tree
When a done reviewer report is checked through pipeline.CheckReport
Then with no pipeline.Report.verdict the problem is "the reviewer sets verdict: approve or changes"
And with verdict "changes" and no pipeline.Report.findings the problem is "verdict changes needs at least one finding: { cites, text }"
And a pipeline.ReviewFinding with no cites gives a problem made of "finding ", the first 60 characters of its text in double quotes, and " cites no ID"

### S16: A reviewer asks for changes citing an invariant
Given "TASK-101" is in its "reviewer" stage with a clean tree
And the report has verdict "changes" and findings [{ cites: ["INV-002", "PRV-001/S3"], text: "stream.ts logs the key", class: C4 }]
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true

### S17: Unknown role or ticket
Given any spec
When the developer runs `spec check-report boss TASK-101` through pipeline.CheckReport
Then it fails with pipeline.UnknownRole and exit code 2
And `spec check-report implementer TASK-999`, a ticket no store holds, fails with pipeline.UnknownTicket: stderr starts "Unknown TASK-999." and the exit code is 2

### S18: An approval that names a gap is refused
Given "TASK-101" is in its "reviewer" stage with a clean tree
And the report has verdict "approve" and summary "Clean refactor, but the build does not write the skill's bundle"
When it is checked through pipeline.CheckReport
Then the only problem is "an approval names a gap; give changes, or reword if it is not one" (R5)
And a finding of an approval whose text holds "TODO" and does not start with "Follow-up:" gives the same problem
But a report with verdict "changes" whose summary says "missing" and whose finding says "does not" is accepted

### S19: Only a verdict of changes marks a gap in the spec
Given "PROP-201" is in its "reviewer" stage with a clean tree
And the report has verdict "approve" and one finding with pipeline.ReviewFinding.spec true
When it is checked through pipeline.CheckReport
Then a problem is "a finding marked spec: true needs verdict changes" (R6)
And with verdict "changes" the same finding is accepted, and a report from any role but the reviewer and the spec review holding one gives "only the reviewer and the spec review set verdict and findings" (S13)

### S20: Only a verdict of changes asks for tests
Given "PROP-201" is in its "reviewer" stage with a clean tree
And the report has verdict "approve" and one finding with pipeline.ReviewFinding.tests true
When it is checked through pipeline.CheckReport
Then a problem is "a finding marked tests: true needs verdict changes" (R6)
And with verdict "changes" the same finding is accepted, and so is one that also has pipeline.ReviewFinding.spec true (R6)

### S21: Only the spec-writer gives a checklist
Given "TASK-101" is in its "implementer" stage and the done report's pipeline.Report.checklist holds one pipeline.ChecklistItem
When it is checked through pipeline.CheckReport
Then a problem is "only the spec-writer gives a checklist; leave it out of the implementer's report" (R7)
And a reviewer's or tester's report holding one gives the same problem with its own role, done or blocked (R7)

### S22: Every review finding names its class
Given "TASK-101" is in its "reviewer" stage with a clean tree
And the report has verdict "changes" and findings [{ cites: ["PRV-001/S3"], text: "stream.ts logs the key" }], with no class
When it is checked through pipeline.CheckReport
Then the only problem is "finding ''stream.ts logs the key'' has no class; add class: one of C1 to C9, or other" (R8)
And a spec-review report on "PROP-201" whose one finding has no class gives the same problem, and so does a "Follow-up:" finding on an approval (R8)
But with class "C4" on the finding, pipeline.ReportCheck.ok is true (R8)

### S23: Only an implementer on a proposal or bug marks a blocker tests
Given "PROP-201" is in its "implementer" stage and its report is blocked with one pipeline.Blocker whose pipeline.Blocker.tests is true and whose cites are ["PRV-001/S4"]
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true (R9)
But on "TASK-101" in its "implementer" stage the same report gives the only problem "a task has no tester stage: fix the test in this stage, and drop tests: true from the blocker" (R9)
And on a proposal in a build stage (PIP-021/R9) it gives the only problem "the build lane has no tester stage: fix the test in this stage, and drop tests: true from the blocker" (R9)
And a blocked tester, reviewer, spec-writer or spec-review report holding such a blocker gives the only problem "only the implementer marks a blocker tests: true" (R9)
And a blocker with both pipeline.Blocker.tests and pipeline.Blocker.external true gives the only problem "a blocker is marked tests or external, not both" (R9)

### S24: A report in a file is checked as one on stdin
Given the stage of S1, and "reports/TASK-101-i.md" under the project root holds the report of S1
And stdin is open and never closed
When the developer runs `spec check-report implementer TASK-101 --report-file reports/TASK-101-i.md` through pipeline.CheckReport with pipeline.CheckReport.reportFile
Then stdout is "report ok" and the exit code is 0, without waiting for stdin to close (R10)
And with the report of S2 in the file, stdout and the exit code are those of S2, and with `--format json` stdout is the pipeline.ReportCheck of S3 (R10)
And an absolute path to the same file gives the same result (R10)

### S25: The file wins over stdin
Given the stage of S1, and stdin holds a report that names "TASK-103"
And "reports/TASK-101-i.md" holds the report of S1
When the developer runs `spec check-report implementer TASK-101 --report-file reports/TASK-101-i.md` through pipeline.CheckReport
Then stdout is "report ok" and the exit code is 0, as the report on stdin is not read (R10)

### S26: A path that cannot be read is refused
Given "reports/missing.md" names no file
When the developer runs `spec check-report implementer TASK-101 --report-file reports/missing.md` through pipeline.CheckReport
Then it fails with pipeline.UnreadableReportFile, stderr is "reports/missing.md does not exist", stdout is empty and the exit code is 2 (R11)
And with a folder as the path, it fails the same way: stderr starts with the path, holds no "internal error", and the exit code is 2 (R11)
And no check runs: the working tree and the kept test run are as they were (R11)

### S27: Without a file, stdin is read as before
Given the stage of S1 and the report of S1 on stdin
When the developer runs `spec check-report implementer TASK-101` through pipeline.CheckReport
Then stdout is "report ok" and the exit code is 0, and a report on stdin that is not valid gives the problems of PIP-003 (R10)

### S28: A check that runs the tests says so on stderr
Given the stage of S1, a done implementer report, and a project whose test command is set
When the developer runs `spec check-report implementer TASK-101` through pipeline.CheckReport
Then stderr's first line is "tests: running the test command", written before the tests start (R12)
And stdout and the exit code are those of S1, so with `--format json` stdout is still one pipeline.ReportCheck (R12)
But a blocked report, or a done reviewer or spec-writer report, runs no test and stderr holds no line starting "tests: " (R12)

### S29: A Follow-up finding on an approval is not checked for gap words
Given "TASK-101" is in its "reviewer" stage with a clean tree
And the report has verdict "approve", summary "Clean refactor, every checklist item holds" and one finding { cites: ["PRV-001/S3"], text: "Follow-up: this unusual DTD case does not block approval.", class: C9 }
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true and pipeline.ReportCheck.problems is empty (R5)
And with the finding's text "Follow-up: TODO tidy the log wording", the check is still ok (R5)
But with a second finding whose text is "The retry path is missing a test" the only problem is "an approval names a gap; give changes, or reword if it is not one" (R5)
And with summary "Clean refactor, but the build does not write the skill's bundle" and only the Follow-up finding, the only problem is the same (R5)
And a Follow-up finding marked pipeline.ReviewFinding.spec true on an approval still gives "a finding marked spec: true needs verdict changes" (R6)

## Rules
- R12: A check that runs the project's test command writes the first line of stderr, "tests: running the test command", before the run starts, so a caller sees why it waits; stdout and the exit code do not change. A check that runs no test writes no such line.
- R11: A `--report-file` path that names no file, or a file that cannot be read, is refused with pipeline.UnreadableReportFile before any check runs; an empty or missing value is refused as any option without a value is (CLI-003).
- R10: With `--report-file <path>`, the message is the file's content, read as `ticket advance --report-file` reads it (PIP-018/R1), and stdin is not read (CLI-001/R4); without it, the message is stdin's, as before. Either way the same checks apply.
- R9: A blocker with pipeline.Blocker.tests true is accepted only in a blocked implementer report on a proposal or a bug, a build stage's aside (PIP-021/R12), and never with pipeline.Blocker.external true; each blocker that breaks this gives one problem.
- R8: Every finding of a reviewer's or spec review's report names a class, one of pipeline.FindingClass as the conventions define them, whatever the verdict; a finding with none gives one problem made of "finding ", the first 60 characters of its text in double quotes, and " has no class; add class: one of C1 to C9, or other".
- R7: Only a spec-writer's report may hold checklist entries; a report of any other role that holds one is refused, whatever its result.
- R6: A finding marked pipeline.ReviewFinding.spec true or pipeline.ReviewFinding.tests true is accepted only with verdict changes: an approval names no gap. A finding may carry both marks.
- R1: Every rule about paths and tests applies to the role whose stage is running, not to the role the report names.
- R2: A blocked stage has at least one blocker, and may leave uncommitted changes for `ticket advance` to keep; a done stage has no blockers.
- R5: A reviewer's report with verdict approve is refused when its summary or a finding holds, in any case, one of the words "does not", "doesn't", "not implemented", "missing" or "TODO", kept in one list: an approval means every checklist item holds and names no gap. A finding whose text starts with "Follow-up:" is optional by definition and is not checked for these words; every other finding is.
- R3: Every ID in changed, in a blocker's cites or in a finding's cites is a unit of the spec, the ticket itself, or one of the ticket's questions.
- R4: Lint errors on the spec and tickets refuse a done stage; warnings do not.

## Out of scope
- Which files each role may change (PIP-005)
- The tests each stage needs (PIP-006)
- What a spec stage may remove or change, and the spec-writer's case checklist (PIP-007)
- Bouncing a role back with the problems: the harness's finish hook (install)
