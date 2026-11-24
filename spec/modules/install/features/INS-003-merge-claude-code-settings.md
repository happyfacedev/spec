---
id: INS-003
title: Merge Claude Code permissions and plugin enablement
module: install
status: active
writes: [install.ClaudeSettings, install.LocalClaudeSettings]
retired: [S1, S2, S3, S4, S5, S6, S7, S8]
invariants: [INV-018]
---
## Intent
The plugin supplies its hooks and skills. Init and upgrade enable the plugin as `spec@happyface`, register the happyface marketplace for the project's contributors, and grant the project-local CLI and brief skill permission, while keeping every setting already owned by the repository. A project set up under the old ID `spec@spec` moves to the new one with its enabled or disabled state.

## Behaviour
### S9: The CLI and brief skill are allowed
Given an empty folder "repo"
When the user runs `spec init repo --name shop` through install.Init
Then install.Permissions.allow is ["Bash(.spec/bin/spec *)", "Bash(./.spec/bin/spec *)", "Skill(spec:brief)", "Skill"] (R2)
And install.ClaudeSettings.enabledPlugins is `{ "spec@happyface": true }` (R2)
And install.ClaudeSettings.extraKnownMarketplaces is `{ "happyface": { "source": { "source": "github", "repo": "happyfacedev/happyface-plugins" } } }`, and no `autoUpdate` key is written anywhere in the file (R6, INV-018)

### S10: Plugin hooks are not copied into settings
Given an empty folder "repo"
When the user runs `spec init repo --name shop` through install.Init
Then install.ClaudeSettings has no `hooks` key

### S11: Existing settings and hooks are kept
Given "repo/.claude/settings.json" is `{ "model": "opus", "permissions": { "allow": ["Bash(npm test)"], "deny": ["Bash(rm *)"] }, "hooks": { "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "echo mine" }] }] } }`
When the user runs `spec init repo --name shop` through install.Init
Then "model" and "permissions.deny" are unchanged (R1)
And "Bash(npm test)" and the existing "echo mine" hook remain
And the four spec permission rules, including bare `Skill`, are appended once

### S12: Nothing is added twice
Given `.claude/settings.json` already has the spec permission rules, `enabledPlugins` contains `"spec@happyface": true` and `extraKnownMarketplaces` has a `happyface` entry
When the user runs `spec init repo --name shop` again through install.Init
Then `.claude/settings.json` is unchanged
And install.Installation.skipped holds ".claude/settings.json (spec permissions and plugin state already present)" (R2)

### S13: A settings file that is not a JSON object is left alone
Given "repo/.claude/settings.json" is `[1]`
When the user runs `spec init repo --name shop --format json` through install.Init
Then `.claude/settings.json` is unchanged
And install.Installation.notes holds ".claude/settings.json is not a JSON object; add the spec permissions and enabledPlugins entry by hand"
And the command exits 0, having written every other file

### S14: An explicitly disabled plugin stays disabled
Given `.claude/settings.json` has `enabledPlugins` `{ "spec@happyface": false }`
When the user runs `spec init repo --name shop` through install.Init
Then `enabledPlugins["spec@happyface"]` remains false and no `spec@spec` key is added (R1, R7)
And the new project CLI permission rules are still added

### S15: Init grants worktree and detected stack access
Given a git repository named "shop" uses vitest and has existing Claude settings
When the user runs `spec init . --name shop --stack node` through install.Init
Then install.LocalClaudeSettings.permissions has `additionalDirectories` including "../shop.worktrees" (R5)
And `.claude/settings.json` has no `permissions.additionalDirectories`
And `.claude/settings.json` `permissions.allow` includes "Skill" and "Bash(npx vitest *)"
And the root `.gitignore` includes `.claude/settings.local.json`
And every existing setting and permission remains unchanged (R3)

### S16: Upgrade merges access for the current stack
Given a git repository named "shop" uses pytest and has existing Claude settings with `permissions.defaultMode` "default"
When the user runs `spec upgrade .`
Then `.claude/settings.local.json` `permissions.additionalDirectories` includes "../shop.worktrees" (R5)
And `.claude/settings.json` `permissions.allow` includes "Skill" and "Bash(pytest *)"
And existing `permissions.allow`, `permissions.deny`, `permissions.defaultMode` and plugin settings are preserved (R3)

### S22: A checkout under another folder name leaves the committed settings unchanged
Given a clean git checkout in a folder named "shop-2" whose committed `.claude/settings.json` already has every spec permission rule, `enabledPlugins` `{ "spec@happyface": true }`, the `happyface` entry in `extraKnownMarketplaces` and `permissions.additionalDirectories` ["../shop.worktrees"]
When the user runs `spec upgrade .`, and then `spec init . --name shop`
Then `.claude/settings.json` is unchanged, still holding "../shop.worktrees", and `git status` lists no change to it (R1, R5)
And `.claude/settings.local.json` `permissions.additionalDirectories` is ["../shop-2.worktrees"]

### S23: Existing personal settings are kept
Given `.claude/settings.local.json` is `{ "model": "haiku", "permissions": { "defaultMode": "plan", "allow": ["Bash(make *)"], "additionalDirectories": ["../shared"] } }`
When the user runs `spec init . --name shop` twice in a git repository named "shop"
Then `.claude/settings.local.json` keeps "model", `permissions.defaultMode` "plan", "Bash(make *)" and "../shared"
And its `permissions.additionalDirectories` holds "../shop.worktrees" once (R5)

### S24: A personal settings file that is not a JSON object is left alone
Given ".claude/settings.local.json" is `[1]` in a git repository named "shop"
When the user runs `spec init . --name shop --format json` through install.Init
Then `.claude/settings.local.json` is unchanged
And install.Installation.notes holds ".claude/settings.local.json is not a JSON object; add ''../shop.worktrees'' to permissions.additionalDirectories by hand" (R5)
And the command exits 0, having written every other file

### S17: Init enables background edit tools only in personal settings
Given `.claude/settings.json` has existing settings and permission rules
When the user runs `spec init . --name shop --accept-edits`
Then `.claude/settings.local.json` has `permissions.defaultMode` "acceptEdits"
And `.claude/settings.json` has no new `permissions.defaultMode`
And the root `.gitignore` includes `.claude/settings.local.json` without losing existing lines
And every unrelated setting, allow rule and deny rule is preserved, and no bare `Edit` or `Write` rule is added (R4)

### S18: Init without opt-in does not add a personal default mode
Given `.claude/settings.json` has permissions but neither settings file has `defaultMode`
When the user runs `spec init . --name shop`
Then `.claude/settings.local.json` has no `permissions.defaultMode` (R4)

### S19: Init without opt-in preserves an existing default mode
Given `.claude/settings.json` has `permissions.defaultMode` "default"
When the user runs `spec init . --name shop`
Then `.claude/settings.json` keeps `permissions.defaultMode` "default" (R4)

### S20: Opt-in keeps and reports a conflicting shared mode
Given `.claude/settings.json` has `permissions.defaultMode` "plan"
When the user runs `spec init . --name shop --accept-edits`
Then `.claude/settings.json` keeps `permissions.defaultMode` "plan"
And the command reports the conflict and asks the user to resolve it before opting in (R4)

### S21: Opt-in keeps and reports a conflicting personal mode
Given `.claude/settings.local.json` has `permissions.defaultMode` "plan"
When the user runs `spec init . --name shop --accept-edits`
Then `.claude/settings.local.json` keeps `permissions.defaultMode` "plan"
And the command reports the conflict and asks the user to resolve it before opting in (R4)

### S25: An older project's plugin ID moves to spec@happyface
Given `.claude/settings.json` has `enabledPlugins` `{ "spec@spec": true, "tools@team": false }` and no `extraKnownMarketplaces`
When the user runs `spec upgrade .`, or `spec init . --name shop`
Then install.ClaudeSettings.enabledPlugins has `"spec@happyface": true` and `"tools@team": false`, and no `spec@spec` key (R7)
And install.ClaudeSettings.extraKnownMarketplaces has the `happyface` entry of S9 (R6)
And running the same command again leaves `.claude/settings.json` unchanged (R2)

### S26: A project that disabled the old ID stays disabled
Given `.claude/settings.json` has `enabledPlugins` `{ "spec@spec": false }`
When the user runs `spec upgrade .`, or `spec init . --name shop`
Then install.ClaudeSettings.enabledPlugins is `{ "spec@happyface": false }` (R7)

### S27: The new ID's value wins over a leftover old ID
Given `.claude/settings.json` has `enabledPlugins` `{ "spec@spec": true, "spec@happyface": false }`
When the user runs `spec upgrade .`, or `spec init . --name shop`
Then install.ClaudeSettings.enabledPlugins is `{ "spec@happyface": false }` (R7)

### S28: Marketplaces already registered are kept
Given `.claude/settings.json` has `extraKnownMarketplaces` `{ "happyface": { "source": { "source": "github", "repo": "someone/fork" } }, "team": { "source": { "source": "git", "url": "https://example.com/team.git" } } }`
When the user runs `spec init . --name shop`, or `spec upgrade .`
Then install.ClaudeSettings.extraKnownMarketplaces still holds exactly those two entries, unchanged (R6, INV-018)
And no `autoUpdate` key is written anywhere in the file (INV-018)

### S29: A marketplace list that is not a JSON object is left alone
Given ".claude/settings.json" is `{ "extraKnownMarketplaces": ["happyface"] }`
When the user runs `spec init . --name shop --format json` through install.Init
Then `.claude/settings.json` is unchanged
And install.Installation.notes holds ".claude/settings.json extraKnownMarketplaces is not an object; add the happyface marketplace by hand" (R6)
And the command exits 0, having written every other file

## Rules
- R1: Init keeps every existing settings key, including hooks it does not own; the one key it moves is `enabledPlugins["spec@spec"]` (R7)
- R2: Permission rules are added only when missing, and `spec@happyface` is enabled (true) only when `enabledPlugins` holds neither `spec@happyface` nor `spec@spec`; a second run with nothing missing leaves the file unchanged
- R6: Init and upgrade add `extraKnownMarketplaces.happyface` as `{ "source": { "source": "github", "repo": "happyfacedev/happyface-plugins" } }` only when no `happyface` key exists; an existing `happyface` entry, whatever it holds, and every other marketplace are kept, and no `autoUpdate` key is written. A present `extraKnownMarketplaces` that is not a JSON object leaves the settings file unchanged with a note, and the command still exits 0.
- R7: When `enabledPlugins` holds `spec@spec`, init and upgrade remove it; its value becomes `spec@happyface`'s only when `spec@happyface` is absent, and an existing `spec@happyface` value is never changed. So an explicit false under either ID stays false, and every other `enabledPlugins` key is kept.
- R3: Init and upgrade add the bare `Skill` rule and detected stack test/build command rules to `.claude/settings.json`, and the actual ticket worktree parent as R5 says, without removing existing settings
- R5: Init and upgrade add the actual ticket worktree parent, relative to this checkout, only to `permissions.additionalDirectories` in the personal `.claude/settings.local.json`, once, and make the root `.gitignore` ignore that file. They never add it to, or remove it from, `.claude/settings.json`, so a checkout under any folder name leaves the committed settings unchanged when nothing else is missing. Every other personal setting is kept. A personal settings file that is not a JSON object is left unchanged with a note, and the command still exits 0.
- R4: Init writes `permissions.defaultMode: "acceptEdits"` only to `.claude/settings.local.json` when the user supplies `--accept-edits`, and ignores that file; it refuses to overwrite a different mode in either settings file, reports the conflict, preserves all other settings and never adds bare `Edit` or `Write` allow rules

## Out of scope
- Removing spec's permissions or plugin enablement
- Registering or removing hooks: the plugin owns its hooks
- Turning on marketplace auto-update: the person does that in Claude Code, or an admin in managed settings
