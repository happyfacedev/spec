---
id: ADP-005
title: Confirm drafted units
module: adopt
status: active
provides: [adopt.Confirm]
writes: [adopt.DraftMarker, adopt.StatusDraft]
questions:
  - id: Q1
    kind: preference
    text: The conventions say a command that fails on the user's input prints its message on stderr, but spec confirm prints each problem on stdout (after the confirmed lines) and exits 1. Should problems go to stderr?
    default: Keep problems on stdout
    cites: [ADP-005/S9]
    answer: 'Change requested in review (2026-10-29): Print problems on stderr. Confirmed lines stay on stdout. Landed with PROP-004: each problem is a line on stderr, confirmed lines stay on stdout, the exit code is unchanged, and --format json still prints one document on stdout.'
    raised_by: null
---
## Intent
Once a person has checked a drafted unit against what the software should do, `spec confirm` removes its draft marker and nothing else, so it becomes ordinary spec and work may build on it. It takes several IDs at once and confirms each one it can.

## Behaviour
### S1: Confirm a feature
Given the feature "CNV-003" whose frontmatter holds the lines "draft: true" and "sources: [src/conversation/export.ts:3, README.md]"
When the developer runs "spec confirm CNV-003" through adopt.Confirm
Then the file is exactly as before without those two lines, so adopt.DraftMarker.draft and adopt.DraftMarker.sources are gone
And stdout is "CNV-003: confirmed"
And the command exits 0

### S2: Confirm a module with a block list of sources
Given the module "conversation" whose frontmatter holds "draft: true", then "sources:" and the items "  - README.md" and "  - src/a.ts"
When the developer runs "spec confirm conversation" through adopt.Confirm
Then all four lines leave the frontmatter, and adopt.DraftMarker.sources is gone, and every other line stays as it was

### S3: Confirm a contract
Given the contract "conversation.Message" whose status line is "Kind: entity · Status: active · Draft: src/conversation/message.ts:15"
When the developer runs "spec confirm conversation.Message" through adopt.Confirm
Then that line becomes "Kind: entity · Status: active", the adopt.StatusDraft removed, and nothing else in the file changes

### S4: Confirm an invariant
Given the invariant "INV-002" whose status line is "Status: active · Draft: yes"
When the developer runs "spec confirm INV-002" through adopt.Confirm
Then that line becomes "Status: active", the adopt.StatusDraft removed

### S5: Several IDs in one run
Given the drafted units "CNV-003", "conversation.Message" and "INV-002"
When the developer runs "spec confirm CNV-003 conversation.Message INV-002" through adopt.Confirm
Then stdout is the lines "CNV-003: confirmed", "conversation.Message: confirmed" and "INV-002: confirmed", in that order
And `spec gaps --no-tests --format json` then shows adopt.GapReport.drafts as []

### S6: A scenario is confirmed with its feature
Given the feature "CNV-001" with a scenario "CNV-001/S1"
When the developer runs "spec confirm CNV-001/S1" through adopt.Confirm
Then it fails with adopt.ConfirmedWithOwner: stderr is "CNV-001/S1 is confirmed with its feature: spec confirm CNV-001" and stdout is empty
And the command exits 1

### S7: A member is confirmed with its contract
Given the contract "conversation.Message" with a member "conversation.Message.content"
When the developer runs "spec confirm conversation.Message.content" through adopt.Confirm
Then it fails with adopt.ConfirmedWithOwner: stderr is "conversation.Message.content is confirmed with its contract: spec confirm conversation.Message"

### S8: An unknown ID with a near match
Given the spec has "INV-001" and no "INV-099"
When the developer runs "spec confirm INV-099" through adopt.Confirm
Then it fails with adopt.NotAUnit: stderr is "INV-099 is not a unit; did you mean INV-001?"
And the command exits 1

### S9: An unknown ID with no near match
Given no unit ID is close to "zzzzqq"
When the developer runs "spec confirm zzzzqq" through adopt.Confirm
Then it fails with adopt.NotAUnit: stderr is "zzzzqq is not a unit", stdout is empty, and the command exits 1

### S10: A unit that is not a draft
Given the feature "CNV-001" with no draft marker
When the developer runs "spec confirm CNV-001" through adopt.Confirm
Then it fails with adopt.NotADraft: stderr is "CNV-001 is not a draft"
And no file changes

### S11: The same ID twice
Given the drafted module "conversation"
When the developer runs "spec confirm conversation conversation" through adopt.Confirm
Then stdout is "conversation: confirmed"
And stderr is "conversation: its draft marker was not found in modules/conversation/_module.md", which is adopt.DraftMarkerNotFound
And the command exits 1

### S12: Confirmed lines on stdout, problems on stderr
Given the drafted feature "CNV-003", the scenario "CNV-001/S1" and the feature "CNV-001" with no draft marker
When the developer runs "spec confirm CNV-001/S1 CNV-003 CNV-001" through adopt.Confirm
Then stdout is "CNV-003: confirmed"
And stderr is the lines "CNV-001/S1 is confirmed with its feature: spec confirm CNV-001" and "CNV-001 is not a draft", in that order
And "CNV-003" is confirmed in its file although the run exits 1

### S13: JSON output
Given the drafted contract "conversation.Usage" and a feature "CNV-001" that is not a draft
When the developer runs "spec confirm conversation.Usage CNV-001 --format json" through adopt.Confirm
Then stdout is one JSON document with adopt.ConfirmResult.confirmed ["conversation.Usage"] and adopt.ConfirmResult.problems ["CNV-001 is not a draft"]
And stderr is empty, and the command exits 1

### S14: No IDs
Given any spec
When the developer runs `spec confirm` through adopt.Confirm
Then it fails with cli.UsageError: stderr is "usage: spec confirm <ID>...", a blank line, and the usage text; stdout is empty
And the command exits 2

## Rules
None

## Out of scope
- Rebuilding `index.md` and `_generated/graph.json`: done after any confirm, as `spec build` does
- Checking the drafted unit against the code: a person does that before confirming
- Letting work start on a confirmed unit: the gate, in the tickets module
