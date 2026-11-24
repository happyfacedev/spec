---
id: PROP-022
type: proposal
title: plan lists a ticket once, under Needs a person
status: done
stage: null
touches: [TKT-011]
violates: []
depends_on: []
changed: [TKT-011, TKT-011/R7, TKT-011/S19, TKT-011/S23]
questions: []
history:
  - at: 2026-10-30T04:04:51.175Z
    role: spec-writer
    result: done
    summary: "TKT-011 R7/S19: a ticket that waits for a person takes no wave and is listed only under Needs a person"
    verdict: null
    assumed:
      - new: Does a ticket that conflicts with one listed under Needs a person only because of a conflict also wait for a person?
        value: "No: as today, only a conflict with a ticket that waits through a dependency holds a ticket back; one listed through a conflict holds back only its dependents"
      - new: Where does a ticket go that depends on a ticket that waits for a person but needs no person itself? Today it appears in no section of the plan
        value: Under Needs a person, with the reason ''waits for <ID>, which waits for a person''
    duration_s: 150
  - at: 2026-10-30T04:13:39.251Z
    role: tester
    result: done
    summary: "S19 and R7 tests: dependent ticket and conflicting ticket listed once under Needs a person, in no wave or after"
    verdict: null
    assumed: []
    duration_s: 527
  - at: 2026-10-30T04:30:04.236Z
    role: implementer
    result: done
    summary: plan lists a ticket once under Needs a person when it waits for one through a dependency or a conflict (R7, S19)
    verdict: null
    assumed: []
    duration_s: 983
  - at: 2026-10-30T04:36:17.618Z
    role: reviewer
    result: done
    summary: R7's new no-after guarantee conflicts with R8 for person-blocked tickets holding unmerged stages.
    verdict: changes
    findings:
      - cites:
          - TKT-011/R7
          - TKT-011/R8
          - TKT-011/S21
        text: "spec/modules/tickets/features/TKT-011-plan.md:184 newly forbids every after-list reference to a ticket waiting for a person, but R8 preserves reservations for unmerged recorded stages regardless of status, as S21 demonstrates. In an in-memory fixture where PROP-201 has an unanswered blocker and an unmerged spec-writer stage, plan PROP-201 BUG-301 puts PROP-201 under Needs a person and BUG-301 in wave 2 after PROP-201. Branch and base agree: src/core/plan.ts:183 retains the reservation. This was valid under base R7, but contradicts the new unconditional guarantee. State the in-flight exception in R7 to preserve R8/S21, and cover the overlap with a scenario and test."
        spec: true
    assumed: []
    duration_s: 373
  - at: 2026-10-30T04:37:23.970Z
    role: spec-writer
    result: done
    summary: TKT-011 R7 keeps the in-flight exception of R8; S23 shows a blocked ticket in flight still holding its place
    verdict: null
    assumed: []
    duration_s: 66
  - at: 2026-10-30T04:45:11.688Z
    role: tester
    result: done
    summary: Added S23 (in-flight ticket waiting for a person) test; R7 tests now note the in-flight exception
    verdict: null
    assumed: []
    duration_s: 467
  - at: 2026-10-30T04:55:20.986Z
    role: implementer
    result: done
    summary: No code change needed for the R7 in-flight exception and S23; full suite, e2e, lint and typecheck pass
    verdict: null
    assumed: []
    duration_s: 609
  - at: 2026-10-30T04:58:26.598Z
    role: reviewer
    result: done
    summary: R7/R8 agree; S19/S23 probes pass; first-reason retention is specified by R7.
    verdict: approve
    assumed: []
    duration_s: 185
---
Review 2026-10-29, TKT-011#Q1 (bug found in drafting): a ticket that conflicts with a ticket stuck on a person is listed only under Needs a person, not also in a wave.
