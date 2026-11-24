---
id: FMT-002
title: Configure the project in spec/config.json
module: format
status: active
retired: [S2, S3, S4, S5, S6, S7, S8, S9, S10, S15, R2, R6]
---
## Intent
One JSON file tells the CLI the spec's format version, how to run the project's tests, which files each role may change, where tickets live and which branch work lands on. Every key but the test command has a default, so a new project needs only two lines.

## Behaviour
### S1: Defaults for every key but the test command
Given config.json is `{ "formatVersion": 2, "testCommand": "npm test" }`
When the CLI reads it
Then format.Config.tickets is the "files" store in "tickets" (R1)
And format.Config.baseBranch is "main"
And format.Config.codeGlobs, format.Config.testGlobs and format.Config.protectedGlobs are empty
And format.Config.generated is not set, and no file of the project is generated beyond spec's own
And format.Config.enforce is { edits: true, commits: true, history: true }
And format.Config.budgets is empty

### S11: Format 2 is read
Given format.Config.formatVersion is 2 and format.Config.testCommand is set
When `spec lint` runs on an otherwise clean spec
Then it prints "lint clean" (R3)

### S12: The project root defaults to the spec root's parent
Given the spec root is "repo/spec" and config.json has no format.Config.projectRoot
And the ticket "TASK-001" is in "repo/tickets/TASK-001.md"
When `spec show "TASK-001"` runs
Then the first output line is "tickets/TASK-001.md:1" (R4)

### S13: A configured project root
Given the spec root is "repo/spec" and format.Config.projectRoot is "../app"
And the ticket "TASK-001" is in "repo/app/tickets/TASK-001.md"
When `spec show "TASK-001"` runs
Then the first output line is "tickets/TASK-001.md:1" (R4)

### S14: maxParallel is optional and a whole number of 1 or more
Given config.json is `{ "formatVersion": 2, "testCommand": "npm test" }`
When the CLI reads it
Then format.Config.maxParallel is not set, which means no cap (R1)
And when config.json also holds `"maxParallel": 2`, `spec lint` on an otherwise clean spec prints "lint clean"
And when it holds `"maxParallel": 0`, `spec lint` reports a finding on format.Config.maxParallel (R5)

### S16: afterMerge is optional and a shell command
Given config.json is `{ "formatVersion": 2, "testCommand": "npm test" }`
When the CLI reads it
Then format.Config.afterMerge is not set (R1)
And when config.json also holds `"afterMerge": "npm run build"` with an empty `generatedGlobs` and no `generated`, `spec lint` reports warning "L034" as described in LNT-003/S27
And when `generatedGlobs` is non-empty or `generated` is set, that configuration warning is absent
And when it holds `"afterMerge": 5`, `spec lint` reports a finding on format.Config.afterMerge (R7)

### S17: generated is optional, needs globs, and its command is optional
Given config.json is `{ "formatVersion": 2, "testCommand": "npm test" }`
When the CLI reads it
Then format.Config.generated is not set (R1)
And when config.json also holds `"generated": { "globs": ["src/generated/**"], "command": "npm run build --silent" }`, `spec lint` on an otherwise clean spec prints "lint clean"
And when it holds `"generated": { "globs": ["src/generated/**"] }`, with no format.GeneratedConfig.command, `spec lint` on an otherwise clean spec prints "lint clean" (R8)
And when "generated" holds an empty format.GeneratedConfig.globs, a glob "../outside/**", or an empty format.GeneratedConfig.command, `spec lint` reports an error "L001" on that member and exits 1 (R8)

### S19: generatedGlobs is read as generated without a command
Given config.json holds `"generatedGlobs": ["plugin/generated/**"]` and no `generated`
When the user runs `spec lint` on an otherwise clean spec
Then it reports one warning "L036" at "config.json" with message "generatedGlobs is replaced by generated; it is read as generated.globs without a command" and fix "move its globs into generated.globs and remove generatedGlobs", and exits 0 (R9)
And a conflict under "plugin/generated/" in `spec merge` is handled as `"generated": { "globs": ["plugin/generated/**"] }` would handle it, as WSP-009/S4 shows (R9)
And when it holds `["../outside/**"]`, `spec lint` reports an error "L001" on `generatedGlobs` (R9)

### S22: Every generated path counts as generated for enforcement
Given a ticket "TASK-112" merged by `spec merge` and followed by its commit "TASK-112: after merge", which changes only "plugin/generated/app.js"
When `spec verify-history` checks that commit
Then it accepts it when config.json names "plugin/generated/**" in format.GeneratedConfig.globs, with or without format.GeneratedConfig.command, or in `generatedGlobs` (R12, INS-015/S26)
But when config.json names it under neither key, it lists that commit, naming "plugin/generated/app.js" as a path that is not generated, and exits 1 (R12)

### S21: Enforcement switches and a history baseline are optional
Given config.json omits `enforce` and `enforceSince`
When the CLI reads format.Config
Then format.EnforceConfig.edits, format.EnforceConfig.commits and format.EnforceConfig.history are true
And format.Config.enforce.bypass is not set
And format.Config.enforceSince is not set
And setting any enforcement layer to false is accepted
And setting `enforce.bypass` to `person` is accepted
And any other bypass policy is rejected (R11)

### S20: Legacy dispatch keys are accepted but warned about
Given config.json also holds `"dispatchCommand": "claude -p {ticket}"` and `"models": { "small": "sonnet", "large": "opus", "threshold": 4 }`
When the user runs `spec lint`
Then it reports a warning "L028" for `dispatchCommand` at "config.json" with message "dispatchCommand is ignored since X139; the session drives stages with spec next"
And it reports a warning "L028" for `models` at "config.json" with message "models is ignored since X139; the session drives stages with spec next"
And the command exits 0 (R10)

## Rules
- R8: generated, when set, holds at least one glob in format.GeneratedConfig.globs, each a non-empty project-relative POSIX glob without an absolute path, a backslash, or a `.` or `..` path segment, and may hold a non-empty shell command in format.GeneratedConfig.command; without the command a conflict in a generated file takes one side and nothing is rebuilt (WSP-009/R1)
- R9: generatedGlobs remains accepted for old config files, its globs of the R8 form; it is read as more format.GeneratedConfig.globs without a command, so a conflict only in its paths takes one side and runs no command, even when format.Config.generated sets one. Lint reports one L036 warning while it is set, telling the user to move its globs into generated.globs
- R12: Every path that format.GeneratedConfig.globs or `generatedGlobs` matches is generated, with or without a command, wherever spec tells generated paths from others: merge and sync conflicts (WSP-006/R2, WSP-009/R1) and history enforcement, which accepts an afterMerge commit only when it changes generated paths alone (INS-015/S26, INS-016/R5)
- R11: enforce may contain edits, commits and history booleans (each defaulting to true) and optional bypass: person; enforceSince, when set, is a non-empty git ref
- R7: afterMerge, when set, is a string: a shell command
- R1: testCommand is the only required key; the rest default as the config contract states.
- R3: This CLI reads format 2.
- R4: Paths in config.json are relative to the project root: projectRoot resolved against the spec root; else, for a spec root at .claude/skills/<name>/, the folder holding .claude; else the spec root's parent.
- R5: maxParallel, when set, is a whole number of 1 or more
- R10: dispatchCommand and models remain accepted as legacy config keys, are ignored since X139, and produce an L028 warning that the session drives stages with spec next

## Out of scope
- The findings for a config.json that is missing, invalid, of another format version, or holds a key or value its contract does not allow: LNT-004
- What each role may change under the globs: pipeline
- How a ticket store is read and written: tickets
- The --tickets option and SPEC_ROOT: cli
- Running the test command: pipeline
