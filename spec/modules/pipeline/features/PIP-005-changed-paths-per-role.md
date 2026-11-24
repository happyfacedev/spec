---
id: PIP-005
title: Refuse changes outside what the role may change
module: pipeline
status: active
invariants: [INV-003]
decisions: [ADR-001]
---
## Intent
Each role owns one kind of file, so a stage cannot quietly do another role's work: the spec-writer writes the spec, the tester the tests, the implementer the code (and, in the build lane, which has no tester, the tests), and the reviewer nothing. `check-report` compares a done stage's uncommitted changes against HEAD with the config's `codeGlobs`, `testGlobs` and `protectedGlobs` and the spec root, and names each file to revert. Ticket files are written by the CLI itself, and what `worktreeSetup` made in the ticket's worktree belongs to no role, so neither ever counts.

## Behaviour
### S1: The implementer changes code only
Given "TASK-101" is in its "implementer" stage and "src/a.ts" and "spec/modules/providers/contracts.md" are uncommitted
When a done report is checked through pipeline.CheckReport
Then a problem is "the implementer never changes spec files; revert spec/modules/providers/contracts.md" (INV-003)

### S2: The spec-writer changes spec files only
Given "PROP-201" is in its "spec-writer" stage and "spec/modules/providers/contracts.md" and "src/providers/config.ts" are uncommitted
When a done report is checked through pipeline.CheckReport
Then the only problem is "the spec-writer changes spec files only; revert src/providers/config.ts" (INV-003)

### S3: The tester changes test files only on a bug
Given "BUG-301" is in its "tester" stage and "tests/PRV-002.test.ts" and "src/providers/fallback.ts" are uncommitted, the test failing as it should
When a done report is checked through pipeline.CheckReport
Then the only problem is "the tester changes test files only; revert src/providers/fallback.ts" (INV-003)

### S4: On a proposal the tester may change code only by stubs
Given "PROP-205" is in its "tester" stage and "spec/modules/conversation/contracts.md" is uncommitted besides its tests
When a done report is checked through pipeline.CheckReport
Then a problem is "the tester changes test files only, and code only to add stubs marked SPEC-STUB; revert spec/modules/conversation/contracts.md" (INV-003)

### S5: On a proposal or a bug the tests are the tester's
Given "PROP-201" is in its "implementer" stage and "src/providers/config.ts" and "tests/PRV-001.test.ts" are uncommitted
When a done report is checked through pipeline.CheckReport
Then the only problem is "on a proposal the tests are the tester's and the implementer changes code only; revert tests/PRV-001.test.ts, or report a blocker that cites the scenario whose test is wrong" (R1, INV-003)

### S6: On a task the implementer may move tests with the code
Given "TASK-101" is in its "implementer" stage, "src/providers/select.ts" and "tests/PRV-001.test.ts" are uncommitted and every test passes
When a done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true (R1)

### S7: The reviewer changes nothing
Given "TASK-101" is in its "reviewer" stage and "src/a.ts" is uncommitted
When a done report with verdict "approve" is checked through pipeline.CheckReport
Then the only problem is "the reviewer edits no files; revert src/a.ts" (INV-003)

### S8: A task changes no spec file in any stage
Given the task "TASK-101" is in a "spec-writer" stage and "spec/modules/providers/contracts.md" is uncommitted
When a done report is checked through pipeline.CheckReport
Then the problems are "a task changes no spec file in any stage; revert spec/modules/providers/contracts.md" and "only proposals change the spec; TASK-101 is a task" (R2)

### S9: Only a proposal has a spec stage
Given the bug "BUG-301" is in a "spec-writer" stage with no uncommitted change
When a done report is checked through pipeline.CheckReport
Then the only problem is "only proposals change the spec; BUG-301 is a bug" (R2)

### S10: Protected files never change
Given the config's `protectedGlobs` is ["tests/SET-002.test.ts"], and "PROP-205" is in its "implementer" stage with "src/conversation/copy.ts" and "tests/SET-002.test.ts" uncommitted
When a done report is checked through pipeline.CheckReport
Then the problems are, in order, "on a proposal the tests are the tester's and the implementer changes code only; revert tests/SET-002.test.ts, or report a blocker that cites the scenario whose test is wrong" and "protected files may not change: revert tests/SET-002.test.ts" (INV-003)

### S11: Ticket files are not the role's changes
Given "TASK-101" is in its "reviewer" stage and only "tickets/TASK-101.md" is uncommitted
When a done report with verdict "approve" is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true (R3)

### S12: An invalid stage blocks the ticket and is not committed
Given "TASK-101" is in its "implementer" stage and "tests/SET-002.test.ts", a protected file, was overwritten
When the stage is recorded through pipeline.AdvanceTicket
Then it fails with pipeline.InvalidReport, the exit code is 1 and HEAD is unchanged
And the last tickets.Question.text on "TASK-101" holds "invalid report: " and "protected files may not change" (INV-003)

### S13: What the worktree's setup made is no role's change
Given "spec worktree add PROP-205" ran format.Config.worktreeSetup "ln -s \"$SPEC_MAIN_ROOT/node_modules\" vendor-modules", which git does not ignore, so "vendor-modules" is recorded in "spec/setup/PROP-205.txt" in the repository's git directory
And "PROP-205" is in its "spec-writer" stage in that worktree, with "vendor-modules" its only untracked path
When a done report is checked through pipeline.CheckReport
Then pipeline.ReportCheck.ok is true (R4, INV-003)
But a file the stage itself adds outside the spec, such as "notes.txt", is still refused with "the spec-writer changes spec files only; revert notes.txt"

### S14: A build stage changes tests and code, and nothing else
Given the config's `protectedGlobs` is ["tests/SET-002.test.ts"], "PROP-215" is in a build stage (PIP-021/R9), and "src/providers/config.ts" and "tests/PRV-001.test.ts" are uncommitted
When a done report is checked through pipeline.CheckReport
Then no problem names either file (R1, INV-003)
But with "spec/config.json" and "tests/SET-002.test.ts" uncommitted too, the problems about paths are, in order, "the implementer never changes spec files; revert spec/config.json" and "protected files may not change: revert tests/SET-002.test.ts" (INV-003)
And once "PROP-215" has left the build lane, its implementer's change to "tests/PRV-001.test.ts" is refused as in S5 (R1, INV-003)

## Rules
- R1: On a ticket whose pipeline has a tester stage (proposal, bug), the implementer changes no file under `testGlobs`, a build stage aside (PIP-021/R9), which writes the tests; on a task it may.
- R2: Only a proposal's stages change spec files: a spec-writer stage on a bug or a task is refused, and so is any spec change on a task by any role but the implementer, whose own rule already refuses it.
- R3: Files under the tickets folder are left out of every path rule.
- R4: The untracked paths recorded when the ticket's worktree was set up (WSP-001) are left out of every path rule, and out of the stubs the implementer must replace; a ticket with no record leaves nothing out.

## Out of scope
- Which code changes count as stubs (PIP-006)
- Edits refused while the stage runs: the harness's edit hook (install)
