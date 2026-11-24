---
id: PROP-122
type: proposal
title: A nested project's init does not take over the enclosing project's Git hooks
status: done
stage: null
touches: [INS-015]
violates: []
depends_on: []
changed: [INS-015, INS-015/S3, INS-018, INS-018/R1, INS-018/R2, INS-018/R3, INS-018/S1, INS-018/S2, INS-018/S3, INS-018/S4]
questions: []
history:
  - at: 2026-11-03T22:15:57.211Z
    role: spec-writer
    result: done
    summary: Init/upgrade keep spec hooks serving another project, take over a gone one; new INS-018, INS-015/S3 narrowed
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-015/S3, INS-018/S4]
        reason: spec impact PROP-122 reaches no other feature; INS-015/S3 now updates only a hook serving the same project path and INS-018/S4 keeps that path working; INS-016/R10 ownership via spec-managed hooks is unchanged
      - item: C2
        outcome: scenarios
        ids: [INS-018/S1, INS-018/S2, INS-018/S4]
        reason: root vs nested project both ways (S1), linked worktrees still holding the recorded folder (S2), project named by relative, absolute or symlinked path (S4; today's build records '.' through a symlink outside the repo, so S4 is new behaviour); upgrade of v1 hooks covered by S1 and S4
      - item: C3
        outcome: na
        ids: []
        reason: hook installation is one synchronous pass in one process with no shared state across an await; two concurrent inits in one repository are not guarded today and the ticket does not ask for it
      - item: C4
        outcome: scenarios
        ids: [INS-018/S3]
        reason: the recorded project path in a hook file can be set by anyone who can write the Git directory; it only decides keep, take over or update, is read as text and never run, and an absolute or '..' path is refused as unreadable (R2, R3)
      - item: C5
        outcome: scenarios
        ids: [INS-018/S3, INS-018/S2]
        reason: a missing, absolute or '..' recorded path keeps the hook and reports it; takeover only when the recorded directory exists in no working tree, otherwise kept
      - item: C6
        outcome: scenarios
        ids: [INS-015/S3, INS-018/S4, INS-015/S15, INS-015/S30]
        reason: same-project hooks still rewritten and listed; non-spec hooks and project or external hooksPath behaviour unchanged
      - item: C8
        outcome: scenarios
        ids: [INS-018/S1]
        reason: "Git facts (linked worktrees share the common hooks folder; show-prefix gives the project path) verified by running the current build in a scratch repository: a nested init rewrote the outer project's common hooks to 'tmp-probe', and a project-owned hook printed 'note: kept existing .git/hooks/pre-commit; add this line: ...' with exit 0"
    assumed:
      - new: Is the project path compared exactly, letter case included?
        value: exact comparison of the path relative to the working tree root; a spelling that differs only in case counts as another project, so the hook is kept and reported
      - new: When is a recorded project gone?
        value: only when its directory exists in no working tree of the repository (main or linked); an existing folder without a pinned CLI is not gone
      - new: Exact wording of the kept, unreadable and took-over notes
        value: "as pinned in INS-018/S1, S2 and S3, printed as 'note: ...' lines and in JSON notes"
      - new: Does keeping another project's hook change the exit code?
        value: no; init and upgrade exit 0, as when they keep a non-spec hook (verified today for non-spec hooks)
      - new: Should L033 and the session-start missing-hooks line flag a hook that serves another project?
        value: unchanged; such a hook still counts as installed (LNT-003 and INS-015/S31 are outside this ticket)
      - new: Where does the new behaviour live?
        value: new feature INS-018, since INS-015 is at its 250-line lint budget; INS-015/S3 cites INS-018/R1
    duration_s: 300
  - at: 2026-11-03T22:16:53.318Z
    role: spec-review
    result: done
    summary: The hook ownership change is coherent and preserves the stated hook-installation neighbours.
    verdict: approve
    findings:
      - cites: [INS-018/R2, INS-018/S3]
        text: "Follow-up: clarify that ‘recorded path is missing’ in R2 means the hook has no recorded project-path value; S2 separately defines a recorded directory that no longer exists as eligible for takeover."
        class: C9
    assumed: []
    duration_s: 43
  - at: 2026-11-03T22:26:02.623Z
    role: tester
    result: done
    summary: Tests for INS-018/S1-S4 and INS-015/S3 added in tests/cli/git-hooks-other-project.test.ts; 16 of 21 fail until implemented
    verdict: null
    mutations:
      - scenario: INS-015/S3
        wrong: stops updating any existing spec-managed hook, even one that serves this same project path
      - scenario: INS-018/S1
        wrong: still rewrites a spec-managed hook that records another existing project, or keeps it silently without the note, or lists it as written or updated
      - scenario: INS-018/S1
        wrong: decides all three hooks together from the first hook, so a missing commit-msg is not written when pre-commit is kept
      - scenario: INS-018/S2
        wrong: takes over a hook whose recorded folder is gone from the main tree only, ignoring a linked worktree that still has it
      - scenario: INS-018/S2
        wrong: keeps a hook whose recorded project folder exists in no working tree, or takes it over without the 'took over' note
      - scenario: INS-018/S3
        wrong: rewrites a hook with a missing, absolute or '..' recorded path, resolves it as a path, or runs the hook file to find its project
      - scenario: INS-018/S4
        wrong: compares the project path as written on the command line, so an absolute or symlinked name counts as another project and the hook is kept
    assumed:
      - new: How do tests write a hook that records a given project path?
        value: same body as installGitHooks writes (marker line, then project_root="$worktree_root"/'<path>'), plus a stale comment line so a rewrite is visible
      - new: How is the nested project's upgrade tested?
        value: init the project first so it has a pinned CLI, then replace the three hook files by hand, then run upgrade --from plugin/scripts
      - new: How is a missing recorded path written in the S3 hook?
        value: a marker-bearing hook with no project_root line at all
    duration_s: 546
  - at: 2026-11-03T22:34:57.380Z
    role: implementer
    result: done
    summary: Init/upgrade keep hooks serving another existing project, take over gone ones, update same-project hooks
    verdict: null
    assumed:
      - new: How is the project path compared when the project is named by an absolute path or a symlink?
        value: installGitHooks works on the real folder and records its real path relative to the working tree root, so any naming of the same folder counts as the same project
      - new: Which working trees count when checking that a recorded project is gone?
        value: every entry of git worktree list --porcelain, main and linked; a recorded directory in any of them keeps the hook
    duration_s: 532
  - at: 2026-11-03T22:36:22.178Z
    role: reviewer
    result: done
    summary: Init and upgrade preserve hooks for other projects while updating same-project hooks
    verdict: approve
    assumed: []
    duration_s: 82
---
Seen 2026-11-04 in spec's own repository: during TASK-001's review a probe ran `spec init` in a temporary folder inside the repository (.review-tmp-TASK-001/spec-ins005-later-init-R7bdHf). Because INS-015/S3 updates any existing spec-managed hook, init rewrote the repository's common pre-commit, pre-merge-commit and commit-msg hooks to point at that nested project. The folder was then deleted, so every hook now prints 'pinned CLI missing' and exits 0 (INS-015/S16): commit enforcement for the real project is silently off. Wanted: when an existing spec-managed hook already serves a different project path than the one being initialized or upgraded, init and upgrade leave that hook file unchanged and report it (naming both project paths and how to repoint it deliberately), like a project-owned hook. A spec-managed hook for the same project path is still updated as today. Also, a spec-managed hook whose recorded project path no longer exists may be taken over by the project being initialized, since it serves nothing.
