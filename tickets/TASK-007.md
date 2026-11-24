---
id: TASK-007
type: task
title: Read the tickets' live state and a directory's fixed facts with far fewer git processes
status: done
stage: null
touches: [CLI-002]
violates: []
depends_on: [PROP-112]
changed: []
questions: []
history:
  - at: 2026-11-11T11:14:18.018Z
    role: implementer
    result: done
    summary: Batched fixed Git facts and ticket state; restored tag-safe bases and external-ticket worktree paths
    verdict: null
    assumed: []
    duration_s: 3267
  - at: 2026-11-11T11:19:07.081Z
    role: reviewer
    result: done
    summary: "Changes: detached HEAD with non-branch base misreads merged tickets; separate-git-dir tree loses its branch."
    verdict: changes
    findings:
      - cites: [TASK-007, WSP-004/S4]
        text: "src/io/ticket-git.ts:120 `currentBranch === baseBranch` is true when both are null: a detached HEAD (currentBranch null) with a base that is not a local branch (remote-tracking `origin/main`, a tag, a commit; baseBranch null) makes mergedHead = mergedBase instead of merged('HEAD'). Reproduced with ticketGitState on a repo whose HEAD (detached) contains merged ticket/T-1 but origin/main does not: live = [T-1] detached, [] attached, where the earlier code (merged('HEAD')) gave []. A detached checkout with base origin/main is the usual CI setup. Fix: `baseBranch !== null && currentBranch === baseBranch`, and add a test with a detached HEAD and a remote-tracking base."
        class: C6
      - cites: [TASK-007, WSP-004/S4]
        text: "src/io/ticket-git.ts:113-114 takes the tree's branch from the worktree-list entry whose path equals --show-toplevel, and falls back to symbolic-ref only when --show-toplevel fails. For a main tree made with `git init --separate-git-dir`, and for a submodule, `git worktree list` names the git dir (…/sep.git, …/.git/modules/sm), not the toplevel, so no entry matches. Reproduced: a separate-git-dir tree on ticket/T-9 gives current = null (symbolic-ref gave T-9), so `spec next`, status and the current-ticket checks treat the tree as on no ticket. Fix: when no list entry matched (listedWorktrees.currentBranch null), run symbolic-ref whatever top.code is; that costs one process only when the tree is detached or unmatched."
        class: C2
      - cites: [TASK-007]
        text: "src/io/git.ts:40-44 splits the combined rev-parse output on '\\n' and accepts any `values.length >= 4`, but git prints --git-dir, --show-toplevel and --show-prefix unquoted, so a newline in the repository or sub-folder path shifts every later answer and the shifted values are cached as if they were the single-call answers. Reproduced: toplevel `…/nl\\nine` is cached as `…/nl` with prefix `ine`, where the single calls print `…/nl\\nine` and an empty prefix. Rare, but silent and wrong. Fix: accept the combined answer only when the output has exactly five parts (four lines plus the final empty string); otherwise cache nothing and let the single questions answer."
        class: C5
      - cites: [TASK-007]
        text: "src/io/ticket-git.ts:105,145-170: a base that resolves only through resolveCommit or a remote-tracking or tag ref (baseBranch null) now gives a non-null baseTip, so the absorbed/done-merged override runs and sets live entries `{ branch: base, worktree: null }` with branch `origin/main` or a tag. On main, baseTip was null for such bases and no override happened. ticket-store.ts:119 then calls commitToBranch(refs/heads/origin/main, …, live.tip), which fails with 'moved while it was being updated' for a ticket update. The restoration the ticket asks for is finding the base for `merged`, not adding a live override that writes to a non-branch. Fix: run the override only when baseBranch !== null (or keep merged-into-base for mergedIntoBase but leave live untouched for non-branch bases), and cover it with a test using a remote-tracking base and an absorbed ticket."
        class: C6
      - cites: [TASK-007]
        text: "Follow-up: tests/io/git-cache.test.ts has no case where the combined answer must be refused (a newline in a path) and tests/cli/ticket-live-state.test.ts has no detached-HEAD or separate-git-dir case, which is why findings 1-3 passed the suite. Add one test for each once the fixes land."
        class: C7
    assumed: []
    duration_s: 269
  - at: 2026-11-11T11:59:03.992Z
    role: implementer
    result: done
    summary: Restored Git answer parity for detached, separate-dir, non-branch, and newline-path cases
    verdict: null
    assumed: []
    duration_s: 2394
  - at: 2026-11-11T12:01:41.218Z
    role: reviewer
    result: done
    summary: "Approve: all four findings fixed and reproduced clean; new tests would fail without the fixes. Two follow-ups."
    verdict: approve
    findings:
      - cites: [TASK-007]
        text: "Follow-up: src/io/ticket-git.ts:114-122 now rewrites the worktree path of the tree's own branch to the top level when the worktree list names the git dir (separate-git-dir main tree, submodule), and reports it as primaryWorktree. The earlier command output there was the git-dir path (…/sep.git), so `worktrees.get(id)` and primaryWorktree for that tree now differ from the original behaviour, in the better direction (the tree is no longer seen as another worktree). Rare configuration; the spec should say it if it is meant to stay, or it can be filed as a bug fix."
        class: C6
      - cites: [TASK-007]
        text: "Follow-up: the current branch now comes from `git worktree list`, which prints `refs/heads/<name>`, instead of `symbolic-ref --short`, which prints `heads/<name>` when a tag has the same name as the branch. With a tag shadowing a ticket branch (or the base branch) `current` and the base-is-here test now differ from the old command. Rare, and the new answer is the correct one; file it as a candidate bug ticket only if the old output mattered."
        class: C2
    assumed: []
    duration_s: 147
---
Asked by the person on 2026-11-10: make the suite run fast. TASK-006 (merged, a7b073c) took the full run from about 434 s to 329 s and the git processes of one run from 69,794 to 55,578. On this machine a full run's wall clock is close to the number of processes started times 6 ms, so the remaining git processes are the remaining time. Traced on TASK-006's tree, one full run starts: rev-parse 13,029, symbolic-ref 6,582, branch 5,941, for-each-ref 5,285, grep 4,175, worktree 3,665, add 2,448, commit 1,904, cat-file 1,310, status 1,289. First, restore one behaviour TASK-006 changed by mistake (its reviewer's follow-up): at src/cli/next.ts:340 `spec next` without --start now takes worktree paths from ws.ticketGit, which is empty when the tickets directory is outside the repository, so a ticket whose worktree is at a non-default path (moved, or made by hand) is shown at the default path; spec worktree list guards the same case (ws.store.dirRel === null || ws.ticketsInRepo). Use the same guard or a fresh read there, and add the missing test: tickets outside the repository, a worktree at a non-default path, and next names the real path. Then, with no behaviour, output or message changing: (1) when the CLI needs any of the four fixed facts of a directory (git dir, common dir, top level, prefix), ask for all four in one git process and keep them for the command, falling back to single questions when the combined one fails (a bare repository, a path inside the git folder); (2) read the tickets' live state (src/io/ticket-git.ts: ticket branches, this tree's branch, the worktree list, merged branches) with as few processes as git allows, for example the worktree list already names each tree's branch, and one for-each-ref can carry what branch is asked for; (3) reuse one live-state read within a command wherever nothing is written and no lock is taken in between, as TASK-006 did for next summaries, keeping every re-read that follows a write or happens under a lock; (4) find what the 4,175 git grep calls are for and batch or avoid them where the answer is the same. Measure with the child-process tracer the session supplies and report git processes before and after for one `spec next --summary` (13 on main after TASK-006) and for two git-heavy test files; the session measures the whole suite when it records the stage. The aim is under 35,000 git processes and under 4 minutes for a full run.
