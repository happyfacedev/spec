---
id: PROP-074
type: proposal
title: A blocked stage's stash comes back without conflicts in generated files
status: done
stage: null
touches: [WSP-009]
violates: []
depends_on: [PROP-071]
changed: [PIP-002, PIP-002/R4, PIP-002/R5, PIP-002/S18, PIP-002/S22, PIP-008, PIP-008/R9, PIP-008/S10, WSP-009, WSP-009/R5, WSP-009/R6, WSP-009/S5, WSP-009/S6]
questions:
  - id: Q1
    kind: blocker
    text: "tests: true. tests/cli/advance-scenarios.test.ts:232 (PIP-008/S10 'a changed generated file is put back as HEAD has it and is not in the stash') expects `git status --porcelain --untracked-files=all` to be ''. After a refused report the CLI itself leaves ' M tickets/TASK-101.md' (the blocked status and question are written there, nothing is committed). The scenario and PIP-008/R9 say only that nothing outside the tickets folder is left uncommitted, and the sibling test at line 207 resets 'tickets' by hand for the same reason. Received: ' M tickets/TASK-101.md\\n'; every other assertion in that test holds. The assertion should filter out the tickets folder, as WSP-009/S5 'nonTicket' does. Its changes are kept in git stash \"PROP-074 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites: [PIP-008/S10, PIP-008/R9, WSP-009/R5]
    answer: "Yes: the tester filters the tickets folder out of that status assertion, as WSP-009/S5's nonTicket does."
    raised_by: implementer
history:
  - at: 2026-10-31T19:27:59.687Z
    role: spec-writer
    result: done
    summary: Blocked-stage stash leaves out generated files, restore rebuilds them; new files survive a partly conflicting restore
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-008/S21, PIP-002/S18, PIP-002/S22, PIP-001/S5, WSP-009/S5]
        reason: spec impact reaches PIP-001 and PIP-008. PIP-008/S21 (no generated file) still holds under WSP-009/R5, and its R9 now points to it. PIP-001/S5 only resumes the stage, so it is unchanged. The restore in PIP-002/R4 and R5 changes with WSP-009/S5 and PIP-002/S22. The CLI-007 --restart stash uses the same rules.
      - item: C2
        outcome: scenarios
        ids: [WSP-009/S6, WSP-009/S4]
        reason: "Upgrade: a stash made by an earlier version that still holds a generated file does not conflict (WSP-009/S6 But, R6). An old generatedGlobs config is left out of the stash too (R5, and R4 as in S4). Paths are project-relative globs, as in FMT-002, and this adds no new path handling."
      - item: C3
        outcome: na
        ids: [PIP-002/S27]
        reason: No new shared state. Stash list changes still run under the repository stash lock (PIP-002/R4, S27). The rebuild runs inside the start, on that stage's own tree.
      - item: C4
        outcome: na
        ids: []
        reason: No new input crosses a trust boundary. format.GeneratedConfig.command is already the project's own config, which merge and sync run (WSP-009/R2).
      - item: C5
        outcome: scenarios
        ids: [WSP-009/S6, PIP-002/S22]
        reason: A rebuild that fails after a restore keeps the restored work, puts the generated files back as the branch has them and says so on stderr (S6). A stash that does not apply is kept whole, new files included, and the question names those new files (S22).
      - item: C6
        outcome: scenarios
        ids: [PIP-002/S18, PIP-002/S20, PIP-008/S21, WSP-009/S5]
        reason: Stashes without generated files restore as before (S18, S20, S21). Without a command, nothing runs on restore (WSP-009/S5 But).
      - item: C8
        outcome: scenarios
        ids: [PIP-002/S22]
        reason: "Checked locally with git 2.52.0. A stash made with -u keeps new files in its third parent. Plain git stash show leaves them out, and git stash show --include-untracked lists them. Today's build, run in a scratch repo, refused the restore with: it conflicts in gen/bundle.js. It blocked the ticket, kept the stash and left the tree clean, with src/extra.txt only in the stash."
    assumed:
      - new: When the generated command fails after a restore, is the start refused?
        value: No. The start succeeds, the restored files stay, the generated files are put back as the branch has them, the stash is dropped, and stderr says so (WSP-009/R6). A blocked stage's work may not build yet.
      - new: Does the rebuild after a restore run only when the stage had changed generated files?
        value: It runs whenever a stash was applied and a command is set, because the stash no longer records generated changes.
      - new: Are spec's own generated files (spec/index.md, _generated/) also left out of the stash?
        value: No, only the project's own generated globs, as the ticket says. The rest is unchanged and can come in a separate proposal.
      - new: Text of the new-files sentence in the stash-conflict question
        value: "It also holds new files that only git stash show --include-untracked lists: <files>."
    duration_s: 447
  - at: 2026-10-31T19:30:18.253Z
    role: spec-review
    result: done
    summary: Approved generated-file stash exclusion, restore rebuilds, and new-file preservation on conflicts
    verdict: approve
    assumed: []
    duration_s: 137
  - at: 2026-10-31T19:40:56.361Z
    role: tester
    result: done
    summary: Tests for the blocked-stash generated-file rules, restore rebuild, new-file conflict question; all new ones fail now
    verdict: null
    mutations:
      - scenario: WSP-009/S5
        wrong: stashes generated files with the rest, so gen/bundle.js is in the stash and conflicts or is left uncommitted
      - scenario: WSP-009/S5
        wrong: leaves tracked generated files out but stashes new files under the glob, or ignores an old generatedGlobs
      - scenario: WSP-009/S5
        wrong: restore does not run the generated command, or runs it twice, or runs it when no command is set
      - scenario: WSP-009/S6
        wrong: a failing rebuild refuses the start, keeps the stash, or leaves partial or new generated files in the tree
      - scenario: WSP-009/S6
        wrong: the failure message prints all output lines instead of the last three, or omits the stderr line
      - scenario: WSP-009/S6
        wrong: an old stash that holds a generated file still conflicts instead of being rebuilt
      - scenario: PIP-002/S18
        wrong: restore never runs the generated command, or leaves what it wrote out of the uncommitted work
      - scenario: PIP-002/S22
        wrong: the conflict question omits the new files of the kept stash, or lists them when the stash has none, or drops the stash
      - scenario: PIP-008/S10
        wrong: a refused report stashes the changed generated file and leaves it modified or new in the tree
    assumed: []
    duration_s: 636
  - at: 2026-10-31T19:50:45.529Z
    role: implementer
    result: blocked
    summary: Code done; 1744/1745 tests pass. PIP-008/S10 test expects a clean status, but the ticket file is always dirty.
    verdict: null
    assumed:
      - new: Where does the restore-rebuild failure message go when the start runs from spec next?
        value: Only `spec ticket start` prints it on stderr (StartResult.warning); startEntry in next.ts ignores it
      - new: Does a blocked stage with only generated-file changes still put those files back as HEAD?
        value: "Yes. Nothing is stashed (stashed: false), the generated files go back to HEAD"
    duration_s: 587
  - at: 2026-10-31T19:50:46.899Z
    role: tester
    result: reopened
    summary: reopened by PROP-074#Q1
    verdict: null
    assumed: []
  - at: 2026-10-31T19:56:30.366Z
    role: tester
    result: done
    summary: PIP-008/S10 status check filters tickets/ like WSP-009/S5; its stash assertion (line 235) fails until the implementer's stashed code returns, as intended
    verdict: null
    mutations:
      - scenario: WSP-009/S5
        wrong: stashes generated files with the rest, so gen/bundle.js is in the stash and conflicts or is left uncommitted
      - scenario: WSP-009/S5
        wrong: leaves tracked generated files out but stashes new files under the glob, or ignores an old generatedGlobs
      - scenario: WSP-009/S5
        wrong: restore does not run the generated command, or runs it twice, or runs it when no command is set
      - scenario: WSP-009/S6
        wrong: a failing rebuild refuses the start, keeps the stash, or leaves partial or new generated files in the tree
      - scenario: WSP-009/S6
        wrong: the failure message prints all output lines instead of the last three, or omits the stderr line
      - scenario: WSP-009/S6
        wrong: an old stash that holds a generated file still conflicts instead of being rebuilt
      - scenario: PIP-002/S18
        wrong: restore never runs the generated command, or leaves what it wrote out of the uncommitted work
      - scenario: PIP-002/S22
        wrong: the conflict question omits the new files of the kept stash, or lists them when the stash has none, or drops the stash
      - scenario: PIP-008/S10
        wrong: a refused report stashes the changed generated file and leaves it modified or new in the tree
    assumed: []
    duration_s: 343
  - at: 2026-10-31T20:10:14.309Z
    role: implementer
    result: done
    summary: Blocked stash leaves out generated files and keeps new ones; restore rebuilds once; conflicting stash names its new files; 1745 tests pass
    verdict: null
    assumed:
      - new: Where does the restore-rebuild failure message go when the start runs from spec next?
        value: Only `spec ticket start` prints it on stderr (StartResult.warning); startEntry in next.ts ignores it
      - new: Does a blocked stage with only generated-file changes still put those files back as HEAD?
        value: Yes. Nothing is stashed, and the generated files go back to HEAD
    duration_s: 822
  - at: 2026-10-31T20:16:53.953Z
    role: reviewer
    result: done
    summary: Exclude staged generated changes from stashes and preserve rebuild warnings through spec next
    verdict: changes
    findings:
      - cites: [WSP-009/R5, WSP-009/S5, PIP-008/R9]
        text: src/io/stash.ts:71 excludes generated paths only through the git stash push pathspec. Git still records staged changes outside that pathspec in the stash's index parent and working-tree commit. With a staged gen/bundle.js change and an ordinary src/app.ts change, the blocked stash therefore still contains gen/bundle.js, despite the later putBackAsHead. The same applies to --restart. Exclude staged generated versions too, and add coverage for staged tracked and staged new generated files; the added WSP-009/S5 tests leave generated changes unstaged and miss this violation.
        tests: true
      - cites: [WSP-009/R6, WSP-009/S6, PIP-002/R4]
        text: src/cli/tickets.ts:221 returns the rebuild-failure warning, but src/cli/next.ts:170-175 discards it. A failed rebuild during spec next TASK-101, spec next --start, or --restart thus succeeds and drops the stash without telling the session that generated files were reset to HEAD. Propagate the warning to stderr through next, including JSON output, and add failure coverage through that entry point; the new WSP-009/S6 tests exercise only ticket start.
        tests: true
    assumed: []
    duration_s: 398
  - at: 2026-10-31T20:22:11.948Z
    role: tester
    result: done
    summary: Added WSP-009/S5 staged generated-file coverage and WSP-009/S6 rebuild-warning coverage through spec next (text, JSON, --restart)
    verdict: null
    mutations:
      - scenario: WSP-009/S5
        wrong: stashes generated files with the rest, so gen/bundle.js is in the stash and conflicts or is left uncommitted
      - scenario: WSP-009/S5
        wrong: leaves tracked generated files out but stashes new files under the glob, or ignores an old generatedGlobs
      - scenario: WSP-009/S5
        wrong: restore does not run the generated command, or runs it twice, or runs it when no command is set
      - scenario: WSP-009/S5
        wrong: excludes generated paths only by the stash pathspec, so a staged tracked or staged new generated file stays in the stash's index commit
      - scenario: WSP-009/S5
        wrong: the stash of spec next --restart keeps a staged generated file, which comes back in the tree and index
      - scenario: WSP-009/S6
        wrong: a failing rebuild refuses the start, keeps the stash, or leaves partial or new generated files in the tree
      - scenario: WSP-009/S6
        wrong: the failure message prints all output lines instead of the last three, or omits the stderr line
      - scenario: WSP-009/S6
        wrong: an old stash that holds a generated file still conflicts instead of being rebuilt
      - scenario: WSP-009/S6
        wrong: spec next, with or without --restart, drops the rebuild-failure warning so stderr is empty
      - scenario: WSP-009/S6
        wrong: spec next --format json puts the warning into stdout and breaks the JSON entry
      - scenario: PIP-002/S18
        wrong: restore never runs the generated command, or leaves what it wrote out of the uncommitted work
      - scenario: PIP-002/S22
        wrong: the conflict question omits the new files of the kept stash, or lists them when the stash has none, or drops the stash
      - scenario: PIP-008/S10
        wrong: a refused report stashes the changed generated file and leaves it modified or new in the tree
    assumed: []
    duration_s: 315
  - at: 2026-10-31T20:29:53.804Z
    role: implementer
    result: done
    summary: Staged generated files stay out of the blocked and restart stash; spec next prints the rebuild warning on stderr
    verdict: null
    assumed:
      - new: With several tickets in one spec next --start wave, where do the rebuild warnings go?
        value: All on stderr, one line per ticket, in start order; stdout is unchanged
    duration_s: 460
  - at: 2026-10-31T20:31:27.160Z
    role: reviewer
    result: done
    summary: "Both findings fixed: staged generated files stay out of stashes and spec next preserves rebuild warnings"
    verdict: approve
    assumed: []
    duration_s: 91
---
Seen three times (PROP-064, PROP-065, PROP-066; SELF-HOSTING P25/D16). When a stage ends blocked, advance stashes its changes, including the rebuilt bundles under the `generated` globs. While the ticket waits, `spec next` syncs the branch with main, which rebuilds the same bundles. When the stage starts again, popping the stash conflicts on every generated file, and the person has to restore the non-generated files by hand and rebuild. Stashing a blocked stage leaves files under the generated globs out of the stash, and restoring it rebuilds them with the generated command when one is set. No generated file conflicts when the stage comes back.
