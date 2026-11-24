# cli contracts

### cli.Run
Kind: operation · Status: active
Runs one `spec` command line: reads the global options, finds the spec root, hands the rest to the command, and answers the shell.
Output: cli.CommandResult

#### cli.Run.args
The words after `spec`, as the shell passed them. Options may come before or after the command. Type: string[]

#### cli.Run.cwd
The folder the command runs in; a relative `--root`, `SPEC_ROOT` or `--tickets` is resolved against it, and the root fallback search starts here when `CLAUDE_PROJECT_DIR` is unset. Type: string

#### cli.Run.SPEC_ROOT
The `SPEC_ROOT` environment variable. Unset and empty mean the same. Type: string?

#### cli.Run.launcher
The path the CLI was started from, as the shell gave it. Root resolution follows its symlinks to the real file; an older skill pointer and the `.spec/bin/spec` project layout can name the root. Type: string?

#### cli.Run.CLAUDE_PROJECT_DIR
The `CLAUDE_PROJECT_DIR` environment variable; when set it is the start of the fallback search for the nearest `spec/config.json`. Type: string?

### cli.CommandResult
Kind: entity · Status: active
What one `spec` invocation gives back to the shell.

#### cli.CommandResult.stdout
Text printed on standard output: plain text, or one JSON document with `--format json`. Type: string

#### cli.CommandResult.stderr
Text printed on standard error: usage and failure messages. Type: string

#### cli.CommandResult.exitCode
The process exit code: 0 on success, 1 when the command ran and found a failure, 2 when the command line was wrong or the tool itself failed. Hook commands with no resolvable root are silent and exit 0. Type: 0 | 1 | 2

### cli.Next
Kind: entity · Status: active
One `spec next` result: the action, and for delegation, the role's task and its execution context.

#### cli.Next.ticket
The ticket this result is about. Type: string

#### cli.Next.action
What the main session can do next. Type: "delegate" | "merge" | "waiting" | "done" | "error"

#### cli.Next.role
The stage role to delegate. Type: format.StageRole?

#### cli.Next.worktree
The absolute ticket worktree, created when starting or planned when listing. Type: string?

#### cli.Next.branch
The ticket branch. Type: string?

#### cli.Next.model
The selected harness model, or null when no model is configured. For the spec review, the harness's reviewer model when it has no spec-review model (PIP-017/R8). Type: (string | null)?

#### cli.Next.effort
The selected model's reasoning effort, or null when its entry sets none, no model is selected, or Claude Code is not known to take one (CLI-007/R19). Type: (format.Effort | null)?

#### cli.Next.skipped
The entries of the role's list before the selected one, in order, with why each was skipped. Empty when there are none. Type: cli.SkippedModel[]?

#### cli.Next.missingModels
Stage roles with no model configured for the active harness. Empty when no active harness is known. Never "spec-review", whose model falls back to the reviewer's (PIP-017/R8). Type: format.StageRole[]?

#### cli.Next.advance
The project-root-relative command for the main session to record the delegated stage after receiving its final report, with `--report-file` and the absolute path the report is to be written to: a file directly inside the ticket worktree parent, named for the ticket and the role (PIP-017/R4). The CLI records the report into the ticket worktree; the command is separate from the task. Type: string?

#### cli.Next.advanceRelative
Status: removed · Superseded by: cli.Next.advance
The separate worktree-relative report command, removed after permission verification. Type: string?

#### cli.Next.cwd
Status: removed · Superseded by: cli.Next.advance
The worktree cwd field, removed because the main session runs the relative advance command from the project root. Type: string?

#### cli.Next.task
The self-contained task for the generic subagent. It does not include the main session's advance command. Type: string?

#### cli.Next.questions
Open questions for a person, with their question IDs. Type: cli.NextQuestion[]?

#### cli.Next.blockers
Other gate or start blockers. Type: cli.NextBlocker[]?

### cli.SkippedModel
Kind: type · Status: active
A model list entry that was not selected.

#### cli.SkippedModel.model
Its model. Type: string

#### cli.SkippedModel.reason
"not a supported model" for an entry lint warns of with L032; "marked unavailable" for one in format.LocalConfig.unavailableModels. Type: "not a supported model" | "marked unavailable"

### cli.RoleModel
Kind: type · Status: active
What a stage role would start with now.

#### cli.RoleModel.role
The role. Type: format.StageRole

#### cli.RoleModel.model
Its selected model, or null when none is usable. Type: string | null

#### cli.RoleModel.effort
Its effort, or null. Type: format.Effort | null

#### cli.RoleModel.skipped
The entries skipped before it, or all of them when none is usable. Type: cli.SkippedModel[]

### cli.NextSummary
Kind: type · Status: active
The compact listing of safe work from `spec next --summary`; it omits the task and brief.

#### cli.NextSummary.ticket
The ticket to start. Type: string

#### cli.NextSummary.action
The action the main session can take; "waiting" when every model of the stage's role is marked unavailable (CLI-007/R18). Type: "delegate" | "waiting"

#### cli.NextSummary.role
The role to delegate. Type: format.StageRole?

#### cli.NextSummary.worktree
The planned or started worktree path. Type: string?

#### cli.NextSummary.model
The model selected for the stage, or null when none is configured. Type: string | null

### cli.NextQuestion
Kind: type · Status: active
One open question blocking a next-stage result.

#### cli.NextQuestion.id
Its question ID. Type: string

#### cli.NextQuestion.text
The question text. Type: string

### cli.NextBlocker
Kind: type · Status: active
One blocker returned when a ticket cannot start.

#### cli.NextBlocker.kind
The gate blocker kind. Type: string?

#### cli.NextBlocker.id
The gate blocker ID. Type: string?

#### cli.NextBlocker.text
Why the ticket cannot start. Type: string

### cli.Options
Kind: type · Status: active
The options every command accepts, before or after the command name. A value is given as `--root dir` or `--root=dir`; when an option is given twice, the last one wins.

#### cli.Options.root
`--root <dir>`: the spec root. Type: string?

#### cli.Options.tickets
`--tickets <dir>`: a folder of ticket files to use instead of the store `config.json` names. Type: string?

#### cli.Options.format
`--format text|json`: the output format, `text` when left out. Type: cli.Format?

#### cli.Options.version
`--version` or `-v`: print the version and do nothing else. Type: bool

#### cli.Options.help
`--help` or `-h`: print the usage and do nothing else. Type: bool

### cli.Format
Kind: type · Status: active
How a command prints its result. Type: "text" | "json"

### cli.SkillPointer
Kind: type · Status: active
`skill.json` in the skill folder that holds `scripts/spec`: where that installation's spec root is.

#### cli.SkillPointer.specRoot
The spec root, relative to the project when the skill folder is `<project>/.claude/skills/<name>`, and relative to the skill folder's parent otherwise. An empty or missing value is ignored. Type: string

### cli.UnknownCommand
Kind: error · Status: active
The first word that is not an option names no command.

#### cli.UnknownCommand.command
The word as given. Type: string

### cli.UnknownOption
Kind: error · Status: active
A word starting with `--` names no option.

#### cli.UnknownOption.option
The word as given. Type: string

### cli.MissingValue
Kind: error · Status: active
An option that takes a value was given none: it is last, or the next word starts with `--`.

#### cli.MissingValue.option
The option, such as `--root`. Type: string

### cli.InvalidFormat
Kind: error · Status: active
`--format` was given a value other than `text` or `json`.

#### cli.InvalidFormat.value
The value as given. Type: string

### cli.InvalidDepth
Kind: error · Status: active
`--depth` was given to `impact` with a value that is not a whole number of 1 or more.

#### cli.InvalidDepth.value
The value as given. Type: string

### cli.UsageError
Kind: error · Status: active
A command was given a wrong command line: an argument missing or one too many, a subcommand it does not have, or an option it needs left out. Every command reports it the same way: stderr is the message, a blank line and the usage text; stdout is empty; the exit code is 2.

#### cli.UsageError.message
The first line on stderr: the command's own usage line, such as `usage: spec gate <TICKET>`, or what is missing from the line. Type: string

### cli.NoSpecRoot
Kind: error · Status: active
No `--root`, `SPEC_ROOT`, launcher root or nearest `spec/config.json` is found.

### cli.SpecRootMissing
Kind: error · Status: active
The spec root that was found does not exist on disk.

#### cli.SpecRootMissing.root
The root, as an absolute path. Type: string

### cli.InvalidSkillPointer
Kind: error · Status: active
The old skill.json that root resolution reads is not valid JSON. Non-hook commands report it as a wrong command line with the usage text and exit 2. `spec hook` treats it as no resolvable root and exits 0 with no output (INS-007).

#### cli.InvalidSkillPointer.file
The `skill.json`, as an absolute path. Type: string

### cli.InternalError
Kind: error · Status: active
A failure inside the tool itself rather than in the user's input.

#### cli.InternalError.detail
The error and its stack trace. Type: string

### cli.Detection
Kind: entity · Status: active
The current repository's setup state, git state, detected stacks and harness.

#### cli.Detection.state
Whether the current directory is an empty project, code without a spec, a current spec, or a legacy spec. Type: "empty" | "code" | "spec" | "legacy-spec"

#### cli.Detection.dirty
Whether the current Git worktree has uncommitted changes, including untracked files. Type: bool

#### cli.Detection.git
Whether the current directory is inside a Git repository. Type: bool

#### cli.Detection.baseBranch
The default Git branch when one can be determined. Type: string?

#### cli.Detection.stacks
Detected project stacks and their test/report defaults. Type: cli.DetectedStack[]

#### cli.Detection.harness
The current supported delegation harness, or null when none is known. Type: "claude-code" | "astro" | null

#### cli.Detection.missingModels
Stage roles without a model for the active harness, or an empty list when no active harness is known. Type: format.StageRole[]

#### cli.Detection.models
One entry per stage role, in the order of format.StageRole, under the active harness; empty when no active harness is known. Type: cli.RoleModel[]

#### cli.Detection.editMode
The project's Claude Code permission mode: `permissions.defaultMode` from `.claude/settings.local.json` in the current directory, else from `.claude/settings.json`, else "default". It is reported whatever the harness and whether or not a spec exists. Type: string

### cli.DetectedStack
Kind: type · Status: active
A detected stack and the commands and paths its tickets use.

#### cli.DetectedStack.name
The stack family. Type: "flutter" | "dart" | "node" | "python" | "go" | "rust" | "other"

#### cli.DetectedStack.manifest
The manifest path relative to the repository root. Type: string

#### cli.DetectedStack.testCommand
The command that writes the test report expected by spec. Type: string

#### cli.DetectedStack.codeGlobs
Project-relative source paths. Type: string[]

#### cli.DetectedStack.testGlobs
Project-relative test paths. Type: string[]

#### cli.DetectedStack.worktreeSetup
The command that prepares dependencies in a ticket worktree, when required. Type: string?

### cli.Detect
Kind: operation · Status: active
Inspects the current repository without requiring an installed spec. Output: cli.Detection

#### cli.Detect.env
The session environment used to identify Astro or Claude Code. Type: map<string, string>

### cli.ConfigSet
Kind: operation · Status: active
Sets one supported project configuration value while preserving unrelated JSON text and validating the result. Output: cli.ConfigWrite

#### cli.ConfigSet.key
The supported configuration key, `delegation.<harness>.<role>`, or with `--local` `unavailableModels.<model>`. Type: string

#### cli.ConfigSet.value
The new config value; arrays are supplied as JSON text. Type: string

#### cli.ConfigSet.local
Whether a delegation model or an unavailable model is stored in ignored local configuration. Type: bool

#### cli.ConfigSet.force
Whether a custom delegation harness may be written despite the built-in harness list. Type: bool

### cli.ConfigWrite
Kind: entity · Status: active
One saved configuration value and its target file.

#### cli.ConfigWrite.path
The config file changed, relative to the project root. Type: string

#### cli.ConfigWrite.key
The configuration key that was set. Type: string

#### cli.ConfigWrite.value
The validated value that was saved. Type: string | bool | string[] | format.ModelChoice[]

#### cli.ConfigWrite.local
Whether the write targets ignored local configuration. Type: bool
