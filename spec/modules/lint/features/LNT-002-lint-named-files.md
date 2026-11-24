---
id: LNT-002
title: Lint only the named files
module: lint
status: active
writes: [lint.Report.findings]
questions:
  - id: Q1
    kind: preference
    text: When every path given to --files is outside the spec root and the ticket store, the per-file findings of every file are dropped, as if an empty list of files had been named. Should such a call lint as if --files were not given, or keep dropping them?
    default: keep dropping them, as the code does now
    cites: []
    answer: 'Keep today''s behaviour (decided in review, 2026-10-29).'
    raised_by: null
---
## Intent
An editor hook or an agent that just changed a few files wants the problems in those files, not every per-file problem in the spec. `--files` keeps only the per-file findings of the named files, and still reports every finding of the rules that look across the spec, since an edit to one file can break another.

## Behaviour
### S1: Without --files every finding is reported
Given the base spec of LNT-001 with "Bulk orders." as the text under "## Out of scope" of "ALP-001", "touches: []" in "TASK-001", and "Status: active · Superseded by: INV-001" on line 4 of "core/invariants.md"
When the developer runs lint.Lint from the project root
Then lint.Report.findings is, in this order:
| rule | severity | file | line |
| "L016" | "error" | "core/invariants.md" | 4 |
| "L006" | "error" | "modules/alpha/features/ALP-001-make-a-widget.md" | 26 |
| "L020" | "warning" | "tickets/TASK-001.md" | 7 |

### S2: A file with no findings
Given the spec of S1
When the developer runs lint.Lint from the project root with lint.Lint.files "spec/core/glossary.md"
Then lint.Report.findings is only the "L016" error in "core/invariants.md" (R1)

### S3: Several files, space-separated
Given the spec of S1
When the developer runs lint.Lint from the project root with "--files spec/modules/alpha/features/ALP-001-make-a-widget.md tickets/TASK-001.md"
Then lint.Report.findings is the three findings of S1 (R1)

### S4: Files given with an equals sign
Given the spec of S1
When the developer runs lint.Lint from the project root with "--files=tickets/TASK-001.md"
Then lint.Report.findings is the "L016" error and the "L020" warning of S1, and not the "L006" error (R1)

### S5: Paths are relative to the working directory
Given the spec of S1
When the developer runs lint.Lint from the project root with "--files core/glossary.md"
Then lint.Report.findings is only the "L016" error, since the spec root is "spec/" and the path names no file in it (R2)

### S6: A path outside the spec and the ticket store
Given the spec of S1
When the developer runs lint.Lint from the project root with "--files /tmp/elsewhere.md"
Then lint.Report.findings is only the "L016" error (R2)

### S7: The exit code counts only what is kept
Given the base spec of LNT-001 with "Bulk orders." as the text under "## Out of scope" of "ALP-001"
When the developer runs lint.Lint from the project root with "--files spec/core/glossary.md"
Then lint.Report.findings is empty and cli.CommandResult.exitCode is 0 (R1)

## Rules
- R1: With --files, a finding of L001, L002, L006, L007, L008, L010, L011 or L020 is kept only when its file is one of the named files; every other rule's findings are always kept
- R2: Each path is resolved from the working directory and matched as the finding names it; a path that is neither under the spec root nor in the ticket store matches no finding

## Out of scope
- Which files the harness hook passes after an edit: install
