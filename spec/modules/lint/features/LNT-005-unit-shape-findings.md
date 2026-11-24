---
id: LNT-005
title: Report malformed units and format 1 leftovers (L001)
module: lint
status: active
writes: [lint.Report.findings]
---
## Intent
Beyond frontmatter, L001 reports a unit whose lines lint cannot read: a contract without its Kind and Status line, a member outside a contract, a glossary entry without a definition, a module folder without its module file, a feature in an external module, and the format 1 spellings a migration leaves behind. A hand-written derived link is the one L001 warning: the steps already state it. Each scenario starts from the base spec of LNT-001 and runs lint.Lint. Inside a quoted message or fix, '' stands for a double quote the text holds.

## Behaviour
### S1: A contract kind that does not exist
Given the base spec with "Kind: thing · Status: active" under "alpha.Widget" on line 4 of "modules/alpha/contracts.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "modules/alpha/contracts.md" line 4, id "alpha.Widget" (R1)
And its message is "the line after ''### alpha.Widget'' must be ''Kind: <entity|event|operation|type|error> · Status: <active|deprecated|removed>''"
And its fix is "add ''Kind: entity · Status: active'' (or event / operation / type / error) right under the heading"

### S2: A member before any contract
Given the base spec with a member "alpha.Widget.loose" on line 3 of "modules/alpha/contracts.md", above the first contract
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "modules/alpha/contracts.md" line 3, id "alpha.Widget.loose" (R1)
And its message is "field ''alpha.Widget.loose'' is outside a contract section"
And its fix is "put fields under their ''### <module>.<Name>'' contract"

### S3: A member status line that does not parse
Given the base spec with "Status: gone" on line 11, the first line of member "alpha.Widget.size"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "modules/alpha/contracts.md" line 11, id "alpha.Widget.size", fix "fix the status line" (R1)
And its message is "''Status: gone'' is not ''Status: <active|deprecated|removed> · Superseded by: <ID>''"

### S4: A format 1 Payload list
Given the base spec with "Payload: name" on line 16, under "alpha.WidgetMade"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "modules/alpha/contracts.md" line 16, id "alpha.WidgetMade" (R1)
And its message is "''Payload:'' lists are format 1; write each member as ''#### alpha.WidgetMade.<member>'' with a Type: line"
And its fix is "turn each ''- name: type'' item into ''#### alpha.WidgetMade.<name>'', a one-line description, and ''Type: <type>''"

### S5: A format 1 In code note
Given the base spec with "One widget. In code: Widget" on line 5, the summary of "alpha.Widget"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "modules/alpha/contracts.md" line 5, id "alpha.Widget" (R1)
And its message is "''In code:'' is format 1; write it as its own line, ''Code: <symbol>''"
And its fix is "move the code name to a ''Code: Class.method(args)'' line under the summary"

### S6: A Code line with a signature
Given the base spec with "Code: Widget.make(name, size)" on line 6, under "alpha.Widget"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "modules/alpha/contracts.md" line 6, id "alpha.Widget" (R1)
And its message is "''Code: Widget.make(name, size)'' holds a signature; Code: names the symbol, and the members are its inputs"
And its fix is "write ''Code: Widget.make'', and give each input a #### member"

### S7: A format 1 Why line on an invariant
Given the base spec with "Why: ADR-001" in place of the Decisions line on line 5 of "core/invariants.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "core/invariants.md" line 5, id "INV-001", fix "rename the line to Decisions:" (R1)
And its message is "''Why:'' is format 1; write ''Decisions: ADR-001''"

### S8: An Aliases line that is not a list
Given the base spec with "Aliases: widgets · junk" on line 5 of "core/glossary.md", under "Widget"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "core/glossary.md" line 5, id "Widget" (R1)
And its message is "''Aliases: widgets · junk'' is not ''Aliases: a, b''"
And its fix is "list aliases comma-separated after ''Aliases:''"

### S9: A glossary term with no definition
Given the base spec with the definition line of "Order" removed from "core/glossary.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "core/glossary.md" line 7, id "Order", message "glossary term ''Order'' has no definition", fix "add one to three lines that define it" (R1)

### S10: A module folder with no module file
Given the base spec with "modules/gamma/contracts.md" and no "modules/gamma/_module.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "modules/gamma/_module.md" line 1, id "gamma", message "module folder modules/gamma/ has no _module.md" (R1)
And its fix is "add modules/gamma/_module.md with id, prefix, domain and status"

### S11: A feature in an external module
Given the base spec with "external: true" in "modules/beta/_module.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L001" at "modules/beta/features/BET-001-order-a-widget.md" line 1, id "BET-001" (R1)
And its message is "BET-001 is in external module beta; an external module holds only the contracts this product uses"
And its fix is "move the feature to the module of this product that does the work"

### S12: A hand-written derived link
Given the base spec with "emits: [alpha.WidgetMade]" on line 7 of the frontmatter of "ALP-001"
When lint.Lint runs
Then lint.Report.findings is exactly: warning "L001" at "modules/alpha/features/ALP-001-make-a-widget.md" line 7, id "ALP-001" (R2)
And its message is "emits is derived from the steps; the frontmatter lists only writes, provides and observes"
And its fix is "remove emits: the steps that cite alpha.WidgetMade link them"
And cli.CommandResult.exitCode is 0

## Rules
- R1: An L001 finding is an error, except for a hand-written derived link
- R2: A reads, emits, consumes or calls list in a feature's frontmatter is an L001 warning, one per list, naming the IDs it holds

## Out of scope
- What each line means: format
