---
id: PROP-100
type: proposal
title: spec upgrade delivers a rebuilt CLI even when the version string is unchanged
status: done
stage: null
touches: [INS-013]
violates: []
depends_on: []
changed: [INS-013, INS-013/R1, INS-013/R6, INS-013/S3, INS-013/S4, INS-013/S17, INS-013/S18, INS-013/S21, INS-013/S22, INS-013/S23, INS-013/S24, INS-013/S25, INS-013/S26, INS-013/S27, install.Upgrade, install.UpgradeResult, install.UpgradeResult.rebuilt]
questions: []
history:
  - at: 2026-11-01T14:53:47.962Z
    role: spec-writer
    result: done
    summary: Upgrade compares launcher and bundle bytes at an equal version and reports 'rebuilt'; identical bytes stay up to date.
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-013/S1, INS-013/S2, INS-013/S3, INS-013/S4, INS-013/S5, INS-013/S14, INS-013/S15, INS-013/S16, INS-013/S26]
        reason: spec impact PROP-100 reaches only INS-013 (install.ProjectCli, install.Upgrade) with 0 re-verify. S3 now states the identical-bytes condition. S26 keeps the version-difference path (S1, S2, S4) as it was. S5, S14, S15 and S16 are untouched.
      - item: C2
        outcome: scenarios
        ids: [INS-013/S1, INS-013/S2, INS-013/S21, INS-013/S22, INS-013/S25, INS-013/S26, INS-013/S27]
        reason: "The installed-state axis is covered: not installed (S1), different version (S2, S26), same version with a different bundle or launcher (S21, S22), launcher without its bundle (S25), unreadable version (S27). Path and platform axes do not change."
      - item: C3
        outcome: na
        ids: []
        reason: Upgrade is a single synchronous copy. The change adds no state shared across an await or a process boundary.
      - item: C4
        outcome: invariant
        ids: [INV-010]
        reason: The decision to replace .spec/bin is made by the running CLI comparing bytes, so a pinned launcher that reports the source's version cannot keep its own bytes (S22 cites INV-010).
      - item: C5
        outcome: scenarios
        ids: [INS-013/S25, INS-013/S27, INS-013/S21]
        reason: A missing file or an unreadable version counts as different and the files are replaced. Only identical bytes at an equal version are left alone.
      - item: C6
        outcome: scenarios
        ids: [INS-013/S3, INS-013/S8, INS-013/S9, INS-013/S26]
        reason: Identical bundle stays 'up to date <version>' (S3). Downgrade rules R4 stay as they were (S8, S9). A version difference is still reported as 'upgraded' (S26).
      - item: C8
        outcome: na
        ids: []
        reason: No external tool or service is involved. The current build was run on an unreadable pinned version (S27) and on identical bytes (S3).
    documents: [INS-013/S27]
    assumed:
      - new: How upgrade reports a same-version rebuild
        value: First stdout line 'rebuilt .spec/bin/spec <version>'; JSON gets a new install.UpgradeResult.rebuilt member, with upgraded true and downgraded false
      - new: What counts as a different build at an equal version
        value: Byte comparison of both the launcher and the bundle against the source; a missing file counts as different; file mode is not compared
      - new: Whether a same-version rebuild needs --force
        value: No; it is not a downgrade (S24)
    duration_s: 157
    refusals: 1
  - at: 2026-11-01T14:56:35.009Z
    role: spec-review
    result: done
    summary: Equal-version byte comparison and rebuild reporting are covered; neighbour behaviour remains preserved.
    verdict: approve
    assumed: []
    duration_s: 165
  - at: 2026-11-01T15:21:22.236Z
    role: tester
    result: done
    summary: INS-013 tests for rebuilt-at-equal-version (S21–S27) added, S3 and S4 updated, S17 and S18 covered; S21–S24, S26 fail.
    verdict: null
    mutations:
      - scenario: INS-013/S3
        wrong: rewrites the files, or reports rebuilt, when the bytes are identical at an equal version
      - scenario: INS-013/S4
        wrong: drops oldVersion, version or upgraded from the JSON when the version differs
      - scenario: INS-013/S17
        wrong: picks the newest registry entry regardless of scope, so a newer project entry for another repository outranks the user entry
      - scenario: INS-013/S18
        wrong: picks the newest registry entry regardless of projectPath, so a newer entry for another repository outranks this project's entry
      - scenario: INS-013/S21
        wrong: decides only by version string, so a different bundle at the same version stays 'up to date'
      - scenario: INS-013/S22
        wrong: compares only the bundle bytes and leaves a different launcher in place
      - scenario: INS-013/S23
        wrong: replaces the files but leaves rebuilt false or missing, or upgraded false, in the JSON
      - scenario: INS-013/S24
        wrong: treats an equal-version rebuild as a downgrade that needs --force, or prints 'downgraded'
      - scenario: INS-013/S25
        wrong: treats a missing bundle as identical and leaves the launcher without its bundle
      - scenario: INS-013/S26
        wrong: reports a different version with differing bytes as 'rebuilt', or sets rebuilt true in JSON
      - scenario: INS-013/S27
        wrong: skips replacing when the pinned version is unreadable
    assumed:
      - new: S4 whole-object toEqual relaxed to toMatchObject because rebuilt is a new member
        value: S4 only states upgraded, oldVersion and version; the rest of its previous fields are still checked
      - new: S25 has no discriminating failure now
        value: a real launcher without its bundle already reads as an unknown version and is replaced, so S25 passes before the change
      - new: INS-013/S17 and S18 tests versus the existing INS-014/S34 and S35 tests
        value: kept the INS-014 tests, which still own S34 and S35, and added separate INS-013 tests for the same behaviour
    duration_s: 1481
    refusals: 1
  - at: 2026-11-01T17:53:32.050Z
    role: implementer
    result: done
    summary: "upgrade compares launcher and bundle bytes at equal versions; reports rebuilt with rebuilt: true in JSON"
    verdict: null
    assumed: []
    duration_s: 2198
  - at: 2026-11-01T17:55:13.521Z
    role: reviewer
    result: done
    summary: Equal-version rebuild approved; pre-existing non-atomic copying is a candidate bug ticket.
    verdict: approve
    assumed:
      - new: How to run only tests/cli/upgrade.test.ts
        value: Used the project's Vitest command directly; spec test accepts scenario IDs, not file paths.
    duration_s: 96
---
Found in the 2026-11-01 plugin live check. INS-013/R1 copies the launcher and bundle only when the installed version differs, and R2 reads the version with --version. spec's version has been 0.1.0 through every merge, so `spec upgrade . --from <plugin>` printed 'up to date 0.1.0' and left a project's .spec/bin/spec.cjs on an old build that lacked merged fixes (PROP-096's --root task text, the report path). `--force` only allows downgrades and did not copy either. A project can therefore never receive merged CLI changes through upgrade. Make upgrade notice a different build at the same version (for example compare the bundle's content hash, or a build id the bundle reports), and say in its output what it did. Keep R1's intent: an identical bundle is still 'up to date'. Version bumping policy is a separate question; this ticket only makes upgrade correct when versions are equal.
