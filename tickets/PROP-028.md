---
id: PROP-028
type: proposal
title: Stage checks run the project's checkCommands
status: done
stage: null
touches: [PIP-004, PIP-006, FMT-002, INS-001]
violates: []
depends_on: []
changed: [FMT-002/S1, FMT-002/S11, FMT-002/S12, FMT-002/S13, INS-001/S1, INS-001/S13, PIP-004/S2, PIP-004/S3, PIP-004/S17, PIP-006, PIP-006/R7, PIP-006/S9, PIP-006/S10, PIP-006/S13, PIP-006/S16, PIP-006/S19, PIP-006/S20, PIP-006/S21, PIP-006/S22, format.Config, format.Config.checkCommands]
questions:
  - id: Q1
    kind: preference
    text: Should a checkCommands failure in a file outside testGlobs refuse the tester stage too, or only failures in its own test files?
    default: only failures in files under testGlobs
    cites: []
    answer: null
    raised_by: null
  - id: Q2
    kind: blocker
    text: tests/cli/check-commands.test.ts stage() runs 'ticket start PROP-205 tester', but a proposal with empty history starts at spec-writer, so ticket start exits 1 before checkCommands runs. The tester must fix the fixture or use another ticket.
    default: null
    cites:
      - PIP-006/S19
      - PIP-006/S20
    answer: "Fixed by a person commit on the branch: the fixture now records a spec-writer stage first. The S19-S21 tests fail on the missing checkCommands support, as they should. Resume."
    raised_by: implementer
history:
  - at: 2026-10-29T11:55:02.188Z
    role: spec-writer
    result: done
    summary: Added format.Config.checkCommands and PIP-006 S19-S22 and R7; lint clean.
    verdict: null
    assumed:
      - question: PROP-028#Q1
        value: only failures in files under testGlobs
  - at: 2026-10-29T12:21:50.789Z
    role: tester
    result: done
    summary: Tests for all in-scope scenarios; PIP-006 S19-S21 fail until checkCommands exists.
    verdict: null
    assumed:
      - question: PROP-028#Q1
        value: only failures in files under testGlobs
  - at: 2026-10-29T12:23:42.365Z
    role: implementer
    result: blocked
    summary: S19/S20 tests start PROP-205 at tester with empty history; ticket start refuses, so they cannot pass.
    verdict: null
    assumed: []
  - at: 2026-10-29T12:43:07.266Z
    role: implementer
    result: done
    summary: check-report runs checkCommands for done tester/implementer stages; S19-S22 pass, lint and typecheck clean
    verdict: null
    assumed: []
  - at: 2026-10-29T12:43:29.271Z
    role: reviewer
    result: done
    summary: checkCommands implemented per PIP-006 R7 and S19-S22; no checklist item broken
    verdict: approve
    assumed: []
---
Self-hosting findings I14 and R4 (docs/SELF-HOSTING.md). A new optional config key checkCommands (a list of shell commands, for example ["npm run lint", "npm run typecheck"]) is run by check-report for done tester and implementer stages. A tester stage is refused when a command fails on a file under testGlobs, naming the file and the command's output, so a lint error in a test never reaches the implementer. An implementer stage is refused when any command fails. Without checkCommands, nothing changes.
