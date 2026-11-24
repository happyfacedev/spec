---
id: PIP-019
title: Name the wrong implementation each test catches
module: pipeline
status: active
---
## Intent
A test that cannot fail checks nothing: one that compares generated output with itself passes whatever the code does. So on a proposal or a bug the tester names, under `mutations:`, a plausible wrong implementation for each scenario the ticket changes, and writes each test to fail against it. `ticket advance` keeps the list in the tester's record, and the reviewer checks tests against it at random. A later tester round, after the implementer or a review, keeps what earlier rounds named and lists only what is new or changed. The CLI checks only that every such scenario has one; whether the test would catch it is the reviewer's judgement. In the build lane, which has no tester, the build stage names them.

## Behaviour
### S1: A tester report that names no wrong implementation for a changed scenario is refused
Given the spec-writer of "PROP-201" added "PRV-001/S4" and "SET-001/S4", the tester's run fails "PRV-001/S4 Streams from gemini" on its assertion while every other test passes, and the done report's pipeline.Report.mutations is [{ scenario: PRV-001/S4, wrong: "streams from the first enabled provider, not the active one" }]
When the tester's done report is checked through pipeline.CheckReport
Then the only problem is "the report names no wrong implementation for SET-001/S4; add { scenario: SET-001/S4, wrong: \"<a plausible wrong implementation its test fails against>\" } under mutations" (R1)
And on "BUG-301", a done tester report with no mutations gives that problem for "PRV-002/S3", the scenario it violates (R1)
And a mutation with no wrong, or with a wrong that holds a line break, gives the only problem, starting "report mutations.0: " (R2)

### S2: A full list of mutations is accepted and kept
Given the same "PROP-201", whose pipeline.Report.mutations also holds { scenario: SET-001/S4, wrong: "enables gemini without saving its key" } and { scenario: CNV-001/S1, wrong: "sends the draft twice" }, a scenario the ticket does not change
When the tester's done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true (R1)
And "spec ticket advance" keeps the three mutations, whole and in order, in the tester's pipeline.StageRecord.mutations (R3)
But a mutation for "PRV-001/S9", which the spec does not have, gives the problem "mutations names PRV-001/S9, which is not in the spec; name a scenario your tests cover" (R1)

### S3: Only a done tester on a proposal or bug is asked for mutations
Given a blocked tester report on "PROP-201", and a done tester report on "TASK-101", neither holding mutations
When each is checked through pipeline.CheckReport
Then no problem names a mutation (R1)
But a done implementer report on "TASK-101" whose pipeline.Report.mutations holds one entry gives the problem "only the tester lists mutations; leave them out of the implementer's report" (R1)

### S4: The tester names what each test catches, and the reviewer checks it
Given "spec/roles/tester.md" and "spec/roles/reviewer.md" are this version's prompts
When `spec next` prepares a tester task and a reviewer task for "PROP-201"
Then the tester's prompt says that no test may compare generated output with itself, that each test must fail against the wrong implementation named for its scenario, and to list one under mutations: for each scenario the ticket changes that no tester round recorded after the latest done spec-writer stage named one for, and for each whose test it changed, so that rounds before that spec-writer stage do not count, and its report block form holds a "mutations: []" line (R4)
And the reviewer's prompt says to take, for each test of a scenario the ticket changes, one of the mutations that the done tester stages, and in the build lane the done implementer stages, since the latest done spec-writer stage in the ticket's history name for that scenario, chosen at random, check it against the test and the code, and give a finding with tests: true citing the scenario when the test would still pass with that wrong implementation (R4)

### S5: A later tester round names only what no earlier round did
Given the "PROP-201" of S1, whose history holds a done "spec-writer" stage, then a done "tester" stage with pipeline.StageRecord.mutations [{ scenario: PRV-001/S4, wrong: "streams from the first enabled provider, not the active one" }, { scenario: SET-001/S4, wrong: "enables gemini without saving its key" }], then an "implementer" stage, and whose "tester" stage is running again
And its done report's pipeline.Report.mutations is [{ scenario: SET-001/S4, wrong: "saves the key under the wrong provider" }] only
When the tester's done report is checked through pipeline.CheckReport
Then no problem names a mutation (R1)
And "spec ticket advance" keeps only that one mutation in the new pipeline.StageRecord.mutations (R3)
And a report with no mutations at all is accepted the same way (R1)
But when a done "spec-writer" stage is recorded after the earlier tester stage, a report with no mutations gives the problems "the report names no wrong implementation for PRV-001/S4; add { scenario: PRV-001/S4, wrong: \"<a plausible wrong implementation its test fails against>\" } under mutations" and the same for "SET-001/S4" (R1)

### S6: A build stage names them as a tester does
Given "PROP-215" is in a build stage (PIP-021/R9), and its branch added "PRV-001/S4"
When its done implementer report is checked through pipeline.CheckReport with no pipeline.Report.mutations, and then with [{ scenario: PRV-001/S4, wrong: "streams from the first enabled provider, not the active one" }], every other check passing
Then the first gives the only problem "the report names no wrong implementation for PRV-001/S4; add { scenario: PRV-001/S4, wrong: \"<a plausible wrong implementation its test fails against>\" } under mutations" (R1, R5)
And the second gives pipeline.ReportCheck.ok true, and "spec ticket advance" keeps the mutation in the "implementer" pipeline.StageRecord.mutations (R3)
And a later build stage, or a tester once the ticket has left the lane, need not name "PRV-001/S4" again unless a done "spec-writer" stage was recorded since (R1)
But a done implementer report on a proposal in the full lane that holds one gives the problem of S3 (R1)

## Rules
- R5: A build stage (PIP-021/R9) is held to R1, R2 and R3 as a tester stage on a proposal is, a report that gives up its lane (PIP-021/R10) aside, and its done record counts as an earlier round.
- R1: A done tester report on a proposal or a bug holds a pipeline.Mutation for every scenario the ticket changes that no earlier round names one for, before or after the implementer's first stage: on a proposal each scenario its branch added or changed, a reworded one aside and documented ones (PIP-006/R10) included; on a bug each scenario it violates. An earlier round names one when a done tester stage in the ticket's history holds a mutation for the scenario in its pipeline.StageRecord.mutations, and, on a proposal, no done spec-writer stage was recorded after it. Each scenario without one is one problem, in the order of the scenario IDs. A mutation for a scenario the spec does not have is refused; one for any other scenario is accepted. A blocked tester report, or one on a task, need hold none. Only a tester report, or a build stage's (R5), may hold mutations; any other role's report that holds one is refused, whatever its result. Every scenario in this spec that shows a done tester report on a proposal or bug being accepted gives that report these mutations.
- R2: A mutation holds a scenario and a wrong, a non-empty line; a missing key, a line break in wrong or any other key is refused when the report is read (PIP-003/R2).
- R3: `spec ticket advance` keeps a done tester report's mutations in that stage's pipeline.StageRecord.mutations, whole and in order; a report with none leaves the key out.
- R4: This version's tester prompt forbids a test that compares generated output with itself, asks for each test to fail against the wrong implementation named for its scenario, asks for mutations only for the scenarios no tester round recorded after the latest done spec-writer stage named one for and those whose test it changed (the rounds R1 counts), and its report block form holds a mutations: key. This version's reviewer prompt checks, for each test of a scenario the ticket changes, one mutation chosen at random from those the done tester and build-lane implementer stages since the latest done spec-writer stage name, against the code, and reports one that the test would not catch as a finding with tests: true.

## Out of scope
- Running a test against the named wrong implementation: the reviewer judges it from the test and the code
- The test-first checks on the same report (PIP-006) and the report's shape (PIP-003)
