---
id: FMT-014
title: Ask open questions on spec units
module: format
status: active
---
## Intent
A doubt about a unit is recorded in the frontmatter of the feature, module, screen or decision it is about, where the person who confirms the unit will find it. A question that cites units links to them, so they show who is asking about them.

## Behaviour
### S1: A question on a feature
Given the feature "BET-001" has under format.Feature.questions the question "Q1" of kind "blocker" with "answer: null"
When `spec build` writes "_generated/graph.json"
Then its "questions" hold owner "BET-001", id "Q1", kind "blocker" and open true (R1)

### S2: An answered question is closed
Given the question "Q1" on "BET-001" has the answer "Refused"
When `spec build` writes "_generated/graph.json"
Then its "questions" hold owner "BET-001", id "Q1" and open false (R1)

### S3: A question cites the units it is about
Given the question "Q1" on "BET-001" has "cites: [alpha.Widget.size]"
When `spec show "alpha.Widget.size"` runs
Then its "Cited by:" list holds "- BET-001#Q1 — Order a widget" (R2)
And format.Link.from is "BET-001#Q1" with format.Link.kind "cites"

### S4: Modules, screens and decisions carry questions too
Given the module "alpha" has under format.Module.questions the question "Q1" of kind "preference" with a default
When `spec build` writes "_generated/graph.json"
Then its "questions" hold owner "alpha", id "Q1", kind "preference" and open true (R3)

## Rules
- R1: A question is open until its answer is set.
- R2: A question's cites link it, as <owner>#<id>, to the units it is about.
- R3: Features, modules, screens and decisions may carry questions; contracts and invariants, which have no frontmatter, cannot.

## Out of scope
- The question's own fields and kinds: tickets
- Listing open questions for a person: adopt
