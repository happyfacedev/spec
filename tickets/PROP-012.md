---
id: PROP-012
type: proposal
title: --update-roles names the command skills and gets its plural right; compile-roles removes a gone role's agent
status: done
stage: null
touches: [INS-005, INS-006]
violates: []
depends_on: []
changed: [INS-005/S1, INS-005/S2, INS-005/S3, INS-005/S4, INS-005/S5, INS-005/S6, INS-005/S7, INS-005/S8, INS-005/S9, INS-005/S10, INS-005/S11, INS-006/R2, INS-006/R4, INS-006/S8, INS-006/S14, INS-006/S15, INS-006/S19, install.CompileRoles, install.RoleUpdate, install.RoleUpdate.written]
questions:
  - id: Q1
    kind: blocker
    text: "install.RoleUpdate.written says 'each agent file that changed', but INS-005/S4 lists wrote .claude/agents/tester.md although that agent file is byte-identical. Suggested wording: 'the files written: the replaced prompts, then the agent file of each replaced prompt and each other agent file that changed. Empty without --yes.' Spec-writer must change the contract."
    default: null
    cites:
      - install.RoleUpdate.written
      - INS-005/S4
    answer: "Agreed: the contract is wrong, the code and S4 are right. Reword install.RoleUpdate.written as suggested: the files written, being the replaced prompts, then the agent file of each replaced prompt and each other agent file that changed; empty without --yes."
    raised_by: implementer
  - id: Q2
    kind: blocker
    text: The implementer's code already passes every test of the new scenarios; the tester check requires at least one to fail. Tests are correct and unchanged; skip this check on the rerun.
    default: null
    cites:
      - INS-005/S1
      - INS-005/S4
      - INS-006/S19
    answer: "Agreed: no test changes; the tests are right and the code already delivers them. Skip on to the implementer, who needs no change either, then the reviewer."
    raised_by: tester
history:
  - at: 2026-10-29T20:12:30.134Z
    role: spec-writer
    result: done
    summary: --update-roles names command skills and agrees in number; compile-roles removes a gone role's agent file
    verdict: null
    assumed:
      - new: What wording names the command skills in --update-roles messages?
        value: role prompts and command skills are up to date; N role prompt(s) or command skill(s) differ(s)
      - new: What does compile-roles print for a removed agent file?
        value: removed .claude/agents/<role>.md
      - new: Which agent files does compile-roles remove?
        value: Only .claude/agents/<role>.md of the five pipeline roles with no role file; other files are left alone
    duration_s: 117
  - at: 2026-10-29T20:26:26.707Z
    role: tester
    result: done
    summary: "Tests for INS-005 S1-S11 and INS-006 S14, S15, S19; S1-S5, S9 and S19 fail now as expected (S9: lineDiff of a missing file)"
    verdict: null
    assumed: []
    duration_s: 836
  - at: 2026-10-29T20:57:43.418Z
    role: implementer
    result: done
    summary: --update-roles names command skills, agrees in number, lists diffs fixed for missing files; compile-roles removes gone agents
    verdict: null
    assumed:
      - new: In what order does --update-roles list role prompts?
        value: Role prompts alphabetically by role, then command skills
      - new: With --yes, is the agent file of a replaced prompt listed as written when its text is unchanged?
        value: Yes, listed as wrote .claude/agents/<role>.md
    duration_s: 1876
  - at: 2026-10-29T21:12:38.306Z
    role: reviewer
    result: done
    summary: Code and tests deliver every scenario and rule; changes only because contract install.RoleUpdate.written contradicts INS-005/S4.
    verdict: changes
    assumed:
      - new: Is the agent file of a replaced prompt listed as written when its text did not change?
        value: Yes, as INS-005/S4 states; the contract install.RoleUpdate.written wording is what is wrong
    duration_s: 894
  - at: 2026-10-29T21:13:22.031Z
    role: implementer
    result: blocked
    summary: Code and tests are right; only install.RoleUpdate.written wording contradicts INS-005/S4, needs a spec-writer fix
    verdict: null
    assumed: []
    duration_s: 41
  - at: 2026-10-29T21:13:22.452Z
    role: spec-writer
    result: reopened
    summary: reopened by PROP-012#Q1
    verdict: null
    assumed: []
  - at: 2026-10-29T21:16:21.338Z
    role: spec-writer
    result: done
    summary: install.RoleUpdate.written now lists the agent file of each replaced prompt, then other changed agent files
    verdict: null
    assumed: []
    duration_s: 178
  - at: 2026-10-29T21:29:04.992Z
    role: tester
    result: blocked
    summary: Tests need no change, but the code already passes them all, so the new-scenario-must-fail check cannot hold
    verdict: null
    assumed: []
    duration_s: 763
  - at: 2026-10-29T21:29:05.382Z
    role: implementer
    result: reopened
    summary: reopened by PROP-012#Q2
    verdict: null
    assumed: []
  - at: 2026-10-29T21:43:23.342Z
    role: implementer
    result: done
    summary: Code already matches the reworded install.RoleUpdate.written; no change needed; suite, lint and typecheck pass
    verdict: null
    assumed: []
    duration_s: 853
  - at: 2026-10-29T21:46:41.451Z
    role: reviewer
    result: done
    summary: Reworded install.RoleUpdate.written now matches INS-005/S4, the code and its test; all checklist items hold.
    verdict: approve
    assumed: []
    duration_s: 197
---
Review 2026-10-29. INS-005#Q2: its messages name the command skills it also compares and replaces, not only "role prompts". Bug found in drafting: with one changed file it prints "1 role prompt differ."; it should agree in number ("1 role prompt differs.").

Absorbed from PROP-013 (same role-compiling code). Review 2026-10-29, INS-006#Q1: when a role file is gone from spec/roles/, compile-roles removes its .claude/agents/<role>.md and says so.
