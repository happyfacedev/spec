---
id: PIP-007
title: Keep a spec stage from losing IDs, leaving rules unshown or skipping a case
module: pipeline
status: active
invariants: [INV-001, INV-003, INV-006]
---
## Intent
A proposal's spec stage may add and change units, but never loses an ID, never changes a rule without the scenarios that show it, and never finishes without saying how it covered each item of the case checklist. A done spec-writer report gives one pipeline.ChecklistItem for each of C1 to C6 and C8: the scenarios, invariant or question that cover it, each an ID that exists, or na with the reason it does not apply; a C8 item cites no question that is still open, because an external fact nobody verified holds the ticket (INV-006). The CLI checks only that each item is there, says why, and cites what exists; whether the cover is enough is the reviewer's to judge. `check-report` compares the spec in the working tree with the spec at the merge base of HEAD and the config's `baseBranch` ("main" when unset), unit by unit, and refuses a done spec-writer stage that deleted a unit, took a number off `retired:`, brought a removed unit back, or changed a rule, an invariant or a screen while none of the scenarios showing it changed. It also refuses a scenario or rule number that another running ticket's recorded spec stage already took on its own branch, since a spec stage may add to features beyond its ticket's touches, where `spec plan` could not keep the two apart. The same refusal covers every new top-level numbered unit (an invariant, a decision, a feature or a screen), and its message names the number to take instead, so two tickets that each add "the next invariant" are told apart in the stage that adds it, not at the next stage's footprint check. The same comparison tells the tester which scenarios must start red, and the later briefs what is new. The spec review that follows judges the cover; its own report is held to a verdict and to findings that cite what exists, and it changes no file.

## Behaviour
### S1: A removed scenario is retired
Given the base spec has "SET-001/S3", and the branch deleted it without adding S3 to `retired:` of "SET-001"
When the spec-writer's done report for a proposal is checked through pipeline.CheckReport
Then a problem is "SET-001/S3 was removed; add S3 to retired in SET-001, so its number is never reused" (R1, INV-001)

### S2: Any other removed unit stays as a tombstone
Given the base spec has the feature "CNV-009", and the branch deleted its file
When the spec-writer's done report is checked through pipeline.CheckReport
Then a problem is "CNV-009 was removed; keep it as a tombstone with status: removed instead" (R1, INV-001)
And the scenarios of that deleted feature give no problem of their own, nor does a member whose contract was deleted with it

### S3: A retired number stays retired
Given the base spec lists S9 in `retired:` of "PRV-001", and the branch took it off
When the spec-writer's done report is checked through pipeline.CheckReport
Then the only problem is "PRV-001/S9 was taken off retired; a retired number stays retired" (R2, INV-001)

### S4: A removed unit never comes back
Given the base spec has "INV-001" with status removed, and the branch set it to active
When the spec-writer's done report is checked through pipeline.CheckReport
Then a problem is "INV-001 was removed and is active again; a removed ID is never reused, so give the new unit a new ID" (R2, INV-001)

### S5: A changed rule needs a changed scenario
Given the branch changed rule "ALP-001/R1", which only "ALP-001/S1" cites, and left "ALP-001/S1" as it was
When the spec-writer's done report is checked through pipeline.CheckReport
Then the only problem is "ALP-001/R1 changed, but no scenario that shows it did (ALP-001/S1); change them to show the new rule, or add one" (R3)

### S6: A changed invariant needs a changed scenario
Given the branch changed "INV-001", shown only by "ALP-001/S1", and left that scenario as it was
When the spec-writer's done report is checked through pipeline.CheckReport
Then the only problem is "INV-001 changed, but no scenario that shows it did (ALP-001/S1); change them to show the new invariant, or add one" (R3)

### S7: A screen whose states or copy changed needs a changed scenario
Given the branch changed the `## States` of "UI-001", cited only by "ALP-001/S1", and left that scenario as it was
When the spec-writer's done report is checked through pipeline.CheckReport
Then the only problem is "UI-001 changed, but no scenario that shows it did (ALP-001/S1); change them to show the new screen, or add one" (R3)
But a change to the screen's `## Layout` alone is a rewording and gives no problem (R4)

### S8: A new scenario title over the same steps is a rewording
Given the branch renamed "ALP-001/S1" from "Widget made" to "A widget is made" and kept its steps
When the tester's done report is checked through pipeline.CheckReport
Then "ALP-001/S1" is not among the scenarios that must start red (R4)

### S9: A rule nothing shows may change alone
Given the branch changed a rule that no scenario cites
When the spec-writer's done report is checked through pipeline.CheckReport
Then that rule gives no problem (R3)

### S10: Only a proposal is compared
Given a bug or a task in any stage, or a proposal outside its spec-writer and tester stages
When its done report is checked through pipeline.CheckReport
Then none of these checks runs

### S11: A complete checklist is accepted
Given "PROP-201" is in its "spec-writer" stage, its branch added "PRV-001/S4", the spec has "INV-002", and the ticket's question "PROP-201#Q1" of kind "external" has an answer
And the done report's pipeline.Report.checklist holds C1 scenarios with ids ["PRV-001/S4"], C4 invariant with ids ["INV-002"], C8 question with ids ["PROP-201#Q1"], and C2, C3, C5 and C6 each na with a reason
When the spec-writer's done report is checked through pipeline.CheckReport
Then no problem names the checklist (R5, R6, R7)

### S12: Every item is reported once
Given the "PROP-201" of S11, whose done report's pipeline.Report.checklist has no entry for C3
When the spec-writer's done report is checked through pipeline.CheckReport
Then the only problem is "the checklist has no entry for C3 (concurrency and ordering); add one: scenarios, invariant or question with the IDs that cover it, or na with the reason it does not apply" (R5)
And a report with no checklist at all gives that problem for each of C1, C2, C3, C4, C5, C6 and C8, in that order, with the labels "neighbours", "environment axes", "concurrency and ordering", "trust boundaries", "fail closed", "preserved behaviour" and "external facts" (R5)
And a checklist with two entries for C1 gives the problem "the checklist has 2 entries for C1; give one" (R5)

### S13: Not applicable needs a reason
Given the "PROP-201" of S11, whose C2 entry has outcome na and no reason
When the spec-writer's done report is checked through pipeline.CheckReport
Then the only problem is "checklist C2 is na without a reason; say why it does not apply" (R6)
And a reason of only spaces gives the same problem (R6)

### S14: Any other outcome cites what covers it
Given the "PROP-201" of S11, whose C1 entry has outcome scenarios and ids []
When the spec-writer's done report is checked through pipeline.CheckReport
Then the only problem is "checklist C1 is scenarios but cites no ID; cite what covers it" (R6)
And a C4 entry with outcome invariant and ids ["PRV-001/S4"] gives "checklist C4 cites PRV-001/S4, which is not an invariant" (R6)
And a C1 entry with outcome scenarios and ids ["INV-002"] gives "checklist C1 cites INV-002, which is not a scenario" (R6)
And a C8 entry with outcome question and ids ["PRV-001/S4"] gives "checklist C8 cites PRV-001/S4, which is not a question" (R6)

### S15: A cited ID must exist
Given the "PROP-201" of S11, whose C1 entry cites "PRV-001/S9" and whose C8 entry cites "PROP-201#Q7", while the spec has no "PRV-001/S9" and the ticket has no question Q7
When the spec-writer's done report is checked through pipeline.CheckReport
Then the problems are "checklist C1 cites PRV-001/S9, which does not exist" and "checklist C8 cites PROP-201#Q7, which does not exist" (R6)

### S16: An unverified external fact holds the stage
Given the "PROP-201" of S11, but "PROP-201#Q1" has no answer yet
When the spec-writer's done report is checked through pipeline.CheckReport
Then the only problem is "checklist C8 cites PROP-201#Q1, which is still open; an external fact nobody verified holds the ticket: report blocked with a blocker marked external: true" (R7, INV-006)
And once "PROP-201#Q1" has an answer, the same report is accepted (R7)
And a C8 entry that cites the open question "PROP-201#Q2" of kind "blocker", or the open question "PROP-201#Q3" of kind "preference" with a default, is refused the same way: "checklist C8 cites PROP-201#Q2, which is still open; an external fact nobody verified holds the ticket: report blocked with a blocker marked external: true", and likewise for "PROP-201#Q3" (R7)
But a C2 entry with outcome question that cites an open preference with a default gives no problem (R6, R7)

### S17: A blocked spec-writer stage needs no checklist
Given "PROP-201" is in its "spec-writer" stage and its report is blocked with one pipeline.Blocker whose pipeline.Blocker.external is true, and holds no checklist
When it is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true (R8)
And with a checklist that has only a C1 entry, citing "PRV-001/S9", which does not exist, it is still accepted (R8)

### S18: Other stages are never asked for a checklist
Given a done tester report on "PROP-201", a done implementer report on "TASK-101" and a done tester report on "BUG-301", none of them holding a checklist
When each is checked through pipeline.CheckReport
Then no problem names the checklist (R8)

### S19: The spec review sets a verdict, and changes cite what they are about
Given "PROP-201" is in its "spec-review" stage with a clean tree
When a done spec-review report is checked through pipeline.CheckReport
Then with no pipeline.Report.verdict the problem is "the spec-review sets verdict: approve or changes" (R9)
And with verdict "changes" and no pipeline.Report.findings the problem is "verdict changes needs at least one finding: { cites, text }" (R9)
And with verdict "changes" and one finding with cites ["PRV-001/S4"], which exists, and class "C1", pipeline.ReportCheck.ok is true and no problem names a checklist, verdict or finding (R8, R9)
And with verdict "approve" and one finding of class "C6" whose text starts "Follow-up:", pipeline.ReportCheck.ok is true (R9)

### S20: A spec review's finding cites IDs that exist, and carries no mark
Given "PROP-201" is in its "spec-review" stage with a clean tree, and its done report has verdict "changes"
When a report whose one finding has cites [] is checked through pipeline.CheckReport
Then the problem is "each spec-review finding cites at least one ID" (R9)
And a finding citing "PRV-001/S9", which does not exist, gives "spec-review finding cites PRV-001/S9, which does not exist" (R9)
And a finding with pipeline.ReviewFinding.spec true or pipeline.ReviewFinding.tests true gives "spec-review findings take no spec or tests mark: every one goes back to the spec-writer" (R9)

### S22: A number another running spec stage already took
Given "PROP-077", whose branch "ticket/PROP-077" holds a recorded spec-writer stage not merged into "main", added the scenario "PIP-017/S12" titled "Stats name the stage" and the rule "PIP-017/R9"
And "PROP-063" is in its "spec-writer" stage, and its branch added "PIP-017/S12" titled "A refused report is counted" and "PIP-017/R9" with other text
When the spec-writer's done report for "PROP-063" is checked through pipeline.CheckReport
Then the problems are "PIP-017/S12 is also new on ticket/PROP-077, whose spec stage is recorded; take numbers after those PROP-077 added to PIP-017, or wait for PROP-077 to merge" and "PIP-017/R9 is also new on ticket/PROP-077, whose spec stage is recorded; take numbers after those PROP-077 added to PIP-017, or wait for PROP-077 to merge" (R10)
But when the branch of "PROP-063" takes "PIP-017/S13" and "PIP-017/R10" instead, no problem names "PROP-077" (R10)
And a scenario both branches added with the same title and steps gives no problem (R10)
And a ticket whose spec-writer stage is running but not yet recorded, or whose branch is merged into "main", is not compared (R10)

### S23: An invariant number another running spec stage already took
Given "PROP-092", whose branch "ticket/PROP-092" holds a recorded spec-writer stage not merged into "main", added the invariant "INV-013" titled "A light lane only skips stages"
And "PROP-094" is in its "spec-writer" stage, and its branch added "INV-013" titled "A report is read once", while the highest invariant number on "main" is 12
When the spec-writer's done report for "PROP-094" is checked through pipeline.CheckReport
Then the only problem is "INV-013 is also new on ticket/PROP-092, whose spec stage is recorded; take INV-014, or wait for PROP-092 to merge" (R11)
But when the branch of "PROP-094" takes "INV-014" instead, no problem names "PROP-092" (R11)
And an invariant both branches added with the same text gives no problem (R11)
And a ticket whose spec-writer stage is running but not yet recorded, or whose branch is merged into "main", is not compared (R11)

### S24: A decision, a feature or a screen number another running spec stage took
Given "PROP-092" has a recorded spec-writer stage not merged into "main", and its branch added the decision "ADR-009", the feature "PIP-030" and the screen "UI-004", each with its own text
And "PROP-094" is in its "spec-writer" stage, and its branch added "ADR-009", "PIP-030" and "UI-004" with other text
When the spec-writer's done report for "PROP-094" is checked through pipeline.CheckReport
Then the problems are "ADR-009 is also new on ticket/PROP-092, whose spec stage is recorded; take ADR-010, or wait for PROP-092 to merge", "PIP-030 is also new on ticket/PROP-092, whose spec stage is recorded; take PIP-031, or wait for PROP-092 to merge" and "UI-004 is also new on ticket/PROP-092, whose spec stage is recorded; take UI-005, or wait for PROP-092 to merge" (R11)
And a module or a contract both branches added is not numbered, so this check names no number for it (R11)

### S25: The number named is free on every branch compared
Given "PROP-092" and "PROP-095" each have a recorded spec-writer stage not merged into "main", "PROP-092" added "INV-013", and "PROP-095" added "INV-013" and "INV-014" with other text
And "PROP-094" is in its "spec-writer" stage, and its branch added "INV-013" with yet other text
When the spec-writer's done report for "PROP-094" is checked through pipeline.CheckReport
Then each problem about "INV-013" takes the number "INV-015", one more than the highest invariant number on the base, in this tree and on every branch compared (R11)
And a report that takes the number a problem names gives no problem about it, unless a branch compared has added that number too (R11)

### S27: Several refused IDs of one prefix are told apart
Given "PROP-092" has a recorded spec-writer stage not merged into "main", and its branch added "INV-013" and "INV-014", each with its own text, while the highest invariant number on "main" is 12
And "PROP-094" is in its "spec-writer" stage, and its branch added "INV-013" and "INV-014" with other text
When the spec-writer's done report for "PROP-094" is checked through pipeline.CheckReport
Then the problems are "INV-013 is also new on ticket/PROP-092, whose spec stage is recorded; take INV-015, or wait for PROP-092 to merge" and "INV-014 is also new on ticket/PROP-092, whose spec stage is recorded; take INV-016, or wait for PROP-092 to merge" (R11)
And no two problems of one report suggest the same ID (R11)
And a refused decision in the same report is numbered from the decisions alone, so its suggestion does not depend on the invariants (R11)

### S26: A report cannot hide a top-level ID it added
Given the "PROP-094" of S23, whose done report lists a changed unit "ALP-001/S1" and not "INV-013"
When the spec-writer's done report is checked through pipeline.CheckReport
Then the problem about "INV-013" is the one S23 gives, because the added units are read from the branch and not from pipeline.Report (R11)

### S21: The spec review changes nothing
Given "PROP-201" is in its "spec-review" stage and "spec/modules/providers/features/PRV-001-stream.md" is uncommitted
When a done or a blocked spec-review report is checked through pipeline.CheckReport
Then the only problem is "the spec-review edits no files; revert spec/modules/providers/features/PRV-001-stream.md" (INV-003)
But when only "tickets/PROP-201.md" is uncommitted, no problem names a file (INV-003)

## Rules
- R1: A unit in the base spec stays in the spec: a scenario or rule by its number in `retired:`, any other unit as a tombstone with status removed.
- R2: Nothing comes off `retired:`, and a removed unit is never live again.
- R3: A rule, an invariant or a screen that the branch added or changed has at least one changed or added scenario among those that show it, when any scenario shows it.
- R4: A scenario's behaviour is its steps and their data; a screen's is its states and copy. A change to the rest is a rewording.
- R5: A done spec-writer report holds exactly one pipeline.ChecklistItem for each of C1, C2, C3, C4, C5, C6 and C8, the case checklist of its brief (PIP-012/R9). Each item left out is one problem, and each item given more than once is one problem, in item order.
- R6: An item with outcome na has a reason that is not blank. An item with any other outcome cites at least one ID, and each ID it cites exists and fits the outcome: a scenario for scenarios, an invariant for invariant, a question of the ticket or of a spec unit, written `<owner>#Q<n>`, for question. One problem per ID.
- R7: A C8 item cites no question that is still open, whatever its kind: an external fact the stage could not verify ends the stage blocked, with a blocker marked pipeline.Blocker.external (INV-006).
- R8: R5 to R7 hold a done spec-writer report only. A blocked one need not give a checklist, and one it gives is not checked; no other role's report is asked for one.
- R9: A done spec-review report sets pipeline.Report.verdict to "approve" or "changes"; "changes" needs at least one finding. Each spec-review finding, under either verdict, cites at least one ID, each ID a unit of the spec or a question of the ticket that exists, and carries neither pipeline.ReviewFinding.spec nor pipeline.ReviewFinding.tests true. A blocked spec-review report is not asked for a verdict.
- R10: A done spec-writer report is refused for each scenario or rule its branch added that the branch of another ticket in flight (TKT-011/R8) with a recorded spec-writer stage also added, each against its own merge base with the config's `baseBranch`, when the two differ as L035 compares them (LNT-018/R1, R2). The problem is "<ID> is also new on ticket/<ticket>, whose spec stage is recorded; take numbers after those <ticket> added to <feature>, or wait for <ticket> to merge", one per ID. A branch merged into the base is not compared: L035 covers it from then on.

- R11: R10 holds for every invariant, decision, feature and screen the branch added, not only for scenarios and rules, under the same conditions: the other ticket is in flight with a recorded spec-writer stage, each side against its own merge base, and the two differ as L035 compares them. The problem is "<ID> is also new on ticket/<ticket>, whose spec stage is recorded; take <next ID>, or wait for <ticket> to merge", one per ID, naming the lowest-numbered such ticket. <next ID> keeps the ID's prefix and is one more than the highest number of that prefix among the base spec, the branch's tree and the spec of every ticket compared, tombstones included, so that it is free on all of them. When one report has several refused IDs of one prefix, the suggestions are distinct: the refused IDs, in ascending order, take the next free numbers in ascending order, starting from that one more than the highest.

## Out of scope
- Lint's own checks on `retired:` and tombstones (lint)
- What counts as showing an invariant or citing a screen (format)
- Whether a checklist item's cover is enough: the spec review (PIP-017), and later the reviewer
- A checklist in another role's report (PIP-004) and the checklist's shape (PIP-003)
