---
name: spec
description: Set up spec on this repo, start a new project with spec, build or maintain a project's specification, answer questions about spec, add a feature, change behaviour, check tickets, or ask what does the spec say. Use when the user says "set up spec", "start a new project with spec", or asks about spec.
allowed-tools: Read, Bash(.spec/bin/spec *)
---

# Set up and operate spec

Use the current repository only. Never ask for or switch to another path. Run one step at a time, explain the result briefly, and ask one question at a time. Do not restate the docs.

## Install and keep spec up to date

The happyface marketplace lists spec. When the person asks how to install or update it: add the marketplace once with `/plugin marketplace add happyfacedev/happyface-plugins`, then install with `/plugin install spec@happyface`. A project whose `.claude/settings.json` registers the happyface marketplace (init adds it) offers it once the person trusts the project; then `claude plugin install spec@happyface --scope project` installs it for that project. Claude Code leaves auto-update off for this marketplace: turn on auto-update once under /plugin > Marketplaces > happyface, or ask an admin to set `autoUpdate` in managed settings.

## Phase 0: inspect this repository

For a detected `spec` or `legacy-spec` state, do not reinstall. Use `detect.harness` and `detect.missingModels`; model selection is required. Ask one role at a time for every missing model; setup does not continue until each has a default. If `detect.harness` is null, ask which current harness first; because detection cannot list missing roles for an unknown harness, then treat all four stage roles as missing and ask for each.

For Claude Code, read `~/.claude/plugins/installed_plugins.json` with the Read tool. In `plugins["spec@happyface"]`, keep entries whose scope is `user` or whose `projectPath` resolves to this repository; use `plugins["spec@spec"]` entries the same way only when no `spec@happyface` entry is eligible. Then choose the eligible entry with the latest `lastUpdated` (falling back to `installedAt`); ignore records for other project paths. This matches `spec upgrade`. On Astro, if the plugin is not installed for Claude Code, ask the person for the spec CLI path. Ask the user to approve this absolute bootstrap command once in an interactive session, then run `"<installPath>/scripts/spec" detect --format json`. If no eligible installPath is available, stop and ask the user for the spec CLI path; never guess it. Explain the detected state and stack in one or two sentences.

- **spec:** do not reinstall. Show `.spec/bin/spec queue` and `.spec/bin/spec gaps --no-tests`, complete the required model step for every `detect.missingModels` role, then ask whether to continue with the gaps or a ticket. If neither `.claude/settings.local.json` nor `.claude/settings.json` lists the actual ticket-worktree parent in `permissions.additionalDirectories`, suggest `.spec/bin/spec upgrade .` to merge current permissions. In Claude Code, when `detect.editMode` is `acceptEdits`, skip this question; otherwise ask whether to enable background ticket edits, and if approved, run `.spec/bin/spec init . --name <name from spec/config.json> --accept-edits` to merge the project mode without overwriting existing files.
- **legacy-spec:** offer to run the plugin CLI's `upgrade .`; do not initialize a second spec. After upgrade, commit it, run detect again, and complete the required model step before proceeding.
- **dirty:** offer to commit the current changes first. Do not continue until the user decides.
- **No git:** ask once whether to run `git init -b main`. If they decline, stop; tickets need a git repository.

## Phase 1: prepare the project

- **Empty:** ask for the project name, then the stack. If detection lists several stacks, ask which stack is the app. Work in the current repository. Propose the standard scaffold command and run it only after approval; do not copy personal boilerplate or ask for a folder path:
  - Flutter: `flutter create --empty .`
  - Dart: `dart create -t console-simple .`
  - Node: run `npm init -y`, ask vitest or jest, then install the approved runner with `npm install --save-dev vitest` or `npm install --save-dev jest`.
  - Python: `uv init --bare .`
  - Go: `go mod init <module>`
  - Rust: `cargo init --bin .`
  - Other: ask which standard scaffold command to use.
- **Code:** confirm the detected stack and test command. If detection lists several stacks, ask which stack is the app. If detect reports `other` or no stack is recognized, ask which stack and test command to use. Check that test dependencies the project needs are installed (when using `flutter-skill`, add Flutter dev dependencies `bloc_test`, `mocktail` and `fake_async` if missing), run its existing tests, and show any failures. Do not silently accept a failing baseline.
- **Baseline:** after scaffolding, add one trivial passing test in the chosen stack's test path and run the suite, or ask the user to accept "no tests yet" for a new project. If tests fail, pause and offer to fix first, record the failure as a known-failing ticket after install, or stop; continue only with the user's choice. A known-failing baseline blocks every other ticket until fixed.
- Commit the scaffold before installing spec.

## Phase 2: install and configure spec

In Claude Code, accept the project trust prompt once in an interactive session; otherwise headless runs ignore permissions in project `.claude/settings.json`. When the detect result's `editMode` is already `acceptEdits`, skip the edit-mode question: setup does not ask about `acceptEdits` and does not run `--accept-edits`. For any other value, ask as follows. Before installing, ask whether to enable background ticket edits. Background subagents cannot prompt; before setting `acceptEdits`, tell the person that edits then stay scoped to the project and its worktrees. If approved, append `--accept-edits` to the install command. This writes personal `.claude/settings.local.json` `permissions.defaultMode` to `acceptEdits` and also changes your own main session in this project; edits stay scoped to the project and its worktrees. If the CLI reports a different existing default mode, leave it unchanged and ask what to do. Never add bare `Edit` or `Write` allow rules. Use this rule: when `.spec/bin/spec verify-history` exists, the before-edit hook and Git hooks guard the base branch; if `.spec/bin/spec verify-history` does not exist, base-branch edits are not blocked, so ask the person before editing there. If declined, omit the flag; background ticket work needs the person to change the project mode before it can edit.

Use the same approved bootstrap path: `"<installPath>/scripts/spec" init . --name <slug> --stack <stack>` (append `--accept-edits` only with approval). It writes only files that are missing. Match the slug to the project's lowercase name. Confirm or correct the detected globs with `.spec/bin/spec config set codeGlobs '["src/**"]'` and `.spec/bin/spec config set testGlobs '["tests/**"]'` as needed. If detect reports a non-`main` `baseBranch`, set it with `.spec/bin/spec config set baseBranch <branch>`.

Stack defaults (`spec init --stack` uses these). Adjust paths and commands to this repository:

| Stack | Test command | Code globs | Test globs | Worktree setup |
| --- | --- | --- | --- | --- |
| Flutter | `flutter test --machine --plain-name "{filter}" > "{report}"` | `["lib/**"]` | `["test/**"]` | `flutter pub get` |
| Dart | `dart test --reporter json --name "{filter}" > "{report}"` | `["lib/**"]` | `["test/**"]` | `dart pub get` |
| Node / vitest | `npx vitest run -t "{filter}" --reporter=json --outputFile="{report}"` | `["src/**"]` | `["tests/**"]` | `ln -s "$SPEC_MAIN_ROOT/node_modules" node_modules` |
| Node / jest | `npx jest -t "{filter}" --json --outputFile="{report}"` | `["src/**"]` | `["tests/**"]` | `ln -s "$SPEC_MAIN_ROOT/node_modules" node_modules` |
| Python | `pytest -k "{filter}" --junitxml="{report}"` | `["**/*.py"]` | `["tests/**"]` | — |
| Go | `go test ./... -run "{filter}" -v 2>&1 | go-junit-report > "{report}"` | `["**/*.go"]` | `["**/*_test.go"]` | — |
| Rust / other | Configure a JUnit-compatible test command for this project before continuing | project paths | project paths | — |

For Node, detect vitest versus jest from `package.json`; make sure the selected test runner and any test-only dependencies are installed. The Node worktree setup links the main `node_modules` into ticket worktrees. Python needs pytest. Python virtual environments are optional; set a project-specific `worktreeSetup` to activate or create one (no default worktree setup is applied). Go needs go-junit-report. Rust and unrecognized test runners need a project-specific report command before tickets can verify tests. If the project generates code, run code generation once with its standard generator after scaffolding and before the baseline tests. Ticket SPEC-STUB test-first stubs only add throwing declarations; they do not generate annotation-derived code, so include generation in `worktreeSetup` when ticket tests require it.

Ask which available build skills define how this project's code is built; offer relevant skills from the session's skill list (for example `flutter-skill`). For each chosen build skill, ask which commands the skill requires agents to run. Add each chosen command as `Bash(<command> *)` under `.claude/settings.json` `permissions.allow`, and preserve existing entries. Examples include `dart run build_runner`, `dart format`, `mason make` and `dart tools/fix_part_directives.dart`. The approved `permissions.defaultMode: "acceptEdits"` setting, not broad Edit/Write allow rules, enables background ticket subagent edits. Then add these lines to the role prompts:
- Before “Never change spec files” in `spec/roles/implementer.md`: “Before you write any code, load the <skill> skill and follow it for how the code is built.”
- Before “Change test files only” in `spec/roles/tester.md`: “Load the <skill> skill and follow its testing rules. Where a contract has no `Code:` line, put the entry point where <skill> says it belongs.”
- At the end of `spec/roles/reviewer.md`: “Check the code against the <skill> skill as well as the brief.”
Keep technical implementation detail out of the spec. The installed spec-writer role prompt states that the spec says what the product does, never how it is built, with no class, function, file, package, framework, state-management or storage names and no `Code:` lines; technical requirements such as an external API, platform or measurable limit are exceptions. Delete the `## Error model` section from `spec/core/conventions.md`.

**Choose a model for every missing role; this is required.** Use `detect.harness`; if null, ask which current harness this session uses (Astro or Claude Code) first, then treat all four roles as missing. For a known harness, ask one role at a time for every role in `detect.missingModels`. For Astro, list the roles available from `mcp__agents__delegate`; these are delegate roles, and the selected role value is passed as `delegate(role=<delegation value>, task=..., worktree=...)`. For Claude Code, offer exactly `sonnet`, `opus`, `haiku` or `fable`; never offer full model IDs or `inherit`. On Claude Code propose this list first, best first, each model with its reasoning effort: spec-writer opus medium; tester sonnet high, then haiku high; implementer opus medium, then haiku high; reviewer sonnet high; with spec-review sonnet high set alongside. The person may take another list or one model for a role instead. On Astro suggest a stronger model for spec-writer and reviewer, and a medium model for tester and implementer. Do not ask for a spec-review model: the spec review runs on the reviewer's model unless `delegation.<harness>.spec-review` is set. A list is saved as JSON, for example `.spec/bin/spec config set delegation.claude-code.tester '[{"model":"sonnet","effort":"high"},{"model":"haiku","effort":"high"}]'`; a model this machine cannot use is marked with `.spec/bin/spec config set unavailableModels.<model> true --local`. Then ask once whether choices are shared with the team or personal. Save shared choices with `.spec/bin/spec config set delegation.<harness>.<role> <model>` and personal choices with the same command plus `--local`. The shared defaults are committed with the install; local choices stay ignored.

When enforcement is installed (`.spec/bin/spec verify-history` exists), base-branch edits go through tickets. For an exception, use `.spec/bin/spec bypass "<reason>"`. Before committing the install, run `.spec/bin/spec bypass "spec setup"`. If it reports `unknown command bypass`, this project predates enforcement and the setup commits normally; otherwise commit while the bypass is active. Run `.spec/bin/spec lint --ci`; it must report zero errors.

## Phase 3: build the initial specification

- **New project:** interview for the overview, modules and what each owns, one main contract per module, invariants and glossary. Do not add features yet; each feature will arrive with its ticket, tests and code.
- **Existing code:** follow `/spec:spec-init`: draft from the code, tests and docs, then confirm each unit with the user using `.spec/bin/spec gaps` and `.spec/bin/spec confirm <ID>`.
- Use `.spec/bin/spec bypass "spec setup"` before editing and committing this initial frame/draft on the base branch. If it reports `unknown command bypass`, the project predates enforcement and the setup commits normally. Require `.spec/bin/spec lint --ci` to have zero errors, commit the frame, and walk through `spec/index.md`.

## Phase 4: day to day

Ask plainly: new features route to `/spec:feature`; behavior changes, decisions, invariants and glossary changes route to `/spec:change` (or `/spec:brief` to discuss first); tests-only requests get a task ticket via `/spec:change`; bugs route to `/spec:bug`. Ask to check tickets with `/spec:run`, which drives ready tickets; ask `/spec:brief <question>` to discuss what the spec says. Use `/spec:spec-init` to inspect gaps and confirm drafted units. Never change anything outside a ticket. When `.spec/bin/spec verify-history` exists, direct edits to spec, code or tests on the base branch are blocked except for an explicit `.spec/bin/spec bypass "<reason>"` exception; otherwise they are not blocked, so ask the person before editing there.

## Driving a ticket

After filing a ticket and getting the user's approval, follow the same Driving a ticket protocol used by `/spec:feature`, `/spec:change`, `/spec:bug` and `/spec:run`: call `.spec/bin/spec next <ID> --harness <harness> --format json`, delegate the returned task in its worktree with the selected role model, save the subagent's final message in the session scratch directory and pass it to `ticket advance --report-file`. Ask and record every returned question; on a third refusal the CLI blocks the ticket and stashes any uncommitted stage work, so tell the user and wait for resolution. Merge only when `next` says `merge`. Never edit ticket files yourself or skip a refused report. The command skills contain the full harness-specific loop.

## Known limits

- For details, read `<installPath>/docs/WORKFLOW.md`, `FORMAT.md` and `TICKETS.md` only when needed.
- A stack without a detected test reporter needs a project-specific `testCommand` before ticket tests can pass.
- When a ticket stops, inspect `.spec/bin/spec queue` and `.spec/bin/spec gate <ID>`. If a delegate has stopped, confirm no subagent is running, then use `.spec/bin/spec next <ID> --restart`; it restores stashed work and returns the same stage task.
- After plugin updates, run `.spec/bin/spec upgrade`. Review changed role prompts with `.spec/bin/spec init . --update-roles`; add `--yes` only after approval.
- Astro has no Claude Code hooks and does not execute `!` blocks: run `.spec/bin/spec lint --ci` after spec changes, `.spec/bin/spec gaps --no-tests` before spec-init, and `.spec/bin/spec brief --stdin` with the user's request before feature/change/bug interviews. Astro passes a `worktree` to `delegate`; use that worktree for each subagent. In Claude Code, trust the spec hooks in **Settings → Hooks**.
- With project trust accepted and the actual sibling-worktree parent listed in `permissions.additionalDirectories` of the personal `.claude/settings.local.json` (which init and upgrade write, never the committed `.claude/settings.json`), Claude Code allows a subagent's relative `.spec/bin/spec` command with `--root <worktree spec root>`, run from the project root where every subagent shell command starts because its cd never carries over; an absolute worktree CLI path does not match. In acceptEdits mode the report file named in `entry.advance` needs no approval, because it is a file inside that listed worktree parent; in default mode Claude Code still asks before the write. Astro passes `worktree` to `delegate`.
