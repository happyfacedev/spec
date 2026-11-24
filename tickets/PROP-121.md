---
id: PROP-121
type: proposal
title: Code pointer checks read only code files git does not ignore
status: done
stage: null
touches: [ADP-004, LNT-003]
violates: []
depends_on: []
changed: [ADP-004, ADP-004/R1, ADP-004/R2, ADP-004/R3, ADP-004/S1, ADP-004/S2, ADP-004/S3, ADP-004/S4, ADP-004/S5, ADP-004/S6, ADP-004/S7, ADP-004/S8, ADP-004/S9, ADP-004/S10, ADP-004/S11, ADP-004/S12, ADP-004/S13, ADP-004/S14, ADP-004/S15, LNT-003, LNT-003/R3, LNT-003/S29, LNT-003/S30]
questions:
  - id: Q1
    kind: blocker
    text: "tests/dist.test.ts needs the generated bundle (plugin/scripts/spec.cjs, dist/) rebuilt by spec/config.json generated.command `npm run build --silent`, because src/cli/adopt.ts and src/io/fs.ts changed. Failing: 'build output matches committed plugin files without rewriting them', 'builds the marketplace manifest, plugin manifest, bundles and skills', 'INS-014/S3 The plugin bundle is built and committed'. My allowed shell commands do not include npm run build, and the bundle is not hand-editable. Run `npm run build` in the worktree (previous tickets committed the rebuilt plugin/scripts/spec.cjs), then re-run check-report. Its changes are kept in git stash \"PROP-121 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites: [INS-014/S3]
    answer: "Run the build yourself in the worktree: npm --prefix /Users/alexpavelm/dev/happyface/spec.worktrees/PROP-121 run build (run it from the project root with --prefix, as you did for lint and typecheck; it is the generated.command). Earlier implementers (PROP-108, PROP-109, PROP-110) committed the rebuilt plugin/scripts/spec.cjs and bundle files in their stage the same way. Then rerun only tests/dist.test.ts and check-report."
    raised_by: implementer
history:
  - at: 2026-11-02T10:33:50.931Z
    role: spec-writer
    result: done
    summary: Code-pointer check reads only code-glob files Git does not ignore, filtered by path before reading (ADP-004, LNT-003)
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [ADP-001/S8, LNT-002/S1, LNT-018/S1, LNT-019/S1, LNT-003/S8, LNT-003/S9]
        reason: spec impact reaches only lint features through lint.Report.findings. Only the choice of code files read for L024 changes, so their scenarios stay true unchanged, and LNT-003/S8 and S9 still hold under the reworded R3
      - item: C2
        outcome: scenarios
        ids: [ADP-004/S12, ADP-004/S13, ADP-004/S14]
        reason: "Covers no Git work tree, Git missing from the PATH, and a project root nested inside a larger work tree with paths relative to the project root. Symlinks are not pinned: a listed symlink is read through its target, and one that cannot be read is skipped as today"
      - item: C3
        outcome: na
        ids: []
        reason: The check is a single read-only pass in one process. No state is shared across an await or a process boundary
      - item: C4
        outcome: na
        ids: []
        reason: Code globs, .gitignore and the files all belong to the project owner who runs the command. Nothing crosses a trust boundary, and a forged ignore rule only hides files from the owner's own check
      - item: C5
        outcome: scenarios
        ids: [ADP-004/S13, ADP-004/S15]
        reason: If Git cannot list files, the check falls back to the walk the ticket names. A listed file that is gone from disk is skipped and the pointer is reported, not crashed on
      - item: C6
        outcome: scenarios
        ids: [ADP-004/S1, ADP-004/S5, ADP-004/S6, ADP-004/S10, ADP-004/S12, LNT-003/S7, LNT-003/S8, LNT-003/S9]
        reason: Tracked and untracked unignored files still count, test globs still exclude, empty code globs still skip the check, and outside Git the walk behaves as today
      - item: C8
        outcome: scenarios
        ids: [ADP-004/S9, ADP-004/S10, ADP-004/S15]
        reason: Ran `git ls-files --cached --others --exclude-standard -- src` in a scratch repo. It listed the untracked unignored src/new.ts and the tracked but deleted src/old.ts, and left out the ignored src/generated/ and node_modules
    documents: [ADP-004/S10, ADP-004/S12, ADP-004/S13, ADP-004/S15]
    assumed:
      - new: Do files inside a Git submodule count as code?
        value: No. The ticket names `git ls-files --cached --others --exclude-standard` without recursion, which lists a submodule only as an entry and not its files
      - new: In a Git work tree, does a tracked file under a folder named node_modules count?
        value: Yes. Git lists it, and R1 counts every file Git lists that matches the globs. The node_modules skip applies only to the walk outside Git (R2)
      - new: How large is the ignored tree in ADP-004/S11 and LNT-003/S30?
        value: Larger than the memory the command runs with. The tester picks the file count, the sizes and the memory limit
    duration_s: 309
  - at: 2026-11-02T10:34:45.205Z
    role: spec-review
    result: done
    summary: Resolve the fallback walk's conflict over node_modules before tests are written
    verdict: changes
    findings:
      - cites: [ADP-004/S12, ADP-004/R2, LNT-003/R3]
        text: R2 says the fallback walk skips every node_modules folder, but S12 explicitly expects src/node_modules/lib/stream.ts to count outside Git. Reconcile which behavior applies; LNT-003/R3 inherits the same contradictory code-file definition.
        class: C9
    assumed: []
    duration_s: 48
  - at: 2026-11-02T10:35:46.974Z
    role: spec-writer
    result: done
    summary: Spell out that the fallback walk skips node_modules in ADP-004/S12 and LNT-003/R3 (spec review)
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [ADP-001/S8, LNT-002/S1, LNT-018/S1, LNT-019/S1, LNT-003/S8, LNT-003/S9]
        reason: spec impact reaches only lint features through lint.Report.findings. Only the choice of code files read for L024 changes, so their scenarios stay true unchanged, and LNT-003/S8 and S9 still hold under the reworded R3
      - item: C2
        outcome: scenarios
        ids: [ADP-004/S12, ADP-004/S13, ADP-004/S14]
        reason: "Covers no Git work tree (the walk skips node_modules and does not read .gitignore), Git missing from the PATH, and a project root nested inside a larger work tree with paths relative to the project root. Symlinks are not pinned: a listed symlink is read through its target, and one that cannot be read is skipped as today"
      - item: C3
        outcome: na
        ids: []
        reason: The check is a single read-only pass in one process. No state is shared across an await or a process boundary
      - item: C4
        outcome: na
        ids: []
        reason: Code globs, .gitignore and the files all belong to the project owner who runs the command. Nothing crosses a trust boundary, and a forged ignore rule only hides files from the owner's own check
      - item: C5
        outcome: scenarios
        ids: [ADP-004/S13, ADP-004/S15]
        reason: If Git cannot list files, the check falls back to the walk the ticket names. A listed file that is gone from disk is skipped and the pointer is reported, not crashed on
      - item: C6
        outcome: scenarios
        ids: [ADP-004/S1, ADP-004/S5, ADP-004/S6, ADP-004/S10, ADP-004/S12, LNT-003/S7, LNT-003/S8, LNT-003/S9]
        reason: "Tracked and untracked unignored files still count, test globs still exclude, and empty code globs still skip the check. Outside Git the walk behaves as today, which I checked by running today's build: the .gitignore'd file counts and src/node_modules/lib/v.ts does not"
      - item: C8
        outcome: scenarios
        ids: [ADP-004/S9, ADP-004/S10, ADP-004/S15]
        reason: Ran `git ls-files --cached --others --exclude-standard -- src` in a scratch repo. It listed the untracked unignored src/new.ts and the tracked but deleted src/old.ts, and left out the ignored src/generated/ and node_modules
    documents: [ADP-004/S10, ADP-004/S12, ADP-004/S13, ADP-004/S15]
    assumed:
      - new: Do files inside a Git submodule count as code?
        value: No. The ticket names `git ls-files --cached --others --exclude-standard` without recursion, which lists a submodule only as an entry and not its files
      - new: In a Git work tree, does a tracked file under a folder named node_modules count?
        value: Yes. Git lists it, and R1 counts every file Git lists that matches the globs. The node_modules skip applies only to the walk outside Git (R2)
      - new: How large is the ignored tree in ADP-004/S11 and LNT-003/S30?
        value: Larger than the memory the command runs with. The tester picks the file count, the sizes and the memory limit
    duration_s: 54
  - at: 2026-11-02T10:36:11.778Z
    role: spec-review
    result: done
    summary: The node_modules fallback behavior is now consistent across scenarios and rules
    verdict: approve
    findings:
      - cites: [ADP-004/R1, ADP-004/R2, ADP-004/S14]
        text: "Follow-up: symlinked code paths are not pinned: clarify whether matching uses the symlink path and whether reading follows its target."
        class: C2
    assumed: []
    duration_s: 23
  - at: 2026-11-02T10:58:43.485Z
    role: tester
    result: done
    summary: Tests for ADP-004/S1-S15 and LNT-003/S29-S30; S9, S11, S14, S29, S30 fail now, as expected
    verdict: null
    mutations:
      - scenario: ADP-004/S9
        wrong: reads every file under the code globs and ignores .gitignore, so an ignored src/generated/stream.ts counts
      - scenario: ADP-004/S10
        wrong: lists only tracked files (git ls-files without --others), so an untracked, unignored src/new.ts is never read
      - scenario: ADP-004/S11
        wrong: lists the files with Git but still loads the whole project tree, ignored build/ included, before filtering
      - scenario: ADP-004/S12
        wrong: outside a Git work tree the walk reads .gitignore and skips src/generated/, or it descends into src/node_modules/ and counts src/node_modules/lib/stream.ts
      - scenario: ADP-004/S13
        wrong: a failed git ls-files is treated as an empty file list, so every pointer is reported as not found
      - scenario: ADP-004/S14
        wrong: git ls-files paths are matched against the globs relative to the work tree root (app/src/stream.ts), so src/** matches nothing and the pointer is wrongly reported
      - scenario: ADP-004/S15
        wrong: a file Git lists but that is gone from disk makes the read throw, so the command crashes instead of reporting the pointer
      - scenario: LNT-003/S29
        wrong: the L024 check reads the code files without asking Git, so an ignored src/gen/widget.ts holds Widget.make and the warning is lost
      - scenario: LNT-003/S30
        wrong: the L024 check loads every file under the project before filtering by code globs, so the ignored build/ tree exhausts the heap
    assumed:
      - new: How large is the ignored tree in ADP-004/S11 and LNT-003/S30?
        value: 2000 files of 128 KB (about 250 MB) run in a child CLI process with --max-old-space-size=160, set through NODE_OPTIONS
      - new: Does LNT-003/S30's 'findings is empty' allow the L033 missing-hook warning the git fixture always gives under --ci?
        value: Yes. S30 expects exactly that one L033 warning, as LNT-003/S7 does
      - new: ADP-004/S1 to S8 had no tests in tests/, so I added them.
        value: Added a test for each, against the current behaviour, which all pass now
    duration_s: 1350
  - at: 2026-11-02T11:22:41.290Z
    role: implementer
    result: blocked
    summary: Code done (ADP-004, LNT-003 tests pass); 3 dist tests fail until npm run build regenerates the plugin bundle
    verdict: null
    assumed:
      - new: Does a path Git lists that is a directory (a submodule entry) count?
        value: "No: only regular files are read, so a submodule contributes nothing"
    duration_s: 1432
  - at: 2026-11-02T11:29:26.495Z
    role: implementer
    result: done
    summary: Code-pointer check lists files by path (git ls-files, or a node_modules-skipping walk) and reads only code-glob matches
    verdict: null
    assumed:
      - new: Does a path Git lists that is a directory (a submodule entry) count?
        value: "No: only regular files are read, so a submodule contributes nothing"
    duration_s: 396
  - at: 2026-11-02T11:31:36.812Z
    role: reviewer
    result: done
    summary: Diff meets ADP-004 and LNT-003; targeted tests pass
    verdict: approve
    assumed: []
    duration_s: 129
---
Seen on astro (2026-11-02): with codeGlobs ["apps/**", "packages/**", ...], `spec gaps --no-tests` and `spec lint --ci` both die with 'JavaScript heap out of memory' (exit 134). codeFiles (src/cli/adopt.ts:17) calls loadDir on the whole project root and reads every file into memory before filtering by codeGlobs, including about 21,000 gitignored files (packages/*/node_modules, apps/flutter-shell/build, .dart_tool, a vendored sidecar). Plain `spec lint` is fine because it skips the code check.

Wanted behaviour: the code-pointer check (ADP-004 for gaps, L024 in LNT-003 for lint --ci) only considers files that match codeGlobs and not testGlobs, and in a Git work tree only files Git tracks or that are untracked and not ignored (`git ls-files --cached --others --exclude-standard`). A file Git ignores never counts as code, even when it matches codeGlobs, and is never read. Files are filtered by path before any is read. Outside a Git work tree (or when Git cannot list files) the check keeps today's behaviour of walking the project, but still filters by path before reading. A project with a large ignored tree (for example node_modules with thousands of files under a code glob) completes the check.
