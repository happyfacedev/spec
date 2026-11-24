---
id: PROP-090
type: proposal
title: The lock-takeover test runs deterministically under load
status: done
stage: null
touches: [PIP-002]
violates: []
depends_on: []
changed: [PIP-002/S26]
questions: []
history:
  - at: 2026-11-01T04:16:49.009Z
    role: spec-writer
    result: done
    summary: The race is in the test, not the lock; PIP-002/S26 and R7 already state the behaviour, so the spec is unchanged.
    verdict: null
    checklist:
      - item: C1
        outcome: na
        ids: []
        reason: No spec unit changes, so no neighbour is reached; PIP-002/S26 and R7 already state the takeover behaviour the lock has
      - item: C2
        outcome: na
        ids: []
        reason: No behaviour changes; the lock is a file in the git common directory, unchanged
      - item: C3
        outcome: scenarios
        ids: [PIP-002/S26]
        reason: Rule R7 is already shown by S26, which shows many processes finding one dead lock at once and taking it over one at a time; code review of the lock finds no path to two holders or to ENOTEMPTY
      - item: C4
        outcome: na
        ids: []
        reason: No input crosses a trust boundary in this change
      - item: C5
        outcome: na
        ids: []
        reason: No change; an unreadable lock is already treated as dead only after 10 s
      - item: C6
        outcome: scenarios
        ids: [PIP-002/S26]
        reason: The lock's behaviour stays exactly as S26 states it
      - item: C8
        outcome: na
        ids: []
        reason: No external fact
    assumed:
      - new: Is the flake a lock defect?
        value: "No: the tester fixes tests/io/lock.test.ts and tests/io/lock-child.ts alone. (1) The test compares times across processes as performance.timeOrigin + performance.now(); each process's origin is sampled separately, so on a loaded machine two holds can look overlapping by a millisecond or so though the lock never had two holders. Use one clock (Date.now(), or a shared monotonic source) or order the holds by a counter the lock holder writes under the lock. (2) ENOTEMPTY comes from the test's afterAll rmSync of the temp dir while contender children are still writing into it after a timeout or early failure; wait for the children to end (kill them) before removing the dir. The lock never removes a directory. I read src/io/lock.ts and could not construct an interleaving that gives two holders or an ENOTEMPTY: takeover is under the guard file, the re-inspect under the guard sees any live lock, and nothing else can replace a dead lock while the guard is held. Eight parallel runs of S26 passed, so I could not reproduce the failure."
    duration_s: 256
  - at: 2026-11-01T04:17:41.502Z
    role: spec-review
    result: done
    summary: "Approve unchanged spec: guarded takeover preserves exclusivity; timing and child cleanup races belong to the test."
    verdict: approve
    assumed: []
    duration_s: 50
  - at: 2026-11-01T04:30:37.976Z
    role: tester
    result: done
    summary: S26 test now orders holds by a shared counter (no clock) and kills/awaits children before rmSync; 20/20 under load
    verdict: null
    mutations:
      - scenario: PIP-002/S26
        wrong: two contenders take over a dead lock at once
      - scenario: PIP-002/S26
        wrong: takeover removes a live lock a second contender just created, so two hold it together
    assumed: []
    duration_s: 774
  - at: 2026-11-01T04:35:39.638Z
    role: implementer
    result: done
    summary: "No code change: the lock is correct; the tester fixed the S26 test's clock and cleanup races"
    verdict: null
    assumed:
      - new: Does src/io/lock.ts need a change?
        value: "No: the spec-writer and spec review found no interleaving that gives two holders or ENOTEMPTY; the race was in the test"
    duration_s: 299
  - at: 2026-11-01T04:36:38.629Z
    role: reviewer
    result: done
    summary: "Approve: shared-counter assertions retain S26 overlap detection, remove clock comparisons, and cleanup awaits children."
    verdict: approve
    assumed: []
    duration_s: 57
---
Measured on this repo (SELF-HOSTING P61). tests/io/lock.test.ts, PIP-002/S26 ('contenders that find a dead owner take the lock over one at a time'), fails now and then under load. It failed at advance on PROP-083 and passed on retry, and a check-report on PROP-077 hit an ENOTEMPTY in the same test. A flaky test inside advance's suite costs a refusal attempt (3 allowed) and agents' time. Change: the takeover scenario is tested without timing races, for example with an injected clock or controlled interleaving, so it passes or fails the same way on every run. The lock's behaviour stays as PIP-002/S26 states it; if the race is in the lock itself rather than the test, the fix goes there.
