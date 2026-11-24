---
id: PROP-105
type: proposal
title: "Batch 6 review follow-ups: rule-named tests, and older pinned CLIs failing a shell hook"
status: done
stage: null
touches: [PIP-011, INS-016]
violates: []
depends_on: []
changed: [INS-016/R19, INS-016/S17, PIP-011/R5, PIP-011/S8, PIP-022/S2]
questions: []
history:
  - at: 2026-11-01T18:29:34.652Z
    role: spec-writer
    result: done
    summary: PIP-011 pins that a rule-named test claims nothing and is not flagged; INS-016 fails open on a pinned-CLI exit for shell payloads
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-011/S6, PIP-011/S8, INS-016/S14, INS-016/S16, INS-016/S17, INS-015/S22]
        reason: spec impact PROP-105 reaches no other feature; S6 still names a scenario ID with no problem for a rule ID, S14 and S16 keep refusing and allowing as before, S17 shows the refusal reaching the caller unchanged, and INS-015/S22 (unknown hook event) is unchanged
      - item: C2
        outcome: scenarios
        ids: [INS-016/S17]
        reason: "older pinned CLIs are the axis: one that exits non-zero while loading its workspace; Claude Code and Astro payloads both covered. Path, symlink and platform axes do not apply to this change"
      - item: C3
        outcome: na
        ids: []
        reason: neither change holds state across an await or a process boundary; each hook call and each report check stands alone
      - item: C4
        outcome: invariant
        ids: [INV-014]
        reason: the payload's tool name is set by the stage agent (INV-014); a forged shell tool name only makes the pinned CLI's failure ignored, which allows a command the check would otherwise have run on, and the Git hooks, check-report and review remain the guard (INS-016/R8). No new invariant needed
      - item: C5
        outcome: scenarios
        ids: [INS-016/S17]
        reason: the fail-open is limited to payloads plainly of the shell tool; an unreadable payload, a missing or conflicting tool name, an edit tool and any other hook event keep the failure
      - item: C6
        outcome: scenarios
        ids: [INS-016/S17, PIP-011/S1, PIP-011/S6]
        reason: Edit/Write failures pass through as before, a pinned CLI's exit-0 refusal of a shell command is unchanged, and scenario and removed-scenario matching is unchanged
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool or service; Claude Code and Astro payload field names already stand in INS-016/R16
    documents: [PIP-011/S8]
    assumed:
      - new: Should the launcher also drop the pinned CLI's stderr when it fails open on a shell payload?
        value: "Yes: it emits nothing on stdout and stderr and exits 0, as INS-015/R17 does for an unknown hook event"
      - new: Should a rule-named test be flagged by the tester check?
        value: "No: it claims nothing and is left alone; the two PIP-022 tests are renamed to PIP-022/S2 by the tester"
    duration_s: 181
  - at: 2026-11-01T18:30:22.897Z
    role: spec-review
    result: done
    summary: "Approved: rule-named tests claim nothing; launcher fail-open is limited to shell before-edit payloads."
    verdict: approve
    assumed: []
    duration_s: 46
  - at: 2026-11-01T18:43:15.706Z
    role: tester
    result: done
    summary: Tests for INS-016/S17 (fails now), PIP-011/S8 (passes), and PIP-022/R1 tests renamed to PIP-022/S2
    verdict: null
    mutations:
      - scenario: INS-016/S17
        wrong: launcher drops a non-zero pinned-CLI exit for every before-edit payload, so Edit/Write/MultiEdit/NotebookEdit failures vanish
      - scenario: PIP-011/S8
        wrong: a rule-named test such as 'PRV-002/R1 ...' is read as naming PRV-002/S1 or reported as a test naming a scenario not in the spec
      - scenario: PIP-022/S2
        wrong: a no-results advance puts back its earlier copy of the stored report, so a report another advance consumed meanwhile comes back
    assumed: []
    duration_s: 770
  - at: 2026-11-01T19:15:50.365Z
    role: implementer
    result: done
    summary: Launcher exits 0 with no output when a delegated before-edit hook fails and the payload names only a shell tool (INS-016/S17)
    verdict: null
    assumed:
      - new: Why not reuse isShellPayload for the launcher check?
        value: It rejects both S17 payloads (the Astro payload has no tool_name; the Bash payload has file_path), so a new namesShellTool requires tool_name exactly Bash or astro_tool_name exactly mcp__astro__bash and no edit tool name
    duration_s: 1952
  - at: 2026-11-01T19:18:19.555Z
    role: reviewer
    result: done
    summary: "Changes requested: delegated fail-open accepts conflicting tool names; 32 targeted tests pass."
    verdict: changes
    findings:
      - cites: [INS-016/R19, INS-016/S17]
        text: src/adapters/claude-code/hooks.ts:75-77 rejects only known edit names, rather than every conflicting tool name as R19 requires. For example, tool_name "Read" with astro_tool_name "mcp__astro__bash" passes namesShellTool, so src/cli/run.ts:140 drops the pinned CLI failure even though another tool name is given. Edit-shaped input also does not disqualify this ambiguous payload. Restrict accepted name combinations to unambiguous shell identities and add delegated-failure regressions for conflicting names in both directions; tests/cli/plugin-cli.test.ts:176 currently checks only the Edit conflict.
        tests: true
        class: C5
    assumed: []
    duration_s: 144
  - at: 2026-11-01T19:32:38.656Z
    role: tester
    result: done
    summary: INS-016/S17 now also keeps the pinned CLI failure for conflicting tool names; fails on current code
    verdict: null
    mutations:
      - scenario: INS-016/S17
        wrong: fail-open accepts any payload where astro_tool_name is mcp__astro__bash, even with a conflicting tool_name such as Read
    assumed:
      - new: Does a payload giving both tool_name Bash and astro_tool_name mcp__astro__bash fail open?
        value: "Yes: the names agree, so it is an unambiguous shell identity (the test asserts it fails open)"
    duration_s: 854
    refusals: 1
  - at: 2026-11-01T19:43:22.267Z
    role: implementer
    result: done
    summary: namesShellTool accepts only an unambiguous shell identity; conflicting tool names keep the pinned CLI failure
    verdict: null
    assumed: []
    duration_s: 641
  - at: 2026-11-01T19:50:16.619Z
    role: reviewer
    result: done
    summary: "Approved: conflicting tool names retain pinned-CLI failures; all 10 plugin-cli tests pass."
    verdict: approve
    assumed: []
    duration_s: 412
---
Two follow-up findings from batch 6 reviews. (1) PROP-101's reviewer: two overlap regressions in tests/cli/advance-check-could-not-run.test.ts are named 'PIP-022/R1 …'; a test covers a scenario only when its name starts with a scenario ID, and `spec test` rejects rule IDs, so they cannot be run by ID. Rename them to PIP-022/S2, and decide whether the tester check should flag a test named for a rule (it claims nothing). (2) PROP-094's reviewer (C5): when the plugin launcher delegates a before-edit hook to the project's pinned CLI and that child exits non-zero for a strictly-classified shell payload, the failure passes through; an older pinned CLI that errors while loading its workspace could block every Bash call. Fail open on a non-zero child exit for shell payloads only; Edit/Write keep their failures.
