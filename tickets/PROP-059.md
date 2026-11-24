---
id: PROP-059
type: proposal
title: Ticket advance reuses check-report's test run on the same tree
status: done
stage: null
touches: [PIP-008]
violates: []
depends_on: []
changed: [PIP-006, PIP-006/R5, PIP-006/R13, PIP-006/S37, PIP-006/S38, PIP-006/S39, PIP-008, PIP-008/R12, PIP-008/S25, PIP-008/S26]
questions: []
history:
  - at: 2026-10-31T00:03:49.077Z
    role: spec-writer
    result: done
    summary: Tester's check runs testCommand once per checked scenario via {filter}; full run when it cannot filter
    verdict: null
    assumed:
      - new: What does the tester's check run when testCommand has no {filter}?
        value: One run over every test, as today (most reversible)
      - new: Which scenarios does a bug's tester check run?
        value: The scenarios the bug violates, one run each, so R2 still sees their results
      - new: How do R1 (a test for every in-scope scenario) and R4 (no test names a missing scenario) keep working without a full run?
        value: They read every test the filtered runs report, skipped ones included (vitest lists them as skipped); when the runs list only the selected tests, as dart --name does, the check makes one more run over every test and reads that
      - new: How are several runs' results combined?
        value: Each test counts once; a passed or failed result wins over skipped
    duration_s: 549
  - at: 2026-10-31T00:15:11.409Z
    role: tester
    result: done
    summary: Tests for S37-S39 record each test-command run's filter; all three fail on today's single full run
    verdict: null
    assumed: []
    duration_s: 682
  - at: 2026-10-31T00:25:47.400Z
    role: implementer
    result: done
    summary: The tester's check now runs the test command once per added, changed or violated scenario through {filter}, merges the runs, and falls back to one full run when it cannot filter.
    verdict: null
    assumed: []
    duration_s: 635
  - at: 2026-10-31T00:33:59.847Z
    role: reviewer
    result: done
    summary: "Three false tester approvals: unselected scenario tests, discarded failures and incomplete test inventories."
    verdict: changes
    findings:
      - cites: [PIP-006/R8, PIP-006/S23, PIP-006/R13, PIP-011/S4, PIP-011/S5]
        text: "src/io/test-command.ts:18 and spec/modules/pipeline/features/PIP-006-test-first-checks.md:234: Literal scenario-ID filters leave supported identifier-style and grouped tests unselected. With real Vitest, test_PRV_001_S1_tokens threw TypeError on a full run but stayed skipped throughout the PRV-001/S1 and SET-001/S1 filtered runs. Another new scenario's assertion failure satisfied test-first, older skipped names prevented fallback, and checkReport returned ok:true; the full run was correctly refused under R8. Extend R13's fallback conditions or filtering contract so checked scenarios' supported naming forms actually run, and add a real-runner regression for this false approval."
        spec: true
      - cites: [PIP-006/R8, PIP-006/S23, PIP-006/R10, PIP-006/S34, PIP-006/R13]
        text: "src/core/test-report.ts:200: Merging by title and keeping the first non-skipped result discards failures from distinct tests with identical titles, including within one run. This suite already contains 18 repeated scenario titles. A passing copy followed by a TypeError copy loses the error; with another new scenario failing an assertion, the tester then passes. I reproduced the raw check refusing the TypeError and the merged check returning no problems. Preserve distinct tests or merge conservatively so failures and error metadata survive; cover passing-then-error and assertion-then-error duplicates."
      - cites: [PIP-006/R13, PIP-006/R4, PIP-006/S7, PIP-006/R1, PIP-006/S39]
        text: 'spec/modules/pipeline/features/PIP-006-test-first-checks.md:234 and src/io/test-command.ts:20: One reported name outside the checked scenarios cannot establish a complete test inventory. A selected-only runner can also select a helper whose title contains the filter. In a real Node/JUnit reproduction, filtering ALP-001/S1 reported its failing test and "helper for ALP-001/S1", so the full-run fallback was suppressed while "ALP-001/S9 Ghost" went unseen. The filtered tester check passed; the full check correctly refused that stray scenario. Require a known-complete inventory or conservative full fallback when completeness is uncertain, and test a partial report with an incidental extra name.'
        spec: true
    assumed: []
    duration_s: 491
  - at: 2026-10-31T00:36:26.323Z
    role: spec-writer
    result: done
    summary: Withdrew filtered tester runs (PIP-006 back to main); advance reuses check-report's test run on the same tree
    verdict: null
    assumed:
      - new: Where is check-report's test run kept?
        value: spec/test-runs/<ID>.json in the repository's common git directory, one per ticket, replaced by each check-report run that gives results
      - new: What counts as the same tree?
        value: HEAD commit plus the content of every path differing from HEAD (staged, unstaged, deleted) and every untracked path git does not ignore; ignored files are not compared
      - new: What does advance print when it reuses a run?
        value: "A first stderr line 'tests: reused the run spec check-report made at <time> on this tree'; stdout and pipeline.Advanced unchanged"
      - new: Is a kept run that gave no results, or one for another role, reused?
        value: "No: only runs with results are kept, and any mismatch or unreadable file runs the tests again; the kept run is deleted once advance has looked at it"
      - new: Are checkCommands reused too?
        value: No, only the test run; checkCommands run again in advance
    duration_s: 146
  - at: 2026-10-31T00:44:28.453Z
    role: tester
    result: done
    summary: Tests for PIP-008/S25 and S26 count test-command runs across check-report and advance; both fail now. Deleted the withdrawn tester-filtered-runs test with git rm
    verdict: null
    assumed: []
    duration_s: 481
  - at: 2026-10-31T00:59:41.475Z
    role: implementer
    result: done
    summary: Removed the filtered tester runs; check-report now keeps its test run keyed by ticket, role and tree, and ticket advance reuses it on an exact match, says so on stderr, and always deletes it.
    verdict: null
    assumed: []
    duration_s: 912
  - at: 2026-10-31T01:09:28.199Z
    role: reviewer
    result: done
    summary: Unsafe cache matches and superseded runs can approve stages; specify the failing-implementer retry exception.
    verdict: changes
    findings:
      - cites: [PIP-008/R12, PIP-008/S26, PIP-006/R5]
        text: "src/io/test-run-store.ts:30-44: Tracked paths from git diff are repository-relative, but treeKey reads them relative to the project root. For a supported nested project packages/app, packages/app/service.txt is therefore read as packages/app/packages/app/service.txt and hashed as deleted. I reproduced changing an already-dirty tracked file from passing to broken: both tree keys were identical, takeTestRun returned the cached pass, and a fresh full run failed. Normalize both tracked and untracked paths against one consistent Git root before hashing, and add a nested-project regression."
      - cites: [PIP-008/R12, PIP-008/S10, PIP-006/R5, PIP-006/S9]
        text: "src/io/test-run-store.ts:56 and src/cli/report.ts:65-67: A newer failed check can leave an older passing run reusable. After a passing check-report, a second check on the same tree that produces no report returns before invalidating the old file. I reproduced the second check being refused while advance's checker accepted the earlier pass. The finish-hook path in src/cli/claude-code.ts:93 also calls checkStage without the cache mode, so even a newer ordinary test failure leaves that older pass active; that bypass was reproduced too. Every fresh checking entry point should replace or invalidate the preceding entry, including on no-results outcomes. Cover pass-then-no-results and pass-then-finish-hook-failure."
      - cites: [PIP-008/R12, PIP-008/S25, PIP-006/R5]
        text: "src/io/test-run-store.ts:18-20 and 82-88: The common-directory cache identifies a ticket only by its ID, role and tree, without identifying the project/spec or test command. Two projects in one repository can each have TASK-101 in its implementer stage and share the same HEAD/tree key while running different suites. I reproduced project A's passing check being reused by project B: advance's checker accepted B, while B's fresh full run failed. Include the project/spec and test-command identity in the reusable context and reject a different context even when the ticket IDs and tree hashes coincide."
      - cites: [PIP-008/R12, PIP-008/S25]
        text: "src/io/test-run-store.ts:87: The deliberate failing-implementer exception conflicts with S25's unconditional promise that an exact-match kept run is reused and the stage is refused or recorded as check-report found it. The code instead deletes that failing run and retries the suite; I reproduced the same-tree advance check passing after the cached check had failed. The conservative retry is reasonable: retain it, but describe the exception in R12 and S25 and add a failing-implementer scenario/test so the extra run and retry-dependent outcome are specified."
        spec: true
    assumed: []
    duration_s: 586
  - at: 2026-10-31T01:10:55.489Z
    role: spec-writer
    result: done
    summary: Tightened PIP-008/R12 so reuse is keyed on spec root, ticket, role, test command and git tree; every check replaces the run
    verdict: null
    assumed:
      - new: Does a kept run survive advance now that advance keeps its own run?
        value: "Yes: advance, like every check, deletes the kept run and then keeps the run it checked (the reused one included) when it gave results; S25 no longer says the file is deleted"
      - new: What does the reuse line say, now that the run may come from the finish hook or advance?
        value: "tests: reused the test run made at <time> on this tree (no longer names spec check-report)"
      - new: Where is the run kept when two spec roots share a ticket ID?
        value: Still one file per ticket ID; the spec root in its context stops a wrong reuse, at the cost of one project's run replacing the other's
    duration_s: 86
  - at: 2026-10-31T01:20:27.869Z
    role: tester
    result: done
    summary: Reworked the PIP-008 S25/S26 tests for the new R12 and added regressions for subfolder spec roots, superseded runs, other spec roots and failed runs; five fail on the current code
    verdict: null
    assumed: []
    duration_s: 572
  - at: 2026-10-31T01:31:24.659Z
    role: implementer
    result: done
    summary: The kept test run is keyed by git's tree object plus spec root, ticket, role and test command; every done tester or implementer check, the finish hook and advance included, deletes it then keeps its own run, and a failed implementer run is never reused.
    verdict: null
    assumed: []
    duration_s: 656
  - at: 2026-10-31T01:35:54.966Z
    role: reviewer
    result: done
    summary: All four round-2 findings are fixed; the prior reproductions now reject stale and cross-project runs.
    verdict: approve
    assumed: []
    duration_s: 269
---
Self-hosting finding P33. `check-report` runs the project's whole test command for a done tester as well as for a done implementer, and `ticket advance` runs it again. In this repository that is about 1280 tests, and with four ticket worktrees running suites at once each run takes 3–5 minutes, so recording a stage and starting the next one took 5–10 minutes. The tester's check only needs the tests of the new or changed scenarios: each must fail, or pass when listed under `documents:` or under the rerun rule, and none may fail by an error. Run just those, as `spec test <scenario ID>` selects them, plus checkCommands. The implementer's check and `spec merge` still run every test.

Design changed after review (2026-10-31). The filtered tester runs (PIP-006/R13, S37–S39) approved stages they should refuse. Three cases: a test named in identifier style (`test_PRV_001_S1_…`) is never selected by the literal ID filter; merging results by title drops an error when two tests share a title (this suite has 18 such repeats); and one stray name in a filtered report, such as a helper whose title holds the ID, passes for a complete inventory, so the full-run fallback is skipped. Filtering by ID cannot be made safe in general, so that design is withdrawn: PIP-006 is back as it is on main, and every check runs every test.

Instead the duplicate run goes. `check-report` runs the full suite (188 s here), then `ticket advance` runs it again on the same tree, so every stage pays twice. Now every check of a done tester or implementer stage (`check-report`, the finish hook, advance) deletes the kept run in `spec/test-runs/<ID>.json` in the repository's common git directory. It then keeps its own run if that run gave results, so a later check never leaves an earlier pass behind. The run is kept with its context: the spec root's absolute path, the ticket, the role, the exact test command, and the tree. The tree is git's tree object for the working tree, written from a temporary index that stages every tracked change and every untracked non-ignored file. Advance reuses the run only when the whole context matches. A failed implementer run is kept but never reused. Anything else, including a file it cannot read, runs the tests again. Advance still runs checkCommands and reports a reuse on stderr: "tests: reused the test run made at <time> on this tree" (PIP-008/R12, S25, S26).

Review round 2 tightened this: two projects in one repository can share a ticket ID, so the context includes the spec root and the test command. HEAD plus a diff was replaced by git's own tree object, so a project in a subfolder is compared correctly. Every entry point now replaces the kept run.
