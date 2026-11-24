---
id: LNT-018
title: Report IDs a branch reuses against its base (L035)
module: lint
status: active
writes: [lint.Report.findings]
invariants: [INV-001, INV-007]
---
## Intent
Parallel branches each take the "next free" number, so two of them can give one ID two meanings, and neither branch's own spec shows it: the plugin merge found FMT-002/S17, WSP-006/S29 and S30 and LNT-003/S18 and S19 added on two branches for different behaviour. One branch's lint can see this against its base: `spec lint --base <ref>`, or `--ci` with the config's base branch, compares the spec in the working tree with the spec at the base's tip and at the merge base, where the two parted. An ID the merge base already had is one unit on both sides, so changing or renaming it is a change, which the spec stage checks govern (PIP-007). An ID the merge base lacks that both sides define differently is a reuse (L035). The same comparison reports a unit the branch dropped without retiring its number or keeping a tombstone. Each scenario starts from the base spec of LNT-001, committed on "main" in a git repository, with the branch "ticket/TASK-001" made from it and checked out.

## Behaviour
### S1: A scenario number both sides added with different titles
Given "main" has since gained a scenario "S2" titled "Widget sold" in "ALP-001", and the working tree adds a scenario "S2" titled "Widget painted" to "ALP-001"
When the developer runs lint.Lint with lint.Lint.base "main"
Then lint.Report.findings is exactly: error "L035" at "modules/alpha/features/ALP-001-make-a-widget.md" on the line of the working tree's "S2" heading, id "ALP-001/S2" (INV-001, R1)
And its message is "ALP-001/S2 is ''Widget painted'' here and ''Widget sold'' on main, and each side added it after they parted"
And its fix is "IDs are never reused: give this one an ID that main does not have"
And cli.CommandResult.exitCode is 1
And lint.Lint with lint.Lint.ci and no lint.Lint.base, where format.Config.baseBranch is "main", gives the same finding (R4)

### S2: A rule number both sides added with different text
Given "main" has since gained the rule "R2: Every widget has a name" in "ALP-001", and the working tree adds "R2: A widget is red" to "ALP-001"
When the developer runs lint.Lint with lint.Lint.base "main"
Then lint.Report.findings is exactly: error "L035" at the line of the working tree's "R2", id "ALP-001/R2", message "ALP-001/R2 is ''A widget is red'' here and ''Every widget has a name'' on main, and each side added it after they parted" (INV-001, R1)
And when both sides added the contract "alpha.Gizmo" with different text, its message is "alpha.Gizmo is defined differently here and on main, and each side added it after they parted" (R1)

### S3: A renamed scenario is not a reused one
Given the working tree retitles "ALP-001/S1" to "A widget is made" and changes its steps, while "main" retitled it "Widget built"
And "main" has since gained "ALP-001/S2" titled "Widget sold", which the working tree does not have
And both sides added "ALP-001/S3" titled "Widget painted" with the same steps
When the developer runs lint.Lint with lint.Lint.base "main"
Then lint.Report.findings contains no "L035" (R2)

### S4: A scenario dropped without retiring its number
Given the working tree deletes "ALP-001/S1", which the merge base and "main" both have, and "ALP-001" has no "retired" list
When the developer runs lint.Lint with lint.Lint.base "main"
Then lint.Report.findings is exactly: error "L035" at "modules/alpha/features/ALP-001-make-a-widget.md" line 1, id "ALP-001/S1", message "ALP-001/S1 is on main but not here; add S1 to retired in ALP-001, so its number is never reused" (INV-001, R3)
And with "retired: [S1]" in the frontmatter of "ALP-001" there is no "L035"
And deleting the event "alpha.WidgetMade" instead gives the message "alpha.WidgetMade is on main but not here; keep it as a tombstone with status: removed" at "modules/alpha/contracts.md" (R3)

### S5: Nothing to compare with
Given the base spec of LNT-001 in a folder that is not a git repository
When the developer runs lint.Lint with lint.Lint.ci
Then lint.Report.findings contains no "L035" (R4)
And plain lint.Lint, without lint.Lint.ci or lint.Lint.base, contains no "L035" in a git repository either (R4)

### S6: A base that cannot be read is refused
Given the repository has no branch, tag or commit "nope"
When the developer runs lint.Lint with lint.Lint.base "nope"
Then cli.CommandResult.exitCode is 2 and cli.CommandResult.stdout is empty
And cli.CommandResult.stderr starts with "--base nope is not a commit in this repository" (R5)

## Rules
- R1: A unit that the merge base of HEAD and the base lacks, while the base and the working tree both define it, is reused when the two differ: a scenario in its title, a rule in its text, any other unit in its text, ignoring whitespace. It is an L035 error at the working tree's definition, naming the base's title and this one's for a scenario or a rule.
- R2: A unit the merge base already has is the same unit on both sides, however either side changed or renamed it, and a unit both sides added alike is one unit; neither is an L035.
- R3: A unit that the merge base and the base both have and the working tree does not is an L035 error unless its number is in its feature's `retired:` list (a scenario or rule); any other unit must stay as a tombstone. A scenario or rule is reported at line 1 of its feature's file, any other unit at line 1 of the file that held it.
- R4: The comparison runs with `--base <ref>`, or with `--ci` against format.Config.baseBranch ("main" when unset); `--ci` compares nothing when the project is not a git repository or the base branch does not exist, and lint without either option compares nothing.
- R5: A `--base` that git cannot resolve to a commit is refused with exit 2 before any finding is printed.

## Out of scope
- Lint rule codes, which are the CLI's own and not spec units: INV-007
- The same comparison for a finished spec stage: pipeline (PIP-007)
- An ID defined twice in one tree, or a retired number taken again: LNT-007
