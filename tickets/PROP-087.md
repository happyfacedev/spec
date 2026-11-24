---
id: PROP-087
type: proposal
title: A dangling symlink under spec/ is a lint error, not a crash
status: done
stage: null
touches: [LNT-001]
violates: []
depends_on: [PROP-085]
changed: [LNT-019, LNT-019/R1, LNT-019/S1, LNT-019/S2, TKT-001/R7, WSP-006/S4, lint.RuleCode]
questions: []
history:
  - at: 2026-11-01T04:16:31.423Z
    role: spec-writer
    result: done
    summary: A dangling symlink under spec/ is one L037 lint error naming its path; LNT-019/S1 pins it
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [LNT-001/S1, LNT-001/S3]
        reason: impact reaches lint.Lint and lint.Report and every re-verify feature; a tree with no dangling symlink takes the same path, so their scenarios still hold
      - item: C2
        outcome: scenarios
        ids: [LNT-019/S1, LNT-001/S1]
        reason: the shown case is a symlink in a module folder with a missing target; R1 covers any target form; LNT-001/S1 shows a tree with no symlink still lints clean; platforms and install layouts are not pinned because the rule states no platform behaviour
      - item: C3
        outcome: na
        ids: []
        reason: lint reads the spec tree once in one process; no state is shared across an await or a process boundary
      - item: C4
        outcome: na
        ids: []
        reason: a symlink under spec/ is committed repo content, trusted as every spec file is; the change adds no input that crosses a boundary
      - item: C5
        outcome: scenarios
        ids: [LNT-019/S1]
        reason: an entry that cannot be read is an error with exit 1, never a silent pass
      - item: C6
        outcome: scenarios
        ids: [LNT-001/S1, LNT-001/S3, LNT-001/S4]
        reason: a clean spec exits 0, an error without a unit prints its three lines, and warnings alone pass, all unchanged
      - item: C8
        outcome: na
        ids: []
        reason: "no other tool or service is cited; the one platform fact the scenario depends on was checked by running spec lint on a scratch copy with a dangling symlink at spec/modules/x/broken.md: internal error, ENOENT on stat, exit 2"
    assumed:
      - new: "Rule code and feature: the ticket touches LNT-001, but a new rule takes the next free code and its own feature, as LNT-004 to LNT-018 do"
        value: L037 and LNT-019
      - new: "Scenario path: modules/x has no _module.md and would add a second L001 to the exact findings list"
        value: modules/alpha/broken.md in the base spec
      - new: Other commands on the same tree (queue, show) are not pinned, since the ticket allows one scenario
        value: not pinned here; a second scenario would be needed to pin them
      - new: Unreadable entries other than a dangling symlink appear in R1's wording only; no scenario shows them
        value: included in R1
      - new: Exact message and fix text of the finding
        value: as LNT-019/S1
    duration_s: 244
  - at: 2026-11-01T04:17:32.210Z
    role: spec-review
    result: done
    summary: Lint case is clear; the promised recovery of other commands needs a small acceptance check
    verdict: changes
    findings:
      - cites: [LNT-019/R1, LNT-019/S1]
        text: The ticket requires the loader to skip the unreadable entry so other commands keep working, but S1 exercises only lint and R1 describes only its finding. The C1 citations LNT-001/S1 and S3 cover ordinary lint runs, not this interaction. A lint-only fix could satisfy every new assertion while queue and show still crash on this same plausible tree. Pin successful operation of representative non-lint commands (queue and show of an unaffected unit) on the dangling-symlink tree; no exhaustive command matrix is needed. The writer's assumption that these may remain unpinned drops an explicit part of the ticket.
        class: C1
    assumed: []
    duration_s: 59
  - at: 2026-11-01T04:35:49.127Z
    role: spec-writer
    result: done
    summary: A dangling symlink under spec/ is one L037 error; queue and show still run, pinned by LNT-019/S2
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [LNT-019/S2, LNT-001/S1, LNT-001/S3]
        reason: "the review finding is met: queue and show of an unaffected unit succeed on the dangling-symlink tree (LNT-019/S2); the other features spec impact reaches read no symlink, so their scenarios LNT-001/S1 and S3 still hold"
      - item: C2
        outcome: scenarios
        ids: [LNT-019/S1, LNT-019/S2, LNT-001/S1]
        reason: the shown case is a symlink in a module folder with a missing target; R1 covers any target form; LNT-001/S1 shows a tree with no symlink still lints clean; platforms and install layouts are not pinned because the rule states no platform behaviour
      - item: C3
        outcome: na
        ids: []
        reason: lint, queue and show each read the spec tree once in one process; no state is shared across an await or a process boundary
      - item: C4
        outcome: na
        ids: []
        reason: a symlink under spec/ is committed repo content, trusted as every spec file is; the change adds no input that crosses a boundary
      - item: C5
        outcome: scenarios
        ids: [LNT-019/S1]
        reason: an entry that cannot be read is an error with exit 1, never a silent pass
      - item: C6
        outcome: scenarios
        ids: [LNT-001/S1, LNT-001/S3, LNT-001/S4]
        reason: a clean spec exits 0, an error without a unit prints its three lines, and warnings alone pass, all unchanged
      - item: C8
        outcome: na
        ids: []
        reason: "no other tool or service is cited; the platform facts the scenarios depend on were checked by running the current build on a scratch copy with a dangling symlink under spec/modules/lint/: spec queue and spec show LNT-018 both fail with an internal error, ENOENT on stat, show exit 2"
    assumed:
      - new: "Rule code and feature: the ticket touches LNT-001, but a new rule takes the next free code and its own feature, as LNT-004 to LNT-018 do"
        value: L037 and LNT-019
      - new: "Scenario path: modules/x has no _module.md and would add a second L001 to the exact findings list"
        value: modules/alpha/broken.md in the base spec
      - new: Other commands beyond queue and show (for example brief, gate, gaps) are not pinned on this tree; the review asked for representative commands only
        value: queue and show pinned by LNT-019/S2; the rest not pinned
      - new: Unreadable entries other than a dangling symlink appear in R1's wording only; no scenario shows them
        value: included in R1
      - new: Exact message and fix text of the finding
        value: as LNT-019/S1
    duration_s: 1095
  - at: 2026-11-01T04:36:20.574Z
    role: spec-review
    result: done
    summary: "R1 and S2 address the finding: queue and show succeed on the dangling-symlink tree"
    verdict: approve
    assumed: []
    duration_s: 29
  - at: 2026-11-01T04:54:18.925Z
    role: tester
    result: done
    summary: "LNT-019 tests written: dangling symlink gives one L037 and exit 1; queue and show still run. Both fail now."
    verdict: null
    mutations:
      - scenario: LNT-019/S1
        wrong: reports the dangling link as a warning and exits 0
      - scenario: LNT-019/S2
        wrong: queue and show still read the link, so both exit 2 with an internal error
    assumed:
      - new: Test file for LNT-019
        value: tests/cli/lint-unreadable-scenarios.test.ts, beside the other LNT feature test files
      - new: Base spec for LNT-019/S1 and S2
        value: the plain LNT-001 base with no config change, as tests/cli/lint-link-scenarios.test.ts uses
    duration_s: 1076
  - at: 2026-11-01T05:07:08.610Z
    role: implementer
    result: done
    summary: Loader skips unreadable spec entries; lint reports each as one L037 error; queue and show just skip it
    verdict: null
    assumed:
      - new: Fix text for an unreadable entry that is not a dangling symlink (R1 covers it, S1 shows only the symlink case)
        value: "message '<path> cannot be read: <system error>', fix 'make the entry readable, or remove it'"
    duration_s: 767
  - at: 2026-11-01T05:13:54.828Z
    role: reviewer
    result: done
    summary: Merge bypasses L037; --files suppresses it; shared loader also silently drops unreadable tickets
    verdict: changes
    findings:
      - cites: [LNT-019/R1, WSP-006/S4]
        text: src/cli/merge.ts:140-142 calls lintSpec on merged.spec, not cmdLint, and never includes merged.unreadable. A branch adding the otherwise harmless dangling link from S1 therefore has no L037 in merge's lint and can land with green tests, contrary to WSP-006/S4. Include unreadable-entry errors in merge validation and add a regression that refuses and rolls back this merge.
        tests: true
        class: C5
      - cites: [LNT-019/R1, lint.Lint.files]
        text: src/cli/commands.ts:93-94 filters L037 by --files, although lint.Lint.files enumerates the limited rules and excludes L037. A read-only cmdLint probe with an unreadable entry returns L037 under --ci, but --ci --files spec/modules/lint/contracts.md drops it and exits 0. Preserve L037 outside that existing per-file filter and cover this combination.
        tests: true
        class: C6
      - cites: [LNT-019/R1, TKT-001/R7]
        text: src/io/fs.ts:55-60 now silently swallows failures for every loadDir caller, even without a skipped collector. FileTicketStore.list and taken (src/io/ticket-store.ts:63,73) consequently omit unreadable ticket entries and their reserved IDs instead of failing. Ticket-store symlinks are explicitly outside LNT-019's scope; this changes their behavior without any diagnostic and can let allocation reuse an existing unreadable ticket's ID. Keep tolerant skipping confined to spec loading, preserving failure for other callers, and add a ticket-store regression.
        tests: true
        class: C5
    assumed: []
    duration_s: 404
  - at: 2026-11-01T05:26:31.087Z
    role: tester
    result: done
    summary: "Regressions for the three review findings: merge, --files and ticket store. All three fail now."
    verdict: null
    mutations:
      - scenario: WSP-006/S4
        wrong: merge lints only the readable entries of the merged spec, so a branch whose only change is a dangling link merges
      - scenario: LNT-019/S1
        wrong: --files drops L037 along with the per-file findings, so --ci --files exits 0
    assumed:
      - new: Wording of the ticket-store report
        value: the refusal or report says 'cannot be read' or 'unreadable' and names TASK-104, as LNT-019/R1 words it for spec entries
      - new: File for the --files regression
        value: spec/modules/alpha/contracts.md in the LNT-001 base, since the base has no spec/modules/lint/ module
      - new: Location of the ticket-store regression
        value: tests/cli/ticket-new.test.ts, beside the TKT-005 tests it mirrors
    duration_s: 752
    refusals: 1
  - at: 2026-11-01T05:46:48.053Z
    role: implementer
    result: done
    summary: Merge refuses on L037, --files keeps L037, only spec loading skips unreadable entries; ticket store names them
    verdict: null
    assumed:
      - new: codeFiles (L024 scan of the project root) also skips unreadable entries, since it walks spec/ and lint --ci would otherwise crash on the dangling link
        value: tolerant, unreadable entries skipped silently there; lint reports those under spec/ as L037
    duration_s: 1215
  - at: 2026-11-01T05:49:13.857Z
    role: reviewer
    result: done
    summary: The three fixes hold, but moving directory recursion outside the catch reintroduces unreadable-directory crashes
    verdict: changes
    findings:
      - cites: [LNT-019/R1]
        text: src/io/fs.ts:66 now calls walk(full) outside the per-entry try/catch. A directory under spec/ can stat successfully but deny readdir (EACCES); its failure at line 52 now escapes instead of recording one L037 at the directory's path. This is introduced by this round's recursion move, not the earlier implementation. A read-only probe injecting EACCES for spec/modules/lint confirmed loadDir throws with an empty skipped collector. It also defeats codeFiles' new tolerant scan, so lint --ci can still crash on an unreadable directory. Catch directory-enumeration failures at the affected entry while preserving throwing for non-collecting callers, and add a regression for this R1 case.
        tests: true
        class: C5
    assumed: []
    duration_s: 144
  - at: 2026-11-01T05:55:15.517Z
    role: tester
    result: done
    summary: "LNT-019/S1 directory regression: an unlistable spec directory must be one L037, not a crash. It fails now."
    verdict: null
    mutations:
      - scenario: LNT-019/S1
        wrong: the loader rethrows the EACCES from an unlistable directory, so lint and lint --ci exit 2 as an internal error
    assumed:
      - new: Test is skipped as root
        value: process.getuid() === 0 skips it, because root ignores the mode bits; this run is uid 501 and runs it
      - new: Message of the directory finding
        value: "checked only as starting 'modules/alpha/sub cannot be read: ', since LNT-019/R1 says the message says it cannot be read and does not fix the reason text"
    duration_s: 360
  - at: 2026-11-01T06:05:06.424Z
    role: implementer
    result: done
    summary: A directory that cannot be listed is recorded once as L037 at its own path; callers without a collector still throw
    verdict: null
    assumed: []
    duration_s: 589
  - at: 2026-11-01T06:05:42.416Z
    role: reviewer
    result: done
    summary: Directory enumeration failures are recorded once at their own path; strict callers still throw; regression passes
    verdict: approve
    assumed: []
    duration_s: 34
---
Found by PROP-085's tester. A symlink under spec/ whose target does not exist makes the spec loader crash with ENOENT on stat, before lint, the hooks or any other command can give a verdict. Every spec command run on that tree fails with an internal error. Change: the loader skips a dangling or unreadable entry under spec/, and lint reports it as an error naming the path and saying it cannot be read, so the person sees one clear finding.
