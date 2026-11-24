---
id: PROP-125
type: proposal
title: spec installs from the shared happyface marketplace as spec@happyface and follows every push
status: done
stage: null
touches: [INS-014, INS-014/S2, INS-014/R1, INS-014/S7, INS-014/S15, INS-014/S34, INS-014/S35, INS-014/R5, INS-014/R15, INS-017, INS-003, INS-003/S9, INS-003/S12, INS-003/S14, INS-001, INS-013, install.PluginPackage, install.PluginPackage.manifest, install.ClaudeSettings]
violates: []
depends_on: []
changed: [INS-001/S23, INS-003, INS-003/R1, INS-003/R2, INS-003/R6, INS-003/R7, INS-003/S9, INS-003/S12, INS-003/S14, INS-003/S16, INS-003/S22, INS-003/S25, INS-003/S26, INS-003/S27, INS-003/S28, INS-003/S29, INS-013/R3, INS-013/S9, INS-013/S35, INS-014, INS-014/R1, INS-014/R5, INS-014/R15, INS-014/S2, INS-014/S7, INS-014/S14, INS-014/S15, INS-014/S34, INS-014/S35, INS-014/S36, INS-019, INS-019/R1, INS-019/R2, INS-019/S1, INS-019/S2, INS-019/S3, INS-019/S4, INV-018, install.ClaudeSettings, install.ClaudeSettings.enabledPlugins, install.ClaudeSettings.extraKnownMarketplaces, install.KnownMarketplace, install.KnownMarketplace.source, install.MarketplaceSource, install.MarketplaceSource.repo, install.MarketplaceSource.source, install.PluginPackage, install.PluginPackage.manifest, install.PluginPackage.marketplace]
questions: []
history:
  - at: 2026-11-22T09:41:55.562Z
    role: spec-writer
    result: done
    summary: spec@happyface ID with spec@spec migration, happyface marketplace registration, no version, no own marketplace
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-010/S11, PIP-017/S19, INS-017/S2, INS-001/S23, INS-013/S6, INS-013/S17, INS-013/S18, INS-013/S35]
        reason: INS-010/S11 and PIP-017/S19 untouched (hooks and personal settings unchanged); INS-017/S2 unchanged; INS-001/S23 changed with the new ID; INS-013/S6, S17, S18 stay true through the spec@spec fallback, R3 updated and S35 added for the preference
      - item: C2
        outcome: scenarios
        ids: [INS-003/S25, INS-003/S26, INS-003/S27, INS-003/S22, INS-013/S35, INS-014/S34, INS-014/S35]
        reason: upgrade and init from every older settings state (spec@spec true, false, both IDs), a checkout under another folder name, and registries holding the old ID, the new ID or both; projectPath resolution unchanged
      - item: C3
        outcome: na
        ids: []
        reason: "no new state shared across an await or process: the settings merge is one read and one write per command, as before, and the registry is only read"
      - item: C4
        outcome: invariant
        ids: [INV-018]
        reason: committers set extraKnownMarketplaces; Claude Code and the person decide after folder trust; spec only adds a missing happyface key, never redirects one, never writes autoUpdate
      - item: C5
        outcome: scenarios
        ids: [INS-003/S29, INS-003/S13]
        reason: a non-object extraKnownMarketplaces or settings file leaves the file unchanged with a note
      - item: C6
        outcome: scenarios
        ids: [INS-003/S10, INS-003/S11, INS-003/S13, INS-003/S15, INS-003/S16, INS-014/S3, INS-014/S4, INS-014/S5, INS-014/S6, INS-014/S8, INS-010/S11]
        reason: hooks, skills, pinned-CLI deferral and every other settings key are unchanged
      - item: C8
        outcome: scenarios
        ids: [INS-019/S2, INS-014/S2, INS-003/S9]
        reason: "verified 2026-11-22 by the driving session against https://code.claude.com/docs/en/plugins/host-marketplace (Keep users up to date, Release a new version, Turn on auto-update) and https://code.claude.com/docs/en/plugins/org (Require plugins per repository, Set update policy): versionless plugins follow the git commit, extraKnownMarketplaces registers after trust, auto-update is off for third-party marketplaces unless the person or managed autoUpdate turns it on, install ID is <plugin>@<marketplace name>"
    assumed:
      - new: When enabledPlugins holds both spec@spec and spec@happyface, what happens?
        value: spec@happyface keeps its value and spec@spec is removed (INS-003/S27, R7)
      - new: What does spec@spec's value become when it is not a boolean?
        value: it moves to spec@happyface unchanged; Claude Code interprets it (INS-003/R7)
      - new: Note text for a non-object extraKnownMarketplaces
        value: .claude/settings.json extraKnownMarketplaces is not an object; add the happyface marketplace by hand (INS-003/S29)
      - new: How is the spec@spec migration reported?
        value: as the usual written entry for .claude/settings.json; no new install.Installation.updated text is pinned
      - new: Where does behaviour that does not fit INS-014's line budget go?
        value: new feature INS-019 (no own marketplace, install instructions); INS-019 and the changed INS-001/S23 and INS-013 are outside the ticket's touches, impact reports INS-019 as a scope gap
    duration_s: 431
    model: claude
  - at: 2026-11-22T09:46:49.317Z
    role: spec-review
    result: done
    summary: Approved marketplace migration spec; no blocking gaps found
    verdict: approve
    assumed: []
    duration_s: 221
    model: codex
  - at: 2026-11-22T10:04:04.117Z
    role: tester
    result: done
    summary: spec@happyface migration, happyface marketplace, versionless manifest, no own marketplace and install docs tested
    verdict: null
    mutations:
      - scenario: INS-001/S23
        wrong: init enables both spec@spec and spec@happyface
      - scenario: INS-003/S9
        wrong: init writes the happyface marketplace with autoUpdate true, or keeps enabling spec@spec
      - scenario: INS-003/S12
        wrong: a second init rewrites extraKnownMarketplaces.happyface and reports settings as written
      - scenario: INS-003/S14
        wrong: spec@happyface false is flipped to true, or spec@spec true is added beside it
      - scenario: INS-003/S16
        wrong: upgrade adds spec@spec true next to an existing spec@happyface false
      - scenario: INS-003/S22
        wrong: upgrade re-serialises or re-adds the happyface entry on a checkout that already has it
      - scenario: INS-003/S25
        wrong: spec@spec true is kept and spec@happyface true added beside it, or tools@team is dropped
      - scenario: INS-003/S26
        wrong: spec@spec false is removed and spec@happyface set to true
      - scenario: INS-003/S27
        wrong: the old spec@spec true overwrites an existing spec@happyface false
      - scenario: INS-003/S28
        wrong: an existing happyface entry is replaced by the canonical happyfacedev/happyface-plugins source
      - scenario: INS-003/S29
        wrong: a non-object extraKnownMarketplaces is replaced by an object holding happyface
      - scenario: INS-013/S9
        wrong: old-layout upgrade still enables spec@spec
      - scenario: INS-013/S35
        wrong: spec@happyface and spec@spec entries are pooled and the newest lastUpdated wins, or spec@spec is ignored whenever a spec@happyface key exists
      - scenario: INS-014/S2
        wrong: build still writes package.json's version into plugin.json
      - scenario: INS-014/S7
        wrong: setup skill still reads plugins["spec@spec"] only, with no spec@happyface preference
      - scenario: INS-014/S14
        wrong: build --out still writes .claude-plugin/marketplace.json
      - scenario: INS-014/S15
        wrong: this repository's settings keep spec@spec false and lack spec@happyface false
      - scenario: INS-014/S34
        wrong: the registry selector reads only spec@spec records
      - scenario: INS-014/S35
        wrong: the registry selector reads only spec@spec records, so a matching spec@happyface project record is ignored
      - scenario: INS-014/S36
        wrong: setup tells Astro it uses the Claude Code registry
      - scenario: INS-019/S1
        wrong: .claude-plugin/marketplace.json is still committed or built
      - scenario: INS-019/S2
        wrong: README and WORKFLOW still say /plugin marketplace add https://github.com/happyfacedev/spec and /plugin install spec@spec
    assumed:
      - new: How literally must the docs name the auto-update step?
        value: each of setup skill, README.md and docs/WORKFLOW.md contains 'auto-update', 'Marketplaces > happyface', 'autoUpdate' and 'managed settings'
      - new: How is the S7 spec@spec fallback recognised in the setup skill?
        value: it contains plugins["spec@happyface"] and one line matching spec@spec ... when no ... spec@happyface ... eligible; docs/WORKFLOW.md mentions spec@happyface and drops 'keeps `spec@spec` entries scoped to the user'
      - new: INS-003/S16 fixture used spec@spec false, which now migrates
        value: "the fixture holds spec@happyface false and the test asserts enabledPlugins stays exactly { spec@happyface: false }"
      - new: What shows 'having written every other file' in INS-003/S29?
        value: written lists spec/config.json and no .claude/settings.json entry, and .claude/settings.local.json exists
      - new: How is 'does not change any tracked file' in INS-014/S14 checked?
        value: git status --porcelain --untracked-files=no plus git diff are equal before and after the --out build
    duration_s: 1030
    model: claude
  - at: 2026-11-22T10:12:49.974Z
    role: implementer
    result: blocked
    summary: spec@happyface migration, happyface marketplace, versionless plugin, no own marketplace, docs; dist test ENOBUFS
    verdict: null
    blockers:
      - text: tests/dist.test.ts trackedState runs execFileSync('git', ['diff']) with the default 1 MB maxBuffer; with the rebuilt minified plugin/scripts/spec.cjs and .spec/bin/spec.cjs uncommitted, git diff exceeds it, beforeAll throws spawnSync git ENOBUFS and all 46 dist tests are skipped (exit 1). The test needs a larger maxBuffer (or a diff that leaves out the bundles). With maxBuffer raised in a scratch copy, the S14, S2, S7, S15, S36, INS-019/S1 and S2 assertions all pass
        cites: [INS-014/S14]
        tests: true
    assumed:
      - new: How is the committed .claude-plugin/marketplace.json removed when shell deletes are not allowed?
        value: the in-place build (not --out) removes the stale .claude-plugin folder, so the rebuild deleted it and later builds keep it gone (INS-019/R1)
      - new: Where is a migrated spec@spec key placed in enabledPlugins?
        value: spec@happyface takes spec@spec's position; every other key keeps its order
      - new: Does this repository's own .claude/settings.json get extraKnownMarketplaces.happyface?
        value: no; only enabledPlugins spec@spec false becomes spec@happyface false (INS-014/S15)
    duration_s: 521
    model: claude
  - at: 2026-11-22T10:26:13.633Z
    role: tester
    result: done
    summary: INS-014/S14 tracked-file check uses status plus content hashes, not a full git diff; no ENOBUFS, all tests pass
    verdict: null
    mutations:
      - scenario: INS-014/S14
        wrong: build --out rewrites a tracked plugin file, such as plugin/scripts/spec.cjs, with different bytes
    passed: true
    assumed:
      - new: How is 'does not change any tracked file' in INS-014/S14 checked without a full diff?
        value: git status --porcelain --untracked-files=no plus the names and git hash-object hashes of modified tracked files are equal before and after the --out build
    duration_s: 789
    model: claude
  - at: 2026-11-22T10:30:39.846Z
    role: reviewer
    result: done
    summary: Marketplace migration meets the checklist, but in-place build deletes the entire marketplace directory
    verdict: changes
    findings:
      - cites: [INS-019/R1]
        text: scripts/build.ts removes all of .claude-plugin on every in-place build, which can delete unrelated files beyond the marketplace.json that INS-019/R1 retires. Remove only marketplace.json (optionally remove the directory only when empty).
        spec: true
        class: C6
    assumed:
      - new: Is removing the entire .claude-plugin directory on each in-place build acceptable?
        value: No; remove only the stale marketplace.json (and optionally the directory only if empty), preserving any unrelated contents.
    duration_s: 259
    model: codex
  - at: 2026-11-22T10:32:19.370Z
    role: spec-writer
    result: done
    summary: "INS-019/R1 and new S3: in-place build removes only stale marketplace.json, and .claude-plugin only when empty"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-010/S11, PIP-017/S19, INS-017/S2, INS-001/S23, INS-013/S6, INS-013/S17, INS-013/S18, INS-013/S35, INS-014/S14]
        reason: this round only narrows what the in-place build removes; neighbours are unchanged from the approved spec, and INS-014/S14 (build --out changes no tracked file) still holds
      - item: C2
        outcome: scenarios
        ids: [INS-019/S3, INS-003/S25, INS-003/S26, INS-003/S27, INS-013/S35]
        reason: an older checkout that still has .claude-plugin/marketplace.json, with or without other files beside it, plus the settings and registry upgrade states from the earlier round
      - item: C3
        outcome: na
        ids: []
        reason: "no new shared state: the build removes one file and possibly an empty folder in one run"
      - item: C4
        outcome: invariant
        ids: [INV-018]
        reason: no new input crosses a trust boundary; extraKnownMarketplaces is covered by INV-018
      - item: C5
        outcome: scenarios
        ids: [INS-019/S3, INS-003/S29, INS-003/S13]
        reason: a file in .claude-plugin the build does not know is kept, not deleted; non-object settings are left unchanged with a note
      - item: C6
        outcome: scenarios
        ids: [INS-019/S3, INS-014/S3, INS-014/S4, INS-014/S5, INS-014/S6, INS-014/S8, INS-014/S14, INS-003/S10, INS-003/S11]
        reason: other files under .claude-plugin keep their bytes; hooks, skills, pinned-CLI deferral and other settings keys are unchanged
      - item: C8
        outcome: scenarios
        ids: [INS-019/S2, INS-014/S2, INS-003/S9]
        reason: verified 2026-11-22 by the driving session against https://code.claude.com/docs/en/plugins/host-marketplace (Keep users up to date, Release a new version, Turn on auto-update) and https://code.claude.com/docs/en/plugins/org (Require plugins per repository, Set update policy); this round adds no external fact
    assumed:
      - new: What does a build with --out do about the repository's .claude-plugin?
        value: "nothing: only the in-place build removes the stale file, and --out changes no tracked file (INS-014/S14)"
    duration_s: 95
    model: claude
  - at: 2026-11-22T10:33:03.993Z
    role: spec-review
    result: done
    summary: S3 combines incompatible Given states for the non-empty and empty folder cases
    verdict: changes
    findings:
      - cites: [INS-019/S3]
        text: The scenario's Given requires .claude-plugin/notes.md beside marketplace.json, but its final assertion says marketplace.json was the only file in the folder. Those states cannot both hold in one run; separate the empty-folder case into its own scenario or make the cases independently executable.
        class: C9
    assumed: []
    duration_s: 40
    model: codex
  - at: 2026-11-22T10:34:20.086Z
    role: spec-writer
    result: done
    summary: "Split INS-019/S3: S3 keeps other files and the folder, new S4 removes a .claude-plugin folder left empty"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-010/S11, PIP-017/S19, INS-017/S2, INS-001/S23, INS-013/S6, INS-013/S17, INS-013/S18, INS-013/S35, INS-014/S14]
        reason: this round only splits one scenario; neighbours are unchanged, and INS-014/S14 (build --out changes no tracked file) still holds
      - item: C2
        outcome: scenarios
        ids: [INS-019/S3, INS-019/S4, INS-003/S25, INS-003/S26, INS-003/S27, INS-013/S35]
        reason: an older checkout with a stale .claude-plugin/marketplace.json, with other files beside it (S3) or alone (S4), plus the settings and registry upgrade states
      - item: C3
        outcome: na
        ids: []
        reason: "no new shared state: the build removes one file and possibly an empty folder in one run"
      - item: C4
        outcome: invariant
        ids: [INV-018]
        reason: no new input crosses a trust boundary; extraKnownMarketplaces is covered by INV-018
      - item: C5
        outcome: scenarios
        ids: [INS-019/S3, INS-003/S29, INS-003/S13]
        reason: a file in .claude-plugin the build does not know is kept, and so is its folder; non-object settings are left unchanged with a note
      - item: C6
        outcome: scenarios
        ids: [INS-019/S3, INS-014/S3, INS-014/S4, INS-014/S5, INS-014/S6, INS-014/S8, INS-014/S14, INS-003/S10, INS-003/S11]
        reason: other files under .claude-plugin keep their bytes; hooks, skills, pinned-CLI deferral and other settings keys are unchanged
      - item: C8
        outcome: scenarios
        ids: [INS-019/S2, INS-014/S2, INS-003/S9]
        reason: verified 2026-11-22 by the driving session against https://code.claude.com/docs/en/plugins/host-marketplace (Keep users up to date, Release a new version, Turn on auto-update) and https://code.claude.com/docs/en/plugins/org (Require plugins per repository, Set update policy); this round adds no external fact
    documents: [INS-019/S4]
    assumed:
      - new: What does a build with --out do about the repository's .claude-plugin?
        value: "nothing: only the in-place build removes the stale file, and --out changes no tracked file (INS-014/S14)"
      - new: Is INS-019/S4 already true of the worktree's build?
        value: "yes: the worktree build removes the whole .claude-plugin folder in place (scripts/build.ts:75), which leaves S4's state with no folder; checked by reading the build script, not by running an in-place build, which would rewrite tracked files"
    duration_s: 71
    model: claude
  - at: 2026-11-22T10:34:57.227Z
    role: spec-review
    result: done
    summary: Approved the split stale-marketplace cleanup scenarios
    verdict: approve
    assumed: []
    duration_s: 32
    model: codex
  - at: 2026-11-22T10:49:57.378Z
    role: tester
    result: done
    summary: INS-019/S3 and S4 run an in-place build in a temp copy; S3 fails (folder and notes.md deleted), S4 passes
    verdict: null
    mutations:
      - scenario: INS-001/S23
        wrong: init enables both spec@spec and spec@happyface
      - scenario: INS-003/S9
        wrong: init writes the happyface marketplace with autoUpdate true, or keeps enabling spec@spec
      - scenario: INS-003/S12
        wrong: a second init rewrites extraKnownMarketplaces.happyface and reports settings as written
      - scenario: INS-003/S14
        wrong: spec@happyface false is flipped to true, or spec@spec true is added beside it
      - scenario: INS-003/S22
        wrong: upgrade re-serialises or re-adds the happyface entry on a checkout that already has it
      - scenario: INS-003/S25
        wrong: spec@spec true is kept and spec@happyface true added beside it, or tools@team is dropped
      - scenario: INS-003/S26
        wrong: spec@spec false is removed and spec@happyface set to true
      - scenario: INS-003/S27
        wrong: the old spec@spec true overwrites an existing spec@happyface false
      - scenario: INS-003/S28
        wrong: an existing happyface entry is replaced by the canonical happyfacedev/happyface-plugins source
      - scenario: INS-003/S29
        wrong: a non-object extraKnownMarketplaces is replaced by an object holding happyface
      - scenario: INS-013/S35
        wrong: spec@happyface and spec@spec entries are pooled and the newest lastUpdated wins, or spec@spec is ignored whenever a spec@happyface key exists
      - scenario: INS-014/S2
        wrong: build still writes package.json's version into plugin.json
      - scenario: INS-014/S7
        wrong: setup skill still reads plugins["spec@spec"] only, with no spec@happyface preference
      - scenario: INS-014/S14
        wrong: build --out rewrites a tracked plugin file, or still writes .claude-plugin/marketplace.json
      - scenario: INS-014/S15
        wrong: this repository's settings keep spec@spec false and lack spec@happyface false
      - scenario: INS-014/S34
        wrong: the registry selector reads only spec@spec records
      - scenario: INS-014/S35
        wrong: the registry selector reads only spec@spec records, so a matching spec@happyface project record is ignored
      - scenario: INS-014/S36
        wrong: setup tells Astro it uses the Claude Code registry
      - scenario: INS-019/S1
        wrong: .claude-plugin/marketplace.json is still committed or built
      - scenario: INS-019/S2
        wrong: README and WORKFLOW still say /plugin marketplace add https://github.com/happyfacedev/spec and /plugin install spec@spec
      - scenario: INS-019/S3
        wrong: the in-place build removes the whole .claude-plugin folder, deleting notes.md with marketplace.json
      - scenario: INS-019/S4
        wrong: the in-place build removes marketplace.json but leaves the empty .claude-plugin folder behind
    assumed:
      - new: How is 'the repository is built in place' run without rewriting the worktree?
        value: package.json, scripts, src, templates, roles, plugin and docs are copied to a temp folder with node_modules symlinked, and scripts/build.ts runs there without --out; the build scripts resolve every path from the copy
    duration_s: 895
    model: claude
  - at: 2026-11-22T10:57:38.945Z
    role: implementer
    result: done
    summary: In-place build removes only a stale .claude-plugin/marketplace.json, and the folder only when left empty
    verdict: null
    assumed:
      - new: What does an in-place build do when there is no .claude-plugin folder at all?
        value: nothing; removing the missing file is a no-op and the emptiness check is skipped
    duration_s: 457
    model: claude
  - at: 2026-11-22T11:28:46.905Z
    role: reviewer
    result: done
    summary: In-place build preserves unrelated marketplace-folder contents and removes the folder only when empty
    verdict: approve
    assumed: []
    duration_s: 1863
    model: codex
---
The person wants one marketplace that happyface owns, listing every happyface plugin (spec, the Flutter skills, /decide, more later), so people add it once and receive updates automatically when a session starts. That marketplace is a separate repository, happyfacedev/happyface-plugins, marketplace name "happyface", owner "happyface". It lists spec as a git-subdir source: url happyfacedev/spec, path plugin. This replaces PROP-124, which registered spec's own marketplace.

Claude Code facts, verified 2026-11-22 against code.claude.com/docs/en/plugins/host-marketplace (Keep users up to date, Release a new version, Turn on auto-update) and code.claude.com/docs/en/plugins/org (Require plugins per repository, Set update policy): an installed user gets a new copy only when the plugin's computed version changes; with no version in plugin.json or the marketplace entry, the version follows the git commit. A repository's .claude/settings.json `extraKnownMarketplaces` registers a marketplace once the person trusts the folder. Background auto-update is off for third-party marketplaces by default and only the person (/plugin > Marketplaces) or managed settings (autoUpdate) turn it on. The install ID is <plugin>@<marketplace name>.

What changes:

1. Plugin ID. spec's plugin ID becomes spec@happyface. The old ID spec@spec is still recognised during the transition.
   - init and upgrade enable spec@happyface (true) in .claude/settings.json `enabledPlugins` when neither spec@happyface nor spec@spec is there.
   - An existing spec@spec: true is replaced by spec@happyface: true (migration); every other enabledPlugins key is kept.
   - An explicit false for either ID means disabled and stays so: spec@spec: false becomes spec@happyface: false, and a spec@happyface: false is never changed (INS-003/S14 keeps its meaning).
   - This repository's own .claude/settings.json keeps the plugin disabled for itself so plugin hooks do not run twice beside its project hooks (INS-014/S15): it holds spec@happyface: false.
   - Setup's and upgrade's plugin registry selector (INS-014/S7, S34, S35, R5, R15) reads installed_plugins.json entries for spec@happyface, falling back to spec@spec when there is no eligible spec@happyface entry; scope and lastUpdated ordering are unchanged.
2. Marketplace registration. init and upgrade add `extraKnownMarketplaces.happyface` = { "source": { "source": "github", "repo": "happyfacedev/happyface-plugins" } } when no `happyface` key exists; an existing `happyface` entry, whatever it holds, and every other marketplace are kept. A present but non-object `extraKnownMarketplaces` leaves the settings file unchanged with a note, as a non-object enabledPlugins does today. No `autoUpdate` key is written. A second run adds nothing (INS-003/S12).
3. No version. plugin/.claude-plugin/plugin.json has name and description and no version. package.json's version and `spec --version` are unchanged.
4. This repository no longer publishes a marketplace: the build stops writing .claude-plugin/marketplace.json and the file is removed, so spec is listed only in the happyface marketplace and cannot be installed twice under two IDs.
5. Instructions. The setup skill, README.md and docs/WORKFLOW.md say: add the marketplace with `/plugin marketplace add happyfacedev/happyface-plugins`, install with `/plugin install spec@happyface` (or `claude plugin install spec@happyface --scope project` after trusting a project that registers it), turn on auto-update once under /plugin > Marketplaces > happyface (or ask an admin to set autoUpdate in managed settings), and for these private repositories store git credentials (`gh auth login`, `gh auth setup-git`).

Must still hold: plugin hooks, skills and the pinned-CLI deferral (INS-014/S3-S6, S8) are unchanged; every other settings key is kept (INS-003/R1).
