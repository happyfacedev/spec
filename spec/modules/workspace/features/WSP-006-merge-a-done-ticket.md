---
id: WSP-006
title: Merge a done ticket when the merged result passes
module: workspace
status: active
provides: [workspace.Merge]
observes: [workspace.SetupFailed]
invariants: [INV-002]
decisions: [ADR-002]
retired: [S12, S13, S14, S15]
questions:
  - id: Q1
    kind: preference
    text: docs/WORKFLOW.md:107 says "You merge the finished branches ... If index.md conflicts, run spec build and commit it", while spec merge rebuilds a conflicted index.md itself (and docs/FORMAT.md:238 says so). Should WORKFLOW.md be updated to point at spec merge?
    default: spec merge rebuilds the generated files (current behaviour); the docs are behind
    cites: [WSP-006/S5]
    answer: 'Keep today''s behaviour; fix the docs or wording only (decided in review, 2026-10-29).'
    raised_by: null
  - id: Q2
    kind: preference
    text: Without spec/config.json, spec merge runs no tests on the merged result and merges on lint alone. Should a merge with no test command be refused instead?
    default: Merge on lint alone when there is no config (current behaviour)
    cites: [WSP-006/S3]
    answer: 'Changed in review (2026-10-29): a merge with no test command is refused before it is tried (WSP-007/R3, WSP-007/S17).'
    raised_by: null
  - id: Q3
    kind: preference
    text: After a successful merge, a ticket worktree with uncommitted changes is silently kept, and the output does not say so. Should merge report a worktree it could not remove?
    default: Keep it silently (current behaviour)
    cites: [WSP-006/S9]
    answer: 'Changed in review (2026-10-29): the ticket''s line says the worktree was kept, and why (R8, S9).'
    raised_by: null
---
## Intent
Land finished tickets with no person in the loop, but never land one that breaks the project: a done ticket's branch is merged into the base branch, and the merge is kept only when the merged result still lints clean and passes every test.

## Behaviour
### S1: A done ticket merges
Given "/work/app" has "main" checked out with nothing uncommitted
And ticket "TASK-101" titled "Extract provider selection into its own module" is done, and "ticket/TASK-101" is not merged into "main"
When "spec merge TASK-101" runs through workspace.Merge
Then "main" has a new merge commit, made without fast-forward, with message "Merge ticket/TASK-101: Extract provider selection into its own module"
And workspace.Worktree.branch "ticket/TASK-101" is merged into "main" because lint reports no errors and every test passes on the result (INV-002)
And stdout is "TASK-101: merged (<abbreviated HEAD>)" and the exit code is 0

### S2: Tests fail on the merged result
Given ticket "TASK-105" is done, and "ticket/TASK-105" breaks scenario "CNV-003/S1"
And "main" is at commit "a1b2c3d"
When "spec merge TASK-105" runs through workspace.Merge
Then merging "TASK-105" fails with workspace.MergedTestsFail
And stdout starts with "TASK-105: not merged, after merging ticket/TASK-105 tests fail (CNV-003/S1" and ends with "); ticket/TASK-105 stays unmerged"
And "main" is still at "a1b2c3d" and "git status --porcelain" prints nothing (INV-002, R1)
And the exit code is 1

### S3: The test detail when no test is named
Given format.Config.testCommand, run on the merged result, exits 1 and reports no failed test
When "spec merge TASK-105" runs through workspace.Merge
Then merging "TASK-105" fails with workspace.MergedTestsFail, and stdout is "TASK-105: not merged, after merging ticket/TASK-105 tests fail (exit 1); ticket/TASK-105 stays unmerged" (INV-002)

### S4: Lint errors on the merged result
Given ticket "TASK-106" is done, and the merged spec has a lint error
When "spec merge TASK-106" runs through workspace.Merge
Then merging "TASK-106" fails with workspace.MergedLintFails
And stdout is "TASK-106: not merged, after merging ticket/TASK-106 the spec has lint errors; ticket/TASK-106 stays unmerged"
And "main" is where it was before, with nothing uncommitted (INV-002, R1)

### S5: Only generated files conflict
Given a project has no format.Config.generated, and "main" and "ticket/TASK-103" both changed a hand-written file "plugin/notes.md"
When "spec merge TASK-103" runs through workspace.Merge
Then merging "TASK-103" fails with workspace.MergeConflict, because "plugin/notes.md" is not generated, and a person must merge it (R2)
And when format.Config.generated is {"globs": ["plugin/generated/**"]}, with no command, and both branches change "plugin/generated/app.js" and "spec/index.md", the merge takes the branch's side for "plugin/generated/app.js", rebuilds "spec/index.md" and "spec/_generated/" as "spec build" does, and commits the merge (R2, FMT-002/R8)
And stdout is "TASK-103: merged (<abbreviated HEAD>, generated files rebuilt)" and in the JSON form workspace.MergeResult.rebuilt is true (R4)
And an old config's `"generatedGlobs": ["plugin/generated/**"]` gives the same result (FMT-002/R9)
And when "src/generated/assets.ts", which format.Config.generated names with a format.GeneratedConfig.command, conflicts with "spec/index.md", the merge rebuilds it as WSP-009 says, and stdout is the same (R2)

### S6: The merged spec cannot be built
Given only "spec/index.md" conflicts, and the merged spec cannot be built
When "spec merge TASK-103" runs through workspace.Merge
Then merging "TASK-103" fails with workspace.MergedSpecDoesNotBuild, stdout starting "TASK-103: not merged, the merged spec does not build: "
And "main" is where it was before (INV-002, R1)

### S7: Any other conflict needs a person
Given "main" and "ticket/TASK-103" both changed "src/export.ts" and "spec/index.md" in conflicting ways
When "spec merge TASK-103" runs through workspace.Merge
Then merging "TASK-103" fails with workspace.MergeConflict
And stdout is "TASK-103: not merged, merging ticket/TASK-103 conflicts in src/export.ts; a person must merge it"
And "main" is where it was before, with no merge in progress (INV-002, R1)

### S8: The merged ticket's worktree is removed
Given ticket "TASK-101" has its worktree at "/work/app.worktrees/TASK-101" with nothing uncommitted
When "spec merge TASK-101" merges it through workspace.Merge
Then "/work/app.worktrees/TASK-101" no longer exists and "ticket/TASK-101" is kept

### S9: A worktree with uncommitted changes stays
Given ticket "TASK-101" has its worktree at "/work/app.worktrees/TASK-101" with an uncommitted file "notes.txt"
When "spec merge TASK-101" merges it through workspace.Merge
Then "/work/app.worktrees/TASK-101/notes.txt" still exists (R8)
And stdout is "TASK-101: merged (<abbreviated HEAD>), but its worktree was kept: /work/app.worktrees/TASK-101 has uncommitted changes: notes.txt" and the exit code is 0 (R8)
And in the JSON form workspace.MergeResult.worktreeKept is "/work/app.worktrees/TASK-101 has uncommitted changes: notes.txt" (R8)

### S10: Several tickets, in order
Given "TASK-101" and "TASK-103" are done, and "TASK-102" is blocked
When "spec merge TASK-101 TASK-102 TASK-103" runs through workspace.Merge
Then "TASK-101" merges, "TASK-102" is not merged, and "TASK-103" merges onto the result that includes "TASK-101" (R3)
And stdout is three lines, "TASK-101: merged (…)", "TASK-102: not merged, TASK-102 is blocked, not done" and "TASK-103: merged (…)"
And the exit code is 1, because one ticket was not merged

### S11: The JSON form
Given "TASK-101" is done and "TASK-102" is blocked
When "spec merge TASK-101 TASK-102 --format json" runs through workspace.Merge
Then stdout is a list of workspace.MergeResult: {"ok": true, "ticket": "TASK-101", "commit": "<abbreviated HEAD>", "rebuilt": false}, then {"ok": false, "ticket": "TASK-102", "error": "TASK-102 is blocked, not done"}

### S34: A legacy agent file is no longer treated as generated
Given "main" and "ticket/TASK-109" changed ".claude/agents/reviewer.md" in conflicting ways
When "spec merge TASK-109" runs through workspace.Merge
Then merging fails with workspace.MergeConflict because ".claude/agents/reviewer.md" is not a generated path, and a person must merge it
And stdout is "TASK-109: not merged, merging ticket/TASK-109 conflicts in .claude/agents/reviewer.md; a person must merge it" (R2)

### S16: A flaky test still refuses the merge
Given ticket "TASK-111" is done, and the test command fails "CNV-003/S1 Copy a message" on the merged result and passes it on the rerun
When "spec merge TASK-111" runs through workspace.Merge
Then merging "TASK-111" fails with workspace.MergedTestsFail
And stdout is "TASK-111: not merged, after merging ticket/TASK-111 tests fail (CNV-003/S1 Copy a message (flaky: failed, then passed on the rerun)); ticket/TASK-111 stays unmerged"
And "main" is where it was before (INV-002, R1, R5)

### S17: A test that fails again is not flaky
Given the test command fails "CNV-003/S1 Copy a message" on the merged result and fails it on the rerun
When "spec merge TASK-111" runs through workspace.Merge
Then stdout is "TASK-111: not merged, after merging ticket/TASK-111 tests fail (CNV-003/S1 Copy a message); ticket/TASK-111 stays unmerged" (R5)

### S18: afterMerge runs after a merge and its changes are committed
Given format.Config.afterMerge is "npm run build && cp dist/spec.cjs tools/spec.cjs", and it changes "tools/spec.cjs"
And ticket "TASK-112" is done
When "spec merge TASK-112" runs through workspace.Merge
Then format.Config.afterMerge ran once in "/work/app" on "main", after the merge commit (R6)
And "main" has one more commit after the merge, with message "TASK-112: after merge", holding "tools/spec.cjs"
And stdout is "TASK-112: merged (<abbreviated HEAD>)", with the abbreviated HEAD of that last commit, and the exit code is 0

### S19: afterMerge that changes nothing makes no commit
Given format.Config.afterMerge is set and leaves every file as it was
When "spec merge TASK-112" runs through workspace.Merge
Then the merge commit is the last commit on "main" and stdout is "TASK-112: merged (<abbreviated HEAD>)" (R6)

### S20: A failing afterMerge leaves the merge in place
Given format.Config.afterMerge prints "build a", "build b", "build c", "build d" and exits 1
And tickets "TASK-112" and "TASK-113" are done
When "spec merge TASK-112 TASK-113 --format json" runs through workspace.Merge
Then "ticket/TASK-112" stays merged into "main", reported with workspace.AfterMergeFails
And the first entry is {"ok": true, "ticket": "TASK-112", "commit": "<abbreviated HEAD>", "rebuilt": false, "afterMergeError": "afterMerge failed: build b | build c | build d"} (R6)
And "TASK-113" is still merged next, so the list holds two entries
And the exit code is 1

### S21: The text form of a failing afterMerge
Given format.Config.afterMerge exits 1 and its last output line is "build failed"
When "spec merge TASK-112" runs through workspace.Merge
Then stdout is "TASK-112: merged (<abbreviated HEAD>), but afterMerge failed: build failed" and the exit code is 1 (R6)

### S22: Without afterMerge nothing runs
Given format.Config.afterMerge is not set
When "spec merge TASK-112" runs through workspace.Merge
Then "main" gets only the merge commit and stdout is "TASK-112: merged (<abbreviated HEAD>)" (R6)

### S23: afterMerge does not run for a refused merge
Given format.Config.afterMerge is set, and "ticket/TASK-105" breaks scenario "CNV-003/S1"
When "spec merge TASK-105" runs through workspace.Merge
Then merging "TASK-105" fails with workspace.MergedTestsFail and format.Config.afterMerge did not run (R6)

### S24: The bundled CLI is the afterMerge command's to rebuild
Given the skill folder of "/work/app" holds a bundled CLI that the project's build writes, "ticket/TASK-108" changed the source under "src/", and "main" changed the source too
When "spec merge TASK-108" runs through workspace.Merge with no format.Config.afterMerge
Then the project's build does not run, the bundled CLI is as the merge left it, and stdout is "TASK-108: merged (<abbreviated HEAD>)" (R6)
But with format.Config.afterMerge "npm run build --silent", the bundled CLI is the build of the merged source, committed as "TASK-108: after merge" (R6)

### S25: Two merges at once: a refused one never undoes the other
Given "TASK-201" and "TASK-202" are done, and the tests fail on any result that holds "ticket/TASK-202"
When "spec merge TASK-201" and "spec merge TASK-202" run at the same time through workspace.Merge
Then "TASK-201" merges and "TASK-202" fails with workspace.MergedTestsFail, whichever ran first (R7)
And "main" holds "Merge ticket/TASK-201: …" and nothing from "ticket/TASK-202", with nothing uncommitted (INV-002)

### S26: A refused merge leaves a base branch that moved on
Given "TASK-203" is done, the tests fail on its merged result, and while they run something outside spec commits "someone else" on "main"
When "spec merge TASK-203" runs through workspace.Merge
Then it fails with workspace.MergedTestsFail, and stdout ends "; main moved to <abbreviated HEAD> during the merge, so spec left it as it is: undo the merge of ticket/TASK-203 by hand" (R7)
And the newest commit on "main" is still "someone else"

### S27: A refused merge keeps what was changed in the checkout meanwhile
Given "TASK-204" is done, the tests fail on its merged result, and while they run someone edits "src/state.ts", which the merge does not touch, in "/work/app"
When "spec merge TASK-204" runs through workspace.Merge
Then it fails with workspace.MergedTestsFail, "main" is back at the commit it had, and the edit to "src/state.ts" is still there, uncommitted (R1)

### S28: A refused merge that would overwrite a change leaves the base branch for a person
Given "TASK-205" is done and changed "src/conversation/export.ts", the tests fail on its merged result, and while they run someone edits "src/conversation/export.ts" in "/work/app"
When "spec merge TASK-205" runs through workspace.Merge
Then it fails with workspace.MergedTestsFail, and stdout is "TASK-205: not merged, after merging ticket/TASK-205 tests fail (…); spec could not move main back to <abbreviated commit> without overwriting uncommitted changes in src/conversation/export.ts, so it left main as it is: undo the merge of ticket/TASK-205 by hand" (R1, R7)
And the newest commit on "main" is "Merge ticket/TASK-205: …", and the edit is still there

### S29: A merge waits for an add of the same ticket before it removes the worktree
Given ticket "TASK-101" is done and has its worktree at "/work/app.worktrees/TASK-101" with nothing uncommitted, and its earlier setup failed
And "spec worktree add TASK-101" is running in "/work/app", holds "/work/app/.git/spec/worktree-TASK-101.lock", and its format.Config.worktreeSetup runs again and fails again
When "spec merge TASK-101" runs in "/work/app" through workspace.Merge while that add is running, and reaches the removal of the ticket's worktree
Then the merge holds "/work/app/.git/spec/merge.lock" and waits for "/work/app/.git/spec/worktree-TASK-101.lock", and removes nothing until the add has ended with workspace.SetupFailed and released it (R8)
And "/work/app.worktrees/TASK-101" no longer exists and "/work/app/.git/spec/setup/TASK-101.failed" does not exist once the merge ends (R8)
And stdout is "TASK-101: merged (<abbreviated HEAD>)" and the exit code is 0
And neither "/work/app/.git/spec/worktree-TASK-101.lock" nor "/work/app/.git/spec/merge.lock" exists once both have ended (R8)

### S30: An add that holds the ticket's lock too long
Given ticket "TASK-101" is done and has its worktree at "/work/app.worktrees/TASK-101" with nothing uncommitted
And "/work/app/.git/spec/worktree-TASK-101.lock" is held by a process, pid "4242", that keeps running for more than 15 minutes
When "spec merge TASK-101" runs in "/work/app" through workspace.Merge
Then "ticket/TASK-101" is merged into "main", and after waiting 15 minutes for the ticket's lock the merge reports workspace.WorktreeBusy on the ticket's line (R8)
And stdout is "TASK-101: merged (<abbreviated HEAD>), but its worktree was not removed: another spec worktree add for TASK-101 is still running (pid 4242)" and the exit code is 0
And "/work/app.worktrees/TASK-101" and the lock are left as they were, and "/work/app/.git/spec/merge.lock" does not exist once the merge ends (R8)

### S31: The JSON form of a worktree left behind a busy lock
Given "/work/app/.git/spec/worktree-TASK-101.lock" is held for more than 15 minutes by a running process, pid "4242", and ticket "TASK-101" is done
When "spec merge TASK-101 --format json" runs through workspace.Merge
Then stdout is a list of workspace.MergeResult holding {"ok": true, "ticket": "TASK-101", "commit": "<abbreviated HEAD>", "rebuilt": false, "worktreeBusy": "another spec worktree add for TASK-101 is still running (pid 4242)"} (R8)
And the exit code is 0

### S32: A ticket lock left by a process that has ended
Given "/work/app/.git/spec/worktree-TASK-101.lock" names a process that has ended
And ticket "TASK-101" is done and has its worktree at "/work/app.worktrees/TASK-101" with nothing uncommitted
When "spec merge TASK-101" runs in "/work/app" through workspace.Merge
Then the merge takes the ticket's lock over without waiting, and "/work/app.worktrees/TASK-101" no longer exists (R8)
And stdout is "TASK-101: merged (<abbreviated HEAD>)" and the exit code is 0
And "/work/app/.git/spec/worktree-TASK-101.lock" does not exist once the merge ends (R8)

### S33: A conflict in the pinned CLI is generated
Given "ticket/TASK-103" and "main" change `.spec/bin/spec.cjs` to different bundle contents
When "spec merge TASK-103" runs through workspace.Merge
Then `.spec/bin/spec.cjs` is treated as generated, the branch copy is kept, and stdout includes "generated files rebuilt" (R2)

## Rules
- R1: A refused merge is undone completely: any merge in progress is aborted and the base branch is moved back to the commit it had before, so it holds nothing from the ticket. The move keeps uncommitted changes (`git reset --keep`): an edit made in the checkout while the tests ran survives, and when keeping it would mean overwriting it, the base branch is left as it is and the refusal names the files and says to undo the merge by hand (ADR-002)
- R2: Conflicts in `index.md` and under `_generated/` of the spec root, in the project-pinned `.spec/bin/` CLI, in the legacy skill bundle, and in the project's own generated files that format.Config.generated names (an old config's `generatedGlobs` among them, FMT-002/R9) are never merged by hand: the merge takes the branch's side, rebuilds the spec index and graph, rebuilds the project's own when format.GeneratedConfig.command is set, as WSP-009 says, and leaves other generated paths as the branch's copy
- R3: Tickets merge one at a time in the order given, each against the result of the merges before it, and a refusal does not stop the next ticket
- R4: Before lint and the tests run, a generated-file conflict rebuilds the spec's index and graph from the merged source. The project-pinned CLI and generated files without a format.GeneratedConfig.command are not rebuilt by spec; format.Config.afterMerge can rebuild them after the merge
- R7: One merge runs at a time in a repository, under a lock in its git directory; a merge waits for the one before, then reads the base branch again, and a lock whose process has ended is taken over atomically, as PIP-002/R7 says. A refused merge moves the base branch back only while it still stands where this merge left it, at the merge commit or, before that commit, at the commit it started from; otherwise the base branch is left as it is, and the refusal says where it moved and that the merge must be undone by hand. A refusal that leaves the base branch holding the merge drops its "<branch> stays unmerged"
- R5: When tests fail on the merged result, the test command is run once more; a test that passes on the rerun is reported as flaky with both results, and the merge is refused all the same

- R6: When format.Config.afterMerge is set, it runs once after each successful merge, in the project root on the base branch, and never for a refused merge. If it changed files, they are committed as `<ID>: after merge`; the ticket stays merged whether it succeeds or fails. A failure is reported on the ticket's line (`, but afterMerge failed: <detail>`) and makes the exit code 1. Without it nothing changes
- R8: After a successful merge, and before format.Config.afterMerge runs, the merge holds the ticket's lock, "spec/worktree-<ID>.lock" in the repository's common git directory, the one `spec worktree add` and `spec worktree remove` hold (WSP-001/R6, WSP-002/R2), from before it looks for the ticket's worktree until it has removed the tree and the ticket's "spec/setup/<ID>.failed" file; git keeps a tree with uncommitted changes, and then the ".failed" file stays too, and the ticket's line ends ", but its worktree was kept: <path> has uncommitted changes: <paths>", the first five changed or untracked paths of the tree in sorted order joined by ", ", or ", but its worktree was kept: git could not remove <path>: <git's message>" when git refuses for another reason; the ticket stays merged, with exit code 0 unless something else failed. It takes the ticket's lock only while it already holds the merge lock, and releases it first; add and remove never take the merge lock, so the two locks cannot deadlock. It waits up to 15 minutes for an add or a remove of the same ticket that holds the lock; then the ticket stays merged, its worktree and setup state are left as they were, and its line ends ", but its worktree was not removed: another spec worktree add for <ID> is still running (pid <pid>)", the message an add that waits too long prints, with exit code 0 unless something else failed. A lock whose process has ended is taken over atomically, as PIP-002/R7 says

## Out of scope
- What refuses a merge before it is tried (WSP-007)
- Deleting the ticket's branch after it merges
