---
id: ADP-001
title: Mark a unit as a draft
module: adopt
status: active
questions:
  - id: Q1
    kind: preference
    text: A member's status line accepts "· Draft:" without an error, but the marker makes nothing a draft, spec gaps never lists it, and spec confirm cannot remove it (it points at the contract). Should a member's "· Draft:" be refused by lint, or make its contract a draft?
    default: Lint refuses the marker on a member and says to mark the contract instead
    cites: [ADP-001/S8]
    answer: 'Change requested in review (2026-10-29): Lint refuses the marker on a member and says to mark the contract instead.'
    raised_by: null
---
## Intent
A unit written from code or docs by an agent, and not yet checked by a person, carries a draft marker that says where it came from. The marker is what `spec gaps` lists and `spec confirm` removes, so a person can go through the drafts one by one.

## Behaviour
### S1: A feature marked in its frontmatter
Given a feature "CNV-003" whose frontmatter holds adopt.DraftMarker.draft true and adopt.DraftMarker.sources [src/conversation/export.ts:3, README.md]
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.drafts holds "CNV-003" with sources ["src/conversation/export.ts:3", "README.md"] and file "modules/conversation/features/CNV-003-export-to-markdown.md"

### S2: Modules, decisions and screens take the same keys
Given a module "conversation", a decision "ADR-001" and a screen "UI-001", each with draft: true and sources: [README.md] in its frontmatter
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.drafts holds "conversation", "ADR-001" and "UI-001", each with sources ["README.md"]

### S3: Sources as a block list
Given the module "conversation" whose frontmatter holds draft: true and sources written as a YAML block list of "README.md" and "src/a.ts"
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.drafts holds "conversation" with sources ["README.md", "src/a.ts"]

### S4: Sources without draft true mark nothing
Given a feature "CNV-001" whose frontmatter holds sources: [README.md] and no draft key
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.drafts does not hold "CNV-001"

### S5: A contract marked on its status line
Given the contract "conversation.Message" whose status line is "Kind: entity · Status: active · Draft: src/conversation/message.ts:15"
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.drafts holds "conversation.Message" with sources ["src/conversation/message.ts:15"]

### S6: Several sources on a status line
Given the contract "conversation.Usage" whose status line ends adopt.StatusDraft "· Draft: src/usage.ts:4, README.md"
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.drafts holds "conversation.Usage" with sources ["src/usage.ts:4", "README.md"]

### S7: An invariant marked as a draft with no sources
Given the invariant "INV-002" whose first line is "Status: active · Draft: yes"
When the developer runs `spec gaps --no-tests --format json` through adopt.Gaps
Then adopt.GapReport.drafts holds "INV-002" with sources []

### S8: A member's draft marker is refused
Given the member "conversation.Message.content" whose first line, line 9 of "modules/conversation/contracts.md", is "Status: active · Draft: src/x.ts" under a confirmed contract "conversation.Message", in an otherwise clean spec
When the developer runs `spec lint` and then `spec gaps --no-tests --format json` through adopt.Gaps
Then lint.Report.findings is exactly: error "L001" at "modules/conversation/contracts.md" line 9, id "conversation.Message.content", fix "move · Draft: <sources> to the status line of conversation.Message" (R1)
And its message is "· Draft: marks a contract, not a member; mark the contract conversation.Message instead"
And cli.CommandResult.exitCode of the lint run is 1
And adopt.GapReport.drafts holds neither "conversation.Message.content" nor "conversation.Message"

### S9: Lint accepts drafts
Given a feature, a contract and an invariant each marked as a draft, in an otherwise clean spec
When the developer runs `spec lint`
Then it exits 0

## Rules
- R1: A member's status line that holds "· Draft:" is an L001 error, whatever its sources: a draft marks a contract or an invariant, so the marker goes on the status line of the contract the member is in

## Out of scope
- Refusing work that builds on a draft: the gate, in the tickets module
- Scenarios, rules and members have no marker of their own: they are drafts while their feature or contract is
- Writing the drafts: the `/spec-init` command
