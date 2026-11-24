# install contracts

### install.Installation
Kind: entity · Status: active
What one `spec init <repo> --name <project>` did to a repository, as its JSON output (`--format json`) reports it. The text output prints the same lists as `wrote <path>`, `skipped <path> (exists)` and `note: <text>` lines.

#### install.Installation.name
The project's slug, from `--name`: lowercase letters, digits, hyphens and underscores, starting with a letter. `spec/config.json` gets it as `name`. Type: string

#### install.Installation.repo
The repository, relative to the working directory, or `.` for the working directory itself. Type: string

#### install.Installation.skill
The plugin brief skill, `spec:brief`. Type: string

#### install.Installation.spec
The spec root, relative to the repository: always `spec`. Type: string

#### install.Installation.written
Every file written, relative to the repository, in the order written. `.claude/settings.json` appears as `.claude/settings.json (permissions and plugin merged)`. Type: string[]

#### install.Installation.skipped
Every file left alone because it already existed, in order. `.claude/settings.json` appears as `.claude/settings.json (spec already enabled)` when nothing had to be added. Type: string[]

#### install.Installation.removed
Recognized legacy-generated files removed by migration, in order. Type: string[]

#### install.Installation.updated
Legacy settings entries changed by migration, in order. Type: string[]

#### install.Installation.keptEdited
Obsolete generated paths whose contents were edited and therefore preserved. Type: string[]

#### install.Installation.notes
What the user must finish by hand: a bundled CLI that could not be copied, a settings file that is not a JSON object, a failed build. Type: string[]

### install.Init
Kind: operation · Status: active
`spec init <repo> --name <project>`: installs spec into a repository, writing only files that do not exist yet.
Output: install.Installation | cli.UsageError | install.InvalidName | install.NotADirectory

#### install.Init.repo
The repository folder, resolved from the working directory. Type: string

#### install.Init.name
`--name`: the project's slug. Type: string

### install.InvalidName
Kind: error · Status: active
`--name` is not a lowercase slug. stderr starts `--name is a lowercase slug, such as chat; not <name>`; exit code 2.

#### install.InvalidName.name
The refused name, as given. Type: string

### install.NotADirectory
Kind: error · Status: active
The repository path does not exist or is not a folder. stderr starts `<absolute path> is not a directory`; exit code 2.

#### install.NotADirectory.path
The absolute path that was refused. Type: string

### install.ClaudeSettings
Kind: entity · Status: active
`.claude/settings.json` in the repository: the Claude Code settings `spec init` and `spec upgrade` merge the project CLI permissions, plugin enablement and the happyface marketplace registration into. Every other key is kept as it was.

#### install.ClaudeSettings.permissions
Claude Code permissions, including the access needed for ticket worktrees and delegated stack commands. Type: install.Permissions

#### install.ClaudeSettings.hooks
Existing hook groups by Claude Code event name are kept unchanged; the plugin supplies its own hooks, one per install.HookEvent. Type: map<string, install.HookGroup[]>

#### install.ClaudeSettings.enabledPlugins
Plugin IDs, `<plugin>@<marketplace name>`, and whether each is enabled. Init and upgrade enable `spec@happyface`; an older project's `spec@spec` is moved to `spec@happyface` with its value. Type: map<string, bool>

#### install.ClaudeSettings.extraKnownMarketplaces
Marketplaces by name that Claude Code registers once the person trusts the folder. Init and upgrade add `happyface` when it is missing; every entry already there is kept as it is. Type: map<string, install.KnownMarketplace>

### install.KnownMarketplace
Kind: type · Status: active
One marketplace a repository's settings register for its contributors.

#### install.KnownMarketplace.source
Where the marketplace is read from. Type: install.MarketplaceSource

### install.MarketplaceSource
Kind: type · Status: active
A marketplace held in a GitHub repository; the one spec writes is `{ "source": "github", "repo": "happyfacedev/happyface-plugins" }`.

#### install.MarketplaceSource.source
Type: "github"

#### install.MarketplaceSource.repo
The GitHub repository as `<owner>/<name>`. Type: string

### install.LocalClaudeSettings
Kind: entity · Status: active
`.claude/settings.local.json` in the repository: the person's own Claude Code settings, ignored by the root `.gitignore`. `spec init` and `spec upgrade` add this checkout's ticket worktree parent here, and `spec init --accept-edits` adds the personal default mode. Every other key is kept as it was.

#### install.LocalClaudeSettings.permissions
The personal permissions: the ticket worktree parent and, when opted in, `defaultMode`. Type: install.Permissions

### install.Permissions
Kind: type · Status: active
The `permissions` object of a Claude Code settings file; keys other than `allow` and `additionalDirectories` are kept as they were.

#### install.Permissions.allow
Permission rules that need no prompt, including `Skill`, the project CLI and stack test/build commands. Type: string[]

#### install.Permissions.additionalDirectories
Checkout-relative directories that Claude Code may access. Spec adds the actual ticket worktree parent only in install.LocalClaudeSettings; an entry already in `.claude/settings.json` is kept as it was. Type: string[]

### install.HookGroup
Kind: type · Status: active
One entry in the plugin's hooks.json under a Claude Code hook event.

#### install.HookGroup.matcher
The tool or source names the group applies to, such as `startup|resume|compact` or `Edit|Write|MultiEdit`. Type: string?

#### install.HookGroup.hooks
The commands to run. Type: install.HookCommand[]

### install.HookCommand
Kind: type · Status: active
One command hook.

#### install.HookCommand.type
Type: "command"

#### install.HookCommand.command
The shell command, for plugin hooks `${CLAUDE_PLUGIN_ROOT}/scripts/spec hook claude-code <event>`. Type: string

#### install.HookCommand.timeout
How many seconds Claude Code lets the command run before it cancels it and discards its output; left out, Claude Code's default of 600 applies. Type: int?

### install.Capability
Kind: type · Status: active
What a role may do, independent of any harness. Type: "read" | "edit" | "run" | "spec" | "tickets" | "delegate"

### install.RoleFile
Kind: entity · Status: active
A harness-neutral stage-role prompt, `spec/roles/<role>.md`: frontmatter, then the prompt. `spec init` writes one per pipeline stage role, self-contained; the project may edit them, though its own additions belong in install.LocalRoleFile, which `--update-roles` keeps.

#### install.RoleFile.role
The role; the file must be named after it. Type: pipeline.Role

#### install.RoleFile.description
One line, 1 to 200 characters, shown with a delegated stage task. Type: string

#### install.RoleFile.capabilities
At least one. Type: install.Capability[]

### install.LocalRoleFile
Kind: entity · Status: active
A project's own additions to one stage-role prompt, `spec/roles/<role>.local.md`: plain text, no frontmatter. `spec next` adds it to the role prompt after the shipped text. A person writes and edits it, through a ticket or a bypass like any other governed file; `spec init --update-roles` never writes, changes or removes one.

#### install.LocalRoleFile.role
The role it adds to, from its file name. Type: pipeline.Role

#### install.LocalRoleFile.text
The text added to the role prompt. Type: string

### install.AgentFile
Kind: entity · Status: removed · Superseded by: cli.Next.task
`.claude/agents/<role>.md`, compiled from one role file. Its frontmatter holds `name`, `description` and `tools`; the body starts with the line `<!-- Generated by spec compile-roles claude-code from spec/roles/<role>.md. Do not edit. -->`, then `In this project, spec means .spec/bin/spec: run it by that path, from the project root.`, then the role prompt.

#### install.AgentFile.name
The role. Type: pipeline.Role

#### install.AgentFile.description
The role file's description. Type: string

#### install.AgentFile.tools
The Claude Code tools the role's capabilities map to, comma-separated, in capability order, without repeats. Type: string

### install.UpdateRoles
Kind: operation · Status: active
`spec init <repo> --update-roles [--yes]`: compares installed stage-role prompts with this version's, replaces them only with `--yes`, lists the lines a project added that belong in install.LocalRoleFile, commits the prompts it wrote on the base branch, and migrates an unchanged obsolete overseer prompt.
Output: install.RoleUpdate | cli.UsageError | install.InvalidName | install.RolesCommitRefused

#### install.UpdateRoles.repo
The repository folder. Type: string

#### install.UpdateRoles.name
`--name`; when left out, `name` in `spec/config.json`. Type: string?

#### install.UpdateRoles.yes
`--yes`: write the new role prompt versions. Type: bool

### install.RoleUpdate
Kind: type · Status: active
The JSON output of `--update-roles`, including its role-prompt changes and migration results.

#### install.RoleUpdate.changed
Each role prompt that differs from this version's. Type: install.RoleChange[]

#### install.RoleUpdate.written
The stage-role prompt files written. Empty without `--yes`. Type: string[]

#### install.RoleUpdate.removed
Unchanged obsolete generated role prompts removed by migration. Type: string[]

#### install.RoleUpdate.keptEdited
Obsolete generated role prompts whose contents were edited and therefore preserved. Type: string[]

#### install.RoleUpdate.commit
The hash of the commit that holds what `--yes` wrote; left out when nothing was committed. Type: string?

### install.RolesCommitRefused
Kind: error · Status: active
git refused to stage or commit the role prompts `spec init --update-roles --yes` wrote, or another spec-owned commit of the repository was in progress. Prints `git could not commit <files, joined by ", ">: <git's first lines>; nothing was saved`, exits 1, removes each file it created and puts back each file it changed.

### install.RoleChange
Kind: type · Status: active
One role prompt that differs.

#### install.RoleChange.role
The role (`tester`). Type: string

#### install.RoleChange.path
The file, relative to the repository. Type: string

#### install.RoleChange.diff
The line diff from the installed text to this version's: removed lines start `- `, added lines `+ `. Type: string[]

#### install.RoleChange.extra
Every non-blank line of the installed file that is not a line of this version's prompt, in file order: candidates for install.LocalRoleFile, which the person decides. Type: string[]

### install.ProjectCli
Kind: entity · Status: active
The repository-pinned CLI launcher and CommonJS bundle in .spec/bin/.

#### install.ProjectCli.launcher
The executable .spec/bin/spec copied from the selected upgrade source or the running CLI during init. Type: string

#### install.ProjectCli.bundle
The CommonJS bundle .spec/bin/spec.cjs copied beside the launcher. Type: string

#### install.ProjectCli.version
The CLI version printed by .spec/bin/spec --version. Type: string

### install.Upgrade
Kind: operation · Status: active
spec upgrade [<repo>] [--from <dir>] [--force]: selects the plugin source, compares its version and, at an equal version, its bytes with the project CLI, migrates generated old-layout files, and updates .spec/bin/ when needed.
Output: install.UpgradeResult | cli.UsageError

#### install.Upgrade.repo
The optional repository folder; defaults to cwd. Type: string?

#### install.Upgrade.from
An optional source directory holding a CLI launcher and bundle; it has priority over installed plugin locations. Type: string?

#### install.Upgrade.force
Allows an explicit source older than the project CLI to replace it. Type: bool

### install.UpgradeResult
Kind: type · Status: active
The JSON output of spec upgrade.

#### install.UpgradeResult.upgraded
Whether the files were replaced. Type: bool

#### install.UpgradeResult.downgraded
Whether the selected source was older than the project's previous version. Type: bool

#### install.UpgradeResult.rebuilt
Whether the files were replaced although the installed version equals the source's, because their bytes differed or one was missing. Type: bool

#### install.UpgradeResult.oldVersion
The project's previous version, or "not installed" or "unknown". Type: string

#### install.UpgradeResult.version
The selected source CLI's version. Type: string

#### install.UpgradeResult.removed
Generated old-layout files and settings entries removed by migration. Type: string[]

#### install.UpgradeResult.keptEdited
Old-layout files whose content did not match the old generator and were preserved. Type: string[]

#### install.UpgradeResult.notes
Migration or settings notices. Type: string[]

### install.PluginPackage
Kind: entity · Status: active
This repository's Claude Code plugin package, which the happyface marketplace lists as `spec@happyface`.

#### install.PluginPackage.marketplace
Status: removed
.claude-plugin/marketplace.json: this repository's own marketplace. It is no longer built or committed; spec is listed only in the happyface marketplace. Type: string

#### install.PluginPackage.manifest
plugin/.claude-plugin/plugin.json: plugin name and description, and no version. Type: string

#### install.PluginPackage.hooks
plugin/hooks/hooks.json: the active Claude Code hooks, each invoking plugin/scripts/spec. Type: string

#### install.PluginPackage.skills
plugin/skills/: the spec, brief and command skills generated or committed for the plugin; command skills are spec-init, feature, change and bug. Type: string

#### install.PluginPackage.launcher
plugin/scripts/spec: the committed plugin CLI launcher. Type: string

#### install.PluginPackage.bundle
plugin/scripts/spec.cjs: the committed plugin CLI bundle. Type: string

### install.CompileRoles
Kind: operation · Status: removed · Superseded by: cli.Next.task
`spec compile-roles <harness>`: writes the harness's agent files from the spec's role files. Their CLI commands use the project's `.spec/bin/spec`. Prints `wrote <path>` for each file that changed and `removed <path>` for each agent file whose role file is gone, or `agent files up to date` when there is neither.
Output: string[] | install.UnknownHarness | install.InvalidRoleFile | install.NoRoleFiles

#### install.CompileRoles.harness
Only `claude-code` is supported. Type: string

### install.UnknownHarness
Kind: error · Status: active
A harness other than `claude-code`, or none. stderr starts `unknown harness <harness>; supported: claude-code` (`(none)` when missing); exit code 1 from `spec hook` (INS-007).

#### install.UnknownHarness.harness
The harness as given. Type: string | null

### install.NoRoleFiles
Kind: error · Status: removed
The spec root has no `roles/*.md`. stderr is `no role files in spec/roles/`; exit code 1.

### install.InvalidRoleFile
Kind: error · Status: removed · Superseded by: cli.Next.task
A role file has an error finding. stderr holds one `<file>:<line> <message>` line per finding; exit code 1, and no agent file is written.

#### install.InvalidRoleFile.messages
The finding lines. Type: string[]

### install.HookEvent
Kind: type · Status: active
The seven active plugin hook points: `session-start` on `SessionStart` (matcher `startup|resume|compact`), `before-edit` on `PreToolUse` (`Bash|Edit|Write|MultiEdit|NotebookEdit`), `after-edit` on `PostToolUse` (`Edit|Write|MultiEdit`), `before-agent` on `PreToolUse` (`Agent|Task`), `before-handback` on `PreToolUse` (`SubagentHandback`), `subagent-start` on `SubagentStart` and `subagent-stop` on `SubagentStop` (both every agent type) (INS-020). Type: "session-start" | "before-edit" | "after-edit" | "before-agent" | "before-handback" | "subagent-start" | "subagent-stop"

### install.Hook
Kind: operation · Status: active
`spec hook <harness> <event>`: reads one Claude Code hook payload as JSON on stdin and answers with Claude Code hook output on stdout, stderr and the exit code. Empty stdin counts as `{}`. A payload it does not recognise gets no output and exit code 0. Without a resolvable spec root, the hook exits 0 with empty stdout and stderr (INS-007).
Output: install.HookOutput | install.StopHookOutput | null | install.UnknownHarness | install.UnknownHookEvent | install.HookInputNotJson

#### install.Hook.harness
Type: string

#### install.Hook.event
Type: install.HookEvent

#### install.Hook.input
The payload on stdin. Type: install.HookInput | install.SubagentStopInput

### install.HookInput
Kind: type · Status: active
The keys of a Claude Code hook payload spec reads; any other key is ignored.

#### install.HookInput.tool_name
`PreToolUse` and `PostToolUse`: the tool, such as `Edit`, `Write`, `MultiEdit`, `Agent`, `Task` or `SubagentHandback`. Type: string?

#### install.HookInput.tool_input
`PreToolUse` and `PostToolUse`: the tool's input. Type: (install.ToolInput | install.AgentToolInput | install.HandbackToolInput)?

#### install.HookInput.agent_type
Status: removed
`SubagentStop`: the agent that is finishing. Type: string?

#### install.HookInput.agent_id
Status: removed
`SubagentStop`: the agent run; bounces are counted per run. Type: string?

#### install.HookInput.session_id
Status: removed
The session; counts bounces when `agent_id` is missing. Type: string?

#### install.HookInput.last_assistant_message
Status: removed
`SubagentStop`: the agent's final message. Type: string?

#### install.HookInput.agent_transcript_path
Status: removed
`SubagentStop`: the agent's transcript (JSONL), read when `last_assistant_message` is missing. Type: string?

#### install.HookInput.transcript_path
Status: removed
The session transcript, read when `agent_transcript_path` is missing too. Type: string?

### install.ToolInput
Kind: type · Status: active
The `tool_input` keys spec reads; the others are passed back unchanged.

#### install.ToolInput.subagent_type
Status: removed
`Agent`/`Task`: the agent being delegated to. Type: string?

#### install.ToolInput.prompt
Status: removed
`Agent`/`Task`: the delegation message. Type: string?

#### install.ToolInput.description
Status: removed
`Agent`/`Task`: the delegation's short label. Type: string?

#### install.ToolInput.file_path
`Edit`/`Write`/`MultiEdit`: the file changed. Type: string?

### install.AgentToolInput
Kind: type · Status: active
The `tool_input` of a Claude Code `Agent` (or older `Task`) call. The `before-agent` hook reads `prompt`; every key, these and any other, is passed back unchanged unless INS-020/R1 replaces it.

#### install.AgentToolInput.prompt
The message the subagent starts from; exactly `spec:<ticket ID>` after trimming is a spec stage request (INS-020/R1). Type: string?

#### install.AgentToolInput.description
The call's short label. Type: string?

#### install.AgentToolInput.subagent_type
The agent delegated to, such as `general-purpose`. Type: string?

#### install.AgentToolInput.model
The model alias the subagent runs on, such as `sonnet`. Type: string?

#### install.AgentToolInput.effort
The reasoning effort the subagent runs at. Claude Code 2.1.292 or later takes it per call, below `CLAUDE_CODE_EFFORT_LEVEL`. Type: format.Effort?

#### install.AgentToolInput.run_in_background
Whether the subagent runs in the background. Type: bool?

### install.HandbackToolInput
Kind: type · Status: active
The `tool_input` of a Claude Code `SubagentHandback` call, with which a subagent delivers its report before it stops. The `before-handback` hook reads `message`; any other key is ignored.

#### install.HandbackToolInput.message
The report the subagent hands back; it is not in the subagent's final message. Type: string?

### install.SubagentStopInput
Kind: type · Status: active
The keys of a Claude Code `SubagentStop` payload the `subagent-stop` hook reads; any other key is ignored.

#### install.SubagentStopInput.agent_id
The subagent run that is stopping. Type: string?

#### install.SubagentStopInput.agent_type
The stopping subagent's type; it does not decide whether a report is recorded. Type: string?

#### install.SubagentStopInput.last_assistant_message
The text of the subagent's final response. Type: string?

#### install.SubagentStopInput.agent_transcript_path
The subagent's own transcript (JSONL); its last assistant text is read when `last_assistant_message` is missing or empty. Type: string?

### install.HookOutput
Kind: type · Status: active
One JSON line on stdout, exit code 0, in Claude Code's hook output shape.

#### install.HookOutput.hookSpecificOutput
Session context, or the `before-agent` or `before-handback` decision. Type: (install.HookSpecificOutput | install.AgentToolDecision)?

#### install.HookOutput.systemMessage
A warning Claude Code shows the person, not the model. Type: string?

#### install.HookOutput.decision
Status: removed
`block` sends a finishing agent back. Type: "block"?

#### install.HookOutput.reason
Status: removed
Why it was sent back, shown to the agent. Type: string?

### install.HookSpecificOutput
Kind: type · Status: active
The `hookSpecificOutput` object.

#### install.HookSpecificOutput.hookEventName
Type: "SessionStart" | "SubagentStart"

#### install.HookSpecificOutput.additionalContext
`SessionStart`: text added to the session; `SubagentStart`: text added to the subagent's context before its first prompt (INS-020/R20). Type: string?

#### install.HookSpecificOutput.permissionDecision
Status: removed
`PreToolUse`: whether the delegation goes ahead. Type: ("allow" | "deny")?

#### install.HookSpecificOutput.permissionDecisionReason
Status: removed
`PreToolUse` with `deny`: why, shown to the model. Type: string?

#### install.HookSpecificOutput.updatedInput
Status: removed
`PreToolUse` with `allow`: the delegation's input, with `prompt` replaced. Type: install.ToolInput?

### install.AgentToolDecision
Kind: type · Status: active
The `hookSpecificOutput` the `before-agent` hook prints for a spec stage request, and the `before-handback` hook for a handed-back stage report (INS-020).

#### install.AgentToolDecision.hookEventName
Type: "PreToolUse"

#### install.AgentToolDecision.permissionDecision
`allow` runs the call, an Agent call with install.AgentToolDecision.updatedInput in place of the input Claude sent; `deny` refuses it, and for a `SubagentHandback` call Claude Code then has the subagent call it again. Type: "allow" | "deny"

#### install.AgentToolDecision.permissionDecisionReason
With `deny`: what the main agent, or the handing-back subagent, is to do instead, which Claude Code shows to it. Type: string?

#### install.AgentToolDecision.updatedInput
With `allow`: the whole input the call runs with, which Claude Code uses in place of the original. Type: install.AgentToolInput?

### install.StopHookOutput
Kind: type · Status: active
One JSON line on stdout, exit code 0, that the `subagent-stop` hook prints when it has something to say (INS-020).

#### install.StopHookOutput.decision
`block` keeps the subagent running, with install.StopHookOutput.reason as its next instruction; left out, the subagent stops. Type: "block"?

#### install.StopHookOutput.reason
With `block`: what the subagent is to do next. Type: string?

#### install.StopHookOutput.systemMessage
A warning Claude Code shows the person, not the model. Type: string?

### install.UnknownHookEvent
Kind: error · Status: active
An event other than the seven install.HookEvent names. stderr starts `unknown hook event <event>; events: session-start, before-edit, after-edit, before-agent, before-handback, subagent-start, subagent-stop` (`(none)` when missing); exit code 1, which Claude Code treats as a non-blocking error.

#### install.UnknownHookEvent.event
The event as given. Type: string | null

### install.HookInputNotJson
Kind: error · Status: active
stdin is not empty and not JSON. stderr is `spec hook: the hook input is not JSON`, stdout is empty, and the exit code is 1, which Claude Code treats as a non-blocking error.

### install.LoadSkill
Kind: operation · Status: active
`/brief` in Claude Code runs the plugin's `spec:brief` skill. It invokes `.spec/bin/spec brief --stdin` with the arguments as a here-document whose delimiter `SPEC_ARGUMENTS_4b7e2c9d_END` is quoted, and Claude Code puts its stdout in the context. The arguments reach `spec brief` unchanged, except after a line that is exactly the delimiter, and none of their text is run (INS-012/R1, INS-012/R4). A placeholder Claude Code leaves unfilled is passed on as its literal text; `spec brief` decides what it means.
Output: string

#### install.LoadSkill.arguments
What follows the skill name. Type: string
