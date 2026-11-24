---
id: PROP-046
type: proposal
title: Ticket files written by a newer spec stay valid for an older branch
status: done
stage: null
touches: [TKT-001]
violates: []
depends_on: []
changed: [LNT-014, LNT-014/R4, LNT-014/R5, LNT-014/S3, LNT-014/S16, LNT-014/S17, PIP-002, PIP-008, TKT-001, TKT-001/R6, TKT-001/R9, TKT-001/R10, TKT-001/R11, TKT-001/S9, TKT-001/S11, TKT-001/S16, TKT-001/S17, TKT-001/S18, TKT-001/S19, TKT-001/S20, TKT-001/S21, TKT-001/S22, TKT-001/S23, TKT-001/S24, TKT-001/S25, TKT-001/S26, TKT-005, TKT-006, WSP-004, WSP-005, pipeline.StageRecord, tickets.Question, tickets.Ticket]
questions:
  - id: Q1
    kind: blocker
    text: 'All three findings fixed in code; the tester adds the regression tests (raw key order for flow and nested records, both assumption alternatives with an invalid known key, numeric-looking unknown keys). Its changes are kept in git stash "PROP-046 implementer: blocked"; the next implementer stage gets them back.'
    default: null
    cites:
      - TKT-001/R9
      - TKT-001/R10
      - LNT-014/R4
    answer: "Agreed: the tester adds the regression tests."
    raised_by: implementer
  - id: Q2
    kind: blocker
    text: "tests/cli/ticket-unknown-keys-order.test.ts lines 66 and 78 use inOrder with the needle 'cites: []', whose first occurrence is Q1's cites in questions (offset 211), before the history finding. The saved file keeps 'future: z', 'cites: []', 'text: t' in raw order, so the tests contradict TKT-001/R10 and need a needle that is unique to the finding. Its changes are kept in git stash \"PROP-046 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites:
      - TKT-001/R10
      - TKT-001/S19
    answer: "Right: the two tests' needle must be unique to the finding. Back to the tester."
    raised_by: implementer
  - id: Q3
    kind: blocker
    text: 'The implementer stage ended with an invalid report: tests fail (exit 1): WSP-001/S3 The worktrees folder set in the config. Its changes are kept in git stash "PROP-046 implementer: blocked"; the next implementer stage gets them back. Answer to resume.'
    default: null
    cites: []
    answer: The failure was WSP-001/S3, a test that collided with other suites in a shared temp folder; fixed on main (2a6e5ef). Restarting the stage syncs it in. Resume.
    raised_by: implementer
  - id: Q4
    kind: blocker
    text: The findings arise only from YAML anchors, aliases and non-string keys in ticket files; the spec should forbid them in tickets (lint error with a fix) rather than the code supporting them
    default: null
    cites:
      - TKT-001/R9
      - TKT-001/R10
    answer: "Decided (overseer): ticket files may not use YAML anchors, aliases or non-string keys (numeric, boolean or null). Lint reports each as an L020 error with a fix (write the value out; quote the key), and the gate refuses such a ticket. ticket new and the CLI's own writes never produce them. This removes all five review findings at the root; unknown string keys stay kept and ignored as R9 and R10 say."
    raised_by: implementer
  - id: Q5
    kind: blocker
    text: the reviewer asked for changes 3 times; a person must decide. How should PROP-046 proceed?
    default: null
    cites: []
    answer: One more round. The only finding is the reported line of an anchor that stands on its own line (it points at the value's line); use the anchor token's source position, and the tester adds multiline scalar, collection and root-flow anchor location regressions. Anything further goes to a follow-up ticket, not another round.
    raised_by: overseer
  - id: Q6
    kind: blocker
    text: "Anchor findings now use the anchor token's line; the tester adds multiline scalar, collection and root-flow anchor location tests. Its changes are kept in git stash \"PROP-046 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites:
      - TKT-001/R11
      - LNT-014/R5
    answer: "Agreed: the tester adds the anchor location regressions."
    raised_by: implementer
history:
  - at: 2026-10-30T05:55:34.536Z
    role: spec-writer
    result: done
    summary: Unknown ticket keys (frontmatter, questions, history) are kept, ignored, one L020 warning, and survive rewrites
    verdict: null
    assumed:
      - new: Should an unknown ticket key give no finding at all, or a lint warning?
        value: one L020 warning per ticket listing every unknown key in file order, at the first one's line; a warning keeps typo detection without failing lint or the gate
      - new: Does the gate, queue or plan say anything about unknown keys?
        value: no; they read the ticket as if the keys were absent, and only lint warns
      - new: Which records may carry unknown keys?
        value: the frontmatter, questions, history records and any record inside them; spec ticket new input stays strict
      - new: What do the warning's message and fix say?
        value: "message 'ticket has fields this spec does not know: <keys>', fix 'if a newer spec wrote them, they are kept: merge the base branch to read them; otherwise remove them or fix their spelling'"
    duration_s: 506
  - at: 2026-10-30T06:12:39.275Z
    role: tester
    result: done
    summary: Tests for unknown ticket keys (S9, S11, S16-S21, LNT-014/S3) fail now; the other TKT-001, LNT-014, WSP-004 tests pass
    verdict: null
    assumed:
      - new: No TKT-001 or LNT-014 tests carried scenario IDs, so where do the new and the missing named tests go?
        value: new files tests/cli/ticket-unknown-keys.test.ts, ticket-schema-scenarios.test.ts, ticket-live-state.test.ts
    duration_s: 1024
  - at: 2026-10-30T06:30:52.900Z
    role: implementer
    result: done
    summary: Ticket schema keeps and ignores unknown keys; lint gives one L020 warning; rewrites keep them in place
    verdict: null
    assumed: []
    duration_s: 1093
  - at: 2026-10-30T06:41:28.381Z
    role: reviewer
    result: done
    summary: "Changes required: R9/R10 gaps; e2e 9/9 and 267 focused tests passed; typecheck/lint passed."
    verdict: changes
    findings:
      - cites:
          - TKT-001/R10
          - TKT-001/S19
          - TKT-001/S20
        text: 'src/core/ticket-edit.ts:28 excludes flow sequences from merging, and :38-42 replaces whole nested collections when JSON key order differs. Zod puts known keys before extras, so advance moves interleaved unknown history keys to the end for history: [{...}], and answer does the same for flow questions. Even block history with assumed: [{new: "Name?", future: x, value: y}] is rewritten as new, value, future on advance. Retaining values but moving keys fails R10; converting flow to block is not an exception. Merge existing nodes recursively in both styles and add raw-order assertions for flow questions/history and nested assumed/findings records.'
      - cites:
          - TKT-001/R6
          - TKT-001/R9
        text: "src/core/schemas.ts:151-154 makes each assumption union alternative loose, allowing a known invalid key to bypass its validator through the other alternative. A history assumption {question: BAD, new: Name, value: x, future: 1} passes via the new alternative, preserving the malformed question as an unchecked extra; the reverse also accepts an invalid new beside a valid question. ASSUMED_KEYS even classifies both as known, so only future warns. Gate, queue and plan can consequently accept a malformed ticket. Preserve validation for every present known assumption key while tolerating genuinely unknown keys, with regression tests for both alternatives."
      - cites:
          - TKT-001/R9
          - LNT-014/R4
        text: 'src/core/schemas.ts:243-253 derives warning order from Object.entries on plain YAML-to-JS objects. JavaScript enumerates integer-like property names first, not in source order: owner: bob followed by the quoted key "2": x produces an L020 list of 2, owner and points to the second key instead of owner. This violates R9 for valid unknown string keys, at both frontmatter and nested record levels. Collect paths in YAML mapping order and locate the actual first unknown key; test numeric-looking keys mixed with ordinary keys.'
    assumed: []
    duration_s: 633
  - at: 2026-10-30T07:00:34.241Z
    role: implementer
    result: blocked
    summary: All three review findings fixed in code; regression tests for them still to be written by the tester
    verdict: null
    assumed: []
    duration_s: 1145
  - at: 2026-10-30T07:00:34.809Z
    role: tester
    result: reopened
    summary: reopened by PROP-046#Q1
    verdict: null
    assumed: []
  - at: 2026-10-30T07:10:33.329Z
    role: tester
    result: done
    summary: Regression tests for raw key order, invalid assumption keys and numeric-looking unknown keys; 9 new ones fail now
    verdict: null
    assumed:
      - new: How is a numeric-looking unknown key named in the L020 warning's list?
        value: by its bare name, e.g. 'owner, 2' and 'questions[0].zeta, questions[0].2'
    duration_s: 598
  - at: 2026-10-30T07:20:31.017Z
    role: implementer
    result: blocked
    summary: "7 of 9 order tests pass; 2 fail because the test's needle 'cites: []' matches the question record, not the finding"
    verdict: null
    assumed: []
    duration_s: 596
  - at: 2026-10-30T07:20:32.724Z
    role: tester
    result: reopened
    summary: reopened by PROP-046#Q2
    verdict: null
    assumed: []
  - at: 2026-10-30T07:30:11.176Z
    role: tester
    result: done
    summary: Finding-order needles in the two nested-record tests are now unique to the finding; all 9 still fail without the fixes
    verdict: null
    assumed: []
    duration_s: 577
  - at: 2026-10-30T18:51:42.921Z
    role: implementer
    result: blocked
    summary: invalid report
    verdict: null
    assumed: []
    duration_s: 40891
  - at: 2026-10-30T19:03:25.558Z
    role: implementer
    result: done
    summary: Unknown ticket keys keep raw order and assumption alternatives validate known keys; tests, lint, typecheck pass
    verdict: null
    assumed: []
    duration_s: 615
  - at: 2026-10-30T19:13:13.693Z
    role: reviewer
    result: done
    summary: "Original fixes pass; 1228 tests/e2e/lint/types pass; build skipped (read-only); candidate bug: TKT-002/R2 flow."
    verdict: changes
    findings:
      - cites:
          - TKT-001/R9
          - TKT-001/R10
          - TKT-001/S20
        text: "src/core/ticket-edit.ts:38-60 recursively merges opaque unknown values and JSON.stringify at :59 throws on a valid cyclic YAML alias. A valid Q1 with future: &loop {self: *loop} parses with only the expected warning and leaves gate/queue/plan unchanged, but answering Q1 throws TypeError: Converting circular structure to JSON. Preserve unknown value subtrees without JSON-serializing their graphs; add answer and advance regressions with cyclic mapping and sequence aliases."
      - cites:
          - TKT-001/R10
          - TKT-001/S19
          - TKT-001/S20
        text: "src/core/ticket-edit.ts:39-58 edits anchored known collections in place without protecting unknown aliases to them. With questions: &qs [a valid unanswered Q1] followed by the unknown top-level future: *qs, answering Q1 changes future[0].answer from null to yes too. Likewise appending to anchored history changes an unknown alias's value. Keeping the literal alias is not keeping its value as R10 requires. Preserve the unknown value snapshot when modifying an anchor's target and test shared anchors across known and unknown fields."
      - cites:
          - TKT-001/R10
          - TKT-001/S20
        text: 'src/core/ticket-edit.ts:40-45 looks up original YAML mapping keys using Object.entries string keys. Answering Q1 when its unknown future value is {2: x} changes that YAML mapping to {2: x, "2": x}: mapAsMap confirms its key set grows from numeric 2 to numeric 2 plus string 2. A direct question key 2: x likewise gains a quoted duplicate, and L020 then lists questions[0].2 twice. The nine regression tests cover quoted numeric keys only. Match existing YAML key identities and leave opaque unknown mappings intact; add bare numeric-key rewrite tests.'
      - cites:
          - TKT-001/R9
          - LNT-014/R4
        text: "src/core/schemas.ts:248-266 skips aliases because records only accepts literal sequences and maps. A valid unknown saved: &h {at: now, role: implementer, result: blocked, summary: Asked, assumed: [], future: x} followed by history: [*h] parses with history[0].future present, but the warning lists only saved, omitting history[0].future. Repeating an anchored history record likewise omits the aliased occurrence's path. Resolve aliases with document context and cycle guards while collecting every typed-record unknown key, preserving source order."
      - cites:
          - TKT-001/R9
          - LNT-014/R4
        text: "src/core/schemas.ts:244-247 stringifies boolean/null YAML keys before src/core/parse/tickets.ts:26 passes their paths to lineOf, which matches raw scalar key values. A valid task with its first unknown key true: x on line 7 therefore warns at line 1, not line 7; null keys have the same mismatch. Carry the actual YAML key location instead of a lossy stringified lookup path and add boolean/null-key location tests."
    assumed: []
    duration_s: 587
  - at: 2026-10-30T19:13:40.808Z
    role: implementer
    result: blocked
    summary: Review findings come from YAML anchors, aliases and non-string keys in tickets; the spec should forbid them
    verdict: null
    assumed: []
    duration_s: 26
  - at: 2026-10-30T19:13:41.224Z
    role: spec-writer
    result: reopened
    summary: reopened by PROP-046#Q4
    verdict: null
    assumed: []
  - at: 2026-10-30T19:17:02.909Z
    role: spec-writer
    result: done
    summary: "Tickets may not use YAML anchors, aliases or non-string keys: L020 error, gate refuses; R9/R10 cover string keys only"
    verdict: null
    documents:
      - TKT-001/S25
      - TKT-001/S26
    assumed:
      - new: What do the new findings' messages and fixes say?
        value: "message 'ticket uses the YAML anchor &<name>' or 'ticket uses the YAML alias *<name>', fix 'write the value out: ticket files may not use YAML anchors or aliases'; message 'ticket has a key that is not a string: <key as written>', fix 'quote the key: \"<key>\"'"
      - new: Does lint report anything else about such a ticket's frontmatter?
        value: "no; like invalid YAML, only these errors are reported (no schema errors, no unknown-key warning), and the gate gives one schema blocker per finding, text '<message>: <fix>'"
      - new: Which build is today's behaviour checked against?
        value: "the worktree source (tsx src/cli/main.ts): anchors and aliases parse and resolve, and bare keys are warned as unknown keys, so S22-S24 and LNT-014/S16-S17 are new behaviour; quoted keys already warn and stay quoted on answer"
    duration_s: 201
  - at: 2026-10-30T19:24:14.752Z
    role: tester
    result: done
    summary: "Tests for TKT-001 S22-S26 and LNT-014 S16-S17: five fail now, S25 and S26 document current behaviour and pass"
    verdict: null
    assumed:
      - new: "Are the doubled single quotes in the spec's fixes (quote the key: ''2'') double quotes in the output?"
        value: 'yes, as in the existing type finding; tests expect quote the key: "2"'
    duration_s: 431
  - at: 2026-10-30T19:40:10.528Z
    role: implementer
    result: done
    summary: Tickets with YAML anchors, aliases or non-string keys give L020 errors and a gate blocker; tests, lint, typecheck pass
    verdict: null
    assumed: []
    duration_s: 953
  - at: 2026-10-30T19:47:22.053Z
    role: reviewer
    result: done
    summary: "Five probes refused; 1235 tests/e2e/lint/types pass; build skipped; candidate follow-up: TKT-002/R2 flow formatting."
    verdict: changes
    findings:
      - cites:
          - TKT-001/R11
          - LNT-014/R5
        text: "src/core/parse/tickets.ts:24,39 locates anchors using node.range[0], which points to the anchored value rather than the &anchor token. In an otherwise valid task, owner: &a on line 7 followed by an indented bob on line 8 produces the L020 anchor error at line 8, not line 7. The same error occurs for an anchored mapping or sequence beginning on the next line, and for &root on its own line before flow frontmatter. Refusal is correct, but TKT-001/R11 and LNT-014/R5 explicitly require each finding at the anchor's line. Use the anchor token's source position and add multiline scalar/collection and root-flow anchor location regressions; the seven new tests only cover same-line anchors."
    assumed: []
    duration_s: 431
  - at: 2026-10-30T19:52:53.879Z
    role: implementer
    result: blocked
    summary: Anchor findings now use the &anchor token's line; tests, lint, typecheck pass; location tests are the tester's
    verdict: null
    assumed: []
    duration_s: 327
  - at: 2026-10-30T19:52:54.385Z
    role: tester
    result: reopened
    summary: reopened by PROP-046#Q6
    verdict: null
    assumed: []
  - at: 2026-10-30T19:59:49.700Z
    role: tester
    result: done
    summary: Three anchor line regressions added under TKT-001/S22; each fails today on the line number only
    verdict: null
    assumed: []
    duration_s: 414
  - at: 2026-10-30T20:09:13.940Z
    role: implementer
    result: done
    summary: Anchor findings use the &anchor token's line; anchor-location tests, full suite, lint and typecheck pass
    verdict: null
    assumed: []
    duration_s: 563
  - at: 2026-10-30T20:13:29.960Z
    role: reviewer
    result: done
    summary: "Anchor fix verified; 1248 tests, e2e 9/9, lint/types pass; build skipped; candidate follow-up: baseline TKT-002/R2 flow."
    verdict: approve
    assumed: []
    duration_s: 255
---
Self-hosting finding P26. Every tree reads every ticket's live state (WSP-004). When main gains a new field in the ticket format (PROP-040 added findings to history records), a ticket branch that predates it reads other tickets' history entries carrying the field and lint reports L020 errors on tickets it never touched; its reviewer could not finish until the branch was synced with main. A field the reader does not know, inside a ticket's history records (and anywhere else the format can grow), is kept and ignored, not an error; lint may warn once that the ticket was written by a newer spec. Known fields keep their checks.
