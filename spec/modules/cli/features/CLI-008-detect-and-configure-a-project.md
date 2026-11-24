---
id: CLI-008
title: Detect the current project and set its config
module: cli
status: active
provides: [cli.Detect, cli.ConfigSet]
invariants: [INV-008]
---
## Intent
The setup flow can inspect the repository it is in before a spec exists, then make supported config changes without rewriting a person's JSON formatting.

## Behaviour
### S1: Detect an empty repository without a spec
Given the current directory has no project files and is not a Git repository
When the developer runs `spec detect --format json` through cli.Detect
Then cli.Detection.state is "empty", cli.Detection.git is false, cli.Detection.dirty is false, cli.Detection.stacks is empty, and cli.Detection.harness is null (R1)

### S2: Detect stack defaults and current Git state
Given a Git repository has a `package.json` with vitest in its dev dependencies and an uncommitted file
And `ASTRO_RUN_ID` is set
When the developer runs `spec detect --format json` through cli.Detect
Then cli.Detection.state is "code", cli.Detection.git is true, cli.Detection.dirty is true, cli.Detection.baseBranch is "main", and cli.Detection.harness is "astro"
And cli.Detection.stacks includes a node stack with manifest "package.json", a vitest test command and source and test globs (R3)

### S3: Recognize a current spec and the Claude Code harness
Given the current directory contains `spec/config.json`
And `CLAUDECODE=1`
When the developer runs `spec detect --format json` through cli.Detect
Then cli.Detection.state is "spec" and cli.Detection.harness is "claude-code" (R2)

### S4: Recognize a legacy skill installation
Given the current directory contains a legacy `.claude/skills/shop-spec/skill.json` whose `specRoot` contains config.json and no `.spec/bin/spec.cjs`
When the developer runs `spec detect --format json` through cli.Detect
Then cli.Detection.state is "legacy-spec" (R2)

### S5: Set a shared config value without reformatting other keys
Given `spec/config.json` has valid configuration and its own spacing and key order
When the developer runs `spec config set delegation.claude-code.reviewer opus` through cli.ConfigSet
Then cli.ConfigWrite.path is "spec/config.json", cli.ConfigWrite.key is "delegation.claude-code.reviewer", and cli.ConfigWrite.value is "opus"
And all existing config text and key order outside the selected value stay unchanged (R4, R6)

### S6: Save a personal delegation override
Given `spec/config.json` has valid configuration and `spec/.gitignore` contains `_generated/` and `keep`
When the developer runs `spec config set delegation.claude-code.reviewer opus --local` through cli.ConfigSet
Then cli.ConfigWrite.path is "spec/config.local.json" and cli.ConfigWrite.local is true
And config.local.json contains that delegation model without changing config.json (R5)
And `spec/.gitignore` keeps its existing lines and includes `config.local.json` (R5)

### S7: Refuse unsupported or schema-invalid config
Given `spec/config.json` has valid configuration
When the developer uses cli.ConfigSet with an unknown key, a local key other than delegation and unavailableModels, or an invalid name
Then the command exits 2 with a config-key or schema error and leaves both files unchanged (R4, R5)

### S8: Detect Jest from the Node manifest
Given a Node `package.json` declares jest
When the developer runs `spec detect --format json` through cli.Detect
Then cli.Detection.stacks includes a node stack with the Jest test command (R3)

### S9: Unrecognized code asks for a stack
Given the current directory has project content but no recognized stack manifest or spec config
When the developer runs `spec detect --format json` through cli.Detect
Then cli.Detection.state is "code" and cli.Detection.stacks includes an other stack with manifest "unknown" and a test command that does not succeed (R1, R3)

### S10: Detect Flutter at the repository root and in an app subfolder
Given a real Flutter `pubspec.yaml` exists at the root or under `apps/mobile/`
When the developer runs `spec detect --format json` through cli.Detect
Then the matching stack name is "flutter", its manifest and path globs are relative to the repository root, and its worktree setup fetches Flutter packages (R3)

### S11: Detect jest from a cross-env test script
Given `package.json` has the test script "cross-env CI=1 jest --runInBand"
And no jest dependency is declared
When the developer runs `spec detect --format json` through cli.Detect
Then its node stack uses the Jest report command (R3)

### S12: Text detection prints real line breaks
Given the current directory contains project files
When the developer runs `spec detect` in text format
Then stdout has one line for each detection field and ends with a newline

### S13: Ignore operating-system and editor metadata when detecting an empty repository
Given the current directory contains only `.git/`, `.DS_Store`, `Thumbs.db`, `.claude/`, `.idea/`, `.vscode/`, `.editorconfig`, `.gitignore`, a README, or a LICENSE
When the developer runs `spec detect --format json` through cli.Detect
Then cli.Detection.state is "empty" (R1)

### S14: Set an underscore-containing project name
Given `spec/config.json` has valid configuration
When the developer runs `spec config set name chat_app` through cli.ConfigSet
Then cli.ConfigWrite.key is "name", cli.ConfigWrite.value is "chat_app", and `spec/config.json` has name "chat_app" (R4)

### S15: Detect a legacy skill with an underscore slug
Given a legacy `.claude/skills/chat_app-spec/skill.json` points to a spec containing config.json and no `.spec/bin/spec.cjs`
When the developer runs `spec detect --format json` through cli.Detect
Then cli.Detection.state is "legacy-spec" (R2)

### S16: Set check commands as JSON
Given `spec/config.json` has valid configuration and its own spacing and key order
When the developer runs `spec config set checkCommands '["npm run lint"]'` through cli.ConfigSet
Then cli.ConfigWrite.key is "checkCommands", cli.ConfigWrite.value is ["npm run lint"], and the complete config passes the schema
And all existing config text and key order outside the selected value stay unchanged (R4, R6)

### S17: Detect lists every missing model for the active harness
Given the current spec has `delegation: { "claude-code": { "implementer": "opus" } }`
And `CLAUDECODE=1`
When the developer runs `spec detect --format json` through cli.Detect
Then cli.Detection.harness is "claude-code" and cli.Detection.missingModels contains spec-writer, tester and reviewer but not implementer (R7)

### S18: A next entry lists missing models for its active harness
Given TASK-101 is ready for its implementer stage and `delegation.astro` sets only the implementer model
And the active harness is Astro
When the developer runs `spec next TASK-101 --harness astro --format json`
Then the delegate entry's `missingModels` contains spec-writer, tester and reviewer but not implementer (R7)

### S19: Config set refuses a custom harness without --force
Given `spec/config.json` has valid configuration
When the developer runs `spec config set delegation.custom-harness.implementer custom`
Then cli.ConfigSet refuses the unsupported harness and leaves both config files unchanged (R8)

### S20: Config set allows a custom harness with --force
Given `spec/config.json` has valid configuration
When the developer runs `spec config set delegation.custom-harness.implementer custom --force`
Then cli.ConfigWrite saves the custom-harness model and lint reports the unknown harness warning (R8)

### S21: Config set accepts Claude Code sonnet
Given `spec/config.json` has valid configuration
When the developer runs `spec config set delegation.claude-code.reviewer sonnet`
Then cli.ConfigWrite saves `sonnet` (R9)

### S22: Config set accepts Claude Code opus
Given `spec/config.json` has valid configuration
When the developer runs `spec config set delegation.claude-code.reviewer opus`
Then cli.ConfigWrite saves `opus` (R9)

### S23: Config set refuses inherit
Given `spec/config.json` has valid configuration
When the developer runs `spec config set delegation.claude-code.reviewer inherit`
Then cli.ConfigSet refuses the model and leaves both config files unchanged (R9)

### S24: Config set refuses a full Claude model ID
Given `spec/config.json` has valid configuration
When the developer runs `spec config set delegation.claude-code.reviewer claude-haiku-4-5`
Then cli.ConfigSet refuses the model and leaves both config files unchanged (R9)

### S25: --force does not bypass Claude Code model validation
Given `spec/config.json` has valid configuration
When the developer runs `spec config set delegation.claude-code.reviewer opus-4 --force`
Then cli.ConfigSet refuses the model and leaves both config files unchanged (R9)

### S26: A pinned current CLI supersedes a leftover legacy skill
Given the current directory has `spec/config.json`, an old `.claude/skills/shop-spec/skill.json` pointer and `.spec/bin/spec.cjs`
When the developer runs `spec detect --format json` through cli.Detect
Then cli.Detection.state is "spec" (R2)

### S27: Config set accepts Claude Code haiku
Given `spec/config.json` has valid configuration
When the developer runs `spec config set delegation.claude-code.reviewer haiku`
Then cli.ConfigWrite saves `haiku` (R9)

### S28: Config set accepts Claude Code fable
Given `spec/config.json` has valid configuration
When the developer runs `spec config set delegation.claude-code.reviewer fable`
Then cli.ConfigWrite saves `fable` (R9)

### S29: Astro delegation stores free-form delegate role names
Given `spec/config.json` has valid configuration
When the developer runs `spec config set delegation.astro.implementer flutter-implementer`
Then cli.ConfigWrite saves `flutter-implementer` (R9)

### S30: An invalid SPEC_HARNESS is unknown to detect
Given the project has a partial claude-code delegation and both `SPEC_HARNESS=custom` and `CLAUDECODE=1` are set
When the developer runs `spec detect --format json`
Then `harness` is null and `missingModels` is empty (R10)

### S31: Detect treats unsupported Claude Code models as missing
Given the current spec stores `claude-sonnet-5-5`, `inherit` or `opus-4` for one Claude Code stage role
And Claude Code is the active harness
When the developer runs `spec detect --format json`
Then `missingModels` includes that role (R7)

### S32: Next treats unsupported Claude Code models as missing
Given TASK-101 is ready for an implementer stage and its stored Claude Code model is `claude-sonnet-5-5`, `inherit` or `opus-4`
When the developer runs `spec next TASK-101 --harness claude-code --format json`
Then the delegate entry's `missingModels` includes implementer and its `model` is null (R7)

### S33: Detect reports the personal edit mode before the shared one
Given `.claude/settings.local.json` has `permissions.defaultMode` "acceptEdits" and `.claude/settings.json` has `permissions.defaultMode` "plan"
When the developer runs `spec detect --format json` through cli.Detect
Then cli.Detection.editMode is "acceptEdits" (R11)
And `spec detect` in text format prints the line "edit mode: acceptEdits"
And neither settings file changes (INV-008)

### S34: Detect falls back to the shared edit mode, then to default
Given `.claude/settings.local.json` does not exist and `.claude/settings.json` has `permissions.defaultMode` "plan"
And no harness environment variable is set and the current directory has no spec
When the developer runs `spec detect --format json` through cli.Detect
Then cli.Detection.editMode is "plan" and cli.Detection.harness is null (R11)
And when neither settings file sets `permissions.defaultMode`, cli.Detection.editMode is "default" (R11)

### S35: A broken settings file sets no edit mode
Given `.claude/settings.local.json` is not valid JSON and `.claude/settings.json` has `permissions.defaultMode` "acceptEdits"
When the developer runs `spec detect --format json` through cli.Detect
Then cli.Detection.editMode is "acceptEdits" and the command exits 0 (R11)
And when `.claude/settings.local.json` has `permissions.defaultMode` 42 or "" and `.claude/settings.json` sets no mode, cli.Detection.editMode is "default" (R11)

### S36: Detect skips manifests under fixture, test and example folders
Given a Git repository has a root `package.json` with vitest in its dev dependencies and a Flutter `pubspec.yaml` under `apps/mobile/`
And it also has "fixtures/dart-mini/pubspec.yaml", "tests/fixtures/py/requirements.txt" and "Examples/go.mod"
And the current directory has no spec
When the developer runs `spec detect --format json` through cli.Detect
Then the cli.DetectedStack.manifest values in cli.Detection.stacks are exactly "apps/mobile/pubspec.yaml" and "package.json" (R12)

### S37: Detect skips manifests the config's test globs match
Given the current directory has a root `package.json` with vitest in its dev dependencies and "e2e/app/package.json"
And `spec/config.json` has testGlobs ["tests/**", "e2e/**"]
When the developer runs `spec detect --format json` through cli.Detect
Then the only cli.DetectedStack.manifest in cli.Detection.stacks is "package.json" (R12)
And when `spec/config.json` is not valid JSON, the command exits 0 and cli.Detection.stacks also has manifest "e2e/app/package.json" (R12)

### S38: Init and upgrade add command rules only for the project's own stacks
Given a Git repository named "shop" has a root `package.json` with vitest in its dev dependencies and "fixtures/dart-mini/pubspec.yaml"
And `.claude/settings.json` has `permissions.allow` ["Bash(go test *)"]
When the user runs `spec init . --name shop --stack node`, or `spec upgrade .` on that repository once its spec is installed
Then `permissions.allow` in `.claude/settings.json` includes "Bash(npx vitest *)" and no rule that starts with "Bash(dart " or "Bash(flutter " (R3, R12)
And "Bash(go test *)" remains in `permissions.allow`

### S39: Config set saves a model list and detect reports the choices
Given `CLAUDECODE=1`, Claude Code 2.1.292 or later, and `spec/config.json` has valid configuration with the claude-code reviewer "opus" alone
When the developer runs `spec config set delegation.claude-code.tester '[{"model":"sonnet","effort":"high"},{"model":"haiku","effort":"high"}]'` through cli.ConfigSet
Then cli.ConfigWrite.value is that list, and cli.Detection.models then gives the tester "sonnet" with "high", the reviewer and spec-review "opus" with null, and spec-writer and implementer null, with no cli.RoleModel.skipped entry (R4, R13)
And a list naming "opus-4", an unknown effort, an empty list, or a list under "astro" is refused and changes no file, with `--force` too (R4, R9)
And `spec config set unavailableModels.sonnet true --local` saves cli.ConfigWrite.value true in config.local.json only; cli.Detection.models then gives the tester "haiku" with sonnet skipped as "marked unavailable", and "false" undoes it (R5, R13)
And without `--local`, with "opus-4", or with a value other than true or false, it is refused and changes no file (R4, R5)

## Rules
- R1: `spec detect` inspects the current directory without resolving or requiring a spec root; empty means no project content beyond Git, README, license, `.gitignore`, `.editorconfig`, `.DS_Store`, `Thumbs.db`, `.claude/`, `.vscode/` or `.idea/`, code means other project content without a spec config.
- R2: A current spec at `spec/config.json` is distinguished from a legacy spec in an old project skill layout when no pinned `.spec/bin/spec.cjs` exists; the pinned CLI keeps a current spec classified as `spec` even if legacy skill files remain. Git dirty includes untracked files; `baseBranch` and harness are omitted or null when unknown.
- R3: Each detected stack reports the defaults used by `spec init --stack`, and `spec init` and `spec upgrade` add stack command rules to `.claude/settings.json` only for detected stacks and the stack given with `--stack`; a Node manifest selects vitest or jest from its package manifest.
- R4: `config set` accepts only name, testCommand, checkCommands, codeGlobs, testGlobs, baseBranch, worktreeSetup, a delegation harness/stage-role model, and unavailableModels.<model> (true or false, for sonnet, opus, haiku or fable); arrays are JSON values and the complete resulting config must pass the config schema. Delegation writes enforce supported harness and model values unless `--force` explicitly permits an unknown harness.
- R5: `--local` accepts delegation and unavailableModels only, the second never without it, and writes config.local.json; shared writes target config.json; local writes ensure config.local.json is listed in spec/.gitignore without removing existing lines.
- R6: A config edit changes only the selected JSON value or appends a missing key, preserving other formatting and key order.
- R7: `detect` and delegate entries from `next` report `missingModels` for every stage role with no valid model under the active harness resolved by the same priority as `next`; Claude Code models outside sonnet, opus, haiku and fable count as missing, and `next` returns null for that role's `model`; they report an empty array when no active harness is known.
- R8: `config set delegation.<harness>.<role>` accepts only `claude-code` or `astro` unless `--force` is supplied. `--force` does not bypass model validation.
- R9: For `claude-code`, `config set` accepts only `sonnet`, `opus`, `haiku` and `fable`; it rejects full model IDs, `inherit` and other values even with `--force`. A value starting with `[` is a JSON list of format.ModelChoice (FMT-015/R8) and every model in it is held to the same four. Other harnesses, including Astro, accept free-form delegate role names.
- R10: `detect` returns a null harness and no missing models unless the resolved harness is `claude-code` or `astro`; an invalid `SPEC_HARNESS` does not fall through to another environment signal.
- R11: `detect` reports `editMode` as the non-empty string `permissions.defaultMode` from `.claude/settings.local.json` in the current directory, else from `.claude/settings.json` there, else "default", whatever the harness and with or without a spec. A missing or unreadable file, invalid JSON, or a mode that is not a non-empty string sets no mode, and the next source is used; user and managed Claude Code settings are not read. Any string is reported as written; text output prints it as `edit mode: <mode>`.
- R12: Stack detection reads manifests in the current directory and the folders below it, but skips every manifest below a folder named `fixtures`, `__fixtures__`, `test`, `tests`, `__tests__`, `testdata`, `example`, `examples`, `sample` or `samples` in any letter case, and every manifest whose path, relative to the current directory, matches a `testGlobs` entry of `spec/config.json` there. A manifest in the current directory itself is always read. A missing, unreadable or invalid `spec/config.json` adds no skipped paths and does not fail `detect`. `spec detect`, the `spec init --stack` defaults and the stack command rules `spec init` and `spec upgrade` add all use this same detection.
- R13: `detect` reports, per stage role, the model and effort `next` would select now under the active harness and why earlier entries were skipped, from the config and, for an effort, the installed Claude Code's version (CLI-007/R19): it asks no model or service and reads no credential. With no active harness (R10) it reports none.

## Out of scope
- Scaffolding a project: the setup skill
- Choosing a harness model: the setup skill
