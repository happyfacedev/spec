---
id: PROP-001
type: proposal
title: Lint refuses a draft marker on a member
status: done
stage: null
touches: [ADP-001]
violates: []
depends_on: []
changed: [ADP-001, ADP-001/R1, ADP-001/S1, ADP-001/S2, ADP-001/S3, ADP-001/S4, ADP-001/S5, ADP-001/S6, ADP-001/S7, ADP-001/S8, ADP-001/S9]
questions:
  - id: Q1
    kind: blocker
    text: "npm run lint fails only in tests/cli/draft-marker.test.ts: 8 no-confusing-void-expression errors at lines 119, 140, 146, 152, 159, 165, 170, 189 (arrow shorthands returning void). Clearing them means editing that test file, which the implementer may not change. The tester must add braces to those arrows, or Alex must decide on a lint-config change. The reverted change makes ADP-001/S8 pass, full suite 508 passed, typecheck clean."
    default: null
    cites:
      - ADP-001/S8
      - ADP-001/R1
    answer: "Fixed: a person commit (ab716c3) ran eslint --fix on the tester's test file; no behaviour change. Resume the implementer stage."
    raised_by: implementer
history:
  - at: 2026-10-29T11:16:04.426Z
    role: spec-writer
    result: done
    summary: "ADP-001: a member's · Draft: is refused with L001 that says to mark the contract instead (S8, R1)"
    verdict: null
    assumed:
      - new: Which lint code reports a member's draft marker
        value: L001, the code for a member status line lint cannot read (as LNT-005 S3)
      - new: Wording of the refusal's message and fix
        value: "message: '· Draft: marks a contract, not a member; mark the contract conversation.Message instead'; fix: 'move · Draft: <sources> to the status line of conversation.Message'"
  - at: 2026-10-29T11:25:32.889Z
    role: tester
    result: done
    summary: ADP-001 S1-S9 tests written; S8 fails as expected (lint accepts a member draft), the other eight pass
    verdict: null
    assumed:
      - new: Which lint warnings keep chat-mini from being an otherwise clean spec for S8 and S9
        value: "BUG-302 is removed from the test's copy of chat-mini; it is the only bug ticket with violates: []"
      - new: Where conversation.Message.content sits on line 9 of modules/conversation/contracts.md
        value: the test rewrites that file with conversation.Message first, its content member's status line on line 9, the rest unchanged
      - new: How to test R1, which is a rule and not a scenario ID
        value: "R1's check sits inside the ADP-001/S8 test, with a second spec holding a bare 'Draft: yes' on the member"
  - at: 2026-10-29T11:29:57.865Z
    role: implementer
    result: blocked
    summary: ADP-001/S8 passes with a lint rule; npm run lint fails only in the tester's draft-marker test file (8 errors)
    verdict: null
    assumed:
      - new: Should the member-draft L001 be a parse finding or a lint rule? A parse finding makes spec build exit 1, but draftedSpec needs build to exit 0
        value: lint rule only; the parser records the member's draft line
  - at: 2026-10-29T11:36:58.595Z
    role: implementer
    result: done
    summary: "ADP-001/S8: lint refuses a member's · Draft: marker as L001; the parser records draftLine on members"
    verdict: null
    assumed:
      - new: Should the tracked bundled CLI (.claude/skills/spec-spec/scripts/spec.cjs) be rebuilt in this ticket?
        value: No. The brief does not ask for it, and commits 6136eae and b90b8c7 refresh the bundle as a separate step
      - new: "A member whose first line is malformed status text with a marker, such as 'Status: bogus · Draft: x', already gets an L001 for its status. Add a second L001 for the marker?"
        value: No. The marker is recorded only on a valid status line, so the malformed-status finding stands alone
      - new: Is a '· Draft:' on a member's first line that does not start with 'Status:' a status line?
        value: No. Only a first line starting 'Status:' is a status line (X6), so other text is not a marker
  - at: 2026-10-29T11:40:11.026Z
    role: reviewer
    result: done
    summary: "approve: S8 and R1 hold, S1-S7 and S9 untouched by the diff; tests not re-run (Bash refused)"
    verdict: approve
    assumed:
      - new: Should the reviewer re-run the test suite and spec lint?
        value: No. Bash was refused for this session, so the verdict rests on reading the changed files, the test file, the fixture and the spec, plus the implementer's reported green run. The gate should re-run them.
      - new: "A member whose status line is malformed and also holds · Draft: gets only its existing malformed-status L001"
        value: Not a finding. The line is still an L001 error, which R1 requires, and this avoids two findings on one line.
---
Review 2026-10-29, ADP-001#Q1: a member's "· Draft:" marker does nothing today. Lint should refuse it on a member and say to mark the contract instead.
