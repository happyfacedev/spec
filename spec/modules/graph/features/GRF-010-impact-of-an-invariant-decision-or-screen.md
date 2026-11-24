---
id: GRF-010
title: Reach of a change to an invariant, decision or screen
module: graph
status: active
writes: [graph.Impact.mustChange, graph.Impact.reverify]
questions:
  - id: Q1
    kind: preference
    text: Before PROP-010, impact on an invariant counted only scenarios that cite it directly, so in a feature where only a rule cited it (and a scenario cited the rule), every scenario was reached. Impact on a contract the invariant applies to counts a scenario that cites such a rule as showing the invariant, and docs/FORMAT.md says "A scenario shows an invariant by citing it, or a rule that cites it". Should impact on the invariant also reach only the scenarios that cite such a rule?
    default: Keep the behaviour of that time, every scenario of that feature.
    cites: [GRF-010/S3]
    answer: 'Change requested in review (2026-10-29): Reach only the scenarios that cite the invariant or a rule that cites it. Landed with PROP-010: see R1, S3 and S11.'
    raised_by: null
---
## Intent
An invariant, a decision or a screen is not linked through contracts but cited: features list it in their frontmatter, and scenarios, rules and questions name it. A change to one must change every feature that rests on it, and the reach is as narrow as the citations allow: an invariant reaches the scenarios that check it (citing it, or a rule that cites it), a screen the scenarios that show it, and a decision, which explains a whole feature, all of its scenarios. Nothing is re-verified: every feature reached must change.

## Behaviour
### S1: An invariant reaches the scenarios that cite it
Given the "chat-mini" fixture spec, where "INV-001" is listed by "CNV-001", "PRV-002" and "SET-001" and cited by "CNV-001/S2", "PRV-002/S4", "PRV-002/R1" and "SET-001/S2"
When the developer runs spec impact "INV-001" through graph.ComputeImpact
Then graph.Impact.mustChange is "CNV-001" with scenarios "CNV-001/S2", "PRV-002" with "PRV-002/S4", and "SET-001" with "SET-001/S2" (R1)
And the item "PRV-002" has the via ["PRV-002/R1 cites INV-001", "PRV-002/S4 cites INV-001", "invariants INV-001"]
And graph.Impact.reverify is empty (R3)

### S2: A feature that lists an invariant no step cites has every scenario reached
Given the "chat-mini" fixture spec, where "SET-002" lists "INV-002" and none of its steps cites it
When the developer runs spec impact "INV-002" through graph.ComputeImpact
Then graph.Impact.mustChange holds "SET-002" via "invariants INV-002" with scenarios "SET-002/S1" and "SET-002/S2" (R1)

### S3: An invariant cited only through a rule reaches the scenarios that cite that rule
Given the "chat-mini" fixture spec, changed so that "PRV-002/S4" cites only "PRV-002/R1", which cites "INV-001"
When the developer runs spec impact "INV-001" through graph.ComputeImpact
Then graph.Impact.mustChange holds "PRV-002" via "PRV-002/R1 cites INV-001" and "invariants INV-001", with scenarios "PRV-002/S4" only (R1)

### S4: A question that cites an invariant reaches its feature
Given feature "ALP-001" has question "Q1" citing "INV-001", and does not list or cite "INV-001" anywhere else
When the developer runs spec impact "INV-001" through graph.ComputeImpact
Then graph.Impact.mustChange holds "ALP-001" via "ALP-001#Q1 cites INV-001", with every scenario of "ALP-001"

### S5: A decision reaches every scenario of the features that list it
Given the "chat-mini" fixture spec, where "PRV-002" lists "ADR-002"
When the developer runs spec impact "ADR-002" through graph.ComputeImpact
Then graph.Impact.mustChange holds "PRV-002" via "decisions ADR-002" with scenarios "PRV-002/S1" to "PRV-002/S4" (R2)

### S6: A decision reaches the contracts that name it
Given the "chat-mini" fixture spec, where "providers.ProviderConfig" has the line "Decisions: ADR-002" and "conversation.Message" the line "Decisions: ADR-001"
When the developer runs spec impact "ADR-002" through graph.ComputeImpact
Then graph.Impact.mustChange holds "providers.ProviderConfig" via "decisions ADR-002" with no scenarios (R2)
And spec impact "ADR-001" gives graph.Impact.mustChange the one item "conversation.Message", with no scenarios

### S7: A decision reaches the invariants that name it
Given invariant "INV-001" has the line "Decisions: ADR-001"
When the developer runs spec impact "ADR-001" through graph.ComputeImpact
Then graph.Impact.mustChange holds "INV-001" via "decisions ADR-001" with no scenarios (R2)

### S8: A screen reaches only the scenarios that show it
Given the "chat-mini" fixture spec, where "PRV-002" lists "UI-001" and only "PRV-002/S1" shows it
When the developer runs spec impact "UI-001" through graph.ComputeImpact
Then graph.Impact.mustChange is exactly "PRV-002" via "PRV-002/S1 cites UI-001" and "ui UI-001", with scenarios "PRV-002/S1" (R1)
And graph.Impact.reverify is empty (R3)

### S9: A screen no step shows reaches its feature with no scenarios
Given feature "ALP-001" lists "UI-001" under ui, and none of its steps cites "UI-001"
When the developer runs spec impact "UI-001" through graph.ComputeImpact
Then graph.Impact.mustChange holds "ALP-001" via "ui UI-001" with no scenarios (R1)

### S10: A removed feature is not reached
Given feature "ALP-001" lists "INV-001", and is removed
When the developer runs spec impact "INV-001" through graph.ComputeImpact
Then graph.Impact.mustChange holds no "ALP-001"

### S11: An invariant cited directly and through a rule reaches both sets of scenarios
Given the "chat-mini" fixture spec, changed so that "PRV-002/S4" cites "INV-001" and not "PRV-002/R1", and "PRV-002/S1" cites "PRV-002/R1", which cites "INV-001"
When the developer runs spec impact "INV-001" through graph.ComputeImpact
Then graph.Impact.mustChange holds "PRV-002" via "PRV-002/R1 cites INV-001", "PRV-002/S4 cites INV-001" and "invariants INV-001", with scenarios "PRV-002/S1" and "PRV-002/S4" (R1)

## Rules
- R1: An invariant or a screen reaches each feature that lists it or whose scenarios, rules or questions cite it, with the scenarios whose steps cite it. For an invariant, a scenario whose steps cite a rule that cites it counts too. When no scenario does, an invariant reaches every scenario of that feature, and a screen none.
- R2: A decision reaches every scenario of each feature that lists or cites it, and every contract and invariant whose `Decisions:` line names it, with no scenarios.
- R3: Impact on an invariant, decision or screen re-verifies nothing.

## Out of scope
- Contracts an invariant applies to: impact on the invariant does not reach them; impact on such a contract reaches the invariant (GRF-008)
