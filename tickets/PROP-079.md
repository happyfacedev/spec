---
id: PROP-079
type: proposal
title: Lint knows the tests and spec marks on recorded review findings
status: done
stage: null
touches: [TKT-001]
violates: []
depends_on: []
changed: [TKT-001/R13, TKT-001/S30]
questions: []
history:
  - at: 2026-11-01T00:14:14.033Z
    role: spec-writer
    result: done
    summary: "TKT-001 R13 and S30: recorded finding marks and stage record keys are known, so lint stops warning on them"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [TKT-001/S17, LNT-014/S3]
        reason: "spec impact PROP-079 reaches no feature (0 must change, 0 re-verify, 0 scope gaps). The unknown-key warning the neighbours rely on still holds: TKT-001/S17 keeps findings2 unknown beside the new rule, and LNT-014/S3 is unchanged."
      - item: C2
        outcome: scenarios
        ids: [TKT-001/S30]
        reason: No path, install layout or platform input is new. The older state is every ticket already written with a tests mark (PROP-060, 061, 064, 066, 074, 078 on this repo), which is the shape S30 checks.
      - item: C3
        outcome: na
        ids: []
        reason: lint reads the store in one pass and holds no state across an await or a process boundary; the change adds none.
      - item: C4
        outcome: scenarios
        ids: [TKT-001/S30]
        reason: "The marks come from a reviewer's report, which PIP-003/R3 and PIP-004 check at intake. No new invariant: S30 shows that a mark which is not true or false is still refused once it is a known key."
      - item: C5
        outcome: scenarios
        ids: [TKT-001/S30, TKT-001/S17]
        reason: A tests value that is not true or false is an L020 error (S30), and a key the schema does not know still gets its warning (S17).
      - item: C6
        outcome: scenarios
        ids: [TKT-001/S16, TKT-001/S18]
        reason: "Unknown keys in a history record and its records keep their warning and their checks beside the known finding keys: S16 reads the ticket, S18 keeps the stage check beside the warning."
      - item: C8
        outcome: na
        ids: []
        reason: No fact about another tool or service is relied on. The current build was run on a copy of the worktree with probe tickets TASK-950 and TASK-951, and the output above is what it printed.
    assumed: []
    duration_s: 191
  - at: 2026-11-01T00:15:15.367Z
    role: spec-review
    result: done
    summary: R13 and S30 cover known recorded keys and preserve L020 errors for invalid values; no findings
    verdict: approve
    assumed: []
    duration_s: 59
  - at: 2026-11-01T00:20:51.058Z
    role: tester
    result: done
    summary: TKT-001/S30 test added beside S16-S18; it fails now on the tests mark
    verdict: null
    mutations:
      - scenario: TKT-001/S30
        wrong: "FINDING_KEYS still lacks tests, so a finding's tests: true is an L020 unknown-key warning"
    assumed: []
    duration_s: 334
  - at: 2026-11-01T00:33:29.439Z
    role: implementer
    result: done
    summary: FINDING_KEYS now includes tests, so lint knows a recorded finding's tests mark; build, check and tests pass
    verdict: null
    assumed: []
    duration_s: 756
  - at: 2026-11-01T00:38:05.770Z
    role: reviewer
    result: done
    summary: R13 and S30 hold; real-repo lint has no L020 warnings for tests marks; 10 focused tests pass
    verdict: approve
    assumed: []
    duration_s: 273
---
Found by PROP-063's reviewer. Review findings may carry `tests: true` or `spec: true` (PIP-004), and advance keeps them in the ticket's history. Lint then reports each one as an unknown key: L020 warning 'ticket has fields this spec does not know: history[n].findings[m].tests'. That accounts for most of the 16-19 L020 warnings on this repo, and the noise hides real ones. A recorded finding's `tests`, `spec` and `class` keys are known to the ticket schema, and lint reports none of them.
