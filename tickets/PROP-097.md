---
id: PROP-097
type: proposal
title: INS-010/S10 says init registers the after-edit hook in settings; the plugin's hooks.json does
status: done
stage: null
touches: [INS-010]
violates: []
depends_on: []
changed: [INS-010, INS-010/S1, INS-010/S2, INS-010/S3, INS-010/S4, INS-010/S5, INS-010/S6, INS-010/S7, INS-010/S8, INS-010/S9, INS-010/S11]
questions: []
history:
  - at: 2026-11-01T13:16:08.919Z
    role: spec-writer
    result: done
    summary: INS-010/S10 retired; S11 states after-edit registration against install.PluginPackage.hooks, matching INS-003/S10
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-010/S11, INS-003/S10, INS-014/S4]
        reason: spec impact PROP-097 reaches only INS-010 (no re-verify, no gaps); S11 now agrees with INS-003/S10 (init copies no hooks into settings) and INS-014/S4 (plugin hooks.json registers PostToolUse)
      - item: C2
        outcome: na
        ids: []
        reason: no path, layout, platform or upgrade axis changes; S11 only restates where an existing registration lives
      - item: C3
        outcome: na
        ids: []
        reason: no shared state across an await or process boundary is touched
      - item: C4
        outcome: na
        ids: []
        reason: no new input crosses a trust boundary; the hook payload handling in INS-010/S1-S9 is unchanged
      - item: C5
        outcome: scenarios
        ids: [INS-010/S7, INS-010/S9]
        reason: unchanged fail-closed paths for files outside the spec and for payloads without a path
      - item: C6
        outcome: scenarios
        ids: [INS-010/S1, INS-010/S2, INS-010/S3, INS-010/S4, INS-010/S5, INS-010/S6, INS-010/S7, INS-010/S8, INS-010/S9]
        reason: S1-S9 and R1-R2 are untouched; only the registration scenario changed
      - item: C8
        outcome: scenarios
        ids: [INS-010/S11]
        reason: "Claude Code plugin hooks.json shape verified by reading plugin/hooks/hooks.json in the worktree: PostToolUse matcher Edit|Write|MultiEdit, command ends hook claude-code after-edit"
    documents: [INS-010/S11]
    assumed:
      - new: Keep the S10 id with a restated body, or retire it and add S11?
        value: retired S10 and added S11, so the scenario documents existing behaviour and is exempt from test first
    duration_s: 86
  - at: 2026-11-01T13:16:57.701Z
    role: spec-review
    result: done
    summary: "Approved: S11 correctly locates after-edit registration in the plugin manifest and preserves existing behaviour"
    verdict: approve
    assumed: []
    duration_s: 46
  - at: 2026-11-01T13:39:31.381Z
    role: tester
    result: done
    summary: Added in-process tests for INS-010/S1-S9 in tests/cli/after-edit.test.ts; S11 test kept; all pass, lint and typecheck clean
    verdict: null
    mutations:
      - scenario: INS-010/S1
        wrong: after-edit exits 0 or prints the findings on stdout instead of exiting 2 with 'spec lint found problems after this edit:' on stderr
      - scenario: INS-010/S2
        wrong: reports only the first error, drops warnings from the edited file, or omits the '  fix:' line under a finding
      - scenario: INS-010/S3
        wrong: blocks (exit 2) or prints to stdout for a clean spec file such as spec/core/glossary.md
      - scenario: INS-010/S4
        wrong: exits 2 or prints stderr when the edited file has only warnings
      - scenario: INS-010/S5
        wrong: lints the whole spec and exits 2 for an error in a file that was not edited
      - scenario: INS-010/S6
        wrong: only lints files under the spec root and ignores ticket files under the tickets folder
      - scenario: INS-010/S7
        wrong: lints or blocks on files outside the spec root and ticket store, such as src/app.ts
      - scenario: INS-010/S8
        wrong: treats a payload with agent_id/agent_type as a different event, or lints the whole spec for a subagent's edit of src/conversation/chat.ts
      - scenario: INS-010/S9
        wrong: lints on tool_name Read, or throws or exits non-zero when Edit has no file_path
      - scenario: INS-010/S11
        wrong: plugin hooks.json registers after-edit on a matcher other than Edit|Write|MultiEdit, or with a command that does not end 'hook claude-code after-edit'
    assumed:
      - new: How to build a warning-only spec file and an erroring ticket for S4 and S6
        value: "L026 prose mention of a missing ID in PRV-003 for the warning; status: bogus in tickets/TASK-101.md for the ticket error (L020)"
    duration_s: 1351
    refusals: 1
  - at: 2026-11-01T13:54:27.518Z
    role: implementer
    result: done
    summary: "Verified PROP-097: after-edit (9) and dist (44) tests pass; lint and typecheck clean; no code change needed"
    verdict: null
    assumed: []
    duration_s: 894
  - at: 2026-11-01T13:55:46.653Z
    role: reviewer
    result: done
    summary: "Approved: plugin registration spec and INS-010 tests agree; 53 targeted tests, lint and typecheck pass"
    verdict: approve
    assumed: []
    duration_s: 64
---
Found by PROP-067's reviewer. INS-010/S10 expects `spec init` to put a PostToolUse group with matcher "Edit|Write|MultiEdit" into install.ClaudeSettings.hooks. That contradicts INS-003/S10 (tested, passing): init copies no plugin hooks into settings; the plugin's hooks.json (install.PluginPackage.hooks) registers after-edit on PostToolUse. INS-010/S10 has no test. Restate S10 against the plugin package's hooks (where the registration really lives) so it agrees with INS-003/S10, and give it a test.
