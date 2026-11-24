---
id: INS-014
title: Package spec as a Claude Code plugin
module: install
status: active
writes: [install.PluginPackage]
retired: [S1]
---
## Intent
This repository holds the spec plugin, which the happyface marketplace lists as `spec@happyface` (INS-019). Plugin hooks and skills live with the plugin, while each project keeps its own pinned CLI. Stage roles are delegated by the active session; the plugin no longer ships compiled agents.

## Behaviour
### S2: The plugin manifest carries no version
Given package.json has version <version>
When the repository is built
Then install.PluginPackage.manifest is plugin/.claude-plugin/plugin.json with name "spec" and a description, and no `version` key (R1)
And `spec --version` still prints "spec <version>"

### S3: The plugin bundle is built and committed
Given the repository is built
When the plugin is installed from this git repository
Then install.PluginPackage.launcher and install.PluginPackage.bundle are committed copies of dist/spec and dist/spec.cjs

### S4: The plugin registers the active hooks
Given the plugin hooks manifest
When Claude Code loads plugin/hooks/hooks.json
Then install.PluginPackage.hooks has SessionStart with matcher "startup|resume|compact" and command "${CLAUDE_PLUGIN_ROOT}/scripts/spec hook claude-code session-start"
And PostToolUse uses matcher "Edit|Write|MultiEdit" and command "${CLAUDE_PLUGIN_ROOT}/scripts/spec hook claude-code after-edit", and before-agent, before-handback, subagent-start and subagent-stop have their own groups, as INS-020/S14 says

### S5: Plugin command skills are generated for the project
Given the command templates, their shared interview rules and their shared ticket-driving rules
When the repository is built
Then install.PluginPackage.skills contains plugin/skills/<command>/SKILL.md for spec-init, feature, change, bug and run
And each calls .spec/bin/spec and uses "this project" instead of a project-specific name
And feature, change, bug and run share the Driving a ticket protocol

### S6: The brief skill uses the project CLI
Given templates/SKILL.md
When the repository is built
Then install.PluginPackage.skills contains plugin/skills/brief/SKILL.md, which calls ".spec/bin/spec brief --stdin"
And its role hint lists `<spec-writer|spec-review|tester|implementer|reviewer>` in pipeline order
And it has no CLAUDE_SKILL_DIR dependency

### S7: Setup resolves its bootstrap CLI from the scoped plugin registry
Given plugin/skills/spec/SKILL.md is loaded before a project spec exists
When setup locates the plugin CLI
Then its allowed tools include `Read` and `Bash(.spec/bin/spec *)` but no `Bash(printf *)` or plugin-CLI allow rule
And it reads `~/.claude/plugins/installed_plugins.json`, selects `spec@happyface` entries whose scope is user or whose projectPath resolves to this repository, or such `spec@spec` entries when no `spec@happyface` entry is eligible, then chooses the eligible entry with the latest `lastUpdated` (falling back to `installedAt`), and runs `"<installPath>/scripts/spec" detect --format json` after the user approves the absolute command once (R5, R15)
And on Astro without a Claude Code plugin install, setup asks the user for the spec CLI path rather than guessing or reading the registry
And the skill has no pre-run `!` block
And after installation its project CLI is .spec/bin/spec and it references further docs under `"<installPath>/docs/"`
And it contains no ~/dev/happyface/spec path

### S8: Project commands defer to the pinned CLI
Given a project has a resolvable spec root and .spec/bin/spec.cjs exists
When the plugin CLI runs any command other than init, upgrade or --version
Then it runs .spec/bin/spec with the same argv and stdin, and returns the same stdout, stderr and exit code, `spec verify-history` included, so a `Spec-Roles` commit is checked against the pinned CLI's shipped-prompt manifest whatever the plugin's version (R2, INS-005/R5)

### S9: A newer plugin warns inside session-start JSON
Given the plugin version is newer than the project CLI version
When the plugin hook runs session-start and defers to .spec/bin/spec
Then stdout is one valid JSON document whose `hookSpecificOutput.additionalContext` ends with a line "spec plugin <new> is newer than this project's <old>: run .spec/bin/spec upgrade"

### S10: A user-wide hook without a spec is silent
Given no spec root is resolvable in the current repository
When the plugin runs a Claude Code hook
Then it exits 0 with empty stdout and stderr

### S11: A non-plugin launcher keeps its own CLI
Given a project has .spec/bin/spec.cjs and the running CLI launcher is not the plugin
When the running CLI handles a project command
Then it handles that command itself without delegating to .spec/bin/spec

### S12: Old-layout hooks only offer migration at session-start
Given a plugin runs in a project with spec/config.json but no .spec/bin/spec.cjs
When it runs session-start
Then stdout is one JSON document whose `hookSpecificOutput.additionalContext` is one line asking Claude to run the plugin upgrade command
And when it runs any other hook it exits 0 with empty stdout and stderr
And removed before-delegate and before-finish hooks are silent no-ops, while the old-layout session-start hook only offers migration

### S13: A delegated hook spawn failure is non-blocking
Given .spec/bin/spec.cjs exists but the delegated CLI cannot start or dies by a signal
When a plugin hook delegates
Then it exits 0, stdout is empty, and stderr contains one diagnostic line, except that a spec stage request is refused as INS-020/S20 says
And when a non-hook command delegates under the same failure it exits 1

### S14: Build output can be compared without changing the repository
Given the plugin files are committed
When `scripts/build.ts --out <temp>` runs
Then it writes the plugin and docs files under <temp>, and no .claude-plugin/marketplace.json (INS-019/R1)
And each generated file is byte-for-byte equal to its committed counterpart
And it does not change any tracked file

### S15: This repository pins its own CLI without duplicate plugin hooks
Given `.spec/bin/spec` and `.spec/bin/spec.cjs` are tracked copies of the plugin bundle
And `.claude/settings.json` hooks invoke `.spec/bin/spec` directly and `enabledPlugins["spec@happyface"]` is false
When this repository merges a ticket
Then `afterMerge` does not rewrite the pinned CLI or leave a generated-file change on the base
### S16: A pointer-layout project uses its local CLI until upgrade
Given a project has a valid old `skill.json` pointer and a skill-local launcher but no `.spec/bin/spec.cjs`
When `spec next` prepares a stage and then the project upgrades its CLI
Then the stage task uses the skill-local launcher before upgrade and `.spec/bin/spec` after upgrade, each relative to the project root with `--root` set to the worktree's spec root, and only the `.spec/bin/spec` form matches the allow rule `Bash(.spec/bin/spec *)` (PIP-017/S20, PIP-017/R15)

### S17: Namespacing a command token leaves feature paths intact
Given the spec-init skill template has the `/feature` command token and the path `modules/<module>/features/<ID>-<slug>.md`
When the repository builds the plugin skills
Then the generated skill names the command `/spec:feature`
And it keeps the feature path `modules/<module>/features/<ID>-<slug>.md`, not `modules/<module>/spec:features/`

### S18: Run lists compact summaries and delegates started entries
Given the shared Driving a ticket fragment and the run command template
When the repository is built
Then plugin/skills/run/SKILL.md lists with `spec next --summary`; where it relays (INS-020/R13) it starts with `--start` and delegates those started entries' tasks directly without calling `next <ID>` before the first delegation (R3)

### S19: A stage started in parallel is not treated as blocked
Given `spec next --start` has returned a running delegate entry
When the run skill drives that entry
Then it delegates that task immediately and only asks `next <ID>` after its report is accepted (R3)

### S20: Setup uses the pinned bypass command when available
Given the pinned CLI supports `bypass`, or is an older CLI that reports "unknown command bypass"
When the setup skill prepares the spec install commit
Then it runs `.spec/bin/spec bypass "spec setup"` and commits with that exception
And when the CLI reports "unknown command bypass", it commits normally because enforcement is not installed (R4)

### S21: Astro can run command-skill briefs without injected output
Given Astro does not execute the command skills' `!` brief blocks
When a command skill needs its initial brief
Then Astro runs `.spec/bin/spec brief --stdin` itself with the user's request before continuing (R5)

### S22: Every active-harness role model is chosen before setup continues
Given detect reports any repository state and `detect.missingModels` lists one or more stage roles
When the setup skill configures model defaults
Then it does not reinstall an existing `spec` or `legacy-spec`
And it asks one role at a time for every role in `detect.missingModels` and does not continue until each has a default
And if `detect.harness` is null it asks which current harness to configure first, then treats all four stage roles as missing and requires a default for each before continuing (R6)

### S23: Model choices are harness-specific and explicit
Given setup asks for defaults for spec-writer, tester, implementer and reviewer
When the current harness is Astro or Claude Code
Then Astro choices are the delegate tool's role values, Claude Code choices are sonnet, opus, haiku or fable, and full model IDs and inherit are not offered; on Claude Code the list setup proposes first is spec-writer opus medium, tester sonnet high then haiku high, implementer opus medium then haiku high, and reviewer sonnet high, with spec-review sonnet high set alongside, and a person may take another list or one model instead; shared choices are committed with install, while a missing ticket model is saved with `--local` (R6)

### S24: Setup preserves role guidance and explains routine limits
Given the project setup and command skills are built
When a user prepares a project or a ticket stops
Then setup lists Flutter's bloc_test, mocktail and fake_async when flutter-skill is used, runs code generation once, and explains the known code-generation stub gap
And it explains how to inspect queue and gate, how to restart an interrupted stage with `spec next <ID> --restart` after confirming no subagent is running, and how to use `upgrade` and `init --update-roles`
And it says never to change anything outside a ticket
And `spec/roles/spec-writer.md` states that the spec describes what, never how, including the named implementation details (R7)

### S25: Establish a deliberate baseline before setup
Given the current repository is empty or code-only and detection reports zero or more stack candidates
When the user approves scaffolding or continuing with the existing project
Then multiple detected stacks prompt which stack is the app
And a new Node project asks whether to install vitest or jest after `npm init -y`
And setup adds one trivial passing test for the chosen stack or asks the user to accept "no tests yet"
And a failing baseline offers to fix first, record a known-failing ticket, or stop before setup continues
And when a failing baseline is recorded as known-failing, the setup explains that it blocks every other ticket until fixed (R8)

### S26: Ticket driving reports and resumes stages safely
Given a command skill relays a ticket stage, on Astro or on a Claude Code project whose CLI refuses the before-agent event (INS-020/R13), and receives a gate question, a refused report, or an interrupted stage
When it follows the shared Driving a ticket instructions
Then Claude Code passes the task as Agent `prompt` and uses `run_in_background` for parallel work only when `detect.editMode` is "acceptEdits" (INS-017/S2), and on Claude Code otherwise it sends stage requests as INS-020/S15 says
And it writes the final message with its file tool to the report path already in `entry.advance`, and runs `entry.advance` as given from the project root, never naming a scratch directory or `mktemp` and never using `cd`; the entry has no `advanceRelative` or `cwd` fields (R9, PIP-017/R15)
And it treats exit 1 from `spec next` with questions as normal, asks each question, and answers with `ticket answer`
And the third refusal is terminal: the ticket is blocked and its work is stashed, and the skill tells the user what to do
And an interrupted stage with no running subagent uses `spec next <ID> --restart` to restart the same role and return its task (CLI-007/S10, R9)

### S27: Setup routes everyday questions to the right skills
Given the setup skill is loaded and its day-to-day section is followed
When the user asks to set up spec, start a new project with spec, add a feature, change behaviour, check tickets, or asks what the spec says
Then the skill description includes those triggers
And features route to `/spec:feature`, behavior and decisions, invariants or glossary changes route to `/spec:change` (or `/spec:brief` to discuss first), and tests-only requests use a task ticket through `/spec:change`
And ticket driving routes to `/spec:run` and spec questions route to `/spec:brief` (R10)

### S28: Project permissions take effect only after project trust
Given `.claude/settings.json` allows `Bash(.spec/bin/spec *)` and `.claude/settings.local.json` lists the actual sibling-worktree parent in `permissions.additionalDirectories`
When a Claude Code interactive session accepts the project trust prompt and a subagent runs its task's CLI command for a ticket worktree
Then that command, `.spec/bin/spec --root <worktree spec root> <command>` run from the project root, where a subagent's every shell command starts since its cd never carries over, matches the allow rule, while an absolute worktree CLI path does not (R11, PIP-017/R2)
And with `permissions.defaultMode` "acceptEdits", the main session's write of the report file named in `entry.advance` needs no approval, because that file is inside the listed worktree parent, and headless sessions ignore project settings until a user accepts the trust prompt interactively (R11, PIP-017/R15)

### S29: A spec install repairs missing Claude Code worktree settings
Given a current spec is installed and neither `.claude/settings.local.json` nor `.claude/settings.json` lists the actual sibling-worktree parent in `permissions.additionalDirectories`
When setup detects the `spec` state
Then it suggests `.spec/bin/spec upgrade .` to merge the current worktree permissions without reinstalling (R12)

### S30: Build-skill commands are added as scoped Bash rules
Given the user selects a build skill and the skill names shell commands that its agents must run
When setup updates `.claude/settings.json`
Then it asks which commands the skill requires, adds one `Bash(<command> *)` rule for each chosen command, preserves existing settings and offers examples `dart run build_runner`, `dart format`, `mason make` and `dart tools/fix_part_directives.dart` (R13)

### S31: Setup conditions base-branch protection on enforcement
Given a Claude Code project needs background ticket subagents to edit sibling worktrees and `.spec/bin/spec verify-history` exists
When setup describes edit permissions
Then it asks before setting `.claude/settings.local.json` `permissions.defaultMode` to `acceptEdits` because background subagents cannot prompt, and says this changes the person's own main session, keeps edits scoped to the project and worktrees, and hooks guard the base branch when enforcement is installed (R14)

### S32: Setup warns when enforcement is absent
Given a Claude Code project needs background ticket subagents to edit sibling worktrees and `.spec/bin/spec verify-history` does not exist
When setup describes edit permissions
Then setup says base-branch edits are not blocked and asks the person before editing there (R14)

### S34: A user-scoped plugin registry entry is eligible
Given `installed_plugins.json` has a `spec@happyface` record with scope `user` and a newer project-scoped `spec@happyface` record for a different repository
When the project CLI resolves an installed plugin source for `spec upgrade`
Then the user-scoped record is selected and the unrelated project record is ignored (R15; INS-013/S17)

### S35: A matching project-scoped plugin entry is eligible
Given `installed_plugins.json` has a `spec@happyface` record whose projectPath resolves to the current repository and a newer `spec@happyface` record for a different projectPath
When the project CLI resolves an installed plugin source for `spec upgrade`
Then the matching project-scoped record is selected and the unrelated project record is ignored (R15; INS-013/S18)

### S36: Astro asks for a CLI path without a Claude Code plugin install
Given the current harness is Astro and no Claude Code `spec@happyface` or `spec@spec` install is available
When setup needs its bootstrap CLI
Then it asks the person for the spec CLI path and does not claim Astro uses the Claude Code registry (R15)

### S37: Ticket-driving field references match a real next entry
Given `templates/commands/_drive.md` and the generated run skill reference `entry.<field>` values
When those references are checked against a real `spec next <ID> --harness <harness> --format json` delegate entry
Then every referenced field is an own property of that entry (R16)

### S38: Driving skills resolve missing role models locally
Given a `spec next` delegate entry has a valid `model` or lists roles without valid active-harness models in `missingModels`, including unsupported Claude Code values
When a command skill drives that stage
Then it uses `entry.model` and, on Claude Code when set, `entry.effort` when valid, asks only for roles in `entry.missingModels`, saves those choices with `config set delegation.<harness>.<role> <model> --local`, reuses each role choice across the wave, and never asks merely because it is delegating (R17)

## Rules
- R1: The plugin manifest has no version, so Claude Code follows the plugin's git commit; build refreshes plugin.json, the launcher, bundle and generated skills
- R2: A delegated project CLI invocation sets a recursion guard so it cannot delegate again
- R3: The shared ticket-driving instructions use the first full delegate entry returned by `spec next --start` as the first stage input; a running stage is never mistaken for a user question
- R4: Setup invokes the pinned CLI's bypass command before its spec install commit when available; an older CLI's unknown-command response means the project has no enforcement bypass and the commit proceeds normally
- R5: Setup and CLI upgrade share one selector over `~/.claude/plugins/installed_plugins.json`: keep `spec@happyface` entries, or `spec@spec` entries when no `spec@happyface` entry is eligible, whose scope is `user` or whose projectPath resolves to this repository, and order eligible entries by `lastUpdated` newest first, falling back to `installedAt` when absent; Astro without a Claude Code plugin asks the user for a CLI path; command skills whose `!` brief is skipped run the project CLI's `brief --stdin` themselves.
- R6: Setup requires a default for all four stage roles under the active harness; Claude Code offers only sonnet, opus, haiku and fable and proposes the model lists of S23 first, Astro offers delegate role names, shared defaults are committed with install and ad hoc missing models are saved locally
- R7: Setup explains test prerequisites and code-generation limits, how to inspect and resume stopped tickets using commands this CLI actually supports, plugin and role-prompt upgrades, and never to change files outside a ticket; the spec-writer role prompt says the spec describes product behaviour, not implementation
- R8: Setup resolves detected stack ambiguity, installs a chosen Node runner, establishes or explicitly declines a baseline test, and stops for user direction when tests fail; a known-failing baseline blocks every other ticket until fixed
- R9: Shared ticket-driving text uses the correct harness arguments and the project-root-relative advance command; it writes the report to the absolute path that command already names, never to a scratch directory or a `mktemp` path, and never changes directory; it handles questions and terminal refusals by the CLI's actual behavior, and restarts interrupted stages with `spec next <ID> --restart` only after confirming no delegate is running
- R10: The setup skill description includes setup, project-start, feature, behavior-change, ticket-check and spec-question triggers; its day-to-day guidance routes behavior changes, decisions, invariants, glossary and tests-only requests through `/spec:change`
- R11: Claude Code applies project settings only after the project trust prompt is accepted interactively. With trust and the actual sibling-worktree parent in `permissions.additionalDirectories` of the personal `.claude/settings.local.json`, which Claude Code merges with the project settings for the session and its subagents, a relative `.spec/bin/spec` command matches `Bash(.spec/bin/spec *)`; an absolute worktree CLI does not. A subagent's cd never carries over to its next shell command, so a delegated stage runs the relative CLI from the project root with `--root` (PIP-017/R2). In acceptEdits mode, Claude Code approves file writes inside a listed additional directory, so the report file inside the worktree parent (PIP-017/R4) needs no approval; in default mode it asks, as before.
- R12: For an existing `spec`, setup does not reinstall; when the actual worktree parent is missing from both `.claude/settings.local.json` and `.claude/settings.json` permissions, it suggests `.spec/bin/spec upgrade .` to merge current settings.
- R13: When a build skill is chosen, setup asks which shell commands agents must run and adds the chosen commands as `Bash(<command> *)` permission rules, preserving existing settings.
- R14: Background ticket subagents cannot prompt in default permission mode; setup asks before setting `.claude/settings.local.json` `permissions.defaultMode` to `acceptEdits`, explains this also changes the person's main session in this project, and never adds bare Edit or Write allow rules. It states edits are scoped to the project and worktrees, explains that hooks guard the base branch only when `.spec/bin/spec verify-history` exists, and otherwise says base-branch edits are not blocked and asks the person before editing there.
- R15: Setup and CLI upgrade share one registry selector: keep `spec@happyface` records with scope `user` or projectPath resolving to the current project, or such `spec@spec` records when no `spec@happyface` record is eligible, and order eligible records by `lastUpdated` newest first, falling back to `installedAt` when absent; Astro without a Claude Code plugin install asks the user for the CLI path instead of guessing.
- R16: Ticket-driving template and run-skill entry field references stay aligned with the real delegate-entry JSON shape returned by `spec next`.
- R17: Driving skills use `entry.model`, and on Claude Code `entry.effort`, when set and valid; they ask only for roles in `entry.missingModels`, save those models locally and reuse them across the wave, and never ask merely because a stage is being delegated.

## Out of scope
- Claude Code plugin installation itself
