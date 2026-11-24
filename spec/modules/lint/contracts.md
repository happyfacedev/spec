# lint contracts

### lint.Lint
Kind: operation · Status: active
`spec lint [--files <paths>] [--ci] [--base <ref>]`: checks the spec under the spec root and every ticket in the ticket store, and prints each finding with its fix. It exits 1 when any finding is an error, and 0 otherwise. With `--format json` it prints the report as one JSON document.
Output: lint.Report

#### lint.Lint.files
`--files <paths>`: limits the findings of the per-file rules (L001, L002, L006, L007, L008, L010, L011, L020) to these files. Paths are relative to the working directory; one that is neither under the spec root nor in the ticket store matches nothing. Written as space-separated values up to the next option, or as `--files=a,b`. Type: string[]?

#### lint.Lint.ci
`--ci`: adds the freshness checks: `index.md` (L017) and each `Code:` line (L024), and, without `--base`, compares the spec with format.Config.baseBranch (L035) when the project is a git repository that has it. Type: bool?

#### lint.Lint.base
`--base <ref>`: compares the spec in the working tree with the spec at `<ref>` and at the merge base of HEAD and `<ref>`, and reports each ID a branch reuses or drops against it (L035). A ref git cannot resolve to a commit is refused with exit 2. Type: string?

### lint.Report
Kind: type · Status: active
What `spec lint --format json` prints: one JSON object, indented by two spaces and ending in a newline.

#### lint.Report.spec
The spec version: `spec@` and the first 8 hex digits of a hash of the authored spec files. Type: string

#### lint.Report.findings
Every finding, sorted by file, then line, then rule, then unit ID, then message, each listed once. Empty when the spec lints clean. Type: lint.Finding[]

### lint.RuleCode
Kind: type · Status: active
The code of a lint rule, stable across versions. L013 (cycle), L015 (overview-modules), L021 (compiled agents, X139) and L027 (dispatch allows) are retired and never reused. Type: "L001" | "L002" | "L003" | "L004" | "L005" | "L006" | "L007" | "L008" | "L009" | "L010" | "L011" | "L012" | "L014" | "L016" | "L017" | "L018" | "L019" | "L020" | "L022" | "L023" | "L024" | "L025" | "L026" | "L028" | "L029" | "L030" | "L031" | "L032" | "L033" | "L034" | "L035" | "L036" | "L037"

### lint.Severity
Kind: type · Status: active
How serious a finding is. Any error makes `spec lint` exit 1, with or without `--ci`. Type: "error" | "warning"

### lint.Finding
Kind: entity · Status: active
One problem lint found. The text output prints it as `<file>:<line> <severity> <rule> <id>: <message>` (without ` <id>` when it is null), then `  fix: <fix>` on the next line.

#### lint.Finding.rule
The rule that found it; the JSON key is `rule`. Type: lint.RuleCode

#### lint.Finding.severity
Whether it makes lint fail. Type: lint.Severity

#### lint.Finding.file
The file it is in: relative to the spec root, except a ticket, which is relative to the project root (`tickets/TASK-001.md`). Type: string

#### lint.Finding.line
The line in that file; 1 when the finding is about the whole file. Type: int

#### lint.Finding.id
The unit, ticket, question (`<owner>#Q<n>`) or glossary term it is about, or null when it is about a file. Type: string | null

#### lint.Finding.message
What is wrong. Type: string

#### lint.Finding.fix
What to change to fix it. Type: string
