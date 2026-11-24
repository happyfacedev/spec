---
id: PROP-084
type: proposal
title: Project additions to a role prompt live in their own file, and update-roles commits through the hooks
status: done
stage: null
touches: [INS-005]
violates: []
depends_on: []
changed: [INS-005, INS-005/R3, INS-005/R4, INS-005/R5, INS-005/S18, INS-005/S19, INS-005/S20, INS-005/S21, INS-005/S22, INS-014/S8, INS-015/R4, INS-015/R6, INS-015/S5, INS-015/S9, INS-015/S11, PIP-017/R11, PIP-017/S14, install.LocalRoleFile, install.LocalRoleFile.role, install.LocalRoleFile.text, install.RoleChange, install.RoleChange.extra, install.RoleFile, install.RoleUpdate, install.RoleUpdate.commit, install.RoleUpdate.moved, install.RolesCommitRefused, install.ShippedRole, install.ShippedRole.role, install.UpdateRoles]
questions: []
history:
  - at: 2026-11-01T00:26:53.237Z
    role: spec-writer
    result: done
    summary: Role .local.md files kept by update-roles, first-time paragraph move, spec next appends them, commits under a marker
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-005/S1, INS-005/S19, PIP-017/S14]
        reason: spec impact PROP-084 reaches neighbours only through cli.UsageError, which is unchanged; PIP-017 (spec next reads the local file) and INS-015 (marker and history rules) changed with it
      - item: C2
        outcome: scenarios
        ids: [INS-005/S18, INS-005/S19, INS-005/S17, INS-005/S20, PIP-017/S14]
        reason: "older installs: no local file (first-time move), existing local file, missing spec-review prompt, non-git or non-base checkout (no commit), shipped-prompt fallback (R8) still gets the local text"
      - item: C3
        outcome: scenarios
        ids: [INS-005/S20]
        reason: "another spec-owned commit in progress: install.RolesCommitRefused, every file put back"
      - item: C4
        outcome: scenarios
        ids: [INS-005/S20, INS-015/S9, INS-015/S11]
        reason: a forged Spec-Roles trailer is accepted only on a commit touching role prompts and newly created local files; one touching anything else or editing an existing local file is an offender; the marker is not a security boundary (INS-015/R4)
      - item: C5
        outcome: scenarios
        ids: [PIP-017/S14, INS-005/S20]
        reason: an unreadable local file makes spec next an error naming it; a refused commit fails and restores files
      - item: C6
        outcome: scenarios
        ids: [INS-005/S1, INS-005/S2, INS-005/S4, INS-005/S8, INS-005/S19]
        reason: diff output, closing line, exit codes and JSON members unchanged; a project with no local file and no added paragraphs behaves as before; PIP-017/S14 says a task without a local file is unchanged
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool beyond git commit behaviour already stated in INS-015 and TKT-012
    assumed:
      - new: Which installed text counts as 'beyond the shipped prompt'?
        value: "Whole paragraphs (outside frontmatter and report block) none of whose lines is in this version's prompt (INS-005/R3). Line-level would also move stale shipped bullets (e.g. this repo's old reviewer 'spec: true' bullet) into .local.md. Cost on this repo: the reviewer's 'Check the code against DECISIONS.md' bullet and the edited 'Write spec as its full path…' lines sit inside shipped paragraphs, so they show in the diff and are replaced, not moved"
      - new: Commit trailer and subject for update-roles
        value: "Subject 'spec: update role prompts to <version>', trailer 'Spec-Roles: <version>' (CLI version, e.g. 0.1.0); verify-history accepts it only on single-parent commits touching role prompts, the obsolete overseer prompt and new .local.md files"
      - new: Where does update-roles commit?
        value: Only with --yes, only when it wrote or removed something, and only on the base branch of a git repo; on other branches or outside git it writes without committing, as today
      - new: Without --yes, is the move announced?
        value: "Text output gets one line per role, 'spec/roles/<role>.md has text this version's prompt lacks: --yes moves it to spec/roles/<role>.local.md'; JSON moved stays empty without --yes"
      - new: Units changed outside touches [INS-005]
        value: PIP-017 (spec next appends the local file, S14/R11) and INS-015 (S5, R4, R6 widened in place, no lines added since INS-015 is at its 250-line budget); the ticket's touches may want PIP-017 and INS-015 added
    duration_s: 891
  - at: 2026-11-01T00:33:56.802Z
    role: spec-review
    result: done
    summary: Role-update exemption trusts prompt paths, and paragraph migration loses additions or revives obsolete instructions
    verdict: changes
    findings:
      - cites: [INS-005/R5, INS-005/S20, INS-015/R6, INS-015/S11, PIP-017/R11]
        text: "The new history exception checks paths and parent count, not whether their contents are a genuine role update. An author can forge Spec-Roles: 0.1.0 while changing only reviewer.md to instruct unconditional approval, or creating reviewer.local.md with that instruction; both satisfy R6 and affect subsequent stages. Rejecting non-role paths does not protect the pipeline whose instructions these files control. Specify independently verifiable authorization for exempt prompt contents and migrated local text, with a negative scenario for a forged trailer that weakens review while touching only allowed role paths. The C4 checklist citations do not cover this case."
        class: C4
      - cites: [INS-005/R3, INS-005/S18]
        text: R3 drops a project-added bullet inside an otherwise unchanged shipped list, not just edits to shipped lines. This repository's reviewer instruction to check DECISIONS.md is such a bullet; the spec-writer explicitly notes it will be replaced rather than moved. S18 tests separate added paragraphs and an edited shipped line, but not a pure insertion among unchanged shipped lines. The new preservation path therefore loses an existing project instruction during the very refresh this ticket enables. Cover additions within shipped paragraphs and preserve them, or explicitly refuse the ambiguous migration rather than treating them as disposable shipped-line edits.
        class: C6
      - cites: [INS-005/R3, INS-005/S18, PIP-017/R11]
        text: The migration compares only against the new shipped prompt. A paragraph shipped by an older version that was removed or wholly reworded has no matching line, so even an uncustomized older install moves it into .local.md. R11 then appends those obsolete instructions after the improved prompt, and later updates never remove them. The C2 citations cover a missing role and added project paragraphs, not this normal upgrade case. Specify how old shipped paragraphs are distinguished from project additions and cover an older unedited prompt whose shipped paragraph was replaced or removed.
        class: C2
    assumed: []
    duration_s: 421
  - at: 2026-11-01T00:53:37.731Z
    role: spec-writer
    result: done
    summary: No auto-migration; Spec-Roles commits verified against the CLI pinned in the commit's own tree via spec shipped-role
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-005/S1, INS-005/S19, PIP-017/S14]
        reason: spec impact reaches neighbours only through cli.UsageError, unchanged; PIP-017 (spec next appends the local file) and INS-015 (marker and history rules) changed with it
      - item: C2
        outcome: scenarios
        ids: [INS-005/S18, INS-005/S19, INS-005/S17, INS-005/S20, INS-005/S21]
        reason: nothing is migrated, so older shipped text is never revived into a local file; a Spec-Roles commit stays valid after later CLI upgrades because verify-history checks it against the CLI pinned in its own tree (S20); a pinned CLI from before shipped-role existed fails closed (S21); non-git and non-base checkouts commit nothing
      - item: C3
        outcome: scenarios
        ids: [INS-005/S20]
        reason: "another spec-owned commit in progress: install.RolesCommitRefused, every role file put back"
      - item: C4
        outcome: scenarios
        ids: [INS-005/S21, INS-005/S20, INS-005/S22, INS-015/S9, INS-015/S11]
        reason: "a Spec-Roles commit is valid only when its version is that of the CLI pinned in its own tree (pre-commit: the pinned CLI running the hook) and every touched path is a role prompt byte-identical to what that CLI's spec shipped-role prints; the commit cannot change the pinned CLI since it may touch only role prompts; a forged trailer weakening reviewer.md, a .local.md, a path outside roles/, another version, or a missing or older pinned CLI is refused or an offender"
      - item: C5
        outcome: scenarios
        ids: [INS-005/S21, INS-005/S22, PIP-017/S14]
        reason: no pinned CLI or one that cannot print its prompts makes the commit an offender; shipped-role refuses a non-pipeline role; an unreadable local file makes spec next an error naming it
      - item: C6
        outcome: scenarios
        ids: [INS-005/S1, INS-005/S2, INS-005/S4, INS-005/S8, INS-005/S18, INS-005/S19]
        reason: "diff, closing line, exit codes and --yes overwrite unchanged; no project line is moved or dropped silently: every line the shipped prompt lacks, including a bullet inside a shipped list, is listed (S18) for the person to move into .local.md"
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool beyond git commit behaviour already stated in INS-015 and TKT-012
    assumed:
      - new: How does the CLI expose its shipped prompts for the check?
        value: A new command, spec shipped-role <role> (install.ShippedRole), printing one pipeline role's prompt byte for byte as spec init installs it; any other role is a cli.UsageError (INS-005/S22)
      - new: Format of the listing of lines the shipped prompt lacks
        value: "Text only without --yes: '<path> has lines this version's prompt lacks:', each non-blank line indented two spaces, then 'Project additions belong in spec/roles/<role>.local.md, written by you: spec next adds it after the shipped prompt, and --yes replaces these lines.'; JSON always has install.RoleChange.extra"
      - new: Does the role-update commit include an obsolete overseer removal?
        value: "No: only role prompts it wrote, each byte-identical to the shipped one; an overseer prompt removed by R1 is left uncommitted, as today"
      - new: Units changed outside touches [INS-005]
        value: PIP-017 (S14/R11, from the first round, unchanged now) and INS-015 (S9, S11, R4, R6 widened in place; INS-015 is at its 250-line budget)
    duration_s: 1179
  - at: 2026-11-01T00:56:17.292Z
    role: spec-review
    result: done
    summary: Manual local additions resolve migration findings; historical CLI execution and shipped-role usage still need coverage
    verdict: changes
    findings:
      - cites: [INS-005/R5, INS-005/S20, INS-005/S21, INS-015/R6, INS-015/S5]
        text: The replacement content check executes repository-controlled historical JavaScript on the verifier's host. An earlier commit can pin a hostile spec.cjs, followed by a role-only Spec-Roles commit; the historical CLI can return the expected version and prompt while also reading credentials or modifying files. Restricting the later commit's paths does not authenticate that executable. Verifying earlier trailers establishes workflow authorization, not executable safety; the delta also does not require ancestry verification before invoking the historical CLI, and verification may start after the introducing commit. Specify the execution trust boundary and cover a hostile historical CLI without allowing host side effects. Prefer obtaining historical prompt bytes as data authenticated by trusted tooling, rather than running historical repository code; checking a CLI's self-reported version is not authentication.
        class: C4
      - cites: [INS-005/S22, install.ShippedRole, CLI-001/S1]
        text: The new public shipped-role command is absent from CLI-001/S1's exact usage text. Implementing discovery in --help would now contradict that unchanged scenario, while following it leaves the new command undiscoverable. Add its usage line to CLI-001 with this delta; the C1 checklist's claim that CLI neighbours are unaffected overlooks this interaction.
        class: C1
    assumed: []
    duration_s: 157
  - at: 2026-11-01T00:57:51.154Z
    role: spec-writer
    result: done
    summary: Spec-Roles commits checked by sha256 against the running CLI's never-pruned shipped-prompt manifest; nothing executed
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-005/S1, INS-005/S19, PIP-017/S14]
        reason: spec impact reaches neighbours only through cli.UsageError, unchanged; no new command, so CLI-001's usage text is untouched; PIP-017 (spec next appends the local file) and INS-015 (marker and history rules) changed with it
      - item: C2
        outcome: scenarios
        ids: [INS-005/S18, INS-005/S19, INS-005/S17, INS-005/S20, INS-005/S21]
        reason: nothing is migrated, so older shipped text is never revived into a local file; a Spec-Roles commit made by an older version stays valid after upgrades because the manifest keeps every version's prompt hashes (S20); a version the manifest does not list is an offender (S21); non-git and non-base checkouts commit nothing
      - item: C3
        outcome: scenarios
        ids: [INS-005/S20]
        reason: "another spec-owned commit in progress: install.RolesCommitRefused, every role file put back"
      - item: C4
        outcome: scenarios
        ids: [INS-005/S21, INS-005/S20, INS-015/S9, INS-015/S11]
        reason: "pre-commit and verify-history trust only the running pinned CLI: they read the commit's blobs as data, run nothing from the commit or its history, and accept a Spec-Roles commit only when every touched path is a role prompt whose sha256 the manifest lists for that role under the trailer's version; a forged trailer weakening reviewer.md, a .local.md, a path outside roles/, a changed .spec/bin/spec.cjs, a mismatched or unknown version is refused or an offender"
      - item: C5
        outcome: scenarios
        ids: [INS-005/S21, PIP-017/S14]
        reason: an unknown version or unlisted hash fails closed as an offender; an unreadable local file makes spec next an error naming it
      - item: C6
        outcome: scenarios
        ids: [INS-005/S1, INS-005/S2, INS-005/S4, INS-005/S8, INS-005/S18, INS-005/S19]
        reason: "diff, closing line, exit codes and --yes overwrite unchanged; no project line is moved or dropped silently: every line the shipped prompt lacks, including a bullet inside a shipped list, is listed (S18) for the person to move into .local.md"
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool beyond git commit behaviour already stated in INS-015 and TKT-012
    assumed:
      - new: How is the shipped-prompt manifest built and stored?
        value: Left to the implementer; the observable rule is that the CLI's manifest lists, per version, the sha256 of each role prompt it shipped, is never pruned, and always lists the current version's prompts (INS-005/R5)
      - new: Format of the listing of lines the shipped prompt lacks
        value: "Text only without --yes: '<path> has lines this version's prompt lacks:', each non-blank line indented two spaces, then 'Project additions belong in spec/roles/<role>.local.md, written by you: spec next adds it after the shipped prompt, and --yes replaces these lines.'; JSON always has install.RoleChange.extra"
      - new: Does the role-update commit include an obsolete overseer removal?
        value: "No: only role prompts it wrote; an overseer prompt removed by R1 is left uncommitted, as today"
      - new: Units changed outside touches [INS-005]
        value: PIP-017 (S14/R11, from the first round, unchanged now) and INS-015 (S9, S11, R4, R6 widened in place; INS-015 is at its 250-line budget)
    duration_s: 92
  - at: 2026-11-01T00:59:51.873Z
    role: spec-review
    result: done
    summary: Trusted manifest resolves execution risk; installed prompts are project-independent; no blocking findings
    verdict: approve
    assumed: []
    duration_s: 119
  - at: 2026-11-01T01:16:22.519Z
    role: tester
    result: done
    summary: Tests for update-roles extra lines, local files, hook commit, forged-commit refusal and spec next local append; 6 of 8 fail now
    verdict: null
    mutations:
      - scenario: INS-005/S18
        wrong: lists only lines added at the end of the file, or prints the listing without the spec/roles/<role>.local.md line, or omits extra from JSON
      - scenario: INS-005/S19
        wrong: update-roles overwrites, deletes or lists a .local.md as a changed or written role prompt
      - scenario: INS-005/S20
        wrong: --yes commits with git add -A so the staged notes.txt goes in, or omits the Spec-Roles trailer, or commits on a side branch / outside git, or leaves files written when the marker is held
      - scenario: INS-005/S21
        wrong: pre-commit and verify-history accept any Spec-Roles trailer without checking the sha256, version, paths or spec.cjs
      - scenario: INS-015/S5
        wrong: verify-history still lists a genuine Spec-Roles commit as lacking a Spec-Ticket or Spec-Bypass trailer
      - scenario: INS-015/S9
        wrong: pre-commit accepts the role-update marker for the right file path without checking that the staged content's sha256 is in the manifest
      - scenario: INS-015/S11
        wrong: history accepts a Spec-Roles commit that touches a .local.md, an outside path, a wrong or unknown version, or an edited prompt
      - scenario: PIP-017/S14
        wrong: spec next ignores the .local.md, puts it before the shipped text or R10 paragraph, or leaves its spec commands without the CLI path
    assumed:
      - new: How is an older version's commit stay-valid-after-upgrade (INS-005/S20 last And) tested?
        value: Not tested. A later CLI needs another build with a different version and manifest, and the manifest format is the implementer's choice; the genuine-commit tests run against the current pinned CLI only
      - new: Which existing tests does the replaced behaviour touch?
        value: None changed. No existing update-roles test runs --yes inside a git repository, so they still expect no commit correctly; init.test.ts and INS-005/S1-S17 pass unchanged
      - new: Is pre-commit's refusal of a role-update commit observable from a plain git commit with a trailer?
        value: Yes as refusal only (non-zero exit, HEAD unchanged). The sha256 check itself is tested through a git shim that forges reviewer.md after update-roles starts its commit (INS-015/S9)
      - new: Brief lists INS-005/S22 as changed
        value: No scenario with that ID is in the brief, so no test
      - new: Tests drive the pinned CLI in plugin/scripts
        value: Hook and verify-history cases run plugin/scripts/spec, which the implementer must rebuild so its manifest and commit step are in it
    duration_s: 989
  - at: 2026-11-01T01:30:43.253Z
    role: implementer
    result: done
    summary: update-roles lists extra lines, keeps .local.md, commits via a Spec-Roles marker; hooks check a sha256 manifest; spec next appends local text
    verdict: null
    assumed:
      - new: Manifest storage and format
        value: src/generated/role-manifest.ts maps version → role → list of sha256 hashes; the build (scripts/gen-role-manifest.ts, run by npm run build) adds the current version's hashes and never removes any, so a same-version prompt edit keeps the earlier hash. npm run lint also runs gen-role-manifest.ts --check, which fails when the current prompts are missing. The plugin-only build (--out) refuses a stale manifest, as it does for assets.
      - new: spec verify-history run through the plugin launcher
        value: It no longer defers to the project's .spec/bin/spec, so a checkout whose pinned spec.cjs was changed cannot run its own code in the check (INS-005/S21 last And). src/cli/run.ts, deferToProjectCli.
      - new: A role file whose content already equals HEAD after --yes writes it
        value: Nothing is committed and install.RoleUpdate.commit is left out; the files stay written.
      - new: Index state of the written role files when the commit fails
        value: reset to HEAD for those paths along with the file contents; a staged change to those same files made before the run is lost.
    duration_s: 858
  - at: 2026-11-01T01:36:23.277Z
    role: reviewer
    result: done
    summary: Specify the verifier delegation exception; preserve rollback state, avoid local reads and test upgrade history
    verdict: changes
    findings:
      - cites: [INS-014/S8, INS-014/R2, INS-005/S21]
        text: src/cli/run.ts:110 makes every plugin-launched verify-history use the plugin rather than the project's pinned CLI. Keeping the checker independent of a modified project bundle is sensible, but INS-014/S8 still explicitly defers every command except init, upgrade and --version, and DECISIONS.md X138 promises project-version semantics. Specify this exception and which CLI supplies the trusted manifest, including differing plugin/pin versions; the implementer's assumption does not amend that contract.
        spec: true
        class: C1
      - cites: [INS-005/S20, INS-005/R5, install.RolesCommitRefused]
        text: src/cli/enforcement.ts:527 resets the role paths to HEAD on commit failure instead of restoring their original index entries. If tester.md has staged content A and different working-tree content B, a held marker or rejecting hook restores B but discards A. Snapshot and restore the original staged blobs/modes (including absence), not HEAD. Add a refusal test with distinct HEAD, index and working-tree contents; the current clean-index failure cases cannot catch this loss.
        tests: true
        class: C6
      - cites: [INS-005/R4, INS-005/S19]
        text: src/cli/init.ts:298 loads the full workspace on the base branch. loadWorkspace calls loadDir(specRoot), which reads every role.local.md, contrary to R4's never-reads rule. An unreadable local file can therefore throw after the prompts have been overwritten at line 329, bypassing the rollback that handles only returned errors. Build the commit context without loading local prompts; add base-branch coverage that detects any local-file read. S19 currently runs outside git and misses this branch.
        tests: true
        class: C5
      - cites: [INS-005/S20, INS-005/R5]
        text: "tests/cli/enforcement.test.ts:2169 checks only the current version's manifest. S20's explicit upgrade case remains untested, as the tester record acknowledges: trusting only the current version or pruning old hashes would still pass the suite. Add coverage with two versions and differing prompts, preserving the earlier version/hash through manifest generation and accepting its genuine commit with the later verifier."
        tests: true
        class: C7
    assumed: []
    duration_s: 336
  - at: 2026-11-01T01:41:09.393Z
    role: spec-writer
    result: done
    summary: "No verify-history exception: it defers to the pinned CLI like every command; its manifest decides, whatever the plugin version"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-014/S8, INS-005/S1, INS-005/S19, PIP-017/S14]
        reason: INS-014/S8 now names verify-history among the commands that defer to the pinned CLI, so the plugin path agrees with X138 and with CI; other neighbours are reached only through cli.UsageError, unchanged
      - item: C2
        outcome: scenarios
        ids: [INS-014/S8, INS-005/S18, INS-005/S20, INS-005/S21]
        reason: a plugin version above or below the pin never changes the verdict, since the pinned CLI's manifest is used (S8); older Spec-Roles commits stay valid after upgrades because the manifest keeps every version (S20); an unknown version fails closed (S21); nothing is migrated into local files
      - item: C3
        outcome: scenarios
        ids: [INS-005/S20]
        reason: "another spec-owned commit in progress: install.RolesCommitRefused, every role file put back"
      - item: C4
        outcome: scenarios
        ids: [INS-005/S21, INS-005/S20, INS-014/S8, INS-015/S9, INS-015/S11]
        reason: "the checker trusts one CLI, the project's pinned one, and runs nothing from the commit or its history; a Spec-Roles commit may touch only role prompts, so it can never change .spec/bin (S21). A plugin-only exception would not add protection: CI runs .spec/bin/spec verify-history without the plugin, and INS-015/R4 already makes CI verification plus review the enforcement; it would only make plugin and CI verdicts differ"
      - item: C5
        outcome: scenarios
        ids: [INS-005/S21, PIP-017/S14]
        reason: an unknown version or unlisted hash fails closed as an offender; an unreadable local file makes spec next an error naming it
      - item: C6
        outcome: scenarios
        ids: [INS-014/S8, INS-005/S1, INS-005/S2, INS-005/S4, INS-005/S8, INS-005/S18, INS-005/S19]
        reason: deferral to the pinned CLI is unchanged for every command, verify-history included; update-roles diff, closing line, exit codes and --yes overwrite unchanged; every line the shipped prompt lacks is listed (S18)
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool beyond git commit behaviour already stated in INS-015 and TKT-012
    assumed:
      - new: Should a plugin-launched verify-history use the plugin's CLI instead of the pin?
        value: "No: it defers like every other command (INS-014/S8). The implementer's exception at src/cli/run.ts:110 does not meet the spec and must go. Reason: the enforcement is CI, which runs the pinned CLI without the plugin, so the exception protects nothing that counts. Its only effect is plugin and CI verdicts that differ, e.g. an older plugin whose manifest lacks the pin's version marks a genuine commit as an offender. It also breaks X138's project-version semantics"
      - new: "Follow-up, not in this ticket: a modified pinned bundle"
        value: .spec/bin/spec and .spec/bin/spec.cjs are not governed paths by default (INS-015/R1), so a commit that changes the bundle needs no ticket, and any self-hosted check, verify-history and lint --ci included, runs whatever bundle is checked out. This predates PROP-084 and affects every enforcement check equally. Fixing it, by making .spec/bin governed or running CI verification from a trusted copy, is a separate proposal
      - new: How is the shipped-prompt manifest built and stored?
        value: Left to the implementer; the observable rule is that the CLI's manifest lists, per version, the sha256 of each role prompt it shipped, is never pruned, and always lists the current version's prompts (INS-005/R5)
      - new: Units changed outside touches [INS-005]
        value: "This round: INS-014/S8 (one line widened in place; INS-014 is at its 250-line budget). Earlier rounds: PIP-017 S14/R11 and INS-015 S9, S11, R4, R6"
    duration_s: 284
  - at: 2026-11-01T01:42:57.363Z
    role: spec-review
    result: done
    summary: Pinned-CLI manifest authority and verify-history deferral agree; no blocking findings in the two-line clarification
    verdict: approve
    assumed: []
    duration_s: 105
  - at: 2026-11-01T01:57:24.575Z
    role: tester
    result: done
    summary: Added tests for staged-content restore, base-branch local-file reads, earlier-version manifest and plugin verify-history deferral; 4 fail now
    verdict: null
    mutations:
      - scenario: INS-005/S18
        wrong: lists only lines added at the end of the file, or prints the listing without the spec/roles/<role>.local.md line, or omits extra from JSON
      - scenario: INS-005/S21
        wrong: pre-commit and verify-history accept any Spec-Roles trailer without checking the sha256, version, paths or spec.cjs
      - scenario: INS-015/S5
        wrong: verify-history still lists a genuine Spec-Roles commit as lacking a Spec-Ticket or Spec-Bypass trailer
      - scenario: INS-015/S9
        wrong: pre-commit accepts the role-update marker for the right file path without checking that the staged content's sha256 is in the manifest
      - scenario: INS-015/S11
        wrong: history accepts a Spec-Roles commit that touches a .local.md, an outside path, a wrong or unknown version, or an edited prompt
      - scenario: PIP-017/S14
        wrong: spec next ignores the .local.md, puts it before the shipped text or R10 paragraph, or leaves its spec commands without the CLI path
      - scenario: INS-005/S20
        wrong: on a refused commit, resets the role paths to HEAD or only rewrites the working tree, so a file staged with different content loses its staged blob
      - scenario: INS-005/S19
        wrong: on the base branch, update-roles --yes loads the whole spec workspace, reading every .local.md, so an unreadable one throws after the prompts were overwritten
      - scenario: INS-005/S20
        wrong: manifest generation drops or overwrites an earlier version's hashes, or the verifier trusts only the current version
      - scenario: INS-014/S8
        wrong: a plugin-launched verify-history runs the plugin's own manifest instead of deferring to the project's pinned CLI
    assumed:
      - new: How is the earlier-version case driven without a manifest contract?
        value: "End to end: a copy of this checkout gets a patch-bumped version and a changed tester prompt, then its own gen-assets, gen-role-manifest and build scripts make a later CLI; that CLI becomes the fixture's pinned CLI and verifies an earlier-version commit"
      - new: Does the unreadable-local-file test need a non-root user?
        value: "Yes: it uses chmod 000, so a root run would read the file and pass without checking anything"
      - new: Which existing tests asserted that verify-history does not defer?
        value: "None. I changed the INS-005/S21 and INS-015/S11 matrix, which ran the plugin against a repository whose pinned CLI held a modified spec.cjs: it now restores the pinned file after making the commit, since the pinned CLI is the checker"
    duration_s: 864
    refusals: 2
  - at: 2026-11-01T02:05:20.776Z
    role: implementer
    result: blocked
    summary: C1, C5, C6 fixed and C7 passes; one new test asserts a clean git status with an unreadable file, which git cannot report
    verdict: null
    blockers:
      - text: "the test 'INS-005/S19 on the base branch a local file is never read, and an unreadable one stops nothing' (tests/cli/enforcement.test.ts:2321) expects `git status --porcelain` to be empty after `chmod 000` on a committed tester.local.md. Git cannot read that file to compare it, so it reports ' M spec/roles/tester.local.md' for any command, including one that never runs; checked in a fresh repository with no spec involved. The scenario says the file is never read, touched or committed, which holds: the prompt is replaced and committed alone, and the local file is byte for byte as it was."
        cites: [INS-005/S19, INS-005/R4]
        tests: true
    assumed:
      - new: Role-update commit context
        value: update-roles builds the commit context from spec/config.json alone (no loadWorkspace), before any role file is written; a throw after the first write puts every file back and rethrows
      - new: Unmerged index entries on a role file
        value: update-roles --yes refuses with install.RolesCommitRefused before writing any index entry, since the original entry cannot be restored exactly
    duration_s: 474
  - at: 2026-11-01T02:17:43.348Z
    role: tester
    result: done
    summary: INS-005/S19 test restores mode 644 before the clean-status check; full suite passes (1848 tests)
    verdict: null
    mutations:
      - scenario: INS-005/S19
        wrong: on the base branch, update-roles --yes loads the whole spec workspace, reading every .local.md, so an unreadable one throws after the prompts were overwritten
    passed: true
    assumed: []
    duration_s: 728
  - at: 2026-11-01T02:27:51.673Z
    role: reviewer
    result: done
    summary: "All four findings resolved: pinned verification, exact index rollback, config-only commit context and upgrade coverage"
    verdict: approve
    assumed: []
    duration_s: 602
---
Measured on this repo (SELF-HOSTING P48). This week's prompt changes do not reach this repo's own stages: the tester's sweep of replaced behaviour (PROP-077), the implementer's `tests: true` hand-off mark (PROP-076), the review finding classes (PROP-063) and the mutation reset. `spec next` reads the installed spec/roles/<role>.md, and nothing refreshes it. Two problems block the refresh. (1) The installed tester.md carries project paragraphs the shipped prompt lacks ('Follow the patterns of the existing tests…', 'Before you finish, run npm run lint and npm run typecheck…'), so `spec init . --update-roles --yes` would drop them. (2) With the enforcement hooks installed, the refreshed files can only be committed through a person's bypass. Change: a project's own additions to a role live in spec/roles/<role>.local.md, which `spec next` appends to the role prompt after the shipped text. update-roles never touches .local.md, and it moves text the installed file has beyond the shipped prompt into .local.md the first time, saying so. update-roles commits the files it writes under a spec-owned marker with a `Spec-Bypass`-free trailer the hooks and verify-history accept, as ticket new and combine do. A role prompt change merged on this repo can then be applied with one `spec init . --update-roles --yes`.
