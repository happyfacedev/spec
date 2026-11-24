---
id: PROP-130
type: proposal
title: On Claude Code, a stage subagent gets its brief and model from a hook, and its report is recorded when it stops
status: done
stage: null
touches: [INS-014, INS-014/S4, INS-017, INS-007, INS-019, install.HookEvent, install.UnknownHookEvent, install.PluginPackage.hooks]
violates: []
depends_on: []
changed: [INS-003, INS-007, INS-007/S2, INS-014, INS-014/S4, INS-014/S13, INS-014/S18, INS-014/S26, INS-015, INS-015/S22, INS-017, INS-017/R3, INS-017/S3, INS-020, INS-020/R1, INS-020/R2, INS-020/R3, INS-020/R4, INS-020/R5, INS-020/R6, INS-020/R7, INS-020/R8, INS-020/R9, INS-020/R10, INS-020/R11, INS-020/R12, INS-020/R13, INS-020/R14, INS-020/R15, INS-020/R16, INS-020/R17, INS-020/R18, INS-020/R19, INS-020/R20, INS-020/S1, INS-020/S2, INS-020/S3, INS-020/S4, INS-020/S5, INS-020/S6, INS-020/S7, INS-020/S8, INS-020/S9, INS-020/S10, INS-020/S11, INS-020/S12, INS-020/S13, INS-020/S14, INS-020/S15, INS-020/S16, INS-020/S17, INS-020/S18, INS-020/S19, INS-020/S20, INS-020/S21, INS-020/S22, INS-020/S23, INV-019, install.AgentToolDecision, install.AgentToolDecision.hookEventName, install.AgentToolDecision.permissionDecision, install.AgentToolDecision.permissionDecisionReason, install.AgentToolDecision.updatedInput, install.AgentToolInput, install.AgentToolInput.description, install.AgentToolInput.model, install.AgentToolInput.prompt, install.AgentToolInput.run_in_background, install.AgentToolInput.subagent_type, install.ClaudeSettings, install.ClaudeSettings.hooks, install.HandbackToolInput, install.HandbackToolInput.message, install.Hook, install.Hook.input, install.HookCommand, install.HookCommand.timeout, install.HookEvent, install.HookInput, install.HookInput.tool_input, install.HookInput.tool_name, install.HookOutput, install.HookOutput.hookSpecificOutput, install.HookOutput.systemMessage, install.HookSpecificOutput, install.HookSpecificOutput.additionalContext, install.HookSpecificOutput.hookEventName, install.StopHookOutput, install.StopHookOutput.decision, install.StopHookOutput.reason, install.StopHookOutput.systemMessage, install.SubagentStopInput, install.SubagentStopInput.agent_id, install.SubagentStopInput.agent_transcript_path, install.SubagentStopInput.agent_type, install.SubagentStopInput.last_assistant_message, install.UnknownHookEvent]
questions: []
history:
  - at: 2026-11-22T12:10:47.862Z
    role: spec-writer
    result: done
    summary: "New INS-020: before-agent, before-handback and subagent-stop hooks delegate spec:<ID> and record reports"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-010/S11, INS-020/S14, INS-014/S4, INS-007/S2, INS-017/S3, INS-014/S18, INS-014/S26, INS-019/S1]
        reason: "spec impact reaches INS-010 (re-verify): its after-edit PostToolUse group is unchanged and INS-020/S14 says so; INS-007, INS-014 and INS-017 change with the new events and driving loop; INS-019 is touched but its marketplace scenarios still hold unchanged"
      - item: C2
        outcome: scenarios
        ids: [INS-020/S1, INS-020/S7, INS-020/S13, INS-020/S15, INS-020/S17, INS-020/S19, INS-017/S3, INS-014/S26]
        reason: Agent and older Task tool names; a report handed back through SubagentHandback (Claude Code 2.1.271 or later) or left in the final message, with the transcript read when last_assistant_message is missing; an older pinned CLI without the events, no spec root and non-JSON input pass through; skills probe the pinned CLI and fall back to the relay on an old CLI or Astro
      - item: C3
        outcome: scenarios
        ids: [INS-020/S6, INS-020/S11, INS-020/S12, INS-020/S17]
        reason: two requests for one ticket start it once; requests for two tickets each start; a relayed advance while the hook records leaves one record; two stages stopping together are both recorded and their test runs take turns; a stage recorded at handback is not recorded again when its subagent stops
      - item: C4
        outcome: invariant
        ids: [INV-019]
        reason: "the Agent prompt, a handback message and a subagent's final message or transcript cross into spec: only an exact spec:<ticket ID> is a request, the other input keys are passed back as given, and a report is recorded only for the running stage through the advance checks, which decide from git, tests and lint"
      - item: C5
        outcome: scenarios
        ids: [INS-020/S2, INS-020/S4, INS-020/S5, INS-020/S10, INS-020/S13, INS-020/S19]
        reason: a prompt that is not exactly spec:<ID> starts nothing; an unknown ticket is denied with its error; a missing model is denied before any start; a handback or final message with no report or for another ticket or role records nothing; unreadable input never blocks
      - item: C6
        outcome: scenarios
        ids: [INS-020/S14, INS-014/S4, INS-010/S11, INS-008/S3, INS-008/S5, INS-015/S1, INS-007/S13, INS-014/S26, INS-017/S2]
        reason: session-start, before-edit and after-edit groups are unchanged; session-start stays silent in subagents and worktrees; before-edit enforcement is unchanged; removed before-delegate and before-finish stay no-ops; Astro and old-CLI relays are unchanged
      - item: C8
        outcome: scenarios
        ids: [INS-020/S1, INS-020/S3, INS-020/S7, INS-020/S8, INS-020/S13, INS-020/S14, INS-020/S17, INS-020/S18]
        reason: "Verified 2026-11-22 by the driving session: a live run with Claude Code 2.1.312 (PreToolUse on Agent returning allow with updatedInput replaced prompt and model; PostToolUse on a background Agent fires at launch), and https://code.claude.com/docs/en/hooks (SubagentStop input agent_id, agent_type, agent_transcript_path, last_assistant_message; decision block with reason keeps the subagent running with the reason as its next instruction; SubagentStart has no prompt). The same page, SubagentStop input section, verified 2026-11-22: on Claude Code v2.1.271 or later a subagent that runs with the SubagentHandback tool delivers its report through that tool before it stops, last_assistant_message then holds its closing text and not the report, and the report is that call's message input, which a PreToolUse or PostToolUse hook matched on SubagentHandback receives as tool_input.message; for a SubagentHandback call, a PreToolUse deny makes Claude Code tell the subagent to call the tool again, up to three times. I re-read the page on 2026-11-22: updatedInput replaces the entire input; a deny reason is shown to Claude; timeout is in seconds, default 600; a timed-out PreToolUse hook and any exit other than 0 or 2 do not block; systemMessage is a warning shown to the user. The docs name the tool Agent only; Task is kept in the matcher as the ticket asks, and matching a name that is absent is harmless"
    assumed:
      - new: What are the new hook event names?
        value: before-agent (PreToolUse Agent|Task), before-handback (PreToolUse SubagentHandback) and subagent-stop (SubagentStop); the removed before-delegate and before-finish names stay silent no-ops
      - new: Which timeouts does hooks.json give the new hooks?
        value: 1800 seconds for before-agent, 3600 seconds for before-handback and for subagent-stop
      - new: Does a missing role model start the stage before the deny?
        value: "No: the hook denies before any stage starts, so the same request works once the model is saved"
      - new: How does the person learn of the refusal that blocks the ticket?
        value: The handback is allowed, or the subagent stops, with a systemMessage saying the ticket is blocked; the next spec:<ID> request is denied with the blocker question
      - new: What do the recording hooks do when the check could not run?
        value: Deny the handback or block the stop with the could-not-run reason, asking for the same report again or a blocked report; nothing recorded, no attempt used
      - new: How do driving skills know the pinned CLI has the hooks?
        value: They run .spec/bin/spec hook claude-code before-agent with empty stdin; exit 0 means use stage requests, unknown hook event means relay as before
      - new: How does the run skill start a wave on Claude Code with the hooks?
        value: It lists with spec next --summary and sends one spec:<ID> request per listed ticket, without --start
      - new: When is the transcript read, and is it passed to advance?
        value: Only when last_assistant_message is missing or empty; the report is recorded as with --report - and no --transcript
    duration_s: 937
    model: claude
  - at: 2026-11-22T12:13:47.764Z
    role: spec-review
    result: done
    summary: "Request changes: hook failures can bypass spec staging, and handback retries lack a failure-safe path"
    verdict: changes
    findings:
      - cites: [INS-020/R11, INS-020/S13]
        text: The fail-open rule says a hook that cannot run never blocks an Agent call, handback, or stop, but S13 covers only an older CLI, missing root, and malformed JSON. It does not define hook crashes, nonzero CLI failures, or timeout behavior on an actual spec request/report. In particular, a timed-out before-agent hook could allow the original spec:<ID> prompt to launch without a task/model, while a timed-out report hook could let an unrecorded stage stop. Specify observable handling for hook failure/timeouts, preserving pass-through for unrelated calls.
        class: C5
      - cites: [INS-020/R16, INS-020/S18, INS-020/R11]
        text: A refused handback is denied so Claude Code retries SubagentHandback, with up to three attempts, but there is no scenario for exhaustion of Claude Code's retry limit or a handback hook failure after a report was already accepted. The verified behavior says deny causes at most three calls; a third refusal can block and allow, but an accepted record followed by a lost/failed hook response could make the subagent retry against a stage that is no longer running, silently handing back without telling the main session whether the report was recorded. Define the outcome/recovery for this ambiguous boundary so a plausible accepted-then-timeout does not strand the pipeline.
        class: C3
    assumed: []
    duration_s: 175
    model: codex
  - at: 2026-11-22T12:18:40.292Z
    role: spec-writer
    result: done
    summary: "INS-020: refuse unpreparable requests, guard bare spec:<ID> subagents, name unrecorded stages, ack recorded reports"
    verdict: null
    checklist:
      - item: C1
        outcome: scenarios
        ids: [INS-010/S11, INS-020/S14, INS-014/S4, INS-014/S13, INS-015/S22, INS-007/S2, INS-017/S3, INS-014/S18, INS-014/S26, INS-019/S1, INS-003/S10, PIP-018/S9, PIP-022/S1, PIP-025/S1]
        reason: spec impact reaches INS-010, whose after-edit group INS-020/S14 keeps unchanged; INS-003 only reads the reworded ClaudeSettings.hooks and still copies no plugin hooks; the PIP, TKT and WSP neighbours are reached through pipeline.AdvanceTicket, whose behaviour the hooks reuse unchanged; INS-007, INS-014 (S4, S13, S18, S26), INS-015/S22 and INS-017 change with the new events and the refusal of an unpreparable request; INS-019 still holds unchanged
      - item: C2
        outcome: scenarios
        ids: [INS-020/S1, INS-020/S7, INS-020/S13, INS-020/S15, INS-020/S17, INS-020/S19, INS-020/S20, INS-017/S3, INS-014/S26]
        reason: Agent and older Task tool names; a report handed back through SubagentHandback (Claude Code 2.1.271 or later) or left in the final message, with the transcript read when last_assistant_message is missing; an older pinned CLI passes unrelated payloads through but refuses a spec stage request naming spec upgrade; no spec root and non-JSON input pass through; skills probe the pinned CLI and fall back to the relay on an old CLI or Astro
      - item: C3
        outcome: scenarios
        ids: [INS-020/S6, INS-020/S11, INS-020/S12, INS-020/S17, INS-020/S21, INS-020/S22]
        reason: two requests for one ticket start it once; requests for two tickets each start; a relayed advance while the hook records leaves one record; two stages stopping together are both recorded; a stage recorded at handback is not recorded again at stop; a handback retried after its recording answer was lost is acknowledged as already recorded with no attempt used; a report hook that failed or timed out leaves the stage in progress, and the next request names the relay and restart commands
      - item: C4
        outcome: invariant
        ids: [INV-019]
        reason: "the Agent prompt, a handback message and a subagent's final message or transcript cross into spec: only an exact spec:<ticket ID> is a request, the other input keys are passed back as given, and a report is recorded only for the running stage through the advance checks, which decide from git, tests and lint"
      - item: C5
        outcome: scenarios
        ids: [INS-020/S2, INS-020/S4, INS-020/S5, INS-020/S10, INS-020/S13, INS-020/S19, INS-020/S20, INS-020/S22, INS-020/S23]
        reason: a prompt that is not exactly spec:<ID> starts nothing; an unknown ticket, a missing model, a project CLI that cannot start, fails or cannot load the workspace, and an older pinned CLI each deny a real request with spec could not prepare <ID>; a bare request that still reaches a subagent (hook timeout) is answered with spec brief missing for <ID> and no change; a report hook failure records nothing and is named on the next request; a handback or final message for no running stage records nothing
      - item: C6
        outcome: scenarios
        ids: [INS-020/S14, INS-014/S4, INS-010/S11, INS-008/S3, INS-008/S5, INS-015/S1, INS-007/S13, INS-014/S26, INS-017/S2, INS-020/S13]
        reason: session-start, before-edit and after-edit groups are unchanged; session-start stays silent in subagents and worktrees, and the subagent context comes from its own SubagentStart hook; before-edit enforcement is unchanged; removed before-delegate and before-finish stay no-ops; Astro and old-CLI relays are unchanged; every payload that is not a spec request still passes through on failure
      - item: C8
        outcome: scenarios
        ids: [INS-020/S1, INS-020/S3, INS-020/S7, INS-020/S8, INS-020/S13, INS-020/S14, INS-020/S17, INS-020/S18, INS-020/S21, INS-020/S23]
        reason: "Verified 2026-11-22 by the driving session: a live run with Claude Code 2.1.312 (PreToolUse on Agent returning allow with updatedInput replaced prompt and model; PostToolUse on a background Agent fires at launch), and https://code.claude.com/docs/en/hooks (SubagentStop input agent_id, agent_type, agent_transcript_path, last_assistant_message; decision block with reason keeps the subagent running with the reason as its next instruction; SubagentStart has no prompt and its output only adds context). The same page, SubagentStop input section, verified 2026-11-22: on Claude Code v2.1.271 or later a subagent that runs with the SubagentHandback tool delivers its report through that tool before it stops, last_assistant_message then holds its closing text and not the report, and the report is that call's message input, which a PreToolUse or PostToolUse hook matched on SubagentHandback receives as tool_input.message; for a SubagentHandback call, a PreToolUse deny makes Claude Code tell the subagent to call the tool again, up to three times. I read the page on 2026-11-22: SubagentStart hooks cannot block subagent creation but may return hookSpecificOutput with hookEventName SubagentStart and additionalContext, added to the subagent's context before its first prompt, and it runs for every agent type when no matcher is set; updatedInput replaces the entire input; a deny reason is shown to Claude; timeout is in seconds, default 600; a timed-out PreToolUse hook and any exit other than 0 or 2 do not block, which is why a bare request can still reach a subagent; systemMessage is a warning shown to the user. The docs name the tool Agent only; Task is kept in the matcher as the ticket asks, and matching a name that is absent is harmless"
    assumed:
      - new: What are the new hook event names?
        value: before-agent (PreToolUse Agent|Task), before-handback (PreToolUse SubagentHandback), subagent-start (SubagentStart) and subagent-stop (SubagentStop); the removed before-delegate and before-finish names stay silent no-ops
      - new: Which timeouts does hooks.json give the new hooks?
        value: 1800 seconds for before-agent, 3600 seconds for before-handback and for subagent-stop, and Claude Code's default for subagent-start
      - new: Does a missing role model start the stage before the deny?
        value: "No: the hook denies before any stage starts, so the same request works once the model is saved"
      - new: How does the person learn of the refusal that blocks the ticket?
        value: The handback is allowed, or the subagent stops, with a systemMessage saying the ticket is blocked; the next spec:<ID> request is denied with the blocker question
      - new: What do the recording hooks do when the check could not run?
        value: Deny the handback or block the stop with the could-not-run reason, asking for the same report again or a blocked report; nothing recorded, no attempt used
      - new: How do driving skills know the pinned CLI has the hooks?
        value: They run .spec/bin/spec hook claude-code before-agent with empty stdin; exit 0 means use stage requests, unknown hook event means relay as before
      - new: How does the run skill start a wave on Claude Code with the hooks?
        value: It lists with spec next --summary and sends one spec:<ID> request per listed ticket, without --start
      - new: When is the transcript read, and is it passed to advance?
        value: Only when last_assistant_message is missing or empty; the report is recorded as with --report - and no --transcript
      - new: What text do an unpreparable request and an already-recorded report carry?
        value: "The deny reason starts 'spec could not prepare <ID>: ' with the error; the already-recorded systemMessage is '<ID> <role> report already recorded'"
      - new: When is a report for the stage just recorded?
        value: When the ticket's latest stage record is that role's and no stage of the ticket is running; a report for an older stage or another role is left alone (R9)
      - new: Which report path does the unrecorded-stage reason name?
        value: The absolute report path inside the ticket worktree parent that cli.Next.advance would name for that ticket and role (PIP-017/R4)
    duration_s: 288
    model: claude
  - at: 2026-11-22T12:19:42.468Z
    role: spec-review
    result: done
    summary: Round 2 fixes cover hook failures, unprepared requests, and duplicate report delivery
    verdict: approve
    assumed: []
    duration_s: 57
    model: codex
  - at: 2026-11-22T12:43:53.224Z
    role: tester
    result: done
    summary: Tests for INS-020 stage hooks plus changed INS-007/S2, INS-014/S4/S13/S18/S26, INS-015/S22, INS-017/S3
    verdict: null
    mutations:
      - scenario: INS-007/S2
        wrong: the unknown-event message still lists only session-start, before-edit and after-edit
      - scenario: INS-014/S4
        wrong: the new hooks are added to the existing before-edit PreToolUse group instead of groups of their own
      - scenario: INS-014/S13
        wrong: a spec stage request under a delegated spawn failure passes through silently like every other hook payload
      - scenario: INS-014/S18
        wrong: the run skill drops its next --start relay path and only sends stage requests
      - scenario: INS-014/S26
        wrong: the relay instructions stay unconditional, with no before-agent probe and no old-CLI fallback
      - scenario: INS-015/S22
        wrong: the plugin also silences the old pinned CLI's unknown before-agent failure for a spec stage request, so the bare request runs
      - scenario: INS-017/S3
        wrong: a stage request for one ticket of the wave starts every listed ticket's stage, as next --start does
      - scenario: INS-020/S1
        wrong: updatedInput carries only prompt, description and model, dropping subagent_type and run_in_background
      - scenario: INS-020/S2
        wrong: any prompt that contains spec:<ID> is treated as a stage request
      - scenario: INS-020/S3
        wrong: the deny reason gives the question text but not the ticket answer command
      - scenario: INS-020/S4
        wrong: a running stage is denied with a generic not-ready reason that omits the --restart command
      - scenario: INS-020/S5
        wrong: the stage is started before the missing-model deny, so the retry finds it already running
      - scenario: INS-020/S6
        wrong: two simultaneous requests both see the ticket ready and both are allowed
      - scenario: INS-020/S7
        wrong: only last_assistant_message is read, so a missing or empty one records nothing
      - scenario: INS-020/S8
        wrong: the third refusal blocks the stop again instead of letting the subagent stop with a systemMessage
      - scenario: INS-020/S9
        wrong: a check that could not run is treated as a refusal and uses attempt 1
      - scenario: INS-020/S10
        wrong: a report for another role is passed to advance, which refuses it and uses an attempt
      - scenario: INS-020/S11
        wrong: an already recorded stage is advanced again and the stop is blocked with no stage running
      - scenario: INS-020/S12
        wrong: the stop hook runs the test command directly, without waiting for the shared test-run turn
      - scenario: INS-020/S13
        wrong: an unrelated Agent call under an older pinned CLI exits 1 with the unknown-event stderr
      - scenario: INS-020/S14
        wrong: before-agent keeps Claude Code's default timeout
      - scenario: INS-020/S15
        wrong: the driving skills keep relaying spec next and advance on Claude Code and never send spec:<ID>
      - scenario: INS-020/S16
        wrong: after the hook records a restarted stage, the next spec:<ID> request is still denied as already running
      - scenario: INS-020/S17
        wrong: the handback is allowed without recording, leaving the report for the stop hook
      - scenario: INS-020/S18
        wrong: handback refusals are counted apart from stop refusals, so the stop after a refused handback is attempt 1
      - scenario: INS-020/S19
        wrong: a handback with no report block is denied and asked to include one
      - scenario: INS-020/S20
        wrong: a stage request passes through unchanged when the project CLI fails to start
      - scenario: INS-020/S21
        wrong: a repeated handback is checked again, finds no stage running and is denied
      - scenario: INS-020/S22
        wrong: a running stage is denied without the ticket advance --report-file command that relays an unrecorded report
      - scenario: INS-020/S23
        wrong: the bare-request warning is printed only in the main session's SessionStart, not for each subagent
    assumed:
      - new: How is the S1 prompt compared with the task spec next builds?
        value: Against the task spec next gives a twin project with the same config, after replacing each project's path with one placeholder
      - new: What does a transcript at agent_transcript_path look like?
        value: "Claude Code JSONL lines {type, message: {role, content}}, with assistant content as an array of text and tool_use blocks; the last assistant text block is the report"
      - new: How is it observed that two stops' test runs wait for each other's turn (S12)?
        value: The scripted test command marks itself busy for two seconds and records any run that starts while another is busy; no overlap may be recorded
      - new: Which exit code may an unrelated Agent call get when the project CLI fails (S20, R11)?
        value: 0 or 1 with empty stdout; either lets the call run
      - new: Under which CLI is the S13 'nope' payload checked?
        value: "The current CLI in a git fixture: stderr 'spec hook: the hook input is not JSON', exit 1, for each of the four new events"
      - new: What may the stop after an accepted handback print when its final message repeats the report (S17)?
        value: Nothing, or the R18 already-recorded systemMessage; never a block decision, and no second record
      - new: Where does INS-017/S3's test live?
        value: Moved from tests/dist.test.ts to tests/cli/stage-hooks.test.ts, keeping its relay skill checks and adding the stage-request behaviour
    duration_s: 1446
    model: claude
  - at: 2026-11-22T13:46:13.168Z
    role: implementer
    result: done
    summary: Stage hooks delegate spec:<ID> via spec next and record reports via ticket advance --report -, recorded once
    verdict: null
    assumed:
      - new: How is R10 (one record when a hook and a relayed advance run together) enforced?
        value: ticket advance takes a per-ticket lock in the common git dir (advance/<ID>.lock) only around recording, after its check; under it, it re-reads the ticket and, when the stage was recorded meanwhile, records nothing and says the ticket has no stage running. Checks may still overlap, as PIP-022/S2 needs
      - new: Which ticket and role does a report block that fails its schema name?
        value: "Read loosely from the ticket: and role: lines inside the report block, so a malformed report for the running stage is refused by ticket advance and uses an attempt, as the same text given to ticket advance would"
      - new: What does a handback or stop hook print when recording fails for another reason (stash, commit, build)?
        value: Exit 1 with the error on stderr, which Claude Code treats as non-blocking; nothing is recorded and the next request names the unrecorded stage (R19)
      - new: Where do warnings from starting a stage (WSP-009/R6) go in before-agent?
        value: On stderr beside the allow decision, as spec next puts them
    duration_s: 3735
    model: claude
  - at: 2026-11-22T13:49:11.322Z
    role: reviewer
    result: done
    summary: The implemented hooks meet the changed scenarios; per-ticket locking serializes recording and recovers dead owners, while pinned-CLI failures only deny exact stage requests.
    verdict: approve
    assumed: []
    duration_s: 173
    model: codex
---
The person wants one main session per feature: they describe it and answer questions, and the main agent oversees the stages without writing or relaying briefs. Each stage subagent must receive everything it needs programmatically. Mainly for Claude Code; other harnesses keep today's flow.

Today (X137, X139) the main session runs `spec next <ID>`, copies entry.task (40-77k characters) into its subagent call with entry.model, saves the final message to entry.advance's report path and runs `spec ticket advance`. This proposal keeps `spec next` and `spec ticket advance` as the only source of briefs and the only way a stage is recorded, and adds two Claude Code plugin hooks that do the relay. Earlier spec had before-delegate and before-finish hooks with compiled role agents (X60), removed by X139; this does not bring back compiled agents, and the harness-neutral flow stays as it is.

Verified 2026-11-22: a PreToolUse hook on the Agent tool that returns hookSpecificOutput.permissionDecision "allow" with updatedInput (the whole input object with prompt and model replaced) made Claude Code 2.1.312 run the subagent with the replaced prompt and model (tool_response showed resolvedModel claude-haiku-5-5 and the new prompt; the subagent answered from the replaced prompt). For a background subagent, PostToolUse on Agent fires at launch, before any report exists. Per code.claude.com/docs/en/hooks: SubagentStop input carries agent_id, agent_type, agent_transcript_path and last_assistant_message, and decision "block" with a reason keeps the subagent running with that reason as its next instruction; SubagentStart input has no prompt and its output only adds context.

Behaviour:
1. Delegating. The Claude Code Agent (or Task) tool call whose prompt is exactly `spec:<ticket ID>` (after trimming) is a spec stage request. A PreToolUse hook on Agent|Task runs the project's `spec next <ID> --harness claude-code`:
   - delegate: the call is allowed with updatedInput = the original input with prompt = entry.task, description = "<ID> <role>", and model = entry.model when set (unchanged when null). Every other input field (subagent_type, run_in_background, ...) is kept.
   - waiting (questions or blockers), merge, done or error: the call is denied, and the deny reason tells the main agent exactly what to do: each open question with its ID for the person; `spec merge <ID>` when it is ready to merge; that it is merged when done; the error text otherwise.
   - A missing role model (entry.missingModels holds the role): denied with the reason naming the role and the `spec config set delegation.claude-code.<role> <model> --local` command, as the driving skills ask today.
   - Any other Agent call (a prompt that is not exactly spec:<ID>) passes through untouched and silently.
2. Recording. A SubagentStop hook reads last_assistant_message (falling back to the last assistant text in agent_transcript_path). When it holds a spec report block whose ticket and role match a stage in progress, the hook records it exactly as `spec ticket advance <ID> --report -` would:
   - accepted: the subagent may stop; nothing else.
   - refused with problems: the hook returns decision "block" with the problems as the reason, so the same subagent fixes its report (this counts toward the existing refusal budget; on the refusal that blocks the ticket, the subagent is allowed to stop and the reason says the ticket is blocked).
   - no report block, or one for a ticket or role not in progress: the subagent stops normally and nothing is recorded (non-spec subagents are unaffected).
   - When a stage was already recorded (for example the main agent also ran advance), the hook records nothing and lets it stop.
3. The main agent's loop becomes: call Agent with `spec:<ID>`; when it returns, call it again; the deny reasons say when to ask the person or merge. The shared Driving a ticket text (feature, change, bug, run skills) tells Claude Code sessions to use this; Astro and other harnesses keep the current spec next / advance relay unchanged.
4. hooks.json registers the two new hooks with timeouts long enough for `spec next` (worktree creation, base sync, worktree setup) and for `spec ticket advance` (the project's full test run): PreToolUse Agent|Task and SubagentStop. The existing session-start, before-edit and after-edit hooks are unchanged; the before-edit Agent matcher is separate from the edit matcher.
5. Like every hook, a failure to run (no spec in this project, an older pinned CLI without these events, input that is not JSON) never blocks an unrelated Agent call or subagent stop: it passes through.

Must still hold: INS-008 session-start stays silent in subagents and ticket worktrees; enforcement hooks (INS-015, INS-016) are unchanged; a stage subagent still works only in its ticket worktree with its role's file scope.
