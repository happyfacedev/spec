---
id: PIP-003
title: Read the report block a stage ends with
module: pipeline
status: active
---
## Intent
Every role ends its final message with one fenced `report` block of YAML, so the CLI can check and record a stage without reading prose. Anything else in the message is ignored. A message that holds no block, two blocks, YAML that does not parse, or a block that does not fit the report's shape gets one problem that says what to fix, and no other check runs.

## Behaviour
### S1: A well-formed report
Given a final message of prose followed by this block:
```text
~~~report
role: implementer
ticket: "TASK-101"
result: done
summary: Extracted provider selection
~~~
```
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.report has pipeline.Report.role "implementer", pipeline.Report.result "done" and pipeline.Report.summary "Extracted provider selection"
And pipeline.Report.changed, pipeline.Report.assumed, pipeline.Report.blockers and pipeline.Report.findings are each [], and pipeline.Report.verdict is null (R1)

### S2: Other code blocks are ignored
Given a final message holding a "ts" code block and then one "report" block fenced with three backticks
When it is checked through pipeline.CheckReport
Then the report is read from the "report" block alone

### S3: No report block
Given a final message "All done!" with no fenced block
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.problems is exactly ["the final message has no ```report block; end with exactly one"] and pipeline.ReportCheck.report is null (R2)

### S4: Two report blocks
Given a final message with two "report" blocks
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.problems is exactly ["the final message has 2 report blocks; end with exactly one"] (R2)

### S5: Not YAML
Given a "report" block holding "role: [implementer"
When it is checked through pipeline.CheckReport
Then the only problem starts "the report is not valid YAML: " followed by the first line of the parser's message (R2)

### S6: A value outside its type
Given a "report" block with result "finished"
When it is checked through pipeline.CheckReport
Then the only problem starts "report result: " (R2)

### S7: An unknown key
Given a "report" block that also holds "notes: hello"
When it is checked through pipeline.CheckReport
Then the only problem starts "report (root): " and names the key "notes" (R1, R2)

### S8: A summary that is too long
Given a "report" block whose pipeline.Report.summary is 501 characters
When it is checked through pipeline.CheckReport
Then the only problem starts "report summary: "
But a summary of 215 characters is accepted (R1)

### S9: A ticket ID in the wrong shape
Given a "report" block with ticket "ticket-1"
When it is checked through pipeline.CheckReport
Then the only problem starts "report ticket: not a valid " (R2)

### S10: An assumption has one of two shapes
Given a "report" block whose pipeline.Report.assumed is [{ question: "PROP-202#Q1", value: alphabetical }, { new: "Name of the new module", value: 3 }]
When it is checked through pipeline.CheckReport
Then the first is a pipeline.AssumedPreference, and the second a pipeline.AssumedNew whose pipeline.AssumedNew.value is the text "3" (R1)

### S11: A finding may mark a gap in the spec
Given a "report" block with verdict "changes" and findings [{ cites: ["PRV-001/S3"], text: "no scenario covers a second rate limit", spec: true }, { cites: ["PRV-001/R1"], text: "select.ts ignores the rule" }]
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.report has pipeline.ReviewFinding.spec true on the first finding and none on the second (R3)

### S12: The marker is true or false
Given a "report" block with a finding whose spec is "yes"
When it is checked through pipeline.CheckReport
Then the only problem starts "report findings: " (R2, R3)
And a finding with spec false is read as a finding about the code (R3)

### S13: A spec-writer lists the scenarios that document today's behaviour
Given a spec-writer's "report" block for "PROP-201" that also holds "documents: [PRV-001/S4, SET-001/S4]"
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.report has pipeline.Report.documents ["PRV-001/S4", "SET-001/S4"] (R1, R4)
And a block without the key has pipeline.Report.documents [] (R1)
And "documents: PRV-001/S4", not a list, gives the only problem starting "report documents: " (R2, R4)

### S14: A finding may ask only for tests
Given a "report" block with verdict "changes" and findings [{ cites: ["PRV-001/S3"], text: "no test checks the second rate limit", tests: true }, { cites: ["PRV-001/R1"], text: "select.ts ignores the rule", tests: false }]
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.report has pipeline.ReviewFinding.tests true on the first finding, and the second is read as a finding about the code (R3)
And a finding whose tests is "yes" gives the only problem starting "report findings: " (R2, R3)

### S17: A spec-writer reports its case checklist
Given a spec-writer's "report" block for "PROP-201" that also holds "checklist: [{ item: C1, outcome: scenarios, ids: [PRV-001/S4] }, { item: C2, outcome: na, reason: no path is read }]"
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.report has pipeline.Report.checklist of two pipeline.ChecklistItem: the first with pipeline.ChecklistItem.item "C1", pipeline.ChecklistItem.outcome "scenarios" and pipeline.ChecklistItem.ids ["PRV-001/S4"], the second with pipeline.ChecklistItem.item "C2", pipeline.ChecklistItem.outcome "na", pipeline.ChecklistItem.ids [] and pipeline.ChecklistItem.reason "no path is read" (R1, R5)
And a block without the key has pipeline.Report.checklist [] (R1)

### S15: A checklist entry outside its shape
Given a "report" block whose checklist is [{ item: C7, outcome: scenarios, ids: [PRV-001/S4] }]
When it is checked through pipeline.CheckReport
Then the only problem starts "report checklist.0: " (R2, R5)
And so does it for an entry with outcome "skip", an entry with no item, or an entry that also holds "notes: hello" (R2, R5)

### S16: A blocker may mark an external fact
Given a "report" block with result blocked and blockers [{ text: "Does Claude Code expand CLAUDE_PLUGIN_ROOT in skill text?", cites: [PROP-201], external: true }]
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.report has one pipeline.Blocker with pipeline.Blocker.external true (R6)
And a first blocker with external "yes" gives the only problem, starting "report blockers.0: " (R2, R6)

### S18: A finding may carry a class
Given a "report" block with verdict "changes" and findings [{ cites: ["PRV-001/S3"], text: "no scenario covers a second rate limit", class: C1 }, { cites: ["PRV-001/R1"], text: "select.ts ignores the rule" }]
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.report has pipeline.ReviewFinding.class "C1" on the first finding and no class on the second (R3)
And a finding whose class is "C10", "c1" or "neighbours" gives the only problem starting "report findings: " (R2, R3)

### S19: A one-line summary may hold a colon
Given a "report" block whose summary line is "summary: Second fix: the colon case", with no quotes
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.report has pipeline.Report.summary "Second fix: the colon case" and none of the problems starts "the report is not valid YAML: " (R7)
And the same summary written as "summary: ''Second fix: the colon case''" is read as the same text (R7)
But a summary line "summary: ''Second fix: the colon case", whose quote is never closed, gives the only problem starting "the report is not valid YAML: " (R2, R7)

### S20: The role prompts show the summary quoted
Given "PROP-201" is ready for a stage of each role, and the project's role prompts are this version's
When `spec next PROP-201 --format json` prepares each task
Then the task's one report block holds the line "summary: ''<one line, at most 120 characters>''" for every role (R8)

### S21: The report is read as YAML first
Given a "report" block with the lines "result: done  # done | blocked" and "summary: Plain thing # a note", which are valid YAML as written
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.report has pipeline.Report.result "done" and pipeline.Report.summary "Plain thing", the comments being comments (R7)
And with the summary line "summary: Second fix: the colon case" instead, pipeline.ReportCheck.report has pipeline.Report.result "done" and pipeline.Report.summary "Second fix: the colon case", and the comment on the result line is still a comment (R7)

## Rules
- R7: The report is read as YAML as written. Only when that fails, and the report has a summary written on one line without quotes, is that summary read as the text after "summary:", even when it holds ": ", and the report is read again with that line quoted and every other line as written, so comments on other lines stay comments. This holds when the value does not start with a quote, "|", ">", "[", "{", "&", "*" or "!" and the next line is another key; any other summary stays as YAML read it, so a quoted one with a colon is the same text, and an unclosed quote is still not valid YAML.
- R8: This version's role prompts show the report form's summary line quoted, as "summary: ''<one line, at most 120 characters>''".
- R5: A checklist entry holds item, one of C1, C2, C3, C4, C5, C6 and C8, outcome, one of scenarios, invariant, question and na, and, optionally, ids and reason; any other key or value is refused, and ids left out is []. Whether the checklist is complete and its IDs fit is checked once the report is read (PIP-007).
- R6: A blocker may hold external as true or false; any other value is refused.
- R4: documents is a list of scenario IDs; who may list what is checked once the report is read (PIP-006).
- R1: The report holds exactly the keys of pipeline.Report; a list key left out or empty is []; verdict left out is null; summary is 1 to 500 characters.
- R3: A finding holds cites, text and, optionally, spec and tests, each true or false, and class, one of pipeline.FindingClass; any other key or value is refused. Whether a finding needs a class is checked once the report is read (PIP-004).
- R2: A report that cannot be read gives one problem and no other check runs.

## Out of scope
- The checks on a report that was read (PIP-004 and on)
- Where the report comes from when `ticket advance` gets none on stdin (PIP-008)
