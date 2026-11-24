---
id: TKT-008
title: The gate checks the units a ticket names
module: tickets
status: active
---
## Intent
A ticket may start only when everything it names exists and is current, a person has confirmed what it builds on, and its scope holds every feature that produces a contract it changes. Each refusal names the unit and, where it can, the fix: the ID it probably meant, or the unit that replaced a removed one.

## Behaviour
### S1: An ID that does not exist, with a suggestion
Given the spec has the feature "PRV-001" and no "PRV-009"
And "TASK-901" touches "PRV-009"
When the developer runs `spec gate TASK-901` through tickets.Gate
Then tickets.GateResult.blockers is exactly one tickets.GateBlocker: kind "unresolved", id "PRV-009", text "PRV-009 does not exist; did you mean PRV-001?" (R1)

### S2: An ID that does not exist, with nothing close
Given no unit ID is within the suggestion distance of "zzz.Nothing"
And "TASK-931" touches "zzz.Nothing"
When the developer runs `spec gate TASK-931` through tickets.Gate
Then tickets.GateResult.blockers holds kind "unresolved", id "zzz.Nothing", text "zzz.Nothing does not exist" (R1)

### S3: A scenario in violates that does not exist
Given the spec has no scenario "CNV-003/S9"
And "BUG-303" violates "CNV-003/S9"
When the developer runs `spec gate BUG-303` through tickets.Gate
Then tickets.GateResult.blockers holds kind "unresolved" and id "CNV-003/S9" (R1)

### S4: A removed unit points to its replacement
Given the screen "UI-001" has status removed and superseded_by "UI-002"
And "TASK-902" touches "UI-001"
When the developer runs `spec gate TASK-902` through tickets.Gate
Then tickets.GateResult.blockers is exactly one tickets.GateBlocker: kind "removed", id "UI-001", text "UI-001 is removed; use UI-002" (R2)

### S5: A removed unit with no replacement
Given the feature "PRV-003" has status removed and no superseded_by
And "TASK-932" touches "PRV-003"
When the developer runs `spec gate TASK-932` through tickets.Gate
Then tickets.GateResult.blockers holds kind "removed", id "PRV-003", text "PRV-003 is removed" (R2)

### S6: A deprecated unit may be worked on
Given the screen "UI-001" has status deprecated
And "TASK-902" touches "UI-001"
When the developer runs `spec gate TASK-902` through tickets.Gate
Then tickets.GateResult.blockers is empty (R2)

### S7: A unit in a removed module
Given the module "providers" has status removed while its feature "PRV-001" is still active
And "TASK-933" touches "PRV-001" and "PRV-001/S1"
When the developer runs `spec gate TASK-933` through tickets.Gate
Then tickets.GateResult.blockers holds exactly one tickets.GateBlocker of kind "removed" with id "providers", and its text is "PRV-001 is in module providers, which is removed" (R3)

### S8: A draft in scope
Given the feature "CNV-003" is a draft
And "TASK-934" touches "CNV-003/S1"
When the developer runs `spec gate TASK-934` through tickets.Gate
Then tickets.GateResult.blockers holds kind "draft", id "CNV-003", text "CNV-003 is a draft, not yet confirmed" (R4)

### S9: A draft member names its contract
Given the contract "conversation.Message" is a draft
And "TASK-935" touches "conversation.Message.usage"
When the developer runs `spec gate TASK-935` through tickets.Gate
Then tickets.GateResult.blockers holds kind "draft" with id "conversation.Message" (R4)

### S10: A draft a feature in scope uses
Given "TASK-936" touches the confirmed feature "CNV-001", whose steps read the drafted contract "conversation.Message"
When the developer runs `spec gate TASK-936` through tickets.Gate
Then tickets.GateResult.blockers holds kind "draft" with id "conversation.Message" (R4)

### S11: A draft reached through a type
Given the confirmed feature "PRV-002" emits the confirmed event "providers.FallbackTriggered", whose member is typed by the drafted type "providers.ProviderId"
And "TASK-937" touches "PRV-002"
When the developer runs `spec gate TASK-937` through tickets.Gate
Then tickets.GateResult.blockers holds kind "draft" with id "providers.ProviderId" (R4)

### S12: A scope gap
Given the feature "SET-002" writes "settings.ApiKey", and no ticket feature is "SET-002"
And "PROP-903" touches only "settings.ApiKey"
When the developer runs `spec gate PROP-903` through tickets.Gate
Then tickets.GateResult.blockers is exactly one tickets.GateBlocker: kind "scope_gap", id "SET-002", text "SET-002 writes settings.ApiKey: add it to touches" (R5)

### S13: A member and its whole contract match
Given the feature "SET-002" writes the whole contract "settings.ApiKey"
And "PROP-938" touches "settings.ApiKey.secret" and not "SET-002"
When the developer runs `spec gate PROP-938` through tickets.Gate
Then tickets.GateResult.blockers holds kind "scope_gap" with id "SET-002" (R5)

### S14: A removed feature leaves no gap
Given the feature "SET-002" has status removed
And "PROP-903" touches only "settings.ApiKey"
When the developer runs `spec gate PROP-903` through tickets.Gate
Then tickets.GateResult.blockers holds no "scope_gap" (R5)

## Rules
- R1: Every ID in touches and violates names a unit of the spec; one that does not is refused, with the closest ID when one is near enough to be a typo
- R2: A removed unit is history and is refused, naming what superseded it when anything did; a deprecated unit is still served, so work on it may start
- R3: A unit whose module is removed is refused, once per module, whatever its own status
- R4: Work never builds on a draft: a drafted unit in scope is refused, as is any draft that a feature in scope names in its links, directly or through the types those contracts use; a scenario, rule or member is reported as its feature or contract
- R5: Every active feature that writes or emits a contract in touches or changed must itself be in scope; a contract and its members match each other

## Out of scope
- Questions on the units in scope (TKT-007) and dependencies (TKT-009)
- What a change reaches beyond its scope: graph (`spec impact`)
