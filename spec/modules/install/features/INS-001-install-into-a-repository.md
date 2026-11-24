---
id: INS-001
title: Install spec into a repository
module: install
status: active
writes: [install.Installation, format.Config]
provides: [install.Init]
retired: [S1, S2, S3, S4, S5, S6, S7, S8, S9, S10, S11, S12, S13]
---
## Intent
One command puts the spec frame and pinned CLI into any repository. The Claude Code plugin supplies skills and hooks separately, and the result passes `spec lint --ci` at once.

## Behaviour
### S14: Every file a fresh install writes
Given an empty folder "repo" and the built bundled CLI
When the user runs `spec init repo --name shop` through install.Init
Then it exits 0
And install.Installation.written is, in this order:
| path |
| spec/config.json |
| spec/.gitignore |
| spec/core/overview.md |
| spec/core/conventions.md |
| spec/core/glossary.md |
| spec/core/invariants.md |
| spec/roles/spec-writer.md |
| spec/roles/spec-review.md |
| spec/roles/tester.md |
| spec/roles/implementer.md |
| spec/roles/reviewer.md |
| .spec/bin/spec |
| .spec/bin/spec.cjs |
| .claude/settings.json (permissions and plugin merged) |
| spec/_generated/graph.json |
| spec/index.md |
And install.Installation.skipped and install.Installation.notes are empty

### S15: Text output
Given an empty folder "repo" and the built bundled CLI
When the user runs `spec init repo --name shop` through install.Init
Then stdout has one line per written file, `wrote <path>`, starting with "wrote spec/config.json" and ending with "wrote spec/index.md"

### S16: JSON output
Given an empty folder "repo" and the built bundled CLI
When the user runs `spec init repo --name shop --format json` through install.Init
Then stdout is one JSON object with exactly the keys install.Installation.repo "repo", install.Installation.skill "spec:brief", install.Installation.spec "spec", install.Installation.written, install.Installation.skipped and install.Installation.notes

### S17: Init does not materialize plugin skills
Given an empty folder "repo"
When the user runs `spec init repo --name shop` through install.Init
Then it does not write `.claude/skills/shop-spec/` or `.claude/skills/feature/SKILL.md`
And `spec/.gitignore` is the one line "_generated/"

### S18: The config starts with the project's name and a vitest setup
Given an empty folder "repo"
When the user runs `spec init repo --name shop` through install.Init
Then `spec/config.json` holds format.Config.formatVersion 2, format.Config.name "shop", format.Config.tickets `{ "adapter": "files", "dir": "tickets" }`, format.Config.baseBranch "main", format.Config.codeGlobs ["src/**"], format.Config.testGlobs ["tests/**"], format.Config.protectedGlobs [] and format.Config.budgets {}
And its format.Config.testCommand is `npx vitest run -t "{filter}" --reporter=json --outputFile="{report}"`
And `spec/config.json` has no `dispatchCommand`

### S19: The core files carry the project's name
Given an empty folder "repo"
When the user runs `spec init repo --name shop` through install.Init
Then `spec/core/overview.md` starts with the heading "# shop"
And no installed file under `spec/core/` holds the text "{project}"

### S20: The role prompts are self-contained
Given an empty folder "repo"
When the user runs `spec init repo --name shop` through install.Init
Then each of the five stage-role files `spec/roles/<role>.md` for spec-writer, spec-review, tester, implementer and reviewer has `role`, `description` and `capabilities` frontmatter and holds the shared rules for every pipeline stage role
And none holds "{shared}", "{role}" or "{changed}"

### S21: The bundled CLI is copied and executable
Given an empty folder "repo"
When the user runs `spec init repo --name shop` with the built `dist/spec` through install.Init
Then `.spec/bin/spec` and `.spec/bin/spec.cjs` are copies of the launcher's `spec` and `spec.cjs`, with mode 755

### S22: Run from source, the CLI is not copied
Given an empty folder "repo"
And spec runs from a place that has no `spec` and `spec.cjs` beside the launcher
When the user runs `spec init repo --name shop` through install.Init
Then the two script files are not written
And install.Installation.notes holds ".spec/bin/spec not installed: run init from the built dist/spec"

### S23: Init leaves plugin command skills to the plugin
Given an empty folder "repo"
When the user runs `spec init repo --name shop` through install.Init
Then `.claude/skills/feature/SKILL.md` is not written
And `.claude/settings.json` has `enabledPlugins` `{ "spec@happyface": true }`

### S24: A new install passes lint --ci
Given an empty folder "repo"
When the user runs `spec init repo --name shop` through install.Init
And then runs `.spec/bin/spec lint --ci` in "repo"
Then lint exits 0

### S25: The repository may be the working directory
Given the working directory is an empty folder
When the user runs `spec init . --name shop --format json` through install.Init
Then install.Installation.repo is "."

### S26: Init prefills the selected stack defaults
Given `repo/package.json` declares jest
When the user runs `spec init . --name shop --stack node` through install.Init
Then `spec/config.json` uses the Jest test command and the defaults code globs ["src/**"] and test globs ["tests/**"]

### S27: A Node worktree can run the project's tests
Given a Node project has installed its test dependencies in `node_modules`
When `spec init --stack node` prepares its project config
Then `worktreeSetup` links the ticket worktree's `node_modules` to the project root and the configured test command passes there

### S28: Python virtual environments are optional worktree setup
Given a Python project uses a virtual environment
When the setup guide describes Python defaults
Then no venv activation is forced by default and the user can configure their own `worktreeSetup`

### S29: Role updates leave the internal overseer prompt alone
Given a project has a custom `spec/roles/overseer.md`
When the user runs `spec init repo --update-roles` or `spec init repo --update-roles --yes`
Then the changed role list contains only spec-writer, spec-review, implementer, tester and reviewer
And applying updates leaves the existing overseer prompt unchanged and does not create one when absent

## Rules
None

## Out of scope
- Choosing a custom test command when the detected runner has no supported report format
- Project scaffolding
