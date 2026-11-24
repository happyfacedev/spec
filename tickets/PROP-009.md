---
id: PROP-009
type: proposal
title: find ranks a glossary term first when the query spells it
status: done
stage: null
touches: [GRF-006]
violates: []
depends_on: []
changed: [GRF-006, GRF-006/R1, GRF-006/S1, GRF-006/S2, GRF-006/S3, GRF-006/S4, GRF-006/S5, GRF-006/S6, GRF-006/S7, GRF-006/S8, GRF-006/S9, GRF-006/S10, GRF-006/S11, GRF-006/S12, GRF-006/S13, graph.FindHit, graph.FindHit.score]
questions: []
history:
  - at: 2026-10-29T20:16:57.811Z
    role: spec-writer
    result: done
    summary: find scores a query spelling a term or alias as a name match; GRF-006 S7 changed, S13 added
    verdict: null
    assumed:
      - new: Does the phrase score add to the words' own scores, or replace them?
        value: "Add: 'rate limit' scores the term 210, 60 from its two words and 150 for the phrase"
      - new: Does a quoted argument such as 'rate limit' count as several words?
        value: "No: one argument is one word, scored as today, so the term gets 150"
      - new: Does the same ranking apply to the brief's free-text search?
        value: Yes, it calls the same find code; no brief scenario shows a multi-word term phrase, so none changes
    duration_s: 384
  - at: 2026-10-29T20:54:26.067Z
    role: tester
    result: done
    summary: GRF-006 S1-S13 tests in tests/cli/find-units.test.ts; S7 and S13 fail until find scores phrases; lint clean
    verdict: null
    assumed:
      - new: Does S12 check the usage text against the CLI's USAGE or a copy held in the test?
        value: The CLI's USAGE from src/cli/args
      - new: Are the find tests with no scenario ID in cli.test.ts and usage.test.ts renamed or removed?
        value: Kept as they are; GRF-006/S1 to S13 are covered in find-units.test.ts
    duration_s: 2246
  - at: 2026-10-29T21:18:44.267Z
    role: implementer
    result: done
    summary: find adds a phrase score when a query of several words equals an ID, term or alias; GRF-006 S1-S13 pass
    verdict: null
    assumed: []
    duration_s: 1458
  - at: 2026-10-29T21:30:10.735Z
    role: reviewer
    result: done
    summary: "approve: find's phrase scoring matches GRF-006 S1-S13 and R1; typecheck, lint, 940 tests pass"
    verdict: approve
    assumed:
      - new: May the npx tsx and node find and brief comparisons run, though the reviewer command list does not name them?
        value: "Yes: read-only, and they change no files"
      - new: Does a quoted argument such as 'rate limit' count as two words for the phrase score?
        value: "No: one argument is one word, so a quoted query scores as before"
    duration_s: 686
---
Review 2026-10-29, GRF-006#Q1: a query whose words together equal a glossary term or alias scores that term as a name match, so "spec find rate limit" ranks the term "Rate limit" first.
