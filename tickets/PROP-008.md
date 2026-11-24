---
id: PROP-008
type: proposal
title: A broken skill.json is a user error naming the file
status: done
stage: null
touches: [CLI-005]
violates: []
depends_on: []
changed: [CLI-005, CLI-005/R1, CLI-005/R4, CLI-005/S1, CLI-005/S2, CLI-005/S3, CLI-005/S4, CLI-005/S5, CLI-005/S6, CLI-005/S7, CLI-006/S1, CLI-006/S2, CLI-006/S3, CLI-006/S4, CLI-006/S5, CLI-006/S6, cli.InvalidSkillPointer, cli.InvalidSkillPointer.file]
questions:
  - id: Q1
    kind: blocker
    text: "The implementer stage ended with an invalid report: SPEC-STUB is still in README.md, docs/WORKFLOW.md, docs/field-guide.html, roles/implementer.md, roles/tester.md, src/core/brief.ts, src/core/report.ts, src/core/stubs.ts, src/generated/assets.ts; replace every stub with the real code. Review the uncommitted changes, then answer to resume."
    default: null
    cites: []
    answer: "False positive: the stub check matched SPEC-STUB in spec's own code and docs (I7). Fixed on main in b90b8c7 (ADR-001); the branch now has the fix. Resume the implementer stage; its uncommitted code is kept."
    raised_by: implementer
history:
  - at: 2026-10-29T09:02:48.397Z
    role: spec-writer
    result: done
    summary: A non-JSON skill.json now fails as cli.InvalidSkillPointer, naming the file, exit 2, no stack trace (CLI-005 R4, S6-S7).
    verdict: null
    assumed:
      - new: What triggers cli.InternalError in scenarios now that a bad skill.json no longer does?
        value: "A fault injected by the test (error 'Error: boom'); CLI-006 S5 likewise"
      - new: Is the broken-skill.json error a usage-style message (message, blank line, usage text)?
        value: Yes, like cli.NoSpecRoot; exit 2, nothing on stdout
  - at: 2026-10-29T09:06:42.489Z
    role: tester
    result: done
    summary: CLI-005 S1-S7 and CLI-006 S1-S6 covered; older tests renamed to drop IDs the spec lacks
    verdict: null
    assumed:
      - new: Do older tests that use PRV-xxx IDs as example data need renaming?
        value: "Yes, titles only: renamed to case numbers; data and assertions unchanged"
  - at: 2026-10-29T09:09:44.391Z
    role: implementer
    result: blocked
    summary: invalid report
    verdict: null
    assumed: []
  - at: 2026-10-29T09:42:57.651Z
    role: implementer
    result: done
    summary: Broken skill.json is a user error naming the file (exit 2; brief exits 0); internal errors caught centrally
    verdict: null
    assumed: []
  - at: 2026-10-29T09:43:29.245Z
    role: reviewer
    result: done
    summary: Diff satisfies CLI-005 S1-S7/R1-R4 and CLI-006 S1-S6/R1; approved.
    verdict: approve
    assumed: []
---
Review 2026-10-29, CLI-005#Q3: a skill.json that is not valid JSON makes commands fail with a message naming the file and exit 2, with no stack trace, instead of an internal error.
