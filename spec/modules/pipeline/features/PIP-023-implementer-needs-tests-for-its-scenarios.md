---
id: PIP-023
title: Hold the implementer to tests for the scenarios it delivers
module: pipeline
status: active
---
## Intent
A run of zero tests is a valid result (PIP-010/R3), so an implementer whose test command exits 0 and lists no test would pass PIP-006/R5 with nothing run. The implementer's stage therefore needs the same proof as the tester's that the scenarios the ticket is about still have a test in the run: a test runner that stops finding tests cannot carry a ticket to review.

## Behaviour
### S1: An implementer's run with no test for its scenarios is refused
Given "PROP-201" is in its "implementer" stage, its branch added "PRV-001/S4" and changed the steps of "SET-001/S4", and the test command exits 0 with pipeline.TestRun.tests [] and pipeline.TestRun.error null
When the implementer's done report is checked through pipeline.CheckReport
Then the problems are "no test covers PRV-001/S4; name it \"PRV-001/S4 <scenario title>\"" and "no test covers SET-001/S4; name it \"SET-001/S4 <scenario title>\"" (R1)
And with a passing test for "PRV-001/S4" only, the only problem is the one for "SET-001/S4" (R1)

### S2: A bug's violated scenario needs a test too
Given "BUG-301" violates "PRV-002/S3" and is in its "implementer" stage, and the test command exits 0 with pipeline.TestRun.tests [] and pipeline.TestRun.error null
When the implementer's done report is checked through pipeline.CheckReport
Then the only problem is "no test covers PRV-002/S3; name it \"PRV-002/S3 <scenario title>\"" (R1)

### S3: A run that covers its scenarios is accepted
Given the "PROP-201" of S1, whose run holds a passing test for each of "PRV-001/S4" and "SET-001/S4", exits 0 and has no failed test
When the implementer's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true (R1)

### S4: A ticket that names no scenario needs none
Given "TASK-101", a task whose branch changes no spec file, is in its "implementer" stage, and the test command exits 0 with pipeline.TestRun.tests [] and pipeline.TestRun.error null
When the implementer's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true (R1)

## Rules
- R1: A done implementer stage on a proposal or a bug needs, besides PIP-006/R5, at least one test in the run that covers each scenario the ticket violates and each scenario its branch added or changed (PIP-011); a skipped or failing test counts as covering, as in PIP-006/R1, and a failing one is refused by PIP-006/R5. The problem for each is the one PIP-006/R1 gives a tester. A task, which has no spec stage, names no scenario, so none is needed.

## Out of scope
- The tester's checks, test first and the documented scenarios: PIP-006
- The reviewer, whose done report runs no tests (PIP-006/S10)
