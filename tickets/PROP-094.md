---
id: PROP-094
type: proposal
title: Stage roles change files through edit tools, not the shell
status: done
stage: null
touches: [INS-015, INS-016, PIP-017]
violates: []
depends_on: []
changed: [INS-014/S4, INS-015, INS-016/R8, INS-016/R16, INS-016/R17, INS-016/R18, INS-016/S6, INS-016/S14, INS-016/S15, INS-016/S16, INV-013, INV-014, PIP-017/R14, PIP-017/S18]
questions:
  - id: Q1
    kind: blocker
    text: syncing ticket/PROP-094 with main conflicts in spec/modules/pipeline/features/PIP-017-task-for-a-delegated-stage.md; a person must merge
    default: null
    cites: []
    answer: "Merged main into ticket/PROP-094 (efa658c): PIP-017 keeps both PROP-094's S18/R14 and PROP-096's S19/S20/R15. main's PROP-092 now owns INV-013, so PROP-094's invariant must be renumbered to INV-014 by the spec-writer."
    raised_by: spec-review
history:
  - at: 2026-11-01T13:10:25.452Z
    role: spec-writer
    result: done
    summary: Ticket worktrees refuse Bash writes to tracked files (INS-016/R16-R18, INV-013); every role prompt says use edit tools
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-016/S6, INS-016/S16, PIP-017/S17, PIP-017/S18]
        reason: spec impact PROP-094 reports no must-change or re-verify units; base-branch Bash (S6) and older prompts (S17, S18) keep today's behaviour
      - item: C2
        outcome: scenarios
        ids: [INS-016/S14, INS-016/S16]
        reason: relative, absolute and subfolder cwd paths; worktree reached through a symlinked folder; Claude Code and Astro payloads; a pinned CLI older than the check stays silent until spec upgrade
      - item: C3
        outcome: na
        ids: []
        reason: each hook call is stateless and reads the worktree's Git index at call time; a refusal leaves no state to race (INV-013)
      - item: C4
        outcome: invariant
        ids: [INV-013]
        reason: the stage agent sets the command and cwd; a forged command is only allowed, never run; check-report and review decide what changed
      - item: C5
        outcome: scenarios
        ids: [INS-016/S15]
        reason: "the ticket asks for the opposite: a missed case beats refusing a build or test, so a missing command, an unresolvable target or a failed check is allowed, and S15 says so; base-branch commits still fail closed in the Git hooks (INS-016/R8)"
      - item: C6
        outcome: scenarios
        ids: [INS-016/S6, INS-016/S15, INS-016/S16, PIP-017/S18]
        reason: build, test and temp writes still run; base checkout and enforce.edits false unchanged; older role prompts unchanged
      - item: C8
        outcome: scenarios
        ids: [INS-016/S14, INS-016/S16]
        reason: "verified at code.claude.com/docs/en/hooks: a PreToolUse matcher can be Bash, tool_input.command holds the command, cwd follows Claude's cd, and plugin hooks fire for subagent tool calls; the Astro form mcp__astro__bash with astro_tool_input.command follows the existing Astro payload handling (INS-015/S20) and the mcp__astro__bash tool's command parameter"
    assumed:
      - new: Does a heredoc or redirect that creates a new, untracked file count as plainly writing?
        value: No; only paths in the worktree's Git index are refused, as the ticket says 'tracked file'
      - new: Which hook event carries the Bash check?
        value: The existing before-edit event, with Bash added to the plugin's PreToolUse matcher, so an older pinned CLI stays silent
      - new: How is a stage worktree recognised for a Bash payload?
        value: The payload cwd lies inside a worktree with a ticket/<ID> branch checked out
    duration_s: 337
  - at: 2026-11-01T15:08:37.560Z
    role: spec-writer
    result: reopened
    summary: reopened by PROP-094#Q1
    verdict: null
    assumed: []
  - at: 2026-11-01T15:12:26.788Z
    role: spec-writer
    result: done
    summary: Refuse Bash writes to files tracked in any ticket worktree, whatever the cwd (fits PIP-017/R2); invariant renumbered INV-014
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-016/S6, INS-016/S16, PIP-017/S17, PIP-017/S18, PIP-017/S19]
        reason: Base-branch Bash (S6, S16) and older prompts (S17, S18) behave as before. PIP-017/R2 and S19 start stage commands in the project root with absolute worktree paths, and R16 now judges a write by where its target resolves, not by the cwd. INV-013 is unchanged on this branch.
      - item: C2
        outcome: scenarios
        ids: [INS-016/S14, INS-016/S16]
        reason: Covers absolute targets from the project root, relative targets from a worktree or a folder inside one, a worktree reached through a symlinked folder, Claude Code and Astro payloads, and a pinned CLI older than the check, which stays silent until spec upgrade
      - item: C3
        outcome: na
        ids: []
        reason: Each hook call is stateless and reads the ticket worktrees' Git indexes at call time; a refusal leaves no state for a second call to race with
      - item: C4
        outcome: invariant
        ids: [INV-014]
        reason: The stage agent sets the command and the cwd. A forged or disguised command is only allowed, never run, and check-report and review decide what the stage changed
      - item: C5
        outcome: scenarios
        ids: [INS-016/S15]
        reason: The ticket asks the check to fail open, since a missed write beats refusing a build or test, so a missing command, an unresolvable target or a failed check is allowed, as S15 states. Base-branch commits still fail closed in the Git hooks (R8)
      - item: C6
        outcome: scenarios
        ids: [INS-016/S6, INS-016/S15, INS-016/S16, PIP-017/S18]
        reason: Build, test and temp writes still run. Relative writes to the base checkout, cwd outside any Git repository, enforce.edits false and older role prompts behave as before
      - item: C8
        outcome: scenarios
        ids: [INS-016/S14, INS-016/S16]
        reason: "Verified at code.claude.com/docs/en/hooks: a PreToolUse matcher can be Bash, tool_input.command holds the command, and plugin hooks fire for subagent tool calls. The check no longer depends on how cwd follows cd. The Astro form follows the existing Astro payload handling in INS-015/S20"
    assumed:
      - new: Does a heredoc or redirect that creates a new, untracked file count as plainly writing?
        value: No; only paths in a ticket worktree's Git index are refused, as the ticket says 'tracked file'
      - new: Which hook event carries the Bash check?
        value: The existing before-edit event, with Bash added to the plugin's PreToolUse matcher, so an older pinned CLI stays silent
      - new: Which ticket worktrees does the check consider?
        value: Every worktree with a ticket/<ID> branch checked out in the Git repository that holds the payload's cwd, whatever folder the cwd is (project root, worktree or a folder in one)
    duration_s: 227
  - at: 2026-11-01T15:13:58.714Z
    role: spec-review
    result: done
    summary: "Approved: conservative shell-write guard preserves pipeline commands and fits stages running without cd"
    verdict: approve
    assumed: []
    duration_s: 89
  - at: 2026-11-01T15:37:37.606Z
    role: tester
    result: done
    summary: Shell-write refusal (INS-016/S14-S16), Bash matcher and role-prompt sentence (PIP-017/S18) tested; new tests fail on assertions
    verdict: null
    mutations:
      - scenario: INS-014/S4
        wrong: the plugin hooks.json PreToolUse group for before-edit drops one of the edit tools when Bash is added
      - scenario: INS-016/S6
        wrong: before-edit also denies a Bash write to a base-checkout file when the payload cwd is the base checkout
      - scenario: INS-016/S14
        wrong: only handles > and >> redirections and skips tee, sed -i, perl -pi, heredocs, chained parts, Astro payloads, relative targets from a worktree cwd, or a worktree reached through a symlink
      - scenario: INS-016/S15
        wrong: denies any shell write that names a path inside a ticket worktree, including ignored, untracked, /dev/null, 2>&1, input redirections, quoted text, cd-relative or variable targets, nested shells, or denies when git fails
      - scenario: INS-016/S16
        wrong: checks relative targets from the project root against the base checkout, ignores enforce.edits false, or the plugin matcher still omits Bash
      - scenario: PIP-017/S18
        wrong: adds the sentence to only some role prompts, twice, or also to a project's older prompt that predates the rule
    assumed:
      - new: How does an Astro Bash payload look for before-edit?
        value: tool_name Bash with empty tool_input, astro_tool_name mcp__astro__bash and the command in astro_tool_input.command, mirroring the INS-015/S20 test
      - new: Is the order of tools in the plugin PreToolUse matcher fixed?
        value: No; tests compare the sorted tool set Bash, Edit, MultiEdit, NotebookEdit, Write
      - new: Is a pinned CLI that predates the check (INS-016/S16, R18) testable in-process?
        value: No test; it behaves as the old code, which emits nothing for Bash
    duration_s: 1416
  - at: 2026-11-01T15:54:03.910Z
    role: implementer
    result: done
    summary: Before-edit refuses Bash writes to files tracked in ticket worktrees; plugin matcher adds Bash; shared role prompt holds the S18 sentence
    verdict: null
    assumed: []
    duration_s: 983
  - at: 2026-11-01T16:00:12.165Z
    role: reviewer
    result: done
    summary: "Changes requested: workspace errors can block Bash; Git-failure coverage misses ls-files."
    verdict: changes
    findings:
      - cites: [INS-016/S15, INS-016/S16, INS-016/R17, INS-016/R18]
        text: src/adapters/claude-code/hooks.ts:47 catches only errors inside beforeShell, but src/cli/run.ts:229 loads the workspace first. Unreadable config/ticket files or a ticket-directory read failure escape to run.ts:182, returning exit 2 and blocking Bash, including harmless commands in the main session and commands with edit enforcement disabled. A read-only probe using --tickets pointing to package.json and a valid Bash payload for npm run build returned exit 2 with ENOTDIR. The new Bash matcher exposes this previously edit-only failure path to every Bash call. Make the shell-hook boundary fail open across workspace loading too, without weakening Edit/Write enforcement, and add an end-to-end regression test.
        tests: true
        class: C5
      - cites: [INS-016/S15, INS-016/R17]
        text: tests/cli/enforcement.test.ts:3598 replaces Git with a program that fails every subcommand. Consequently worktreeBranches returns no trees, so this test never reaches the ls-files failure branch at src/cli/enforcement.ts:536. Mutating that branch to deny instead of allowing would still pass the test. Add a case where worktree discovery succeeds and only ls-files fails, asserting that the command remains allowed.
        tests: true
        class: C7
    assumed: []
    duration_s: 359
  - at: 2026-11-01T16:13:36.119Z
    role: tester
    result: done
    summary: "Added S15 regression tests: Bash fails open when workspace loading fails; Bash allowed when only git ls-files fails"
    verdict: null
    mutations:
      - scenario: INS-016/S15
        wrong: the shell-hook boundary only guards beforeShell, so a workspace-loading error (unreadable tickets or config) still escapes as exit 2 and blocks harmless Bash commands
    assumed:
      - new: What does an Edit or Write do in a workspace that cannot load?
        value: "Keeps today's behaviour: exit 2, empty stdout, stderr containing 'internal error'"
      - new: Which workspace failure does the end-to-end test use?
        value: --tickets pointing at a file (package.json), the reviewer's probe, giving ENOTDIR on the ticket directory read
    duration_s: 802
  - at: 2026-11-01T16:28:58.254Z
    role: implementer
    result: done
    summary: Before-edit now fails open for Bash and Astro bash payloads when the workspace cannot be loaded; Edit and Write still stop with exit 2
    verdict: null
    assumed: []
    duration_s: 920
  - at: 2026-11-01T16:30:52.227Z
    role: reviewer
    result: done
    summary: "Changes requested: config reads still block Bash; conflicting edit payloads enter the shell fail-open path."
    verdict: changes
    findings:
      - cites: [INS-016/S15, INS-016/R17, INS-016/R18]
        text: src/cli/run.ts:222 calls projectRootForSpec before the new loadWorkspace catch. That helper reads config.json at run.ts:72, so an unreadable config still escapes to the outer internal-error handler and blocks harmless Bash commands with exit 2. An in-memory EACCES injection on that read reproduced exit 2 for npm run build without changing files. The ticket-directory regression passes, but the original finding's config-read case remains unresolved. Extend the shell-only fail-open boundary to cover this earlier read and add its regression test, retaining Edit/Write failure behavior.
        tests: true
        class: C5
      - cites: [INS-015/S20, INS-015/S23, INS-015/R15, INS-015/R18]
        text: src/adapters/claude-code/hooks.ts:43 classifies a payload as shell when either tool name claims Bash, without excluding an edit identified by the other name or edit-shaped input. The new run.ts:235 catch therefore silently allows conflicting edits in a broken workspace. With --tickets pointing to package.json, both tool_name Edit plus astro_tool_name mcp__astro__bash and tool_name Bash plus astro_tool_name mcp__astro__edit carrying astro_tool_input.file_path returned exit 0 with empty output; an ordinary Edit returned exit 2. Previously workspace loading stopped these conflicting edits too. Exclude edit-bearing/conflicting payloads from the shell-only fallback and add regression cases alongside the ordinary Edit/Write controls.
        tests: true
        class: C4
    assumed: []
    duration_s: 111
  - at: 2026-11-01T16:45:37.724Z
    role: tester
    result: done
    summary: "S15 regressions: Bash runs when config.json is unreadable; conflicting edit/shell payloads stay stopped"
    verdict: null
    mutations:
      - scenario: INS-016/S15
        wrong: the shell-only fail-open covers loadWorkspace but not the earlier config.json read in projectRootForSpec, or treats a payload as shell when either tool name claims Bash so a conflicting edit payload is silently allowed in a broken workspace
    assumed:
      - new: How is an unreadable spec/config.json simulated?
        value: A directory in place of the file, so the read fails with EISDIR whatever user runs the tests
      - new: What do conflicting edit and shell payloads do in a broken workspace?
        value: "Behave like an ordinary Edit: exit 2, empty stdout, stderr containing 'internal error'"
    duration_s: 883
  - at: 2026-11-01T17:08:11.044Z
    role: implementer
    result: done
    summary: Bash fails open on any spec failure before-edit; shell-ness is decided once, strictly, so conflicting payloads stay edits
    verdict: null
    assumed: []
    duration_s: 1350
  - at: 2026-11-01T17:10:37.923Z
    role: reviewer
    result: done
    summary: "Approved: both round-2 findings resolved; 12 targeted tests passed; conflicting edits remain blocked."
    verdict: approve
    findings:
      - cites: [INS-016/S16, INS-016/R18]
        text: "Follow-up: src/cli/run.ts:136-139 preserves a delegated pinned CLI's nonzero exit for shell before-edit payloads. Acceptable for this delivery: the current pinned CLI has the outer fail-open boundary, and healthy older pins ignore Bash. Compatibility hardening could also suppress failures from an older pin that errors during workspace loading before reaching its Bash no-op. Keep this limited to strictly classified shell payloads; Edit/Write must retain their failures."
        class: C5
    assumed: []
    duration_s: 144
---
Self-hosting finding P58 (docs/SELF-HOSTING.md). Stage subagents still sometimes write files through the shell (heredocs, sed -i, redirects). Those writes skip the after-edit lint hook and the per-role path checks that run on Edit and Write, and leave no diff in the session. Today only this repo's .local.md prompt additions say not to. Make it part of the shipped behaviour: the shipped role prompts say it, and the enforcement hooks refuse, in a stage worktree, a Bash command that plainly writes a tracked file (output redirection, tee, sed -i, perl -pi, a heredoc into a file), with a message naming the edit tools. Commands that write only ignored or temporary paths (build output, test runs) still run. Decide in the spec what counts as plainly writing and keep the check conservative: a missed case is better than refusing a build or test command.
