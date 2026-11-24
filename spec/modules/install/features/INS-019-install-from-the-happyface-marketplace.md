---
id: INS-019
title: Install spec from the happyface marketplace
module: install
status: active
writes: [install.PluginPackage]
---
## Intent
One marketplace, happyface, lists every happyface plugin, spec among them as `spec@happyface`, so a person adds it once and gets each new version when a session starts. This repository publishes no marketplace of its own, so spec can never be installed twice under two IDs. Claude Code gives an installed plugin a new copy only when its computed version changes, and with no version in the plugin's manifest that version follows the git commit (INS-014/R1); it turns on background auto-update for a third-party marketplace only when the person does so or managed settings set `autoUpdate`.

## Behaviour
### S1: This repository publishes no marketplace
Given the repository is built
When a person looks for a marketplace in this repository or in the build output
Then there is no .claude-plugin/marketplace.json in either, and install.PluginPackage.manifest is the only plugin manifest the build writes (R1)

### S2: Setup and the docs say how to install and keep spec up to date
Given the setup skill template, README.md and docs/WORKFLOW.md
When the repository is built
Then install.PluginPackage.skills has plugin/skills/spec/SKILL.md, and it, README.md and docs/WORKFLOW.md each say to add the marketplace with `/plugin marketplace add happyfacedev/happyface-plugins` and to install with `/plugin install spec@happyface`, or with `claude plugin install spec@happyface --scope project` after trusting a project that registers the marketplace (R2)
And each says to turn on auto-update once under /plugin > Marketplaces > happyface, or to ask an admin to set `autoUpdate` in managed settings (R2)
And none of them tells the person to add `happyfacedev/spec` as a marketplace or to install `spec@spec` (R2)

### S3: The in-place build removes only the stale marketplace file
Given the repository has a stale .claude-plugin/marketplace.json and another file ".claude-plugin/notes.md" beside it
When the repository is built in place
Then .claude-plugin/marketplace.json is gone, and ".claude-plugin/notes.md" is still there with the same bytes (R1)
And the .claude-plugin folder is still there (R1)

### S4: The in-place build removes a marketplace folder it leaves empty
Given the repository has a stale .claude-plugin/marketplace.json and no other file or folder in .claude-plugin
When the repository is built in place
Then .claude-plugin/marketplace.json is gone and the .claude-plugin folder is gone too (R1)

## Rules
- R1: The build writes no .claude-plugin/marketplace.json and the repository holds none; spec is listed only by the happyface marketplace. An in-place build removes a stale .claude-plugin/marketplace.json and nothing else in .claude-plugin: it removes the folder only when that leaves it empty, and keeps every other file in it.
- R2: The setup skill, README.md and docs/WORKFLOW.md give the happyface marketplace add and install commands, the project-scope install after trust, and the one-time auto-update step (or managed `autoUpdate`); they name no other marketplace or plugin ID for spec.

## Out of scope
- The happyface marketplace repository and how it lists spec: that repository is maintained outside this one
- Turning on auto-update: the person or an admin does that in Claude Code
