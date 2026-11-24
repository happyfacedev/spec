---
id: PIP-014
title: Tell later stages what a proposal's spec stage changed
module: pipeline
status: active
---
## Intent
On a proposal, the tester, implementer and reviewer each work from what the spec stage changed, and no role should have to copy that list. Their briefs compute it, by comparing the spec on the ticket's branch with the spec where the branch left the base branch, and say what each role does about it: the tester writes failing tests first, the implementer makes them pass without touching tests (in the build lane it writes both), the reviewer checks the diff against each one. Removed scenarios are listed too, so their tests go with them.

## Behaviour
### S1: The tester is told what is new
Given the spec-writer of "PROP-201" added "PRV-001/S4", titled "Streams from gemini", on its branch
When `spec brief tester PROP-201` runs through pipeline.Brief
Then the brief holds "## New in the spec", then "This ticket's spec stage added or changed these, compared with main. Write their tests before any code changes. They describe behaviour the code does not have yet, so at least one must fail now. Where a test would not compile, add a stub that throws, marked SPEC-STUB."
And the line "- PRV-001/S4 Streams from gemini (added)" (R1)

### S2: The implementer is told the tests are red
Given the same branch after the tester's stage
When `spec brief implementer PROP-201` runs through pipeline.Brief
Then the group's text says "The tester's tests for these fail now. Change the code until every test passes, and replace any stub marked SPEC-STUB; do not change any test file." (R1)

### S3: The reviewer is told what to check
Given the same branch
When `spec brief reviewer PROP-201` runs through pipeline.Brief
Then the group's text says "Check that the diff makes each of these true, and that the tests check what the steps say." (R1)

### S4: How each unit changed
Given the branch added one unit, changed another's text, gave a scenario a new title over the same steps, and changed only a screen's layout
When pipeline.Brief runs for the tester
Then their lines end in "(added)", "(changed)", "(reworded: same steps)" and "(reworded: layout only)" (R2)
And features and modules are not listed, since their text changes with any part of them

### S5: Removed scenarios
Given the branch removed "SET-001/S3"
When pipeline.Brief runs for the tester, the implementer and the reviewer
Then each brief's group ends "Removed from the spec: SET-001/S3." followed by, in turn, "Delete their tests: a test must name a scenario the spec has.", "Remove the behaviour they described, unless another scenario still needs it." and "Check that their tests are gone and that no other scenario depended on them." (R1)

### S6: Only proposals, and never the spec-writer
Given a bug, a task, or a proposal whose branch changed no spec unit
When pipeline.Brief runs for any role
Then the brief has no "## New in the spec" group
And the spec-writer's brief never has one (R3)

### S7: Outside a repository
Given the project is not a git repository, or the base branch cannot be found
When pipeline.Brief runs for the tester on a proposal
Then the brief has no "## New in the spec" group and is otherwise complete (R3)

### S8: The tester is told which new scenarios document today's behaviour
Given "PROP-201" has no "implementer" stage in its history, its spec-writer added "PRV-001/S4", titled "Streams from gemini", and "SET-001/S4", titled "Enable gemini", and its done pipeline.StageRecord has pipeline.StageRecord.documents ["SET-001/S4"]
When `spec brief tester PROP-201` runs through pipeline.Brief
Then the group holds the lines "- PRV-001/S4 Streams from gemini (added)" and "- SET-001/S4 Enable gemini (added; documents current behaviour, so its test must pass now)" (R4)
But once a later done spec-writer stage is recorded with no pipeline.StageRecord.documents, the line is "- SET-001/S4 Enable gemini (added)" again (R4)
And when every listed scenario is documented, the group's text is "This ticket's spec stage added these, compared with main. They document behaviour the code already has: write a test for each, and each must pass now." (R4)

### S9: After the implementer, documented scenarios get no special line
Given the "PROP-201" of S8, with a done "implementer" stage in its history and then a reviewer "changes" that sent it back to the "tester"
When `spec brief tester PROP-201` runs through pipeline.Brief
Then the group holds the line "- SET-001/S4 Enable gemini (added)", without "documents current behaviour", and its text is not the "each must pass now" text of S8 (R4)

### S10: A build stage is told to write tests and code
Given "PROP-215" is in the build lane with no done build stage, its spec-writer added "PRV-001/S4", titled "Streams from gemini", and "SET-001/S4", titled "Enable gemini", removed "SET-001/S3", and its done pipeline.StageRecord has pipeline.StageRecord.documents ["SET-001/S4"]
When `spec brief implementer PROP-215` runs through pipeline.Brief
Then the group's text says "Write a test for each and the code that makes it pass, in this stage. With only the test files on the code as it was before the build, each must have a test that fails on an assertion; then every test must pass." and does not say "do not change any test file" (R5)
And it holds the lines "- PRV-001/S4 Streams from gemini (added)" and "- SET-001/S4 Enable gemini (added; documents current behaviour, so its test must pass on the code before the build)" (R5)
And the group ends "Removed from the spec: SET-001/S3. Delete their tests: a test must name a scenario the spec has. Remove the behaviour they described, unless another scenario still needs it." (R5)
And the brief of every later build stage says the same (R5)
But once the ticket has left the build lane, the implementer's group is the one of S2, and a tester's before any done build stage keeps the lines of S8 (R4, R5)

## Rules
- R5: In a build stage (PIP-021/R9) the implementer's brief has the text of S10 in place of the one that leaves the tests alone, marks each scenario documented by the latest done spec-writer stage, and gives both lines about removed scenarios.
- R4: In the tester's brief of a ticket with no "implementer" stage in its history, a scenario in pipeline.StageRecord.documents of the latest done spec-writer stage in the ticket's history (PIP-006/R10) ends in "(added; documents current behaviour, so its test must pass now)"; when every listed unit is such a scenario, the group's text says their tests pass now instead of asking for one to fail. Once the implementer has run (PIP-006/R9), the brief says nothing special for documented scenarios: they are listed and described like any other added scenario, since their tests are held like any test (PIP-006/S37).
- R1: Each later role's brief on a proposal lists what the branch added, changed or reworded, compared with the merge base of HEAD and the config's `baseBranch`, with the one line of what that role does about it, and the scenarios it removed with what to do about them.
- R2: A scenario whose steps and their data are unchanged, or a screen whose states and copy are unchanged, is "reworded", never "changed".
- R3: The group appears only on a proposal, only for the tester, implementer and reviewer, and only when there is something to list.

## Out of scope
- The checks that use the same comparison (PIP-006, PIP-007)
