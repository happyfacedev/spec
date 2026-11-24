---
id: ADP-003
title: Find scenarios without a test
module: adopt
status: active
decisions: [ADR-001]
questions:
  - id: Q1
    kind: preference
    text: When the test command fails or writes no report, spec gaps says only "Not checked (no test run).", the same as with --no-tests, and does not say why. Should it print the reason, as spec test does?
    default: Keep today's line, with no reason
    cites: [ADP-003/S4]
    answer: 'Change requested in review (2026-10-29): Print the reason, as spec test already does. Filed as a proposal; until it lands, the spec states today''s behaviour.'
    raised_by: null
  - id: Q2
    kind: preference
    text: 'With --no-tests, or when the tests could not run, and nothing else is missing, spec gaps still ends "No gaps: every unit is confirmed, every question answered, every scenario tested." though no scenario was checked. Should that line say the tests were not checked?'
    default: Keep today's line
    cites: [ADP-003/S3]
    answer: 'Change requested in review (2026-10-29): Say that the tests were not checked. Filed as a proposal; until it lands, the spec states today''s behaviour.'
    raised_by: null
---
## Intent
A scenario no test covers is not yet held by the code, so `spec gaps` runs the project's whole test suite and lists every scenario no test is named after. It also lists tests named after a scenario the spec does not have, which usually means a renumbered or deleted scenario. `--no-tests` skips the run when it is slow or the tests cannot run yet.

## Behaviour
### S1: The whole suite runs
Given the config's testCommand is "npx vitest run -t \"{filter}\" --reporter=json --outputFile=\"{report}\""
When the developer runs `spec gaps` through adopt.Gaps
Then the test command runs once in the project root with {filter} replaced by the empty string

### S2: A scenario no test is named after
Given the feature "PRV-002" has a scenario "PRV-002/S3" and no test name starts with "PRV-002/S3 "
And every other scenario has a test named after it, such as "PRV-002/S1 Fallback enabled"
When the developer runs `spec gaps` through adopt.Gaps
Then the output holds "## Scenarios without a test (1)" and then "- PRV-002/S3"
And adopt.GapReport.scenariosWithoutTests is ["PRV-002/S3"] in JSON

### S3: Tests skipped
Given any spec
When the developer runs `spec gaps --no-tests` through adopt.Gaps with adopt.Gaps.noTests
Then the test command does not run
And the output holds "## Scenarios without a test" and then "Not checked (no test run)."
And adopt.GapReport.scenariosWithoutTests and adopt.GapReport.testsWithoutScenario are null in JSON
And no "## Tests for no scenario" section is printed

### S4: The tests could not run
Given the config's testCommand is "false", which writes no report, so the run fails with pipeline.NoTestResults
When the developer runs `spec gaps` through adopt.Gaps
Then the output holds "## Scenarios without a test" and then "Not checked (no test run)."
And the line after that starts "spec gaps: the test command wrote no report to " (R2)
And the command exits 0

### S5: A deprecated feature's scenarios still count
Given the feature "CNV-002" has status deprecated and its scenario "CNV-002/S1" has no test
When the developer runs `spec gaps --format json` through adopt.Gaps
Then adopt.GapReport.scenariosWithoutTests holds "CNV-002/S1"

### S6: A test for no scenario
Given a test named "CNV-001/S9 Ghost scenario" and the feature "CNV-001" has no scenario "S9"
When the developer runs `spec gaps` through adopt.Gaps
Then the output holds "## Tests for no scenario (1)" and then "- CNV-001/S9 Ghost scenario"
And adopt.GapReport.testsWithoutScenario is ["CNV-001/S9 Ghost scenario"] in JSON

### S7: No test for an unknown scenario
Given every test names a scenario the spec has, or names none
When the developer runs `spec gaps` through adopt.Gaps
Then no "## Tests for no scenario" section is printed
And adopt.GapReport.testsWithoutScenario is [] in JSON

### S8: A test named with another spec's ID is no gap
Given the spec's modules have the prefixes "ALP" and "BET", and a test is named "PRV-002/S1 is a fixture scenario"
When the developer runs `spec gaps --format json` through adopt.Gaps
Then adopt.GapReport.testsWithoutScenario does not hold "PRV-002/S1 is a fixture scenario" (R1)

### S9: The closing line when the tests were not checked
Given a spec with no drafts, no open questions, no module without features and no unused contract
When the developer runs `spec gaps --no-tests` through adopt.Gaps with adopt.Gaps.noTests
Then the last line is "No gaps: every unit is confirmed, every question answered, the tests were not checked."
And the command exits 0

### S10: The closing line when the tests could not run
Given a spec with no drafts, no open questions, no module without features and no unused contract, and the config's testCommand is "false", which writes no report
When the developer runs `spec gaps` through adopt.Gaps
Then the last line is "No gaps: every unit is confirmed, every question answered, the tests were not checked." (R2)
And the command exits 0

## Rules
- R1: A test name claims a scenario only when its feature ID has the prefix of one of this spec's modules; a name that claims none is never a test for no scenario.
- R2: The tests could not run when the test command gave no results: it failed to start, timed out, wrote no report, or wrote one in no known format. Then no scenario is checked, as with `--no-tests`, and the line after "Not checked (no test run)." gives the same reason `spec test` gives.

## Out of scope
- How a test name ties to a scenario, and the report formats read: `spec test`, in the pipeline module
- Whether the tests pass: a failing test still covers its scenario here
