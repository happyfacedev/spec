---
id: PROP-021
type: proposal
title: ticket new names its JSON file and never picks a taken ID
status: done
stage: null
touches: [TKT-005]
violates: []
depends_on: []
changed: [TKT-005, TKT-005/R1, TKT-005/R10, TKT-005/S3, TKT-005/S13, TKT-005/S23, TKT-005/S24, TKT-005/S25, TKT-005/S26, tickets.NotJson]
questions:
  - id: Q1
    kind: blocker
    text: 'BigInt fix done; the tester adds the regression test for a broken TASK-9007199254740992.md (next is TASK-9007199254740993). Its changes are kept in git stash "PROP-021 implementer: blocked"; the next implementer stage gets them back.'
    default: null
    cites:
      - TKT-005/R1
    answer: "Agreed: the tester adds the regression test."
    raised_by: implementer
history:
  - at: 2026-10-30T02:27:56.947Z
    role: spec-writer
    result: done
    summary: ticket new names an unparsable JSON file, and counts broken ticket files so the next ID is never taken
    verdict: null
    assumed:
      - new: Wording of the not-JSON message for a file
        value: "spec ticket new reads the ticket as JSON from <file as typed>: then the keys, a blank line and the usage, exit 2, as on stdin"
      - new: How a ticket file that does not parse gives its ID
        value: from its file name <prefix>-<n>.md, for any .md under the ticket folder; files store only
    duration_s: 276
  - at: 2026-10-30T02:39:53.584Z
    role: tester
    result: done
    summary: "TKT-005 tests: S3, S23, S24 fail on the missing behaviour; S13 unchanged and passing; lint and typecheck clean"
    verdict: null
    assumed:
      - new: Does S13 need a test change, since only its R10 cross-reference changed?
        value: "keep S13 as written: its assertions already match the stated stdin text, so it passes now"
    duration_s: 716
  - at: 2026-10-30T02:55:05.951Z
    role: implementer
    result: done
    summary: ticket new counts ticket files that do not parse in the next ID, and names the file in the not-JSON message
    verdict: null
    assumed:
      - new: Do ticket copies on other branches that do not parse hold their ID too?
        value: yes, their IDs count so the next ID is never taken on any branch
    duration_s: 912
  - at: 2026-10-30T03:05:34.135Z
    role: reviewer
    result: done
    summary: "Changes: live-copy spec gap and tracker ID regression; candidate bug: base already ignores tracker list failures."
    verdict: changes
    findings:
      - cites:
          - TKT-005/R1
        text: "src/io/ticket-store.ts:77 adds every state.live key: with local TASK-103 highest and a malformed TASK-150 copy only on another ticket branch/worktree, allocation becomes TASK-151 instead of TASK-104. TKT-005/R1 specifies malformed files under the ticket folder, but no scenario or rule explicitly states that branch-only malformed copies reserve IDs. The implementer's yes default changes observable behaviour. Specify that policy and add a scenario/test before keeping this reservation."
        spec: true
      - cites:
          - TKT-005/R1
        text: "src/cli/tickets.ts:254 and src/io/ticket-store.ts:177-178 change the command store too: taken() re-runs list instead of using the loaded tracker IDs. On throwaway fixtures holding valid TASK-103, failing only the second list makes the branch choose TASK-001 and exit 0, for creation and dry-run; node .claude/skills/spec-spec/scripts/spec.cjs chooses TASK-104. Healthy creation also increases from two lists to three, and dry-run from one to two. R1's new raw-file counting is files-store only. Preserve the already loaded command-store IDs so this files-store change does not regress tracker allocation."
    assumed: []
    duration_s: 627
  - at: 2026-10-30T03:07:18.900Z
    role: spec-writer
    result: done
    summary: R1 now counts broken live copies on other ticket branches and keeps the tracker's next ID from its first list
    verdict: null
    assumed:
      - new: Which live copies reserve an ID
        value: every ticket whose live copy is on an unmerged ticket branch or in another worktree (WSP-004), parsed or not; files store only
      - new: Which tracker list the next ID comes from
        value: the first list the command reads; a later list never changes the ID
    duration_s: 104
  - at: 2026-10-30T03:14:39.200Z
    role: tester
    result: done
    summary: "TKT-005 tests: S26 fails (TASK-001, not TASK-104); S3, S13, S23, S24, S25 pass; lint and typecheck clean"
    verdict: null
    assumed:
      - new: Keep the repo's tickets folder in the S26 fixture?
        value: remove it, as the TKT-004 tracker tests do, so the tracker is the only store
    duration_s: 440
  - at: 2026-10-30T03:23:49.234Z
    role: implementer
    result: done
    summary: ticket new picks the ID from the one tracker list it loads; files store also counts broken and live copies
    verdict: null
    assumed: []
    duration_s: 549
  - at: 2026-10-30T03:33:56.732Z
    role: reviewer
    result: done
    summary: "Changes: broken-filename ID collision; base bug candidates: tracker list failures and precision on parsed large IDs."
    verdict: changes
    findings:
      - cites:
          - TKT-005/R1
        text: src/io/ticket-store.ts:72-76 newly feeds malformed filenames into nextTicketId, whose Number conversion and increment at src/core/ticket-new.ts:35-36 lose integer precision. In a throwaway fixture with highest parsed task TASK-103 and committed broken tickets/TASK-9007199254740992.md, the branch picks TASK-9007199254740992 again and exits 1 with 'tickets/TASK-9007199254740992.md already exists'; R1 requires TASK-9007199254740993. The base bundle ignores that broken file and successfully creates TASK-104, so the newly counted filename case is not an unchanged base failure. Use exact integer arithmetic when comparing and incrementing these reserved numeric IDs.
    assumed: []
    duration_s: 607
  - at: 2026-10-30T03:37:49.421Z
    role: implementer
    result: blocked
    summary: nextTicketId compares and increments IDs as BigInt; the tester adds the regression test for huge broken IDs
    verdict: null
    assumed: []
    duration_s: 232
  - at: 2026-10-30T03:37:49.892Z
    role: tester
    result: reopened
    summary: reopened by PROP-021#Q1
    verdict: null
    assumed: []
  - at: 2026-10-30T03:44:11.459Z
    role: tester
    result: done
    summary: "TKT-005 S23 regression past 2^53 fails: branch exits 1; other TKT-005 tests pass; lint and typecheck clean"
    verdict: null
    assumed: []
    duration_s: 381
  - at: 2026-10-30T03:52:51.167Z
    role: implementer
    result: done
    summary: nextTicketId uses BigInt; a broken TASK-9007199254740992.md gives TASK-9007199254740993; full suite passes
    verdict: null
    assumed: []
    duration_s: 519
  - at: 2026-10-30T03:59:23.580Z
    role: reviewer
    result: done
    summary: "Approved: TKT-005 holds; follow-up candidate: base tracker list failures. Parsed-ID precision fixed."
    verdict: approve
    assumed: []
    duration_s: 392
---
Review 2026-10-29. TKT-005#Q1: when the JSON comes from a file and does not parse, the message names that file instead of stdin. TKT-005#Q2 (bug found in drafting): the next free ID also counts the IDs of ticket files that do not parse, so saving never fails on a taken ID.
