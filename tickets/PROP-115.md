---
id: PROP-115
type: proposal
title: A stage's check may run a project-supplied narrower test command; merge always runs the full one
status: open
stage: null
touches: [PIP-004, PIP-008, PIP-009, FMT-002]
violates: []
depends_on: []
changed: []
questions:
  - id: Q1
    kind: preference
    text: What placeholders does the stage test command get besides {report}?
    default: "{base}, the merge base of the ticket branch and the base branch, and {files}, the paths the branch changed, so any runner can select by either"
    cites: [FMT-002]
    answer: null
    raised_by: null
  - id: Q2
    kind: preference
    text: When merge's full run fails on a test no stage ran, where does the ticket go?
    default: Merge is refused as today and names the failing tests; the ticket returns to the implementer with those tests in its brief, without asking a person
    cites: [PIP-008]
    answer: null
    raised_by: null
history: []
---
Review of 2026-11-10. Every tester and implementer stage runs the project's whole test suite (14 min here), and those two roles are 77% of the 146 recorded agent-hours; spec merge then runs the whole suite again on the merged result. PROP-059 first tried running only the ticket's own scenarios in the tester's check (16 s against 188 s) and was withdrawn: review reproduced three ways it approved stages it should refuse (identifier-style test names never selected, errors lost when titles repeat, incomplete inventories). What I want instead: spec/config.json may name a second, optional test command for stage checks, for which the project uses its own runner's dependency knowledge (for example vitest related, or a changed-since-base mode) to run every test the stage's changed files could affect. check-report and ticket advance use it when it is set; without it they run the full command as today. spec merge always runs the full testCommand, so the full suite still stands between every ticket and the base branch. The stage checks that need the whole list of tests (a test for each in-scope scenario, tests for no scenario, test-first) must stay sound: say, for each, whether it reads the narrower run or needs the full list, and refuse rather than approve when the narrower run cannot answer. The spec must also say what happens when merge's full run fails a test no stage ran: who is told, and how the ticket gets back to a stage. PIP-008 is at 245 of its 250 lines, so new scenarios need a split or another home.
