---
id: TKT-011
title: Plan parallel work with spec plan
module: tickets
status: active
provides: [tickets.Plan]
decisions: [ADR-002]
questions:
  - id: Q1
    kind: preference
    text: "A ticket that conflicts with a ticket stuck on a person is listed under Needs a person and also keeps its wave under Start now or Later (S19). Keep listing it twice, or list it only under Needs a person?"
    default: keep it as it is
    cites: [TKT-011/S19]
    answer: 'Changed in review (2026-10-29): it is listed only under "Needs a person" and takes no wave (R7, S19).'
    raised_by: null
---
## Intent
Tickets run in parallel, each in its own worktree, unless one depends on the other: explicitly through depends_on, or through the spec, when a proposal's change reaches what the other works on, or when both change the same unit. Touching the same feature, and so the same files, is fine: merging resolves that. Until a proposal's spec stage is recorded, its footprint is what its `touches` names, with its depends_on: a guess through every contract its features read would make nearly every pair of tickets look related, since a few members are read almost everywhere. Once its spec stage is recorded, its footprint is what the spec change actually changed. Scenario and rule numbers are what parallel proposals must not share: two proposals that add to one touched feature never run together; a spec stage that adds to a feature outside its touches is refused a number another running ticket's recorded spec stage already took there (PIP-007/R10); and once one branch has merged, `spec lint --ci` on the later branch names each number both took (L035, LNT-018), and `spec merge` lands no merged spec with lint errors (WSP-006). `spec plan` says which tickets can start now, in which wave each other one follows and after which tickets, and which need a person. It also suggests tickets that could be combined into one, as advice that changes no wave. A ticket that has done work and is held waits in its own wave, and a ticket that has done none and conflicts with it never jumps ahead of it, so the work already done is not lost to a hand merge.

## Behaviour
### S1: The whole plan
Given the store holds the chat-mini fixture's tickets, none started, none done
When the developer runs `spec plan` through tickets.Plan
Then cli.CommandResult.stdout is exactly (R1, R7, R11):
```text
# Plan · spec@3f8f2372

## Running (0)
None

## Start now, in parallel (6)
- BUG-301 bug · next tester · Fallback moves on to a third provider
- PROP-202 proposal · next spec-writer · List enabled providers in the model picker
- PROP-205 proposal · next spec-writer · Add a copy-message action
- TASK-101 task · next implementer · Extract provider selection into its own module
- TASK-102 task · next implementer · Record which provider produced each message
- TASK-103 task · next implementer · Simplify the fallback code

## Later (1)
- PROP-201 proposal · wave 2, next spec-writer · Add a "gemini" fake provider
<six after lines>

## Could run together (2)
<two group lines>

## Needs a person (2)
- BUG-302: schema BUG-302: a bug must name the scenario it violates; without one the behaviour is unspecified: add the violated scenario IDs to violates, or turn the ticket into a proposal
- PROP-206: question PROP-206#Q1: Do renamed providers keep their usage history?

```
And PROP-201's six after lines, in order, are "  after BUG-301: BUG-301 works on PRV-002, which PROP-201 reaches (emits providers.FallbackTriggered (whole) (uses providers.ProviderId) ← providers.ProviderId)", "  after PROP-202: both add to SET-001, so their new scenario and rule numbers would collide", "  after PROP-205: PROP-205 works on CNV-001, which PROP-201 reaches (observes settings.ApiKey (whole) (uses providers.ProviderId) ← providers.ProviderId)", "  after TASK-101: TASK-101 works on PRV-001, which PROP-201 reaches (emits providers.RateLimited (whole) (uses providers.ProviderId) ← providers.ProviderId)", "  after TASK-102: TASK-102 works on CNV-002, which PROP-201 reaches (writes conversation.Message.meta (uses providers.ProviderId) ← providers.ProviderId)" and "  after TASK-103: TASK-103 works on PRV-002, which PROP-201 reaches (emits providers.FallbackTriggered (whole) (uses providers.ProviderId) ← providers.ProviderId)" (R2, R3, R5)
And no proposal has had its spec stage, so "PROP-202" and "PROP-205" conflict only with "PROP-201", and since "PROP-201" waits in wave 2, they fit wave 1 by first fit although they come after it by ID (R5, R9)
And no after line in the plan holds "may reach" (R9)
And the two group lines are the two that S26 names (R11)
And cli.CommandResult.exitCode is 0

### S2: A proposal reaches what another ticket works on
Given "PROP-201" touches the type "providers.ProviderId", which types a member of the event "providers.FallbackTriggered" that the feature "PRV-002" emits
And "BUG-301" violates "PRV-002/S3"
When the developer runs `spec plan PROP-201 BUG-301` through tickets.Plan
Then "BUG-301" is in tickets.PlanResult.later with tickets.PlanEntry.wave 2 and one tickets.PlanEntry.after: id "PROP-201", reason "BUG-301 works on PRV-002, which PROP-201 reaches (emits providers.FallbackTriggered (whole) (uses providers.ProviderId) ← providers.ProviderId)" (R2, R5)

### S3: Two proposals on one feature
Given "PROP-201" and "PROP-202" both touch the feature "SET-001"
When the developer runs `spec plan PROP-202 PROP-201` through tickets.Plan
Then "PROP-202" is in tickets.PlanResult.now, and "PROP-201" waits after it with the reason "both add to SET-001, so their new scenario and rule numbers would collide" (R3)

### S4: Bugs and tasks share features freely
Given "BUG-301" violates "PRV-002/S3", and "TASK-103" touches "PRV-002"
When the developer runs `spec plan BUG-301 TASK-103` through tickets.Plan
Then tickets.PlanResult.now holds both, and tickets.PlanResult.later is empty (R4)

### S5: A proposal that changes no shared unit reaches nothing
Given "PROP-205" touches only features, and its spec-writer stage is recorded
And "BUG-301" works on a feature "PROP-205" does not touch
When the developer runs `spec plan PROP-205 BUG-301` through tickets.Plan
Then tickets.PlanResult.now holds both (R2)

### S6: Both change one unit
Given the proposal "PROP-946" touches only the invariant "INV-001", and the task "TASK-946" touches "INV-001" and "PRV-001", which the change to "INV-001" does not reach
When the developer runs `spec plan PROP-946 TASK-946` through tickets.Plan
Then "TASK-946" waits after "PROP-946" with the reason "both change INV-001" (R2)

### S19: A ticket in conflict with one that waits for a person
Given "BUG-950" violates "PRV-002/S3" and depends on "PROP-206", which has an open blocker question
And "PROP-201" reaches "PRV-002", and "TASK-961" depends on "PROP-201"
When the developer runs `spec plan` through tickets.Plan
Then tickets.PlanResult.blocked holds id "BUG-950", reason "waits for PROP-206, which needs a person" (R7)
And tickets.PlanResult.blocked holds id "PROP-201", reason "waits for BUG-950, which waits for a person" (R7)
And tickets.PlanResult.blocked holds id "TASK-961", reason "waits for PROP-201, which waits for a person" (R7)
And "PROP-201" and "TASK-961" are in neither tickets.PlanResult.now nor tickets.PlanResult.later, so each is listed once, under "Needs a person" (R7)
And no tickets.PlanEntry.after in the plan names "PROP-201", "TASK-961" or "BUG-950" (R7)

### S7: depends_on always orders two tickets
Given "TASK-901" depends on "TASK-902", and they touch unrelated features
When the developer runs `spec plan TASK-901 TASK-902` through tickets.Plan
Then "TASK-902" is in tickets.PlanResult.now, and "TASK-901" is in tickets.PlanResult.later with wave 2, after "TASK-902" with the reason "TASK-901 depends on TASK-902" (R6)

### S8: The order asked decides who goes first
Given "PROP-201" and "BUG-301" conflict
When the developer runs `spec plan PROP-201 BUG-301` through tickets.Plan
Then tickets.PlanResult.now holds only "PROP-201", and tickets.PlanResult.later holds only "BUG-301" (R5)

### S9: Independent tickets start together
Given "BUG-301", "PROP-205" and "TASK-103" conflict with none of each other, since the spec-writer stage of "PROP-205" is recorded
When the developer runs `spec plan BUG-301 PROP-205 TASK-103` through tickets.Plan
Then the ids in tickets.PlanResult.now are "BUG-301", "PROP-205", "TASK-103" (R5)

### S10: A running ticket holds its place
Given "PROP-201" is in progress at stage tester, and the spec-writer stages of "PROP-201" and "PROP-205" are recorded
When the developer runs `spec plan BUG-301 PROP-205` through tickets.Plan
Then tickets.PlanResult.running holds "PROP-201" with tickets.PlanEntry.stage "tester" and wave 1 (R1)
And tickets.PlanResult.now is empty
And tickets.PlanResult.later holds "BUG-301" and "PROP-205", each in wave 2 after "PROP-201" (R5)

### S11: First fit
Given "BUG-301" is in progress, "PROP-201" conflicts with it and with "PROP-205" and "TASK-103", and those two conflict with nothing else, the spec-writer stages of "PROP-201" and "PROP-205" being recorded and their branches merged into the base branch, so neither is in flight
When the developer runs `spec plan PROP-201 PROP-205 TASK-103` through tickets.Plan
Then the ids in tickets.PlanResult.now are "PROP-205", "TASK-103" (R5)
And "PROP-201" is in tickets.PlanResult.later after "BUG-301", "PROP-205" and "TASK-103" (R5)

### S12: A dependency outside the plan
Given "TASK-901" depends on "BUG-301", which is done with branch "ticket/BUG-301" not merged
When the developer runs `spec plan TASK-901` through tickets.Plan
Then "TASK-901" is in tickets.PlanResult.later with wave 2 and after id "BUG-301", reason "BUG-301 is done; merge ticket/BUG-301 first" (R6)

### S13: A dependency that is open but not in the plan
Given "TASK-901" depends on "BUG-301", which is open, and the plan asks only for "TASK-901"
When the developer runs `spec plan TASK-901` through tickets.Plan
Then "TASK-901" is in tickets.PlanResult.later with wave 2 and after id "BUG-301", reason "TASK-901 depends on BUG-301, which is not in this plan (open)" (R6)

### S14: A dependency that needs a person
Given "TASK-901" depends on "PROP-206", which has an open blocker question
When the developer runs `spec plan` through tickets.Plan
Then tickets.PlanResult.blocked holds id "TASK-901", reason "waits for PROP-206, which needs a person" (R7)

### S15: A ticket that is not in the store
Given the store has no "PROP-999"
When the developer runs `spec plan PROP-999` through tickets.Plan
Then tickets.PlanResult.blocked holds id "PROP-999", reason "PROP-999 is not a ticket"
And cli.CommandResult.exitCode is 0

### S16: An argument that is not a ticket ID
Given the spec has a feature "PRV-001"
When the developer runs `spec plan PRV-001` through tickets.Plan
Then the command fails with tickets.UnknownTicket, and cli.CommandResult.stderr starts "Unknown PRV-001."
And cli.CommandResult.exitCode is 2

### S17: Done tickets are left out
Given "TASK-101" is done
When the developer runs `spec plan` through tickets.Plan
Then "TASK-101" is in none of tickets.PlanResult.running, tickets.PlanResult.now, tickets.PlanResult.later and tickets.PlanResult.blocked

### S18: The JSON result
Given the chat-mini fixture's tickets
When the developer runs `spec plan --format json` through tickets.Plan
Then cli.CommandResult.stdout is a tickets.PlanResult, and its entry for "PROP-201" in tickets.PlanResult.later has tickets.PlanEntry.type "proposal", tickets.PlanEntry.stage "spec-writer", tickets.PlanEntry.wave 2, and six tickets.PlanEntry.after items, the second with id "PROP-202" and reason "both add to SET-001, so their new scenario and rule numbers would collide"
And tickets.PlanResult.now holds "PROP-202" and "PROP-205" with tickets.PlanEntry.wave 1 and no tickets.PlanEntry.after items (R5, R9)

### S20: An open ticket with an unmerged stage holds its place
Given "PROP-201" is open, and its branch "ticket/PROP-201" holds a recorded spec-writer stage not merged into the base branch
And "PROP-201" and "PROP-202" both touch the feature "SET-001"
When the developer runs `spec plan PROP-202 PROP-201` through tickets.Plan
Then "PROP-201" is in tickets.PlanResult.now, and "PROP-202" is in tickets.PlanResult.later with wave 2 after "PROP-201" with the reason "both add to SET-001, so their new scenario and rule numbers would collide", although "PROP-202" was asked first (R5, R8)

### S21: A blocked ticket with an unmerged stage holds its place until it is merged
Given "PROP-201" is blocked, and its branch holds a recorded stage not merged into the base branch
And "BUG-301" works on "PRV-002", which "PROP-201" reaches
When the developer runs `spec plan BUG-301` through tickets.Plan
Then "BUG-301" is in tickets.PlanResult.later with wave 2 and one tickets.PlanEntry.after with id "PROP-201" (R8)
But once "ticket/PROP-201" is merged into the base branch, "BUG-301" is in tickets.PlanResult.now (R8)

### S22: Before its spec stage, a proposal's footprint is what it touches
Given the proposal "PROP-950" touches only "CNV-003", which reads "conversation.Message.content", and "CNV-001", which writes it, and has no recorded spec-writer stage
And the task "TASK-950" touches "CNV-001", and the proposal "PROP-951", with no recorded stage, touches only "CNV-002", which reads "conversation.Message.content"
When the developer runs `spec plan PROP-950 TASK-950 PROP-951` through tickets.Plan
Then the ids in tickets.PlanResult.now are "PROP-950", "PROP-951", "TASK-950", in wave and then ID order, and tickets.PlanResult.later is empty (R9)
But once the spec-writer stage of "PROP-950" is recorded with "conversation.Message.content" in its tickets.Ticket.changed, so the gate finds no scope gap, "TASK-950" and "PROP-951" are in tickets.PlanResult.later after "PROP-950", TASK-950's reason starting "TASK-950 works on CNV-001, which PROP-950 reaches (" and PROP-951's starting "PROP-951 works on CNV-002, which PROP-950 reaches (" (R2, R9)
And the proposal "PROP-952", with no recorded stage, that touches "CNV-003" too waits after "PROP-950" in `spec plan PROP-950 PROP-952` with the reason "both add to CNV-003, so their new scenario and rule numbers would collide", before and after any stage (R3, R9)
And a bug on "CNV-003" and "TASK-950" start together, before and after any stage (R4)

### S23: A ticket that waits for a person while in flight
Given "PROP-201" is blocked on its unanswered blocker question "PROP-201#Q1", "Which providers?", and its branch "ticket/PROP-201" holds a recorded spec-writer stage not merged into the base branch
And "BUG-301" works on "PRV-002", which "PROP-201" reaches
When the developer runs `spec plan PROP-201 BUG-301` through tickets.Plan
Then tickets.PlanResult.blocked holds id "PROP-201", reason "question PROP-201#Q1: Which providers?" (R7)
And "PROP-201" is in neither tickets.PlanResult.now nor tickets.PlanResult.later (R7)
And tickets.PlanResult.now is empty, and "BUG-301" is in tickets.PlanResult.later with wave 2 and one tickets.PlanEntry.after: id "PROP-201", reason "BUG-301 works on PRV-002, which PROP-201 reaches (emits providers.FallbackTriggered (whole) (uses providers.ProviderId) ← providers.ProviderId)" (R7, R8)

### S24: Absorbed tickets are left out
Given "PROP-202" is absorbed into "PROP-201", which is open, and both touch the feature "SET-001"
When the developer runs `spec plan` through tickets.Plan, and again as `spec plan PROP-202 PROP-201`
Then each time "PROP-202" is in none of tickets.PlanResult.running, tickets.PlanResult.now, tickets.PlanResult.later and tickets.PlanResult.blocked, and no tickets.PlanEntry.after names "PROP-202" (R1)
And for `spec plan PROP-202 PROP-201`, "PROP-201" is in tickets.PlanResult.now

### S25: A widely used contract neither holds a proposal back nor groups tickets
Given a spec of 40 active features, 12 of which read "out.Result.code"; among them "AAA-001" and "AAA-002", both in the module "alpha", which read or write no other contract
And the open proposals "PROP-960" and "PROP-961", with no recorded stage, touch only "AAA-001" and only "AAA-002"
When the developer runs `spec plan PROP-960 PROP-961` through tickets.Plan
Then the ids in tickets.PlanResult.now are "PROP-960", "PROP-961" (R9)
And tickets.PlanResult.together is empty (R10, R11)
But when only 9 features read "out.Result.code", or the spec has 130 active features, tickets.PlanResult.together holds one group with tickets.PlanGroup.ids "PROP-960", "PROP-961" and tickets.PlanGroup.contract "out.Result" (R10, R11)
And tickets.PlanResult.now still holds both (R9)

### S26: Tickets that could run together
Given the store holds the chat-mini fixture's tickets, none started, none done
When the developer runs `spec plan` through tickets.Plan
Then the section "## Could run together (2)" follows "Later", and its lines are "- PROP-201 + PROP-202 · proposal · module settings, contract providers.ProviderConfig · re-verify 13 scenarios · spec ticket combine PROP-201 PROP-202" and "- TASK-101 + TASK-102 + TASK-103 · task · module providers, contract conversation.Message · re-verify 4 scenarios · spec ticket combine TASK-101 TASK-102 TASK-103" (R11)
And "PROP-206", under Needs a person, is in no group although it also works on "SET-001", and "PROP-205" and "BUG-301" are in none (R11)
And every ticket keeps the wave and the after lines that S1 gives it (R11)
And with `--format json`, tickets.PlanResult.together holds the same two groups, the first with tickets.PlanGroup.ids "PROP-201", "PROP-202", tickets.PlanGroup.type "proposal", tickets.PlanGroup.module "settings", tickets.PlanGroup.contract "providers.ProviderConfig", tickets.PlanGroup.reach 13 and tickets.PlanGroup.command "spec ticket combine PROP-201 PROP-202" (R11)
But a ticket whose joining would take a group above 60 scenarios to re-verify stays out of it, and with no group the section says "None" (R11)
And two tickets whose `spec impact` re-verify lists are empty, each working on its own feature of 31 scenarios, count 62 together and are not grouped (R11)

### S27: A ticket held in flight keeps its place ahead of tickets with no recorded stage
Given "PROP-201" is open, and its branch "ticket/PROP-201" holds a recorded spec-writer stage not merged into the base branch
And "BUG-301" is in progress and conflicts with "PROP-201", so "PROP-201" cannot sit in wave 1
And "TASK-102" has no recorded stage, conflicts with "PROP-201" and does not conflict with "BUG-301"
When the developer runs `spec plan PROP-201 TASK-102` through tickets.Plan
Then "BUG-301" is in tickets.PlanResult.running in wave 1 (R1)
And "PROP-201" is in tickets.PlanResult.later with wave 2 and one tickets.PlanEntry.after item, id "BUG-301" (R5, R8)
And "TASK-102" is in tickets.PlanResult.later with wave 3 and one tickets.PlanEntry.after item, id "PROP-201" (R5, R8)
And tickets.PlanResult.now is empty, and no tickets.PlanEntry.after of "PROP-201" names "TASK-102" (R8)
But when "ticket/PROP-201" is merged into the base branch, "PROP-201" is no longer in flight: "TASK-102" is in tickets.PlanResult.now with wave 1, and "PROP-201" is in tickets.PlanResult.later with wave 2 after "BUG-301" and "TASK-102" (R5)

### S28: Running tickets, dependencies and other tickets in flight keep their order
Given "PROP-201" and "PROP-202" both touch the feature "SET-001", and the branch of each holds a recorded spec-writer stage not merged into the base branch
And "TASK-901" has no recorded stage, conflicts with "PROP-201" and with nothing else, and "PROP-201" depends on it
When the developer runs `spec plan PROP-202 PROP-201 TASK-901` through tickets.Plan
Then "TASK-901" is in tickets.PlanResult.now with wave 1, since "PROP-201" depends on it (R5, R6, R8)
And "PROP-202" is in tickets.PlanResult.now with wave 1, since it was asked before "PROP-201" and both are in flight (R5)
And "PROP-201" is in tickets.PlanResult.later with wave 2 after "PROP-202" with the reason "both add to SET-001, so their new scenario and rule numbers would collide", and after "TASK-901" (R3, R5, R6)

## Rules
- R1: Running tickets are always in the plan, in wave 1, with their running stage; done and absorbed tickets never are, even when asked for; the rest are the tickets asked for, or every ticket neither done nor absorbed
- R2: A proposal reaches every unit its change to a contract, member, invariant, decision or screen reaches; a ticket that works on a feature or unit a proposal reaches waits for it, as does a ticket that changes a unit a proposal also changes; a proposal whose footprint (R9) names only features reaches nothing
- R3: Two proposals that add to the same feature never run together, since their new scenario and rule numbers would collide
- R4: Bugs and tasks change no spec, so they reach nothing and may share features with each other
- R5: Each ticket takes the earliest wave in which nothing it conflicts with runs, in priority order: running tickets, then dependencies before their dependents, then tickets in flight (R8), then the order asked (by ID without arguments); a ticket excludes a conflicting one only from the wave it sits in, so a ticket asked later can take an earlier wave than a ticket it conflicts with, except that a ticket with no recorded stage never precedes a conflicting ticket in flight (R8); it lists, as after, every ticket it conflicts with in an earlier wave
- R6: A ticket comes after every ticket it depends on; one outside the plan that has not landed puts it in wave 2 at least, with the reason
- R7: A ticket waits for a person when a person must unblock it (a gate blocker other than a dependency, or a pipeline that needs a decision), when it depends on a ticket that waits for a person, or when it conflicts with a ticket ahead of it in priority order (R5) that waits for a person through a dependency. It is listed under Needs a person with its first reason: "waits for <ID>, which needs a person" for a dependency a person must unblock, "waits for <ID>, which waits for a person" for any other. It is listed there only: it takes no wave, is in neither Start now nor Later, and is in no ticket's after list. The one exception is a ticket in flight (R8): it is still listed only under Needs a person, but it holds its place in wave 1, and a ticket that conflicts with it waits after it
- R8: A ticket is in flight, for every conflict rule (R2, R3), while its branch holds a recorded stage not merged into the base branch, whatever its status (open, blocked or in progress); a ticket that conflicts with it waits after it; a conflicting ticket with no recorded stage, other than one the in-flight ticket depends on, takes a wave later than the one the in-flight ticket itself sits in, even when a running ticket or a dependency holds the in-flight ticket back from wave 1; running tickets, dependencies and other tickets in flight keep the order of R5; it stops being in flight once its branch is merged
- R9: A ticket's footprint, for every conflict rule (R2, R3, R6) in `spec plan` and in the start check of `spec ticket start` and `spec next`, is what its `touches` and `violates` name, with its depends_on; once a proposal's spec-writer stage is recorded, it is also the units its spec change changed (tickets.Ticket.changed). Until that stage is recorded, the contracts its features read or write widen nothing: it reaches only through the shared units it touches (R2), adds to the features it touches (R3), and no reason says "may reach"
- R10: A contract or member is widely used when at least 10 of the spec's active features, and more than a tenth of them, read or write it; a feature that reads or writes its whole contract counts, and for a whole contract so does one that reads or writes any of its members
- R11: "Could run together", after Later, is advice: it changes no wave and no after list. It groups tickets of one type that are in Start now or Later, open, with no recorded stage. A ticket shares a module with another when each works on a feature in it, and a contract when a feature each works on reads or writes it or one of its members, never a widely used one (R10). Taken in ID order, a ticket joins the first group of its type when it shares the group's module and contract with it and the group's reach stays at most 60; otherwise it pairs with the first earlier ticket of its type in no group with which it shares a module and a contract, naming the first module by name and the first contract by ID, when their reach is at most 60. A group's reach is the number of distinct scenarios that `spec impact` gives its tickets to re-verify, where a ticket whose re-verify list is empty counts the scenarios of the features it works on instead. Each group, by its first ID, is the line "- <ID> + <ID>... · <type> · module <module>, contract <contract> · re-verify <reach> scenarios · spec ticket combine <ID> <ID>...", IDs in ID order

## Out of scope
- Preparing and starting ticket stages: CLI (`spec next`)
- Refusing to start a ticket that conflicts with a running one: pipeline (`spec ticket start`)
- Lint of dependency cycles (TKT-009)
