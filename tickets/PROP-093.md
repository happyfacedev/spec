---
id: PROP-093
type: proposal
title: Spec review checks computed output a scenario pins
status: done
stage: null
touches: [PIP-017]
violates: []
depends_on: []
changed: [PIP-017/R12, PIP-017/R13, PIP-017/S15, PIP-017/S16, PIP-017/S17]
questions: []
history:
  - at: 2026-11-01T12:14:20.891Z
    role: spec-writer
    result: done
    summary: "PIP-017: spec-writer prefers properties to computed values; spec-review recomputes pinned values (S15-S17, R12-R13)"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-017/S15, PIP-017/S16, PIP-017/S17]
        reason: "spec impact PROP-093 reaches no feature beyond PIP-017 (Must change 0, Re-verify 0). S10 and R7 stay true: a changes verdict for a wrongly pinned scenario is the 'scenario it gets wrong' they already allow. S7, S8, S9 and S13 are unaffected."
      - item: C2
        outcome: scenarios
        ids: [PIP-017/S17]
        reason: A project installed by an earlier version keeps its own spec-writer and spec-review prompts. spec next adds nothing for the new rules, and only spec init --update-roles brings them.
      - item: C3
        outcome: na
        ids: []
        reason: The change is prompt wording. It adds no state shared across an await or a process boundary.
      - item: C4
        outcome: na
        ids: []
        reason: No new input crosses a trust boundary. Ticket text stays data, and a finding still needs a class under the existing R10 and PIP-004/R8.
      - item: C5
        outcome: scenarios
        ids: [PIP-017/S16]
        reason: "A pinned value that does not match the recomputed one gives verdict changes. A value the spec writer could not work out goes under assumed. A value the spec review could not recompute goes in a Follow-up: finding. None passes silently."
      - item: C6
        outcome: scenarios
        ids: [PIP-017/S17, PIP-017/S7, PIP-017/S8, PIP-017/S9, PIP-017/S10, PIP-017/S13]
        reason: Older prompts and the tester, implementer and reviewer tasks are unchanged. The checklist, report form and class instructions behave as before.
      - item: C8
        outcome: na
        ids: []
        reason: No fact about another tool or service is involved.
    assumed:
      - new: Which finding class a mismatched pinned value gets. The ticket says 'a C-class finding'.
        value: No fixed class. The finding carries a class like every finding (R10), and the spec review picks the fitting one.
      - new: Whether a pinned value the spec review could not recompute may force changes.
        value: No. It goes in a 'Follow-up:' finding, which keeps S10's proportion rule. Only a mismatch forces changes.
      - new: Whether spec next appends the new rules to an older project prompt, as R6 and R10 do for check-report needs.
        value: No. check-report does not need them, so the project gets them through spec init --update-roles (S17).
    duration_s: 110
  - at: 2026-11-01T12:16:19.994Z
    role: spec-review
    result: done
    summary: "Approved: computed-value prompt rules cover the proposal and preserve existing task behaviour."
    verdict: approve
    assumed: []
    duration_s: 117
  - at: 2026-11-01T12:31:58.121Z
    role: tester
    result: done
    summary: Added tests for PIP-017/S15, S16 and S17 in tests/cli/next.test.ts; S15 and S16 fail now, S17 passes; lint and typecheck clean
    verdict: null
    mutations:
      - scenario: PIP-017/S15
        wrong: the spec-writer prompt still only says to run the build for current behaviour and never says to prefer properties or to name unworkable pinned values under assumed
      - scenario: PIP-017/S16
        wrong: "the spec-review prompt tells it to recompute pinned values but a mismatch only becomes a Follow-up: finding, not verdict changes"
      - scenario: PIP-017/S17
        wrong: spec next appends the computed-value paragraph to an older project spec-writer or spec-review prompt, or to the tester, implementer or reviewer task
    assumed:
      - new: Wording of the S15/S16 role prompts is not fixed by the spec, so tests match meaning with regexes and count 'by hand' and 'non-trivial logic' once in the whole task.
        value: The implementer's wording must contain those phrases.
      - new: S16's Given has a delta scenario that pins a footprint. The prompt does not depend on it, so the test does not add such a scenario to the fixture.
        value: Test only the role prompt in the task.
      - new: S17 builds an older spec-review prompt, and one older spec-writer prompt, by taking out the lines of this version's prompt that hold the new wording.
        value: Taking out the lines that hold the new wording gives a valid older prompt.
    duration_s: 936
  - at: 2026-11-01T12:41:16.215Z
    role: implementer
    result: blocked
    summary: Prompts and role manifest done; lint, typecheck clean; S15 test counts 'by hand' across the brief too, so it fails
    verdict: null
    blockers:
      - text: "the test for PIP-017/S15 expects the whole spec-writer task to hold 'by hand' exactly once (tests/cli/next.test.ts:553), but the brief the task embeds already contains it (fixtures/chat-mini settings module summary: 'change by hand'), and the same test needs /derive\\w* by hand/ in the prompt, so the count is 2 for any wording; S15 says the instruction appears once, so the test should count the role prompt only"
        cites: [PIP-017/S15, PIP-017/R12]
        tests: true
    assumed: []
    duration_s: 555
  - at: 2026-11-01T12:53:50.971Z
    role: tester
    result: done
    summary: Fixed PIP-017/S15 and S16 tests to count computed-value phrases in the role prompt only; all 46 next tests pass, lint and typecheck clean
    verdict: null
    mutations:
      - scenario: PIP-017/S15
        wrong: the computed-value instruction is in the spec-writer prompt twice (for example added both by the shared prompt and the role prompt), or is missing the Givens/assumed parts
      - scenario: PIP-017/S16
        wrong: "the spec-review prompt says to recompute pinned values but a mismatch is only a Follow-up: finding, not verdict changes, or the instruction is repeated in the prompt"
    passed: true
    assumed: []
    duration_s: 742
  - at: 2026-11-01T12:55:40.504Z
    role: reviewer
    result: done
    summary: "Approved: computed-value prompts match PIP-017; preserved behaviour and targeted tests pass."
    verdict: approve
    assumed: []
    duration_s: 107
---
Self-hosting finding P55 (docs/SELF-HOSTING.md). On PROP-081 the spec-writer pinned exact output of logic it could not run (computed footprints and ID orders). The values were wrong, and three tester and implementer rounds went to finding that out. The role prompts should prevent it: the spec-writer prefers properties (ordering, membership, counts it can derive by hand) over pinned computed values, and when a scenario does pin a value computed by non-trivial logic, the spec review recomputes it from the scenario's Givens, and returns changes with a C-class finding if it does not match. Change the prompt rules for both roles (PIP-017) and their scenarios.
