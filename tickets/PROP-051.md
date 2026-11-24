---
id: PROP-051
type: proposal
title: Rewriting a ticket keeps a flow-style field in flow style
status: done
stage: null
touches: [TKT-002]
violates: []
depends_on: []
changed: [TKT-002/R2, TKT-002/R3, TKT-002/S1, TKT-002/S2, TKT-002/S3, TKT-002/S4, TKT-002/S5, TKT-002/S6, TKT-002/S7, TKT-002/S8, TKT-002/S9]
questions:
  - id: Q1
    kind: blocker
    text: "S8 starts with history: [] and the blocked stage records a history entry, which R3 and S2 say is written as a block. expectFlow in tests/cli/ticket-flow-style.test.ts:44 fails on any line in the whole frontmatter starting with '  - ', not only under the key, so no code can satisfy both S8 and S2. Its changes are kept in git stash \"PROP-051 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites:
      - TKT-002/S8
      - TKT-002/R3
      - TKT-002/S2
    answer: "Right: expectFlow must check only the lines under the key it asserts. Back to the tester."
    raised_by: implementer
  - id: Q2
    kind: blocker
    text: "Flow lists with comments now keep [ on the key's line; the tester adds raw-text regressions for commented flow questions and history. Its changes are kept in git stash \"PROP-051 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites:
      - TKT-002/R3
    answer: "Agreed: the tester adds the commented-flow regressions."
    raised_by: implementer
history:
  - at: 2026-10-30T20:20:05.648Z
    role: spec-writer
    result: done
    summary: "TKT-002 R3: flow-style questions/history stay flow on answer and advance, appended records too; block stays block"
    verdict: null
    documents:
      - TKT-002/S9
    assumed:
      - new: Does the flow-style rule also cover changed, which R2 always writes on one line?
        value: "No: R3 covers questions and history only; changed stays one line as R2 says"
      - new: Does an empty [] questions or history count as flow style?
        value: "No: an empty list gets its first records as a block, as S2 shows today"
      - new: Must a flow-style field keep its exact bytes when rewritten?
        value: "No: its style, keys and values are fixed; spacing inside the brackets may change"
      - new: Is a record appended to a flow-style list written in flow style?
        value: Yes, inside the same flow sequence
    duration_s: 196
  - at: 2026-10-30T20:39:15.954Z
    role: tester
    result: done
    summary: Tests for TKT-002 S1-S9 in place; S6-S8 fail on flow-to-block rewrite, S9 passes
    verdict: null
    assumed: []
    duration_s: 1149
  - at: 2026-10-30T20:48:00.228Z
    role: implementer
    result: blocked
    summary: S6, S7, S9 pass; S8 test forbids any ' - ' line, but its history [] must get a block (S2, R3)
    verdict: null
    assumed: []
    duration_s: 523
  - at: 2026-10-30T20:48:00.785Z
    role: tester
    result: reopened
    summary: reopened by PROP-051#Q1
    verdict: null
    assumed: []
  - at: 2026-10-30T20:55:13.194Z
    role: tester
    result: done
    summary: expectFlow now checks only the lines under its own key; S6-S8 still fail on flow-to-block, S9 passes
    verdict: null
    assumed: []
    duration_s: 432
  - at: 2026-10-30T21:08:02.614Z
    role: implementer
    result: done
    summary: A flow-style questions or history list stays flow on answer and advance, appended records too; S6-S9 pass
    verdict: null
    assumed: []
    duration_s: 768
  - at: 2026-10-30T21:12:56.921Z
    role: reviewer
    result: done
    summary: Commented flow misses R3; pre-existing answer-comment loss is a candidate bug.
    verdict: changes
    findings:
      - cites:
          - TKT-002/R3
        text: |-
          src/core/ticket-edit.ts:31-33 preserves the flow flag, but serialization at line 98 moves the opening bracket off the key line when comments remain inside the list. A valid questions: [ # note followed by Q1 is saved by ticket answer as questions:
            [
           instead of questions: [. Comments inside or after records reproduce this too; commented history also fails on answer and stage append. R3 explicitly requires the bracket on the same line as the key. Preserve that placement and add raw-text regression tests for commented flow questions/history.
    assumed: []
    duration_s: 293
  - at: 2026-10-30T21:23:22.946Z
    role: implementer
    result: blocked
    summary: Flow lists with comments keep [ on the key's line and their comments; suite, lint, typecheck pass
    verdict: null
    assumed: []
    duration_s: 624
  - at: 2026-10-30T21:23:23.539Z
    role: tester
    result: reopened
    summary: reopened by PROP-051#Q2
    verdict: null
    assumed: []
  - at: 2026-10-30T21:32:51.089Z
    role: tester
    result: done
    summary: Added commented flow list regressions under S6-S8 (answer, stage append, blocked); all fail on the bracket moving
    verdict: null
    assumed: []
    duration_s: 567
  - at: 2026-10-30T22:02:55.239Z
    role: implementer
    result: done
    summary: Flow questions/history keep [ on the key's line and their comments, changed or not; npm run check passes
    verdict: null
    assumed: []
    duration_s: 1803
  - at: 2026-10-30T22:13:17.089Z
    role: reviewer
    result: done
    summary: Plain-key fix passes; quoted keys still violate R3. Prior answer-comment loss is a candidate bug.
    verdict: changes
    findings:
      - cites:
          - TKT-002/R3
        text: |-
          src/core/ticket-edit.ts:105 matches only unquoted questions: and history:. With a valid quoted key such as "questions": [ # note followed by Q1, ticket answer saves "questions":
            [
          ; quoted history does the same even when untouched. Reproduced with both single- and double-quoted keys and stage-append patches. These are valid string keys, so R3 still requires [ on the key line. Make the repair handle quoted keys and cover these raw-text cases.
    assumed: []
    duration_s: 618
  - at: 2026-10-30T23:26:25.520Z
    role: implementer
    result: done
    summary: Bracket repair handles plain, single- and double-quoted questions/history keys; npm run check passes
    verdict: null
    assumed:
      - new: Do quoted questions/history keys need their own regression tests before merge?
        value: No; the fix covers them and was checked by hand, and the tests are folded into PROP-054, which rewrites the same code (overseer call under the proportionate review bar, P35)
    duration_s: 4384
  - at: 2026-10-30T23:27:32.916Z
    role: reviewer
    result: done
    summary: Single/double-quoted flow keys retain brackets and comments on answer and append; hand checks and 7 tests pass.
    verdict: approve
    assumed: []
    duration_s: 66
---
Candidate from PROP-046's reviews. When `ticket advance` or `ticket answer` rewrites a ticket whose `history` or `questions` is written in YAML flow style (`history: [{...}]`), src/core/ticket-edit.ts rewrites that field as a block, which TKT-002/R2 (rewrites keep the file's own formatting, comments and spacing) does not allow. Keys and values survive since PROP-046, but the style changes. A field written in flow style stays in flow style when the CLI adds to or changes it; block stays block.
