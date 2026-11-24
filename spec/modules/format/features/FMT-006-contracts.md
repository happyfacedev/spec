---
id: FMT-006
title: Define contracts and their members
module: format
status: active
retired: [S8, S9, S10, S11, S12, S13, R6, R7]
---
## Intent
A contract names one thing features share: an entity, an event, an operation, a type or an error. It lives in its module's contracts file as a heading with a status line, a one-line summary, optional `Code:`, `Output:`, `Type:` and `Decisions:` lines, and `####` members, each with its own type. A qualified name in a type is a link, so a change to a type reaches everything typed by it; a name in a description is only for the reader.

## Behaviour
### S1: The status line gives the kind
Given "modules/alpha/contracts.md" has the heading "### alpha.Size" and under it the line "Kind: type · Status: active"
When `spec build` writes "_generated/graph.json"
Then its node "alpha.Size" has format.Contract.kind "type" and format.Contract.status "active" (R1)

### S2: Types and errors are contracts, and members work under every kind
Given the error "alpha.TooSmall" has the member "alpha.TooSmall.size" with "Type: alpha.Size"
When `spec show "alpha.TooSmall.size" --format json` runs
Then format.Unit.kind is "field" (R2)
And the node "alpha.TooSmall" in "_generated/graph.json" has format.Contract.kind "error"

### S3: The summary skips the Code and Output lines
Given the operation "alpha.MakeWidget" has, under its status line, "Makes one widget.", "Code: Factory.makeWidget" and "Output: alpha.Widget"
When `spec build` writes "_generated/graph.json"
Then the node "alpha.MakeWidget" has the title "Makes one widget.", which is format.Contract.summary (R3)

### S4: A qualified name in a member's type is a link
Given the member "alpha.Widget.size" has "Type: alpha.Size"
When `spec build` writes "_generated/graph.json"
Then its "edges" hold a format.Link from "alpha.Widget.size" to "alpha.Size" of kind "uses" (R4)

### S5: An ID in a description is not a link
Given the error "alpha.TooSmall" is described as "The requested size is below 1, so no alpha.Widget is made."
When `spec build` writes "_generated/graph.json"
Then its "edges" hold no format.Link from "alpha.TooSmall" to "alpha.Widget" (R4)

### S6: An operation's output links what it returns
Given the operation "alpha.MakeWidget" has "Output: alpha.Widget | alpha.TooSmall"
When `spec show "alpha.TooSmall"` runs
Then its "Used by:" list holds "- alpha.MakeWidget uses — Makes one widget." (R4)
And format.Contract.output of "alpha.MakeWidget" names both

### S7: A Decisions line links the decisions behind a contract
Given the entity "alpha.Widget" has the line "Decisions: ADR-001" under its status line
When `spec show "ADR-001"` runs
Then its "Used by:" list holds "- alpha.Widget decisions — One widget." (R5)
And format.Contract.decisions of "alpha.Widget" is the one ID

### S14: A member's own status line
Given the member "alpha.Widget.size" starts with "Status: deprecated · Superseded by: alpha.Widget.name"
When `spec show "alpha.Widget.size" --format json` runs
Then format.Member.status is "deprecated" (R8)
And format.Member.supersededBy is "alpha.Widget.name"

## Rules
- R1: A contract is a "### <module>.<Name>" heading whose next line is "Kind: <kind> · Status: <status>", optionally followed by "· Superseded by: <ID>" and "· Draft: <sources>". The kinds are entity, event, operation, type and error.
- R2: Members are "#### <contract>.<member>" headings under any kind, each with a description and one Type: line.
- R3: The summary is the first line after the status line that is not a Decisions, Output, Code or list line.
- R4: Only a qualified name in a Type: or Output: expression links a contract to another (uses); a name in a description, or in a quoted literal, does not.
- R5: A "Decisions: <ADR>, <ADR>" line links a contract to the decisions behind it.
- R8: A member may start with "Status: <status> · Superseded by: <ID>"; otherwise it has its contract's status.

## Out of scope
- The type notation: FMT-007
- Checking a Code: line against the code: adopt
- A contract defined in another module's file, and contracts nothing references: lint
- The findings for format 1 Payload, Input and In code lines, a Code: line holding a signature, and a contract of the wrong shape: LNT-005, LNT-016
