# format contracts

### format.UnitKind
Kind: type · Status: active
The kinds of unit a spec holds, as `spec show --format json` prints them under `type`. Type: "feature" | "scenario" | "rule" | "contract" | "field" | "invariant" | "decision" | "screen" | "module"

### format.Status
Kind: type · Status: active
A unit's life: current, still served but not for new use, or a tombstone that keeps its ID from reuse. Type: "active" | "deprecated" | "removed"

### format.Unit
Kind: entity · Status: active
One unit of the spec, as a file or a heading in a file defines it.

#### format.Unit.id
The unit's stable ID, never reused: "CRT-001", "CRT-001/S2", "cart.Cart.lines", "INV-001", "ADR-001", "UI-001", or a module name. Type: string

#### format.Unit.kind
What sort of unit it is, decided by the shape of its ID. Type: format.UnitKind

#### format.Unit.status
Its status. A scenario or rule has its feature's status; a member without its own status line has its contract's. Type: format.Status

#### format.Unit.file
The spec file that defines it, relative to the spec root. Type: string

#### format.Unit.line
The line in that file where it starts: 1 for a unit that is a whole file, else its heading or list item. Type: int

### format.Config
Kind: entity · Status: active
`spec/config.json`: one JSON object. Unknown keys are refused.

#### format.Config.formatVersion
The spec format the files are written in. This CLI reads format 2. Type: int?

#### format.Config.name
The project's name: lowercase letters, digits, hyphens and underscores, starting with a letter. The harness skill is `<name>-spec`. Type: string?

#### format.Config.projectRoot
The project the spec describes, relative to the spec root. Default: the spec root's parent. Other paths in the config are relative to the project root. Type: string?

#### format.Config.tickets
Where tickets live. Default: the `files` store in `tickets`. Type: format.TicketsConfig?

#### format.Config.baseBranch
The branch finished tickets merge into. Default: "main". Type: string?

#### format.Config.checkCommands
Shell commands, for example `["npm run lint", "npm run typecheck"]`, that `check-report` runs over the project when a tester or implementer stage reports done. Default: none. Type: string[]?

#### format.Config.worktrees
The folder ticket worktrees go in, relative to the project root. Type: string?

#### format.Config.worktreeSetup
A shell command run in each new worktree. Type: string?

#### format.Config.afterMerge
A shell command `spec merge` runs in the project root, on the base branch, after each successful merge, for example one that rebuilds and copies the bundled CLI. Default: none, and merge runs nothing after it. Type: string?

#### format.Config.generated
The project's own generated files: never merged as text. A conflict in one, in `spec merge` or in the sync at a stage's start, takes one side, and when format.GeneratedConfig.command is set the command then rebuilds them. An old config's format.Config.generatedGlobs is read as more of these globs, without a command. Default: none, and a conflict in such a file needs a person. Type: format.GeneratedConfig?

#### format.Config.dispatchCommand
Status: deprecated · Superseded by: format.Config.delegation
An old config key accepted for compatibility; it is ignored since X139 and lint warns. Type: string?

#### format.Config.maxParallel
The most tickets `spec next --start` prepares at once when called without an ID: a whole number of 1 or more. Default: no cap. Type: int?

#### format.Config.maxTestRuns
The most runs of the test command that spec lets run at once across the main checkout and every worktree of the repository: a whole number of 1 or more. A run beyond it waits for its turn. Any other value makes the config not match the schema. Default: 1. Type: int?

#### format.Config.models
Status: deprecated · Superseded by: format.Config.delegation
The legacy size-based model selector is accepted for old configs, ignored since X139, and lint warns with L028. Type: format.ModelsConfig?

#### format.Config.delegation
Models selected by harness and stage role for `spec next`. Harness names are free-form; stage-role keys are `format.StageRole`. A text is one model, with no effort. A list of format.ModelChoice, best first, is accepted only under "claude-code". Default: none. Type: map<string, map<format.StageRole, string | format.ModelChoice[]>>?

#### format.Config.testCommand
The project's test command; the only key every config must have. Type: string

#### format.Config.codeGlobs
The files the implementer may change. Default: none. Type: string[]?

#### format.Config.testGlobs
The files the tester may change. Default: none. Type: string[]?

#### format.Config.protectedGlobs
Files no role may change. Default: none. Type: string[]?

#### format.Config.generatedGlobs
Status: deprecated · Superseded by: format.Config.generated
An old config key accepted for compatibility: its globs are read as format.GeneratedConfig.globs without a command, and lint warns with L036. Default: none. Type: string[]?

#### format.Config.budgets
Positive whole numbers that override built-in limits: `brief.<role>` (a stage role's brief, in tokens: spec-writer 10000, spec-review 10000, implementer 6000, tester 4000, reviewer 8000) and `size.<kind>` (lines: skill 20, feature 250, contracts 600, invariant 15, adr 120, glossary 4). Default: none. Type: map<string, int>?

#### format.Config.enforce
The edit, commit and history enforcement switches, plus an optional agent-bypass policy. Omitted switches default to true. Type: format.EnforceConfig?

#### format.Config.enforceSince
The first commit checked by `spec verify-history`; init and upgrade set a missing value to current HEAD. Type: string?

### format.EnforceConfig
Kind: type · Status: active
The independent edits, commits and history layers, each defaulting to true. `bypass`, when set, is `person`, which refuses agent-context bypass requests.

#### format.EnforceConfig.edits
Whether the before-edit hook denies governed edits on the base branch. Type: bool?

#### format.EnforceConfig.commits
Whether pre-commit refuses governed commits on the base branch. Type: bool?

#### format.EnforceConfig.history
Whether `spec verify-history` checks first-parent base history. Type: bool?

#### format.EnforceConfig.bypass
Whether agent-context bypass requests are refused. The only value is `person`. Type: "person"?

### format.ModelsConfig
Kind: type · Status: deprecated · Superseded by: format.Config.delegation
Legacy shape accepted only for old `config.json` files; it has no effect since X139 and lint warns when `format.Config.models` is present. `{ "small": "<model>", "large": "<model>", "threshold": <scenarios> }`.

#### format.ModelsConfig.small
The model for a small ticket. Type: string

#### format.ModelsConfig.large
The model for a large ticket. Type: string

#### format.ModelsConfig.threshold
The most scenarios a small ticket's impact reaches: a whole number of 0 or more. Type: int

### format.GeneratedConfig
Kind: type · Status: active
`{ "globs": ["<glob>"], "command": "<shell command>" }`: the files a project builds from its other files, and, optionally, the command that builds them.

#### format.GeneratedConfig.globs
The generated files: at least one non-empty project-relative POSIX glob, without an absolute path, a backslash, or a `.` or `..` path segment. Type: string[]

#### format.GeneratedConfig.command
A shell command, run in the project root, that rewrites the generated files from the rest of the tree, for example `npm run build --silent`. Default: none, and a conflict in a generated file takes one side and nothing is rebuilt. Type: string?

### format.TicketsConfig
Kind: type · Status: active
The ticket store a config names: `{ "adapter": "files", "dir": "<folder>" }` or `{ "adapter": "command", "command": "<program>" }`.

#### format.TicketsConfig.adapter
Which store. Type: "files" | "command"

#### format.TicketsConfig.dir
The `files` store's folder, relative to the project root. Required with `files`. Type: string?

#### format.TicketsConfig.command
The `command` store's program. Required with `command`. Type: string?

### format.StageRole
Kind: type · Status: active
A stage a project may delegate. Type: "spec-writer" | "spec-review" | "tester" | "implementer" | "reviewer"

### format.ModelChoice
Kind: type · Status: active
One entry of a stage role's model list, such as `{ "model": "sonnet", "effort": "high" }`. Any other key does not match the config schema.

#### format.ModelChoice.model
The Claude Code model alias. Type: string

#### format.ModelChoice.effort
The reasoning effort; left out, spec sets none. Type: format.Effort?

### format.LocalConfig
Kind: entity · Status: active
`spec/config.local.json` in the main checkout: one person's settings on one machine, ignored by git. Other keys are ignored.

#### format.LocalConfig.delegation
Overrides format.Config.delegation role by role. Type: map<string, map<format.StageRole, string | format.ModelChoice[]>>?

#### format.LocalConfig.unavailableModels
Claude Code aliases (sonnet, opus, haiku, fable) this machine cannot use, each mapped to true; false or left out means usable. Type: map<string, bool>?

### format.Effort
Kind: type · Status: active
A Claude Code reasoning effort level. Type: "low" | "medium" | "high" | "xhigh" | "max"

### format.ContractKind
Kind: type · Status: active
What a contract is. Type: "entity" | "event" | "operation" | "type" | "error"

### format.TypeExpression
Kind: type · Status: active
A type in the spec's one notation, whatever the stack: the primitives `string int number decimal bool bytes date datetime duration null`, quoted or numeric literals, `<module>.<Name>` references, `T[]`, `map<K, V>`, `A | B`, parentheses, and `T?` on a member that may be left out. Type: string

### format.LinkKind
Kind: type · Status: active
What a link says, as `_generated/graph.json` and `spec show` name it. Type: "reads" | "writes" | "emits" | "consumes" | "provides" | "calls" | "observes" | "invariants" | "decisions" | "ui" | "uses" | "shows" | "applies" | "supersedes" | "superseded_by" | "cites" | "depends_on"

### format.Link
Kind: entity · Status: active
One edge of the spec graph: a unit that uses, shapes or cites another.

#### format.Link.from
The unit the link is written on or derived for, or `<owner>#<Q>` for a question. Type: string

#### format.Link.to
The unit it points at. Type: string

#### format.Link.kind
What it says. Type: format.LinkKind

### format.StepKeyword
Kind: type · Status: active
The word every step starts with. And and But take the keyword of the step before them. Type: "Given" | "When" | "Then" | "And" | "But"

### format.Feature
Kind: entity · Status: active
A feature file, `modules/<module>/features/<ID>-<slug>.md`: YAML frontmatter, then `## Intent`, `## Behaviour`, `## Rules` and `## Out of scope`, in that order. Unknown frontmatter keys are refused.

#### format.Feature.id
`<PREFIX>-<NNN>`: two to four capital letters and three or four digits. The file name starts with it. Type: string

#### format.Feature.title
At most 80 characters. Type: string

#### format.Feature.module
The module folder the file is in. Type: string

#### format.Feature.status
Type: format.Status

#### format.Feature.superseded_by
The feature that replaces it. Type: (string | null)?

#### format.Feature.writes
Entities and types (or members) the feature's code changes, each cited in a Then. Type: string[]?

#### format.Feature.provides
Operations the feature implements, each cited in the When that invokes it. Type: string[]?

#### format.Feature.observes
Contracts of any kind the scenarios set up or check while the feature's code does not use them. Type: string[]?

#### format.Feature.reads
Derived from the steps; a hand-written list is kept and warns. Type: string[]?

#### format.Feature.calls
Derived from the steps; a hand-written list is kept and warns. Type: string[]?

#### format.Feature.consumes
Derived from the steps; a hand-written list is kept and warns. Type: string[]?

#### format.Feature.emits
Derived from the steps; a hand-written list is kept and warns. Type: string[]?

#### format.Feature.invariants
The invariants it shows or is shaped by. Type: string[]?

#### format.Feature.decisions
The decisions behind it. Type: string[]?

#### format.Feature.ui
The screens its steps show. Type: string[]?

#### format.Feature.retired
Scenario and rule numbers (`S3`, `R2`) it removed, never used again. Type: string[]?

#### format.Feature.questions
Open points on the feature. Type: tickets.Question[]?

### format.Scenario
Kind: entity · Status: active
A `### S<n>: <title>` heading under `## Behaviour` and the step lines under it.

#### format.Scenario.id
`<feature>/S<n>`. Type: string

#### format.Scenario.title
The text after `S<n>:`. Type: string

#### format.Scenario.steps
Its steps, in order. Type: format.Step[]

#### format.Scenario.cites
Contract, member, screen, invariant and rule IDs its steps and their data name, in order of first appearance. Type: string[]

### format.Step
Kind: type · Status: active
One line of a scenario.

#### format.Step.keyword
Type: format.StepKeyword

#### format.Step.text
The whole line. Type: string

#### format.Step.data
A table (lines starting `|`) or a fenced block written right under the step; empty when none. Type: string

### format.Rule
Kind: entity · Status: active
A `- R<n>: <text>` line under `## Rules`.

#### format.Rule.id
`<feature>/R<n>`. Type: string

#### format.Rule.text
The text after `R<n>:`. Every ID in it is a cite. Type: string

### format.Contract
Kind: entity · Status: active
A `### <module>.<Name>` section of `modules/<module>/contracts.md` or `modules/<module>/contracts/*.md`. The line right under the heading is `Kind: <kind> · Status: <status>`, optionally followed by `· Superseded by: <ID>` and `· Draft: <sources>`.

#### format.Contract.id
`<module>.<Name>`: the module that defines it, a dot, and a name starting with a capital. Type: string

#### format.Contract.kind
Type: format.ContractKind

#### format.Contract.status
Type: format.Status

#### format.Contract.supersededBy
The `Superseded by:` part of the status line. Type: string?

#### format.Contract.summary
The first line after the status line that is not a `Decisions:`, `Output:`, `Code:` or list line. Type: string

#### format.Contract.type
The `Type:` expression of a type contract that is not a record. Type: format.TypeExpression?

#### format.Contract.output
An operation's result, the `Output:` line. Type: format.TypeExpression?

#### format.Contract.code
The `Code:` line: the symbol that implements it, never a signature. Type: string?

#### format.Contract.decisions
The `Decisions:` line: ADR IDs, comma-separated. Type: string[]?

#### format.Contract.members
Its `####` members. Type: format.Member[]

### format.Member
Kind: entity · Status: active
A `#### <module>.<Name>.<member>` section under its contract: a field of an entity or type, a member of an event or error, an input of an operation.

#### format.Member.id
`<contract>.<member>`: the member name may start with a capital and hold underscores. Type: string

#### format.Member.type
The one `Type:` expression in the section. Type: format.TypeExpression

#### format.Member.status
An optional first line `Status: <status> · Superseded by: <ID>`; without one, the contract's status. Type: format.Status

#### format.Member.supersededBy
Type: string?

### format.Invariant
Kind: entity · Status: active
A `### INV-<NNN>: <title>` section of `core/invariants.md` or `core/invariants/*.md`.

#### format.Invariant.id
`INV-` and three or four digits. Type: string

#### format.Invariant.title
Type: string

#### format.Invariant.status
An optional line `Status: <status> · Superseded by: <ID> · Draft: <sources>`; without one, active. Type: format.Status

#### format.Invariant.appliesTo
The `Applies to:` line: the contracts and members it constrains, comma-separated. Type: string[]?

#### format.Invariant.shownBy
The `Shown by:` line: how it is checked when no scenario can show it. Type: string?

#### format.Invariant.decisions
The `Decisions:` line. Type: string[]?

### format.DecisionStatus
Kind: type · Status: active
A decision's written status. Accepted reads as active; superseded reads as removed. Type: "accepted" | "superseded"

### format.Decision
Kind: entity · Status: active
A decision file, `decisions/ADR-<NNN>-<slug>.md`: frontmatter, then `## Decision`, `## Consequences`, `## Context` and `## Alternatives`, in that order.

#### format.Decision.id
`ADR-` and three or four digits. Type: string

#### format.Decision.title
At most 80 characters. Type: string

#### format.Decision.status
Type: format.DecisionStatus

#### format.Decision.supersedes
One decision ID or a list of them. Type: (string | string[] | null)?

#### format.Decision.superseded_by
Type: (string | null)?

#### format.Decision.questions
Type: tickets.Question[]?

### format.Screen
Kind: entity · Status: active
A screen file, `ui/UI-<NNN>-<slug>.md`: frontmatter, then `## Layout`, `## States` and an optional `## Copy`.

#### format.Screen.id
`UI-` and three or four digits. Type: string

#### format.Screen.title
At most 80 characters. Type: string

#### format.Screen.status
Type: format.Status

#### format.Screen.image
A picture of the screen, a path under `ui/`. Type: (string | null)?

#### format.Screen.shows
Entities, types, events and errors (or members) it renders. Type: string[]?

#### format.Screen.calls
Operations its controls invoke. Type: string[]?

#### format.Screen.superseded_by
Type: (string | null)?

#### format.Screen.questions
Type: tickets.Question[]?

### format.Module
Kind: entity · Status: active
`modules/<module>/_module.md`: frontmatter, a paragraph on what the module owns, then `## Owns` and `## Non-goals`.

#### format.Module.id
The folder name: lowercase letters, digits and hyphens, starting with a letter. Type: string

#### format.Module.prefix
Two to four capital letters that number the features it creates. Type: string

#### format.Module.domain
Groups modules in `index.md`. Type: string

#### format.Module.status
Covers the features and contracts it holds. Type: format.Status

#### format.Module.external
True for another system's API: it holds only the contracts this product uses. Default: false. Type: bool?

#### format.Module.superseded_by
Type: (string | null)?

#### format.Module.questions
Type: tickets.Question[]?

### format.Term
Kind: entity · Status: active
A `### <Term>` section of `core/glossary.md` or `core/glossary/*.md`: a definition, then an optional `Aliases: a, b` line.

#### format.Term.term
The heading text. Type: string

#### format.Term.aliases
Other words for it, comma-separated. Type: string[]
