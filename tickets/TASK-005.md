---
id: TASK-005
type: task
title: README, ROADMAP and SELF-HOSTING say what is true today
status: done
stage: null
touches: [INS-014]
violates: []
depends_on: []
changed: []
questions: []
history:
  - at: 2026-11-10T14:29:54.998Z
    role: implementer
    result: done
    summary: Docs updated; lint/typecheck/build pass; no docs test matched; full suite/check-report skipped per instruction.
    verdict: null
    assumed: []
    duration_s: 1596
  - at: 2026-11-10T14:34:23.485Z
    role: reviewer
    result: done
    summary: Docs mostly accurate; a CI zsh claim has no support in the repo, and two statements contradict batch 8 or batch 6
    verdict: changes
    findings:
      - cites: [TASK-005]
        text: "docs/SELF-HOSTING.md:263 (batch 8) says the INS-012/S27 zsh failure was 'fixed in the CI workflow outside TASK-002'. The only support is TASK-002's own sentence. .github/workflows/ci.yml in this tree has no zsh step and no commit has changed it for this: git log of that file ends at PROP-064's 176fa3e. tests/cli/load-skill.test.ts:140 still does expect(SHELLS).toContain('zsh'). So the claim is unverifiable and may be false. Either say only that TASK-002's ticket reports a separate zsh failure, or name the commit or file that fixes it."
        class: C8
      - cites: [TASK-005]
        text: "docs/SELF-HOSTING.md:276 says items 1-3 of the improvement order 'were addressed by later work'. Item 3 asks for a model per ticket size and cost per stage. DECISIONS X139 (line 1355) says the size-based models selector is ignored, and the same file's batch 8 says no record in 114 tickets holds a model or cost_usd (PROP-114). Item 1 names allowed commands written from dispatchCommand, which X139 removed; only checkCommands survives. The hedge 'implementations and measured outcomes have since changed' does not tell a reader that the cost half of item 3 was never delivered. Say so: item 2 and checkCommands from item 1 are done, the size selector and dispatchCommand are removed, and per-stage cost is not recorded (open as PROP-114). Item 1's line 'the biggest cost lever' also needs a note that PROP-114 says it cannot be checked."
        class: C9
      - cites: [TASK-005]
        text: docs/SELF-HOSTING.md:19 says 'the batch-6 record still says an interactive session was untested'. Batch 6 (lines 209-211) says no such thing. The sentence 'An interactive session is still untested' is in the parked bullet at line 16, which is the 2026-10-31 snapshot. Fix the attribution, and do not present line 16 as a current fact.
        class: C9
      - cites: [TASK-005]
        text: "Follow-up: finding numbers that older tickets cite and that resolve nowhere. P39 (PROP-076), P43 (PROP-083) and P44b (PROP-082) are not in docs/SELF-HOSTING.md. They are missing on main too, so this diff did not remove them, but the ticket asked to keep every cited number resolving. Every other P/I/A/R number cited by a ticket is still present (I14, R4, I19-I26, P25, P32, P33, P36, P40, P42, P44, P48, P49, P51, P53, P55, P58, P60-P62, P78, A1-A3, A12, A13, A16, R1). File a ticket to add one-line entries for the three missing numbers, or to repoint those tickets."
        class: C9
      - cites: [TASK-005]
        text: "Follow-up: docs/SELF-HOSTING.md:11 cites PIP-001/S10 and 'the finish-hook check in PIP-008/R12' as dropped overseer parts. PIP-001/S10 no longer exists (spec show answers 'Unknown PIP-001/S10'), and PIP-008/R12 is now the kept test run rule. Both were already wrong on main. Name them as old IDs from before the renumbering, or drop the IDs."
        class: C9
      - cites: [TASK-005]
        text: "Follow-up: docs/SELF-HOSTING.md:264 says 'The 10-minute test limit in PIP-009/R2 stopped stage checks until the suite ran under that limit.' PIP-009/R2 does set a 10-minute limit. TASK-006 says the full run was stopped by it. No record says stage checks were stopped until TASK-003 brought the suite under 600 s. Reword to what TASK-006 states. Line 265 'TASK-006 (running) makes the CLI ask for each fixed fact once per command' states a plan as done and leaves out its other part, the real git on PATH in tests."
        class: C8
      - cites: [TASK-005]
        text: "Follow-up: docs/ROADMAP.md sections 1-4 and the Order table sit under the 'Historical roadmap proposal' heading, but section 3 describes today's spec next, advance and merge flow. Row 5 'Astro adapter' and section 4 'Later: the Astro harness' are not marked as superseded by the Current operation paragraph. The sentence 'Commands 1 came first' is clumsy; it was 'Commands 1 come first' before."
        class: C9
    assumed: []
    duration_s: 257
  - at: 2026-11-10T14:50:41.577Z
    role: implementer
    result: done
    summary: Doc findings corrected; lint/typecheck pass; full suite and check-report skipped per instruction.
    verdict: null
    assumed:
      - new: Should entries for P39, P43 and P44b be added here?
        value: "No: they were already missing on main; left for a separate ticket, as the review's follow-up says"
    duration_s: 975
  - at: 2026-11-10T14:52:22.364Z
    role: reviewer
    result: done
    summary: Round-1 findings fixed; item 7 wrongly says afterMerge was superseded by X139, and TASK-006's stage is already stale
    verdict: changes
    findings:
      - cites: [TASK-005]
        text: "docs/SELF-HOSTING.md, the preamble of the improvement order and item 7, say the afterMerge approach 'was implemented by PROP-033, then superseded under X139'. That is wrong. X139 (DECISIONS.md:1350-1362) does not mention afterMerge. format.Config.afterMerge is still an active, specified option: WSP-006/S18-S24 and R6, FMT-002/S16, INS-015 and INS-016 (afterMerge children in history), and src/cli/merge.ts, which TASK-002 fixed this same day. Only this repository chooses not to use it for its pinned CLI (INS-014/S15, DECISIONS.md:1321). Say that: the option exists and other repositories can use it, while this repository refreshes .spec/bin with npm run build or spec upgrade. The ticket's own wording ('removed or changed') was looser than 'superseded'; do not carry that over as a fact. Line 443 and the item 7 line also cite X139 for this; cite INS-014/S15 instead."
        class: C9
      - cites: [TASK-005]
        text: docs/SELF-HOSTING.md batch 8 says 'TASK-006 is not merged; its implementer stage is still running.' The implementer stage is already done and the ticket is approved; only the merge is pending. The sentence goes stale when this ticket merges. Say only that TASK-006 was not merged when this was written, or drop the stage.
        class: C9
      - cites: [TASK-005]
        text: "Follow-up: item 2 of the improvement order says 'the old command details are historical'. spec ticket answer --back and the reopened entry still exist (tickets/contracts.md:330, TKT-006/R4, PIP-001/R4). Drop that clause; the item is done, not historical. Item 3's 'maxParallel was delivered in PROP-030' is true today: format.Config.maxParallel still caps spec next (CLI-007/R3), only the dispatch and orchestrate use of it is gone."
        class: C9
      - cites: [TASK-005]
        text: "Follow-up: the batch 8 sentence 'In this session, spec ticket advance answered ...' is written as the driving session's observation, which is how it should be presented. A reader of the file will not know which session. Write 'In the driving session on 2026-11-10'. The figures 438 s and 449 s are that session's report and no file records them; the text does not claim otherwise."
        class: C8
    assumed: []
    duration_s: 91
  - at: 2026-11-11T09:52:18.789Z
    role: implementer
    result: done
    summary: Corrected four doc findings; lint/typecheck pass; full suite/check-report skipped per instruction.
    verdict: null
    assumed:
      - new: Should entries for P39, P43 and P44b be added here?
        value: "No: they were already missing on main; left for a separate ticket, as the review's follow-up says"
    duration_s: 68392
  - at: 2026-11-11T09:53:50.535Z
    role: reviewer
    result: done
    summary: Round-2 findings fixed; afterMerge and TASK-006 statements are now true; one wording follow-up
    verdict: approve
    findings:
      - cites: [TASK-005]
        text: "Follow-up: docs/SELF-HOSTING.md item 7 of the improvement order says 'INS-014/S15 says the tracked .spec/bin copy is refreshed with npm run build or spec upgrade'. S15 only says afterMerge does not rewrite the pinned CLI or leave a generated-file change on the base. The build and upgrade route comes from INS-014/R1 and S14. Cite S15 for the first part and R1 for the second, or drop the attribution. The fact itself is true."
        class: C9
      - cites: [TASK-005]
        text: "Follow-up: the batch 8 sentence that names commit 3e5b665 says it is 'not yet merged or pushed'. This holds today (git branch -a --contains 3e5b665 lists only the local ci/green), but it goes stale once that branch lands. If it lands before this ticket merges, reword it to 'merged as <sha>'. The 10-minute-limit paragraph now reads as the driving session's observation on 2026-11-10; the 438 s and 449 s figures are that session's report and no file records them."
        class: C8
    assumed: []
    duration_s: 81
---
Review of 2026-11-10. Three hand-written documents describe a state the project left. README.md: the status line (lines 19-24) still reads 'M0-M8 done' and cites eval and probe counts from October. docs/ROADMAP.md: 'Status (Oct 27)'; it lists the Astro adapter as not built although the run skill drives Astro through delegation; it says merging is automatic although spec merge is explicit (DECISIONS X139); its last paragraph names /spec:spec-init twice. docs/SELF-HOSTING.md: the 'Needs a person (parked)' items were decided in batch 6; the pipeline findings and the 'Recommended order of improvements' still describe dispatch, orchestrate, the overseer, dispatchCommand and this repository's afterMerge, all removed or changed since (X139, INS-014/S15), and items 1-3 and 7 of that order are done. What I want: each of the three states today's facts, marks what is history as history (or moves it under a dated heading), and keeps every finding number so older tickets' references still resolve. Add the 2026-11-10 review's measurements to SELF-HOSTING as a new batch entry: CI never green (129 of 129 runs), the suite at 14 min 25 s for 2,046 tests, verify-history at 1 min 58 s, 146.5 agent-hours over 93 tickets with 77% in tester and implementer stages, no model or cost in any record, no ticket in a light lane, and the tickets filed for each. No behaviour changes; plugin/docs holds generated copies, so rebuild them.
