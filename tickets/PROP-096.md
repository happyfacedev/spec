---
id: PROP-096
type: proposal
title: A Claude Code stage loop in accept-edits mode needs no approval for the worktree CLI or the report file
status: done
stage: null
touches: [PIP-017, INS-003, INS-014]
violates: []
depends_on: [PROP-067]
changed: [CLI-007/R14, CLI-007/S1, CLI-007/S14, INS-014/R9, INS-014/R11, INS-014/S16, INS-014/S26, INS-014/S28, PIP-017/R2, PIP-017/R4, PIP-017/R15, PIP-017/S2, PIP-017/S4, PIP-017/S6, PIP-017/S19, PIP-017/S20, cli.Next, cli.Next.advance]
questions: []
history:
  - at: 2026-11-01T13:22:44.301Z
    role: spec-writer
    result: done
    summary: Stages run the root-relative CLI with --root (no cd); advance names a report file in the worktrees folder
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-017/S19, INS-003/S15, INS-014/S26, INS-014/S28]
        reason: The report folder is the worktree parent INS-003/S15 already writes to personal settings; no settings or hooks change, so INS-003 stays true; CLI-007/S1 and S14 changed with it
      - item: C2
        outcome: scenarios
        ids: [PIP-017/S19, PIP-017/S2, INS-014/S28, INS-014/S16]
        reason: A project path with a space is quoted; --root points at the spec root inside the worktree, so a project in a subfolder works; the absolute worktree CLI path is never used; older installs need no new settings; pointer-layout launcher unchanged
      - item: C3
        outcome: scenarios
        ids: [PIP-017/S6]
        reason: The report file is named for the ticket and the role, so parallel tickets and stages never share a file
      - item: C4
        outcome: na
        ids: []
        reason: "No new input crosses a trust boundary: the CLI builds the --root and report paths from its own worktree state, and no new or wider allow rule is added"
      - item: C5
        outcome: scenarios
        ids: [PIP-017/S19]
        reason: Only quoted paths inside the listed folder are given; anything else still meets Claude Code's normal prompt
      - item: C6
        outcome: scenarios
        ids: [INS-014/S26, INS-014/S28, PIP-017/S6]
        reason: Default edit mode still runs stages in the foreground and still asks before writes; advance stays a root-relative command outside the task
      - item: C8
        outcome: scenarios
        ids: [INS-014/S28]
        reason: Verified at code.claude.com/docs/en/tools-reference ('Subagent sessions never carry over working directory changes') and /docs/en/permissions (acceptEdits approves writes in additionalDirectories; Bash rules match the whole command text). A headless live probe could not run (403 billing), so the docs and the operator's 2026-11-01 live check are the evidence
    assumed:
      - new: Which CLI runs a delegated stage's commands?
        value: The project root's pinned .spec/bin/spec with --root set to the worktree's spec root; a ticket that changes the pinned CLI still has its stages run by the base checkout's copy
      - new: Is the report file removed after ticket advance reads it?
        value: No; the main session overwrites it for each stage of that ticket and role
      - new: May the spec-writer change CLI-007, which is outside touches?
        value: Yes; CLI-007/S1, S14 and R14 said to cd into the worktree and would contradict PIP-017/R2. The gate still reports ready
      - new: Does INS-003 need a new allow rule?
        value: No; the relative rule Bash(.spec/bin/spec *) already matches the --root form, so INS-003 is unchanged
    duration_s: 485
  - at: 2026-11-01T13:31:02.529Z
    role: spec-review
    result: done
    summary: No-cd guidance omits non-CLI commands and contradicts preserved pointer-layout support
    verdict: changes
    findings:
      - cites: [PIP-017/S2, PIP-017/R2, PIP-017/R15, INS-014/S30]
        text: The new prohibition on cd supplies a worktree selector only for spec commands. No scenario or task instruction explains how root-starting shells run git status/diff/commit or project commands such as npm test and npm run lint against the worktree. Plain commands now inspect, test or modify the base checkout; directory-selection forms may also miss existing scoped Bash permissions. Specify worktree targeting and its permission interaction for these ordinary stage commands.
        class: C1
      - cites: [PIP-017/S2, PIP-017/S19, PIP-017/R2, INS-014/S16]
        text: The delta unconditionally requires .spec/bin/spec, including every task CLI command, but unchanged INS-014/S16 requires the skill-local launcher before a pointer-layout project upgrades, when .spec/bin/spec.cjs is absent. The checklist cites S16 as preserved without reconciling this contradiction. Define the legacy-layout exception or migration behavior so these projects receive a usable launcher and consistent permission guidance.
        class: C2
    assumed: []
    duration_s: 496
  - at: 2026-11-01T13:33:28.678Z
    role: spec-writer
    result: done
    summary: Name which stage commands target the worktree (CLI test, git -C reads, own dir flags); pointer layout keeps its launcher
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-017/S2, PIP-017/S19, PIP-017/S20, INS-003/S15, INS-014/S16, INS-014/S26, INS-014/S28, INS-014/S30, INS-010/S10]
        reason: Tests, commits, git reads and build-skill commands each have a stated worktree form; the report folder is the worktree parent from INS-003/S15; INS-014/S16 is reconciled through S20; no settings or hooks change, so INS-003 and INS-010/S10 stay true
      - item: C2
        outcome: scenarios
        ids: [PIP-017/S19, PIP-017/S20, INS-014/S16, INS-014/S28]
        reason: A path with a space is quoted; a project in a subfolder works through --root; a pointer-layout project uses its skill-local launcher until spec upgrade, then .spec/bin/spec; the absolute worktree CLI is never used
      - item: C3
        outcome: scenarios
        ids: [PIP-017/S6]
        reason: The report file is named for the ticket and the role, so parallel tickets and stages never share a file
      - item: C4
        outcome: na
        ids: []
        reason: "No new input crosses a trust boundary: the CLI builds the --root, git -C and report paths from its own worktree state, and no new or wider allow rule is added"
      - item: C5
        outcome: scenarios
        ids: [PIP-017/S19, PIP-017/S20]
        reason: Only quoted paths inside the listed folder are given; a pointer-layout launcher, a command with no directory option, and read-only git get Claude Code's normal approval instead of a promised pass
      - item: C6
        outcome: scenarios
        ids: [INS-014/S26, INS-014/S28, PIP-017/S6]
        reason: Default edit mode still runs stages in the foreground and still asks before writes; advance stays a root-relative command outside the task
      - item: C8
        outcome: scenarios
        ids: [INS-014/S28]
        reason: Verified at code.claude.com/docs/en/tools-reference (a subagent's cd never carries over) and /docs/en/permissions (Bash rules match the whole command text after splitting; acceptEdits approves writes in additionalDirectories; read-only git runs without a prompt). Whether a git -C form counts as read-only is not documented, so the spec promises no approval behaviour for it
    assumed:
      - new: Which CLI runs a delegated stage's commands?
        value: The project root's own relative CLI (.spec/bin/spec, or the pointer-layout launcher) with --root set to the worktree's spec root
      - new: Is the report file removed after ticket advance reads it?
        value: No; the main session overwrites it for each stage of that ticket and role
      - new: May the spec-writer change CLI-007, which is outside touches?
        value: Yes; CLI-007/S1, S14 and R14 said to cd into the worktree and would contradict PIP-017/R2. The gate still reports ready
      - new: Does INS-003 need a new allow rule?
        value: No; Bash(.spec/bin/spec *) already matches the --root form, and project commands keep their own rules' leading words
    duration_s: 144
  - at: 2026-11-01T13:35:36.711Z
    role: spec-review
    result: done
    summary: Earlier findings resolved; approve with a minor clarification to the upgrade scenario
    verdict: approve
    findings:
      - cites: [PIP-017/S20, CLI-007/R4]
        text: "Follow-up: S20 says the same next command returns another delegate task after upgrade, but its first invocation already starts the stage, so CLI-007/R4 would refuse the second invocation without restart. Clarify the lifecycle or independent ready-state setup for the post-upgrade assertion."
        class: C9
    assumed: []
    duration_s: 123
  - at: 2026-11-01T13:58:23.324Z
    role: tester
    result: done
    summary: Tests for the --root no-cd task, worktree-parent report path, pointer launcher (independent TASK-102 post-upgrade) and run-skill wording
    verdict: null
    mutations:
      - scenario: CLI-007/S1
        wrong: cli.Next.advance keeps the literal --report-file <path> placeholder instead of an absolute report path
      - scenario: CLI-007/S14
        wrong: the task still says cd there first and gives the CLI without --root, and the advance command reports into the primary checkout
      - scenario: INS-014/S16
        wrong: after upgrade the task and advance still use the skill-local launcher, or the launcher form omits --root
      - scenario: INS-014/S26
        wrong: the run skill still tells the main session to save the report in a scratch directory or a mktemp path
      - scenario: INS-014/S28
        wrong: the trust bullet still says the relative command runs from a ticket worktree and mentions no --root or report-file approval
      - scenario: PIP-017/S2
        wrong: the Working folder block says cd there first and names the absolute worktree CLI instead of .spec/bin/spec --root
      - scenario: PIP-017/S4
        wrong: the role prompt drops the one-path rule for running tests through the CLI
      - scenario: PIP-017/S6
        wrong: the report file is placed inside the ticket worktree, or the advance command keeps the <path> placeholder
      - scenario: PIP-017/S19
        wrong: the --root and report-file paths are left unquoted so a folder with a space splits into several arguments
      - scenario: PIP-017/S20
        wrong: a pointer-layout project gets the launcher without --root, or still the launcher after spec upgrade installs .spec/bin/spec.cjs
    assumed:
      - new: How does PIP-017/S20 get a ready state after upgrade, since the first next already started TASK-101 (spec-review follow-up)?
        value: A second ready ticket, TASK-102, is started after the upgrade, as INS-014/S16 already did; no second start of TASK-101
      - new: Which quote style does the task use for a path with a space?
        value: Any; tests read quoted values with a shell-word parser and check the parsed value, so a single- or double-quote form both pass
      - new: PIP-017/S4 was not in the changed list; does it keep requiring `.spec/bin/spec test` in the role prompt?
        value: Loosened to also accept `.spec/bin/spec --root <path> test`, so either form of the one-path-function rule passes
      - new: Which words must the Working folder block use (PIP-017/S2)?
        value: "Only the spec's own phrases: project root, carry over, never cd, absolute paths, never commit, git -C <worktree> with status/diff/log, directory option, path argument, allow rule"
    duration_s: 1361
  - at: 2026-11-01T14:28:29.787Z
    role: implementer
    result: done
    summary: Task runs relative CLI with --root and never cd; advance names an absolute report file in the worktree parent; skills and trust bullet updated
    verdict: null
    assumed:
      - new: Where in the worktree parent does the report file go, and what is it called?
        value: <worktree parent>/<TICKET>-<role>-report.md, a file directly inside the parent and never inside a worktree; the CLI does not delete it, and the main session overwrites it each stage
      - new: How is a path with a space or other shell character written in the task and in cli.Next.advance?
        value: Single-quoted as one shell word (embedded quotes escaped); plain paths stay unquoted
      - new: Do role-prompt commands such as `.spec/bin/spec test` carry --root themselves?
        value: No. The prompt text keeps the plain form; the Working folder block says to add --root <worktree spec root> to every such command
    duration_s: 1803
  - at: 2026-11-01T14:38:53.629Z
    role: reviewer
    result: done
    summary: "Approve: rooted CLI tasks, quoted paths, worktree-parent reports and harness compatibility match the spec"
    verdict: approve
    assumed: []
    duration_s: 595
---
Found by the plugin live check on 2026-11-01 (Claude Code 2.1.312, headless, trusted project, --permission-mode acceptEdits, sonnet stages, fixture chat-mini, one TASK through /spec:run). The edit itself went through, but two things needed approvals a person would have to click every stage. (1) The implementer subagent ran the worktree's CLI by absolute path (`<repo>.worktrees/TASK-001/.spec/bin/spec test`), which the relative allow rule `Bash(.spec/bin/spec *)` does not match; with haiku it instead chained `cd <worktree> && .spec/bin/spec test`, which Claude Code refuses as a compound command (and flags as cd-before-git for `git status`). The task text says 'cd there first' (PIP-017/S1) while the role rules forbid `&&`, so models mix them. (2) The main session had nowhere it was allowed to write the report file: /spec:run says to save it in 'the session scratch directory (or mktemp)', but a plain Claude Code session has no scratch directory it may write without approval, and `mktemp` needs approval too. Fix both so a person in accept-edits mode clicks nothing during a stage: e.g. tell the subagent to run `cd <worktree>` as its own command first, and/or have setup add an allow rule for the worktree CLI path to the personal settings PROP-067 writes; and give the report file a place inside the project or the worktrees folder that accept-edits already covers (or a stdin form the allow rule matches). Decide the details in the spec; keep the default edit mode's behaviour (it stops with clear options, which the live check showed works).
