---
id: PROP-067
type: proposal
title: Setup keeps the worktrees folder out of the committed Claude settings
status: done
stage: null
touches: [INS-003]
violates: []
depends_on: []
changed: [INS-003, INS-003/R3, INS-003/R5, INS-003/S15, INS-003/S16, INS-003/S17, INS-003/S18, INS-003/S20, INS-003/S21, INS-003/S22, INS-003/S23, INS-003/S24, INS-014/R11, INS-014/R12, INS-014/S28, INS-014/S29, install.LocalClaudeSettings, install.LocalClaudeSettings.permissions, install.Permissions, install.Permissions.additionalDirectories]
questions:
  - id: Q1
    kind: external
    text: "C8 not verified live: whether Claude Code 2.1.31x merges permissions.additionalDirectories from .claude/settings.local.json for background subagents writing in a sibling worktree. The local claude run failed on a subscription billing error and no API key is available. Needs a rerun in a trusted project with settings.local.json additionalDirectories ['../<repo>.worktrees'] and no entry in settings.json: a subagent Write inside the worktrees folder should succeed, and one outside it should be denied. Its changes are kept in git stash \"PROP-067 spec-writer: blocked\"; the next spec-writer stage gets them back."
    default: null
    cites: [INS-003/R5, INS-003/S15, INS-014/S28, INS-014/R11, install.LocalClaudeSettings]
    answer: "Verified live 2026-11-01 on Claude Code 2.1.312 (headless, acceptEdits, account 1). settings.local.json permissions.additionalDirectories ['../repo.worktrees'] with no entry in settings.json: a background Task subagent's Write inside repo.worktrees succeeded; a Write outside it was refused. Control without settings.local.json: the same background Write was denied. So settings.local.json alone grants it; proceed with the settings.local.json design."
    raised_by: spec-writer
history:
  - at: 2026-10-31T14:04:45.538Z
    role: spec-writer
    result: blocked
    summary: Worktree parent now goes only to personal settings.local.json; C8 live check blocked (Claude Code billing lapsed)
    verdict: null
    assumed:
      - new: Does upgrade remove an existing worktree entry from the committed settings.json?
        value: no; it is kept as it was (R1), so the committed file is never modified
      - new: What does init do without --accept-edits when settings.local.json is not a JSON object?
        value: it leaves the file unchanged, adds a note naming the entry to add by hand, and exits 0, like INS-003/S13. --accept-edits keeps today's refusal
      - new: Is .claude/settings.local.json gitignored when --accept-edits is not used?
        value: yes; init and upgrade always add it to the root .gitignore, since they always write the file
    duration_s: 349
  - at: 2026-11-01T12:10:14.896Z
    role: spec-writer
    result: done
    summary: Worktree parent goes only to personal .claude/settings.local.json; committed settings.json untouched (C8 verified)
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-003/S9, INS-003/S10, INS-003/S15, INS-010/S10]
        reason: impact reaches install.ClaudeSettings (S9, S10 unchanged), install.LocalClaudeSettings (S15) and re-verify INS-010/S10, which reads hooks and is untouched by this change
      - item: C2
        outcome: scenarios
        ids: [INS-003/S22, INS-003/S16, INS-003/S23, INS-014/S29]
        reason: checkout folder name differing from project name (S22); upgrade from an older install that has the entry in settings.json keeps it (S22, R5) and adds the local entry (S16); existing personal file (S23); setup repair checks both files (S29)
      - item: C3
        outcome: na
        ids: []
        reason: init/upgrade are single synchronous CLI runs writing local files; no shared state across an await or process boundary is introduced
      - item: C4
        outcome: na
        ids: []
        reason: settings.local.json is the user's own file on their machine; no new trust boundary. Claude Code decides the permission scope (INS-014/R11)
      - item: C5
        outcome: scenarios
        ids: [INS-003/S24, INS-003/S13]
        reason: a settings.local.json that is not a JSON object is left unchanged with a note; exit 0 like S13
      - item: C6
        outcome: scenarios
        ids: [INS-003/S9, INS-003/S10, INS-003/S11, INS-003/S12, INS-003/S13, INS-003/S14, INS-003/S17, INS-003/S18, INS-003/S19, INS-003/S20, INS-003/S21]
        reason: permission rules, plugin enablement, hooks and --accept-edits paths unchanged
      - item: C8
        outcome: scenarios
        ids: [INS-014/S28]
        reason: "Q1 answer: verified live 2026-11-01 on Claude Code 2.1.312 that settings.local.json additionalDirectories alone grants background subagent writes in the sibling worktrees folder; writes outside are refused; without the file they are denied"
    assumed:
      - new: Does upgrade remove an existing worktree entry from the committed settings.json?
        value: no; it is kept as it was (R1, R5), so the committed file is never modified
      - new: What does init do without --accept-edits when settings.local.json is not a JSON object?
        value: leaves it unchanged, adds a note naming the entry to add by hand, exits 0 (S24, like S13); --accept-edits keeps today's refusal
      - new: Is .claude/settings.local.json gitignored when --accept-edits is not used?
        value: yes; init and upgrade always add it to the root .gitignore, since they always write the file
    duration_s: 75
    refusals: 1
  - at: 2026-11-01T12:12:24.027Z
    role: spec-review
    result: done
    summary: "Approved: personal worktree permissions preserve committed settings and existing setup behaviour"
    verdict: approve
    assumed: []
    duration_s: 126
  - at: 2026-11-01T12:35:11.055Z
    role: tester
    result: done
    summary: Personal-settings worktree tests for INS-003 S15-S24 and INS-014 S28/S29; new ones fail on assertions, lint and typecheck pass
    verdict: null
    mutations:
      - scenario: INS-003/S15
        wrong: still writes the worktree parent into the committed .claude/settings.json and not into settings.local.json
      - scenario: INS-003/S16
        wrong: upgrade adds the worktree parent only to .claude/settings.json
      - scenario: INS-003/S17
        wrong: --accept-edits also writes defaultMode acceptEdits into the committed .claude/settings.json
      - scenario: INS-003/S18
        wrong: init without --accept-edits writes defaultMode acceptEdits into the local settings
      - scenario: INS-003/S20
        wrong: opt-in overwrites a conflicting shared defaultMode plan in .claude/settings.json
      - scenario: INS-003/S21
        wrong: opt-in overwrites or drops a conflicting personal defaultMode plan
      - scenario: INS-003/S22
        wrong: adds the shop-2 worktree parent to the committed settings.json on upgrade or init, leaving it modified
      - scenario: INS-003/S23
        wrong: replaces the personal permissions or appends the worktree entry on every init so it appears twice
      - scenario: INS-003/S24
        wrong: overwrites a non-object settings.local.json, or leaves it alone without the note
      - scenario: INS-014/S28
        wrong: setup skill still says the worktree parent goes in the committed settings.json, not the personal file
      - scenario: INS-014/S29
        wrong: setup skill checks only .claude/settings.json for the worktree parent before suggesting upgrade
    assumed:
      - new: Does S24's doubled apostrophe in the note mean one escaped apostrophe?
        value: yes, as in the lint specs; the note reads add '../shop.worktrees' to permissions.additionalDirectories by hand
      - new: Is INS-003/S20's old check that settings.local.json stays absent after a refused opt-in still required?
        value: no, removed; the scenario only requires settings.json to keep defaultMode plan and the conflict to be reported
      - new: How are INS-014/S28 and S29 checked, given they describe the setup skill text?
        value: by matching phrases in the built plugin/skills/spec/SKILL.md in tests/dist.test.ts
    duration_s: 1364
    refusals: 1
  - at: 2026-11-01T12:57:21.147Z
    role: implementer
    result: done
    summary: init/upgrade write the worktree parent only to settings.local.json; setup skill updated; build, lint, typecheck, tests pass
    verdict: null
    assumed:
      - new: Does the root .gitignore get settings.local.json when the file is not a JSON object?
        value: yes, whenever the personal file would be written (git repo, or --accept-edits); outside git without --accept-edits nothing is written or ignored
      - new: What label does init give the personal settings entry in written/updated lists?
        value: .claude/settings.local.json (personal permissions merged)
    duration_s: 1324
  - at: 2026-11-01T13:06:04.612Z
    role: reviewer
    result: done
    summary: Approved; personal settings contract holds. Pre-existing INS-010/S10 hook expectation is a candidate bug.
    verdict: approve
    assumed: []
    duration_s: 514
---
Found while merging S3 into the plugin integration (C2, environment axes). `spec init` and `spec upgrade` write `permissions.additionalDirectories: ["../<checkout folder>.worktrees"]` into the committed `.claude/settings.json`. The path depends on each person's checkout folder name, so in any clone whose folder name differs, every init or upgrade leaves `.claude/settings.json` modified on the base branch, and `spec merge` then refuses: "main has uncommitted changes: .claude/settings.json" (reproduced by the INS-016/S2 pull tests; tests/cli/enforcement.test.ts installFixtureHooks undoes the rewrite until this lands). Write the worktrees folder to the personal `.claude/settings.local.json` instead (as `--accept-edits` already does for defaultMode), or a path that does not depend on the checkout name, and leave the committed settings unchanged when only that entry would differ. Verify live that Claude Code merges `additionalDirectories` from settings.local.json for subagents in sibling worktrees (C8).
