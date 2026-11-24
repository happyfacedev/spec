---
id: PROP-020
type: proposal
title: A tracker ticket with a bad ID is reported
status: done
stage: null
touches: [TKT-004]
violates: []
depends_on: []
changed: [TKT-004/R6, TKT-004/S1, TKT-004/S2, TKT-004/S3, TKT-004/S4, TKT-004/S5, TKT-004/S6, TKT-004/S7, TKT-004/S8, TKT-004/S9, TKT-004/S10, TKT-004/S11, TKT-004/S12, TKT-004/S13, TKT-004/S14]
questions:
  - id: Q1
    kind: preference
    text: Should the new L020 finding for a tracker entry with a bad ID be a warning or an error?
    default: warning
    cites: []
    answer: null
    raised_by: null
  - id: Q2
    kind: blocker
    text: Bash is denied for this session, so spec test, npm run typecheck and npm run lint cannot run. The fix in CommandTicketStore.list() (src/io/ticket-store.ts) is not applied or verified.
    default: null
    cites:
      - TKT-004/S14
      - TKT-004/R6
    answer: "Bash was not off: only commands outside the allowed list were refused (bare spec, git -C). Use the full spec path and npm/npx commands; read-only git is now allowed (6136eae). Resume."
    raised_by: implementer
  - id: Q3
    kind: blocker
    text: "TKT-004/S14 gives the message with two single quote pairs around notes. core/conventions.md line 9 says an inner double quote inside a quoted value is written as two single quotes, so the message holds double quotes around notes. tests/cli/tracker.test.ts expects single quotes around notes at line 224, and around notes and task-104 at line 240, so the test contradicts its scenario. With single quotes all 15 tracker tests pass, so the only disagreement is the quote characters. Fix: the tester changes the expected messages to double quotes, or the spec-writer changes S14 and R6 to single quotes."
    default: null
    cites:
      - TKT-004/S14
      - TKT-004/R6
    answer: "The scenario is right: '' means one double quote (conventions, now explicit). The test expectations were corrected to double quotes by a person commit; implement the message with double quotes around the ID."
    raised_by: implementer
history:
  - at: 2026-10-29T11:16:07.360Z
    role: spec-writer
    result: done
    summary: "TKT-004: a tracker entry whose ID is not a ticket ID is reported as an L020 warning (S14, R6); the queue still skips it"
    verdict: null
    assumed:
      - question: PROP-020#Q1
        value: warning
      - new: LNT-014 (owner of L020) does not mention the new tracker-entry warning and is not in the brief's touches. Add LNT-014 to touches to document it there?
        value: left unchanged; TKT-004/S14 and TKT-004/R6 state the behaviour
  - at: 2026-10-29T11:24:43.711Z
    role: tester
    result: done
    summary: TKT-004 S1-S14 and R6 tests in tests/cli/tracker.test.ts; not run (Bash denied); S14 and R6 fail now
    verdict: null
    assumed:
      - question: PROP-020#Q1
        value: warning
      - new: "TKT-004/S14 message: the spec reads ''notes'' (doubled single quotes, a YAML-style escape that appears in no other body step). Is 'notes' with single quotes meant?"
        value: "'notes' with single quotes; the test asserts that"
      - new: TKT-004/S12 and S13 have no CLI path (ticket start and answer check the ticket is listed first). Drive them through CommandTicketStore directly?
        value: yes, as tests/cli/parallel.test.ts does
      - new: TKT-004/R6 is a rule, not a scenario; test-claims does not count it as a scenario claim
        value: name the test with the rule ID as the brief lists it
  - at: 2026-10-29T11:26:11.250Z
    role: implementer
    result: blocked
    summary: Bash is denied, so tests, typecheck and lint cannot run; no code changed
    verdict: null
    assumed:
      - question: PROP-020#Q1
        value: warning
  - at: 2026-10-29T11:36:07.123Z
    role: implementer
    result: blocked
    summary: "Blocked on a quote conflict: tests expect single quotes around notes but S14 and R6 imply double quotes; no code changed"
    verdict: null
    assumed:
      - question: PROP-020#Q1
        value: warning
  - at: 2026-10-29T11:46:27.081Z
    role: implementer
    result: done
    summary: Tracker entries with a non-ticket ID are left out and reported as L020 warnings; tests, typecheck, lint pass
    verdict: null
    assumed:
      - question: PROP-020#Q1
        value: warning
  - at: 2026-10-29T11:50:05.874Z
    role: reviewer
    result: done
    summary: "Approve: S1-S14 and R1-R6 hold; 15 tracker and 535 suite tests, typecheck and lint pass"
    verdict: approve
    assumed:
      - question: PROP-020#Q1
        value: warning
---
Review 2026-10-29, TKT-004#Q2: an entry that the tracker's list returns with an ID that is not a ticket ID is reported as an L020 finding instead of being dropped silently.
