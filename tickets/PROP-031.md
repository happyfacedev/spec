---
id: PROP-031
type: proposal
title: Dispatch picks a model per ticket size and records each stage's duration and cost
status: done
stage: null
touches: [WSP-005, PIP-008, FMT-002, INS-001]
violates: []
depends_on: []
changed: [FMT-002, FMT-002/R6, FMT-002/S15, PIP-008, PIP-008/R8, PIP-008/S1, PIP-008/S20, WSP-005, WSP-005/R9, WSP-005/S28, WSP-005/S29, format.Config, format.Config.models, format.ModelsConfig, format.ModelsConfig.large, format.ModelsConfig.small, format.ModelsConfig.threshold, pipeline.AdvanceTicket, pipeline.AdvanceTicket.transcript, pipeline.StageRecord, pipeline.StageRecord.cost_usd, pipeline.StageRecord.duration_s, pipeline.StageRecord.model]
questions:
  - id: Q1
    kind: preference
    text: "Which number decides a ticket's size: scenarios its impact reaches, or units it must change?"
    default: scenarios its impact reaches
    cites: []
    answer: null
    raised_by: null
  - id: Q2
    kind: blocker
    text: "PIP-008/S20 test makes a refusal with an untracked notes.txt, which no check refuses for an implementer, so exit is 0 not 1; the refused-report case cannot pass. Work is in git stash 'PROP-031 implementer: blocked'."
    default: null
    cites:
      - PIP-008/S20
      - PIP-008/R8
    answer: "Tester: the PIP-008/S20 setup must make a report that a check really refuses for an implementer (for example a done report while a test fails), not an untracked notes.txt."
    raised_by: implementer
  - id: Q3
    kind: blocker
    text: "PIP-008/S1 test uses toEqual on the history entry without duration_s, but R8 says every stage records duration_s; S1 or its test must allow the extra key. Work is in git stash 'PROP-031 implementer: blocked'."
    default: null
    cites:
      - PIP-008/S1
      - PIP-008/R8
    answer: "Tester: R8 adds duration_s to every recorded stage, so PIP-008/S1's test must allow it (match the entry's other keys, or include duration_s). The implementer's code stays stashed as 'PROP-031 implementer: blocked'."
    raised_by: implementer
history:
  - at: 2026-10-29T14:29:52.461Z
    role: spec-writer
    result: done
    summary: Added config models, SPEC_MODEL choice by scenario count, and duration_s/model/cost_usd on stage records
    verdict: null
    assumed:
      - question: PROP-031#Q1
        value: scenarios its impact reaches
      - new: How do model and cost reach advance
        value: --transcript <path> option read from the role transcript; wiring through hook left to a follow-up
  - at: 2026-10-29T15:05:54.777Z
    role: tester
    result: done
    summary: Tests for FMT-002/S15, PIP-008/S20, WSP-005/S28 and S29; all fail on assertions now, lint clean
    verdict: null
    assumed:
      - new: Transcript format for model and cost
        value: JSONL with message.model on an assistant line and total_cost_usd on a result line (claude -p json shape)
      - new: S28 ticket sizes
        value: Fixture counts are ambiguous, so the tests use thresholds 1000 and 0 for small and large
  - at: 2026-10-29T15:13:20.945Z
    role: implementer
    result: blocked
    summary: Code done and stashed; PIP-008/S20 refusal setup and PIP-008/S1 exact match conflict with the spec
    verdict: null
    assumed: []
  - at: 2026-10-29T15:13:39.804Z
    role: tester
    result: reopened
    summary: reopened by PROP-031#Q3
    verdict: null
    assumed: []
  - at: 2026-10-29T15:18:14.077Z
    role: tester
    result: done
    summary: Fixed PIP-008/S1 to allow duration_s and PIP-008/S20 refusal to use a failing test; lint, typecheck clean
    verdict: null
    assumed: []
  - at: 2026-10-29T15:24:03.705Z
    role: implementer
    result: done
    summary: Models config, per-ticket SPEC_MODEL, and duration/model/cost on stage records; tests, lint and typecheck pass
    verdict: null
    assumed: []
  - at: 2026-10-29T15:24:25.392Z
    role: reviewer
    result: done
    summary: Diff satisfies FMT-002/S15, WSP-005/S28-S29 and PIP-008/S20; no checklist item broken
    verdict: approve
    assumed: []
---
Self-hosting findings P8 and P9. Optional config models: { small: <model>, large: <model>, threshold: <scenarios> }. Dispatch sets SPEC_MODEL for a ticket from the number of scenarios its impact reaches (at or below threshold is small), unless SPEC_MODEL is already set in the environment. Each recorded stage in the ticket history gains duration_s, and model and cost_usd when the harness reports them (claude -p --output-format json), so a person can compare models per stage.
