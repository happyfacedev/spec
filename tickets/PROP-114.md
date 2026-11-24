---
id: PROP-114
type: proposal
title: Every recorded stage carries the model that ran it, and spec stats shows time and cost per role
status: done
stage: null
touches: [PIP-008, CLI-007, PIP-020]
violates: []
depends_on: []
changed: [CLI-001/S1, CLI-007/R17, CLI-007/S18, CLI-007/S19, CLI-007/S20, INV-017, PIP-008/R8, PIP-008/S18, PIP-008/S20, PIP-020/R7, PIP-020/R8, PIP-020/R9, PIP-020/S1, PIP-020/S2, PIP-020/S3, PIP-020/S4, PIP-020/S6, PIP-020/S8, PIP-020/S9, PIP-020/S10, PIP-025, PIP-025/R1, PIP-025/R2, PIP-025/R3, PIP-025/S1, PIP-025/S2, PIP-025/S3, PIP-025/S4, PIP-025/S5, PIP-025/S6, PIP-025/S7, PIP-026, PIP-026/R1, PIP-026/R2, PIP-026/S1, PIP-026/S2, PIP-026/S3, PIP-026/S4, TKT-010/S7, pipeline.AdvanceTicket, pipeline.AdvanceTicket.transcript, pipeline.RecordFailed, pipeline.RoleStats, pipeline.RoleStats.cost_usd, pipeline.RoleStats.costed, pipeline.RoleStats.duration_s, pipeline.RoleStats.median_s, pipeline.RoleStats.role, pipeline.RoleStats.stages, pipeline.RoleStats.timed, pipeline.StageRecord, pipeline.StageRecord.cost_usd, pipeline.StageRecord.duration_s, pipeline.StageRecord.model, pipeline.Stats, pipeline.StatsResult, pipeline.StatsResult.roles, pipeline.TicketStats, pipeline.TicketStats.duration_s, pipeline.TicketStats.timed]
questions:
  - id: Q1
    kind: preference
    text: "A stage that spec next prepared with no model (none configured for the role): what is recorded?"
    default: No model, as today
    cites: [CLI-007]
    answer: null
    raised_by: null
  - id: Q2
    kind: blocker
    text: syncing ticket/PROP-114 with main conflicts in spec/core/invariants.md; a person must merge
    default: null
    cites: []
    answer: "Merged by hand on the ticket branch (1d804b8, PROP-114: sync with main): spec/core/invariants.md keeps main's INV-016 and this ticket's INV-017, each as written; nothing else conflicted."
    raised_by: spec-review
  - id: Q3
    kind: blocker
    text: the spec-review asked for changes 3 times; a person must decide. How should PROP-114 proceed?
    default: null
    cites: []
    answer: "One more spec round: fix the one step the spec review named (PIP-025/S4's refused-commit step) so a tester can build it; everything else in the spec stays as approved."
    raised_by: overseer
history:
  - at: 2026-11-10T09:27:24.278Z
    role: spec-writer
    result: done
    summary: spec next remembers the model it chose; advance records it unless a transcript names one; spec stats adds time and cost
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-008/S20, CLI-007/S18, PIP-020/S1, PIP-020/S2, PIP-020/S4]
        reason: spec impact PROP-114 reaches readers of tickets.Ticket.history and callers of AdvanceTicket/StartStage; model stays an optional key every reader ignores, so their scenarios hold unchanged; the stats table's new time column is carried into every PIP-020 row it pins
      - item: C2
        outcome: scenarios
        ids: [PIP-008/S20, CLI-007/S18, PIP-020/S8, PIP-020/S4]
        reason: "upgrade: a stage started by an earlier version has no remembered model and records none; records from earlier versions with no duration_s show '-' and add nothing"
      - item: C3
        outcome: scenarios
        ids: [CLI-007/S18, PIP-008/S20]
        reason: while a stage runs, a restart replaces the remembered model; a later start of another stage of the ticket replaces it, so it is never recorded for the wrong stage; --start remembers each ticket's own model
      - item: C4
        outcome: invariant
        ids: [INV-017]
        reason: the transcript (main session) and the selected model (project config) are unverified, so nothing decides anything from model or cost
      - item: C5
        outcome: scenarios
        ids: [PIP-008/S20, PIP-020/S8]
        reason: an unknown model is left out, a missing cost is never estimated, a stage with no duration adds none
      - item: C6
        outcome: scenarios
        ids: [PIP-008/S20, PIP-020/S1, PIP-020/S3, PIP-020/S5, PIP-020/S6]
        reason: duration_s and the transcript's model and cost are recorded as before; the totals lines and errors of spec stats are unchanged
      - item: C8
        outcome: na
        ids: []
        reason: "no new fact about another tool: the transcript's model and total_cost_usd were already read by this version (PIP-008/S20); nothing new about a harness is assumed"
    assumed:
      - question: PROP-114#Q1
        value: No model, as today
      - new: How spec stats writes a duration
        value: <hours>:<mm>:<ss>, hours not padded; '-' when no stage holds one
      - new: Median of an even count of durations
        value: mean of the two middle ones, rounded down to a whole second
      - new: Where the per-role numbers go
        value: a second table after the totals lines, rows in proposal stage order, with a costed column '<k>/<n>' so partial cost coverage is visible
      - new: Does a transcript's cost without a model drop the remembered model?
        value: "No: the remembered model is kept and the transcript's cost recorded"
    duration_s: 466
  - at: 2026-11-12T07:48:36.785Z
    role: spec-review
    result: done
    summary: "Changes: waiting time in duration unsaid, remembered model has no identity (older CLI, ticket start, restart), INV-017 contradicts briefs, PIP-008 full"
    verdict: changes
    findings:
      - cites: [PIP-020/R7, PIP-020/R8, PIP-020/S8, pipeline.StageRecord.duration_s, PIP-009/R3, INV-016]
        text: "PROP-113 made every run of the test command wait for a repository-wide turn, and the wait is inside a stage's duration_s (from the stage's start to its recording; PIP-009/S16 even pins a 15-minute wait plus a 9-minute run). The delta's new time cells (PIP-020/R8), the per-role time and median (PIP-020/R7) and pipeline.TicketStats.duration_s / pipeline.RoleStats.duration_s say only 'the time its stages took' / 'time per role', so a reader takes waiting for work, and PIP-020 pins no scenario with a stage that waited. Say in PIP-020 (intent or R7/R8) and in the two contract members that the time is elapsed time from the stage's start to its recording, waiting for a turn included and not subtracted (the CLI cannot tell it apart), and add a scenario with a stage whose recording waited that shows its duration_s and the sums holding the wait. Also say what INV-016's wait now means for the measure: a stale or forged turn record can only lengthen a recorded duration, never change a result, and duration_s decides nothing (INV-017 lists only model and cost in Applies to)."
        class: C1
      - cites: [CLI-007/R17, PIP-008/R8, PIP-008/S20, CLI-007/S18]
        text: "The model is 'remembered with the stage's start' but nothing says where it lives or which stage it belongs to, so the claim 'only what was remembered with the start of the stage being recorded counts' cannot be tested for a start the new code did not make. Case: a newer CLI starts stage A with `spec next` (remembers M), A is recorded, then stage B is started by `spec ticket start` of an older pinned CLI, which neither clears nor replaces anything, and the newer CLI records B: the record gets M for the wrong stage. PIP-008/S20 only shows the replacement by a later start of the newer CLI. Settle it in the rules: either recording a stage (done, blocked, refused by its checks) forgets what was remembered, or the memory carries the stage's role and start so a mismatch is ignored; and add a scenario for a stage started by an older CLI after a stage that remembered a model. Say too that a recording that does not happen (pipeline.NoReport, pipeline.CheckCouldNotRun, pipeline.RecordFailed) keeps it, since the stage keeps running."
        class: C2
      - cites: [PIP-008/R8, CLI-007/R17, PIP-002/S3, PIP-002/S18, PIP-001/S5, pipeline.StartStage]
        text: "PIP-008/R8 says 'a later start of any stage of the ticket replaces it' and R17 says a stage started by `spec ticket start` alone 'has none', so pipeline.StartStage must clear the memory, yet PIP-002 is neither in touches nor changed and has no scenario or rule for it. It also collides with PIP-002/S3 (starting the already running stage again changes nothing): after `spec next` started the stage, a second `spec ticket start` of the same role is a no-op by S3 but a 'later start' by R8, so whether the model survives is unsaid. The blocked-stage resume (PIP-001/S5, PIP-002/S18: `spec ticket start TASK-101 implementer` after an answer) is the path where this shows up. Decide the owner (StartStage clearing, or recording clearing as in the finding on the older CLI), say what a no-op start does to the memory, add the matching scenario in the feature that owns it, and add that feature to touches."
        class: C3
      - cites: [CLI-007/R17, CLI-007/S18]
        text: "`--restart` is shown only with a model selected (haiku replaces sonnet). A restart with cli.Next.model null (the person switched harness, or the new harness has no model for the role) is not shown: R17 says both 'a start with no model selected remembers none' and 'a restart replaces it', so a tester can read it as keeping the earlier remembered model, which would record a model the restarted delegate never ran on. Add a restart-with-no-model case whose outcome is that the earlier remembered model is gone. Also state that a start that fails after the model was chosen (PIP-002/S5, S13 to S16, S22: the gate, a busy branch, uncommitted work, a stash that does not apply) leaves nothing remembered, not only 'an error' in general, because for `--start` over several tickets some starts succeed and some fail in one call."
        class: C3
      - cites: [CLI-007/R17, CLI-007/R1, CLI-007/R3, CLI-007/S1, CLI-007/S18]
        text: "R17 says it applies 'for one ticket, with `--start` or with `--restart`', but a plain `spec next TASK-101` also starts the stage (R1, S1) and S18 rightly shows it remembering a model; R3 makes `--start` the flag only for a listing without an ID, and R12 forbids `--restart` with `--start`. The rule as written excludes the commonest start. Reword R17 to the cases it means: every start made by `spec next` (a ticket ID alone, the listing with `--start`, `--restart`)."
        class: C9
      - cites: [INV-017, PIP-012/S24, PIP-012/R13, pipeline.StageRecord.model]
        text: "INV-017 says 'no ... brief ... reads them' and its Shown by line says 'only `spec stats` reads either'. PIP-012/S24 puts the latest record of each role in full into every later role's brief, so model and cost_usd are printed in briefs (and `spec show`), and the model string is free text taken from a transcript any local process can forge (INV-017's own premise). No decision reads them, but the sentence is false as written and a reviewer or tester cannot check it. Reword both: nothing decides from them, they are only shown (in `spec stats`, briefs, the ticket file) as data. And state what a recorded model may be (one line, bounded length, no control characters, else left out) so a forged transcript cannot put a long or multi-line text into the ticket file and every later brief; that is the INV-016 pattern for a value any process can set (what is shown from it is limited)."
        class: C4
      - cites: [PIP-020/R7, PIP-008/S20, pipeline.StageRecord.cost_usd, pipeline.RoleStats.cost_usd, INV-017]
        text: "INV-017 and the checklist's C5 answer say 'an unknown model is left out' and 'a missing cost is never estimated', but no scenario covers a transcript or a hand-edited history that holds a cost that is not a plain number: negative, zero, NaN or infinite, or a string, or a model that is empty or not a string. `spec stats` now sums cost_usd (PIP-020/R7), so one such record makes a role's cost negative or '$NaN', or null in JSON while costed still counts it (PIP-020/S4 already pins a hand-edited class 'C10' as precedent). Say in PIP-008/R8 which transcript values are recorded and in PIP-020/R7 which recorded values are summed (finite, not negative), and add one scenario each for recording and for stats."
        class: C5
      - cites: [PIP-020/S3, PIP-020/R7, pipeline.StatsResult.roles]
        text: "`spec stats TASK-101` for a ticket with an empty history is pinned in S3 (row '0/2'), and R7 gives a row only to a role with a stage, so the role table has no rows; the text output is not shown: the blank line and header with no row, or nothing after the totals. A tester can write either. State it in S3 (JSON already says roles is [] only for the no-ticket case, not for this one)."
        class: C9
      - cites: [PIP-008, PIP-008/S20, PIP-008/R8, pipeline.StageRecord.model]
        text: "PIP-008 is at 249 of 250 lines (lint L011, 100%) with the delta, and pipeline/contracts.md at 588 of 600. The fixes above need up to four more scenarios and some rule text about recording the model and cost; PIP-008 can take one line, not that. Do not squeeze them: move the model-and-cost recording (S20's model and cost lines, R8) into a new feature of the pipeline module (the next free number is PIP-024) with PIP-008 keeping the duration and a citation, or place the start-side cases in PIP-002 (239 lines) and CLI-007 (152), and the stats cases in PIP-020 (93), which have room. Do the move in this ticket so the tester and the implementer need no further spec change; if contracts.md would pass 600, say which contracts move."
        class: other
      - cites: [PIP-020/R7, PIP-020/R8, PIP-020/S8, pipeline.RoleStats.duration_s]
        text: "Follow-up: cost has a 'costed' column that shows partial coverage, but the time cells (a ticket's, and a role's total and median) give no sign that a stage without duration_s was left out: in S8 the implementer row reads '3' stages and '0:50:01' from two of them, and the TASK-120 row reads '1:00:00' from one of two stages. Only records from before duration_s hold none, so rare; a 'timed' count in the same form as costed could be filed."
        class: C6
      - cites: [PIP-020/R7, pipeline.RoleStats.cost_usd]
        text: "Follow-up: the rounding of '$<amount>' with two decimals (half up on a value like 0.125) and whether JSON holds the float sum unrounded (0.1 plus 0.2 gives 0.30000000000000004) are not stated; S8 pins only sums that are exact in two decimals."
        class: C9
      - cites: [CLI-001/S1, PIP-020]
        text: "Follow-up: the usage text pinned exactly in CLI-001/S1 describes `spec stats` as 'stages against the minimum, blocks, reopens, refusals, answers, review rounds and finding classes per ticket'; it does not mention the new time column or the role table. Left as it is it stays true, but the text a person reads to learn what stats shows would be out of date; a ticket could change the line and S1 together."
        class: C9
    assumed:
      - new: Does a stage start made by `spec ticket start` after a newer CLI recorded a stage see the earlier remembered model?
        value: "Judged as a gap to fix in the spec, not decided here: the review only asks that recording or the identity of the start settle it"
    duration_s: 275
  - at: 2026-11-12T07:58:24.224Z
    role: spec-writer
    result: done
    summary: Model/cost recording moved to PIP-025 with a stage-bound memory, bounds and waiting time; stats adds timed, rounding
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-008/S20, PIP-025/S1, PIP-025/S3, CLI-007/S18, CLI-007/S20, PIP-020/S1, PIP-020/S2, PIP-020/S4, CLI-001/S1]
        reason: "spec impact PROP-114: PIP-001, PIP-002, PIP-012, PIP-018, PIP-021, PIP-022, TKT-* and WSP-* read or write history records whose new keys are optional and read by no decision (INV-017); PIP-002/S3's no-op start keeps the remembered model (PIP-025/S1); PIP-012/S24 shows records as data; the stats contracts moved unchanged in meaning to modules/pipeline/contracts/stats.md (FMT-001/R1 allows contracts/*.md); CLI-001/S1's usage line now names time and cost"
      - item: C2
        outcome: scenarios
        ids: [PIP-025/S3, PIP-020/S4, PIP-020/S8, CLI-007/S18]
        reason: "upgrade and pinned older CLIs: a stage started by an earlier version, writing the start record without a model or not at all, records no model (role and start-time match, forget on recording); records from before duration_s show '-' and are counted in timed; the start record lives in the repository's common git directory, shared by every worktree"
      - item: C3
        outcome: scenarios
        ids: [PIP-025/S1, PIP-025/S4, CLI-007/S19, CLI-007/S20, PIP-025/S6]
        reason: a second ticket start while the stage runs keeps the model; a recording that does not happen keeps it; a restart replaces it or clears it; one failed start among several in --start writes nothing; a wait for another ticket's test-run turn is inside the duration
      - item: C4
        outcome: invariant
        ids: [INV-017]
        reason: "transcript (main session/harness), stage start record and ticket file are writable by any local process: model and cost decide nothing and are bounded (100 chars, no control characters; finite cost >= 0); duration decides only PIP-002/R2's start order, which a wait does not move"
      - item: C5
        outcome: scenarios
        ids: [PIP-025/S5, PIP-020/S10, PIP-025/S3]
        reason: a model outside the bound, a negative, infinite or text cost is not recorded; a ticket file holding such values fails lint L020 and is not measured; a model from another stage's start is ignored
      - item: C6
        outcome: scenarios
        ids: [PIP-008/S20, PIP-025/S2, PIP-020/S3, PIP-020/S5, PIP-020/S6, PIP-020/S7]
        reason: duration_s and the transcript's model and cost are recorded as before; stats totals lines, errors, row selection and minimums are unchanged
      - item: C8
        outcome: na
        ids: []
        reason: "no new fact about another tool: the transcript's model and total_cost_usd were already read by this version; test-run turns are PIP-009's, already merged"
    assumed:
      - question: PROP-114#Q1
        value: No model, as today
      - new: Where the model is remembered
        value: "in the existing stage start record spec/stages/<ID>.json in the common git directory (holds stage and started today, verified on .git/spec/stages/PROP-114.json and in the start code: only a start that is not a no-op rewrites it), with a model key only spec next adds; used only for the same role with a start later than every history entry; removed on every recording"
      - new: Bound on a recorded model
        value: 1 to 100 characters, no control character; a cost is recorded when finite and 0 or more, so 0 is recorded
      - new: Text cost rounding and JSON
        value: nearest cent, exactly halfway rounded up, two decimals; JSON holds the unrounded sum in ticket ID then history order
      - new: Role table for measured tickets with no stage
        value: left out together with its blank line; stdout ends with the findings line
      - new: Time coverage count
        value: a 'timed' column '<k>/<n>' for tickets and roles, JSON timed int, like costed
      - new: PIP-020/S10's lint L020 and exclusion of a ticket with an invalid cost_usd or duration_s
        value: worked out from the ticket schema (cost_usd finite >= 0, duration_s whole >= 0) and the store dropping files that fail it; not run on a file, since this stage may write spec files only
      - new: Number of the new feature
        value: "PIP-025: PIP-024 is taken on ticket/PROP-116; lint --base main reports no reused ID"
    duration_s: 584
  - at: 2026-11-12T08:04:49.799Z
    role: spec-review
    result: done
    summary: "Approve: all nine fixes hold, pinned values recompute, S10 matches the schema and store; only rarer cases left as follow-ups"
    verdict: approve
    findings:
      - cites: [PIP-025/R2, PIP-025/S3, PIP-025/S1]
        text: "Follow-up: the stage identity is the role plus a 'started' time later than every history entry's 'at'. The build forgets the model on every recording and every start of the current code rewrites the file, so the time test only guards a stage recorded by a CLI that does not forget (the older-CLI case). Its failure direction is safe (the model is dropped, never a wrong one used), and it needs the clock to step back between a recording and the next start, two entries in one millisecond (not reachable: a recording is a git commit), or a history entry written on another machine whose clock is ahead (the record is local to one machine's git directory). A clock-free identity would be simpler to test: the number of history entries at the start, kept in the same file, used only when it equals the entries now. Not needed for correctness."
        class: C3
      - cites: [INV-017, PIP-025/S6, PIP-002/R2, PIP-002/S32]
        text: "Follow-up: the claim holds in the build (src/cli/tickets.ts firstStageStart is the first record's time less its duration_s, and a wait moves the time and the duration alike), but INV-017's Shown by names PIP-025/S6 for it and S6 shows only the 2400 seconds and the stats cells, not the start order. PIP-002/R2 says 'started its first stage' without saying how a finished ticket's start is known, and PIP-002 is neither in touches nor changed although INV-017 now depends on it. A scenario in PIP-002 (a conflicting ticket refused or not by a first record with a 15-minute wait), or Shown by changed to 'review', would make the claim checkable. A forged very large duration_s in a first record holds back every conflicting ticket while that ticket runs; INV-017 names the effect as 'which of two waits', which is the one-pair case."
        class: C1
      - cites: [INV-017, INV-016, PIP-009/R3]
        text: "Follow-up: INV-017 says a stale or forged turn record 'can only lengthen' a duration. INV-016 also lets a forged SPEC_TEST_RUN_PARENT skip a wait and lets the SPEC_TEST_RUN_* settings shorten waiting intervals, so a duration can also be shortened by any local process. The conclusion (decides only the PIP-002/R2 order, never a check) still holds; the sentence should say 'lengthen or shorten'."
        class: C4
      - cites: [PIP-025/R3, pipeline.StageRecord.model, PIP-020/R9, INV-017, PIP-012/S24]
        text: "Follow-up: the bound on a model (1 to 100 characters, no control character) is stated for what is recorded and in the pipeline.StageRecord.model contract, but the ticket schema (src/core/schemas.ts HistoryEntry.model is z.string().min(1)) accepts a longer or multi-line model in a hand-edited or merged ticket file and lint says nothing, while PIP-012/S24 prints it in every later brief. PIP-020/R9 and S10 cover cost_usd and duration_s only. Either say that the model bound is not checked on a file already written, or add the model to R9."
        class: C5
      - cites: [PIP-008/R8, pipeline.StageRecord.duration_s, PIP-020/R9, PIP-020/S10]
        text: "Follow-up: the build clamps a duration at 0 (secondsBetween in src/cli/report.ts uses Math.max(0, ...)), so a clock step back never writes a negative duration_s. The spec does not say so. It matters because PIP-020/R9 and S10 now state that a negative duration_s makes the whole ticket file fail lint and vanish from the store (and so from queue, gate and next, not only from stats). Say in PIP-008/R8 that a recorded duration_s is never below 0."
        class: C5
      - cites: [PIP-020/S10, PIP-020/R9, TKT-001/R9]
        text: "Follow-up: S10 is true of the build for the five values it names (cost -1, the text '0.42', .inf, duration 1.5, -5; 1e400 and .nan fail the same way). It states only the lint and stats outcomes. The same ticket also disappears from `spec queue`, `spec gate`, `spec next` and `spec ticket advance`, and `spec stats PROP-231` fails with Unknown PROP-231. That is how TKT-001/R9 and the store already treat a record that fails a known key's check, so nothing here is new, but a tester reading S10 alone will not expect the second part."
        class: C6
      - cites: [PIP-020/R9, PIP-020/S9]
        text: "Follow-up: 'exactly halfway rounded up' is pinned only by 0.125, which is exact in binary. For a decimal sum such as 1.005 the double is below the half cent, so rounding by the exact binary value gives $1.00 and a decimal reading gives $1.01. Say which."
        class: C9
      - cites: [PIP-025/R3, PIP-025/S5]
        text: "Follow-up: 'characters' in the 100-character bound is not defined (UTF-16 code units or code points), and 'control character' is not defined (C0 only, or DEL and C1 as well). S5 pins 100 and 101 plain ASCII characters, a line break and a tab only."
        class: C9
    assumed:
      - new: Is PIP-020/S10 true of the build, not only of the schema?
        value: "Checked against src/core/schemas.ts, src/core/parse/tickets.ts and src/io/ticket-store.ts, and the five values run through the pinned zod 4.6.7 and yaml 2.9.1: yes, a ticket holding any of them fails lint with L020 and is dropped from the store; not run end to end through the CLI"
    duration_s: 382
  - at: 2026-11-12T08:52:43.939Z
    role: tester
    result: done
    summary: "Added model/stats tests; lint/typecheck pass; suite: 2108 passed, 24 failed before implementation"
    verdict: null
    mutations:
      - scenario: CLI-001/S1
        wrong: The usage line describes only stages and finding classes, omitting time per ticket and time and cost per role.
      - scenario: CLI-007/S18
        wrong: spec next returns the selected model but writes no model to the common stage-start record.
      - scenario: CLI-007/S19
        wrong: A restart keeps the previous model when the new harness selects none, or leaves the old started time.
      - scenario: CLI-007/S20
        wrong: A failed start overwrites the stage-start record with the selected model despite leaving the stage stopped.
      - scenario: PIP-008/S20
        wrong: Only done reports record duration and model; blocked or check-refused reports omit them.
      - scenario: PIP-020/S1
        wrong: The ticket table has no time and timed columns and the totals are not followed by role statistics.
      - scenario: PIP-020/S2
        wrong: JSON omits ticket duration and time coverage and returns no per-role statistics.
      - scenario: PIP-020/S3
        wrong: A measured ticket with no stage still gets a blank role table, or a running stage is counted.
      - scenario: PIP-020/S4
        wrong: A history without duration_s is treated as zero seconds and counted as timed.
      - scenario: PIP-020/S6
        wrong: Review totals count only verdicts after the first approval instead of every round.
      - scenario: PIP-020/S8
        wrong: The implementer median includes its unmeasured stage as zero instead of using only 1000 and 2001 seconds.
      - scenario: PIP-020/S9
        wrong: Stats subtracts the 15-minute test-run wait from the recorded 2400-second duration.
      - scenario: PIP-020/S10
        wrong: Stats ignores an invalid record but still measures the ticket and its other role rows.
      - scenario: PIP-025/S1
        wrong: Advance records no model without a transcript, or a no-op ticket start erases the remembered model.
      - scenario: PIP-025/S2
        wrong: The remembered model overrides a transcript model, or the transcript model is not used with its cost.
      - scenario: PIP-025/S3
        wrong: A prior role's model or a model from a stale/older-CLI start is reused for the current stage.
      - scenario: PIP-025/S4
        wrong: Advance clears the remembered model on a no-report, check failure, intake refusal or record failure.
      - scenario: PIP-025/S5
        wrong: Out-of-bound models and negative, non-finite or textual costs are recorded as reported.
      - scenario: PIP-025/S6
        wrong: Advance subtracts the test-run wait from the elapsed start-to-record duration.
    assumed:
      - question: PROP-114#Q1
        value: No model, as today
    duration_s: 2871
  - at: 2026-11-12T09:56:09.399Z
    role: implementer
    result: blocked
    summary: Implemented stage model capture and role time/cost stats; four tester assertions need correction
    verdict: null
    blockers:
      - text: tests/cli/advance-record.test.ts:157 sends a done tester report without adding the PRV-002/S3 test required by check-report, so advance correctly refuses before measuring the stage.
        cites: [PIP-025/S1]
        tests: true
      - text: tests/cli/advance-record.test.ts:224 has the same missing PRV-002/S3 test setup, so its done tester report is correctly refused before checking model reuse.
        cites: [PIP-025/S3]
        tests: true
      - text: tests/cli/advance-record.test.ts:397 has no PRV-002/S3 test in BUG-301's history, so its done implementer report is correctly refused before checking elapsed time.
        cites: [PIP-025/S6]
        tests: true
      - text: tests/cli/advance-record.test.ts:138-142 gives the implementer a started time equal to the tester history entry, then expects its model; PIP-025/R2 requires a strictly later start.
        cites: [PIP-008/S20, PIP-025/S3]
        tests: true
    assumed:
      - question: PROP-114#Q1
        value: No model, as today
      - new: How Unicode model length is counted
        value: Count grapheme clusters as characters; reject Unicode Cc control characters.
      - new: How exact-half cost rounding is interpreted
        value: Round the shortest decimal representation half up to cents for text; keep JSON sums unrounded.
    duration_s: 3802
  - at: 2026-11-12T10:34:07.965Z
    role: tester
    result: done
    summary: Fixed four advance test blockers; full suite 2132 passed; lint and typecheck pass
    verdict: null
    mutations:
      - scenario: CLI-001/S1
        wrong: The usage line describes only stages and finding classes, omitting time per ticket and time and cost per role.
      - scenario: CLI-007/S18
        wrong: spec next returns the selected model but writes no model to the common stage-start record.
      - scenario: CLI-007/S19
        wrong: A restart keeps the previous model when the new harness selects none, or leaves the old started time.
      - scenario: CLI-007/S20
        wrong: A failed start overwrites the stage-start record with the selected model despite leaving the stage stopped.
      - scenario: PIP-008/S20
        wrong: Only done reports record duration and model; blocked or check-refused reports omit them.
      - scenario: PIP-020/S1
        wrong: The ticket table has no time and timed columns and the totals are not followed by role statistics.
      - scenario: PIP-020/S2
        wrong: JSON omits ticket duration and time coverage and returns no per-role statistics.
      - scenario: PIP-020/S3
        wrong: A measured ticket with no stage still gets a blank role table, or a running stage is counted.
      - scenario: PIP-020/S4
        wrong: A history without duration_s is treated as zero seconds and counted as timed.
      - scenario: PIP-020/S6
        wrong: Review totals count only verdicts after the first approval instead of every round.
      - scenario: PIP-020/S8
        wrong: The implementer median includes its unmeasured stage as zero instead of using only 1000 and 2001 seconds.
      - scenario: PIP-020/S9
        wrong: Stats subtracts the 15-minute test-run wait from the recorded 2400-second duration.
      - scenario: PIP-020/S10
        wrong: Stats ignores an invalid record but still measures the ticket and its other role rows.
      - scenario: PIP-025/S1
        wrong: Advance records no model without a transcript, or a no-op ticket start erases the remembered model.
      - scenario: PIP-025/S2
        wrong: The remembered model overrides a transcript model, or the transcript model is not used with its cost.
      - scenario: PIP-025/S3
        wrong: A prior role's model or a model from a stale/older-CLI start is reused for the current stage.
      - scenario: PIP-025/S4
        wrong: Advance clears the remembered model on a no-report, check failure, intake refusal or record failure.
      - scenario: PIP-025/S5
        wrong: Out-of-bound models and negative, non-finite or textual costs are recorded as reported.
      - scenario: PIP-025/S6
        wrong: Advance subtracts the test-run wait from the elapsed start-to-record duration.
    passed: true
    assumed:
      - question: PROP-114#Q1
        value: No model, as today
    duration_s: 2262
  - at: 2026-11-12T10:44:09.176Z
    role: reviewer
    result: done
    summary: "Changes: refused-by-checks keeps the model, the 100-char bound is bypassed by combining marks, S6 test blind to waits"
    verdict: changes
    findings:
      - cites: [PIP-025/R2, PIP-025/S1, PIP-025/R1]
        text: "A report refused by its checks is recorded as a blocked stage (src/cli/report.ts, the `!c.ok` return before the build and commit) but forgetStageStartModel is only called after the commit, so that path never removes the model. Reproduced on a scratch fixture: BUG-301 tester started, start record holds model 'claude-opus-5-5', a report for the wrong role on stdin gives exit 1, history gets {result: blocked, summary: 'invalid report', model: 'claude-opus-5-5'} and .git/spec/stages/BUG-301.json still holds the model. S1 and R2 say the same holds for a report refused by its checks. The test 'PIP-008/S20 ... recorded' checks only the history record for that case, and PIP-025/S1 checks the file for done, blocked and hand-off only, so no test sees it. Forget the model on that path too (it is a recording: the history entry is written), and assert the file in the refused case."
        tests: true
        class: C3
      - cites: [PIP-025/R3, INV-017, PIP-025/S5, pipeline.StageRecord.model]
        text: "The 100-character bound is counted in grapheme clusters (src/core/transcript.ts isRecordedModel, Intl.Segmenter), so a long run of combining marks is one character. Reproduced: a transcript model of 'e' plus 200000 x U+0301 is recorded (200001 code units), the ticket file grows to 400,802 bytes, and the string is shown in every later brief (PIP-012/S24); a transcript or start record can be written by any local process (INV-017), so the bound R3 and INV-017 promise ('so one line at most', bounded) does not hold. Also accepted: U+2028 and U+2029 (not \\p{Cc}) and bidi controls such as U+202E, so a model can still break the line it is shown on. Bound the string by code points (or UTF-16 units) as well as by clusters, and reject line and paragraph separators; the same bound applies in saveStageStart and rememberedModel since both call isRecordedModel. S5 pins only plain ASCII, a line break, a tab and U+0001; add a long combining-mark case and a U+2028 case. The spec should also say what 'character' and 'control character' mean (the spec-review left that as a follow-up); the implementer's choice of clusters is not stated anywhere."
        tests: true
        class: C4
      - cites: [PIP-025/S6, PIP-008/R8, INV-017]
        text: The S6 test does not make a wait happen. It passes a fake clock that returns 12:16 and 12:40 to two now() calls; no other ticket holds the test-run turn, so advance waits for nothing. A build that subtracts the measured wait from the duration (the tester's mutation for S6) measures 0 seconds of wait here and still records 2400, so the test passes on the wrong build. Mutating `const at = now()` to `use.at` does fail it, so it only catches a record time taken before the check. Make the wait real in the test (another run holds the turn, as PIP-009's tests do, released by the test and not by a sleep) and assert the 2400 includes it.
        tests: true
        class: C7
      - cites: [PIP-025/S4, pipeline.RecordFailed, PIP-008/R6]
        text: "advance now restores the ticket file when the build, git add or git commit fails (restoreTicket in src/cli/report.ts) and appends '; could not restore the ticket file: <reason>' to the message. No rule or scenario states either: PIP-025/S4 only says the stage is still running and the model kept, and pipeline.RecordFailed says only that the stage could not be recorded. It is also incomplete: after a pre-commit hook refuses the commit, `git status --porcelain` on the fixture shows 'MM tickets/BUG-301.md', the index holds the recorded stage while the file holds the old text (the restore does not undo `git add`), so a plain `git commit` by a person would commit the recorded stage; the tracker case (ticketsInRepo false) is not restored and the recorded stage stays in the tracker while the model is kept. The spec must say what a failed recording leaves (ticket file, index, tracker, message) before it merges."
        spec: true
        class: C6
      - cites: [PIP-020/R7, PIP-020/R8, PIP-020/S1, PIP-020/S8]
        text: docs/PROCESS-LEDGER.md ('Reading spec stats', its column table and totals text) still lists the old columns and says nothing of the time and timed columns, the per-role table (stages, time, median, timed, cost, costed) or that a cost is shown only where one was recorded. It is the only user-facing description of the output, and this change alters the output; update it.
        class: C9
      - cites: [PIP-020/R9, PIP-020/S9, pipeline.RoleStats.cost_usd, INV-017]
        text: "Follow-up: costs are bounded only as finite and 0 or more, so a forged transcript or ticket file can hold 1e308: two such costs sum to Infinity (text '$Infinity', JSON cost_usd null while costed is 2, which contradicts 'null when none has one'), and 1e21 prints a 22-digit cell. Probed with buildStats. Not reachable by an honest harness; bound the magnitude in R3/R9 or say sums are not guarded."
        class: C5
      - cites: [PIP-020/R9, PIP-020/S9]
        text: "Follow-up: the implementer rounds the shortest decimal text half up (costText in src/core/stats.ts): 0.125 gives $0.13 (as S9), 1.005 gives $1.01, 2.675 gives $2.68, 0.1+0.2 gives $0.30, 0.004999 gives $0.00. The wording 'exactly halfway rounded up' fits this decimal reading, but a reader of the binary value (toFixed(2)) gets $1.00 and $2.67, and S9's 0.125 cannot tell them apart. Say 'the shortest decimal text' in R9, or pin 1.005 in S9."
        class: C9
      - cites: [PIP-025/R2, PIP-025/S4]
        text: "Follow-up: forgetStageStartModel reads the record, then rewrites it; a spec next --restart of the same ticket writing a new record between the read and the write would be overwritten by the old stage and started values. The restart and the advance of one ticket are not meant to overlap, so it is a corner; the write could be done by a rename of a temp file under the same compare."
        class: C3
    assumed:
      - new: Does the change add a git process to spec next or ticket advance?
        value: "No: traced in-process next BUG-301 and advance on a fixture, main and this tree each make 43 and 24 git calls; also tests/dist.test.ts bundle-match test passes on a scratch copy"
      - new: Which reading of 'exactly halfway' did the implementer take?
        value: The shortest decimal text, half up (1.005 gives $1.01, 2.675 gives $2.68); matches the spec's 0.125 example, differs from toFixed(2) on 1.005 and 2.675
    duration_s: 598
  - at: 2026-11-12T10:51:02.511Z
    role: spec-writer
    result: done
    summary: A failed recording is undone whole (PIP-026); model is printable ASCII, cost below 1e6; stage identity by entries
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-026/S1, PIP-026/S3, PIP-008/S18, PIP-025/S4, PIP-020/S10]
        reason: a failed recording now puts back the ticket file, index, generated files, stash and the tracker's copy (TKT-004 put), which PIP-008/S18 and pipeline.RecordFailed now say; PIP-020/S10 states that a ticket failing its schema also leaves queue, gate, next and advance, as TKT-001 already treats it; PIP-002 is unchanged (start-order claim shown by review, not a new PIP-002 scenario, since PIP-002 is not in this ticket and the build already reads it so)
      - item: C2
        outcome: scenarios
        ids: [PIP-025/S3, CLI-007/S18]
        reason: a start record from an older CLI has no 'entries' and so gives no model; stage identity no longer depends on a clock
      - item: C3
        outcome: scenarios
        ids: [PIP-025/S4, PIP-026/S1, PIP-025/S6]
        reason: "a recording undone after a refused commit leaves history and the start record so the next recording uses the model; S6's wait is held by a live process released by an event. Declined: guarding forget against a concurrent restart (read then rewrite), because CLI-007/R10 allows --restart only once the session confirms its delegate stopped and the one session runs advance and restart in turn, never at once"
      - item: C4
        outcome: invariant
        ids: [INV-017]
        reason: model bounded to 1-100 printable ASCII (bytes and one line bounded, no separators or bidi controls), cost to finite 0 <= c < 1e6 so sums never overflow, both on record and in a ticket file; durations can be lengthened or shortened by INV-016's inputs and are never below 0
      - item: C5
        outcome: scenarios
        ids: [PIP-025/S5, PIP-020/S10, PIP-026/S3, PIP-026/S4]
        reason: combining-mark, U+2028, U+202E, DEL, C1, non-ASCII models and 1e6, 1e308 costs refused; a part that cannot be put back is named on a 'not undone:' line and a stash is never dropped unapplied
      - item: C6
        outcome: scenarios
        ids: [PIP-025/S2, PIP-020/S3, PIP-020/S5, PIP-020/S6, PIP-020/S7, PIP-008/S20]
        reason: transcript model and cost, stats totals and errors unchanged; durations as before, clamped at 0 as the build already does
      - item: C8
        outcome: na
        ids: []
        reason: no new fact about another tool; the model names checked are this repository's own delegation config (worker-high-reasoning, worker-average, worker-medium-reasoning) and the claude-code names sonnet, opus, haiku, fable, all printable ASCII
    assumed:
      - question: PROP-114#Q1
        value: No model, as today
      - new: What a failed recording leaves
        value: "nothing: ticket file, tracker copy (second put, note '<ID> <role>: recording undone'), index, generated files and the blocked stage's stash are put back; each part that cannot be is a 'not undone: <part>: <reason>' line on stderr. Checked on a scratch fixture with the worktree's build: a hook-refused commit of a blocked report leaves 'MM tickets/TASK-001.md' and the stage's work in the stash while the stage still runs"
      - new: Model bound
        value: 1 to 100 printable ASCII characters (U+0020-U+007E), for transcript, remembered and ticket-file models alike; lint refuses others as an L020 error
      - new: Cost bound
        value: finite, 0 or more and below 1000000, on record and in a ticket file
      - new: Cost rounding
        value: "the sum's shortest decimal text rounded half up to cents: 1.005 gives $1.01, 2.675 gives $2.68"
      - new: Stage identity
        value: "taken from the spec review's follow-up: 'entries', the history count at the start, must equal the count before the recording; replaces the started-time test"
      - new: Reviewer's tests-only findings and docs/PROCESS-LEDGER.md
        value: "left to the tester and implementer: the spec already says a report refused by its checks forgets the model (PIP-025/S1 now pins the file), and S6 now requires a real wait"
    duration_s: 410
  - at: 2026-11-12T10:55:13.618Z
    role: spec-review
    result: done
    summary: "Changes: PIP-026 (undo of a failed recording) is not needed here and should be its own ticket; narrow PIP-025/S4, R2, PIP-008/S18"
    verdict: changes
    findings:
      - cites: [PIP-026, PIP-026/R1, PIP-026/R2, PIP-025/S4, PIP-025/R2, PIP-008/S18, pipeline.RecordFailed]
        text: "PIP-026 should be its own ticket, and this one needs only a smaller true statement. What it fixes is a bug on main that has nothing to do with a stage's model or cost: after a refused commit (a pre-commit hook, or spec's own git hooks of INS-016), advance leaves the ticket rewritten, the index staged, the report deleted and the work in a stash, and exits 1 (PIP-008/S18 on main says so: 'after the ticket was already updated'). This ticket only came to it because PIP-025/S4 listed pipeline.RecordFailed among the recordings that keep the remembered model with 'the stage is still running'. Drop pipeline.RecordFailed from S4's list and from the 'records nothing' list in R2, and restore PIP-008/S18 and the pipeline.RecordFailed contract to their main text. Nothing is lost: after a failed commit the history already holds the entry, so the start record's 'entries' is one short of the history and its leftover model is never used (the new identity makes that safe); the next start rewrites the file. File the undo as a bug ticket with PIP-026's scenarios as its starting point. The implementer's restoreTicket in src/cli/report.ts (a partial undo of the ticket file only, with a '; could not restore the ticket file' tail) is then also out of this ticket and should be removed with it. A larger undo is more to implement, to test and to get wrong, as the next two findings show."
        class: other
      - cites: [PIP-026/R1, PIP-026/S1, PIP-026/S4, PIP-008/R9]
        text: "If PIP-026 is kept anyway, or when it becomes its own ticket, these gaps need closing first. (1) 'the same command can record the stage again' is false for a report kept by the finish hook: advance deletes the kept report and its transcript before it records (clearReport in src/cli/report.ts, before the stash and the write), so after a failure the stored report is gone (pipeline.NoReport) and the transcript's model and cost are lost; S1 does not say how the report is supplied. Say the kept report, its transcript and the refusal count are put back too, or that the command needs the report again. (2) 'the index is as it was before the command' is only shown for an index with nothing staged; advance runs `git add -A`, so with changes the person had already staged, putting back needs a record of the index taken before (for example its tree) and a scenario for it. (3) The stash is applied back after the failed command ran hooks, the build and `git add`: a hook that rewrites files (a formatter) can make the apply conflict; R2 names the 'not undone: git stash' line but S4 builds it only by a hand-made conflict, and the order of the undo steps (generated files, index, ticket, stash) is not stated, so a failure part-way leaves a state no rule describes. (4) pipeline.RecordFailed also covers the ticket store refusing the write after the stash was made; R1 lists the stash as a step but no scenario shows that case."
        class: C5
      - cites: [PIP-026/R1, PIP-026/S3, PIP-002/R4, tickets.TrackerPut]
        text: "If PIP-026 is kept, concurrency is not stated. R1 does not say the undo runs under the locks the recording ran under (the repository's stash lock of PIP-002/R4 for the stash apply and drop, and the ticket write), so a second `spec ticket start` or advance of another ticket can interleave with the undo's stash apply and with the index restore. The tracker's second put does carry the first put's text as 'previous', so a tracker that changed meanwhile can refuse it, but S3 only shows a refusal 'read only'; say that a changed tracker copy is refused the same way and named on the 'not undone' line, and that the ticket is then left recorded in the tracker while the stage start record keeps its model (the entries identity makes that harmless). S4's 'cannot be written once the commit failed' cannot be built as root with a file mode: the scenario should say how (for example a hook that replaces the file with a directory), as PIP-009/S28 does for a folder."
        class: C3
      - cites: [PIP-025/R2, PIP-025/S3, CLI-007/S18, CLI-007/S19]
        text: "Follow-up: checked the entries identity against every way a history entry is added or removed between a start and its recording, and found no case that loses a legitimate model or uses a wrong one: an answer with --back is refused while a stage runs (TKT-006/S20), `ticket close` and `ticket combine` take only open or blocked tickets, a restart writes no entry and writes the record anew, a sync with the base leaves a running ticket's history alone, and a start by an older CLI leaves no 'entries' (S3 last line). One residue: a ticket held in a tracker is counted from the tracker's copy at the start and at the recording, so a tracker that adds an entry itself (not through spec) would drop the model, which is the safe direction."
        class: C3
      - cites: [PIP-025/S6, PIP-008/R8, INV-017]
        text: "Follow-up: S6 now makes the wait real (a live process holds the turn and releases it on an event), but the example's 12:31 release time is only a number: advance reads the clock once for the record (12:40) after the checks, so a build that subtracts the measured wait from the duration would measure a real wait of a few hundred milliseconds and still record 2400 seconds, which the reviewer found in the first test. For the scenario to fail such a build, the clock the wait is measured with must advance by 15 minutes while the turn is held (the test's fake clock ticks when the holder releases). Say that in the Given, or say the scenario only shows that the test command waited and the duration is the clock's difference."
        class: C7
      - cites: [PIP-020/S9, PIP-020/R9]
        text: "Follow-up: the newly pinned rounding recomputes: 1.005 gives $1.01, 2.675 gives $2.68 and 0.004999 gives $0.00 by the shortest decimal text (checked: 1 + 0.005 is 1.005 and 2 + 0.675 is 2.675 in doubles, 0.1 + 0.2 is 0.30000000000000004 and gives $0.30, 0.125 gives $0.13, while toFixed(2) gives 1.00 for 1.005). S9 says 'a role whose recorded costs sum to' those values without giving the records, so a tester must choose them; name the records (for example one cost of 1.005) so two testers pin the same input."
        class: C9
      - cites: [PIP-020/S10, PIP-025/S5, PIP-025/R3, TKT-001/R9]
        text: "Follow-up: S10 and S5 values hold against the pinned zod and yaml: a cost of -1, 1000000, 1e308, the text '0.42' or .inf, a duration of 1.5 or -5, a model of '' or one with U+2028 all fail the bound, and the lint refusal of a model or a cost of 1000000 or more is not in the worktree's schema yet (src/core/schemas.ts still accepts any non-empty model and any cost of 0 or more), so the implementer must add it there and in the transcript check; the tickets already in this repository stay valid, as assumed above."
        class: C6
    assumed:
      - new: What does main do today when the commit of a recording is refused?
        value: "Read from src/cli/report.ts on main and in the worktree: the ticket file is already rewritten (ws.store.update), the report and its transcript are already deleted (clearReport), the generated files are rebuilt and `git add -A` has staged the tree, a blocked stage's work is in the stash; the command exits 1 with 'git commit failed: ...'. The stage is then no longer running (the file says blocked or open), so main's PIP-008/S18 text 'after the ticket was already updated' is true and PIP-025/S4's 'the stage is still running' is not, without an undo"
      - new: Does the entries count lose a legitimate model, or use a wrong one?
        value: "No case found: history only changes between a start and its recording through a recording; `ticket answer --back` is refused while a stage runs (TKT-006/S20), `ticket close` and `ticket combine` take only open or blocked tickets, `spec next --restart` writes no entry, and a sync with the base does not touch a running ticket's history; a leftover model after a failed commit has entries one short of the history and is never used"
      - new: Do existing tickets in this repository stay valid under the new bounds?
        value: "Yes: no ticket under tickets/ holds a model or a cost_usd in a history record (the two grep hits are prose), and every duration_s there is a whole number of 0 or more; checked by reading the files, since the bounds are not yet in the lint code of the worktree"
    duration_s: 248
  - at: 2026-11-12T10:57:26.192Z
    role: spec-writer
    result: done
    summary: Undo taken out (PIP-026 deleted, PIP-008/S18 and RecordFailed as on main); S4/R2 say a failed commit's model goes unused
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-025/S4, PIP-008/S18]
        reason: PIP-008/S18 and pipeline.RecordFailed are back to main's text, so their readers see no change; PIP-025/S4 states what a refused commit leaves for the model on main's behaviour (ticket already updated)
      - item: C2
        outcome: scenarios
        ids: [PIP-025/S3, CLI-007/S18]
        reason: "unchanged from the approved round: an older CLI's start record has no 'entries' and gives no model"
      - item: C3
        outcome: scenarios
        ids: [PIP-025/S4, PIP-025/S6]
        reason: a failed commit adds the history entry, so the leftover model no longer matches 'entries' and the next start rewrites the record; S6's clock moves by the 15 waited minutes while the turn is held, so a build that subtracts the wait records 1500 and fails
      - item: C4
        outcome: invariant
        ids: [INV-017]
        reason: "unchanged from the approved round: model printable ASCII 1-100, cost finite 0 <= c < 1e6, duration never below 0 and decides only PIP-002/R2's order"
      - item: C5
        outcome: scenarios
        ids: [PIP-025/S5, PIP-020/S10]
        reason: unchanged from the approved round
      - item: C6
        outcome: scenarios
        ids: [PIP-008/S18, PIP-025/S2, PIP-020/S3, PIP-020/S5]
        reason: the failed-recording behaviour of main is kept as main states it; stats totals and errors unchanged
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool is new in this round
    assumed:
      - question: PROP-114#Q1
        value: No model, as today
      - new: Tombstone or retired entry for PIP-026
        value: "deleted outright: it was added by this branch and never reached main, and FORMAT.md's never-reuse rule and LNT-018/R3 apply to units the base or merge base knows; lint --base main reports no L035. The undo is filed as its own proposal"
      - new: Does a failed commit forget the model?
        value: "not promised either way: the history already holds the entry, so 'entries' no longer matches and no recording uses a leftover model; the next start rewrites the record"
      - new: S9's rounding inputs
        value: PROP-232 with one recorded cost each of 1.005 (spec-writer), 2.675 (tester) and 0.004999 (implementer)
    duration_s: 129
  - at: 2026-11-12T11:00:07.456Z
    role: spec-review
    result: done
    summary: "Changes: PIP-026 is gone cleanly; PIP-025/S4's new hook step cannot be built as written (staged work, wrong next stage)"
    verdict: changes
    findings:
      - cites: [PIP-025/S4, PIP-025/R2, PIP-002/R3, PIP-001/S5, PIP-008/S16]
        text: "The new step of S4 ('a pre-commit hook that exits 1 refuses the stage's commit ... the next stage of BUG-301 is started by `spec ticket start BUG-301 implementer`') cannot be built from its Given, which is the BUG-301 tester stage of S1. Read against src/cli/report.ts: (1) the report's result is not named. With a blocked report (the one the worktree's existing test uses), the stage's work goes to the stash, the ticket is blocked on a question and the next stage is the tester again (PIP-001/S5), so starting the implementer is refused. (2) With a done tester report, a bug's tester has added a failing test (PIP-006/R2), the failed commit follows `git add -A`, and that work is left staged in the tree; `spec ticket start` refuses a tree with changes outside the tickets folder (PIP-002/R3: 'cannot start the implementer stage of BUG-301: uncommitted changes in ...'), so the observable is never reached. Only a stage whose recording changes nothing outside the tickets folder works (PIP-008/S16), for example a proposal's spec review with an approve verdict, whose next stage is the tester. Name such a stage and a done report in the step, or the test cannot be written. Second, the observable does not tell the entries test from its absence: any `spec ticket start` writes the stage start record anew without a model, and the next stage has another role, so a build that ignored 'entries' gives the same result. Either accept that the entries test is a second guard no scenario shows (say so in R2, and keep the step as the check that nothing records a model for the next stage), or give the step a case where only the entries test decides, if one exists. The worktree's own test for this step (tests/cli/advance-record.test.ts, PIP-025/S4, record-failed block) and its restoreTicket in src/cli/report.ts still assume the removed undo (they expect the stage still in_progress after the refused commit); both follow the spec now and need changing by the tester and the implementer."
        class: C7
      - cites: [PIP-025/S6, PIP-008/R8, INV-017]
        text: "Follow-up: S6 is now buildable. The 'one clock' is the injected now() of advance, which the correct build reads once (for the record, 12:40); a build that also read it when it began and when the turn was released would measure the 15 minutes and could subtract them. The test-run turn code measures its own waiting with Date.now (src/io/test-run-turn.ts), not that clock, so the test needs a clock whose reading jumps when the holder releases, as the Given says; the tester should build it that way, and the scenario does not need more words."
        class: C7
      - cites: [PIP-025/R2, PIP-025/S3, CLI-007/S18, CLI-007/S19]
        text: "Follow-up: the entries identity is as approved last round. One rare residue stays: a person who undoes the failed commit's effect by hand (restores the ticket file with git, so the history is back to 0 entries) gets the leftover model used for the repeated recording, which is the right model, since the stage start record is unchanged; nothing to specify."
        class: C3
    assumed:
      - new: Did the removal of PIP-026 leave anything behind?
        value: "No: PIP-026 is cited nowhere in spec/, src/, tests/ or docs/; PIP-008/S18 and pipeline.RecordFailed read as on main (git diff main shows S18 and the contract section unchanged, apart from the stats contracts that moved to contracts/stats.md); no sentence of the delta promises an undo any more; `lint --base main` reports 0 errors and no L035"
      - new: Do S6 and S9 recompute?
        value: "Yes. S6: 12:00 to 12:40 is 2400 s; with the clock at 12:16 when advance begins and 12:31 when the turn is released, a build that subtracted that 15 minutes would record 2400 - 900 = 1500. S9: 1 + 0.005 is 1.005, 2 + 0.675 is 2.675, so costs of 1.005, 2.675 and 0.004999 round by their shortest decimal text to $1.01, $2.68 and $0.00; 0.1 + 0.2 is 0.30000000000000004 and gives $0.30, 0.125 gives $0.13, durations 300+60+240+60+2400 = 3060 s = 0:51:00"
    duration_s: 158
  - at: 2026-11-12T20:42:53.705Z
    role: spec-writer
    result: done
    summary: Failed-commit step moved to PIP-025/S7 on an approving spec review, built on chat-mini; R2 says entries is a second guard
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-025/S7, PIP-008/S18]
        reason: S7 uses PIP-008/S18's 'ticket already updated' as main states it and PIP-002/R3's tickets-folder exception for the next start; nothing else changed this round
      - item: C2
        outcome: scenarios
        ids: [PIP-025/S3]
        reason: unchanged from the approved rounds
      - item: C3
        outcome: scenarios
        ids: [PIP-025/S7, PIP-025/S3]
        reason: "S7: after a refused commit the record keeps model and entries one short of the history and the next start rewrites it; S3's last step is the case where only the entries test decides"
      - item: C4
        outcome: invariant
        ids: [INV-017]
        reason: unchanged from the approved rounds
      - item: C5
        outcome: scenarios
        ids: [PIP-025/S5, PIP-020/S10]
        reason: unchanged from the approved rounds
      - item: C6
        outcome: scenarios
        ids: [PIP-008/S18, PIP-025/S2]
        reason: unchanged from the approved rounds
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool is new in this round
    assumed:
      - question: PROP-114#Q1
        value: No model, as today
      - new: Is S7 buildable?
        value: "Ran it on scratch copies of fixtures/chat-mini (PROP-201 with one done spec-writer entry, a pre-commit hook that exits 1, an approving spec-review report). The worktree's CLI: spec next PROP-201 --harness astro started spec-review with model worker-review and wrote {stage, started, model} (no entries yet: the build predates last round's spec), and its advance failed 'git commit failed: commits are closed' exit 1 but still restored the ticket file (MM), the restore the spec dropped. Main's CLI on a fresh copy, giving main's failed-commit behaviour: same failure and exit 1, tickets/PROP-201.md staged with status open, stage null and 2 history entries; then 'spec ticket start PROP-201 tester' was accepted and the record became {stage tester, started} with no model"
      - new: A case where only the entries test decides after a failed commit
        value: "none buildable: running the same advance again finds no stage running (PIP-008/S17), every start of this version rewrites the record, a no-op start needs the same role already running, and an older CLI that never writes the record cannot be had in seconds; so R2 says entries is a second guard there, and S3's last step (a record whose role and model match and only entries does not) is the case it alone decides"
    duration_s: 218
  - at: 2026-11-12T20:44:40.511Z
    role: spec-review
    result: done
    summary: "Approve: S7 builds step by step on the real build and its Thens are checkable; S3's last step isolates the entries test"
    verdict: approve
    findings:
      - cites: [PIP-025/S7, PIP-002/R3, PIP-008/S16]
        text: "Follow-up: S7's step 'the stage changed nothing outside the tickets folder' also depends on the rebuild of the generated files changing nothing: advance rebuilds them and runs `git add -A` before the commit, and the dirt check of `spec ticket start` (stageChanges in src/io/stash.ts) leaves out only the tickets folder and the worktree's setup paths, not generated files. The fixture must therefore hold generated files that are already current, so the tester should say so in the test's setup; the scenario text needs no change."
        class: C9
      - cites: [PIP-025/S7, PIP-025/R1]
        text: "Follow-up: the last step records the tester stage 'with no transcript once the hook lets commits through' without naming the report. Any report works (R1 holds for every recorded stage), so a blocked tester report is the cheapest; a done tester report would need the tester's checks (failing tests, mutations), which is far more setup than the scenario is about."
        class: C9
      - cites: [PIP-025/S7, PIP-002/R3]
        text: "Follow-up: S7's accepted start holds only when the ticket branch already has the base's tip. After a refused commit the ticket file stays staged, and a start that must first sync the branch with a base that moved refuses a staged change ('cannot sync ... staged changes in tickets/PROP-201.md', syncWithBase in src/cli/tickets.ts). That is part of what a failed commit leaves on main today, and belongs to the separate undo ticket (PROP-120), not to this one."
        class: C3
      - cites: [PIP-025/S3, PIP-025/R2]
        text: "Follow-up: S3's last step is buildable and isolates the entries test: a tester starts the implementer stage with `spec ticket start` (so the history holds the recorded tester entry), overwrites the start record by hand with stage implementer, a valid model and entries 0 (or without entries), and records the implementer with no transcript. The role matches, the model is within R3 and the start record is not rewritten by any start, so only the entries comparison can reject it; R2's sentence 'S3's last step is the case where it alone decides' is right. No build writes entries yet, so the tester writes the file by hand in S7 and S3 alike, as the spec-writer says."
        class: C7
    assumed:
      - new: Does S7 hold against the build?
        value: "Checked against src/cli/report.ts, src/cli/tickets.ts, src/io/stash.ts and src/core/pipeline.ts, and against tests/cli/ticket-lanes-suite.ts, which already runs a full-lane proposal through spec-review 'approve' (next is 'tester', start of 'tester' accepted, lines 118-119). After a refused commit the ticket file is already rewritten (status open, stage null, a second history entry), the stage start record is untouched because forgetStageStartModel runs only after the commit, stderr is 'git commit failed: ' plus git's stderr or, when the hook wrote to stdout, its stdout, and the exit code is 1; the start of the tester is not refused by PIP-002/R3, whose check leaves out the tickets folder, and rewrites the record as stage tester without model (saveStageStart, since the ticket is not already running that stage). Not run end to end on a scratch fixture"
    duration_s: 103
  - at: 2026-11-12T21:30:16.181Z
    role: tester
    result: done
    summary: Added coverage for stage entries, bounds, waits, rounding and failed commits; 2124 pass, 9 expected red
    verdict: null
    mutations:
      - scenario: CLI-001/S1
        wrong: The usage text omits ticket time and per-role time and cost.
      - scenario: CLI-007/S18
        wrong: spec next remembers a model but omits the history-entry count from its start record.
      - scenario: CLI-007/S19
        wrong: A restart writes the selected model but keeps no current history-entry count in its start record.
      - scenario: CLI-007/S20
        wrong: A start refused for uncommitted work overwrites the previous start record with the selected model.
      - scenario: PIP-008/S20
        wrong: A clock before the stage start records a negative duration instead of zero.
      - scenario: PIP-020/S1
        wrong: The ticket table omits time and timed columns or the role table after totals.
      - scenario: PIP-020/S2
        wrong: JSON omits ticket duration coverage or the per-role statistics.
      - scenario: PIP-020/S3
        wrong: A running stage is counted or a measured ticket without stages gets a role table.
      - scenario: PIP-020/S4
        wrong: A missing duration in an older record is treated as zero and counted as timed.
      - scenario: PIP-020/S6
        wrong: Review rounds stop counting after the first approval.
      - scenario: PIP-020/S8
        wrong: The implementer median includes an unmeasured stage as zero.
      - scenario: PIP-020/S9
        wrong: Text costs use binary rounding, so 1.005 and 2.675 display as $1.00 and $2.67.
      - scenario: PIP-020/S10
        wrong: Out-of-bound costs and models pass lint and their ticket is still included in stats and commands.
      - scenario: PIP-025/S1
        wrong: A report refused by checks is recorded but leaves its remembered model in the start record.
      - scenario: PIP-025/S2
        wrong: The remembered model overrides a valid transcript model or the transcript cost is omitted.
      - scenario: PIP-025/S3
        wrong: Stage identity uses timestamps instead of history-entry counts, reusing stale models or rejecting a matching count.
      - scenario: PIP-025/S4
        wrong: A no-report, check-could-not-run or intake refusal consumes the remembered model and entry count.
      - scenario: PIP-025/S5
        wrong: A transcript or configured model outside printable ASCII bounds, or a cost at least 1000000, is recorded.
      - scenario: PIP-025/S6
        wrong: Advance subtracts a measured test-run wait from the elapsed start-to-record duration.
      - scenario: PIP-025/S7
        wrong: After a refused commit, advance restores the old ticket instead of retaining the recorded history for the next start.
    assumed:
      - question: PROP-114#Q1
        value: No model, as today
    duration_s: 2732
  - at: 2026-11-12T22:03:17.517Z
    role: implementer
    result: blocked
    summary: Implemented entry-count identity, ASCII/cost bounds and stats/docs; three tester setups still conflict
    verdict: null
    blockers:
      - text: "tests/cli/advance-record.test.ts:173 writes a model without entries, then expects it at line 176; PIP-025/R2 says a start record without entries cannot supply a model. Add entries: 0 to the fixture."
        cites: [PIP-008/S20, PIP-025/S3]
        tests: true
      - text: tests/cli/advance-record.test.ts:224-226 appends the hidden PRV-002/S3 test and submits a valid done tester report, which passes check-report instead of reaching the refused-record case the test expects. Make the fixture actually fail a report check.
        cites: [PIP-025/S1]
        tests: true
      - text: tests/cli/advance-record.test.ts:620 runs ticket start from fx.repo after spec next created entry.worktree; the branch is checked out in that other worktree, so PIP-002 correctly refuses. Run start in the returned worktree.
        cites: [PIP-025/S7]
        tests: true
    assumed:
      - question: PROP-114#Q1
        value: No model, as today
      - new: How configured model whitespace is handled
        value: Preserve non-empty configured model text for output and bounds validation, rather than normalizing an out-of-bounds value into a recordable one.
    duration_s: 1978
  - at: 2026-11-12T22:23:08.246Z
    role: tester
    result: done
    summary: 2133 pass; lint/typecheck pass; wrong-expectation probes reached PIP-008/S20 and PIP-025/S1-S7
    verdict: null
    mutations:
      - scenario: CLI-001/S1
        wrong: The usage text omits ticket time and per-role time and cost.
      - scenario: CLI-007/S18
        wrong: spec next remembers a model but omits the history-entry count from its start record.
      - scenario: CLI-007/S19
        wrong: A restart writes the selected model but keeps no current history-entry count in its start record.
      - scenario: CLI-007/S20
        wrong: A start refused for uncommitted work overwrites the previous start record with the selected model.
      - scenario: PIP-008/S20
        wrong: A clock before the stage start records a negative duration instead of zero.
      - scenario: PIP-020/S1
        wrong: The ticket table omits time and timed columns or the role table after totals.
      - scenario: PIP-020/S2
        wrong: JSON omits ticket duration coverage or the per-role statistics.
      - scenario: PIP-020/S3
        wrong: A running stage is counted or a measured ticket without stages gets a role table.
      - scenario: PIP-020/S4
        wrong: A missing duration in an older record is treated as zero and counted as timed.
      - scenario: PIP-020/S6
        wrong: Review rounds stop counting after the first approval.
      - scenario: PIP-020/S8
        wrong: The implementer median includes an unmeasured stage as zero.
      - scenario: PIP-020/S9
        wrong: Text costs use binary rounding, so 1.005 and 2.675 display as $1.00 and $2.67.
      - scenario: PIP-020/S10
        wrong: Out-of-bound costs and models pass lint and their ticket is still included in stats and commands.
      - scenario: PIP-025/S1
        wrong: A report refused by checks is recorded but leaves its remembered model in the start record.
      - scenario: PIP-025/S2
        wrong: The remembered model overrides a valid transcript model or the transcript cost is omitted.
      - scenario: PIP-025/S3
        wrong: Stage identity uses timestamps instead of history-entry counts, reusing stale models or rejecting a matching count.
      - scenario: PIP-025/S4
        wrong: A no-report, check-could-not-run or intake refusal consumes the remembered model and entry count.
      - scenario: PIP-025/S5
        wrong: A transcript or configured model outside printable ASCII bounds, or a cost at least 1000000, is recorded.
      - scenario: PIP-025/S6
        wrong: Advance subtracts a measured test-run wait from the elapsed start-to-record duration.
      - scenario: PIP-025/S7
        wrong: After a refused commit, advance restores the old ticket instead of retaining the recorded history for the next start.
    passed: true
    assumed:
      - question: PROP-114#Q1
        value: No model, as today
    duration_s: 1174
  - at: 2026-11-12T22:30:07.039Z
    role: reviewer
    result: done
    summary: "Changes: config model no longer trimmed (main trimmed it) and queue/gate now hide a ticket main listed as blocked"
    verdict: changes
    findings:
      - cites: [CLI-007/R17, PIP-025/S5, PIP-025/R3]
        text: "src/core/schemas.ts changed DelegationSchema from z.string().trim().min(1) to z.string().refine(...), so a delegation model is no longer trimmed. No rule asks for it; it is a change of how config.json is read. Probed on both CLIs with delegation {astro: {implementer: ' opus '}}: main's spec next gives model 'opus' and writes a start record with no model; this tree gives ' opus ' (blanks kept), and writes it into the start record as the remembered model; under the claude-code harness ' opus ' now fails isValidDelegationModel (exact match to a known model) where 'opus' passed, so a config that worked reports the model as missing. It was forced by the PIP-025/S5 test, which loops the transcript edge cases (including 'claude' + U+2028, which trim strips) through config.json and asserts spec next selects each string untrimmed; with the old schema restored that test fails on 'claude' against 'claude\\u2028'. S5 names only 'claude-opüs' for a configured model, so the test asks for more than the spec says. Restore the trim and have the test expect the trimmed value for the U+2028 case (or use only cases trim keeps)."
        tests: true
        class: C6
      - cites: [PIP-020/S10, PIP-020/R9, TKT-001/R9]
        text: "S10's new line 'like any ticket file that fails its schema, PROP-231 is left out of spec queue, spec gate, spec next and spec ticket advance' is not true of main for queue and gate, and the code made it true for three fields only (hasInvalidMeasuredStage in src/core/parse/tickets.ts, queue.ts, gateFor in src/cli/tickets.ts). Probed with main's bundle on a fixture with BUG-302 (cost_usd -1) and BUG-303 (status bogus): main's spec queue lists both as '(does not parse)' with 'schema BUG-30x: ...' and spec gate says 'not ready' with the schema message and the fix; this tree lists only BUG-303, and spec gate BUG-302 says 'Unknown BUG-302. Did you mean BUG-301?' with the usage text. So a ticket with a hand-edited cost, duration or model (even a running one) silently vanishes from the queue and loses the message that says what to fix, while any other schema failure still shows; a file with such a field and another schema error loses both messages. stats, advance and next already left such a file out on main, so only the queue and gate parts are new. Drop the sentence from S10 and the queue.ts and gateFor changes (R9 then says what main does: L020 from lint, not measured by stats), or state the new queue and gate behaviour as its own scenario and say why those three fields differ."
        spec: true
        class: C6
      - cites: [PIP-025/R2, PIP-025/S4]
        text: "Follow-up: forgetStageStartModel (src/io/ticket-state.ts) now writes a temp file and compares before the rename, which narrows my earlier race follow-up; a restart landing between the compare and the rename can still be overwritten. A restart and an advance of one ticket are not meant to overlap, so it stays a corner."
        class: C3
    assumed:
      - new: Do the first-round findings hold on the built CLI?
        value: "Yes, run against .spec/bin/spec.cjs of the worktree on scratch fixtures: a report refused by its checks leaves {stage, started} only; a 200001-unit combining-mark model, U+2028, U+202E give no model through a transcript and through a hand-written start record; costs 1e308 and 1000000 are not recorded, 999999.99 and 0 are; a ticket file with two 1e308 costs fails lint L020 and is not measured; src/cli/report.ts on the failed-recording path equals main's, no restoreTicket"
      - new: Entries identity probed on the built CLI
        value: right role and model with entries 0 against 1 history entry, no entries, entries '1' and 1.5 record no model; entries 1 against 1 records it; spec next, a restart (new started, entries kept) and a restart with no model (record holds only stage and started) behave as R2 and S3 say
      - new: Git processes for spec next and spec ticket advance
        value: "43 and 24 in-process on main and on this tree (traced), unchanged; lint --ci with the worktree's CLI: 0 errors, so no existing ticket file fails the new schema bounds; build-output-matches-bundles test passes"
      - new: Mutations tried on a scratch copy of the tests
        value: forget removed from the refused path (PIP-008/S20 and PIP-025/S1 fail), entries check removed (S3 fails), printable range widened to U+00FE (S5 fails), advance time taken at its begin instead of the recording (S6 fails), forget moved before the commit (S7 fails); S3's steps, S6's event-driven wait and S7's exact states all reach the behaviour under test
    duration_s: 415
  - at: 2026-11-13T06:40:44.364Z
    role: spec-writer
    result: done
    summary: S10/R9 now claim only lint L020 and stats, queue cites TKT-010/S7; R3 bounds a configured model as config yields it, trimmed
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-020/S10, TKT-010/S7]
        reason: S10 no longer says queue, gate, next or advance hide the ticket; R9 cites TKT-010/S7 for the base's queue line ('(does not parse)' with the schema reason), which this ticket leaves as it is
      - item: C2
        outcome: scenarios
        ids: [PIP-025/S5]
        reason: R3 now says a configured model is bounded as config.json yields it, trimmed as on the base; S5 names only the non-ASCII 'claude-opüs' for a configured model
      - item: C3
        outcome: scenarios
        ids: [PIP-025/S7, PIP-025/S3]
        reason: unchanged from the approved rounds
      - item: C4
        outcome: invariant
        ids: [INV-017]
        reason: unchanged from the approved rounds
      - item: C5
        outcome: scenarios
        ids: [PIP-025/S5, PIP-020/S10]
        reason: S10's outcomes are now lint L020 and stats only
      - item: C6
        outcome: scenarios
        ids: [TKT-010/S7, PIP-020/S5]
        reason: the base's queue and gate behaviour for a ticket that fails its schema stays as TKT-010/S7 and the gate state it
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool is new in this round
    assumed:
      - question: PROP-114#Q1
        value: No model, as today
      - new: What the base and this branch do with a ticket holding cost_usd -1
        value: "Ran on a scratch copy of fixtures/chat-mini with BUG-302 holding a done tester record with cost_usd -1. Main's CLI: spec queue lists 'BUG-302 unknown · (does not parse)' under Blocked with 'schema BUG-302: history[0].cost_usd: Too small: expected number to be >=0'; spec gate BUG-302 says 'not ready' with that message and the fix; spec stats BUG-302 says 'Unknown BUG-302. Did you mean BUG-301?' exit 2. Worktree's CLI: queue omits BUG-302, gate says 'Unknown BUG-302.', stats --format json has no entry for it. So S10 and R9 now state only lint and stats, and the implementer's queue and gate changes go"
      - new: Was PIP-025/S5 or R3 ambiguous about a configured model?
        value: "S5 already named only 'claude-opüs' for a configured model; R3 did not say the bound applies to the trimmed value config.json yields, so one clause was added: a configured model is bounded as the config yields it, trimmed as before this ticket (' opus ' is 'opus')"
    duration_s: 29434
  - at: 2026-11-13T06:41:52.013Z
    role: spec-review
    result: done
    summary: "Approve: R9 and S10 now claim only what the base does (TKT-010/S7 pins the queue line); R3's trimmed configured model matches main's schema"
    verdict: approve
    findings:
      - cites: [PIP-020/S10, PIP-020/R9, TKT-010/S7]
        text: "Follow-up: S10's remaining outcomes are true of the build and each is a value a test can check: lint gives an L020 error for the file (the schema failure is reported as L020 by parseTicket), `spec stats --format json` has no entry for PROP-231 (the parse drops the file, and cmdStats measures only what the store holds), the roles hold only PROP-220's stages with the pinned tester row, and `spec stats PROP-231` fails with tickets.UnknownTicket because the ID is not among the store's tickets. S10 does not pin that `spec queue` lists the file, which R9 now cites TKT-010/S7 for; a test for that would be TKT-010's, not this ticket's. No other sentence in the delta (PIP-020, PIP-025, INV-017, the contracts, CLI-007) still says that queue, gate, next or advance hide such a file: searched the spec for 'read by no command', 'left out of' and the like."
        class: C6
      - cites: [PIP-025/R3, PIP-025/S5, CLI-007/R17]
        text: "Follow-up: R3's clause 'trimmed as before this ticket' is right for a delegation model read through the config schema. A model that trims to nothing never reaches R3 (the schema's min(1) refuses it), and a model of 101 characters with spaces at both ends that trims to 100 is accepted, which is what 'as the config yields it' says; S5 pins only 'claude-opüs' for a configured model, so a test of the trim itself (' opus ' recorded as 'opus') is the tester's choice, not a scenario of this ticket."
        class: C9
    assumed:
      - new: Is the queue sentence of R9 true of the base?
        value: "Yes: TKT-010/S7 pins a queue entry with title '(does not parse)', type 'unknown' and a reason starting 'schema <ID>: ...' for a ticket file that fails its schema (R4), and src/core/queue.ts line 67 builds it from the store's findings for unparsed files, so a file failing the cost, duration or model bounds is listed the same way; TKT-010/S7 uses a bad type, which R9 covers by 'as for any other schema error'"
      - new: Is R3's configured-model clause true of the base?
        value: "Yes: src/core/schemas.ts on main reads a delegation model with z.string().trim().min(1) (lines 62 and 63, the plain and the per-role form), so ' opus ' reaches `spec next` as 'opus'"
    duration_s: 64
  - at: 2026-11-13T08:23:45.364Z
    role: tester
    result: done
    summary: 2131 pass; two intended regressions red; lint/typecheck pass
    verdict: null
    mutations:
      - scenario: CLI-001/S1
        wrong: The usage text omits ticket time and per-role time and cost.
      - scenario: CLI-007/S18
        wrong: spec next remembers a model but omits the history-entry count from its start record.
      - scenario: CLI-007/S19
        wrong: A restart writes the selected model but keeps no current history-entry count in its start record.
      - scenario: CLI-007/S20
        wrong: A start refused for uncommitted work overwrites the previous start record with the selected model.
      - scenario: PIP-008/S20
        wrong: A clock before the stage start records a negative duration instead of zero.
      - scenario: PIP-020/S1
        wrong: The ticket table omits time and timed columns or the role table after totals.
      - scenario: PIP-020/S2
        wrong: JSON omits ticket duration coverage or the per-role statistics.
      - scenario: PIP-020/S3
        wrong: A running stage is counted or a measured ticket without stages gets a role table.
      - scenario: PIP-020/S4
        wrong: A missing duration in an older record is treated as zero and counted as timed.
      - scenario: PIP-020/S6
        wrong: Review rounds stop counting after the first approval.
      - scenario: PIP-020/S8
        wrong: The implementer median includes an unmeasured stage as zero.
      - scenario: PIP-020/S9
        wrong: Text costs use binary rounding, so 1.005 and 2.675 display as $1.00 and $2.67.
      - scenario: PIP-020/S10
        wrong: Stats measures an out-of-bound ticket or lint does not report its L020 error.
      - scenario: PIP-025/S1
        wrong: A report refused by checks is recorded but leaves its remembered model in the start record.
      - scenario: PIP-025/S2
        wrong: The remembered model overrides a valid transcript model or the transcript cost is omitted.
      - scenario: PIP-025/S3
        wrong: Stage identity uses timestamps instead of history-entry counts, reusing stale models or rejecting a matching count.
      - scenario: PIP-025/S4
        wrong: A no-report, check-could-not-run or intake refusal consumes the remembered model and entry count.
      - scenario: PIP-025/S5
        wrong: A configured model is remembered without bounds or trimming, so 'claude-opüs' is stored or ' opus ' stays padded.
      - scenario: PIP-025/S6
        wrong: Advance subtracts a measured test-run wait from the elapsed start-to-record duration.
      - scenario: PIP-025/S7
        wrong: After a refused commit, advance restores the old ticket instead of retaining the recorded history for the next start.
      - scenario: TKT-010/S7
        wrong: Queue omits schema-invalid measurement tickets instead of listing them as '(does not parse)' with the schema reason.
    assumed:
      - question: PROP-114#Q1
        value: No model, as today
    duration_s: 6110
  - at: 2026-11-13T08:41:58.346Z
    role: implementer
    result: done
    summary: Restored delegation trimming and schema-invalid ticket queue and gate behavior
    verdict: null
    assumed:
      - question: PROP-114#Q1
        value: No model, as today
    duration_s: 1090
  - at: 2026-11-13T08:44:46.875Z
    role: reviewer
    result: done
    summary: "Approve: delegation trim and queue/gate listing are as on main, bounds and tests hold; one rarer follow-up"
    verdict: approve
    findings:
      - cites: [PIP-025/R2, PIP-025/S4]
        text: "Follow-up: forgetStageStartModel (src/io/ticket-state.ts) compares the record against a temp copy before renaming it; a spec next --restart of the same ticket landing between that compare and the rename can still be overwritten. A restart and an advance of one ticket are not meant to overlap, so it stays a corner; unchanged since the last round."
        class: C3
    assumed:
      - new: Is the diff of the four files against main only what this ticket needs?
        value: "Yes: schemas.ts differs from main only by the model and cost bounds on HistoryEntry (DelegationSchema is as on main, z.string().trim().min(1)); queue.ts and parse/tickets.ts have no diff against main; tickets.ts only passes the model and the entries count to startLocked and saveStageStart; no hasInvalidMeasuredStage anywhere"
      - new: Probes of the first finding on the built CLI of the worktree (.spec/bin/spec.cjs)
        value: "delegation ' opus ' gives model 'opus' from spec next with a start record {model: 'opus', entries: 0}, under harness astro and under claude-code (accepted as before); 'claude-opüs' is returned as the selected model and the start record has no model; 'claude' + U+2028 trims to 'claude' as on main; a 100-character model padded with spaces is remembered trimmed; blanks only give model null"
      - new: Probes of the second finding on the built CLI
        value: "a ticket with cost_usd -1 and one with a bogus status are both listed by spec queue as '(does not parse)' with their schema messages (history[0].cost_usd: must be finite, nonnegative and below 1000000 / status: Invalid option ...), spec gate says 'not ready' with the message and the fix for both, lint reports L020 for both, spec stats leaves both out and spec stats BUG-302 fails 'Unknown BUG-302' exit 2, as the spec now says"
      - new: Tests run and mutated
        value: advance-record, gate-queue-scenarios and stats test files pass on a scratch copy and the build-output-matches-bundles test passes; the delegation trim removed fails PIP-025/S5, a cost_usd parse error skipped in the queue fails TKT-010/S7; the full suite was not run
    duration_s: 165
---
Review of 2026-11-10. None of the 114 tickets has a model or a cost_usd in any history record, though pipeline.StageRecord has both and ticket advance takes --transcript. The session-driven flow never passes a transcript, and a harness such as Astro has none to pass. So the project cannot say what a ticket costs or which model ran a stage, and the claim in docs/SELF-HOSTING.md that a cheaper model is the biggest cost lever cannot be checked. Durations are recorded: 146.5 agent-hours over 93 tickets, 77% of it in tester and implementer stages. What I want: spec next already chooses the model for the stage it prepares; remember it with the stage, and have ticket advance record it as pipeline.StageRecord.model without a transcript (a transcript's model wins when one is given). spec stats adds, per role, the number of stages, the total and median duration, and the total cost where records hold one, and per ticket its total duration. Nothing is estimated: a stage with no recorded cost has none.
