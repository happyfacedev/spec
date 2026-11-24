---
id: FMT-011
title: Describe screens
module: format
status: active
observes: [lint.Finding.file]
retired: [S3]
questions:
  - id: Q1
    kind: preference
    text: "A screen's frontmatter may hold image: a picture under ui/. docs/FORMAT.md does not mention it. Keep it?"
    default: "Yes: image stays an optional key"
    cites: [FMT-011/S6]
    answer: 'Keep today''s behaviour; fix the docs or wording only (decided in review, 2026-10-29).'
    raised_by: null
---
## Intent
A screen describes one view of the product: its layout, its states and its copy. It names the contracts it renders and the operations its controls call, so a change to those contracts reaches the screen, and a scenario that shows the screen cites it.

## Behaviour
### S1: A screen names what it shows
Given "ui/UI-001-widget-card.md" has "shows: [alpha.Widget.size]"
When `spec show "alpha.Widget.size"` runs
Then its "Used by:" list holds "- UI-001 shows — Widget card", a format.Link of kind "shows" (R1)
And format.Screen.shows of "UI-001" is that one member

### S2: A screen names what its controls call
Given "UI-001" has "calls: [alpha.MakeWidget]"
When `spec show "alpha.MakeWidget"` runs
Then its "Used by:" list holds "- UI-001 calls — Widget card" (R1)
And format.Screen.calls of "UI-001" is that one operation

### S4: A scenario shows a screen by citing it
Given the feature "ALP-001" lists "ui: [UI-001]" and its scenario "ALP-001/S1", titled "Widget made", has the step "And UI-001 is shown"
When `spec show "UI-001"` runs
Then its "Used by:" list holds "- ALP-001 ui — Make a widget" (R2)
And its "Cited by:" list holds "- ALP-001/S1 — Widget made"

### S5: Copy is optional
Given "UI-001" has "## Layout" and "## States" and no "## Copy"
When `spec lint` runs
Then it reports no finding whose lint.Finding.file is "ui/UI-001-widget-card.md" (R3)

### S6: An image is a file under ui
Given "UI-001" has "image: card.png"
When `spec lint` runs and "ui/card.png" exists
Then it reports no finding whose lint.Finding.file is "ui/UI-001-widget-card.md" (R4)

## Rules
- R1: shows lists entities, types, events and errors (or members) the screen renders; calls lists operations its controls invoke.
- R2: A feature lists under ui every screen its steps cite.
- R3: A screen file is frontmatter, then "## Layout", "## States" and an optional "## Copy"; States and Copy may say None.
- R4: image is a path relative to ui/ (or starting with ui/) of a file in the spec.

## Out of scope
- Which screen changes are behaviour and which are rewording: pipeline
- Impact on a screen: graph
- The findings for a screen link that does not suit the contract's kind and a missing image: LNT-008
