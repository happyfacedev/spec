---
id: PROP-111
type: proposal
title: When an upgrade's rollback itself fails, the backup is kept and the error reported
status: done
stage: null
touches: [INS-013]
violates: []
depends_on: []
changed: [INS-013/R8, INS-013/S34]
questions: []
history:
  - at: 2026-11-01T20:56:09.459Z
    role: spec-writer
    result: done
    summary: "INS-013 gains S34 and R8: a failed restore keeps the old bundle as a named backup, reports both errors, exits 1."
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-013/S29, INS-013/S31, INS-013/S32, INS-013/S33, INS-013/S34]
        reason: spec impact reaches only INS-013 (install.Upgrade, install.ProjectCli) and has no re-verify entries; S29-S33 keep their steps and still hold, since R8 applies only when the restore itself fails
      - item: C2
        outcome: scenarios
        ids: [INS-013/S33, INS-013/S34]
        reason: a fresh install has no old bundle and so no backup (S33, R8 last sentence); an upgrade from an existing install is S34; the backup is a sibling in .spec/bin/, so path form and symlinks do not change it; the message does not fix a name or an absolute path
      - item: C3
        outcome: na
        ids: []
        reason: the brief names no second process; the order of renames is unchanged (R7) and R8 only covers the failure branch
      - item: C4
        outcome: invariant
        ids: [INV-010]
        reason: the backup is a data file in .spec/bin/ that no check runs; INV-010 already makes the pinned CLI's bytes non-authoritative, and the by-hand step is the person's own move
      - item: C5
        outcome: scenarios
        ids: [INS-013/S34]
        reason: when the restore fails the upgrade still fails with exit 1 and keeps the only good copy rather than deleting it
      - item: C6
        outcome: scenarios
        ids: [INS-013/S29, INS-013/S30, INS-013/S31, INS-013/S32, INS-013/S33]
        reason: failures whose restore succeeds still leave exactly spec and spec.cjs and no temporary file
      - item: C8
        outcome: na
        ids: []
        reason: no other tool or service is involved; the current deletion of the aside copy was read in the source of replacePinnedCli in the worktree (src/cli/init.ts)
    assumed:
      - new: Is the backup's name fixed?
        value: No. R8 only requires that the message names it, a file inside .spec/bin/; the test finds it by the name in stderr
      - new: What if a fresh install's rollback fails (nothing aside to keep)?
        value: "Out of scope for this ticket: R8 covers only an existing old bundle, and a fresh install keeps today's single-error report"
      - new: How exact is the by-hand line?
        value: Pinned only to contain the backup's name and spec.cjs and to say to move the backup over spec.cjs; the wording and the second error's layout are free
      - new: Does stdout change?
        value: "No: R7 pins stderr and the exit code only, and the failure prints nothing on stdout"
    duration_s: 94
  - at: 2026-11-01T20:56:47.973Z
    role: spec-review
    result: done
    summary: "Approved R8 and S34: retained backup, both errors, manual restore guidance and exit 1 are covered."
    verdict: approve
    assumed: []
    duration_s: 36
  - at: 2026-11-01T21:11:14.400Z
    role: tester
    result: done
    summary: "Added INS-013/S34 to upgrade-failure.test.ts: failing restore keeps a named backup; fails today on missing restore error."
    verdict: null
    mutations:
      - scenario: INS-013/S34
        wrong: deletes the aside copy after the restore fails, so no backup file is left in .spec/bin
      - scenario: INS-013/S34
        wrong: keeps the backup but reports only the launcher error, not the restore error
      - scenario: INS-013/S34
        wrong: keeps the backup but never names it, or names it without a line to move it over spec.cjs
      - scenario: INS-013/S34
        wrong: leaves a temporary file in .spec/bin besides the backup
    assumed:
      - new: How is the restore made to fail?
        value: A test fault fails any rename or copy onto spec.cjs once the launcher rename has failed; the bundle's first rename still succeeds
      - new: How is the by-hand line recognised?
        value: A stderr line containing the backup name, spec.cjs apart from that name, and the word move or mv
    duration_s: 864
  - at: 2026-11-01T21:24:57.163Z
    role: implementer
    result: done
    summary: replacePinnedCli keeps the aside backup when the restore fails; reports both errors, the backup name and a move line.
    verdict: null
    assumed:
      - new: What name does the backup have?
        value: The existing aside name .spec.cjs.<pid>.old in .spec/bin; R8 does not fix it and the message names it
      - new: Where do the extra lines go?
        value: "Into the thrown error message, so cmdUpgrade prints them after the first line 'upgrade failed: <launcher error>'; stdout stays empty"
      - new: Fresh install whose rollback fails?
        value: "Unchanged: single-error report, as R8 covers only an existing old bundle"
    duration_s: 809
  - at: 2026-11-01T21:31:11.288Z
    role: reviewer
    result: done
    summary: "Approved: failed restore retains the backup and reports recovery guidance; all 6 targeted tests pass."
    verdict: approve
    assumed: []
    duration_s: 371
---
Follow-up from PROP-107's reviewer, picked by the person on 2026-11-01. replacePinnedCli (src/cli/init.ts ~578-599) keeps the old bundle aside while it renames the new files into place and restores it if the launcher rename fails. If the restore itself fails (a second I/O error), the code deletes the aside copy and reports only the first error, so the person loses the one good copy and doesn't know .spec/bin is broken. Keep the aside backup when the restore fails, leave it in .spec/bin under a name the message gives, and report both errors with a line saying how to put the backup back by hand. Exit 1 as for any failed upgrade (INS-013/R7).
