---
id: PROP-085
type: proposal
title: Governed-path checks see through symlinks that point outside the project
status: done
stage: null
touches: [INS-015]
violates: []
depends_on: [PROP-084]
changed: [INS-015/R1, INS-015/S1, INS-016/R14, INS-016/R15, INS-016/S12, INS-016/S13, INV-010, INV-011]
questions:
  - id: Q1
    kind: blocker
    text: syncing ticket/PROP-085 with main conflicts in spec/core/invariants.md; a person must merge
    default: null
    cites: []
    answer: "Merged main by hand: kept PROP-083's INV-009 and this ticket's INV-010 and INV-011."
    raised_by: spec-review
history:
  - at: 2026-11-01T02:55:04.498Z
    role: spec-writer
    result: done
    summary: Paths are governed by tree position, outside-pointing symlinks refused; .spec/bin governed via ticket or bypass only
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-016/S13, INS-016/S12, INS-015/S1]
        reason: "spec impact PROP-085 reaches no other feature. Checked by hand: INS-005/S21 (a Spec-Roles commit touching .spec/bin/spec.cjs is already an offender) stays true and INS-016/S13 repeats it; INS-014/S15 (afterMerge does not rewrite the pinned CLI) is unaffected, and S13 keeps .spec/bin/ as generated for the afterMerge child; INS-013 upgrade copying is unchanged (INS-016/S13 adds only the governed-files note on the base branch)."
      - item: C2
        outcome: scenarios
        ids: [INS-016/S12, INS-016/S13]
        reason: "Symlinks: absolute and relative targets, inside and outside the project, and governed and non-governed link locations are all covered (S12). The verdict comes from the Git index or tree path and mode, so it holds with core.symlinks false. Case: on macOS, staging Spec/case.md was recorded by Git as spec/case.md and refused today; R14 keeps classification on the path Git records. A project opened through /tmp (a symlink to /private/tmp) was governed today and still is (S12). Upgrading from an older state: unmarked .spec/bin commits after enforceSince become offenders (S13; see assumed). This repo has none: every first-parent .spec/bin change since f228f8c is a Spec-Ticket merge, and every side commit carries its ticket trailer."
      - item: C3
        outcome: na
        ids: []
        reason: "No new shared state: no marker or token is added. The only state that crosses a process boundary is the existing bypass state (INS-015/S6, S14). The one ordering fact, that pre-commit runs the working tree's pinned CLI after the commit replaced it, is stated in R15 and INV-010."
      - item: C4
        outcome: invariant
        ids: [INV-010, INV-011]
        reason: "Two inputs cross the boundary. (1) The bytes of .spec/bin, which any committer sets. A forged CLI can make its own checks say anything, so the CLI running verify-history decides, reads the commit's .spec/bin as data, and no trailer or marker inside the commit authorizes it (INV-010). (2) A symlink's target, which the stager sets. The tree path decides, the target is read as text and never followed on disk, and a target that leaves the project is refused (INV-011). I chose not to give upgrade a marker like PROP-068's combine marker or PROP-084's Spec-Roles marker: a trailer is content the commit controls, and a hash manifest cannot list bundles that change on every merge rather than per version."
      - item: C5
        outcome: scenarios
        ids: [INS-016/S12, INS-016/S13]
        reason: A symlink target that is absolute, leaves the project or loops is refused, even under a token or bypass (S12, R14). A removed .spec/bin file, or a .spec/bin change with no ticket or bypass evidence, is an offender (S13). A missing pinned CLI makes pre-commit only warn (INS-015/R11, unchanged), so history is the fail-closed layer.
      - item: C6
        outcome: scenarios
        ids: [INS-016/S12, INS-016/S13, INS-015/S1]
        reason: "S12 keeps today's behaviour for these cases: a non-governed symlink commits as before, a Write through a non-governed symlink into spec/ is still denied, and a project opened through a symlinked folder governs the same paths (all three run on the current build). S13 keeps bypass acceptance and ticket merges that carry a rebuilt bundle. S1 keeps every earlier governed root."
      - item: C8
        outcome: na
        ids: []
        reason: "These Git behaviours were checked on this machine: Git records a symlink as mode 120000 whose blob is the target text, and with core.ignorecase it stages Spec/case.md as spec/case.md. Repro output is quoted below. No other external service is involved."
    assumed:
      - new: Does spec upgrade commit .spec/bin under a spec-owned marker?
        value: No. Upgrade writes .spec/bin and commits nothing, and on the base branch it adds the existing setup-wrote-governed-files note; the change lands through a bypass or a ticket. A marker's trailer is commit-controlled, and a bundle-hash manifest cannot cover per-merge bundles (INV-010).
      - new: Are unmarked .spec/bin commits made after enforceSince but before this version offenders?
        value: Yes, they are listed like any governed commit without evidence. The existing remedy is a bypass that moves enforceSince, as ADR-004 did. This repo has none.
      - new: Does before-edit deny a governed path that is a symlink to a file outside the project?
        value: "Yes: a target is governed if the path it names or the file it resolves to is governed (R14)."
      - new: Where do the new scenarios live?
        value: In INS-016 (history and Git hardening) as S12/S13 and R14/R15, because adding them to INS-015 pushed it to 274 lines, over its 250-line budget. INS-015 changes only R1 and S1 (now 250 lines).
      - new: Ticket branches still in flight whose side commits change only .spec/bin with no trailer
        value: Their merge is listed as an offender (INS-015/S18). Today commit-msg skipped those commits; after this change it adds Spec-Ticket. This repo's history has no such commit.
    duration_s: 1323
  - at: 2026-11-01T02:57:37.234Z
    role: spec-review
    result: done
    summary: "Approve: ticket builds and generated merges remain valid; retroactive CLI governance is explicit"
    verdict: approve
    assumed: []
    duration_s: 127
  - at: 2026-11-01T03:13:34.051Z
    role: tester
    result: done
    summary: Tests for INS-015/S1 and INS-016/S12, S13 in enforcement.test.ts; 11 fail now, no existing test needed changing
    verdict: null
    mutations:
      - scenario: INS-015/S1
        wrong: before-edit governs only .spec/bin/spec.cjs and leaves .spec/bin/spec and new files under .spec/bin allowed
      - scenario: INS-015/S1
        wrong: before-edit governs all of .spec/, so .spec/notes.md is denied
      - scenario: INS-016/S12
        wrong: pre-commit classifies a staged path by the realpath of the file it resolves to, so an outside-pointing symlink under spec/ or tickets/ is skipped as not governed
      - scenario: INS-016/S12
        wrong: pre-commit lets a staged ADR for an active bypass allow the outside-pointing symlink
      - scenario: INS-016/S12
        wrong: spec merge lets its merge token carry an outside-pointing symlink in from the ticket branch
      - scenario: INS-016/S12
        wrong: verify-history accepts an outside-pointing symlink commit that carries a valid Spec-Bypass trailer
      - scenario: INS-016/S12
        wrong: verify-history never reads the tree entry mode, so a commit made with --no-verify that adds the link is not listed
      - scenario: INS-016/S12
        wrong: pre-commit refuses every symlink under a governed path, so spec/readme-link.md to ../README.md is refused even with a bypass
      - scenario: INS-016/S12
        wrong: pre-commit treats every symlink anywhere as governed, so notes/link.md is refused
      - scenario: INS-016/S12
        wrong: before-edit stops resolving symlinks, so a Write through notes/config-link.json to spec/config.json is allowed
      - scenario: INS-016/S12
        wrong: before-edit judges spec/leak.md by the file it resolves to, so a Write to it is allowed
      - scenario: INS-016/S12
        wrong: the project root is no longer resolved through a symlinked folder, so edits and commits through the alias are not governed or a link is judged against the unresolved root
      - scenario: INS-016/S13
        wrong: .spec/bin is left out of the pre-commit governed paths, so a change to .spec/bin/spec.cjs on main commits without a ticket or bypass
      - scenario: INS-016/S13
        wrong: verify-history does not list a removal of .spec/bin/spec.cjs
      - scenario: INS-016/S13
        wrong: verify-history runs the commit's own .spec/bin/spec.cjs to decide whether the commit is clean
      - scenario: INS-016/S13
        wrong: commit-msg skips the Spec-Ticket trailer for a ticket-branch commit that changes only .spec/bin
      - scenario: INS-016/S13
        wrong: a ticket-filing commit with a Spec-Ticket trailer is valid even when it also changes .spec/bin
      - scenario: INS-016/S13
        wrong: a combine or Spec-Roles commit is valid even when it also changes .spec/bin
      - scenario: INS-016/S13
        wrong: pre-commit or history refuses a .spec/bin change made under a bypass ADR, or a ticket merge that carries a rebuilt bundle with its afterMerge child
      - scenario: INS-016/S13
        wrong: spec upgrade replaces .spec/bin on the base branch without adding the setup wrote governed files note, or commits the files
    assumed:
      - new: What does pre-commit say for a refused outside-pointing symlink?
        value: stderr starts 'spec refused this base-branch commit:' and contains the link's path and the words 'outside the project'
      - new: Which path does the spec merge refusal test use?
        value: spec/decisions/ADR-010-leak.md, pointing to a valid ADR outside the project, because spec/leak.md makes the merge fail on lint (L002) and the test would pass on today's code for that reason
      - new: Where does git add need -f?
        value: handCommit now runs git add -f, since .spec/bin/ is gitignored in the fixture and plain git add refuses it even for a tracked file
      - new: Which CLI checks S13 history?
        value: verifyRolesHistory (the plugin launcher, which delegates to the working tree's pinned CLI), with the working tree's .spec/bin/spec.cjs restored to the honest copy before it runs
    duration_s: 950
  - at: 2026-11-01T03:26:52.346Z
    role: implementer
    result: done
    summary: Tree-path governance, symlink refusal and governed .spec/bin; 11 failing tests pass, check green, history clean
    verdict: null
    assumed:
      - new: Which words does pre-commit use for a refused symlink?
        value: "'<path> is a symlink that points outside the project or cannot be resolved inside it (<why>)', after the standard 'spec refused this base-branch commit:' prefix"
      - new: Does verify-history list a symlink offender once per commit and skip the normal trailer check?
        value: Yes, one offender per commit, whatever its trailer; its Spec-Bypass ID and merge-ticket ID still count as used.
      - new: Is a symlink target that is empty or unreadable refused?
        value: Yes, as unresolvable under INV-011.
    duration_s: 792
  - at: 2026-11-01T03:35:35.178Z
    role: reviewer
    result: done
    summary: "Changes requested: root-link governance bypass, directory-link edit bypass and incomplete symlink validation"
    verdict: changes
    findings:
      - cites: [INS-015/R1, INS-016/R14, INV-011]
        text: src/cli/enforcement.ts:288-290 resolves the governed roots through the working filesystem and drops any outside the project. Replacing tickets/ with a symlink to an existing external directory therefore removes tickets and all its deleted children from governance. With ordinary code/test globs, pre-commit accepts this without any evidence and verify-history reports it clean while that checkout holds the link; replacing spec/ similarly changes historical classification. An in-memory Git/filesystem reproduction returned pre-commit code 0 and zero history offenders. Preserve the project-relative root entries independently of their symlink targets and add root-replacement regressions, including verification from a different checkout.
        tests: true
        class: C4
      - cites: [INS-015/S1, INS-016/R14]
        text: src/cli/enforcement.ts:304 resolves every parent directory before considering the named edit path. If .spec/bin is an outside-pointing directory symlink, both candidates for .spec/bin/spec.cjs are outside the project, so isGovernedPath is false and beforeEditReason allows the base-branch Write. An in-memory directory-link/base-branch reproduction returned null. This newly governed folder must remain governed by its named path even through directory links; the current tests cover only a leaf symlink and a symlink above the project. Add a directory-link edit regression and retain the named checkout when checking its branch.
        tests: true
        class: C4
      - cites: [INS-016/R14, INV-011]
        text: src/cli/enforcement.ts:332-379 retains only symlink entries, treating every other path component as successfully resolved without checking existence or mode. Thus spec/link -> ../notes/missing.md is accepted under a valid bypass although it cannot resolve in the tree. Traversal into a gitlink/submodule is also accepted even though its contents, including possible escaping links, are absent from that tree. A case-variant hop absent under its exact tree spelling is likewise silently accepted. An in-memory history reproduction of the dangling target with a valid bypass returned zero offenders. Validate resolution against the complete tree/index entry types, fail closed on unresolved or opaque traversal, and cover these cases in tests.
        tests: true
        class: C4
      - cites: [INS-016/S12, INV-011]
        text: "src/cli/enforcement.ts:344-346 turns failure of git ls-files --stage -z into an empty link map. Pre-commit then proceeds to its token/bypass authorization and can accept an escaping governed symlink without inspecting it. This is reachable not only through a Git failure: the shared git wrapper has Node's default spawnSync output limit, and this command lists the entire index, so a sufficiently large repository can exceed it. Refuse when the index entries cannot be read, handle large listings, and add a regression proving that a listing failure cannot be authorized by a bypass or merge token."
        tests: true
        class: C5
    assumed: []
    duration_s: 517
  - at: 2026-11-01T03:48:40.637Z
    role: tester
    result: done
    summary: Nine regression tests for the four review findings, all failing on the committed code; existing tests unchanged
    verdict: null
    mutations:
      - scenario: INS-016/S12
        wrong: the tickets root is resolved through the working filesystem and dropped when it points outside the project, so replacing tickets/ with a symlink commits without evidence and history lists nothing
      - scenario: INS-016/S12
        wrong: the spec root is resolved through the working filesystem, so history verified in a checkout that holds the spec/ link classifies its commits differently from one that does not
      - scenario: INS-015/S1
        wrong: before-edit resolves every parent folder before looking at the named path, so a Write to .spec/bin/spec.cjs through an outside-pointing .spec/bin folder link is allowed
      - scenario: INS-015/S1
        wrong: before-edit decides the branch from the checkout the .spec/bin link resolves to, so a link into a repository on another branch or into no repository allows the Write
      - scenario: INS-016/S12
        wrong: link resolution treats every path component that is not a symlink entry as found, so a link to a missing in-tree target is accepted under a bypass
      - scenario: INS-016/S12
        wrong: link resolution walks through a gitlink (mode 160000) as if it were a folder, so a link into a submodule is accepted under a bypass
      - scenario: INS-016/S12
        wrong: link resolution matches tree entries case-insensitively or by working-tree lookup, so a case-variant hop absent under its exact spelling is accepted
      - scenario: INS-016/S12
        wrong: link resolution refuses every link whose target is a tree path, so the exactly spelled in-tree link src/exact-link.ts is refused under a bypass
      - scenario: INS-016/S12
        wrong: a failing git ls-files --stage -z of the index becomes an empty link map, so a bypass lets an escaping symlink through
      - scenario: INS-016/S12
        wrong: a failing index listing becomes an empty link map, so the merge token of spec merge lets an escaping symlink in
      - scenario: INS-016/S12
        wrong: the index listing is read with the default 1 MB output limit, so a large index reads as failed or empty and an escaping symlink is accepted
    assumed:
      - new: Why are the unresolved-link cases under src/ and not spec/?
        value: A dangling symlink under spec/ crashes the spec loader (ENOENT on stat) before any hook verdict, so the cases use src/, a governed codeGlobs path the loader does not walk
      - new: How is a failing index listing simulated?
        value: A git shim that is also the git of a copy of the Git exec path (GIT_EXEC_PATH), because Git puts its own exec path first on the PATH of hooks and a PATH shim alone never reaches them
      - new: What do refusals of unresolved links say?
        value: stderr starts 'spec refused this base-branch commit:', names the link's path and matches /outside the project|cannot be resolved/
      - new: How is a different checkout verified for a replaced root?
        value: A git worktree at the commit before the replacement, running verify-history --since <that commit> --base main in-process with that worktree's spec root
    duration_s: 779
  - at: 2026-11-01T04:01:32.644Z
    role: implementer
    result: done
    summary: Roots stay governed through links, .spec/bin edits stay denied, links resolved on full tree entries, index failures refused
    verdict: null
    assumed:
      - new: Is a link to a path that exists in the tree only as an empty folder refused?
        value: Yes; Git holds no empty folders, so the target is unresolved.
      - new: Is a link whose final component is a submodule path itself refused?
        value: No; only a traversal through a gitlink is refused, since the link itself stays inside the project.
      - new: How large is the Git output limit?
        value: 1 GiB for every git call in src/io/git.ts; a listing that still exceeds it fails and is refused.
    duration_s: 762
  - at: 2026-11-01T04:07:05.683Z
    role: reviewer
    result: done
    summary: "Approve: all four findings are fixed, with regression coverage and no new blocking issue in the fixes"
    verdict: approve
    assumed: []
    duration_s: 326
---
Found by PROP-084's reviewer, and older than that ticket. The enforcement hooks' governed-path filtering resolves paths with realpath (src/cli/enforcement.ts around :277). A staged symlink inside a governed folder (spec/, tickets/, roles) that points outside the project can therefore be skipped as not governed, so its commit passes pre-commit without a ticket or bypass. A staged path is governed by where it sits in the tree, not by where a symlink points. A symlink staged under a governed path is checked like any file there, and a symlink that points outside the project is refused in governed paths. Reproduce it with the current build in a scratch repo with the hooks installed before writing the spec.

From PROP-086: The pinned CLI under .spec/bin is a governed path

Found by PROP-084's spec-writer. `.spec/bin/spec` and `.spec/bin/spec.cjs` are not governed paths by default (INS-015/R1), so a base-branch commit that changes the pinned bundle needs no ticket. Every self-hosted check, `verify-history` and `lint --ci` included, then runs whatever bundle is checked out. Change: `.spec/bin/**` is governed. Commits that change it go through a ticket, `spec upgrade` (under a spec-owned marker, as ticket filing does) or a bypass, and verify-history treats an unmarked change to it as an offender.
