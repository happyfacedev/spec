---
id: PROP-103
type: proposal
title: Stage roles check their own report with check-report before finishing; the task leaves out the advance command
status: done
stage: null
touches: [PIP-017]
violates: []
depends_on: []
changed: [PIP-017/R2, PIP-017/R4, PIP-017/R7, PIP-017/R16, PIP-017/R17, PIP-017/S6, PIP-017/S10, PIP-017/S21]
questions: []
history:
  - at: 2026-11-01T17:28:08.326Z
    role: spec-writer
    result: done
    summary: "PIP-017: stage prompts save the report and run check-report; the task names the report file, not the advance command"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-017/S6, PIP-017/S18, PIP-017/S19, PIP-017/S20, PIP-008/S25]
        reason: spec impact PROP-103 lists no must-change or re-verify feature. S6 keeps the advance command outside the task. S19 and S20 keep the advance command and report-file path in cli.Next.advance. PIP-008/S25 already has advance reuse the test run that check-report kept on the same tree. PIP-018/R1 still takes the report from --report-file.
      - item: C2
        outcome: scenarios
        ids: [PIP-017/S21, PIP-017/S19, PIP-017/S20]
        reason: S21 says the check-report command uses the project CLI path (S4, R2, R15), so the quoting rules of S19 and the pointer-layout launcher of S20 apply to it. An older project prompt gets nothing added; the Working folder block still names the report file.
      - item: C3
        outcome: scenarios
        ids: [PIP-008/S25, PIP-008/S26, PIP-017/S6]
        reason: If the tree changes between the stage's check-report and the main session's advance, PIP-008/S26 makes advance run the tests again. If the saved file differs from the final message, R4 has the main session write the final message there.
      - item: C4
        outcome: scenarios
        ids: [PIP-017/S6, PIP-008/S26]
        reason: The report path is chosen by spec, not by the subagent. A stage's own 'report ok' records nothing, and advance checks the report again (R16, PIP-018). A forged or stale kept test run is not reused when anything differs (PIP-008/S26).
      - item: C5
        outcome: scenarios
        ids: [PIP-017/S6]
        reason: The task holds no advance command and never mentions ticket advance, so a subagent cannot record its own stage. A report that fails check-report is refused by advance as before (PIP-018).
      - item: C6
        outcome: scenarios
        ids: [PIP-017/S6, PIP-017/S18, PIP-017/S19, PIP-017/S20]
        reason: cli.Next.advance, its report-file path rules, the task order and the CLI path rules are unchanged. The task still never mentions ticket advance.
      - item: C8
        outcome: na
        ids: []
        reason: No other tool or service is involved. 'report ok' on stdout is this CLI's own output (PIP-004).
    assumed:
      - new: Does a stage's check-report run with the report file as stdin match the allow rule Bash(.spec/bin/spec *)?
        value: The spec does not promise it. R15 already says an approval Claude Code gives a command outside the rule is not promised, so the stage may be asked once.
      - new: What if the report file holds a stale message that differs from the final one?
        value: R4 has the main session make sure the file holds the final message and write it there when it does not.
      - new: Should CLI-007/S1 and R14 say the subagent saves the report?
        value: Left unchanged because CLI-007 is not in touches. Their wording 'the main session writes the report there' is now the fallback of PIP-017/R4. Follow-up for a later ticket.
    duration_s: 147
  - at: 2026-11-01T17:29:28.592Z
    role: spec-review
    result: done
    summary: Report saving needs an explicit exception to the reviewer's no-file and worktree-only instructions
    verdict: changes
    findings:
      - cites: [PIP-017/S21, PIP-017/R17, PIP-017/S10, PIP-017/R7, PIP-017/R2, PIP-017/R4]
        text: S21/R17 require every stage to save its report, but S10/R7 still require the spec-review prompt to say to change no file. R2 also confines work to the ticket worktree while R4 places the required report outside it. A reviewer following those prohibitions can omit the saved report and its check, defeating this proposal on an ordinary review stage. Specify an explicit exception for saving the named report while preserving the prohibition on project-file changes.
        class: C9
    assumed: []
    duration_s: 78
  - at: 2026-11-01T17:32:01.654Z
    role: spec-writer
    result: done
    summary: "PIP-017: stages save the report and run check-report; saving that one file is allowed for every role, reviewers too"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [PIP-017/S6, PIP-017/S18, PIP-017/S19, PIP-017/S20, PIP-008/S25]
        reason: spec impact PROP-103 lists no must-change or re-verify feature. S6 keeps the advance command outside the task. S19 and S20 keep the advance command and report-file path in cli.Next.advance. PIP-008/S25 already has advance reuse the test run that check-report kept on the same tree. PIP-018/R1 still takes the report from --report-file.
      - item: C2
        outcome: scenarios
        ids: [PIP-017/S21, PIP-017/S19, PIP-017/S20]
        reason: S21 says the check-report command uses the project CLI path (S4, R2, R15), so the quoting rules of S19 and the pointer-layout launcher of S20 apply to it. An older project prompt gets nothing added; the Working folder block still names the report file.
      - item: C3
        outcome: scenarios
        ids: [PIP-008/S25, PIP-008/S26, PIP-017/S6]
        reason: If the tree changes between the stage's check-report and the main session's advance, PIP-008/S26 makes advance run the tests again. If the saved file differs from the final message, R4 has the main session write the final message there.
      - item: C4
        outcome: scenarios
        ids: [PIP-017/S6, PIP-008/S26]
        reason: The report path is chosen by spec, not by the subagent. A stage's own 'report ok' records nothing, and advance checks the report again (R16, PIP-018). A forged or stale kept test run is not reused when anything differs (PIP-008/S26).
      - item: C5
        outcome: scenarios
        ids: [PIP-017/S6]
        reason: The task holds no advance command and never mentions ticket advance, so a subagent cannot record its own stage. A report that fails check-report is refused by advance as before (PIP-018).
      - item: C6
        outcome: scenarios
        ids: [PIP-017/S6, PIP-017/S18, PIP-017/S19, PIP-017/S20]
        reason: cli.Next.advance, its report-file path rules, the task order and the CLI path rules are unchanged. The task still never mentions ticket advance.
      - item: C8
        outcome: na
        ids: []
        reason: No other tool or service is involved. 'report ok' on stdout is this CLI's own output (PIP-004).
    assumed:
      - new: Does a stage's check-report run with the report file as stdin match the allow rule Bash(.spec/bin/spec *)?
        value: The spec does not promise it. R15 already says an approval Claude Code gives a command outside the rule is not promised, so the stage may be asked once.
      - new: What if the report file holds a stale message that differs from the final one?
        value: R4 has the main session make sure the file holds the final message and write it there when it does not.
      - new: Should CLI-007/S1 and R14 say the subagent saves the report?
        value: Left unchanged because CLI-007 is not in touches. Their wording 'the main session writes the report there' is now the fallback of PIP-017/R4. Follow-up for a later ticket.
    duration_s: 148
  - at: 2026-11-01T17:32:35.926Z
    role: spec-review
    result: done
    summary: Report-file exceptions resolve the reviewer's no-file and worktree-only contradiction
    verdict: approve
    assumed: []
    duration_s: 30
  - at: 2026-11-01T18:37:48.599Z
    role: tester
    result: done
    summary: "Tests for PIP-017 S6, S10, S21: report file in the Working folder block, no advance in the task, save and check-report in every role prompt"
    verdict: null
    mutations:
      - scenario: PIP-017/S6
        wrong: the Working folder block still omits the report file path or does not say the main session records the stage
      - scenario: PIP-017/S6
        wrong: the task keeps the advance command or the words ticket advance
      - scenario: PIP-017/S10
        wrong: the spec-review prompt still says Never edit any file with no report-file exception
      - scenario: PIP-017/S21
        wrong: only some role prompts, or none, tell the stage to save the report and run check-report until report ok
      - scenario: PIP-017/S21
        wrong: the check-report command in the prompt is bare spec, or names a placeholder role or ticket
      - scenario: PIP-017/S21
        wrong: the reviewer and spec-review prompts keep a blanket no-file rule that forbids saving the report file
      - scenario: PIP-017/S21
        wrong: an older project prompt is extended with the save and check-report instruction
    assumed:
      - new: How is the S21 instruction worded and where does it live in the role prompt?
        value: Not pinned; the test needs one line with save, final report, report file, Working folder, until, report ok and report block, plus a .spec/bin/spec check-report <role> PROP-201 command. The implementer chooses the wording and places it, probably in _shared.md.
      - new: Does the Working folder block name the report file in one line that also says it is the one file outside the worktree and what to save there?
        value: Yes; S6 and S21 look for a line holding the path, a save/final report phrase, 'one file' or 'only file', and 'outside'.
    duration_s: 3907
  - at: 2026-11-01T19:10:18.038Z
    role: implementer
    result: done
    summary: Working folder names the report file; every role saves it and runs check-report until report ok; reviewers may write it
    verdict: null
    assumed:
      - new: Wording of the check-report line in _shared.md
        value: "one line: save to the report file, run spec check-report {role} <ticket ID> with the file as stdin until report ok, run in background or with a long timeout if the shell limits time, then end with the report block"
    duration_s: 1946
  - at: 2026-11-01T19:16:01.204Z
    role: reviewer
    result: done
    summary: Clear report-check instructions, consistent role manifest, and a single named outside-worktree write exception
    verdict: approve
    assumed: []
    duration_s: 338
---
Self-hosting findings P75 and P69. (P75) When a stage subagent saves its report to the advance path and runs `spec check-report <role> <ID>` until it prints 'report ok', the session's `ticket advance` reuses that test run on the same tree: PROP-101's tester and implementer advances took 13-14 s instead of 7-10 min, and a report problem is fixed inside the stage instead of costing one of the three attempts. Today only the session's delegation text asks for it. Put it in this version's shipped role prompts (save the final report to the path the task names, run check-report until 'report ok', then end with the report block). (P69) The task a subagent gets carries the `advance:` line; a Haiku implementer (PROP-097) ran `ticket advance` itself, which the main session also does. Recording a stage is the main session's job: the task should name the report path (for the check above) but not hand the subagent the advance command, or say plainly that the main session records the stage.
