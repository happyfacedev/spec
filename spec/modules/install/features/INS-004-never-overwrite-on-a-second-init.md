---
id: INS-004
title: Never overwrite on a second init
module: install
status: active
retired: [S4, S5]
questions:
  - id: Q1
    kind: preference
    text: "On a second init the text output reads \"skipped .claude/settings.json (spec already enabled)\": should the settings line carry only this specific skip reason?"
    default: Keep only the specific settings skip reason
    cites: [INS-004/S3]
    answer: 'Init reports the settings skip reason without the generic "(exists)" suffix.'
    raised_by: null
---
## Intent
Init may be run again on a repository that already has spec, for example after a person deleted a file. It must never lose a person's edits, so it writes only what is missing and says what it left alone. It no longer writes compiled agent files.

## Behaviour
### S1: Existing files are skipped, not overwritten
Given spec is installed in "repo" as "shop"
And a person appended "Edited by a person." to `spec/core/overview.md`
When the user runs `spec init repo --name shop --format json` through install.Init
Then `spec/core/overview.md` still holds "Edited by a person." (R1)
And install.Installation.skipped holds "spec/core/overview.md"

### S2: Only generated files are written again
Given spec is installed in "repo" as "shop"
When the user runs `spec init repo --name shop --format json` through install.Init
Then install.Installation.written holds no path other than `spec/_generated/graph.json` and `spec/index.md` (R1)

### S3: Text output names each skip
Given spec is installed in "repo" as "shop"
When the user runs `spec init repo --name shop` through install.Init
Then stdout has a line `skipped <path> (exists)` for each existing file except `.claude/settings.json`, such as "skipped spec/core/overview.md (exists)"
And the settings line is "skipped .claude/settings.json (spec already enabled)"
And it exits 0

### S6: A build failure is a note
Given "repo" has a `spec/` whose files do not build
When the user runs `spec init repo --name shop --format json` through install.Init
Then install.Installation.notes holds a line starting "spec build failed: "
And the command exits 0

### S7: A missing compiled agent is not written back
Given spec is installed in "repo" as "shop" and `.claude/agents/tester.md` is absent
When the user runs `spec init repo --name shop --format json` through install.Init
Then install.Installation.written has no path under `.claude/agents/` and that file stays absent

### S8: A second init removes only the unchanged obsolete role prompt
Given `spec/roles/overseer.md` is the unchanged prompt installed by the previous version
When the user runs `spec init repo --name shop --format json` through install.Init
Then install.Installation.removed contains `spec/roles/overseer.md`

### S9: A second init preserves an edited obsolete role prompt
Given `spec/roles/overseer.md` was edited after installation
When the user runs `spec init repo --name shop --format json` through install.Init
Then install.Installation.keptEdited contains `spec/roles/overseer.md`
And the file remains unchanged

### S10: A second init warns when its name differs from the installed spec
Given `spec/config.json` has name `shop`
When the user runs `spec init repo --name store --accept-edits --format json` through install.Init
Then `spec/config.json` keeps name `shop`
And install.Installation.notes reports the mismatch and says the existing name is kept (R1)

## Rules
- R1: Init writes a file only when no file is at its path; `spec/index.md`, `spec/_generated/graph.json` and the merged `.claude/settings.json` are exceptions. If `--name` differs from the installed config name, it preserves the config and reports the mismatch.

## Out of scope
- Replacing installed role prompts with a newer version: INS-005
