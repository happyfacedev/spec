---
id: PROP-117
type: proposal
title: Inline code and text fences in the spec are data, never cites, and a quoted value can hold a double quote
status: open
stage: null
touches: [FMT-005, FMT-008, LNT-008, LNT-017]
violates: []
depends_on: []
changed: []
questions:
  - id: Q1
    kind: blocker
    text: "Today an ID inside inline code is a cite. Making inline code data removes links from any existing spec that relies on one. Which way: (a) apply it to format 2, and have lint report as an error every link that disappears so the author rewrites that step; or (b) make it a new formatVersion that a project opts into, with format 2 read as today?"
    default: null
    cites: [FMT-008, FMT-005]
    answer: "(a): apply it to format 2; lint reports every link that disappears as an error. The person left the choice to the agent's recommendation on 2026-11-23."
    raised_by: null
  - id: Q2
    kind: preference
    text: Does an untagged fenced block under a step stay step data whose IDs are cites?
    default: Yes, as today; only fences tagged text or output are data
    cites: [FMT-005]
    answer: null
    raised_by: null
history: []
---
Review of 2026-11-10. docs/SELF-HOSTING.md root cause R1 (findings A1, A2, A3, A12, A13, A16, I15), ranked there as the single biggest authoring win and still open after seven batches: the spec language cannot say 'this is literal output'. An ID inside inline code or a fenced output block becomes a cite (six of nine drafting agents hit it; real command output that prints IDs trips L004 and L026); a quoted value cannot hold a double quote, so spec/core/conventions.md teaches writing two single quotes instead, which roles then misread (I15); rules and steps treat quoted IDs differently (A3). What I want: one quoting rule for steps, step data, rules and prose. Inline code, and a fenced block tagged text or output, are data: nothing in them is a cite or is checked as an ID. Inside a quoted value, a backslash and a double quote stand for one double quote. Placeholders in angle brackets (a time, an abbreviated HEAD) are part of the format, not one project's convention. docs/FORMAT.md states the rule once. The two-single-quotes spelling keeps working, since this repository's spec uses it throughout.
