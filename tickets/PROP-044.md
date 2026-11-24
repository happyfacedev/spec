---
id: PROP-044
type: proposal
title: spec hook exits 1 when it finds no spec root, so a broken install does not block the session
status: done
stage: null
touches: [INS-007]
violates: []
depends_on: []
changed: [CLI-005, CLI-005/R1, CLI-005/S8, INS-007, INS-007/R1, INS-007/S6, INS-007/S7, INS-007/S8, INS-007/S9, INS-007/S10, cli.InvalidSkillPointer, install.Hook]
questions:
  - id: Q1
    kind: blocker
    text: 'The implementer stage ended with an invalid report: tests fail (exit 1): see the test output. Its changes are kept in git stash "PROP-044 implementer: blocked"; the next implementer stage gets them back. Answer to resume.'
    default: null
    cites: []
    answer: "Resume: the stage check ran the full suite and it failed, although your report said all tests pass. Find which test fails, and whether it fails every time or only under load."
    raised_by: implementer
  - id: Q2
    kind: blocker
    text: "check-report rejects result done on four unrelated L020 errors: PROP-023 history[5].findings and history[10].findings; PROP-042 history[7].findings and history[11].findings. Branch and base lint both fail. Resolve live-ticket schema compatibility outside this read-only review, then revalidate a done report."
    default: null
    cites:
      - PIP-004/R4
      - PIP-004/S14
    answer: "The L020 errors come from branch skew: PROP-040 (merged) added findings to history records, and this branch's schema predates it. Restarting the stage syncs the branch with main, which brings the new schema. Review again."
    raised_by: reviewer
history:
  - at: 2026-10-29T22:53:40.008Z
    role: spec-writer
    result: done
    summary: spec hook exits 1 with the usual message when the spec root is absent, missing or its skill.json is not JSON
    verdict: null
    assumed:
      - new: Does an unparseable skill.json count as an unavailable spec root for spec hook?
        value: "yes: cli.InvalidSkillPointer also exits 1 from spec hook (INS-007/S10)"
      - new: What does spec hook print when it finds no spec root?
        value: the same stderr as any other command, as today (message, empty line, usage text), stdout empty; only the exit code changes from 2 to 1
    duration_s: 427
  - at: 2026-10-29T23:14:06.931Z
    role: tester
    result: done
    summary: "Six new tests fail on exit 2 where 1 is wanted: INS-007/S6 to S10 and CLI-005/S8; lint and typecheck clean"
    verdict: null
    assumed:
      - new: Which folder stands in for /p and /nonexistent in INS-007/S6 to S10 and CLI-005/S8?
        value: a fresh temp folder per test, with the missing root inside it
    duration_s: 1226
  - at: 2026-10-29T23:31:47.925Z
    role: implementer
    result: blocked
    summary: invalid report
    verdict: null
    assumed: []
    duration_s: 1060
  - at: 2026-10-30T00:21:35.985Z
    role: implementer
    result: done
    summary: spec hook exits 1 for no spec root or bad skill.json; WSP-005/S3 flaky under concurrent suites, not this change
    verdict: null
    assumed:
      - new: Should spec hook exit 1 for bad options too, not only for a missing spec root or a skill.json that is not JSON?
        value: "no: bad options keep exit 2, as CLI-005/R1 says"
    duration_s: 2971
  - at: 2026-10-30T02:15:00.543Z
    role: reviewer
    result: blocked
    summary: "Diff approved: 30 comparisons and 50 tests pass; candidate bug: live-ticket history.findings schema skew"
    verdict: approve
    assumed: []
    duration_s: 6804
  - at: 2026-10-30T02:20:34.565Z
    role: reviewer
    result: done
    summary: "Unchanged ticket diff approved; 30 branch/base comparisons and 50 targeted tests pass; spec lint: 0 errors"
    verdict: approve
    assumed: []
    duration_s: 330
---
Found by PROP-014's review. `spec hook <harness> <event>` refuses an absent or unavailable spec root before it reads the event, and exits 2 (src/cli/run.ts refuses the root first). Claude Code treats exit 2 from a hook as blocking, so a moved or deleted skill folder blocks every tool call the hook is attached to. A missing spec root is a misconfiguration like an unknown harness or event: `spec hook` exits 1 with its message there, so the session goes on. Exit 2 stays only for a deliberate block (INS-010).
