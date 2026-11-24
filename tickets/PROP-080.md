---
id: PROP-080
type: proposal
title: A blocked stage's stash leaves out the pinned CLI, and report summaries with a colon are read
status: done
stage: null
touches: [WSP-009, PIP-003]
violates: []
depends_on: []
changed: [PIP-003, PIP-003/R7, PIP-003/R8, PIP-003/S19, PIP-003/S20, WSP-009, WSP-009/R5, WSP-009/R6, WSP-009/S7]
questions: []
history:
  - at: 2026-11-01T00:13:17.395Z
    role: spec-writer
    result: done
    summary: "WSP-009/S7, R5, R6: the stash leaves out .spec/bin; PIP-003/S19, S20, R7, R8: a colon in an unquoted summary is read, prompts quote it"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [WSP-009/S7, WSP-009/S5, WSP-009/S6, PIP-003/S19, PIP-003/S20]
      - item: C2
        outcome: scenarios
        ids: [WSP-009/S7, PIP-003/S19]
      - item: C3
        outcome: na
        ids: []
        reason: the stash and the report reader share no state across an await or a process boundary beyond what WSP-009/S5 already shows
      - item: C4
        outcome: na
        ids: []
        reason: the pinned CLI and the summary text cross no new trust boundary; a forged summary is still bounded by PIP-003/R1 and R2
      - item: C5
        outcome: scenarios
        ids: [PIP-003/S19]
      - item: C6
        outcome: scenarios
        ids: [PIP-003/S19, WSP-009/S5, WSP-009/S6]
      - item: C8
        outcome: na
        ids: []
        reason: no fact about another tool or service; both behaviours were run on the current build
    assumed:
      - new: "Which unquoted summaries are read as plain text: those that do not start with a quote, | > [ { & * or !, and are followed by another key"
        value: as PIP-003/R7 says
      - new: Is only .spec/bin/ added to the stash exclusions, not the legacy skill scripts folder?
        value: only .spec/bin/, as the ticket says
    duration_s: 132
  - at: 2026-11-01T00:14:34.157Z
    role: spec-review
    result: done
    summary: Approved the stash and summary changes with a YAML compatibility follow-up
    verdict: approve
    findings:
      - cites: [PIP-003/R7, PIP-003/S19]
        text: "Follow-up: R7 also intercepts already-valid YAML plain summaries. For example, with another key next, summary: Fixed parser # verified locally currently means Fixed parser, but R7 makes the comment part of the summary. S19 covers quoted summaries and broken quotes, not this compatibility case. Consider preserving successful YAML parsing before applying the colon recovery, with a scenario for inline comments. This uncommon old-format case is non-blocking given the newly quoted prompts."
        class: C6
    assumed: []
    duration_s: 74
  - at: 2026-11-01T00:26:42.545Z
    role: tester
    result: done
    summary: "Tests for WSP-009/S7, PIP-003/S19 and S20: stash leaves out .spec/bin, unquoted colon summary is read, prompts quote it"
    verdict: null
    mutations:
      - scenario: WSP-009/S7
        wrong: the blocked stash still holds .spec/bin/spec.cjs, or leaves its edit uncommitted in the tree
      - scenario: WSP-009/S7
        wrong: an old stash holding .spec/bin/spec.cjs is applied as is, so it conflicts with the CLI main changed
      - scenario: PIP-003/S19
        wrong: "the reader still refuses an unquoted one-line summary that holds ': ' as invalid YAML"
      - scenario: PIP-003/S19
        wrong: the colon recovery also reads an unclosed quoted summary as plain text, so no YAML error is given
      - scenario: PIP-003/S19
        wrong: the quoted summary keeps its quote marks in the text instead of reading it as YAML
      - scenario: PIP-003/S20
        wrong: "one role's prompt (any of the five) still shows summary: <one line, at most 120 characters> unquoted"
    assumed:
      - new: S7 needs .spec/bin/spec.cjs tracked, but the chat-mini fixture gitignores .spec/bin/; the test force-adds it and commits
        value: done in a trackCli helper in tests/cli/generated-files.test.ts
      - new: S7 says 'new' files under .spec/bin are stashed out too (R5), but the fixture ignores that folder so a new file there cannot be shown
        value: only the tracked file is tested
      - new: "In the spec text '' stands for a double quote, so the quoted summary is summary: \"...\""
        value: tests use double quotes
    duration_s: 726
  - at: 2026-11-01T00:37:54.308Z
    role: implementer
    result: done
    summary: Stash leaves out .spec/bin; unquoted colon summaries are read on YAML failure; role prompts show the summary quoted
    verdict: null
    assumed: []
    duration_s: 670
  - at: 2026-11-01T00:45:44.831Z
    role: reviewer
    result: done
    summary: Stash and report changes match the brief; summary recovery preserves quotes and backslashes
    verdict: approve
    assumed: []
    duration_s: 469
---
Two small frictions measured while running this repo's pipeline (SELF-HOSTING P53 and the PROP-074 follow-up). (1) PROP-074 leaves files under the generated globs out of a blocked stage's stash. The pinned `.spec/bin/spec.cjs`, which merge already treats as generated, is still stashed, so it can conflict on restore after main's CLI changes (seen on PROP-063). Treat `.spec/bin/**` like the generated globs for the stash. (2) A report whose one-line `summary:` contains ': ' ("Second fix: …") is refused as invalid YAML. Seen three times, each costing a refusal and a round trip. The report form in the role prompts shows the summary quoted, and the reader accepts an unquoted one-line summary that holds a colon.
