---
id: TASK-008
type: task
title: A test fails when the split test files stop covering every test exactly once
status: open
stage: null
touches: [PIP-009]
violates: []
depends_on: []
changed: []
questions: []
history: []
---
Follow-up from TASK-003's review (2026-11-10). TASK-003 split the largest test files: tests/cli/<name>-suite.ts holds the tests, tests/cli/partitioned-it.ts assigns each to a part by a hash of its name and by describe order, and each tests/cli/<name>-part-<n>.test.ts runs one part. Nothing checks that the parts stay complete: raising a suite's part count without adding the matching part file, or adding a describe that shifts the nested ordinal in some parts only, would skip tests silently, with no error. What I want: one test that, for every partitioned suite, lists the tests each part file selects (without running them) and fails unless every test of the suite is selected by exactly one existing part file, and every part file selects at least one test. No source file changes and no existing test changes its name or assertions.
