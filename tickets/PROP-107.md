---
id: PROP-107
type: proposal
title: spec upgrade replaces the pinned CLI atomically, so a failed copy never leaves a broken launcher
status: done
stage: null
touches: [INS-013]
violates: []
depends_on: []
changed: [INS-013/R7, INS-013/S28, INS-013/S29, INS-013/S30, INS-013/S31, INS-013/S32, INS-013/S33]
questions: []
history:
  - at: 2026-11-01T19:52:07.498Z
    role: spec-writer
    result: done
    summary: "INS-013 gains R7 and S28-S30: atomic temp-and-rename of .spec/bin, bundle first; failure keeps old files"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-013/S1, INS-013/S2, INS-013/S21, INS-013/S25, INS-013/S28, INS-013/S29, INS-013/S30]
        reason: spec impact reaches only INS-013 (install.ProjectCli, install.Upgrade); S1, S2, S21 and S25 keep the same copies and output, R7 adds how they are written; no re-verify features
      - item: C2
        outcome: scenarios
        ids: [INS-013/S28, INS-013/S30, INS-013/S25]
        reason: upgrade from missing (S30), launcher without bundle (S25) and older version (S28) all end in a complete install or the old one; same-folder temporary names make rename atomic on one filesystem
      - item: C3
        outcome: scenarios
        ids: [INS-013/S30]
        reason: bundle renamed before launcher so a launcher never appears without its bundle (R7); S30 shows it; two simultaneous upgrades are not specified, each rename is atomic
      - item: C4
        outcome: invariant
        ids: [INV-010]
        reason: the bytes of .spec/bin are unchanged in trust; this ticket adds no new input, and INV-010 still applies
      - item: C5
        outcome: scenarios
        ids: [INS-013/S29, INS-013/S30]
        reason: an unreadable source file stops upgrade with no change and a non-zero exit
      - item: C6
        outcome: scenarios
        ids: [INS-013/S3, INS-013/S1, INS-013/S2, INS-013/S21]
        reason: up to date, install, upgrade and rebuild keep their output and mode 755; S3 leaves .spec/bin untouched
      - item: C8
        outcome: na
        ids: []
        reason: no other tool or service is involved; rename within one folder is local filesystem behaviour
    assumed:
      - new: stderr text for a failed copy
        value: "upgrade failed: <error>, exit code 1 (not the usage exit 2)"
      - new: on a copy failure, are migration and settings steps still run
        value: no; upgrade stops and writes nothing else
      - new: failure to copy either file leaves both untouched
        value: both are staged under temporary names before either is renamed, so S29 and S30 hold
    duration_s: 102
  - at: 2026-11-01T19:53:06.440Z
    role: spec-review
    result: done
    summary: "Changes needed: clarify two-file publication, cover partial-write failure, and require exit 1"
    verdict: changes
    findings:
      - cites: [INS-013/R7, INS-013/S28, INS-013/S30]
        text: Two ordered renames expose a new bundle beside the old launcher, contradicting the always-complete-old-or-new guarantee. Explicitly require both files to finish staging before publication, clarify the guarantee, and cover launcher-publication failure after bundle publication. S28/S30 do not establish ordering.
        class: C3
      - cites: [INS-013/R7, INS-013/S29, INS-013/S30]
        text: Unreadable-source scenarios do not cover partial-write/disk-full failure after temporary files exist. Cover preservation of the old install, temporary-file cleanup (also absent from S30 assertions), and stopping before migration/settings writes.
        class: C5
      - cites: [INS-013/R7, INS-013/S29, INS-013/S30]
        text: Require exit 1 explicitly; non-zero currently permits usage-error exit 2 despite the requested failure contract.
        class: C9
    assumed: []
    duration_s: 54
  - at: 2026-11-01T19:54:02.986Z
    role: spec-writer
    result: done
    summary: INS-013 R7 states staging, bundle-then-launcher window and restore; S29-S33 cover failures, exit 1, no temp files
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-013/S1, INS-013/S2, INS-013/S21, INS-013/S25, INS-013/S28]
        reason: spec impact reaches only INS-013; install, upgrade, rebuild and restore keep their output and modes, R7 only constrains how the files are put in place
      - item: C2
        outcome: scenarios
        ids: [INS-013/S28, INS-013/S30, INS-013/S33, INS-013/S25, INS-013/S32]
        reason: fresh install (S30, S33), launcher without bundle (S25), older version (S28, S32) all end in the complete new install or the complete old state; same-folder temporary names keep renames on one filesystem
      - item: C3
        outcome: scenarios
        ids: [INS-013/S32, INS-013/S33]
        reason: R7 states the window between the bundle rename and the launcher rename; S32 and S33 cover failure of the second step; a second simultaneous upgrade is not specified
      - item: C4
        outcome: invariant
        ids: [INV-010]
        reason: no new input; the bytes of .spec/bin stay governed by INV-010
      - item: C5
        outcome: scenarios
        ids: [INS-013/S29, INS-013/S30, INS-013/S31, INS-013/S32, INS-013/S33]
        reason: unreadable source, full disk and an unplaceable launcher all stop with exit 1, the old state and no other writes
      - item: C6
        outcome: scenarios
        ids: [INS-013/S3, INS-013/S1, INS-013/S2, INS-013/S21]
        reason: up to date, install, upgrade and rebuild keep their output and mode 755; S3 leaves .spec/bin untouched
      - item: C8
        outcome: na
        ids: []
        reason: no other tool or service is involved; rename in one folder is local filesystem behaviour
    assumed:
      - new: how a failed launcher rename after the bundle is handled
        value: the old bundle is kept aside until the launcher is in place and restored on failure; a fresh install is removed again
      - new: stderr text and exit code of a failed copy
        value: "upgrade failed: <error>, exit code 1, not the usage exit 2"
      - new: on a copy failure, are migration and settings steps still run
        value: no; upgrade stops and writes nothing else
    duration_s: 54
  - at: 2026-11-01T19:54:31.414Z
    role: spec-review
    result: done
    summary: "Approved: staging order, rollback, partial-write cleanup, and exit 1 resolve all three prior findings"
    verdict: approve
    assumed: []
    duration_s: 26
  - at: 2026-11-01T20:08:01.059Z
    role: tester
    result: done
    summary: S28 test added (passes now); S29-S33 added with injected fs faults and all fail on the exit-1/upgrade-failed assertion
    verdict: null
    mutations:
      - scenario: INS-013/S28
        wrong: leaves a temporary file or the aside old bundle in .spec/bin after a successful replacement, or writes the files with a mode other than 755
      - scenario: INS-013/S29
        wrong: copies the launcher over the live file before the bundle is read, so a failed bundle leaves a new launcher with the old bundle
      - scenario: INS-013/S30
        wrong: writes spec.cjs (or a temporary file) into .spec/bin and does not remove it when the launcher cannot be read, or lets the error escape as an internal error with exit 2
      - scenario: INS-013/S31
        wrong: leaves the half-written temp file or a truncated bundle in .spec/bin, or runs migration and settings steps before the copy has succeeded
      - scenario: INS-013/S32
        wrong: does not restore the old bundle when the launcher rename fails, leaving the new bundle beside the old launcher
      - scenario: INS-013/S33
        wrong: on a fresh install leaves the new spec.cjs (or temp launcher) in .spec/bin when the launcher rename fails
    assumed:
      - new: how S29-S33 faults are injected
        value: in-process run() with node:fs wrapped by vi.mock in tests/cli/upgrade-failure.test.ts, because a spawned CLI cannot be stubbed; --from points at a temp source with a tiny launcher printing spec 0.5.0
      - new: which fs calls the implementation uses to write and place files
        value: writes through writeFileSync, copyFileSync or appendFileSync and placement through renameSync, as R7 says (rename); an implementation writing with openSync/writeSync or placing with another call would bypass the injected faults
      - new: the launcher rename failure in S32/S33
        value: fails once only, so the restore step is not itself blocked
      - new: the S31 disk-full moment
        value: the second file written into .spec/bin stores a few bytes and then throws ENOSPC, whichever temporary names are used
      - new: S31 old-generated files
        value: a legacy orchestrate SKILL.md from tests/fixtures/legacy-orchestrate.md and a settings.json with a removed hook entry stand in for the old-generated files
    duration_s: 807
  - at: 2026-11-01T20:19:01.621Z
    role: implementer
    result: done
    summary: spec upgrade stages both files under temp names, renames bundle then launcher, restores on failure, exit 1
    verdict: null
    assumed:
      - new: how the old bundle is kept aside during the swap
        value: hard link (copy if linking fails) to .spec.cjs.<pid>.old, removed on success; the bundle rename is then a single atomic replace
      - new: an empty .spec/bin folder created by a failed fresh install
        value: left in place; R7 and S30/S33 speak only of files
    duration_s: 658
  - at: 2026-11-01T20:24:59.161Z
    role: reviewer
    result: done
    summary: "Approved: staged replacement and single-failure rollback satisfy the brief; 35 targeted tests pass"
    verdict: approve
    assumed: []
    duration_s: 355
---
Found by PROP-100's reviewer. `spec upgrade` (src/cli/init.ts, around line 586) copies the new launcher and bundle directly over the live .spec/bin files with no rollback. A copy that fails part way (disk full, permissions, an interrupted process) can leave a launcher without its bundle, or a truncated bundle, and every hook and stage that runs .spec/bin/spec then fails. Write each file to a temporary name in the same folder and rename it into place, bundle before launcher, so .spec/bin always holds a complete old or new install; on failure leave the old files and report the error.
