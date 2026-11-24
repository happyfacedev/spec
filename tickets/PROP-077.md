---
id: PROP-077
type: proposal
title: The tester updates existing tests that encode behaviour the ticket's changed scenarios replace
status: done
stage: null
touches: [PIP-017]
violates: []
depends_on: []
changed: [PIP-017/R9, PIP-017/S12]
questions: []
history:
  - at: 2026-10-31T19:22:51.844Z
    role: spec-writer
    result: done
    summary: "PIP-017 gains R9 and S12: the tester updates the old tests a change replaces and lists them under changed"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-017/S1, PIP-017/S12]
        reason: spec impact PROP-077 reaches no feature beyond PIP-017; S1 still delivers the expanded tester prompt in the task, and S12 shows the tester prompt holds the new rule
      - item: C2
        outcome: na
        ids: []
        reason: the change adds prompt text only; no paths, platforms or versions are involved, and a project's installed tester prompt is refreshed by INS-005 like any other prompt change
      - item: C3
        outcome: na
        ids: []
        reason: no state is shared across an await or a process boundary; the rule is text in the delivered prompt
      - item: C4
        outcome: na
        ids: []
        reason: no input crosses a trust boundary; the tester reads its brief and the repository's tests as it already does
      - item: C5
        outcome: scenarios
        ids: [PIP-017/S12]
        reason: a case the tester cannot decide is named under assumed, not guessed, and S12 shows the prompt says so
      - item: C6
        outcome: scenarios
        ids: [PIP-017/S1, PIP-019/S4]
        reason: the tester's task still holds the expanded prompt, and the tester prompt still carries the mutations rule of PIP-019/S4
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool or service is stated
    assumed:
      - new: Does the tester's new rule belong in PIP-019 beside the mutations rule (PIP-019/R4), or in PIP-017 as the ticket's touches and the brief name?
        value: PIP-017, where the ticket and brief put it; PIP-019/R4 is left as it is
    duration_s: 141
  - at: 2026-10-31T19:23:27.598Z
    role: spec-review
    result: done
    summary: R9 and S12 cover the requested tester-prompt change and preserve neighbouring behaviour
    verdict: approve
    assumed: []
    duration_s: 34
  - at: 2026-10-31T19:30:54.217Z
    role: tester
    result: done
    summary: PIP-017/S12 test added and red on the current tester prompt; no existing test pins the prompt text.
    verdict: null
    mutations:
      - scenario: PIP-017/S12
        wrong: tester prompt says to search old tests but never lists changed IDs or names assumed
    assumed: []
    duration_s: 445
  - at: 2026-10-31T20:10:24.761Z
    role: implementer
    result: done
    summary: R9 rule added to roles/tester.md, build and check pass; installed spec/roles/tester.md not refreshed
    verdict: null
    assumed:
      - new: "Installed spec/roles/tester.md: the implementer may not change spec files and check-report refuses the edit, so should a person run spec init --update-roles --yes to refresh it?"
        value: left unchanged; it lacks the R9 rule until refreshed
      - new: roles/tester.md lacks the Write spec bullet and two paragraphs (Follow the patterns, Before you finish) that the installed copy has; update-roles would drop them
        value: not changed by this stage
    duration_s: 2369
  - at: 2026-10-31T20:11:56.224Z
    role: reviewer
    result: done
    summary: R9 and S12 delivered; mutation caught by assertions; all 40 next tests pass; existing checklist behaviour preserved.
    verdict: approve
    assumed: []
    duration_s: 90
---
Measured on this repo (SELF-HOSTING P42). PROP-060's implementer found 20 existing tests that still drove the old stage order, and PROP-062's implementer found a test asserting text the spec now quotes differently. Old tests like these pass on the old code, so the tester's run cannot show them. They surface only after the implementer writes the code, which costs a blocked stage and a tester round. Change the tester role prompt (roles/tester.md, and spec/roles via update-roles). For each changed scenario or rule, the tester searches the existing tests for the behaviour it replaces, such as an old message text, a stage order, a default or a flag, and updates those tests in the same stage. It lists their scenario IDs under changed. In its report it names any it could not decide under assumed.
