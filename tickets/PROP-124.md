---
id: PROP-124
type: proposal
title: Installed plugins follow every push, and a project registers the spec marketplace for its contributors
status: absorbed
absorbed_into: PROP-125
stage: null
touches: [INS-014, INS-014/S1, INS-014/S2, INS-014/R1, INS-014/S7, INS-017, INS-003, INS-003/S9, INS-003/S12, install.PluginPackage.marketplace, install.PluginPackage.manifest, install.ClaudeSettings]
violates: []
depends_on: []
changed: []
questions: []
history: []
---
The person wants spec usable as a Claude Code plugin from this repository's marketplace, with people receiving updates automatically when they start a session.

Today three things stop that (checked against the Claude Code plugin docs, code.claude.com/docs/en/plugins/host-marketplace and plugins/org):

1. Version. plugin/.claude-plugin/plugin.json and the marketplace entry both carry version 0.1.0 from package.json (INS-014/S1, S2, R1). Claude Code gives an installed user a new copy only when the computed version changes; with a fixed version, pushed commits never reach them. The docs offer two options: bump version every release, or omit version from both plugin.json and the marketplace entry so users track commits. Decision: omit it from both. plugin.json keeps name and description; the marketplace entry keeps name, source and description. package.json's version and `spec --version` are unchanged. A plugin.json or marketplace entry with a version is what this changes.

2. Marketplace registration. spec init merges `enabledPlugins: {"spec@spec": true}` into .claude/settings.json (INS-003/S9) but registers no marketplace, so a contributor who clones a spec project sees the plugin as not installed. Claude Code registers a marketplace listed in a repository's .claude/settings.json `extraKnownMarketplaces` once the contributor trusts the folder. Init (and upgrade, through the same settings merge) adds `extraKnownMarketplaces.spec` = `{ "source": { "source": "github", "repo": "happyfacedev/spec" } }` when no `spec` key exists there; an existing `spec` entry, whatever it holds, is kept unchanged, and other marketplaces are kept. A settings file whose `extraKnownMarketplaces` is present but not a JSON object is left alone with a note, like enabledPlugins today. Running init again adds nothing (INS-003/S12 then also requires the marketplace entry to be present). No `autoUpdate` key is written: the docs describe it as honoured on managed-settings entries only.

3. Auto-update. Background auto-update is off for third-party marketplaces by default and marketplace.json has no field to turn it on; each user turns it on in /plugin > Marketplaces > spec, or an admin sets autoUpdate in managed settings. The setup skill (plugin/skills/spec/SKILL.md, INS-014/S7) ends by telling the person this one step, and that contributors run `claude plugin install spec@spec --scope project` (or install from /plugin) after trusting the folder. README and docs/WORKFLOW.md install sections say the same.

Must still hold: plugin hooks, skills and the pinned-CLI deferral (INS-014/S3-S8) are unchanged; enabledPlugins behaviour (S9, S14) is unchanged; every other settings key is kept (INS-003/R1).
