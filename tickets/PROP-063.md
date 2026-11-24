---
id: PROP-063
type: proposal
title: spec stats measures rounds and finding classes per ticket
status: done
stage: null
touches: [PIP-003, PIP-008, PIP-018]
violates: []
depends_on: []
changed: [CLI-001/S1, PIP-003/R3, PIP-003/S18, PIP-004/R8, PIP-004/S10, PIP-004/S13, PIP-004/S15, PIP-004/S16, PIP-004/S18, PIP-004/S19, PIP-004/S20, PIP-004/S22, PIP-007/S19, PIP-007/S20, PIP-008/R10, PIP-008/S23, PIP-017/R10, PIP-017/S13, PIP-018/R7, PIP-018/S7, PIP-018/S9, PIP-020, PIP-020/R1, PIP-020/R2, PIP-020/R3, PIP-020/R4, PIP-020/R5, PIP-020/R6, PIP-020/S1, PIP-020/S2, PIP-020/S3, PIP-020/S4, PIP-020/S5, PIP-020/S6, pipeline.FindingClass, pipeline.ReviewFinding, pipeline.ReviewFinding.class, pipeline.RoundStats, pipeline.RoundStats.approved, pipeline.RoundStats.firstRound, pipeline.RoundStats.meanRounds, pipeline.StageRecord, pipeline.StageRecord.findings, pipeline.StageRecord.refusals, pipeline.Stats, pipeline.Stats.since, pipeline.Stats.tickets, pipeline.StatsResult, pipeline.StatsResult.spec, pipeline.StatsResult.tickets, pipeline.StatsResult.totals, pipeline.StatsTotals, pipeline.StatsTotals.answered, pipeline.StatsTotals.blocked, pipeline.StatsTotals.findings, pipeline.StatsTotals.minimum, pipeline.StatsTotals.refusals, pipeline.StatsTotals.reopened, pipeline.StatsTotals.review, pipeline.StatsTotals.specReview, pipeline.StatsTotals.stages, pipeline.StatsTotals.tickets, pipeline.TicketStats, pipeline.TicketStats.answered, pipeline.TicketStats.blocked, pipeline.TicketStats.findings, pipeline.TicketStats.id, pipeline.TicketStats.minimum, pipeline.TicketStats.refusals, pipeline.TicketStats.reopened, pipeline.TicketStats.review, pipeline.TicketStats.rounds, pipeline.TicketStats.specReview, pipeline.TicketStats.stages, pipeline.TicketStats.type]
questions:
  - id: Q1
    kind: blocker
    text: syncing ticket/PROP-063 with main conflicts in spec/modules/pipeline/features/PIP-017-task-for-a-delegated-stage.md; a person must merge
    default: null
    cites: []
    answer: "Merged main by hand: kept PROP-077's PIP-017/S12, R9 and this ticket's S13, R10."
    raised_by: spec-review
  - id: Q2
    kind: blocker
    text: "tests: true. tests/core/report-scenarios.test.ts, PIP-004/S22 ('One problem per finding without a class'), gives its third finding cites: [PRV-001/R1], but the chat-mini spec has no PRV-001/R1 (PRV-001 has no rules; R1 is PRV-002's). check-report therefore also gives 'a finding cites PRV-001/R1, which does not exist' (PIP-004/R3), so the test expects 2 problems and gets 3. The code is right; use an ID chat-mini has (for example PRV-001/S3). Every other test passes: 1766 of 1767. Its changes are kept in git stash \"PROP-063 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites: [PIP-004/S22, PIP-004/R8]
    answer: "Yes: the tester changes PRV-001/R1 to an ID chat-mini has (for example PRV-001/S3)."
    raised_by: implementer
history:
  - at: 2026-10-31T19:27:52.133Z
    role: spec-writer
    result: done
    summary: spec stats (PIP-020) measures stages vs minimum, blocks, reopens, refusals, answers, both reviews' rounds and finding classes
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-004/S16, PIP-004/S22, PIP-007/S19, PIP-008/S23, PIP-017/S13, PIP-018/S9, PIP-020/S1, CLI-001/S1]
        reason: spec impact PROP-063 reaches PIP-001/002/004/005, TKT-001/002/005/006/010, WSP-004/007. Review findings that pass through check-report and advance now carry a class (PIP-004/S16, S22, PIP-007/S19, PIP-008/S23); PIP-001's routing scenarios name findings abstractly and stay true. The reopened entries from TKT-006 --back and the blocked/invalid-report records are counted by PIP-020/S1. The other reached features read status and stage, which this ticket does not change
      - item: C2
        outcome: scenarios
        ids: [PIP-020/S4, PIP-017/S13, PIP-020/S3, PIP-020/S5]
        reason: "older histories (no class, no refusals, no spec review: minimum 4), older installed review prompts, UTC day for --since, and impossible dates"
      - item: C3
        outcome: scenarios
        ids: [PIP-020/S3]
        reason: while a stage is running, stats does not count it, and counts it once it is recorded; stats writes nothing
      - item: C4
        outcome: na
        ids: []
        reason: No new input decides anything. A finding's class comes from the review's report, is checked at intake (PIP-004/S22), and only labels a measurement; it changes no routing. stats only reads ticket files the CLI already owns and changes nothing
      - item: C5
        outcome: scenarios
        ids: [PIP-004/S22, PIP-003/S18, PIP-020/S5, PIP-020/S4]
        reason: a missing or invalid class is refused at intake; an unknown ticket or bad --since is refused with exit 2; an unknown class in a hand-edited history is counted as unclassified, not dropped
      - item: C6
        outcome: scenarios
        ids: [PIP-008/S23, PIP-018/S9, PIP-020/S1, CLI-001/S1]
        reason: a stage with no refusals records no refusals key, so existing records are unchanged; findings are still kept whole; stats changes no file; the usage text keeps every existing line
      - item: C8
        outcome: na
        ids: []
        reason: "No fact about another tool or service is involved: stats reads the project's own ticket files, and no harness behaviour changes"
    assumed:
      - new: "Where is the class required: when the report is read (PIP-003) or when it is checked (PIP-004)?"
        value: Checked (PIP-004/R8) on every reviewer and spec-review finding, whatever the verdict. At read time class is optional but must be a valid value (PIP-003/R3), so other roles' reports keep the 'only the reviewer and the spec review set verdict and findings' message
      - new: Which tickets does spec stats measure without IDs?
        value: Every ticket whose history has at least one entry. A ticket named on the command line is shown even if its history is empty. --since keeps tickets whose first history entry falls on or after that UTC day
      - new: What is the minimum for a proposal recorded before the spec review existed?
        value: 4, when its history has a done tester stage and no spec-review stage; otherwise 5. A bug is 3 and a task is 2
      - new: What counts as a report refusal?
        value: The PIP-018/R3 intake refusals for the stage, including a third refusal that blocks it, kept as StageRecord.refusals (left out when 0). A stored report refused at advance already shows as a blocked 'invalid report' entry
      - new: Which error does an unknown ticket give, and is the text table's layout pinned?
        value: tickets.UnknownTicket (exit 2), as spec plan's argument form uses. The columns and cell texts are pinned, but not the column widths
      - new: How do projects whose review prompts were installed before classes existed learn about them?
        value: spec next adds the class sentence to the reviewer or spec-review task when the prompt says 'class:' nowhere, as it already does for the spec-writer's checklist; the project's role file is not changed
      - new: Ticket item 4 (docs/PROCESS-LEDGER.md) is not a spec file. Who changes it?
        value: The implementer, alongside the code; the spec-writer changes only spec files (INV-003)
      - new: CLI-001/S1's usage block was out of date against today's build
        value: Brought it up to date with today's output (bypass, verify-history, hook git, --accept-edits, the --restart wording; checked with a diff against the build), plus the one new stats line
    duration_s: 438
  - at: 2026-10-31T20:39:40.006Z
    role: spec-review
    result: done
    summary: Approval totals hide spec-review churn after an earlier approval
    verdict: changes
    findings:
      - cites: [PIP-020/R5, pipeline.RoundStats.approved, pipeline.RoundStats.meanRounds, pipeline.RoundStats.firstRound, PIP-001/S14, PIP-001/S22]
        text: The aggregate approval metrics discard spec-review rounds after the first approve. PIP-001/S14 and S22 explicitly allow a reviewer finding to send an already spec-approved proposal back through the spec-writer and spec review. For verdicts approve, changes, approve, the new formulas report 1.0 rounds and 100% approved in one round despite three spec reviews; with approve, changes they still count an approved ticket while the latest spec review requires changes. This hides the very churn stats is intended to reveal. Define and cover the aggregate measures for re-entered reviews, including a return that has not yet been approved, rather than treating the first approval as final.
    assumed: []
    duration_s: 260
  - at: 2026-10-31T20:40:50.986Z
    role: spec-writer
    result: done
    summary: Review totals now read each review's whole verdict sequence; PIP-020/S6 shows a re-entered spec review and one still on changes
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-020/S6, PIP-004/S16, PIP-004/S22, PIP-007/S19, PIP-008/S23, PIP-017/S13, PIP-018/S9, PIP-020/S1, CLI-001/S1]
        reason: PIP-001/S14 and S22 send a spec-approved proposal back through the spec review. PIP-020/S6 counts all of its rounds and does not count a review still on changes as approved. The other neighbours are as in round 1
      - item: C2
        outcome: scenarios
        ids: [PIP-020/S4, PIP-017/S13, PIP-020/S3, PIP-020/S5]
        reason: older histories and prompts, UTC day for --since, impossible dates
      - item: C3
        outcome: scenarios
        ids: [PIP-020/S3, PIP-020/S6]
        reason: a running stage is not counted; a review that runs again after an approval counts every verdict, in order
      - item: C4
        outcome: na
        ids: []
        reason: No new input decides anything. A finding's class is checked at intake (PIP-004/S22) and only labels a measurement; stats changes nothing
      - item: C5
        outcome: scenarios
        ids: [PIP-004/S22, PIP-003/S18, PIP-020/S5, PIP-020/S4, PIP-020/S6]
        reason: a missing or invalid class is refused; an unknown ticket or a bad --since gives exit 2; a ticket whose latest verdict is changes is never counted as approved
      - item: C6
        outcome: scenarios
        ids: [PIP-008/S23, PIP-018/S9, PIP-020/S1, CLI-001/S1]
        reason: a stage with no refusals keeps its record unchanged; findings are kept whole; S1's totals are the same under the whole-sequence rule
      - item: C8
        outcome: na
        ids: []
        reason: No fact about another tool or service is involved
    assumed:
      - new: Are tickets still on changes counted in the mean rounds or in the share approved in one round?
        value: "No: both are taken over the tickets whose latest verdict is approve, as the line's '(<n> tickets)' names"
    duration_s: 69
  - at: 2026-10-31T20:41:31.843Z
    role: spec-review
    result: done
    summary: R5, RoundStats and S6 correctly account for re-entered reviews and latest verdicts
    verdict: approve
    assumed: []
    duration_s: 39
  - at: 2026-10-31T20:59:10.618Z
    role: tester
    result: done
    summary: Tests for stats, finding classes, refusals, review task and usage; existing finding fixtures got classes
    verdict: null
    mutations:
      - scenario: CLI-001/S1
        wrong: the usage text has no stats line, or puts it after next, or words it differently
      - scenario: PIP-003/S18
        wrong: the report reader still refuses the class key, or accepts C10, c1 or neighbours as a class
      - scenario: PIP-004/S16
        wrong: a reviewer finding with class C4 and an invariant cite is refused, or the class is not accepted
      - scenario: PIP-004/S22
        wrong: a reviewer or spec-review finding with no class, or a Follow-up finding on an approval, is accepted
      - scenario: PIP-007/S19
        wrong: a spec-review finding with a valid class is refused, or one without a class is accepted
      - scenario: PIP-008/S23
        wrong: advance drops class when it copies a reviewer's findings into the stage record
      - scenario: PIP-017/S13
        wrong: spec next never adds the class sentence to an older prompt, adds it twice to this version's, or adds it to a spec-writer, tester or implementer task
      - scenario: PIP-018/S9
        wrong: the refusal count is not kept in the record, or a stage with no refusals records refusals 0, or a new stage inherits the old count
      - scenario: PIP-020/S1
        wrong: counts a reopened entry as a stage, or computes the review rounds from the first approve only, or prints a row per ticket in another order
      - scenario: PIP-020/S2
        wrong: JSON totals leave out the RoundStats null case, or rounds counts reopened entries
      - scenario: PIP-020/S3
        wrong: counts the running stage, lists tickets with an empty history, or compares --since by local day or after the day
      - scenario: PIP-020/S4
        wrong: drops a finding with no class or class C10 instead of counting it as unclassified, or uses minimum 5 for a proposal with no spec review
      - scenario: PIP-020/S5
        wrong: an unknown ID or an impossible --since prints a table or exits 1 instead of refusing with exit 2 and nothing on stdout
      - scenario: PIP-020/S6
        wrong: counts a ticket's rounds only up to its first approve, or counts a ticket whose latest verdict is changes as approved
    assumed:
      - new: "PIP-004/S22 writes the finding text between two single quotes each side, R8 says double quotes: which does the problem use?"
        value: "double quotes, as R8 and the existing 'cites no ID' problem do: finding \"stream.ts logs the key\" has no class; add class: one of C1 to C9, or other. Test and corpus case PIP-004/S22 pin that; the spec's doubled quote in S22 reads as an escape"
      - new: How does the stats test read the text table, whose widths PIP-020 leaves open?
        value: "cells are runs of text split at two or more spaces; each column must be aligned by all cells starting at one place or all ending at one place; the lines from total: on are compared exactly"
      - new: What is the message of --since 2026-02-30?
        value: "the same form as for 'yesterday': stderr starts '--since is a date as YYYY-MM-DD, not 2026-02-30'"
      - new: Does a history finding's class key count as a known key for lint?
        value: "yes: PIP-008/S23 also checks that spec lint prints no finding mentioning class after a reviewer stage is recorded; src/core/schemas.ts FINDING_KEYS would need class"
      - new: Does a blocked reviewer report need a class on its findings?
        value: "left open: the tests that feed a blocked reviewer report with a finding give it a class, so they hold either way"
      - new: "UPDATED for the class requirement, tests/core/report-scenarios.test.ts: PIP-004/S10, S13, S15, S16 findings now carry a class"
        value: added class C1, C1, C4 and C4; also added the new PIP-004/S22 test there
      - new: "UPDATED, tests/core/report-corpus.yaml: findings of PIP-004/S15, S16, S18 (two cases) now carry a class"
        value: added classes C1, C4, C9 and C6; added the corpus case PIP-004/S22
      - new: "UPDATED, tests/core/review-gap.test.ts and tests/core/review-tests.test.ts: findings of PIP-004/S19 (three checks) and PIP-004/S20 now carry a class"
        value: class C1 and C7; the PIP-008/S23 and PIP-012 findings constant has class C1 on its first finding, and S23 now compares the kept findings exactly
      - new: "UPDATED, tests/cli/report-checklist.test.ts: spec-review findings of PIP-007/S19 and S20 now carry a class"
        value: class C1, C6 for the Follow-up finding; the spec review is checked by check-report so each finding needs one
      - new: "UPDATED, tests/cli/report-intake.test.ts: the reviewer changes report of PIP-018/S7 now carries a class"
        value: class C6; also added PIP-018/S9
      - new: "UPDATED, tests/cli/usage.test.ts: the USAGE constant of CLI-001/S1 gets the stats line after plan"
        value: the line is the spec's text, character for character
      - new: "NOT changed because they need no class: approveSpecReview in tests/helpers.ts, the reviewer-ok adapter case, the evals reviewer cases, and every reviewer or spec-review approval in the tests"
        value: they send verdict approve with no findings, so PIP-004/R8 asks for nothing; tests that build histories or call planAdvance directly (pipeline-order, spec-review-brief, ticket-unknown-keys, report.test) keep findings without class, since class is optional in a record and planAdvance does not check reports
      - new: Some of the updated tests fail now for a second reason?
        value: "yes: until the implementer lets a finding carry class (PIP-003/R3), every updated test that sends a class is refused with 'Unrecognized key: class' and fails; they pass once class is accepted"
    duration_s: 1057
  - at: 2026-10-31T21:11:03.616Z
    role: implementer
    result: blocked
    summary: spec stats, finding classes, refusals and review prompts done; one test cites PRV-001/R1, which chat-mini lacks
    verdict: null
    assumed:
      - new: Is the class check of PIP-004/R8 applied when the review report is blocked?
        value: "yes: it applies to every finding of a reviewer or spec-review report, whatever the result or verdict"
      - new: Is a history finding's class validated when the ticket is read?
        value: "no: the history record stays loose, so a hand-edited class is kept and spec stats counts it as unclassified (PIP-020/R4)"
      - new: How is the refusal count read at advance?
        value: from the stage's existing per-role refusal file in the git directory, after intake; 0 leaves the key out (PIP-018/R7)
      - new: Does the totals line say 'ticket' for one ticket?
        value: "no: 'total: <n> tickets' always, as R5 writes it; only the review lines say 'ticket' for 1"
    duration_s: 711
  - at: 2026-10-31T21:11:05.273Z
    role: tester
    result: reopened
    summary: reopened by PROP-063#Q2
    verdict: null
    assumed: []
  - at: 2026-10-31T21:18:51.364Z
    role: tester
    result: done
    summary: PIP-004/S22 third finding now cites PRV-001/S3 instead of PRV-001/R1; corpus cites no unknown ID
    verdict: null
    mutations:
      - scenario: CLI-001/S1
        wrong: the usage text has no stats line, or puts it after next, or words it differently
      - scenario: PIP-003/S18
        wrong: the report reader still refuses the class key, or accepts C10, c1 or neighbours as a class
      - scenario: PIP-004/S16
        wrong: a reviewer finding with class C4 and an invariant cite is refused, or the class is not accepted
      - scenario: PIP-004/S22
        wrong: a reviewer or spec-review finding with no class, or a Follow-up finding on an approval, is accepted
      - scenario: PIP-007/S19
        wrong: a spec-review finding with a valid class is refused, or one without a class is accepted
      - scenario: PIP-008/S23
        wrong: advance drops class when it copies a reviewer's findings into the stage record
      - scenario: PIP-017/S13
        wrong: spec next never adds the class sentence to an older prompt, adds it twice to this version's, or adds it to a spec-writer, tester or implementer task
      - scenario: PIP-018/S9
        wrong: the refusal count is not kept in the record, or a stage with no refusals records refusals 0, or a new stage inherits the old count
      - scenario: PIP-020/S1
        wrong: counts a reopened entry as a stage, or computes the review rounds from the first approve only, or prints a row per ticket in another order
      - scenario: PIP-020/S2
        wrong: JSON totals leave out the RoundStats null case, or rounds counts reopened entries
      - scenario: PIP-020/S3
        wrong: counts the running stage, lists tickets with an empty history, or compares --since by local day or after the day
      - scenario: PIP-020/S4
        wrong: drops a finding with no class or class C10 instead of counting it as unclassified, or uses minimum 5 for a proposal with no spec review
      - scenario: PIP-020/S5
        wrong: an unknown ID or an impossible --since prints a table or exits 1 instead of refusing with exit 2 and nothing on stdout
      - scenario: PIP-020/S6
        wrong: counts a ticket's rounds only up to its first approve, or counts a ticket whose latest verdict is changes as approved
    assumed:
      - new: "PIP-004/S22 writes the finding text between two single quotes each side, R8 says double quotes: which does the problem use?"
        value: "double quotes, as R8 and the existing 'cites no ID' problem do: finding \"stream.ts logs the key\" has no class; add class: one of C1 to C9, or other. Test and corpus case PIP-004/S22 pin that; the spec's doubled quote in S22 reads as an escape"
      - new: How does the stats test read the text table, whose widths PIP-020 leaves open?
        value: "cells are runs of text split at two or more spaces; each column must be aligned by all cells starting at one place or all ending at one place; the lines from total: on are compared exactly"
      - new: What is the message of --since 2026-02-30?
        value: "the same form as for 'yesterday': stderr starts '--since is a date as YYYY-MM-DD, not 2026-02-30'"
      - new: Does a history finding's class key count as a known key for lint?
        value: "yes: PIP-008/S23 also checks that spec lint prints no finding mentioning class after a reviewer stage is recorded; src/core/schemas.ts FINDING_KEYS would need class"
      - new: Does a blocked reviewer report need a class on its findings?
        value: "left open: the tests that feed a blocked reviewer report with a finding give it a class, so they hold either way"
      - new: "UPDATED for the class requirement, tests/core/report-scenarios.test.ts: PIP-004/S10, S13, S15, S16 findings now carry a class"
        value: added class C1, C1, C4 and C4; also added the new PIP-004/S22 test there
      - new: "UPDATED, tests/core/report-corpus.yaml: findings of PIP-004/S15, S16, S18 (two cases) now carry a class"
        value: added classes C1, C4, C9 and C6; added the corpus case PIP-004/S22
      - new: "UPDATED, tests/core/review-gap.test.ts and tests/core/review-tests.test.ts: findings of PIP-004/S19 (three checks) and PIP-004/S20 now carry a class"
        value: class C1 and C7; the PIP-008/S23 and PIP-012 findings constant has class C1 on its first finding, and S23 now compares the kept findings exactly
      - new: "UPDATED, tests/cli/report-checklist.test.ts: spec-review findings of PIP-007/S19 and S20 now carry a class"
        value: class C1, C6 for the Follow-up finding; the spec review is checked by check-report so each finding needs one
      - new: "UPDATED, tests/cli/report-intake.test.ts: the reviewer changes report of PIP-018/S7 now carries a class"
        value: class C6; also added PIP-018/S9
      - new: "UPDATED, tests/cli/usage.test.ts: the USAGE constant of CLI-001/S1 gets the stats line after plan"
        value: the line is the spec's text, character for character
      - new: "NOT changed because they need no class: approveSpecReview in tests/helpers.ts, the reviewer-ok adapter case, the evals reviewer cases, and every reviewer or spec-review approval in the tests"
        value: they send verdict approve with no findings, so PIP-004/R8 asks for nothing; tests that build histories or call planAdvance directly (pipeline-order, spec-review-brief, ticket-unknown-keys, report.test) keep findings without class, since class is optional in a record and planAdvance does not check reports
      - new: Some of the updated tests fail now for a second reason?
        value: "yes: until the implementer lets a finding carry class (PIP-003/R3), every updated test that sends a class is refused with 'Unrecognized key: class' and fails; they pass once class is accepted"
    duration_s: 465
  - at: 2026-10-31T21:26:01.319Z
    role: implementer
    result: done
    summary: spec stats, finding classes, refusals, review prompts and ledger doc; 1767 tests pass after the S22 test fix
    verdict: null
    assumed:
      - new: Is the class check of PIP-004/R8 applied when the review report is blocked?
        value: "yes: it applies to every finding of a reviewer or spec-review report, whatever the result or verdict"
      - new: Is a history finding's class validated when the ticket is read?
        value: "no: the history record stays loose, so a hand-edited class is kept and spec stats counts it as unclassified (PIP-020/R4)"
      - new: How is the refusal count read at advance?
        value: from the stage's existing per-role refusal file in the git directory, after intake; 0 leaves the key out (PIP-018/R7)
      - new: Does the totals line say 'ticket' for one ticket?
        value: "no: 'total: <n> tickets' always, as R5 writes it; only the review lines say 'ticket' for 1"
    duration_s: 427
  - at: 2026-10-31T21:30:42.535Z
    role: reviewer
    result: done
    summary: Stats, finding classes and refusals match the spec; live-ticket counts agree with recorded histories
    verdict: approve
    assumed: []
    duration_s: 279
---
From docs/PROCESS-LEDGER.md: the self-improving loop needs numbers the tool produces, not the lead's memory.

1. Reviewer findings (and spec-review findings) carry a class: `findings: [{ cites: [...], text: "...", class: C1|C2|C3|C4|C5|C6|C7|C8|C9|other }]`. check-report refuses a finding without a class on reports from these roles. The classes are defined once in the conventions (spec/core) so roles and lint share them.
2. Each recorded stage keeps: role, result, attempt number (report refusals), and for review stages the verdict and the findings' classes (already in history/report store — extend what is missing).
3. `spec stats [<TICKET>...] [--since <date>] [--format json]` prints per ticket: stages run per role (rounds), report refusals, review verdicts in order (`changes, changes, approve`), findings per class, and totals across tickets: mean review rounds to approve, share of tickets approved in one round, findings per class. Text output is a short table.
4. docs/PROCESS-LEDGER.md explains how to read it; the rule: a ticket with more than one review round gets a retro and a process change before the next ticket.
