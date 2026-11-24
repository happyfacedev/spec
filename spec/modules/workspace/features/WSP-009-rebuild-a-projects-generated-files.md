---
id: WSP-009
title: Rebuild a project's own generated files when they conflict
module: workspace
status: active
invariants: [INV-002]
---
## Intent
A project may build some of its files from others, for example a source file generated from templates by its build. Two tickets that change the templates then conflict in that file, although nothing there needs a person. When the project names those files in `spec/config.json`, `spec merge` and the sync at a stage's start take one side of such a conflict; when it also names the command that builds them, they run it, so the files are built from the merged source before lint and the tests see them. A blocked stage's stash leaves those files out for the same reason: while the ticket waits, the sync rebuilds them on the branch, so a stashed copy could only conflict. The stage gets its other work back, new files included, and the command rebuilds the generated files from it. The project's pinned CLI under `.spec/bin/`, which a merge already treats as generated, is left out of the stash the same way, whether or not the project names any generated files.

## Behaviour
### S1: A merge rebuilds the project's generated files that conflict
Given format.Config.generated is {"globs": ["src/generated/**"], "command": "npm run build --silent"}, which writes "src/generated/assets.ts" from "templates/"
And "main" and "ticket/TASK-113" both changed "templates/reviewer.md" and "src/generated/assets.ts", and only "src/generated/assets.ts" conflicts
When "spec merge TASK-113" runs through workspace.Merge
Then format.GeneratedConfig.command ran once, before the tests, and the merge commit holds the "src/generated/assets.ts" it wrote from the merged "templates/" (R1, R2)
And stdout is "TASK-113: merged (<abbreviated HEAD>, generated files rebuilt)" and the exit code is 0
But without format.Config.generated, merging "TASK-113" fails with workspace.MergeConflict, stdout "TASK-113: not merged, merging ticket/TASK-113 conflicts in src/generated/assets.ts; a person must merge it" (R1)

### S2: A merge whose generated files do not rebuild
Given format.Config.generated names "src/generated/**", only "src/generated/assets.ts" conflicts, and format.GeneratedConfig.command prints "build a", "build b", "build c", "build d" and exits 1
When "spec merge TASK-113" runs through workspace.Merge
Then merging "TASK-113" fails with workspace.GeneratedRebuildFails, stdout "TASK-113: not merged, the generated files do not rebuild: build b | build c | build d" (R3)
And "main" is where it was before, with no merge in progress, and the tests did not run (INV-002)

### S3: The sync at a stage's start rebuilds them too
Given format.Config.generated is {"globs": ["src/generated/**"], "command": "npm run build --silent"}, and "ticket/TASK-101" and "main" both changed "templates/reviewer.md" and "src/generated/assets.ts", and only "src/generated/assets.ts" conflicts
When the developer runs `spec ticket start TASK-101 implementer` through pipeline.StartStage
Then the exit code is 0, and the commit "TASK-101: sync with main" holds the "src/generated/assets.ts" format.GeneratedConfig.command wrote from the merged "templates/" (R1, R2)
And only the ticket file is uncommitted
But when format.GeneratedConfig.command exits 1 with last line "build failed", it fails with pipeline.StageRefused and stderr "syncing ticket/TASK-101 with main: the generated files do not rebuild: build failed", "ticket/TASK-101" is at the commit it had, no merge is in progress, and the ticket is as it was (R3)

### S4: Without a command, a conflict takes one side and nothing is rebuilt
Given format.Config.generated is {"globs": ["src/generated/**"]}, with no format.GeneratedConfig.command
And "main" and "ticket/TASK-113" both changed "templates/reviewer.md" and "src/generated/assets.ts", and only "src/generated/assets.ts" conflicts
When "spec merge TASK-113" runs through workspace.Merge
Then the merge commit holds the "src/generated/assets.ts" of "ticket/TASK-113", and no command ran (R1, R2)
And stdout is "TASK-113: merged (<abbreviated HEAD>, generated files rebuilt)" and the exit code is 0
And the same holds when config.json instead holds `"generatedGlobs": ["src/generated/**"]` and no `generated` (R4)
But when format.Config.generated is {"globs": ["src/generated/**"], "command": "npm run build --silent"} and `generatedGlobs` is ["plugin/generated/**"], and only "plugin/generated/app.js" conflicts, the merge keeps the "plugin/generated/app.js" of "ticket/TASK-113" and format.GeneratedConfig.command does not run (R4)

### S5: A blocked stage's stash comes back without its generated files
Given format.Config.generated is {"globs": ["gen/**"], "command": "sh build.sh"}, which writes "gen/bundle.js" from "templates/"
And "TASK-101" is in its "implementer" stage, and "src/app.ts", "templates/a.txt" and "gen/bundle.js" are changed and "src/extra.ts" is new, all uncommitted
When its blocked report is recorded through pipeline.AdvanceTicket
Then stdout's last line is "stash: TASK-101 implementer: blocked", and that stash holds "src/app.ts", "templates/a.txt" and the new "src/extra.ts", but not "gen/bundle.js" (R5)
And nothing is left uncommitted outside the tickets folder, "gen/bundle.js" included (R5)
And when "main" then changes "templates/b.txt" and "gen/bundle.js", and `spec ticket start TASK-101 implementer` runs through pipeline.StartStage once the question is answered, the exit code is 0 and the stash is dropped (R6)
And "src/app.ts", "templates/a.txt" and "src/extra.ts" are uncommitted as they were stashed, and "gen/bundle.js" is what format.GeneratedConfig.command wrote from them and the synced "templates/b.txt" (R6)
But without format.GeneratedConfig.command, "gen/bundle.js" is as "ticket/TASK-101" has it after the sync, and nothing runs (R6)

### S6: A restore whose generated files do not rebuild, and a stash made before
Given format.Config.generated is {"globs": ["gen/**"], "command": "sh build.sh"}, and "git stash list" holds "TASK-101 implementer: blocked" with "src/app.ts" and the new "src/extra.ts"
When format.GeneratedConfig.command exits 1 with last line "build failed" after the stash is applied by `spec ticket start TASK-101 implementer` through pipeline.StartStage
Then the exit code is 0, and stderr is "TASK-101: the generated files do not rebuild after the stash: build failed; they are as ticket/TASK-101 has them" (R6)
And "src/app.ts" and "src/extra.ts" are uncommitted as they were stashed, "gen/bundle.js" is as "ticket/TASK-101" has it, and the stash is dropped (R6)
But when the stash was made by an earlier version and also holds "gen/bundle.js", which "ticket/TASK-101" has since changed, the start does not conflict: "gen/bundle.js" is rebuilt as S5 shows, and the other files come back (R6)

### S7: A blocked stage's stash leaves out the pinned CLI
Given format.Config.generated is not set, and ".spec/bin/spec.cjs" is tracked
And "TASK-101" is in its "implementer" stage, and "src/app.ts" and ".spec/bin/spec.cjs" are changed, all uncommitted
When its blocked report is recorded through pipeline.AdvanceTicket
Then that stash holds "src/app.ts" but not ".spec/bin/spec.cjs", and nothing is left uncommitted outside the tickets folder, ".spec/bin/spec.cjs" included (R5)
And when "main" then changes ".spec/bin/spec.cjs", and `spec ticket start TASK-101 implementer` runs through pipeline.StartStage once the question is answered, the exit code is 0, the stash is dropped, "src/app.ts" is uncommitted as it was stashed, and ".spec/bin/spec.cjs" is as "ticket/TASK-101" has it after the sync (R6)
But when the stash was made by an earlier version and also holds ".spec/bin/spec.cjs", which "main" has since changed, the start does not conflict: ".spec/bin/spec.cjs" is as "ticket/TASK-101" has it, and "src/app.ts" comes back (R6)

## Rules
- R1: A file that format.GeneratedConfig.globs matches is generated, as the spec's own generated files are (WSP-006/R2, PIP-002/R6), whether or not format.GeneratedConfig.command is set: a conflict in it takes the side being merged in, the ticket's branch in a merge and the base branch in a sync, and never needs a person. Without format.Config.generated such a conflict needs a person, as any other does
- R2: When such a file conflicted and format.GeneratedConfig.command is set, the command runs once in the project root, after the spec's own files are rebuilt and before lint and the tests, and the merge commit or the sync commit holds what it wrote to the files the globs match. When none of them conflicted, or no command is set, nothing runs and the side taken stands
- R3: A command that exits non-zero undoes the merge or the sync: a merge is refused with workspace.GeneratedRebuildFails, and a start with pipeline.StageRefused, "syncing ticket/<ID> with <base>: the generated files do not rebuild: <its last three lines of output, joined by " | ">", leaving the branch and the ticket as they were
- R4: An old config's `generatedGlobs` is read as more format.GeneratedConfig.globs without a command (FMT-002/R9): a conflict in its paths takes one side as R1 says, and the command runs only when a file the `generated` globs match conflicted
- R5: When a blocked stage's changes are stashed (PIP-008/R9), the stash leaves out every file a generated glob matches, an old `generatedGlobs` among them, and every file under `.spec/bin/`, tracked or new, and those files are put back as the branch's HEAD has them, so nothing is left uncommitted. The stash keeps everything else, new files included
- R6: When the stage's stash is applied at its next start (PIP-002/R4), a file in it that a generated glob matches or that is under `.spec/bin/`, in a stash made by an earlier version, is put back as the branch has it and never conflicts. Then, when format.GeneratedConfig.command is set, it runs once in the project root, and its output stays uncommitted with the rest of the stage's work. A command that exits non-zero refuses nothing: the generated files are put back as the branch has them, the restored files stay, the stash is dropped, the start succeeds, and stderr is "<ID>: the generated files do not rebuild after the stash: <its last three lines of output, joined by " | ">; they are as ticket/<ID> has them". When no stash was applied, or no command is set, nothing runs

## Out of scope
- Which other conflicts need a person, and how a refused merge is undone (WSP-006)
- When the sync runs and how a sync conflict blocks a ticket (PIP-002)
- When a stage is stashed and restored, and how a stash that does not apply blocks the ticket (PIP-008, PIP-002)
