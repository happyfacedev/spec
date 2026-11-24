---
id: FMT-009
title: State invariants and what they apply to
module: format
status: active
observes: [lint.Finding.rule, lint.Finding.id]
retired: [S4, S6, S8]
---
## Intent
An invariant is a rule that always holds across features. It names the contracts it constrains, so a change to one of them reaches it, and a scenario shows it by citing it. One no scenario can show says how it is checked instead.

## Behaviour
### S1: A heading makes an invariant
Given "core/invariants.md" has the heading "### INV-001: A widget always has a size" on line 3
When `spec show "INV-001" --format json` runs
Then format.Unit.kind is "invariant", format.Unit.line is 3 and format.Invariant.title is "A widget always has a size" (R1)

### S2: Group headings are only groups
Given "core/invariants.md" has the heading "## Security" and under it "### INV-002: Sizes are never negative"
When `spec show "INV-002" --format json` runs
Then format.Unit.kind is "invariant" (R1)

### S3: Applies to links the contracts it constrains
Given "INV-001" has the line "Applies to: alpha.Widget.size"
When `spec show "alpha.Widget.size"` runs
Then its "Used by:" list holds "- INV-001 applies — A widget always has a size" (R2)
And format.Invariant.appliesTo of "INV-001" is that one member

### S5: A Decisions line links the decisions behind it
Given "INV-001" has the line "Decisions: ADR-001"
When `spec show "ADR-001"` runs
Then its "Used by:" list holds "- INV-001 decisions — A widget always has a size" (R3)
And format.Invariant.decisions of "INV-001" is that one ID

### S7: A step shows an invariant by citing it
Given the feature "ALP-001" lists "invariants: [INV-001]" and its scenario "ALP-001/S2", titled "Size zero refused", has the step "Then no alpha.Widget is stored (INV-001)"
When `spec show "INV-001"` runs
Then its "Cited by:" list holds "- ALP-001/S2 — Size zero refused" (R4)

### S9: Shown by says how an invariant no scenario shows is checked
Given "INV-002" has the line "Shown by: the load benchmark in CI" and no scenario cites it
When `spec lint` runs
Then it reports no lint.Finding.rule "L025" with lint.Finding.id "INV-002" (R5)
And format.Invariant.shownBy is "the load benchmark in CI"

## Rules
- R1: Every "### INV-<NNN>: <title>" heading in core/invariants.md or core/invariants/*.md is an invariant; headings of level one or two only group them.
- R2: An "Applies to:" line lists, comma-separated, the contracts and members the invariant constrains.
- R3: A "Decisions:" line lists the decisions behind it.
- R4: A step or rule shows an invariant by writing its ID; a feature lists every invariant its steps cite.
- R5: A "Shown by:" line says how an invariant is checked when no scenario can show it.

## Out of scope
- An invariant's optional status line: FMT-004
- Impact on an invariant and the briefs that quote it: graph and pipeline
- Refusing a changed invariant whose scenarios did not change: pipeline
- The findings for an Applies to line that names no contract, a format 1 Why line, a cited invariant missing from invariants, and an invariant no scenario shows: LNT-005, LNT-008, LNT-012, LNT-017
