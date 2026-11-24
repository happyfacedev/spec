---
id: PROP-083
type: proposal
title: A spec round that only answers review findings gets a spec review of those units alone
status: done
stage: null
touches: [PIP-001, PIP-012]
violates: []
depends_on: [PROP-076]
changed: [INV-009, PIP-012, PIP-012/R11, PIP-012/R15, PIP-012/S28, PIP-012/S29]
questions:
  - id: Q1
    kind: blocker
    text: "PIP-012/S29 is listed under the spec-writer's documents (the build before this ticket always gave the full delta), but the implementer's narrowing code now breaks S29 for hand-edited approve history, which the reviewer's C4 finding asks tests for. The two new S29 tests must fail until the code is fixed, which the documents exemption forbids. The spec-writer should list documents again without PIP-012/S29. Its changes are kept in git stash \"PROP-083 tester: blocked\"; the next tester stage gets them back."
    default: null
    cites: [PIP-012/S29]
    answer: "Yes: the spec-writer lists documents again without PIP-012/S29; no spec text changes."
    raised_by: tester
history:
  - at: 2026-11-01T01:31:07.313Z
    role: spec-writer
    result: done
    summary: After an approve, a spec round inside the findings' units gets a spec review of its own diff only; else full (INV-009)
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-012/S22, PIP-012/S28, PIP-012/S29, PIP-013/S6, PIP-014/S6, PIP-015/S21, INS-012/S20, PIP-016/S6, PIP-008/S21, WSP-009/S3]
        reason: "spec impact PROP-083 reaches INS-012, PIP-008, PIP-013, PIP-014, PIP-015, PIP-016, WSP-009. Only the content of the spec review's existing Spec delta group changes: the group keeps its name and place, so the budget rules (PIP-013, delta never counted or cut, S22), the entry points (PIP-015, INS-012), the reviewer's diff (PIP-016) and the spec review's lack of New in the spec (PIP-014/S6) hold. PIP-001 is left unchanged, so the stage order, StageRefused (PIP-008/S21) and the stage-start sync (WSP-009/S3) are untouched; S28 shows a sync's base-branch changes are left out of the narrowed delta"
      - item: C2
        outcome: scenarios
        ids: [PIP-012/S29, PIP-001/S23]
        reason: "older states: a proposal with no spec-review approve (recorded before the spec review existed, or still in its first review loop) gets the full delta (S29, PIP-001/S23 history stays valid); a project with an older spec-review prompt is covered because the narrowing instruction is in the brief's delta line, not the role prompt; not a git repository keeps today's Unavailable line (S29). No path or platform input is added"
      - item: C3
        outcome: scenarios
        ids: [PIP-012/S28, PIP-012/S29]
        reason: "while the ticket waits between the approve and the next spec review, every stage start merges main (WSP-009/S3): S28 leaves the base branch's changes out of the narrowed delta and the scope check, and S29 falls back to the full delta when they do not apply cleanly to the approved spec. Repeated rounds (scoped review asks changes, spec-writer runs again) keep the delta anchored at the approve (S28)"
      - item: C4
        outcome: invariant
        ids: [INV-009]
        reason: "inputs across a trust boundary: finding cites (set by the reviewer and spec review, both models) and the spec-writer's report. The CLI decides from the committed history and git alone; cites only decide whether the narrowed delta is offered, never which changes it shows, and the narrowed delta always holds every change since the approve; the spec-writer's changed: list plays no part (S29). A forged or wide cite cannot hide a change; a change outside the findings, or anything the CLI cannot establish, gives the full review. The narrowed review is held to every checklist item, as PROP-076/PROP-084's later rounds needed"
      - item: C5
        outcome: scenarios
        ids: [PIP-012/S29]
        reason: no approve, no counted finding (reopened spec-writer stage), an approve commit not in HEAD's history, base-branch changes that conflict, or an unreadable repository all give the full delta, never a narrowed or empty one
      - item: C6
        outcome: scenarios
        ids: [PIP-012/S22, PIP-012/S23, PIP-001/S20, PIP-001/S13, PIP-006/S26]
        reason: the first spec review and every spec review before any approve keep the full delta of S22; findings still ride as in S23 and R8; stage order after a spec review's changes or a reviewer's spec finding is unchanged (PIP-001/S20, S13); the tester after the implementer may still leave every test passing (PIP-006/S26)
      - item: C8
        outcome: na
        ids: []
        reason: "no fact about another tool or service is stated: the delta uses the spec folder's diff and stage commits as today (PIP-008/R1); how the CLI applies base-branch changes to the approved spec is left to the implementer, with a conflict failing closed to the full delta"
    documents: [PIP-012/S29]
    assumed:
      - new: What counts as a round that only answers findings?
        value: "every spec unit added, changed or removed since the latest spec-review approve is cited by a finding recorded after it, or belongs to the feature or contract holding a cited unit; counted findings are reviewer findings marked spec: true and every spec-review finding (PIP-012/R15)"
      - new: Which rounds may be narrowed?
        value: only rounds after a spec-review approve, so a spec already reviewed in full is never skipped. Rounds that answer a spec review's changes before any approve keep the full delta, which is where PROP-076 and PROP-084 found their C4 holes (PIP-012/R15, INV-009)
      - new: What does the narrowed spec review read?
        value: the same brief groups as today, with only the Spec delta narrowed to the diff from the approved spec (the base-branch changes merged since applied to it) to HEAD, under a line saying to judge only this change as strictly as a full review; contracts, features and neighbours stay as context, since PROP-076's second round found a contract the round contradicted without changing it (PIP-012/R15, S28)
      - new: What happens when the round changes more than the findings' units?
        value: the full spec delta of R11, as today (PIP-012/S29)
      - new: Should the tester after such a round be allowed to report done with no new tests?
        value: not added. After the implementer has run, PIP-006/R1 and R9 already accept a tester stage with no new or failing tests when every scenario has a test. What a round still costs the tester is naming mutations again (PIP-019/R1), which is outside this ticket's touches and needs its own ticket
      - new: Does PIP-001 change?
        value: no; the stage order stays spec-writer then spec-review on every round, and only the spec review's brief narrows
      - new: Does the spec-review role prompt change?
        value: no; the delta's first line in the brief says to judge only this change, so it works with any installed spec-review prompt (PIP-017/R7 still asks the review to read the spec delta)
    duration_s: 621
  - at: 2026-11-01T01:33:04.690Z
    role: spec-review
    result: done
    summary: "Approved: narrowing retains every unapproved change, full-review safeguards and context; fallback is fail-closed"
    verdict: approve
    assumed: []
    duration_s: 115
  - at: 2026-11-01T01:40:46.325Z
    role: tester
    result: done
    summary: S28 and S29 tests in real git fixtures; S28 fails now, 6 S29 tests pass now; no old test needed an update
    verdict: null
    mutations:
      - scenario: PIP-012/S28
        wrong: diffs the approve commit straight to HEAD and so includes the change main brought to SET-001/S2
      - scenario: PIP-012/S28
        wrong: narrows a later round's delta to that round's commits only, dropping the earlier round's changes since the approve
      - scenario: PIP-012/S28
        wrong: keeps the full delta first line, or narrows the diff without the line naming the approve commit
      - scenario: PIP-012/S29
        wrong: trusts the spec-writer report's changed list and narrows although SET-001/S2 changed outside the cited units
      - scenario: PIP-012/S29
        wrong: narrows without an approve in the history
      - scenario: PIP-012/S29
        wrong: narrows when no counted finding follows the approve (a tests-only reviewer finding, a reopened spec-writer)
      - scenario: PIP-012/S29
        wrong: narrows when the approve commit is not in HEAD's history, giving an empty or wrong delta
      - scenario: PIP-012/S29
        wrong: narrows although main's changes conflict with the approved spec
      - scenario: PIP-012/S29
        wrong: outside a git repository gives a narrowed delta instead of Unavailable after the full first line
    assumed:
      - new: How the CLI finds the commit that recorded the approve
        value: "the fixture's approve is a PIP-008/R1 stage commit (subject '<ID> spec-review: ...', trailer, ticket file with the approve entry); the ticket history the brief reads is the working-tree file"
    duration_s: 458
  - at: 2026-11-01T01:50:59.056Z
    role: implementer
    result: done
    summary: Spec review delta narrows to the approve-to-HEAD diff when only finding-cited units changed; else full
    verdict: null
    assumed:
      - new: What if the narrowed diff is empty?
        value: full delta (fail closed); a narrowed review of nothing is never offered
      - new: How is the commit that recorded the approve found?
        value: oldest commit in HEAD's history that added the approve entry's `at` to the ticket file (git log -S); none found means full
    duration_s: 610
  - at: 2026-11-01T01:57:33.222Z
    role: reviewer
    result: done
    summary: Timestamp-only approve lookup trusts editable history and can hide unapproved spec changes
    verdict: changes
    findings:
      - cites: [INV-009, PIP-012/R15, PIP-012/S29]
        text: src/cli/spec-round.ts:32-37 treats the first occurrence of approve.at anywhere in the ticket file as proof of an approval, without checking the committed stage record or its PIP-008/R1 stage commit. The approval itself is taken from editable working-tree history at lines 76-82. An author can change an approve entry's at to a timestamp first committed by a later spec-writer stage after an uncited SET-001 change, then commit another change inside the PRV-001 finding's scope. The CLI anchors at that later writer commit, omits the unapproved SET-001 change from both the scope check and the displayed delta, and offers a nonempty narrowed review. Likewise, changing a committed spec-review changes record to approve by hand is accepted without checking its original verdict. Establish the actual committed approval and its recording stage before narrowing; mismatched or hand-inserted evidence must fall back to the full delta. Add regression tests for these history edits; the current fixtures only cover absent timestamps and honest approval records.
        tests: true
        class: C4
    assumed: []
    duration_s: 391
  - at: 2026-11-01T02:04:41.179Z
    role: tester
    result: blocked
    summary: S29 regression tests for hand-edited approve history fail on the implementer's code, but S29 is listed under documents
    verdict: null
    assumed: []
    duration_s: 426
    refusals: 1
  - at: 2026-11-01T02:04:42.614Z
    role: spec-writer
    result: reopened
    summary: reopened by PROP-083#Q1
    verdict: null
    assumed: []
  - at: 2026-11-01T02:04:55.270Z
    role: spec-writer
    result: done
    summary: "documents no longer lists PIP-012/S29: the narrowing code makes its fallback cases new behaviour to test first"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-012/S22, PIP-012/S28, PIP-012/S29, PIP-013/S6, PIP-014/S6, PIP-015/S21, INS-012/S20, PIP-016/S6, PIP-008/S21, WSP-009/S3]
        reason: "spec impact PROP-083 reaches INS-012, PIP-008, PIP-013, PIP-014, PIP-015, PIP-016, WSP-009. Only the content of the spec review's existing Spec delta group changes: the group keeps its name and place, so the budget rules (PIP-013, delta never counted or cut, S22), the entry points (PIP-015, INS-012), the reviewer's diff (PIP-016) and the spec review's lack of New in the spec (PIP-014/S6) hold. PIP-001 is left unchanged, so the stage order, StageRefused (PIP-008/S21) and the stage-start sync (WSP-009/S3) are untouched; S28 shows a sync's base-branch changes are left out of the narrowed delta"
      - item: C2
        outcome: scenarios
        ids: [PIP-012/S29, PIP-001/S23]
        reason: "older states: a proposal with no spec-review approve (recorded before the spec review existed, or still in its first review loop) gets the full delta (S29, PIP-001/S23 history stays valid); a project with an older spec-review prompt is covered because the narrowing instruction is in the brief's delta line, not the role prompt; not a git repository keeps today's Unavailable line (S29). No path or platform input is added"
      - item: C3
        outcome: scenarios
        ids: [PIP-012/S28, PIP-012/S29]
        reason: "while the ticket waits between the approve and the next spec review, every stage start merges main (WSP-009/S3): S28 leaves the base branch's changes out of the narrowed delta and the scope check, and S29 falls back to the full delta when they do not apply cleanly to the approved spec. Repeated rounds (scoped review asks changes, spec-writer runs again) keep the delta anchored at the approve (S28)"
      - item: C4
        outcome: invariant
        ids: [INV-009]
        reason: "inputs across a trust boundary: finding cites (set by the reviewer and spec review, both models) and the spec-writer's report. The CLI decides from the committed history and git alone; cites only decide whether the narrowed delta is offered, never which changes it shows, and the narrowed delta always holds every change since the approve; the spec-writer's changed: list plays no part (S29). A forged or wide cite cannot hide a change; a change outside the findings, or anything the CLI cannot establish, gives the full review. The narrowed review is held to every checklist item, as PROP-076/PROP-084's later rounds needed"
      - item: C5
        outcome: scenarios
        ids: [PIP-012/S29]
        reason: no approve, no counted finding (reopened spec-writer stage), an approve commit not in HEAD's history, base-branch changes that conflict, or an unreadable repository all give the full delta, never a narrowed or empty one
      - item: C6
        outcome: scenarios
        ids: [PIP-012/S22, PIP-012/S23, PIP-001/S20, PIP-001/S13, PIP-006/S26]
        reason: the first spec review and every spec review before any approve keep the full delta of S22; findings still ride as in S23 and R8; stage order after a spec review's changes or a reviewer's spec finding is unchanged (PIP-001/S20, S13); the tester after the implementer may still leave every test passing (PIP-006/S26)
      - item: C8
        outcome: na
        ids: []
        reason: "no fact about another tool or service is stated: the delta uses the spec folder's diff and stage commits as today (PIP-008/R1); how the CLI applies base-branch changes to the approved spec is left to the implementer, with a conflict failing closed to the full delta"
    assumed:
      - new: What counts as a round that only answers findings?
        value: "every spec unit added, changed or removed since the latest spec-review approve is cited by a finding recorded after it, or belongs to the feature or contract holding a cited unit; counted findings are reviewer findings marked spec: true and every spec-review finding (PIP-012/R15)"
      - new: Which rounds may be narrowed?
        value: only rounds after a spec-review approve, so a spec already reviewed in full is never skipped. Rounds that answer a spec review's changes before any approve keep the full delta, which is where PROP-076 and PROP-084 found their C4 holes (PIP-012/R15, INV-009)
      - new: What does the narrowed spec review read?
        value: the same brief groups as today, with only the Spec delta narrowed to the diff from the approved spec (the base-branch changes merged since applied to it) to HEAD, under a line saying to judge only this change as strictly as a full review; contracts, features and neighbours stay as context, since PROP-076's second round found a contract the round contradicted without changing it (PIP-012/R15, S28)
      - new: What happens when the round changes more than the findings' units?
        value: the full spec delta of R11, as today (PIP-012/S29)
      - new: Should the tester after such a round be allowed to report done with no new tests?
        value: not added. After the implementer has run, PIP-006/R1 and R9 already accept a tester stage with no new or failing tests when every scenario has a test. What a round still costs the tester is naming mutations again (PIP-019/R1), which is outside this ticket's touches and needs its own ticket
      - new: Does PIP-001 change?
        value: no; the stage order stays spec-writer then spec-review on every round, and only the spec review's brief narrows
      - new: Does the spec-review role prompt change?
        value: no; the delta's first line in the brief says to judge only this change, so it works with any installed spec-review prompt (PIP-017/R7 still asks the review to read the spec delta)
    duration_s: 11
  - at: 2026-11-01T02:05:52.669Z
    role: spec-review
    result: done
    summary: "Approved: unchanged spec; revoking S29's documents exemption allows failing C4 regression tests before the code fix"
    verdict: approve
    assumed: []
    duration_s: 55
  - at: 2026-11-01T02:11:41.160Z
    role: tester
    result: done
    summary: S28 and S29 tests, plus two S29 regressions for hand-edited approve history; the regressions fail on the current code
    verdict: null
    mutations:
      - scenario: PIP-012/S28
        wrong: diffs the approve commit straight to HEAD and so includes the change main brought to SET-001/S2
      - scenario: PIP-012/S28
        wrong: narrows a later round's delta to that round's commits only, dropping the earlier round's changes since the approve
      - scenario: PIP-012/S28
        wrong: keeps the full delta first line, or narrows the diff without the line naming the approve commit
      - scenario: PIP-012/S29
        wrong: trusts the spec-writer report's changed list and narrows although SET-001/S2 changed outside the cited units
      - scenario: PIP-012/S29
        wrong: narrows without an approve in the history
      - scenario: PIP-012/S29
        wrong: anchors the approve at the first commit that added the approve entry's at timestamp, so an at edited to a later spec-writer stage's timestamp hides the uncited SET-001 change
      - scenario: PIP-012/S29
        wrong: takes the approve from the working-tree history without checking the committed stage record, so a spec-review changes record edited to approve narrows the delta
    assumed: []
    duration_s: 346
  - at: 2026-11-01T02:27:37.582Z
    role: implementer
    result: done
    summary: Narrowing anchors at the committed spec-review approve stage commit; working-tree history only confirms it
    verdict: null
    assumed:
      - new: May a spec-review stage commit add more than one history record?
        value: yes; it must end with its own done approve record, keep its parent's records as a prefix, and add at least that one
    duration_s: 950
    refusals: 1
  - at: 2026-11-01T02:34:10.327Z
    role: reviewer
    result: done
    summary: C4 fixed; committed approval evidence rejects hand edits within the INS-015/R4 review-and-CI trust model
    verdict: approve
    assumed: []
    duration_s: 386
---
Measured on this repo (SELF-HOSTING P43). After the spec-review stage landed, a code-review finding marked `spec` sends a ticket through spec-writer, a full spec review, tester, implementer and reviewer, even when the spec fix is one line. PROP-060: a one-line TKT-001/S18 text fix. PROP-078: a one-line INS-014/S6 hint. Each cost a full spec-review stage whose brief carried the ticket's whole spec delta, roughly 100-260 KB. Change: when a spec-writer round follows review findings, and the units it changes are exactly those findings' cited units (or units in their features), the spec review that follows gets a brief with only those findings and the diff of that round. Its prompt says to judge only that change. A round that changes other units gets the full spec review as today. If the round changes no scenario a test covers, the tester stage after it may report done with no new tests.
