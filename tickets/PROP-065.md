---
id: PROP-065
type: proposal
title: detect reports the local edit mode, and /spec:run warns before backgrounding subagents that cannot edit
status: done
stage: null
touches: [CLI-007]
violates: []
depends_on: []
changed: [CLI-008, CLI-008/R11, CLI-008/S1, CLI-008/S12, CLI-008/S33, CLI-008/S34, CLI-008/S35, INS-014, INS-014/S26, INS-017, INS-017/R1, INS-017/R2, INS-017/R3, INS-017/S1, INS-017/S2, INS-017/S3, INV-008, cli.Detection, cli.Detection.editMode]
questions:
  - id: Q1
    kind: blocker
    text: 'tests/cli/detect-config.test.ts:25 (CLI-008/S1) uses toEqual on the whole detect JSON without editMode, and :148 (CLI-008/S12) expects exactly 8 text lines. R11 and cli.Detection.editMode require editMode in every detect output (JSON key plus an `edit mode:` text line), so both fail. The tester must update them; I may not edit tests. Its changes are kept in git stash "PROP-065 implementer: blocked"; the next implementer stage gets them back.'
    default: null
    cites: [CLI-008/R11, CLI-008/S1, CLI-008/S12, cli.Detection.editMode]
    answer: "Yes: the tester updates CLI-008/S1 and S12's tests for editMode."
    raised_by: implementer
  - id: Q2
    kind: blocker
    text: 'git stash "PROP-065 implementer: blocked" does not apply to ticket/PROP-065: it conflicts in .spec/bin/spec.cjs, plugin/scripts/spec.cjs. A person must apply it by hand (git stash list names it), then answer to resume.'
    default: null
    cites: []
    answer: Re-stashed without the two generated bundles (.spec/bin/spec.cjs, plugin/scripts/spec.cjs); the implementer rebuilds them.
    raised_by: implementer
history:
  - at: 2026-10-31T14:11:49.443Z
    role: spec-writer
    result: done
    summary: detect reports editMode; setup skips the accept-edits ask when set; driving warns and runs foreground otherwise
    verdict: null
    assumed:
      - new: spec init . --accept-edits without --name exits 2 with usage today (checked on a scratch install); which command do the skills offer?
        value: skills offer spec init . --name <config name> --accept-edits, which works on an existing install and writes settings.local.json
      - new: Does a malformed settings.local.json mask the shared mode?
        value: "no: it sets no mode and the shared file is used, matching Claude Code skipping a broken file"
      - new: Should bypassPermissions or auto count as able to edit?
        value: "no: only exactly acceptEdits; Claude Code ignores those two from project or local files anyway"
      - new: Does a mode accepted during a run take effect for that run?
        value: "no: the rest of that run stays in the foreground; it applies from the next run"
      - new: Where do the setup and driving rules live given INS-014's line budget?
        value: new feature INS-017 holds the skip and foreground rules; INS-014/R14 is unchanged and INS-014/S26 cites INS-017/S2
    duration_s: 416
  - at: 2026-10-31T14:35:36.494Z
    role: tester
    result: done
    summary: Tests for CLI-008/S33-S35, INS-017/S1-S3, INV-008 and INS-014/S26 added; all fail now as expected; lint, typecheck clean
    verdict: null
    assumed:
      - new: skill text wording the tests require (exact phrases, e.g. "background subagents cannot edit ticket worktrees", "in the foreground, one at a time, without `run_in_background`", "without `next <ID>` and without `--restart`")
        value: phrases taken from the INS-017 spec text; the implementer must write the shipped skills with these strings
    duration_s: 1423
  - at: 2026-10-31T14:46:22.302Z
    role: implementer
    result: blocked
    summary: Code and skills done; two older detect tests contradict CLI-008/R11 (editMode field, extra text line) and fail
    verdict: null
    assumed: []
    duration_s: 644
  - at: 2026-10-31T14:46:23.920Z
    role: tester
    result: reopened
    summary: reopened by PROP-065#Q1
    verdict: null
    assumed: []
  - at: 2026-10-31T14:55:40.507Z
    role: tester
    result: done
    summary: CLI-008/S1 and S12 updated for editMode; no other test pins full detect output; code absent from worktree (stashed), so 10 fail
    verdict: null
    assumed:
      - new: the worktree has no editMode code or skill changes (stash@{0} PROP-065 implementer blocked holds them); is that expected?
        value: left the stash untouched; tests follow the spec, and the 10 failures (CLI-008/S33-S35, S1, S12, INS-017/S1-S3, INV-008, INS-014/S26) should pass once the implementer's work is restored
    duration_s: 554
  - at: 2026-10-31T15:18:07.284Z
    role: implementer
    result: done
    summary: detect reports editMode; driving and setup skills follow INS-017; bundles rebuilt after the stash restore; npm run check passes
    verdict: null
    assumed: []
    duration_s: 936
  - at: 2026-10-31T15:25:46.528Z
    role: reviewer
    result: done
    summary: "Approve: read-only editMode and explicit foreground fallback preserve Claude Code authority; 150 tests pass"
    verdict: approve
    assumed: []
    duration_s: 457
---
From the S4 final review (H1): background ticket subagents in Claude Code cannot prompt; in permission mode `default` they are denied Edit/Write in the ticket worktree (verified live 2026-10-31, X141), so a wave started by /spec:run in that mode ends in blocked reports. `spec detect --format json` gains `editMode` (the effective `permissions.defaultMode` from .claude/settings.local.json then .claude/settings.json, or `default`), and the /spec:run and driving instructions say: when the harness is claude-code and editMode is not acceptEdits, warn the person and run subagents in the foreground (or offer `init . --accept-edits`). Setup's Phase 0 skips the accept-edits question when editMode is already acceptEdits.
