# adopt contracts

### adopt.DraftMarker
Kind: type · Status: active
The frontmatter keys that mark a module, feature, decision or screen as a draft. A unit whose frontmatter has no `draft: true` is confirmed, whatever its `sources:` say.

#### adopt.DraftMarker.draft
`true` while the unit is a draft; absent once confirmed. Type: bool?

#### adopt.DraftMarker.sources
Where the draft came from: `file:line` or a document. A YAML flow list or block list. Type: string[]?

### adopt.StatusDraft
Kind: type · Status: active
The `· Draft: <sources>` part at the end of a contract's or an invariant's status line, which marks it as a draft: comma-separated sources, or `yes` for none. Type: string

### adopt.GapKind
Kind: type · Status: active
The sections `spec gaps` reports, in the order it prints them, as the JSON keys spell them. In text they are "Drafts to confirm", "Open questions", "Modules without features", "Contracts no feature uses", "Scenarios without a test", "Tests for no scenario" and "Code pointers not found". Type: "drafts" | "questions" | "modulesWithoutFeatures" | "unusedContracts" | "scenariosWithoutTests" | "testsWithoutScenario" | "codeNotFound"

### adopt.Gap
Kind: type · Status: active
One thing in the spec that still needs a person: one entry in one section, one `- ` line in text. Modules, contracts, scenarios and tests are listed by ID or test name alone. Type: adopt.DraftGap | adopt.QuestionGap | adopt.CodeGap | string

### adopt.DraftGap
Kind: type · Status: active
A drafted unit no person has confirmed yet.

#### adopt.DraftGap.id
The unit's ID. Type: string

#### adopt.DraftGap.title
The unit's title; a contract's first summary line; a module's first description line, or empty when the module has no description. Type: string

#### adopt.DraftGap.sources
Where it came from, in the order written; empty for `Draft: yes`. Type: string[]

#### adopt.DraftGap.file
The file that defines it, relative to the spec root. Type: string

### adopt.QuestionGap
Kind: type · Status: active
An unanswered question on a module, feature, decision or screen.

#### adopt.QuestionGap.id
`<unit ID>#<question ID>`. Type: string

#### adopt.QuestionGap.kind
Type: tickets.QuestionKind

#### adopt.QuestionGap.text
Type: string

### adopt.CodeGap
Kind: type · Status: active
A contract whose `Code:` line names a symbol no code file holds.

#### adopt.CodeGap.id
The contract's ID. Type: string

#### adopt.CodeGap.code
The symbol, as written before any `(`. Type: string

### adopt.GapReport
Kind: type · Status: active
What `spec gaps --format json` prints: one key per section, in adopt.GapKind order, after `spec`.

#### adopt.GapReport.spec
The spec's version, as in the text heading. Type: string

#### adopt.GapReport.drafts
Sorted in natural ID order. Type: adopt.DraftGap[]

#### adopt.GapReport.questions
Blockers first, then external questions, then preferences, each in natural ID order. Type: adopt.QuestionGap[]

#### adopt.GapReport.modulesWithoutFeatures
Type: string[]

#### adopt.GapReport.unusedContracts
Type: string[]

#### adopt.GapReport.scenariosWithoutTests
Null when the tests did not run. Type: string[] | null

#### adopt.GapReport.testsWithoutScenario
Null when the tests did not run. Type: string[] | null

#### adopt.GapReport.codeNotFound
Null when `codeGlobs` in the config is empty. Type: adopt.CodeGap[] | null

### adopt.Gaps
Kind: operation · Status: active
`spec gaps [--no-tests]`: lists what in the spec still needs a person. Always exits 0.
Output: adopt.GapReport

#### adopt.Gaps.noTests
`--no-tests`: do not run the project's tests, so untested scenarios are not checked. Type: bool

### adopt.Confirm
Kind: operation · Status: active
`spec confirm <ID>...`: a person checked these drafted units; their draft markers are removed and they become ordinary spec. Each confirmed ID is a line on stdout and each problem a line on stderr; with `--format json`, both are in one document on stdout.
Output: adopt.ConfirmResult | cli.UsageError

#### adopt.Confirm.ids
The units to confirm, in the order given. Type: string[]

### adopt.ConfirmResult
Kind: type · Status: active
What `spec confirm --format json` prints. The command exits 1 when `problems` is not empty, else 0.

#### adopt.ConfirmResult.confirmed
The IDs confirmed, in the order given. Type: string[]

#### adopt.ConfirmResult.problems
One line per ID not confirmed, in the order given. Type: string[]

### adopt.NotAUnit
Kind: error · Status: active
The ID names no unit: `<ID> is not a unit`, with `; did you mean <ID>?` when one is close.

### adopt.ConfirmedWithOwner
Kind: error · Status: active
A scenario or rule is confirmed with its feature, a member with its contract: `<ID> is confirmed with its feature: spec confirm <feature ID>`, or `with its contract: spec confirm <contract ID>`.

### adopt.NotADraft
Kind: error · Status: active
The unit is already confirmed: `<ID> is not a draft`.

### adopt.DraftMarkerNotFound
Kind: error · Status: active
The unit was a draft when the command started but its file no longer holds the marker, as when the same ID is given twice: `<ID>: its draft marker was not found in <file>`.
