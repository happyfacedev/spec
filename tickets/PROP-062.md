---
id: PROP-062
type: proposal
title: Tests name the wrong implementation they catch, and briefs carry the neighbours' scenarios
status: done
stage: null
touches: [PIP-006, PIP-011, PIP-012, PIP-013]
violates: []
depends_on: []
changed: [PIP-006, PIP-012, PIP-012/R10, PIP-012/S2, PIP-012/S21, PIP-013, PIP-013/R2, PIP-013/R4, PIP-013/S1, PIP-013/S2, PIP-013/S3, PIP-013/S4, PIP-013/S5, PIP-013/S6, PIP-013/S7, PIP-019, PIP-019/R1, PIP-019/R2, PIP-019/R3, PIP-019/R4, PIP-019/S1, PIP-019/S2, PIP-019/S3, PIP-019/S4, pipeline.Mutation, pipeline.Mutation.scenario, pipeline.Mutation.wrong, pipeline.Report, pipeline.Report.mutations, pipeline.StageRecord, pipeline.StageRecord.mutations]
questions:
  - id: Q1
    kind: blocker
    text: "tests/core/neighbours.test.ts:70 expects the Neighbours group not to contain 'INV-001', but PIP-012/R10 says scenarios are quoted as stored, and CNV-001/S2 stores the step 'And \"claude\" is never called (INV-001)'. The code quotes it as stored, so the group contains 'INV-001' and the test fails. Stripping the citation would break R10. The tester should check for the invariant's own section, for example not.toMatch(/^### INV-001/m), instead of the bare ID. Its changes are kept in git stash \"PROP-062 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites: [PIP-012/S21, PIP-012/R10]
    answer: "Yes: the tester changes neighbours.test.ts:70 to check that the invariant's own section is absent (for example not.toMatch(/^### INV-001/m)), since R10 quotes scenarios as stored, citations included."
    raised_by: implementer
  - id: Q2
    kind: blocker
    text: "Per PROP-062#Q1: tests/core/neighbours.test.ts:70 must check that the invariant's own section is absent (for example not.toMatch(/^### INV-001/m)) rather than the bare ID, since R10 quotes scenarios as stored. That is a tester change; the implementer code is complete and kept in the stash. Its changes are kept in git stash \"PROP-062 implementer: blocked\"; the next implementer stage gets them back."
    default: null
    cites: [PIP-012/S21, PIP-012/R10]
    answer: "Yes: back to the tester to fix the S21 assertion as Q1 says."
    raised_by: implementer
history:
  - at: 2026-10-31T14:53:42.515Z
    role: spec-writer
    result: done
    summary: Tester names a wrong implementation per changed scenario (PIP-019); briefs carry neighbours, cut first (PIP-012/013)
    verdict: null
    assumed:
      - new: Which neighbour scenarios go in the brief?
        value: the scenarios graph.Impact.reverify flags at depth 1, for features outside the ticket's scope; invariants, screens and features with none flagged are left out
      - new: "Where does ## Neighbours sit?"
        value: "just before ## Expand for every role (after Diff for the reviewer, after Case checklist for the spec-writer)"
      - new: How are neighbours cut to the budget?
        value: "first of all cuts, one feature at a time from the last, each to '- <ID> <title>: cut to fit the budget; run `spec show <ID>`'"
      - new: What does 'one mutation per test at random' mean?
        value: for each test of a changed scenario, the reviewer checks one of that scenario's mutations chosen at random
      - new: Do mutations apply after the implementer has run, and to documented scenarios?
        value: yes to both; the set is the scenarios the ticket changes (added or changed on a proposal, reworded aside; violated on a bug)
      - new: Where does the mutation check live?
        value: a new feature PIP-019, since PIP-006 would pass its 250-line budget (lint L011)
      - new: "Does spec next patch an older tester prompt's report form with mutations: []?"
        value: no; PIP-017 is unchanged and the refusal text names the fix
    duration_s: 434
  - at: 2026-10-31T15:28:56.108Z
    role: tester
    result: done
    summary: Tests for PIP-019, neighbours (PIP-012/S21, PIP-013/S4, S7); every done tester report in tests/ now lists mutations
    verdict: null
    assumed:
      - new: Does a mutation for a scenario in StageContext.newScenarios that the context's spec lacks count as a scenario the spec has?
        value: yes, as PIP-006/R4 lets a test name one the branch just added; report-corpus.yaml names CNV-001/S3 that way
      - new: Does the tester's own report list mutations?
        value: "no: this branch's check refuses the key today (report (root): Unrecognized key: mutations); they are named in the final message"
    duration_s: 2111
  - at: 2026-10-31T15:41:48.038Z
    role: implementer
    result: blocked
    summary: All code done; one test, PIP-012/S21 in neighbours.test.ts:70, contradicts R10 and cannot pass
    verdict: null
    assumed:
      - new: How does the tester prompt's report form get its mutations line from roles/tester.md?
        value: an optional template-only frontmatter key `form` plus a `{form}` line in roles/_shared.md that expandRole fills or drops; spec next does not patch older prompts
      - new: What does a mutation problem for a malformed entry read?
        value: "report mutations.<n>: <key>: <zod message>, so it starts report mutations.0: as PIP-019/R2 says"
    duration_s: 769
  - at: 2026-10-31T15:42:44.923Z
    role: implementer
    result: blocked
    summary: Code restored and unchanged; waiting on the tester to fix PIP-012/S21's assertion (Q1 answer)
    verdict: null
    assumed: []
    duration_s: 46
  - at: 2026-10-31T15:42:47.828Z
    role: tester
    result: reopened
    summary: reopened by PROP-062#Q2
    verdict: null
    assumed: []
  - at: 2026-10-31T15:51:02.970Z
    role: tester
    result: done
    summary: PIP-012/S21 test checks the INV-001 and UI-001 sections are absent, not the bare IDs a quoted step holds
    verdict: null
    assumed:
      - new: Does the tester's report list mutations?
        value: "no: with the implementer's code stashed the check refuses the key (Unrecognized key: mutations); the mutation for PIP-012/S21 is named in the final message"
    duration_s: 493
  - at: 2026-10-31T16:12:04.455Z
    role: implementer
    result: done
    summary: Mutations (PIP-019), brief neighbours cut first (PIP-012/013), role prompts and evals; npm run check passes
    verdict: null
    assumed:
      - new: How does the tester prompt's report form get its mutations line from roles/tester.md?
        value: an optional template-only frontmatter key `form` plus a `{form}` line in roles/_shared.md that expandRole fills or drops; spec next does not patch older prompts
      - new: What does a mutation problem for a malformed entry read?
        value: "report mutations.<n>: <key>: <zod message>, so it starts report mutations.0: as PIP-019/R2 says"
    duration_s: 1256
  - at: 2026-10-31T16:22:59.727Z
    role: reviewer
    result: done
    summary: Mutations and neighbour briefs meet the spec; code, prompts and tests are consistent
    verdict: approve
    assumed: []
    duration_s: 651
---
From docs/RETRO-PLUGIN-WORK.md (C1, C7).

1. Tester mutation rule: for each scenario it tests, the tester's report lists `mutations: [{ scenario: <ID>, wrong: "<plausible wrong implementation in one line>" }]`, one per scenario the ticket changes. check-report refuses a tester report on a proposal or bug that misses a changed scenario. The tester role prompt says: no test may compare generated output with itself, and each test must fail against the named wrong implementation.
2. The reviewer checks one mutation per test at random against the code (role prompt), and reports a finding when a test would still pass with the named wrong implementation.
3. Neighbours in briefs: every role's brief for a proposal or bug includes, under `## Neighbours`, the scenarios (titles + Given/When/Then) of features reached at depth 1 by the ticket's touches that the ticket does not touch itself, within the brief budget (PIP-013: neighbours are cut first, with a `spec show` line for what was cut).
