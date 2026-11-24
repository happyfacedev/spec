---
id: PROP-123
type: proposal
title: Untracked files the merge does not touch do not block spec merge
status: done
stage: null
touches: [WSP-007]
violates: []
depends_on: []
changed: [WSP-007, WSP-007/R4, WSP-007/S19, WSP-007/S20, WSP-007/S21, WSP-007/S22, WSP-007/S23, WSP-007/S24, WSP-007/S25, WSP-007/S26, WSP-007/S27, workspace.BaseBranchDirty]
questions: []
history:
  - at: 2026-11-03T22:17:12.309Z
    role: spec-writer
    result: done
    summary: Merge refuses on untracked files only where it would write one; other untracked files stay as they are (WSP-007/R4)
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [WSP-007/S9, WSP-007/S22, WSP-009/S1]
        reason: "spec impact PROP-123 reaches GRF-008..012, INS-002..004, LNT-019, PIP-001/008/021 and TKT-* only through cli.UsageError, which this change leaves as it is (WSP-007/S9 unchanged). WSP-009 is reached through workspace.Merge: generated-file conflicts concern tracked files and are untouched, and an untracked file at a generated path still refuses the merge (S22)."
      - item: C2
        outcome: scenarios
        ids: [WSP-007/S20, WSP-007/S22]
        reason: Paths are repo-relative as git reports them. R4 also covers an untracked file inside a folder at a path the merge writes, and compares paths as git does in that repository (core.ignoreCase on a case-insensitive file system). No stored state, so no upgrade path; install layouts do not matter because the check reads git state only.
      - item: C3
        outcome: scenarios
        ids: [WSP-007/S23, WSP-006/S27]
        reason: While the tests run on the merged result, someone creates an untracked file; the refused merge is undone and the file is still there, untracked (S23). Merges are serialised by the merge lock (WSP-006/R7).
      - item: C4
        outcome: invariant
        ids: [INV-002]
        reason: The ticket's branch, written by agents, decides which paths it adds; spec decides, from git's own view of the base checkout, and refuses any collision with a person's untracked file, so a branch can never overwrite one (S20).
      - item: C5
        outcome: scenarios
        ids: [WSP-007/S22, WSP-007/S20]
        reason: Where merge cannot know ahead what it will write (generated rebuilds, afterMerge), every generated path counts as written, so an untracked file there refuses the merge (S22).
      - item: C6
        outcome: scenarios
        ids: [WSP-007/S2, WSP-007/S21, WSP-006/S1, WSP-006/S27]
        reason: Tracked changes (modified, staged, deleted) refuse exactly as before, with the same message; a clean base merges as before.
      - item: C8
        outcome: scenarios
        ids: [WSP-007/S25, WSP-007/S20]
        reason: "The git facts were checked in a scratch git copy of chat-mini with the worktree's current build: git status lists untracked files and leaves out ignored ones (node_modules/cache.bin merged; check-ignore confirmed spec/_generated/ is ignored), and an untracked file at a path the branch adds is refused today with 'main has uncommitted changes: docs/plan.md'."
    documents: [WSP-007/S20, WSP-007/S22, WSP-007/S25]
    assumed:
      - new: How does merge know before it runs what the sync or format.Config.afterMerge output will write?
        value: "It counts the generated paths as written: the spec root's index.md, the pinned .spec/bin/ CLI, and every path format.Config.generated (or an old generatedGlobs) matches. An untracked file that afterMerge writes elsewhere is not predicted; the afterMerge commit still leaves out every untracked file that was there before the merge."
      - new: What does the refusal say when an untracked file is in the way?
        value: "The same workspace.BaseBranchDirty line, '<base> has uncommitted changes: <paths>', listing it with the tracked changes, the first five in sorted order."
      - new: Is a file created while the merge runs kept out of the afterMerge commit?
        value: "No: only untracked files from before the merge are promised to stay out of it; a refused merge keeps any created meanwhile (S23)."
    duration_s: 357
  - at: 2026-11-03T22:20:12.880Z
    role: spec-review
    result: done
    summary: The spec does not cover a file created at a write path after the initial dirty check.
    verdict: changes
    findings:
      - cites: [WSP-007/R4, WSP-007/S20, WSP-007/S23]
        text: A user can create an untracked file at a path the ticket branch will add after the initial dirty check but before the merge writes it. R4 protects untracked files created during a refused merge, but neither S20 nor S23 covers this collision during a successful merge; specify a recheck/serialization or preservation outcome so the merge cannot overwrite that file.
        class: C3
    assumed: []
    duration_s: 174
    refusals: 1
  - at: 2026-11-03T22:26:27.904Z
    role: spec-writer
    result: done
    summary: Untracked files block merge only where it writes; one created mid-merge is refused by git and kept (WSP-007/S26)
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [WSP-007/S9, WSP-007/S22, WSP-009/S1]
        reason: "spec impact PROP-123 reaches GRF-008..012, INS-002..004, LNT-019, PIP-001/008/021 and TKT-* only through cli.UsageError, which this change leaves as it is (WSP-007/S9 unchanged). WSP-009 is reached through workspace.Merge: generated-file conflicts concern tracked files and are untouched, and an untracked file at a generated path still refuses the merge (S22)."
      - item: C2
        outcome: scenarios
        ids: [WSP-007/S20, WSP-007/S22]
        reason: Paths are repo-relative as git reports them. R4 also covers an untracked file inside a folder at a path the merge writes, and compares paths as git does in that repository (core.ignoreCase on a case-insensitive file system). No stored state, so no upgrade path; install layouts do not matter because the check reads git state only.
      - item: C3
        outcome: scenarios
        ids: [WSP-007/S26, WSP-007/S23, WSP-006/S27]
        reason: "While the merge runs, after its dirty check and before it merges, someone creates an untracked file where the branch adds one: git refuses to merge over it, and the merge is refused with workspace.BaseBranchDirty naming it, undone, with the file unchanged (S26). A file created while the tests run is kept by the undo (S23). Once the merge has written a path the file is tracked, and WSP-006/R1 keeps an edit to it. Merges are serialised by the merge lock (WSP-006/R7)."
      - item: C4
        outcome: invariant
        ids: [INV-002]
        reason: The ticket's branch, written by agents, decides which paths it adds; spec decides, from git's own view of the base checkout, and refuses any collision with a person's untracked file, so a branch can never overwrite one (S20, S26).
      - item: C5
        outcome: scenarios
        ids: [WSP-007/S22, WSP-007/S20, WSP-007/S26]
        reason: Where merge cannot know ahead what it will write (generated rebuilds, afterMerge), every generated path counts as written, so an untracked file there refuses the merge (S22); a collision the first check could not see is refused when git reports it (S26).
      - item: C6
        outcome: scenarios
        ids: [WSP-007/S2, WSP-007/S21, WSP-006/S1, WSP-006/S27]
        reason: Tracked changes (modified, staged, deleted) refuse exactly as before, with the same message; a clean base merges as before.
      - item: C8
        outcome: scenarios
        ids: [WSP-007/S26, WSP-007/S25, WSP-007/S20]
        reason: "Checked with git 2.52.0 in a scratch repository: 'git merge --no-ff --no-commit' of a branch that adds docs/plan.md, with an untracked docs/plan.md in the base checkout, prints 'The following untracked working tree files would be overwritten by merge: docs/plan.md ... Aborting', exits 2, and leaves HEAD, the index, every tracked file and the untracked file as they were, with no merge in progress (no MERGE_HEAD). Also checked in a scratch copy of chat-mini with the worktree's current build: git status lists untracked files and leaves out ignored ones (node_modules/cache.bin merged), and an untracked file at a path the branch adds is refused today with 'main has uncommitted changes: docs/plan.md'."
    documents: [WSP-007/S20, WSP-007/S22, WSP-007/S25]
    assumed:
      - new: How does merge know before it runs what the sync or format.Config.afterMerge output will write?
        value: "It counts the generated paths as written: the spec root's index.md, the pinned .spec/bin/ CLI, and every path format.Config.generated (or an old generatedGlobs) matches. An untracked file that afterMerge writes elsewhere is not predicted; the afterMerge commit still leaves out every untracked file that was there before the merge."
      - new: What does the refusal say when an untracked file is in the way?
        value: "The same workspace.BaseBranchDirty line, '<base> has uncommitted changes: <paths>', listing it with the tracked changes, the first five in sorted order; when git finds it during the merge (S26), the line names the paths git names."
      - new: Is a file created while the merge runs kept out of the afterMerge commit?
        value: "No: only untracked files from before the merge are promised to stay out of it; a refused merge keeps any created meanwhile (S23)."
      - new: Is an untracked file created mid-merge at a generated path that only a rebuild or afterMerge writes protected?
        value: "No extra recheck: the protection mid-merge is git's own refusal for paths the branch adds (S26); generated paths are checked before the merge (S22)."
    duration_s: 372
  - at: 2026-11-03T22:27:26.762Z
    role: spec-review
    result: done
    summary: Mid-merge generated-path writes can still overwrite a newly created untracked file.
    verdict: changes
    findings:
      - cites: [WSP-007/R4, WSP-007/S22, WSP-007/S26]
        text: A user can create an untracked file at a generated path after the initial dirty check but before the generated rebuild runs. S26 only specifies Git's refusal for a path the ticket branch adds; the pre-merge check in S22 does not protect this later write, and R4 explicitly assumes no recheck for generated paths. Specify how a mid-merge untracked file at a generated path is preserved and causes refusal rather than being overwritten.
        class: C3
    assumed: []
    duration_s: 56
  - at: 2026-11-03T22:28:43.332Z
    role: spec-writer
    result: done
    summary: Merge rechecks generated paths for untracked files before a rebuild or afterMerge; refuses and keeps them (WSP-007/S27)
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [WSP-007/S9, WSP-007/S22, WSP-009/S1]
        reason: "spec impact PROP-123 reaches GRF-008..012, INS-002..004, LNT-019, PIP-001/008/021 and TKT-* only through cli.UsageError, which this change leaves as it is (WSP-007/S9 unchanged). WSP-009 is reached through workspace.Merge: generated-file conflicts in tracked files rebuild as before; only an untracked file at a generated path refuses the merge, before the merge (S22) or at the recheck before the rebuild (S27)."
      - item: C2
        outcome: scenarios
        ids: [WSP-007/S20, WSP-007/S22]
        reason: Paths are repo-relative as git reports them. R4 also covers an untracked file inside a folder at a path the merge writes, and compares paths as git does in that repository (core.ignoreCase on a case-insensitive file system). No stored state, so no upgrade path; install layouts do not matter because the check reads git state only.
      - item: C3
        outcome: scenarios
        ids: [WSP-007/S26, WSP-007/S27, WSP-007/S23, WSP-006/S27]
        reason: "While the merge runs, after its first dirty check, someone creates an untracked file where the merge will write: at a path the branch adds, git refuses to merge over it (S26); at a generated path, merge checks again immediately before the generated rebuild and before afterMerge, refuses with workspace.BaseBranchDirty, undoes the merge and keeps the file (S27). A file created while the tests run is kept by the undo (S23). Merges are serialised by the merge lock (WSP-006/R7)."
      - item: C4
        outcome: invariant
        ids: [INV-002]
        reason: The ticket's branch, written by agents, decides which paths it adds, and the project's generated command or afterMerge decides what it rewrites; spec decides, from git's own view of the base checkout, and refuses any collision with a person's untracked file before anything writes there (S20, S26, S27).
      - item: C5
        outcome: scenarios
        ids: [WSP-007/S22, WSP-007/S20, WSP-007/S26, WSP-007/S27]
        reason: Where merge cannot know ahead what it will write (generated rebuilds, afterMerge), every generated path counts as written, so an untracked file there refuses the merge, before it (S22) and again just before the rebuild or afterMerge (S27); a collision at a branch path the first check could not see is refused when git reports it (S26).
      - item: C6
        outcome: scenarios
        ids: [WSP-007/S2, WSP-007/S21, WSP-006/S1, WSP-006/S27]
        reason: Tracked changes (modified, staged, deleted) refuse exactly as before, with the same message; a clean base merges as before.
      - item: C8
        outcome: scenarios
        ids: [WSP-007/S26, WSP-007/S25, WSP-007/S20]
        reason: "Checked with git 2.52.0 in a scratch repository: 'git merge --no-ff --no-commit' of a branch that adds docs/plan.md, with an untracked docs/plan.md in the base checkout, prints 'The following untracked working tree files would be overwritten by merge: docs/plan.md ... Aborting', exits 2, and leaves HEAD, the index, every tracked file and the untracked file as they were, with no merge in progress (no MERGE_HEAD). Also checked in a scratch copy of chat-mini with the worktree's current build: git status lists untracked files and leaves out ignored ones (node_modules/cache.bin merged), and an untracked file at a path the branch adds is refused today with 'main has uncommitted changes: docs/plan.md'. S27 relies on no git fact beyond untracked-file listing."
    documents: [WSP-007/S20, WSP-007/S22, WSP-007/S25]
    assumed:
      - new: How does merge know before it runs what the sync or format.Config.afterMerge output will write?
        value: "It counts the generated paths as written: the spec root's index.md, the pinned .spec/bin/ CLI, and every path format.Config.generated (or an old generatedGlobs) matches. An untracked file that afterMerge writes elsewhere is not predicted; the afterMerge commit still leaves out every untracked file that was there before the merge."
      - new: What does the refusal say when an untracked file is in the way?
        value: "The same workspace.BaseBranchDirty line, '<base> has uncommitted changes: <paths>', listing it with the tracked changes, the first five in sorted order; when git finds it during the merge (S26) the line names the paths git names, and at the recheck (S27) the untracked files found at generated paths."
      - new: Is a file created while the merge runs kept out of the afterMerge commit?
        value: Only untracked files from before the merge are promised to stay out of it, and any untracked file at a generated path when afterMerge is about to run refuses the merge (S27); a refused merge keeps any file created meanwhile (S23).
      - new: When the recheck before afterMerge refuses, what happens to a merge whose commit and tests already passed?
        value: It is undone completely as WSP-006/R1 and R7 say (the base branch moved back, or left for a person when it moved meanwhile), and afterMerge does not run.
    duration_s: 74
  - at: 2026-11-03T22:29:30.998Z
    role: spec-review
    result: done
    summary: Generated-path rechecks address the reported race; no blocking issue remains.
    verdict: approve
    assumed: []
    duration_s: 45
  - at: 2026-11-04T07:06:49.175Z
    role: tester
    result: done
    summary: Tests for WSP-007/S19-S27 added in tests/cli/merge-untracked.test.ts; S19/21/23/24/26/27 fail now, S20/22/25 pass
    verdict: null
    mutations:
      - scenario: WSP-007/S19
        wrong: keeps refusing on every untracked file instead of only those at a path the merge writes
      - scenario: WSP-007/S20
        wrong: ignores untracked files completely, so an untracked docs/plan.md the branch adds is no longer refused and git or the merge overwrites it
      - scenario: WSP-007/S21
        wrong: lists the untracked notes.md with the tracked changes, or drops staged or deleted tracked files from the refusal
      - scenario: WSP-007/S22
        wrong: only checks paths the branch adds, so an untracked file at a generated glob path does not refuse the merge
      - scenario: WSP-007/S23
        wrong: undoes a refused merge with reset --hard or git clean, deleting the untracked T3_CODE_ANALYSIS.md or the scratch.md made while the tests ran
      - scenario: WSP-007/S24
        wrong: the afterMerge commit runs git add -A and commits the untracked T3_CODE_ANALYSIS.md along with tools/spec.cjs
      - scenario: WSP-007/S25
        wrong: counts ignored files such as node_modules/cache.bin as untracked and refuses the merge
      - scenario: WSP-007/S26
        wrong: checks for untracked files once up front and, when git refuses to merge over a file created later, reports 'conflicts in the tree; a person must merge it' instead of BaseBranchDirty naming docs/plan.md
      - scenario: WSP-007/S27
        wrong: checks untracked generated paths only once before the merge, so a file created later at a generated path is overwritten by the rebuild or the afterMerge run instead of refusing and undoing the merge
    assumed:
      - new: S27 gives the generated command as 'npm run build --silent'; may a test use a logging script command to show it did not run?
        value: "Yes: the tests use a script outside the repo that logs each run, and assert zero runs; the behaviour checked is the same."
      - new: "S27 races are created without a hook: may the test inject the file by wrapping spawnSync around 'git merge --no-commit' (before it for S26, after it for S27)?"
        value: Yes, the same wrapping advance-check-could-not-run.test.ts uses; the tests rely on the git call keeping the 'merge' and '--no-commit' arguments.
      - new: Does the S27 recheck before afterMerge need its own test, since S27's text names only the rebuild?
        value: "Yes, one extra S27 test: the test command creates an untracked file at a generated path, and merge must refuse with BaseBranchDirty naming it, not run afterMerge, and undo the merge completely (WSP-007/R4, spec-writer assumption on the afterMerge recheck)."
      - new: Which ticket IDs do the tests use, since the scenarios name TASK-101, TASK-103, TASK-105 and TASK-112?
        value: All tests use TASK-101 from the chat-mini fixture; stdout and the afterMerge commit subject use that ID.
      - new: S25 names node_modules/cache.bin, but copies of the fixture link node_modules to this repository's
        value: The test replaces the link with a real ignored folder in the copy, so nothing is written into the real node_modules.
    duration_s: 31033
  - at: 2026-11-04T07:29:22.950Z
    role: implementer
    result: done
    summary: Merge refuses on untracked files only where it writes (branch adds, generated paths, rechecks); keeps others
    verdict: null
    assumed:
      - new: Which generated paths does the untracked check use?
        value: "Those R4 lists: the spec root's index.md, .spec/bin/, and every generated.globs / generatedGlobs match; the legacy .claude/skills/<skill>/scripts/ and _generated/ folders are not counted, though isGenerated treats them as generated"
      - new: Where does the recheck before afterMerge run?
        value: After the tests pass and before the ticket's worktree is removed, and only when afterMerge is set, so a refusal undoes the merge with the worktree still there
      - new: Which config does the recheck before the rebuild use?
        value: The merged config (mergedWorkspace), so a glob the incoming side adds counts
    duration_s: 1351
  - at: 2026-11-04T07:30:53.240Z
    role: reviewer
    result: done
    summary: Merge conflict checks preserve unrelated untracked files and protect generated paths
    verdict: approve
    assumed: []
    duration_s: 85
---
Seen 2026-11-04 on astro: `spec merge PROP-001` was refused with 'main has uncommitted changes: T3_CODE_ANALYSIS.md, design/options/...' although those were only untracked notes and design mockups the ticket's branch never touches; the person had to stash them for every merge. Wanted: the dirty-base refusal (WSP-007) counts modified, staged and deleted tracked files as today, but an untracked file blocks the merge only when the ticket's branch (or the sync/afterMerge output) would create a file at that same path. Untracked files elsewhere are left exactly as they are, before and after the merge, including when the merge is refused and undone. Ignored files never count.
