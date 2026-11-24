---
id: LNT-016
title: Report types outside the spec's notation (L022)
module: lint
status: active
writes: [lint.Report.findings]
---
## Intent
Every `Type:` and `Output:` is written in the spec's one type notation, whatever the stack, so a spec shared by several stacks reads the same and every named type is a link impact can follow. Each member states its type once, and each contract kind has one shape. L022 reports a type the notation does not have, with the portable form where there is one, and a contract or member of the wrong shape. Each scenario starts from the base spec of LNT-001 and runs lint.Lint. Inside a quoted message or fix, '' stands for a double quote the text holds.

## Behaviour
### S1: A name the spec never defines
Given the base spec with "Type: Label" on member "alpha.Widget.name", line 8 of "modules/alpha/contracts.md"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L022" at "modules/alpha/contracts.md" line 8, id "alpha.Widget.name" (R1)
And its message is "''Label'' is not a spec type: Label is not defined; add it as a type contract and write <module>.Label"
And its fix is "write it in the spec's type language: string, int, number, decimal, bool, bytes, date, datetime, duration, null, ''literals'', <module>.<Name>, T[], map<K, V>, A | B, and on a member T? for ''may be absent'' (docs/FORMAT.md)"

### S2: A defined type written bare
Given the base spec with a type "alpha.Size" on line 20 and "Type: Size" on member "alpha.Widget.size", line 11
When lint.Lint runs
Then lint.Report.findings holds: error "L022" at "modules/alpha/contracts.md" line 11, id "alpha.Widget.size", with the fix of S1 (R1)
And its message is "''Size'' is not a spec type: Size is written bare; write alpha.Size"

### S3: A native spelling
Given the base spec with "Type: List<string>" on member "alpha.Widget.name"
When lint.Lint runs
Then lint.Report.findings is exactly one "L022" error on "alpha.Widget.name" at line 8, with the fix of S1 (R1, R4)
And its message is "''List<string>'' is not a spec type: List is not a spec type; write string[]"

### S4: A lowercase name that is no primitive
Given the base spec with "Type: text" on member "alpha.Widget.name"
When lint.Lint runs
Then lint.Report.findings is exactly one "L022" error on "alpha.Widget.name" at line 8, with the fix of S1 (R1)
And its message is "''text'' is not a spec type: text is not a primitive (string, int, number, decimal, bool, bytes, date, datetime, duration, null)"

### S5: An inline object
Given the base spec with "Type: { a: string }" on member "alpha.Widget.name"
When lint.Lint runs
Then lint.Report.findings is exactly one "L022" error on "alpha.Widget.name" at line 8, with the fix of S1 (R1)
And its message is "''{ a: string }'' is not a spec type: an inline object; name it as a Kind: type contract with members"

### S6: An optional union without parentheses
Given the base spec with "Type: string | null?" on member "alpha.Widget.name"
When lint.Lint runs
Then lint.Report.findings is exactly one "L022" error on "alpha.Widget.name" at line 8, with the fix of S1 (R1)
And its message is "''string | null?'' is not a spec type: ? makes the whole type optional; write (string | null)?"

### S7: An optional type on a contract
Given the base spec with a type "alpha.Size" whose line 5 is "A size. Type: number?"
When lint.Lint runs
Then lint.Report.findings holds: error "L022" at "modules/alpha/contracts.md" line 5, id "alpha.Size", with the fix of S1 (R1)
And its message is "''number?'' is not a spec type: only a member may be optional (?)"

### S8: A member without a type
Given the base spec with "The widget's name." and no "Type:" on member "alpha.Widget.name", whose heading is line 7
When lint.Lint runs
Then lint.Report.findings is exactly: error "L022" at "modules/alpha/contracts.md" line 7, id "alpha.Widget.name", message "alpha.Widget.name has no Type:" (R2)
And its fix is "end its description with ''Type: <type>''"

### S9: A member with two types
Given the base spec with a second line "Type: int" on line 9, under member "alpha.Widget.name"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L022" at "modules/alpha/contracts.md" line 9, id "alpha.Widget.name", message "alpha.Widget.name has 2 Type: lines; a member has one type" (R2)
And its fix is "keep the one that is true; write any union as one expression, A | B"

### S10: An entity with a type line
Given the base spec with "One widget. Type: string" on line 5, the summary of "alpha.Widget"
When lint.Lint runs
Then lint.Report.findings is exactly: error "L022" at "modules/alpha/contracts.md" line 5, id "alpha.Widget", message "entity alpha.Widget has a Type: line; an entity is described by its members" (R3)
And its fix is "give it #### members, or make it a Kind: type"

### S11: A type with both a type line and members
Given the base spec with a type "alpha.Size" holding "Type: number" on line 5 and a member "alpha.Size.cm"
When lint.Lint runs
Then lint.Report.findings holds: error "L022" at "modules/alpha/contracts.md" line 5, id "alpha.Size", message "type alpha.Size has both a Type: and members; it is one or the other" (R3)
And its fix is "keep the Type: for a value like an ID or a union, or the members for a record"

### S12: A type with neither
Given the base spec with a type "alpha.Size" on line 3 that has only a summary
When lint.Lint runs
Then lint.Report.findings holds: error "L022" at "modules/alpha/contracts.md" line 3, id "alpha.Size", message "type alpha.Size has neither a Type: nor members" (R3)
And its fix is "add ''Type: <type>'', or #### members with their types"

### S13: An operation with a type line
Given the base spec with an operation "alpha.MakeWidget" whose line 5 is "Makes one. Type: null"
When lint.Lint runs
Then lint.Report.findings holds: error "L022" at "modules/alpha/contracts.md" line 5, id "alpha.MakeWidget", message "operation alpha.MakeWidget has a Type: line; an operation has members and an Output:" (R3)
And its fix is "write its result as ''Output: <type>''"

### S14: An error with a type line
Given the base spec with an error "alpha.Gone" on line 20 of "modules/alpha/contracts.md", whose line 22 is "The widget is gone. Type: string"
When lint.Lint runs
Then lint.Report.findings holds: error "L022" at "modules/alpha/contracts.md" line 22, id "alpha.Gone", message "error alpha.Gone has a Type: line; an error is described by its members" (R3)
And its fix is "give it #### members, or make it a Kind: type"

### S15: Optional names both readings
Given the base spec with "Type: Optional<string>" on member "alpha.Widget.name"
When lint.Lint runs
Then lint.Report.findings is exactly one "L022" error on "alpha.Widget.name" at line 8, with the fix of S1 (R1, R4)
And its message is "''Optional<string>'' is not a spec type: Optional is not a spec type; write string? (may be absent) or string | null (may be null)"

### S16: Set keeps uniqueness as a rule
Given the base spec with "Type: Set<string>" on member "alpha.Widget.name"
When lint.Lint runs
Then lint.Report.findings is exactly one "L022" error on "alpha.Widget.name" at line 8, with the fix of S1 (R1, R4)
And its message is "''Set<string>'' is not a spec type: Set is not a spec type; write string[], and state that items are unique as a rule"

## Rules
- R1: A Type: or Output: outside the notation is an L022 error at its line, on the contract or member that holds it, and every such finding has the same fix
- R2: A live member has exactly one Type: line; none or two is an L022 error
- R3: A live type is a Type: or members, never both nor neither; a live entity, event or error has no Type: or Output: line; a live operation has no Type: line; each breach is an L022 error
- R4: A native spelling's message names its portable form: List, Array, Iterable, Sequence and Vec are T[]; Map, Dict and Record are map; Optional, Option and Maybe name both T? and T | null; Nullable is T | null; Set is T[] with uniqueness as a rule; String, Int, Integer, Long, Number, Double, Float, Decimal, BigDecimal, Bool, Boolean, DateTime, Date, Duration and Uint8List, and long, integer, double, float and boolean, are their primitives; void and None are null; undefined is T? or null

## Out of scope
- The notation itself: format
- A qualified name in a type that names no contract: L004
