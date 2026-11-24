---
id: PROP-068
type: proposal
title: spec ticket combine commits under a spec-owned token so the enforcement hooks accept it
status: done
stage: null
touches: [TKT-012, INS-015]
violates: []
depends_on: []
changed: [INS-015, INS-015/R4, INS-015/R6, INS-015/S9, INS-015/S11, TKT-012, TKT-012/R5, TKT-012/S3, TKT-012/S10]
questions: []
history:
  - at: 2026-10-31T23:27:28.390Z
    role: spec-writer
    result: done
    summary: Combine commits under a combine marker with Spec-Ticket INTO; hooks and verify-history accept it (TKT-012/S10, INS-015/S11)
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [TKT-012/S10, TKT-012/S3, INS-015/S11, INS-015/S29, INS-015/S26]
        reason: impact reaches neighbours only through cli.UsageError and TKT-012's contracts, none of which change; the ticket-new marker path (INS-015/S29) and the merge/afterMerge paths (INS-015/S26) keep their rules, and combine's own commit is shown by TKT-012/S3 and S10
      - item: C2
        outcome: na
        ids: []
        reason: "no new path, platform or install axis: the combine marker uses the same common-git-dir location and tickets-dir-relative paths as ticket filing; hooks and combine ship in the same pinned CLI, and commits before enforceSince are never checked"
      - item: C3
        outcome: scenarios
        ids: [TKT-012/S10]
        reason: while another spec-owned commit holds the one-time marker, combine fails with tickets.CommitRefused and every ticket file is put back
      - item: C4
        outcome: scenarios
        ids: [INS-015/S11, TKT-012/S10]
        reason: "the marker and trailer can be forged by anyone with repo access; INS-015/R4 already says the marker is not a security boundary, and the history check decides from commit content alone (R6: only ticket files, every other ticket newly absorbed into the cited one)"
      - item: C5
        outcome: scenarios
        ids: [INS-015/S11]
        reason: a Spec-Ticket commit touching a non-ticket path, a ticket not absorbed into INTO, or one already absorbed is an offender, exit 1
      - item: C6
        outcome: scenarios
        ids: [TKT-012/S3, TKT-012/S1, INS-015/S29]
        reason: subject, file set, clean tree, off-base refusal and single-ticket filing are unchanged
      - item: C8
        outcome: scenarios
        ids: [TKT-012/S10]
        reason: "git commit -- <pathspec> commits only the named paths and leaves other staged paths staged: verified live with git 2.52.0 in a scratch repo (notes.txt stayed staged, commit held only the two ticket files)"
    assumed:
      - new: Which tickets does verify-history accept alongside INTO under Spec-Ticket INTO?
        value: only ticket files, each other one absorbed into INTO in that commit and not absorbed at its parent; subject not checked
      - new: Does commit-msg add the combine trailer?
        value: "no: combine writes Spec-Ticket INTO in its own message, as ticket new and merge do"
    duration_s: 228
  - at: 2026-10-31T23:29:10.671Z
    role: spec-review
    result: done
    summary: Combine authorization, staged-file isolation and history validation are covered; preserved paths remain intact
    verdict: approve
    assumed: []
    duration_s: 100
  - at: 2026-10-31T23:35:11.887Z
    role: tester
    result: done
    summary: Tests for combine marker, Spec-Ticket INTO trailer, hook and verify-history acceptance; the new ones fail now
    verdict: null
    mutations:
      - scenario: TKT-012/S10
        wrong: combine keeps a plain git commit with no marker, so the installed pre-commit hook refuses it
      - scenario: TKT-012/S10
        wrong: combine runs a plain git commit of the whole index, so notes.txt lands in the commit or is unstaged
      - scenario: TKT-012/S10
        wrong: combine omits the Spec-Ticket INTO trailer, so verify-history lists the commit
      - scenario: TKT-012/S10
        wrong: combine bypasses the held marker and commits anyway instead of failing with tickets.CommitRefused
      - scenario: TKT-012/S3
        wrong: combine commits the right files and subject but without the Spec-Ticket trailer
      - scenario: INS-015/S9
        wrong: pre-commit consumes the combine marker but commit-msg adds a second trailer or the marker is left behind
      - scenario: INS-015/S9
        wrong: combine marker only accepts one staged ticket file, as the ticket purpose does
      - scenario: INS-015/S11
        wrong: verify-history still demands a single touched path, so a valid combine commit is an offender
      - scenario: INS-015/S11
        wrong: verify-history accepts any Spec-Ticket commit that touches only ticket files, even with a non-absorbed ticket
      - scenario: INS-015/S11
        wrong: verify-history lets a combine commit also touch a non-ticket path
      - scenario: INS-015/S11
        wrong: verify-history accepts a ticket absorbed into some other ticket, not the cited one
      - scenario: INS-015/S11
        wrong: verify-history accepts a ticket already absorbed at the parent
    assumed:
      - new: Where does TKT-012/S10 live?
        value: in tests/cli/enforcement.test.ts beside INS-015/S29, since installFixtureHooks is private to that file
      - new: How is 'another spec commit holds the marker' simulated?
        value: a file at <git-dir>/spec/commit-token; commitWithToken writes it with wx
    duration_s: 359
  - at: 2026-10-31T23:44:09.329Z
    role: implementer
    result: done
    summary: Combine commits under a combine marker with Spec-Ticket INTO; pre-commit and verify-history accept it
    verdict: null
    assumed: []
    duration_s: 535
  - at: 2026-10-31T23:50:40.981Z
    role: reviewer
    result: done
    summary: Combine authorization and history checks match the spec; ticket filing and staged-path isolation are preserved
    verdict: approve
    assumed: []
    duration_s: 390
---
Found while merging S3 (enforcement) with PROP-038 (ticket combine), a C1 neighbour pair. On the base branch, S3's hooks accept a spec-owned ticket commit only with a ticket token, and commitWithToken's ticket purpose allows exactly one staged ticket file. `spec ticket combine` commits INTO and every FROM file together with a plain git commit, so once the hooks are installed it is refused on the base branch. Give combine its own token purpose (the staged set must be exactly the named tickets' files), a `Spec-Ticket:` trailer naming INTO, and the history check's acceptance of it; test it with the real hooks installed.
