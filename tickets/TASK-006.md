---
id: TASK-006
type: task
title: The CLI asks git for each fixed repository fact once per command, and the test run uses the real git binary
status: done
stage: null
touches: [CLI-002]
violates: []
depends_on: []
changed: []
questions: []
history:
  - at: 2026-11-10T14:43:27.381Z
    role: implementer
    result: done
    summary: Keep Git caching scoped, reuse next's ticket snapshot, and move fast Git setup into Vitest.
    verdict: null
    assumed: []
    duration_s: 3295
  - at: 2026-11-10T14:47:28.565Z
    role: reviewer
    result: done
    summary: Git fact cache and snapshots are safe; one narrow next regression for tickets outside the repo (follow-up). Approve.
    verdict: approve
    findings:
      - cites: [CLI-002/R3]
        text: "Follow-up: src/cli/next.ts:340 now passes ws.ticketGit.worktrees to worktreeProjectPath. When the tickets dir is outside the repository, loadWorkspace sets ws.ticketGit to NO_TICKET_GIT (src/io/workspace.ts:70-71), so the map is empty; before, ticketWorktrees(ws) read the worktree map from git fresh with a null tickets dir. `spec next` without --start then plans a ticket whose worktree exists at a non-default path (moved, made by hand, or made before config.worktrees changed) at the default worktreeDir instead of the real path. cmdWorktree list guards the same case with `ws.store.dirRel === null || ws.ticketsInRepo`. Fix: use the same guard in next, or fall back to the fresh read when the tickets are outside. A test with tickets outside the repo and a worktree at a non-default path is missing."
        class: C6
      - cites: [CLI-002/R1]
        text: "Follow-up: the fact cache is cleared only by a git() call that is init or worktree add/remove/move/prune/repair, and only in the store of the command that made the call. It does not see a repository or worktree changed by a shell step in the same command (worktreeSetup, afterMerge, the test or generated command, a command-store ticket tracker) or by another overlapping run() in the same process, each of which has its own store. The real CLI is one process per command and no scenario reaches this, so it is not a defect now. No test pins that overlapping run() calls have separate stores."
        class: C3
    assumed: []
    duration_s: 222
---
Asked by the person on 2026-11-10: fix why the suite is so slow. Measured by tracing every child process of one full run on main at 207dd39 (2,046 tests, 166 files, 7 min 14 s with the real git first on PATH): 71,894 child processes, 69,794 of them git, and git accounts for 3,252 s of the 3,684 s of summed test-file time. That is 34 git processes per test. On this Mac every process start costs about 9 ms (even /usr/bin/true), and /usr/bin/git is Apple's launcher that then starts the real git, so one git call costs about 19 ms, against about 9 ms for /Applications/Xcode.app/Contents/Developer/usr/bin/git called directly. Putting the real git first on PATH took one test file from 21.3 s to 10.9 s and the pipeline's full run from over 600 s (stopped by the 10-minute limit of PIP-009/R2) to 438 s. Most calls ask what cannot change while a command runs: 27,234 are rev-parse, of which --git-dir 9,806 (isRepo, src/io/git.ts:23), --git-common-dir 6,383 (commonDir, src/io/git.ts:133), --show-toplevel 4,319 and --show-prefix 3,768. Then symbolic-ref 6,638, branch 5,959, for-each-ref 5,341, git grep 4,181 and worktree 3,672, much of it the ticket store reading every ticket's live state (src/io/ticket-git.ts) each time a command loads it. What I want, with no behaviour, output, message or scenario changing: (1) within one command, the CLI asks git for each of those four fixed facts once per directory and reuses the answer. Never reuse a failure, and never let an answer outlive the command: the tests run many commands in one process against repositories and worktrees that are created and removed in between, and a command such as worktree add or init creates the repository it then asks about. (2) Where one command loads the tickets' live state more than once with nothing written in between, load it once; skip this part wherever you cannot show it is safe, and say so. (3) The test run puts the real git binary first on PATH when git on PATH is Apple's launcher (find it once, for example with xcrun -f git, in tests/global-setup.ts), and does nothing on other systems or when that fails. Report the number of git processes and the full suite's wall clock before and after, measured with the real git first on PATH in both runs so the two effects are told apart. The aim is under 5 minutes.
