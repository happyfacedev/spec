---
id: PROP-104
type: proposal
title: A ticket held mid-pipeline keeps its place ahead of tickets started later
status: done
stage: null
touches: [TKT-011, CLI-007]
violates: []
depends_on: []
changed: [TKT-011, TKT-011/R5, TKT-011/R8, TKT-011/S11, TKT-011/S27, TKT-011/S28]
questions: []
history:
  - at: 2026-11-01T17:28:29.087Z
    role: spec-writer
    result: done
    summary: "Plan keeps an in-flight held ticket ahead of newer conflicting tickets: TKT-011 R5, R8 and new S27"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [TKT-011/S27, TKT-011/S20, TKT-011/S23, TKT-011/S11, TKT-011/S1, CLI-007/S3]
        reason: spec impact reaches only TKT-011 and CLI-007. S20 and S23 (in flight) stay true. S11 and S1 (first fit, nothing in flight) stay true. CLI-007/S3 lists the plan's now wave and is unchanged.
      - item: C2
        outcome: na
        ids: []
        reason: Wave ordering depends on ticket status, stages and branch merge state, not on paths, layouts or platforms. No older state to upgrade.
      - item: C3
        outcome: scenarios
        ids: [TKT-011/S27, TKT-011/S21]
        reason: While a running ticket holds the in-flight one out of wave 1, a newer ticket arrives and must not jump ahead (S27). Once the branch merges, the ticket is no longer in flight (S21).
      - item: C4
        outcome: na
        ids: []
        reason: No new input crosses a trust boundary. The plan only reads tickets and git state it already reads.
      - item: C5
        outcome: scenarios
        ids: [TKT-011/S15, TKT-011/S16]
        reason: "Unchanged: unknown tickets are blocked (S15) or refused (S16). The change adds no new input."
      - item: C6
        outcome: scenarios
        ids: [TKT-011/S27, TKT-011/S11, TKT-011/S1, TKT-011/S10]
        reason: Without an in-flight ticket first fit is unchanged (S27 last clause, S11, S1, S10).
      - item: C8
        outcome: na
        ids: []
        reason: No external tool or service fact is involved.
    assumed:
      - new: Should `spec next <ID> --start` start just that ticket?
        value: No. `spec next <ID>` already starts exactly that ticket (CLI-007/S1), so the variant is redundant and stays refused with usage as today.
      - new: Which tickets count as held in flight?
        value: "As R8 already defines it: history recorded and branch not merged, whatever the status. S27 uses that definition and adds no new notion."
    duration_s: 164
  - at: 2026-11-01T17:40:22.155Z
    role: spec-review
    result: done
    summary: Reconcile preserved first-fit coverage and qualify the later-wave guarantee by priority
    verdict: changes
    findings:
      - cites: [TKT-011/S11, TKT-011/R5, TKT-011/R8]
        text: "S11 is incorrectly cited as preserved first-fit behaviour without an in-flight ticket: its Givens record PROP-201's and PROP-205's spec-writer stages without saying their branches are merged. With unmerged stages, the new guarantee forbids TASK-103 from taking wave 1 ahead of conflicting PROP-201 in wave 2, yet S11 still requires exactly that. Align S11's Givens or expectations with the changed rule and correct the checklist."
        class: C6
      - cites: [TKT-011/R8, TKT-011/R5, TKT-011/S27]
        text: The strengthened R8 requires every conflicting ticket to occupy a later wave, without limiting that guarantee by R5 priority. In S27, running BUG-301 conflicts with in-flight PROP-201, so this wording also requires BUG-301 to follow PROP-201, contrary to the required waves 1 and 2. Two conflicting in-flight tickets likewise acquire reciprocal later-wave requirements. Qualify which ticket yields, preserving running/dependency precedence and defining how the guarantee applies between in-flight tickets.
        class: C3
    assumed: []
    duration_s: 710
  - at: 2026-11-01T17:43:24.315Z
    role: spec-writer
    result: done
    summary: "Narrowed R8: only no-stage tickets yield to in-flight ones; S11 merged branches; S27 recomputed; S28 added"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [TKT-011/S27, TKT-011/S28, TKT-011/S11, TKT-011/S20, TKT-011/S21, TKT-011/S22, TKT-011/S23, TKT-011/S10, CLI-007/S3]
        reason: spec impact reaches TKT-011 and CLI-007. In-flight scenarios S20, S21, S23 hold. S11 now has merged branches and keeps its first fit. S10 and S22 re-checked by hand. CLI-007/S3 lists the plan's now wave and is unchanged.
      - item: C2
        outcome: na
        ids: []
        reason: Wave ordering depends on ticket status, stages and branch merge state, not on paths, layouts or platforms. No older state to upgrade.
      - item: C3
        outcome: scenarios
        ids: [TKT-011/S27, TKT-011/S28, TKT-011/S21]
        reason: While a running ticket holds the in-flight one out of wave 1, a ticket with no stage arrives and must not jump ahead (S27). Two in-flight tickets keep asked order (S28). After the merge the ticket is no longer in flight (S21, S27).
      - item: C4
        outcome: na
        ids: []
        reason: No new input crosses a trust boundary. The plan reads tickets and git state it already reads.
      - item: C5
        outcome: scenarios
        ids: [TKT-011/S15, TKT-011/S16]
        reason: "Unchanged: unknown tickets are blocked (S15) or refused (S16). The change adds no new input."
      - item: C6
        outcome: scenarios
        ids: [TKT-011/S11, TKT-011/S1, TKT-011/S10, TKT-011/S27, TKT-011/S28]
        reason: Without a no-stage ticket in conflict with one in flight, first fit and the R5 order are unchanged (S11, S1, S10, S28, last clause of S27).
      - item: C8
        outcome: na
        ids: []
        reason: No external tool or service fact is involved.
    assumed:
      - new: Should `spec next <ID> --start` start just that ticket?
        value: No. `spec next <ID>` already starts exactly that ticket (CLI-007/S1), so the variant is redundant and stays refused with usage as today.
      - new: Does a ticket with a recorded stage but a merged branch yield to an in-flight ticket?
        value: No. It is not in flight and has a recorded stage, so only plain R5 first fit applies, as in S11.
    duration_s: 180
  - at: 2026-11-01T17:44:21.446Z
    role: spec-review
    result: done
    summary: Both findings resolved; S11, S27 and S28 wave ordering checks out
    verdict: approve
    assumed: []
    duration_s: 52
  - at: 2026-11-01T18:32:04.214Z
    role: tester
    result: done
    summary: Added TKT-011/S27 (fails) and S28; S11 setup now uses merged branches; lint and typecheck clean
    verdict: null
    mutations:
      - scenario: TKT-011/S27
        wrong: a no-stage ticket takes wave 1 ahead of the in-flight ticket, because a running ticket holds the in-flight ticket out of wave 1
      - scenario: TKT-011/S27
        wrong: the in-flight ticket still counts as in flight after its branch is merged, so TASK-102 stays in wave 3
      - scenario: TKT-011/S28
        wrong: a no-stage dependency is pushed behind the in-flight ticket that depends on it, so TASK-901 leaves wave 1
      - scenario: TKT-011/S28
        wrong: two tickets in flight are ordered by ID instead of the order asked, so PROP-202 and PROP-201 swap
      - scenario: TKT-011/S11
        wrong: a ticket with a recorded stage counts as in flight although its branch is merged, so TASK-103 moves to wave 3
    assumed: []
    duration_s: 2860
  - at: 2026-11-01T18:48:34.315Z
    role: implementer
    result: done
    summary: "Plan: a no-stage ticket takes a wave after a conflicting in-flight ticket; dependencies and in-flight/running keep R5"
    verdict: null
    assumed: []
    duration_s: 986
  - at: 2026-11-01T18:54:04.130Z
    role: reviewer
    result: done
    summary: R8 wave ordering matches the spec; preserved R5 behavior and mutation checks hold; 41 targeted tests pass
    verdict: approve
    assumed: []
    duration_s: 327
---
Self-hosting finding P68. PROP-094 finished its spec stage, was held by a footprint overlap with PROP-092, and while it waited `spec next --start` started PROP-096 and later PROP-099, both of which also touched PIP-017 or PIP-021. The plan then put PROP-094 after both ('after PROP-096', 'after PROP-099'), so a ticket that had done work lost its place to newer ones and later needed a hand merge. `spec next --start` starts the whole safe wave and cannot start one named ticket, so the session could not keep the older ticket first. Fix: in the plan, a ticket that has recorded stages and is only held goes ahead of tickets with no recorded stage when they overlap; and/or let `spec next <ID> --start` start just that ticket.
