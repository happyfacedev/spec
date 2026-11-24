---
id: PROP-002
type: proposal
title: gaps shows a drafted module's description and names all its sections
status: done
stage: null
touches: [ADP-002]
violates: []
depends_on: []
changed: [ADP-002, ADP-002/S1, ADP-002/S2, ADP-002/S3, ADP-002/S4, ADP-002/S5, ADP-002/S6, ADP-002/S7, ADP-002/S8, ADP-002/S9, ADP-002/S10, ADP-002/S11, ADP-002/S12, ADP-002/S13, ADP-002/S14, ADP-002/S15, ADP-002/S16, ADP-002/S17, ADP-002/S18, CLI-001, CLI-001/S1, CLI-001/S2, CLI-001/S3, CLI-001/S4, CLI-001/S5, CLI-001/S6, CLI-001/S7, CLI-001/S8, CLI-001/S9, CLI-001/S10, CLI-001/S11, adopt.DraftGap, adopt.DraftGap.title]
questions: []
history:
  - at: 2026-10-29T22:23:13.408Z
    role: spec-writer
    result: done
    summary: Drafted module shows its first description line (S5, new S18); gaps usage line in CLI-001/S1 names all 7 sections
    verdict: null
    assumed:
      - new: What does a drafted module with no description show?
        value: "An empty title and one space: - billing (from README.md) (ADP-002/S18)"
      - new: Exact wording of the new gaps usage line
        value: "drafts, open questions, modules without features, contracts no feature uses, scenarios without a test, tests for no scenario and code pointers not found: what /spec-init asks about"
    duration_s: 453
  - at: 2026-10-29T22:57:19.669Z
    role: tester
    result: done
    summary: Tests for ADP-002/S1-S18 and CLI-001/S1-S11; ADP-002/S5, S18 and CLI-001/S1-S6 fail on the new behaviour
    verdict: null
    assumed:
      - new: Where do the ADP-002 tests go?
        value: One new file, tests/cli/list-what-needs-a-person.test.ts, named after the feature
      - new: Which spec do scenarios that name units chat-mini lacks run on?
        value: A copy of chat-mini, or the lint-cases base for S13, with the named units written into it
      - new: Does S1 pin the whole stdout?
        value: "No: only the header, the section headings and the blocks it names"
      - new: What does indented by two spaces mean in S17?
        value: Output equals JSON.stringify(value, null, 2) plus a final newline, as toJson writes it
      - new: How do S14 and S16 get test results?
        value: The test command copies a report that names the tests as passing, as the ADP-003 tests do
    duration_s: 2046
  - at: 2026-10-29T23:23:50.719Z
    role: implementer
    result: done
    summary: gaps shows a drafted module's first description line and names all seven sections in its usage line
    verdict: null
    assumed: []
    duration_s: 1590
  - at: 2026-10-29T23:36:15.782Z
    role: reviewer
    result: done
    summary: Module titles and seven-section usage meet the spec; base comparison, 1045 tests, typecheck and lint pass.
    verdict: approve
    assumed:
      - new: How can scratch fixture comparisons preserve the no-files rule?
        value: Use read-only in-memory fixture copies.
    duration_s: 744
---
Review 2026-10-29. ADP-002#Q1: a drafted module's line in "Drafts to confirm" shows the first line of its description as its title (no double space). ADP-002#Q2: the gaps usage line names all seven sections it prints.
