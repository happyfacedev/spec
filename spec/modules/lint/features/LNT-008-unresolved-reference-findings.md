---
id: LNT-008
title: Report links that do not resolve or do not fit (L004)
module: lint
status: active
writes: [lint.Report.findings]
questions:
  - id: Q1
    kind: preference
    text: "A screen link of the wrong kind gets the fix written for a feature (\"list alpha.Widget under writes, or under observes if the feature's code does not use it\"), but a screen has no writes or observes. Should a screen's fix point to shows instead?"
    default: Keep the feature's fix text, as now
    cites: [LNT-008/S11]
    answer: 'Decided in review (2026-10-29): point a screen''s fix at shows or calls.'
    raised_by: null
---
## Intent
Every link must reach a unit that exists, of a kind the link can take: a frontmatter link, a cite in a step or a rule, an invariant's Applies to line, a qualified name in a type, a screen's image. A feature's or a screen's contract link must also suit the contract's kind, and this product never provides or emits what an external module's other system does. L004 reports each one, with the closest existing ID when there is one. Each scenario starts from the base spec of LNT-001 and runs lint.Lint.

## Behaviour
### S1: A frontmatter link to an ID that does not exist
Given the base spec with "invariants: [INV-009]" on line 7 of "BET-001"
When lint.Lint runs
Then lint.Report.findings holds: error "L004" at "modules/beta/features/BET-001-order-a-widget.md" line 7, id "BET-001" (R1)
And its message is "BET-001 invariants INV-009, which does not exist"
And its fix is "did you mean INV-001? Otherwise define INV-009 first"

### S2: A step that cites a member that does not exist
Given the base spec with "And alpha.Widget.size is 2 and alpha.Widget.colour is red" on line 15 of "BET-001"
When lint.Lint runs
Then lint.Report.findings holds two "L004" errors at "modules/beta/features/BET-001-order-a-widget.md" line 15, one for the derived link and one for the cite (R1, R2):
| id | message | fix |
| "BET-001" | "BET-001 reads alpha.Widget.colour, which does not exist" | "did you mean alpha.Widget.name? Otherwise define alpha.Widget.colour first" |
| "BET-001/S1" | "BET-001/S1 cites alpha.Widget.colour, which does not exist" | "did you mean alpha.Widget.name? Otherwise define alpha.Widget.colour first" |

### S3: No ID close enough to suggest
Given the base spec with the heading of "INV-001" written "### INV-1 A widget always has a size"
When lint.Lint runs
Then lint.Report.findings holds: error "L004" at "modules/alpha/features/ALP-001-make-a-widget.md" line 7, id "ALP-001", message "ALP-001 invariants INV-001, which does not exist" (R1)
And its fix is "define INV-001 first, or remove the reference"
And it holds the same for the rule, id "ALP-001/R1" on line 23, message "ALP-001/R1 cites INV-001, which does not exist"

### S4: A link to a unit of the wrong kind
Given the base spec with "Applies to: ALP-001" on line 6 of "core/invariants.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L004" at "core/invariants.md" line 6, id "INV-001", message "INV-001 applies ALP-001, which is a feature", fix "applies points to contract or field IDs" (R1)

### S5: A provided contract that is not an operation
Given the base spec with "provides: [alpha.Widget]" on line 7 of "ALP-001"
When lint.Lint runs
Then lint.Report.findings holds: error "L004" at "modules/alpha/features/ALP-001-make-a-widget.md" line 7, id "ALP-001", message "ALP-001 provides alpha.Widget, which is an entity" (R1)
And its fix is "list alpha.Widget under writes, or under observes if the feature's code does not use it; provides takes operation contracts"

### S6: A written event
Given the base spec with "writes: [alpha.Widget, alpha.WidgetMade]" on line 6 of "ALP-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L004" at "modules/alpha/features/ALP-001-make-a-widget.md" line 6, id "ALP-001", message "ALP-001 writes alpha.WidgetMade, which is an event" (R1)
And its fix is "remove it from writes: a step that names it links it (consumed in a Given or When, emitted in a Then); list it under observes if the feature's code does not use it; writes takes entity or type contracts"

### S7: Providing an external module's operation
Given the base spec with "external: true" on module "beta", without "BET-001", with an operation "beta.Pay" in "modules/beta/contracts.md", and "ALP-001" providing "beta.Pay" on line 7 and invoking it in its When
When lint.Lint runs
Then lint.Report.findings holds: error "L004" at "modules/alpha/features/ALP-001-make-a-widget.md" line 7, id "ALP-001" (R1, R3)
And its message is "ALP-001 provides beta.Pay, which belongs to external module beta"
And its fix is "call it (calls); the other system provides it"

### S8: A type that names a contract that does not exist
Given the base spec with "Type: alpha.Label" on member "alpha.Widget.name", line 8 of "modules/alpha/contracts.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L004" at "modules/alpha/contracts.md" line 8, id "alpha.Widget.name", message "alpha.Widget.name uses alpha.Label, which does not exist" (R1)
And its fix is "define alpha.Label first, or remove the reference"

### S9: A screen image that does not exist
Given the base spec with "image: card.png" in the frontmatter of "UI-001" and no "ui/card.png"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L004" at "ui/UI-001-widget-card.md" line 1, id "UI-001", message "image card.png does not exist", fix "add the image at ui/card.png, or remove image:" (R1)

### S10: An Applies to member that does not exist
Given the base spec with "Applies to: alpha.Widget.weight" on line 6 of "core/invariants.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L004" at "core/invariants.md" line 6, id "INV-001", message "INV-001 applies alpha.Widget.weight, which does not exist" (R1)
And its fix is "did you mean alpha.Widget.size? Otherwise define alpha.Widget.weight first"

### S11: A screen link that does not suit the contract's kind
Given the base spec with "calls: [alpha.Widget]" on line 5 of the frontmatter of "UI-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L004" at "ui/UI-001-widget-card.md" line 5, id "UI-001", message "UI-001 calls alpha.Widget, which is an entity" (R1)
And its fix is "list alpha.Widget under shows; calls takes operation contracts" (R4)

### S12: Emitting an external module's event
Given the base spec with "external: true" on module "beta", without "BET-001", with an event "beta.Paid" in "modules/beta/contracts.md", and "ALP-001" naming it in "And beta.Paid is emitted" on line 21, after its Then
When lint.Lint runs
Then lint.Report.findings holds: error "L004" at "modules/alpha/features/ALP-001-make-a-widget.md" line 21, id "ALP-001" (R1, R3)
And its message is "ALP-001 emits beta.Paid, which belongs to external module beta"
And its fix is "consume it (consumes); the other system emits it"

### S13: A screen shows an operation
Given the base spec with the operation "alpha.MakeWidget" in "modules/alpha/contracts.md" and "shows: [alpha.MakeWidget]" on line 5 of the frontmatter of "UI-001"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L004" at "ui/UI-001-widget-card.md" line 5, id "UI-001", message "UI-001 shows alpha.MakeWidget, which is an operation" (R1)
And its fix is "list alpha.MakeWidget under calls; shows takes entity or type or event or error contracts" (R4)

## Rules
- R1: Every L004 finding is an error
- R2: A step that cites a missing contract or member is reported twice: once for the link the step derives, once for the cite
- R3: A feature may not provide an external module's operation nor emit its events; it may emit its errors
- R4: A screen's fix names shows or calls, never writes, provides or observes, which a screen does not have

## Out of scope
- Which link takes which contract kind: format
