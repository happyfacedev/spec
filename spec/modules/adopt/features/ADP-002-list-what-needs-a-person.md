---
id: ADP-002
title: List what still needs a person
module: adopt
status: active
provides: [adopt.Gaps]
questions:
  - id: Q1
    kind: preference
    text: A drafted module has no title, so its line in "Drafts to confirm" reads "- conversation  (from README.md)" with two spaces. Should a module show its first description line, or drop the extra space?
    default: Keep today's line, with the empty title
    cites: [ADP-002/S5]
    answer: 'Change requested in review (2026-10-29): Show the first line of the module''s description as its title. Done in PROP-002: see S5 and S18.'
    raised_by: null
  - id: Q2
    kind: preference
    text: The usage line says gaps lists "drafts, open questions and untested scenarios", but it also lists modules without features, unused contracts, tests for no scenario and code pointers not found. Should the usage line name them all?
    default: Keep the usage line as it is
    cites: [ADP-002/S1]
    answer: 'Change requested in review (2026-10-29): Name all 7 sections in the usage line. Done in PROP-002: see the usage text in CLI-001/S1.'
    raised_by: null
---
## Intent
`spec gaps` is the list `/spec-init` works through with the developer: every draft to confirm, every open question, and every part of the spec that looks unfinished. Each line is one thing to ask about. This feature covers the sections every run prints; untested scenarios and stale code pointers have their own features.

## Behaviour
### S1: The sections, in order
Given a spec with one drafted feature and nothing else unfinished
When the developer runs `spec gaps --no-tests` through adopt.Gaps
Then stdout starts "# Gaps · " followed by the spec's version, then a blank line
And four sections follow in adopt.GapKind order, each headed "## <title> (<count>)" and ended by a blank line: "Drafts to confirm", "Open questions", "Modules without features", "Contracts no feature uses"
And then "## Scenarios without a test" and "Not checked (no test run)."
And the command exits 0

### S2: An empty section
Given a spec with no open questions
When the developer runs `spec gaps --no-tests` through adopt.Gaps
Then the section reads "## Open questions (0)" and then "None"

### S3: A drafted unit and its sources
Given a feature "CNV-003" titled "Export to Markdown" with draft: true and sources: [src/conversation/export.ts:3, README.md]
When the developer runs `spec gaps --no-tests` through adopt.Gaps
Then "Drafts to confirm" holds the line "- CNV-003 Export to Markdown (from src/conversation/export.ts:3, README.md)"

### S4: A draft with no sources
Given the invariant "INV-002" titled "API keys never appear in logs" with "Status: active · Draft: yes"
When the developer runs `spec gaps --no-tests` through adopt.Gaps
Then "Drafts to confirm" holds the line "- INV-002 API keys never appear in logs", with no "(from" part

### S5: A drafted module shows its description
Given the module "conversation" with draft: true and sources: [README.md], whose first description line is "Owns the messages of a conversation."
When the developer runs `spec gaps --no-tests` through adopt.Gaps
Then "Drafts to confirm" holds the line "- conversation Owns the messages of a conversation. (from README.md)"
And adopt.DraftGap.title for "conversation" is "Owns the messages of a conversation."

### S6: A drafted contract shows its summary
Given the contract "conversation.Usage" marked "· Draft: yes" whose first description line is "The tokens one reply used."
When the developer runs `spec gaps --no-tests` through adopt.Gaps
Then "Drafts to confirm" holds the line "- conversation.Usage The tokens one reply used."

### S7: Drafts in natural ID order
Given drafted units "adopt.Gap", "PRV-002", "INV-001" and "CNV-003", written in that order
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.drafts lists them as "CNV-003", "INV-001", "PRV-002", "adopt.Gap"

### S8: Open questions, blockers first
Given the feature "CNV-002" with an unanswered blocker "Q2" reading "Stop twice?", and the module "conversation" with an unanswered preference "Q1" reading "Keep export?"
When the developer runs `spec gaps --no-tests` through adopt.Gaps
Then "Open questions" reads "## Open questions (2)", "- CNV-002#Q2 blocker: Stop twice?", "- conversation#Q1 preference: Keep export?"

### S9: An answered question is not listed
Given the feature "CNV-002" whose question "Q1" has an answer "done"
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.questions holds no entry with id "CNV-002#Q1"

### S10: A module without features
Given an active module "billing" that is not external and holds no feature
When the developer runs `spec gaps --no-tests` through adopt.Gaps
Then "Modules without features" holds the line "- billing"

### S11: An external module needs no features
Given a module "pay" with external: true and no features
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.modulesWithoutFeatures does not hold "pay"

### S12: A contract no feature uses
Given an active contract "billing.Invoice" that no feature step names and no contract's type names
When the developer runs `spec gaps --no-tests` through adopt.Gaps
Then "Contracts no feature uses" holds the line "- billing.Invoice"

### S13: A type used only inside another contract is used
Given a type "alpha.Size" named only in the Type of the member "alpha.Widget.size", and a feature that names "alpha.Widget"
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.unusedContracts is []

### S14: The total
Given a spec whose gaps are 2 drafts, 2 open questions, 1 untested scenario and 1 test for no scenario
When the developer runs `spec gaps` through adopt.Gaps
Then the last line is "6 gaps."

### S15: One gap
Given a spec whose only adopt.Gap is one drafted feature
When the developer runs `spec gaps --no-tests` through adopt.Gaps
Then the last line is "1 gap."

### S16: No gaps
Given a spec with no drafts, no open questions, no module without features, no unused contract, and every scenario tested
When the developer runs `spec gaps` through adopt.Gaps
Then the last line is "No gaps: every unit is confirmed, every question answered, every scenario tested."
And the command exits 0

### S17: JSON output
Given any spec
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then stdout is one JSON document, indented by two spaces, whose keys are, in order, adopt.GapReport.spec, "drafts", "questions", "modulesWithoutFeatures", "unusedContracts", "scenariosWithoutTests", "testsWithoutScenario" and "codeNotFound"
And for a spec with no drafts, the key "drafts" holds []

### S18: A drafted module with no description
Given the module "billing" with draft: true, sources: [README.md] and no description
When the developer runs `spec gaps --no-tests` through adopt.Gaps
Then "Drafts to confirm" holds the line "- billing (from README.md)", with one space after the ID
And adopt.DraftGap.title for "billing" is ""

### S19: An external question is listed with the blockers
Given the feature "CNV-002" with an unanswered external question "Q3" reading "Does the export API page results?" and an unanswered blocker "Q2" reading "Stop twice?", and the module "conversation" with an unanswered preference "Q1" reading "Keep export?"
When the developer runs `spec gaps --no-tests` through adopt.Gaps
Then "Open questions" reads "## Open questions (3)", "- CNV-002#Q2 blocker: Stop twice?", "- CNV-002#Q3 external: Does the export API page results?", "- conversation#Q1 preference: Keep export?"

## Rules
None

## Out of scope
- Running the tests and listing untested scenarios: "ADP-003"
- Checking `Code:` lines against the code: "ADP-004"
- Questions on tickets: `spec queue` and the gate, in the tickets module
