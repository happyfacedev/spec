---
id: PROP-039
type: proposal
title: plan suggests tickets to combine, and its pre-spec overlap rule skips members most features use
status: done
stage: null
touches: [TKT-011]
violates: []
depends_on: [PROP-038]
changed: [TKT-011, TKT-011/R9, TKT-011/R10, TKT-011/R11, TKT-011/S1, TKT-011/S25, TKT-011/S26, tickets.Plan, tickets.PlanGroup, tickets.PlanGroup.command, tickets.PlanGroup.contract, tickets.PlanGroup.ids, tickets.PlanGroup.module, tickets.PlanGroup.reach, tickets.PlanGroup.type, tickets.PlanResult, tickets.PlanResult.together]
questions:
  - id: Q1
    kind: preference
    text: When is a contract member used too widely to signal overlap before a ticket's spec stage?
    default: when more than a quarter of the spec's active features read or write it
    cites: []
    answer: null
    raised_by: null
  - id: Q2
    kind: preference
    text: What combined reach still counts as small enough to suggest combining two tickets?
    default: at most 60 scenarios to re-verify together, as impact counts them
    cites: []
    answer: null
    raised_by: null
history:
  - at: 2026-10-31T03:51:05.593Z
    role: spec-writer
    result: done
    summary: TKT-011 skips widely used contracts before a proposal's spec stage (R10) and plan lists Could run together (R11)
    verdict: null
    assumed:
      - question: PROP-039#Q1
        value: "when at least 10 active features, and more than a tenth of them, read or write it (a quarter would skip nothing here: cli.CommandResult.exitCode is read by 24 of 103)"
      - question: PROP-039#Q2
        value: at most 60 distinct scenarios that spec impact gives the group's tickets to re-verify
      - new: Where does Could run together go, and which tickets may join?
        value: after Later; open tickets with no recorded stage in Start now or Later, grouped in ID order, never through a widely used contract
    duration_s: 394
  - at: 2026-10-31T03:58:34.064Z
    role: tester
    result: done
    summary: Tests for TKT-011 S1, S25, S26 (R9-R11) fail on current code; S25 uses a 40-feature mkdtemp spec
    verdict: null
    assumed: []
    duration_s: 447
  - at: 2026-10-31T04:14:48.278Z
    role: implementer
    result: done
    summary: plan skips widely used contracts before a spec stage (R9, R10) and lists Could run together (R11)
    verdict: null
    assumed:
      - new: How does R11 count a ticket's reach when its re-verify ring holds no scenario? S26's 60-scenario test expects 30 + 30 for two tickets whose impact is empty
        value: the ticket then re-verifies the scenarios of the features it works on; otherwise reach is the re-verify ring only, as chat-mini's 13 and 4 need
    duration_s: 973
  - at: 2026-10-31T04:20:16.421Z
    role: reviewer
    result: done
    summary: Empty-ring reach needs an explicit spec rule; conflict safety and advisory scheduling hold.
    verdict: changes
    findings:
      - cites: [TKT-011/R11, TKT-011/S26, tickets.PlanGroup.reach]
        text: src/core/plan.ts:193-197 substitutes changed-feature scenarios when impact yields zero re-verify scenarios. Two reader-only tasks on separate 31-scenario features each have an empty impact.reverify, yet plan excludes their pair by counting 62. R11 and tickets.PlanGroup.reach define reach as impact's re-verify scenarios, which would give this pair reach 0. This affects ordinary feature-only tickets, and tests/core/plan-scenarios.test.ts:310 already relies on the fallback. The conservative fallback is reasonable; recommend retaining it, stating it explicitly in R11 and PlanGroup.reach, and describing the empty-ring case in S26.
        spec: true
    assumed:
      - new: Should pairing continue after an earlier matching candidate exceeds 60 scenarios?
        value: Yes. R11 reasonably means the first earlier candidate satisfying all conditions, including the cap; no additional rule is needed.
    duration_s: 327
  - at: 2026-10-31T04:20:37.652Z
    role: spec-writer
    result: done
    summary: R11, S26 and PlanGroup.reach state that a ticket with an empty re-verify list counts its own features' scenarios
    verdict: null
    assumed: []
    duration_s: 20
  - at: 2026-10-31T04:24:43.044Z
    role: tester
    result: done
    summary: Added the S26 empty re-verify case (31 + 31 = 62, not grouped); it passes on the current code
    verdict: null
    assumed: []
    duration_s: 245
  - at: 2026-10-31T04:27:51.075Z
    role: implementer
    result: done
    summary: "No code change: src/core/plan.ts already counts an empty re-verify list's own feature scenarios, as R11 now states"
    verdict: null
    assumed: []
    duration_s: 187
  - at: 2026-10-31T04:28:52.406Z
    role: reviewer
    result: done
    summary: "Prior finding resolved: R11, PlanGroup.reach and S26 state and test the empty-ring fallback."
    verdict: approve
    assumed: []
    duration_s: 60
---
Self-hosting findings from batch 2.

1. Pre-spec overlap (TKT-011/R9, from ADR-002) widens a proposal through every contract its features use. Members nearly every feature reads (cli.CommandResult.exitCode, cli.CommandResult.stdout, format.Config.baseBranch) make unrelated tickets queue for up to five waves. Leave such widely used members out of the widening, and say so in the reason line when a member was skipped.

2. `spec plan` gains a section "Could run together" after the waves, listing pairs (or larger sets) of open, unstarted tickets of one type that share a module and a contract their touched features read or write, and whose combined reach is small. Each line names the tickets, the shared module and contract, the combined reach, and the command to combine them (spec ticket combine). It is advice only: the waves do not change. JSON output carries the same suggestions.
