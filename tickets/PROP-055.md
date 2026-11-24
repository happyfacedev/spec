---
id: PROP-055
type: proposal
title: Merge and the stage sync rebuild a project's own generated files instead of stopping on their conflicts
status: done
stage: null
touches: [WSP-006, PIP-002]
violates: []
depends_on: []
changed: [FMT-002, FMT-002/R8, FMT-002/S17, INS-001, PIP-002, PIP-002/R6, PIP-002/S24, WSP-006, WSP-006/R2, WSP-006/S5, WSP-009, WSP-009/R1, WSP-009/R2, WSP-009/R3, WSP-009/S1, WSP-009/S2, WSP-009/S3, format.Config, format.Config.generated, format.GeneratedConfig, format.GeneratedConfig.command, format.GeneratedConfig.globs, workspace.GeneratedRebuildFails]
questions:
  - id: Q1
    kind: blocker
    text: "Tests needed before the fix: (1) a generated command that writes the conflicted file, another matching file and a new matching file, then exits 1: merge and sync leave no partial output, no MERGE_HEAD and no unrelated edit lost; (2) a successful rebuild that rewrites a non-conflicted matching file and creates a new one: both are in the merge or sync commit; (3) generated.command changed, added or removed on the incoming branch: classification and the command follow the merged config."
    default: null
    cites: [WSP-009/R2, WSP-009/R3, WSP-009/S2, WSP-009/S3]
    answer: "Yes: the tester adds these three regressions first, then the implementer fixes them."
    raised_by: implementer
history:
  - at: 2026-10-31T00:21:02.029Z
    role: spec-writer
    result: done
    summary: Config key generated (globs, command) lets merge and the stage sync rebuild a project's generated files (WSP-009)
    verdict: null
    assumed:
      - new: Which side does a conflicted project generated file take before its command runs?
        value: The side being merged in (the branch in a merge, the base in a sync), as for spec's own generated files
      - new: Does the generated command run when none of its files conflicted?
        value: "No: only on a conflict in a file its globs match, as spec rebuilds a conflicted index.md only"
      - new: Should a generated command that fails in the stage-start sync block the ticket?
        value: "No: the sync is aborted and the start refused, the ticket as it was, as a spec rebuild that fails in the sync does today"
      - new: Should this repository's spec/config.json name src/generated/** now?
        value: "Not in this stage: the current build refuses the unknown key; set it to {globs: [src/generated/**], command: npm run build --silent} once the code lands"
    duration_s: 336
  - at: 2026-10-31T01:44:27.753Z
    role: tester
    result: done
    summary: Tests for FMT-002/S17, WSP-009 S1-S3 (R2, R3), WSP-006/S5 and PIP-002/S24 clauses; all fail on today's code
    verdict: null
    assumed:
      - new: "WSP-009/R2: is the not-run-without-conflict half tested?"
        value: Yes, as an extra test named WSP-009/R2; it fails now only because the config key is refused
      - new: Where do the WSP-006/S5 and PIP-002/S24 generated-file clauses live?
        value: In tests/cli/generated-files.test.ts, beside WSP-009, as extra tests with those scenario IDs
    duration_s: 319
  - at: 2026-10-31T02:02:02.928Z
    role: implementer
    result: done
    summary: Added format.Config.generated and a once-run rebuild command on conflict in merge and the stage-start sync.
    verdict: null
    assumed: []
    duration_s: 1054
  - at: 2026-10-31T02:06:41.374Z
    role: reviewer
    result: done
    summary: Rebuilds need transactional rollback, complete output staging, and the merged generated configuration.
    verdict: changes
    findings:
      - cites: [WSP-009/R3, WSP-009/S2, WSP-009/S3, WSP-006/R1, workspace.GeneratedRebuildFails]
        text: "[P1] Restore partial rebuild output before aborting. src/cli/generated.ts:50-53 returns immediately on command failure, leaving its writes for src/cli/merge.ts:112-115 and src/cli/tickets.ts:209-210 to undo with git alone. Reproduced with a command that rewrites the conflicted assets.ts, a non-conflicted generated secondary.ts, and a new generated file before exiting 1: merge leaves MERGE_HEAD and unresolved entries when secondary.ts was auto-merged; sync leaves partial secondary.ts and the new file behind. Restore the rebuild's output delta and verify abort succeeds, while preserving unrelated edits. Cover failure after writing files; the current failure fixture exits before any generated file is written."
      - cites: [WSP-009/R2, WSP-009/S3, INV-002]
        text: "[P1] Commit every generated output written by a successful rebuild. src/cli/generated.ts:56 stages only the originally conflicted paths; the callers stage only spec-generated files and agents. Reproduced a successful merge and sync where the command rewrites assets.ts and secondary.ts and creates new.ts under the configured globs: both return 0, but HEAD retains the old secondary.ts and excludes new.ts, leaving both uncommitted. Tests consequently run against output absent from the merge commit. Stage all matching generated output changes, including additions and deletions, without sweeping unrelated work into the commit."
      - cites: [WSP-009/R1, WSP-009/R2, PIP-002/R6, format.GeneratedConfig.command]
        text: "[P2] Use the merged generated configuration for classification and rebuilding. src/cli/generated.ts:48-50 reads ws.config even though line 40 already loaded the merged workspace; merge.ts:129 and tickets.ts:200 also classify conflicts with the pre-merge workspace. Reproduced updating generated.command on the incoming branch: merge and sync both succeed using the obsolete command and commit its output instead of the output required by the merged config. Removing generated on the incoming branch still runs the removed command and automatically resolves its conflicts. Resolve the effective merged config before classifying conflicts and selecting the command, and cover changed, added, and removed generated settings."
    assumed: []
    duration_s: 278
  - at: 2026-10-31T02:06:52.223Z
    role: implementer
    result: blocked
    summary: "Review findings need failing tests first: rebuild failing after writes, extra generated outputs, generated config changed on the branch"
    verdict: null
    assumed: []
    duration_s: 10
  - at: 2026-10-31T02:06:52.708Z
    role: tester
    result: reopened
    summary: reopened by PROP-055#Q1
    verdict: null
    assumed: []
  - at: 2026-10-31T02:11:41.568Z
    role: tester
    result: done
    summary: Regressions for partial writes after a failed rebuild, uncommitted extra outputs, and the merged config; 6 of 8 fail now
    verdict: null
    assumed:
      - new: Do the two sync variants of the merged-config defect fail on the branch?
        value: "No: they pass on the current code and stay as guards; only the merge variants fail"
    duration_s: 288
  - at: 2026-10-31T02:20:02.132Z
    role: implementer
    result: done
    summary: Failed rebuilds restore generated paths, successful ones stage all globbed changes, and the merged config decides.
    verdict: null
    assumed: []
    duration_s: 500
  - at: 2026-10-31T02:22:18.930Z
    role: reviewer
    result: done
    summary: "Verified all three fixes in merge and sync: rollback, complete output commits, and merged-config selection."
    verdict: approve
    assumed: []
    duration_s: 136
---
Self-hosting finding P31. This repository's src/generated/assets.ts is built by `npm run build` from the role and skill templates, so any two tickets that change templates conflict in it. WSP-006/R2 and PIP-002/S24 rebuild only spec's own generated files (index.md, _generated/, compiled agents, the bundled CLI); a conflict in assets.ts stopped PROP-042's merge for a person, who took either side and ran the build. Let a project name its own generated paths (for example in config.json) so that a conflict there takes either side and the project's build rewrites them before the tests run, in `spec merge` and in the stage-start sync. The spec-writer decides how the paths are declared and which command rebuilds them.
