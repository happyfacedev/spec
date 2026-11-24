---
id: FMT-001
title: Read the spec from its known places
module: format
status: active
observes: [lint.Finding.file]
retired: [S4]
---
## Intent
Every file under the spec root has one meaning, decided by its path alone, so a person and the CLI always agree on what a file is. Large specs may split contracts, invariants and the glossary into folders without changing what they mean. Generated, hidden and bundled files are never read as spec, and the spec version names exactly the authored files.

## Behaviour
### S1: Contracts split into a folder
Given the module "alpha" keeps contracts in "modules/alpha/contracts.md" and "modules/alpha/contracts/gadgets.md"
And "modules/alpha/contracts/gadgets.md" defines "alpha.Gadget" on line 3
When `spec show "alpha.Gadget" --format json` runs
Then format.Unit.file is "modules/alpha/contracts/gadgets.md" and format.Unit.line is 3 (R1)

### S2: Invariants split into files
Given "core/invariants.md" defines "INV-001" and "core/invariants/security.md" defines "INV-1000" on line 3
When `spec show "INV-1000" --format json` runs
Then format.Unit.kind is "invariant" and format.Unit.file is "core/invariants/security.md" (R1)

### S3: Glossary split into files
Given "core/glossary/widgets.md" holds the heading "### Gizmo" on line 3
When `spec show "Gizmo"` runs
Then the first output line is "core/glossary/widgets.md:3" (R1)

### S5: Generated and hidden files are not read
Given the spec root holds "_generated/old.md", ".drafts/x.md" and "index.md"
When `spec lint` runs
Then no lint.Finding.file is any of those three files (R2)

### S6: Images and other non-Markdown files
Given the spec root holds "ui/card.png"
When `spec lint` runs
Then no lint.Finding.file is "ui/card.png" (R1)

### S7: Role prompts are not units
Given the spec root holds "roles/tester.md"
When `spec lint` runs
Then no lint.Finding.file is "roles/tester.md" (R1)

### S8: The spec version names the authored files
Given a spec whose `spec show "alpha" --format json` prints "spec" as "spec@" and 8 hex digits
When "roles/tester.md", "index.md" and "_generated/graph.json" change
Then the "spec" value is unchanged (R3)
And it changes when "modules/alpha/_module.md" changes

## Rules
- R1: Each path has one meaning: config.json; SKILL.md (an older install's skill, whose name config.json's name overrides); core/overview.md and core/conventions.md (free text); core/glossary.md or core/glossary/*.md; core/invariants.md or core/invariants/*.md; modules/<module>/_module.md; modules/<module>/contracts.md or modules/<module>/contracts/*.md; modules/<module>/features/*.md; decisions/*.md; ui/*.md; roles/*.md (role prompts); any file not ending in .md (an asset). Any other Markdown file is in no known place.
- R2: index.md, anything under _generated/ or scripts/, and any path with a segment starting with a dot are never read as spec.
- R3: The spec version is "spec@" and the first 8 hex digits of a sha256 hash over every read file except roles/, in path order.

## Out of scope
- What each file holds: the other format features
- Writing index.md and _generated/graph.json: graph
- Finding the spec root: cli
- The finding for a file in no known place: LNT-006
