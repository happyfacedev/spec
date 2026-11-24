---
id: PROP-095
type: proposal
title: "Wording follow-ups from batch 5 reviews: plan order, dirty-target message, report colon recovery"
status: done
stage: null
touches: [TKT-011, TKT-012, PIP-003]
violates: []
depends_on: []
changed: [PIP-003/R7, PIP-003/S21, TKT-011/R5, TKT-011/S1, TKT-012/R9, TKT-012/S13, TKT-012/S15]
questions: []
history:
  - at: 2026-11-01T12:16:16.464Z
    role: spec-writer
    result: done
    summary: Plan-order and report-colon text now match the code; close's dirty-target message points at a Spec-Ticket commit
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [TKT-011/S1, TKT-011/S11, TKT-012/S13, PIP-003/S19, PIP-003/S21]
        reason: spec impact PROP-095 run; contract-level reach is wording only, covered by the changed scenarios and S11/S19 unchanged
      - item: C2
        outcome: na
        ids: []
        reason: no paths, install layouts, platforms or upgrade states change
      - item: C3
        outcome: na
        ids: []
        reason: no shared state across an await or process boundary changes
      - item: C4
        outcome: na
        ids: []
        reason: no input crossing a trust boundary changes; the report is already untrusted data read as YAML
      - item: C5
        outcome: scenarios
        ids: [PIP-003/S19]
        reason: an unclosed quote is still the only problem 'not valid YAML'
      - item: C6
        outcome: scenarios
        ids: [PIP-003/S19, PIP-003/S1, TKT-011/S8, TKT-011/S11]
        reason: "unchanged paths: quoted/bare summaries, first fit, order asked"
      - item: C8
        outcome: na
        ids: []
        reason: no external fact; behaviour checked against the project's own code and a probe of extractReport
    documents: [PIP-003/S21]
    assumed: []
    duration_s: 224
  - at: 2026-11-01T12:25:16.926Z
    role: spec-review
    result: done
    summary: Dirty-target recovery advice still conflicts with installed commit enforcement
    verdict: changes
    findings:
      - cites: [TKT-012/S13, TKT-012/R9, INS-015/S4, INS-015/R6]
        text: "The replacement advice still cannot clear the dirty target with enforcement enabled: manually committing the ticket alone with a Spec-Ticket trailer supplies neither the fresh token nor the staged bypass ADR required by INS-015/S4. INS-015/R6 establishes history validity, not pre-commit authorization. Specify an authorized recovery path and cover following that advice through the installed hooks to a successful close; S13 currently checks only the refusal message."
        class: C1
    assumed: []
    duration_s: 538
  - at: 2026-11-01T14:19:14.486Z
    role: spec-writer
    result: done
    summary: Dirty-target advice now points at spec bypass; S13 message, R9 and new S15 cover following it through a clean close
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [TKT-011/S1, TKT-011/S11, TKT-012/S13, TKT-012/S15, TKT-012/S11, INS-015/S4, INS-015/S6, INS-015/S12, PIP-003/S19, PIP-003/S21]
        reason: spec impact PROP-095 run earlier; changes are wording plus S15, covered by these scenarios, INS-015 untouched
      - item: C2
        outcome: na
        ids: []
        reason: no paths, layouts, platforms or upgrade states change; the bypass path was run on a throwaway hooked repo
      - item: C3
        outcome: scenarios
        ids: [TKT-012/S14, INS-015/S6]
        reason: close's lock vs a start is unchanged (S14); a bypass lasts one commit or one hour, so S15 opens it, commits, then closes
      - item: C4
        outcome: scenarios
        ids: [TKT-012/S15, INS-015/S4, INS-015/S12]
        reason: a forged Spec-Ticket trailer on a hand commit is refused; only a bypass ADR staged with the file authorizes it
      - item: C5
        outcome: scenarios
        ids: [TKT-012/S13, TKT-012/S15, PIP-003/S19]
        reason: a dirty target stays refused until committed; an unclosed summary quote is still invalid YAML
      - item: C6
        outcome: scenarios
        ids: [TKT-012/S11, TKT-012/S12, TKT-011/S8, TKT-011/S11, PIP-003/S1]
        reason: "unchanged paths: clean-target close, order asked, first fit, plain report"
      - item: C8
        outcome: na
        ids: []
        reason: no external fact; bypass, hook and close behaviour was run on the project's pinned CLI in a throwaway repo
    documents: [PIP-003/S21]
    assumed: []
    duration_s: 207
  - at: 2026-11-01T14:21:12.266Z
    role: spec-review
    result: done
    summary: Recovery path is covered; bypass advice must explicitly require a person's approval
    verdict: changes
    findings:
      - cites: [TKT-012/S13, TKT-012/R9, TKT-012/S15, INS-015/S13, INS-015/R8]
        text: S15 covers a successful person-run bypass and close, resolving the commit-authorization issue. However, S13's printed message simply instructs the caller to open a bypass, without saying that an agent must first obtain a person's approval. Make that approval requirement explicit in the recovery message and its rule, consistent with INS-015/S13 and R8.
        class: C4
    assumed: []
    duration_s: 115
  - at: 2026-11-01T14:22:15.248Z
    role: spec-writer
    result: done
    summary: Dirty-target message and R9 now say a person approves the bypass; S15 covers a person or an approved agent
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [TKT-011/S1, TKT-011/S11, TKT-012/S13, TKT-012/S15, TKT-012/S11, INS-015/S4, INS-015/S6, INS-015/S12, INS-015/S13, PIP-003/S19, PIP-003/S21]
        reason: wording plus S15; INS-015 untouched and its S13 now cited by S15
      - item: C2
        outcome: na
        ids: []
        reason: no paths, layouts, platforms or upgrade states change
      - item: C3
        outcome: scenarios
        ids: [TKT-012/S14, INS-015/S6]
        reason: close's lock vs a start is unchanged; a bypass lasts one commit or one hour, so S15 opens it, commits, then closes
      - item: C4
        outcome: scenarios
        ids: [TKT-012/S13, TKT-012/S15, INS-015/S4, INS-015/S12, INS-015/S13]
        reason: the message and R9 say a person approves the bypass and an agent needs --approved-by-person; a forged trailer on a hand commit is refused
      - item: C5
        outcome: scenarios
        ids: [TKT-012/S13, TKT-012/S15, PIP-003/S19]
        reason: a dirty target stays refused until committed; an unclosed summary quote is still invalid YAML
      - item: C6
        outcome: scenarios
        ids: [TKT-012/S11, TKT-012/S12, TKT-011/S8, TKT-011/S11, PIP-003/S1]
        reason: "unchanged paths: clean-target close, order asked, first fit, plain report"
      - item: C8
        outcome: na
        ids: []
        reason: no external fact; bypass, hook and close behaviour was run on the project's pinned CLI in a throwaway repo
    documents: [PIP-003/S21]
    assumed: []
    duration_s: 57
  - at: 2026-11-01T14:23:10.451Z
    role: spec-review
    result: done
    summary: Both findings resolved; bypass recovery explicitly requires person approval
    verdict: approve
    assumed: []
    duration_s: 53
  - at: 2026-11-01T14:37:12.725Z
    role: tester
    result: done
    summary: S13 and S15 fail on the old dirty-target message; S1 and S21 pass now; lint and typecheck clean
    verdict: null
    mutations:
      - scenario: TKT-011/S1
        wrong: places PROP-202 and PROP-205 behind PROP-201 because they come after it by ID, instead of first fit into wave 1
      - scenario: TKT-012/S13
        wrong: dirty-target line still says to commit through spec ticket answer, or leaves out the bypass and --approved-by-person advice
      - scenario: TKT-012/S15
        wrong: the close line points at a step that does not clear the condition, or the close still refuses, or commits more than the one ticket file, after the bypass commit
      - scenario: PIP-003/S21
        wrong: "quotes the summary line before any YAML parse, so 'Plain thing # a note' is read with the comment text in the summary"
    assumed: []
    duration_s: 838
  - at: 2026-11-01T15:15:48.170Z
    role: implementer
    result: done
    summary: Dirty-target close message now matches TKT-012/S13 (bypass + --approved-by-person); build, lint, typecheck, 1967 tests pass
    verdict: null
    assumed: []
    duration_s: 2313
    refusals: 1
  - at: 2026-11-01T15:21:30.584Z
    role: reviewer
    result: done
    summary: Approved all three follow-ups; mutation coverage checked and 22 targeted tests passed
    verdict: approve
    assumed: []
    duration_s: 338
---
Three follow-up findings from batch 5 reviews (docs/SELF-HOSTING.md), filed together because each is small. (1) TKT-011/S1 says a ticket is placed after those 'asked before it by ID'; the plan actually backfills first-fit. Make the text say what the code does. (2) TKT-012/S13's message for a dirty target points at `spec ticket answer`, which does not commit on the base branch, so following it does not clear the condition. Point at a step that does. (3) PIP-003/R7's colon recovery rewrites the summary line before any YAML parse; it should parse the report as YAML first and recover only when that fails, keeping inline comments intact. Where behaviour already matches the intended text, change only the text; where it does not (3, maybe 2), add or change the scenario so a test fails first.
