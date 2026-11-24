---
id: PIP-016
title: Give the reviewer the branch's diff
module: pipeline
status: active
---
## Intent
The reviewer judges the ticket's work as a whole, so its brief carries the branch's diff against the base branch, limited to the files a stage may change as code or tests. A diff that cannot be made is reported inside the brief, never as a failure.

## Behaviour
### S1: The diff against the base, on code and test files
Given the config's `codeGlobs` is ["src/**"], `testGlobs` is ["tests/**"] and `baseBranch` is "main"
And "ticket/TASK-101" committed "src/providers/select.ts" holding "export const select = 1;" and "NOTES.md"
When `spec brief reviewer TASK-101` runs through pipeline.Brief on that branch
Then "## Diff" starts "`git diff main...HEAD` on src/**, tests/**" and holds a "diff" fence with the line "+export const select = 1;"
And the brief does not mention "NOTES.md" (R1)

### S2: Another base
Given the branch of S1 and a branch "release"
When `spec brief reviewer TASK-101 --base release` runs through pipeline.Brief
Then "## Diff" starts "`git diff release...HEAD` on src/**, tests/**" (R1)

### S3: A base that does not exist
Given no branch "no-such-branch"
When `spec brief reviewer TASK-101 --base no-such-branch` runs through pipeline.Brief
Then "## Diff" is "`git diff no-such-branch...HEAD` on src/**, tests/**: unavailable (<first line of git's error>)" and the exit code is 0 (R2)

### S4: Nothing changed
Given the branch has no commit touching code or test files
When `spec brief reviewer TASK-101` runs through pipeline.Brief
Then "## Diff" is "`git diff main...HEAD` on src/**, tests/**: no changes"

### S5: Not a repository
Given the project is not a git repository
When `spec brief reviewer TASK-101` runs through pipeline.Brief
Then "## Diff" ends ": unavailable (not a git repository)" (R2)

### S6: Only the reviewer gets a diff
Given the branch of S1
When pipeline.Brief runs for the implementer, the tester or the spec-writer
Then the brief has no "## Diff" group

## Rules
- R1: The diff is `git diff <base>...HEAD` limited to `codeGlobs` and `testGlobs`; the base is `--base`, else the config's `baseBranch`, else "main".
- R2: A diff git cannot make is shown as unavailable, with git's first error line, and the brief still exits 0.

## Out of scope
- Uncommitted changes: a stage is reviewed after the earlier stages were committed
