---
id: PIP-011
title: Match tests to scenarios by name
module: pipeline
status: active
questions:
  - id: Q1
    kind: preference
    text: A grouped name counts as covering a scenario only when a space follows the scenario number ("PRV-002 S1 Fallback"), so a test named exactly "PRV-002 S1" covers nothing, though it is read as naming that scenario when checking for tests of removed scenarios. Should the bare grouped name count too?
    default: Keep today's behaviour, where the bare grouped name does not cover the scenario
    cites: [PIP-011/S4]
    answer: 'Change requested in review (2026-10-29): Count the bare name as covering the scenario. Filed as a proposal; until it lands, the spec states today''s behaviour.'
    raised_by: null
---
## Intent
A test belongs to a scenario through its name alone, so the link works in every language and runner: a test named "PRV-002/S1 Fallback enabled" covers scenario "PRV-002/S1". Stacks whose test names must be identifiers write the ID with underscores, and runners that report a group's name before the test's (Dart, Flutter) put the feature ID and the scenario number apart. Scenario S1 is never covered by a test of S10 or S11.

## Behaviour
### S1: The scenario ID, then a space
Given a test named "PRV-002/S1 Fallback enabled", and one named exactly "PRV-002/S1"
When a tester's done report is checked through pipeline.CheckReport
Then both cover "PRV-002/S1" (R1)

### S2: A longer number is another scenario
Given a test named "PRV-002/S10 Later"
When a tester's done report is checked through pipeline.CheckReport
Then it does not cover "PRV-002/S1" (R1)

### S3: The ID must come first
Given a test named "fallback PRV-002/S1"
When a tester's done report is checked through pipeline.CheckReport
Then it covers no scenario (R1)

### S4: A feature group around a scenario test
Given a Dart test "S1 Fallback enabled" in a group "PRV-002", reported as "PRV-002 S1 Fallback enabled"
When a tester's done report is checked through pipeline.CheckReport
Then it covers "PRV-002/S1" (R2)
But "PRV-002 S11 Other" does not cover "PRV-002/S1"

### S5: Identifier-style names
Given tests named "test_PRV_002_S1_fallback" and "TestPRV_002_S1Fallback"
When a tester's done report is checked through pipeline.CheckReport
Then both cover "PRV-002/S1" (R3)
But "test_PRV_002_S10_x" does not

### S6: The scenario a test names, for removed scenarios
Given tests named "PRV-001/S9 Removed long ago", "PRV-001 S9 Removed", "PRV-001 S9" and "test_PRV_001_S9_removed", and the spec has no "PRV-001/S9"
When a tester's done report is checked through pipeline.CheckReport
Then each is read as naming "PRV-001/S9" and gives the problem "test \"<name>\" names PRV-001/S9, which is not in the spec; delete or rename it" (R4)
And a test whose name starts with no scenario ID names none and gives no such problem

### S7: A feature group with only the scenario number
Given a Dart test "S1" in a group "PRV-002", reported as "PRV-002 S1"
When a tester's done report is checked through pipeline.CheckReport
Then it covers "PRV-002/S1" (R2)
But "PRV-002 S10" does not cover "PRV-002/S1"
And "PRV-002 S1Fallback" does not cover "PRV-002/S1"

### S8: A test named for a rule claims nothing
Given tests named "PRV-002/R1 Fallback rule", "PRV-002 R1 Fallback rule" and "test_PRV_002_R1_fallback", and the spec has "PRV-002/S1" and a rule "PRV-002/R1"
When a tester's done report is checked through pipeline.CheckReport
Then none covers "PRV-002/S1" and none is read as naming a scenario, so none gives the problem of S6 and none is flagged for being named for a rule (R5)

## Rules
- R1: A test covers a scenario when its name is the scenario ID, or starts with the ID and a space.
- R2: It also covers it when its name is the feature ID, a space and the scenario number, or starts with that and a space.
- R3: It also covers it when its name, after a leading "test", "test_", "Test" or "Test_", is the ID with "-" and "/" written "_", or starts with that and the next character is not a digit.
- R4: A test names a scenario when its name starts with a scenario ID followed by a space or the end, with a feature ID, a space and a scenario number followed by a space or the end, or, after the same leading word as R3, with the ID written with "_" and not followed by a digit.
- R5: A rule ID in a test name, written with a slash or a space before the R number, is neither a scenario ID nor a feature ID with a scenario number: the test covers no scenario (R1, R2, R3) and names none (R4), and the check of a tester's report neither credits nor flags it. A test is linked to a rule only through the scenarios that cite it, so a test of a rule's behaviour is named for the scenario it runs.

## Out of scope
- Rule IDs and feature IDs alone in test names: a test covers scenarios only
