---
id: PROP-109
type: proposal
title: An approval's Follow-up findings do not trip the approval-gap check
status: done
stage: null
touches: [PIP-004]
violates: []
depends_on: []
changed: [PIP-004/R5, PIP-004/S18, PIP-004/S29]
questions: []
history:
  - at: 2026-11-01T22:36:13.747Z
    role: spec-writer
    result: done
    summary: R5 checks gap words only in the summary and in non-Follow-up findings; added S29, narrowed S18.
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-004/S18, PIP-004/S29, PIP-004/S22]
        reason: spec impact reaches only PIP-004 and its neighbours; none of their scenarios depend on how R5 treats findings
      - item: C2
        outcome: na
        ids: []
        reason: the check reads report text only; no paths, platforms or install layouts are involved
      - item: C3
        outcome: na
        ids: []
        reason: check-report changes nothing and shares no state across a process boundary
      - item: C4
        outcome: scenarios
        ids: [PIP-004/S29]
        reason: "a reviewer can write the Follow-up: prefix on any finding, so S29 shows the prefix exempts only the gap words: the summary, other findings and the spec/tests marks (R6) are still refused"
      - item: C5
        outcome: scenarios
        ids: [PIP-004/S29, PIP-004/S18]
        reason: a gap in the summary or in a non-Follow-up finding is still refused
      - item: C6
        outcome: scenarios
        ids: [PIP-004/S18, PIP-004/S22]
        reason: the refusal, its exact problem text, and the class requirement on Follow-up findings are unchanged
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool or service
    assumed: []
    duration_s: 45
  - at: 2026-11-01T22:37:28.431Z
    role: spec-review
    result: done
    summary: "Approve: Follow-up exemption is scoped to finding text and preserves the remaining approval guards."
    verdict: approve
    assumed: []
    duration_s: 73
  - at: 2026-11-01T22:45:10.500Z
    role: tester
    result: done
    summary: "S29 tests added: 3 of 5 checks fail on assertion now; S18 gets a Follow-up-later case; lint and typecheck clean"
    verdict: null
    mutations:
      - scenario: PIP-004/S29
        wrong: skips every finding of an approval, so a plain finding that names a gap passes
      - scenario: PIP-004/S18
        wrong: checks only the summary of an approval, so a gap in a finding passes
    assumed:
      - new: S29 R6 step gives one problem; the corpus checks the full problem list, so it is taken as the only one
        value: exact list
    duration_s: 460
  - at: 2026-11-01T22:51:38.287Z
    role: implementer
    result: done
    summary: approvalGap skips findings starting with Follow-up:, so only the summary and other findings are checked
    verdict: null
    assumed: []
    duration_s: 386
  - at: 2026-11-01T22:52:54.857Z
    role: reviewer
    result: done
    summary: "Approve: Follow-up exemption is scoped correctly; summary, other findings and R6 guards remain intact."
    verdict: approve
    assumed: []
    duration_s: 75
---
Self-hosting finding P79, decided by the person on 2026-11-01. PIP-004/R5 refuses an approving report whose summary or any finding contains a gap word (APPROVAL_GAP_WORDS: 'does not', "doesn't", 'not implemented', 'missing', 'TODO'). PROP-102's reviewer approved with a finding 'Follow-up: … this unusual DTD case does not block approval.', and advance refused it ('an approval names a gap'), costing an attempt. Findings whose text starts with 'Follow-up:' are optional by definition on an approve (the reviewer and spec-review prompts already use that prefix). Check the gap words only in the summary and in findings that are not Follow-up findings; keep the refusal for an approve whose summary or a non-follow-up finding names a gap.
