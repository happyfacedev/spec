---
id: PROP-098
type: proposal
title: A spec stage may not add an invariant or other core ID that a running ticket also added
status: done
stage: null
touches: [PIP-008]
violates: []
depends_on: []
changed: [PIP-007, PIP-007/R11, PIP-007/S22, PIP-007/S23, PIP-007/S24, PIP-007/S25, PIP-007/S26, PIP-007/S27]
questions:
  - id: Q1
    kind: blocker
    text: "npm run lint fails only in the tester's test file tests/cli/report-number-collision.test.ts:94 (scene helper): two @typescript-eslint/no-confusing-void-expression errors on the arrow functions `(dir) => addUnits(...)`, which need braces. The code is done and the tests pass; I may not edit tests. Its changes are kept in git stash \"PROP-098 implementer: blocked\"; the next implementer stage gets them back. Not handed to the tester: npm run lint fails (exit 1): > spec-skill@0.1.0 lint; > eslint . && tsx scripts/gen-role-manifest.ts --check; /Users/alexpavelm/dev/happyface/spec.worktrees/PROP-098/tests/cli/report-number-collision.test.ts; 94:64   error  Returning a void expression from an arrow function shorthand is forbidden. Please add braces to the arrow function  @typescript-eslint/no-confusing-void-expression; 94:103  error  Returning a void expression from an arrow function shorthand is forbidden. Please add braces to the arrow function  @typescript-eslint/no-confusing-void-expression"
    default: null
    cites: [PIP-007/S22]
    answer: Tester fixes the two lint errors in tests/cli/report-number-collision.test.ts:94 (add braces to the arrow functions); no other test change. Then the implementer restores its stashed code.
    raised_by: implementer
history:
  - at: 2026-11-01T14:18:12.209Z
    role: spec-writer
    result: done
    summary: Extend the PIP-007 refusal of a number another running ticket took to invariants, decisions, features and screens, naming the next free ID
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-007/S22, PIP-007/S23, PIP-007/S24]
        reason: spec impact PIP-007 reaches no other feature; PIP-007/R10 and S22 are unchanged and S23, S24 repeat their conditions for the new unit kinds
      - item: C2
        outcome: na
        ids: []
        reason: the guard reads IDs from git branches and spec files; paths, platforms and upgrades do not enter into it, and a branch without a recorded spec stage is not compared (S23)
      - item: C3
        outcome: scenarios
        ids: [PIP-007/S23, PIP-007/S25]
        reason: S23 covers a second ticket whose spec stage is running but not yet recorded or already merged; S25 covers several branches taking the same ID
      - item: C4
        outcome: scenarios
        ids: [PIP-007/S26]
        reason: the added IDs are read from the branch in git, never from the report's changed list, so a forged report cannot hide one
      - item: C5
        outcome: scenarios
        ids: [PIP-007/S23, PIP-007/S24]
        reason: an ID both sides added that differs is refused with a message naming the free number; only identical text is accepted
      - item: C6
        outcome: scenarios
        ids: [PIP-007/S22, PIP-007/S23]
        reason: S22 still shows the scenario and rule path unchanged; S23 shows a different number and identical text give no problem
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool or service is involved; the behaviour is the spec's own
    assumed:
      - new: "Which unit kinds count as top-level numbered units: invariants, decisions, features and screens"
        value: those four; modules and contracts are named, not numbered, so only L035 covers them
      - new: Which ticket the message names when several branches took the ID
        value: the lowest-numbered one, one problem per ID
      - new: Lint rule codes (the brief's 'lint code')
        value: "left out: INV-007 says rule codes are the CLI's own, not spec units, and R10 never covered them"
    duration_s: 141
  - at: 2026-11-01T14:20:45.407Z
    role: spec-review
    result: done
    summary: Replacement IDs collide when one report has multiple collisions with the same prefix
    verdict: changes
    findings:
      - cites: [PIP-007/R11, PIP-007/S25]
        text: R11 computes the same next ID for every collision sharing a prefix. If both branches added INV-013 and INV-014 differently, both problems say take INV-015; following both fixes creates a duplicate ID. S25 covers several branches colliding on one ID, but not several colliding IDs in one report. Define replacement guidance that remains valid when all suggested renumberings are applied together, and cover that case.
        class: C9
    assumed: []
    duration_s: 151
  - at: 2026-11-01T14:21:49.797Z
    role: spec-writer
    result: done
    summary: Extend the PIP-007 refusal of a number another running ticket took to invariants, decisions, features and screens, naming distinct free IDs
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-007/S22, PIP-007/S23, PIP-007/S24]
        reason: spec impact PIP-007 reaches no other feature; PIP-007/R10 and S22 are unchanged and S23, S24 repeat their conditions for the new unit kinds
      - item: C2
        outcome: na
        ids: []
        reason: the guard reads IDs from git branches and spec files; paths, platforms and upgrades do not enter into it, and a branch without a recorded spec stage is not compared
      - item: C3
        outcome: scenarios
        ids: [PIP-007/S23, PIP-007/S25, PIP-007/S27]
        reason: S23 covers a second ticket whose spec stage is running but not yet recorded or already merged; S25 covers several branches taking the same ID; S27 covers several colliding IDs in one report
      - item: C4
        outcome: scenarios
        ids: [PIP-007/S26]
        reason: the added IDs are read from the branch in git, never from the report's changed list, so a forged report cannot hide one
      - item: C5
        outcome: scenarios
        ids: [PIP-007/S23, PIP-007/S24]
        reason: an ID both sides added that differs is refused with a message naming the free number; only identical text is accepted
      - item: C6
        outcome: scenarios
        ids: [PIP-007/S22, PIP-007/S23]
        reason: S22 still shows the scenario and rule path unchanged; S23 shows a different number and identical text give no problem
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool or service is involved; the behaviour is the spec's own
    assumed:
      - new: "Which unit kinds count as top-level numbered units: invariants, decisions, features and screens"
        value: those four; modules and contracts are named, not numbered, so only L035 covers them
      - new: Which ticket the message names when several branches took the ID
        value: the lowest-numbered one, one problem per ID
      - new: Lint rule codes (the brief's 'lint code')
        value: "left out: INV-007 says rule codes are the CLI's own, not spec units, and R10 never covered them"
      - new: How suggestions are made distinct when one report refuses several IDs of a prefix
        value: the refused IDs, in ascending order, take consecutive next free numbers from one above the highest of that prefix
    duration_s: 60
  - at: 2026-11-01T14:22:43.558Z
    role: spec-review
    result: done
    summary: "Approved: distinct replacement IDs and S27 resolve the prior finding"
    verdict: approve
    assumed: []
    duration_s: 49
  - at: 2026-11-01T14:44:26.274Z
    role: tester
    result: done
    summary: "Tests for PIP-007/S23–S27: top-level ID collisions with another running spec stage are refused with distinct next free IDs"
    verdict: null
    mutations:
      - scenario: PIP-007/S23
        wrong: only scenarios and rules are checked, so a colliding invariant number is accepted
      - scenario: PIP-007/S24
        wrong: decisions, features and screens are not checked, or the guard also names modules and contracts
      - scenario: PIP-007/S25
        wrong: suggests the base's highest plus one, ignoring the numbers other branches compared already took
      - scenario: PIP-007/S26
        wrong: reads the added IDs from the report's changed list instead of the branch, so a report that omits the invariant hides it
      - scenario: PIP-007/S27
        wrong: suggests the same next free ID for every refused ID of one prefix, or numbers decisions from the invariants
    assumed:
      - new: Order of problems in one report for S24 and S27
        value: tests compare them sorted; the brief fixes no order
      - new: Fixture ID numbers for S23-S27
        value: the chat-mini fixture's real highest numbers are used (INV-002, ADR-002, UI-001, SET-002), so the suggested IDs differ from the brief's examples while following the same rule
    duration_s: 1299
    refusals: 1
  - at: 2026-11-01T14:57:10.159Z
    role: implementer
    result: blocked
    summary: Number-collision refusal now covers invariants, decisions, features and screens with distinct next free IDs; only a test lint error remains
    verdict: null
    assumed: []
    duration_s: 760
  - at: 2026-11-01T14:57:42.166Z
    role: tester
    result: reopened
    summary: reopened by PROP-098#Q1
    verdict: null
    assumed: []
  - at: 2026-11-01T15:07:23.726Z
    role: tester
    result: done
    summary: "Tests for PIP-007/S23–S27: top-level ID collisions with another running spec stage are refused with distinct next free IDs"
    verdict: null
    mutations:
      - scenario: PIP-007/S23
        wrong: only scenarios and rules are checked, so a colliding invariant number is accepted
      - scenario: PIP-007/S24
        wrong: decisions, features and screens are not checked, or the guard also names modules and contracts
      - scenario: PIP-007/S25
        wrong: suggests the base's highest plus one, ignoring the numbers other branches compared already took
      - scenario: PIP-007/S26
        wrong: reads the added IDs from the report's changed list instead of the branch, so a report that omits the invariant hides it
      - scenario: PIP-007/S27
        wrong: suggests the same next free ID for every refused ID of one prefix, or numbers decisions from the invariants
    assumed:
      - new: Order of problems in one report for S24 and S27
        value: tests compare them sorted; the brief fixes no order
      - new: Fixture ID numbers for S23-S27
        value: the chat-mini fixture's real highest numbers are used (INV-002, ADR-002, UI-001, SET-002), so the suggested IDs differ from the brief's examples while following the same rule
    duration_s: 579
  - at: 2026-11-01T15:32:12.714Z
    role: implementer
    result: done
    summary: Number-collision refusal now covers invariants, decisions, features and screens, with distinct next free IDs per prefix
    verdict: null
    assumed: []
    duration_s: 1485
  - at: 2026-11-01T15:37:47.088Z
    role: reviewer
    result: done
    summary: Approved top-level ID collision refusal and distinct per-prefix suggestions; 9 targeted tests passed
    verdict: approve
    assumed: []
    duration_s: 330
---
Self-hosting finding P67. PROP-092 and PROP-094 ran in parallel and both added INV-013. PROP-081's guard refuses a spec-writer report that takes a scenario or rule number or a lint code another running ticket's branch already added, but it does not cover invariants (spec/core/invariants.md) or other core IDs (decisions, glossary-level units). PROP-094's advance accepted INV-013; only the footprint check at the next stage noticed ("both change INV-013") and held PROP-094 until PROP-092 merges, after which it must renumber. Extend the same refusal to every new top-level unit ID a spec-writer adds (invariants first), with the same message shape that names the free number to use.
