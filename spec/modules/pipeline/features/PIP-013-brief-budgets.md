---
id: PIP-013
title: Keep each brief within its role's budget
module: pipeline
status: active
---
## Intent
A brief that grows with the spec stops being small. Each role has a token budget, and a brief over it drops optional detail in a fixed order until it fits, the neighbours' scenarios first. A ticket whose scope spans many features would still hand every stage the full text of all of them, so as a last resort the scenarios and rules the ticket neither changed nor cites shrink to one line each, ID and title, feature by feature, and the contracts only they needed follow. What a role must have (the ticket, what it changed or cites, the invariants) is never dropped, and a brief still over budget says so in its second line. A project may set its own budgets.

## Behaviour
### S1: The default budgets
Given a config whose `budgets` holds no "brief.<role>" key
When pipeline.Brief runs
Then the budgets, in tokens of 4 characters rounded up, are (R1):
| role | budget |
| spec-writer | 10000 |
| implementer | 6000 |
| tester | 4000 |
| reviewer | 8000 |

### S2: A project's own budget
Given the config's `budgets` holds "brief.implementer": 2000
When `spec brief implementer TASK-101` runs through pipeline.Brief
Then the implementer's budget is 2000 tokens (R1)

### S3: Decisions lose their consequences before anything required
Given the full implementer brief for "TASK-101" holds "#### Consequences", and its budget is 20 tokens less than that brief's size
When `spec brief implementer TASK-101` runs through pipeline.Brief
Then the brief holds no "#### Consequences" and no "> Warning"
And it still holds "File: modules/providers/features/PRV-002-fall-back-on-rate-limit.md" (R2)
And every scenario of "PRV-001" and "PRV-002" is still quoted in full, with no "Listed by title to fit the budget" line (R2)

### S4: The order things are cut in
Given a brief over its budget
When pipeline.Brief shrinks it
Then it applies these cuts one at a time, in order, stopping as soon as it fits (R2):
| step | cut |
| 1 | each neighbour feature, from the last, is cut to one line (R4) |
| 2 | each module keeps only its first paragraph |
| 3 | each decision keeps its Decision and loses its Consequences |
| 4 | a contract no scenario step cites is listed as "### <ID> (title only)", unless the ticket cites it or its branch changed it (R5) |
| 5 | every feature after the first keeps only its scenarios and its kept rules (R5) |
| 6 | each feature in scope, from the first, lists every scenario and rule that is not kept by ID and title (R6) |
| 7 | each contract that no kept scenario or rule needs is listed as "### <ID> (title only)" (R6) |

### S5: Still over budget after every cut
Given the implementer budget is 300 tokens
When `spec brief implementer TASK-101` runs through pipeline.Brief
Then the second line starts "> Warning: this brief is about " followed by the token count and " tokens, over the implementer budget of 300. Nothing required was dropped."
And the brief still holds the "ticket" fence and "### INV-002" (R3)
And every scenario of "PRV-001" and "PRV-002" is still there at least as its one line, such as "- PRV-002/S4 Fallback provider not enabled", since "TASK-101" names no scenario (R3, R6)
And only the first feature keeps its "File: " line

### S6: The reviewer's diff does not count
Given a reviewer brief whose diff alone is larger than the reviewer budget
When pipeline.Brief runs for the reviewer
Then the size compared with the budget leaves the diff's text out, and the diff is never cut (R2)

### S7: Neighbours are cut first, each to a spec show line
Given the tester's brief for "PROP-201" holds "## Neighbours" with "CNV-001" and then "PRV-003", and its budget lies between the brief's size with "PRV-003" cut and its size with neither cut
When `spec brief tester PROP-201` runs through pipeline.Brief
Then "## Neighbours" still holds "### CNV-001: Send a message" with its scenarios, and in place of "PRV-003" the one line "- PRV-003 <title>: cut to fit the budget; run `spec show PRV-003`" (R4)
And nothing else in the brief is cut, and it has no "> Warning" (R2)
And with a budget so small that every cut is made, every neighbour is such a line, and the warning still ends "Nothing required was dropped." (R3, R4)

### S8: The scenario a bug violates stays whole while the rest are listed by title
Given the tester's brief for "BUG-301", which violates "PRV-002/S3", and a tester budget below that brief's size after the first five cuts
When `spec brief tester BUG-301` runs through pipeline.Brief
Then "### PRV-002: Fall back when a provider rate-limits" still holds "##### S3: Fallback provider also rate-limits" with all its steps, and the rule "- R2: One fallback per reply. No chains.", which that scenario cites (R5)
And after them the feature holds the line "Listed by title to fit the budget; run `spec show <ID>` for the full text:" followed by "- PRV-002/S1 Fallback enabled", "- PRV-002/S2 Fallback disabled", "- PRV-002/S4 Fallback provider not enabled" and "- PRV-002/R1 The fallback is used only when it is enabled in this workspace (INV-001)" (R6)
And the brief holds no "##### S1: Fallback enabled", "##### S2: Fallback disabled" or "##### S4: Fallback provider not enabled" (R6)

### S9: Contracts follow the scenarios that stay
Given the tester's brief for "BUG-301" with a budget so small that every cut is made
When `spec brief tester BUG-301` runs through pipeline.Brief
Then "## Contracts" still quotes in full "providers.ProviderConfig", "providers.RateLimited" and "conversation.Message.meta", which "PRV-002/S3" names, and "conversation.DeliveryMeta" and "providers.ProviderId", which those use (R6)
And "providers.FallbackTriggered", which only "PRV-002/S1" names, is the line "### providers.FallbackTriggered (title only)" (R6)
And "### INV-001: A conversation goes only to enabled providers" is still quoted in full, and the second line is the warning ending "Nothing required was dropped." (R3)

### S10: Features are listed by title one at a time, from the first
Given "TASK-101", which touches the features "PRV-001" and "PRV-002" and names none of their scenarios, and an implementer budget at least the brief's size with only "PRV-001" listed by title, and below its size after the first five cuts
When `spec brief implementer TASK-101` runs through pipeline.Brief
Then the scenarios of "PRV-001" are lines such as "- PRV-001/S1 Streams tokens", since a feature named whole keeps none of its scenarios (R5, R6)
And "PRV-002" still quotes "##### S4: Fallback provider not enabled" with its steps, and the brief has no "> Warning" (R2, R6)

### S11: What the ticket's branch changed stays whole in every role's brief
Given the spec-writer of "PROP-201" added "PRV-001/S4", titled "Streams from gemini", on its branch, and every role's budget is 1 token
When pipeline.Brief runs on "PROP-201" for the spec-writer, the spec review, the tester, the implementer and the reviewer
Then each brief quotes "##### S4: Streams from gemini" with its steps, and holds "PRV-001/S1" only as the line "- PRV-001/S1 Streams tokens" (R5, R6)
And the spec review's "## Spec delta" and the reviewer's "## Diff" are whole (R2)
But when the project is not a git repository or the base branch cannot be found, nothing counts as changed, the brief holds "- PRV-001/S4 Streams from gemini" in place of the scenario, and it is otherwise complete (R5)

## Rules
- R4: Neighbours (PIP-012/R10) are optional: they count toward the size, are the first thing cut, one feature at a time from the last, and each cut feature leaves only "- <ID> <title>: cut to fit the budget; run `spec show <ID>`". So once a brief is over budget, a neighbour costs it one line, and a brief that is over budget without them carries no neighbour scenario.
- R1: A brief's size is its length in characters divided by 4, rounded up; each role's budget is the config's "brief.<role>" if set, else its default.
- R2: An over-budget brief is cut only by the seven steps, in order, the same for every role; a brief that fits after a step is not cut further. The reviewer's diff and the spec review's spec delta are neither counted nor cut.
- R3: The ticket, every kept scenario and rule (R5), the ID and title of every other scenario in scope, every contract the ticket cites or its branch changed, and every invariant are never cut; a brief still over budget warns on its second line.
- R5: A scenario or rule is kept when the ticket file names its full ID ("<feature>/S<n>" or "<feature>/R<n>": in its touches, violates or changed, its body, a question or a history record); when the ticket's branch added, changed or reworded it against the merge base of HEAD and the config's `baseBranch`, as PIP-014/R1 compares them, whether or not the role's brief shows "## New in the spec"; or, for a rule, when a kept scenario cites it. A feature's ID alone keeps none of its scenarios or rules, and with no repository or no base branch nothing counts as changed. A brief for a unit keeps that unit when it is a scenario or a rule.
- R6: Step 6 takes the features in "## Features in scope" one at a time, in the order the group lists them. In each, every scenario and rule that is not kept loses its text and is listed after the feature's kept ones, under the line "Listed by title to fit the budget; run `spec show <ID>` for the full text:", as "- <feature>/S<n> <title>" for a scenario and "- <feature>/R<n> <its text up to the end of its first sentence>" for a rule; a feature with nothing to list is unchanged. Step 7 then lists as "### <ID> (title only)", one at a time in the group's order, each quoted contract that no kept scenario or rule names, the ticket does not cite and the branch did not change, and that no such contract uses (PIP-012/R5).

## Out of scope
- Budgets on spec files themselves, the "size.<unit>" keys (lint)
