---
id: INS-020
title: Delegate and record a ticket stage through Claude Code hooks
module: install
status: active
writes: [install.PluginPackage]
invariants: [INV-019, INV-015, INV-017]
---
## Intent
On Claude Code the main session drives a ticket without relaying its briefs: it calls the Agent tool with the prompt `spec:<ID>`, and two plugin hooks do the rest. Before the call runs, `before-agent` prepares the stage as `spec next <ID> --harness claude-code` does and swaps the request for the stage's task and model, or refuses the call with what the main agent must do instead. A subagent that hands its report back through Claude Code's `SubagentHandback` tool has it checked by `before-handback`, before that call runs; one that simply ends has its final message checked by `subagent-stop` when it stops. Either records the report as `spec ticket advance <ID> --report -` does, or sends the same subagent back with the problems, and a stage recorded through one is not recorded again through the other. A request or report the hooks could not handle is never silently lost: a request that cannot be prepared is refused, a subagent that receives the bare request is told to change nothing, and a stage left unrecorded is named, with how to relay or restart it, on the next request. `spec next` and `spec ticket advance` stay the only source of tasks and the only way a stage is recorded; Astro and other harnesses keep relaying them (INS-014/S26).

## Behaviour
### S1: A stage request runs as the stage's task and model
Given "TASK-101" passes the gate, has no stage running, its next stage is "implementer", and the claude-code implementer model is "sonnet"
When Claude Code runs `spec hook claude-code before-agent` through install.Hook with tool_name "Agent" and an install.AgentToolInput whose prompt is "  spec:TASK-101" followed by a newline, subagent_type "general-purpose", run_in_background true and description "drive"
Then stdout is one install.HookOutput whose install.AgentToolDecision.permissionDecision is "allow", and it exits 0 (R1)
And install.AgentToolDecision.updatedInput has prompt equal to the cli.Next.task `spec next` builds for that implementer stage, description "TASK-101 implementer" and model "sonnet", and keeps subagent_type "general-purpose" and run_in_background true (R1)
And TASK-101's implementer stage is running, in its own worktree, before the hook returns, and remembers the model "sonnet" as `spec next` does (CLI-007/R1, CLI-007/R17)
And tool_name "Task" with the same input gives the same result (R1)

### S2: Any other call passes through untouched
Given "TASK-101" is ready for its "implementer" stage
When Claude Code runs the before-agent hook through install.Hook with tool_name "Agent" and an install.AgentToolInput.prompt that is "spec:TASK-101 now", "Run spec:TASK-101", "spec:task-101", "spec:" or left out, or with tool_name "Bash"
Then stdout and stderr are empty and it exits 0, so the call runs as Claude sent it (R2)
And no stage of TASK-101 starts and no worktree is created (R2, INV-019)

### S3: A ticket waiting for a person is refused with its questions
Given "TASK-101" has the unanswered question "Q2" with the text "Which currency?"
When Claude Code runs the before-agent hook through install.Hook with tool_name "Agent" and install.AgentToolInput.prompt "spec:TASK-101"
Then stdout is one install.HookOutput whose install.AgentToolDecision.permissionDecision is "deny" and it exits 0 (R3)
And install.AgentToolDecision.permissionDecisionReason holds "Q2", "Which currency?" and ".spec/bin/spec ticket answer TASK-101 Q2", and tells the main agent to ask the person each question, record each answer that way and then call Agent with "spec:TASK-101" again (R3)
And no stage starts (CLI-007/R2)

### S4: Merge, done, running and failed tickets are refused with what to do
Given "TASK-101" has completed all its stages and its branch is not merged
When Claude Code runs the before-agent hook through install.Hook with install.AgentToolInput.prompt "spec:TASK-101"
Then install.AgentToolDecision.permissionDecision is "deny" and install.AgentToolDecision.permissionDecisionReason holds ".spec/bin/spec merge TASK-101" (R3)
And when TASK-101 is merged, the reason says "TASK-101 is merged" (R3)
And when TASK-101's "implementer" stage is already running, the reason holds "already has its implementer stage running; do not delegate it again", tells the main agent to wait for the subagent running that stage, and, only once it has confirmed none is, to run ".spec/bin/spec next TASK-101 --restart" (R3, R10)
And for "spec:TASK-999", which names no ticket, the reason holds "Unknown TASK-999.", the text of the cli.Next.blockers `spec next` gives (R3)

### S5: A role without a model is refused before its stage starts
Given "TASK-101" is ready for its "implementer" stage and no valid claude-code model is set for the implementer
When Claude Code runs the before-agent hook through install.Hook with install.AgentToolInput.prompt "spec:TASK-101"
Then install.AgentToolDecision.permissionDecision is "deny" and install.AgentToolDecision.permissionDecisionReason names "implementer", the choices "sonnet", "opus", "haiku" and "fable", and ".spec/bin/spec config set delegation.claude-code.implementer <model> --local", then says to call Agent with "spec:TASK-101" again (R4)
And TASK-101's stage is not started, so after the person's choice is saved the same request is allowed as in S1 (R4)

### S6: Requests that arrive together start each stage once
Given "TASK-101" and "TASK-103" are safe to start now, both for their "implementer" stage, with the claude-code implementer model "sonnet"
When two before-agent hooks for "spec:TASK-101" run at the same time
Then exactly one is allowed with the task, the other is denied with a reason that holds "already has its implementer stage running; do not delegate it again", and TASK-101 has one worktree and one running stage (R5)
And when hooks for "spec:TASK-101" and "spec:TASK-103" run at the same time, both are allowed, each with its own ticket's task and worktree (R5)

### S7: A stage's report is recorded when its subagent stops
Given "TASK-101" has its "implementer" stage running and its subagent's final message ends with a valid implementer report block naming "TASK-101"
When Claude Code runs `spec hook claude-code subagent-stop` through install.Hook with an install.SubagentStopInput whose last_assistant_message is that message
Then the stage is recorded as pipeline.AdvanceTicket records that message given with `--report -`: committed on "ticket/TASK-101", with the next stage named (R6, PIP-018/R1)
And stdout and stderr are empty and it exits 0, so the subagent stops (R6)
And when install.SubagentStopInput.last_assistant_message is missing or empty, the hook reads the last assistant text of the transcript at install.SubagentStopInput.agent_transcript_path, with the same result (R6)

### S8: A refused report sends the same subagent back
Given "TASK-101" has its "implementer" stage running and none of its reports has been refused
When Claude Code runs the subagent-stop hook through install.Hook with a final message whose report block names "TASK-101" and "implementer" but fails its checks
Then stdout is one install.StopHookOutput whose install.StopHookOutput.decision is "block" and whose install.StopHookOutput.reason holds "report refused (attempt 1 of 3)" and every problem pipeline.AdvanceTicket gave, and asks the subagent to fix them and end again with its corrected report block (R7, PIP-018/R3)
And the stage keeps running, as after any refused intake (PIP-018/S3)
And when the same stage's third report is refused, the ticket is blocked as PIP-018/S4 says, and the hook prints no install.StopHookOutput.decision, so the subagent stops, and its install.StopHookOutput.systemMessage says "TASK-101 is blocked" (R7)

### S9: A check that could not run asks for the same report again
Given "TASK-101" has its "implementer" stage running and the test command gives no results
When Claude Code runs the subagent-stop hook through install.Hook with a final message holding a valid implementer report for "TASK-101"
Then install.StopHookOutput.decision is "block" and install.StopHookOutput.reason starts "the check could not run: " and asks the subagent to end again with the same report block, or with a blocked report naming the reason if it keeps failing (R8)
And nothing is recorded and no attempt is used (INV-015, PIP-022/R1)

### S10: A message that is no running stage's report is left alone
Given "TASK-101" has its "implementer" stage running, and "TASK-103" has no stage running and no stage record
When Claude Code runs the subagent-stop hook through install.Hook with a final message that holds no report block, or one naming "TASK-103", or one naming "TASK-101" with role "reviewer", or with neither install.SubagentStopInput.last_assistant_message nor a readable install.SubagentStopInput.agent_transcript_path
Then stdout and stderr are empty and it exits 0, so the subagent stops (R9)
And nothing is recorded and TASK-101's refusal count is unchanged (R9, INV-019)

### S11: A stage recorded once is not recorded again
Given "TASK-101"'s implementer report was recorded by the main agent's `spec ticket advance TASK-101 --report-file <path>`
When Claude Code runs the subagent-stop hook through install.Hook with that same final message
Then stdout is one install.StopHookOutput with no install.StopHookOutput.decision, so the subagent stops, and its install.StopHookOutput.systemMessage says "TASK-101 implementer report already recorded" (R18)
And it exits 0, TASK-101's history is unchanged and no attempt is used (R10, R18)
And when a `spec ticket advance` of the same stage with the same message starts while the hook is recording it, the stage has one record, not two (R10)

### S12: Two stages stopping together are both recorded
Given "TASK-101" and "TASK-103" each have their "implementer" stage running in their own worktrees
When the subagent-stop hooks for both stages' valid reports run at the same time
Then each stage is recorded on its own ticket's branch (R10)
And their test runs wait for each other's turn, as pipeline.RunTests says, rather than running at once

### S13: A hook that cannot run never stops an unrelated call
Given the project's pinned CLI predates the before-agent, before-handback, subagent-start and subagent-stop events
When the plugin runs any of those hooks through install.Hook with a payload that is not a spec stage request, such as an Agent call whose install.AgentToolInput.prompt is "Explore the repo", a handback or a stop
Then it exits 0 with empty stdout, so the Agent call, the handback, the start or the stop goes ahead as Claude Code would run it (R11, INS-015/S22)
And with no resolvable spec root each of them exits 0 with empty stdout and stderr (INS-007/S11)
And with "nope" on stdin each fails with install.HookInputNotJson and exits 1, which Claude Code treats as a non-blocking error (INS-007/R1)
But a spec stage request under that older pinned CLI is refused, as S20 says (R17)

### S14: The plugin registers the four hooks with long timeouts
Given the plugin hooks manifest
When Claude Code loads plugin/hooks/hooks.json
Then install.PluginPackage.hooks has a PreToolUse install.HookGroup with install.HookGroup.matcher "Agent|Task" whose install.HookCommand.command ends with "hook claude-code before-agent" and whose install.HookCommand.timeout is 1800 (R12)
And a PreToolUse group with matcher "SubagentHandback" whose command ends with "hook claude-code before-handback" and whose timeout is 3600 (R12)
And those groups are separate from the PreToolUse group with matcher "Bash|Edit|Write|MultiEdit|NotebookEdit" that runs before-edit, which is unchanged (R12, INS-016/R18)
And it has a SubagentStop group with no matcher whose command ends with "hook claude-code subagent-stop" and whose timeout is 3600 (R12)
And it has a SubagentStart group with no matcher whose command ends with "hook claude-code subagent-start" and no timeout (R12, R20)
And its SessionStart and PostToolUse groups are as INS-014/S4 says

### S15: Driving on Claude Code loops on the stage request
Given the shared Driving a ticket fragment and the run command template
When the repository is built
Then install.PluginPackage.skills has feature, change, bug and run skills that tell a Claude Code session to run ".spec/bin/spec hook claude-code before-agent" with empty stdin before its first delegation, and, when it exits 0, to delegate every stage by calling Agent with a general-purpose subagent and the prompt "spec:<ID>", and to call it again the same way each time it returns (R13)
And to follow each refusal's reason: ask the person each question and answer it with "ticket answer", save a missing model with "config set" and "--local", run "spec merge <ID>", report a merged ticket, or wait for a running stage (R13)
And never to write a report file or run cli.Next.advance for a stage delegated that way, since the handback or stop hook records it (R13)
And the run skill there lists the wave with "spec next --summary" and sends one "spec:<ID>" request per listed ticket, without "--start" (R13)
And background and foreground follow cli.Detection.editMode, as INS-017/S2 says
And when that command fails with "unknown hook event before-agent", or the harness is Astro, they relay `spec next` and `spec ticket advance` as INS-014/S26 says (R13)

### S16: An interrupted stage is restarted and still recorded by the hook
Given a Claude Code session drives "TASK-101" through stage requests, its implementer stage is running, and the session confirms no subagent is still running it
When the session follows the shared Driving a ticket instructions
Then it runs ".spec/bin/spec next TASK-101 --restart" and calls Agent with a general-purpose subagent, that cli.Next.task as prompt, cli.Next.model as model and, when it is set and the session's Agent tool takes one, cli.Next.effort as effort, in the background or foreground as cli.Detection.editMode allows (INS-017/S2); the hook passes that call through as it is (R2, R14, CLI-007/R10)
And when that subagent stops, the subagent-stop hook records its report as in S7, and the session then calls Agent with "spec:TASK-101" again (R14)
And a relay whose `spec ticket advance` reports that the ticket has no stage running treats the stage as already recorded and asks for the next stage, as pipeline.NoStageRunning allows (R14)

### S17: A handed-back report is recorded before the handback runs
Given "TASK-101" has its "implementer" stage running and its subagent calls the SubagentHandback tool with a message that ends with a valid implementer report block naming "TASK-101"
When Claude Code runs `spec hook claude-code before-handback` through install.Hook with tool_name "SubagentHandback" and an install.HandbackToolInput whose message is that report
Then the stage is recorded as pipeline.AdvanceTicket records that message given with `--report -`: committed on "ticket/TASK-101", with the next stage named (R15, PIP-018/R1)
And stdout is one install.HookOutput whose install.AgentToolDecision.permissionDecision is "allow" and it exits 0, so the handback goes ahead (R15)
And when that subagent then stops, the subagent-stop hook records nothing more, whatever its final message holds, and TASK-101's history has one record of the stage (R9, R10)

### S18: A refused handback is denied with the problems
Given "TASK-101" has its "implementer" stage running and none of its reports has been refused
When Claude Code runs the before-handback hook through install.Hook with an install.HandbackToolInput.message whose report block names "TASK-101" and "implementer" but fails its checks
Then install.AgentToolDecision.permissionDecision is "deny" and install.AgentToolDecision.permissionDecisionReason holds "report refused (attempt 1 of 3)" and every problem pipeline.AdvanceTicket gave, and asks the subagent to fix them and hand back again with its corrected report block (R16, PIP-018/R3)
And the refusal uses one of the same three attempts a refused stop uses, so a refused handback followed by a refused stop is attempt 2 of 3 (R16, PIP-018/R3)
And when the test command gives no results, the handback is denied with a reason that starts "the check could not run: ", nothing is recorded and no attempt is used (R8, INV-015)
And when the stage's third report is refused, the ticket is blocked as PIP-018/S4 says, the handback is allowed, and install.HookOutput.systemMessage says "TASK-101 is blocked" (R16)

### S19: A handback that is no running stage's report goes ahead untouched
Given "TASK-101" has its "implementer" stage running, and "TASK-103" has no stage running and no stage record
When Claude Code runs the before-handback hook through install.Hook with an install.HandbackToolInput.message that holds no report block, or one naming "TASK-103", or one naming "TASK-101" with role "reviewer", or with no message
Then stdout and stderr are empty and it exits 0, so the handback goes ahead (R15)
And nothing is recorded and TASK-101's refusal count is unchanged (R9, INV-019)
And when that subagent then stops with a final message ending in a valid implementer report for "TASK-101", the subagent-stop hook records it as in S7 (R6)

### S20: A stage request that cannot be prepared is refused, not passed on
Given "TASK-101" is ready for its "implementer" stage with the claude-code implementer model "sonnet"
When Claude Code runs the before-agent hook through install.Hook with install.AgentToolInput.prompt "spec:TASK-101", and the project CLI that prepares it cannot start, exits non-zero, or cannot load the workspace
Then install.AgentToolDecision.permissionDecision is "deny" and install.AgentToolDecision.permissionDecisionReason starts "spec could not prepare TASK-101: " followed by the error, and it exits 0 (R17)
And when the project's pinned CLI predates the before-agent event, the plugin denies the same request with a reason that starts "spec could not prepare TASK-101: " and names ".spec/bin/spec upgrade" (R17, INS-015/S22)
And an Agent call that is not a spec stage request, under each of these failures, goes ahead as Claude sent it (R11)

### S21: A report already recorded is acknowledged, not checked again
Given the before-handback hook recorded TASK-101's implementer report, but Claude Code did not receive its answer, so the subagent calls SubagentHandback again with the same report
When Claude Code runs the before-handback hook through install.Hook with that install.HandbackToolInput.message
Then install.AgentToolDecision.permissionDecision is "allow" and install.HookOutput.systemMessage says "TASK-101 implementer report already recorded" (R18)
And nothing is recorded, no attempt is used, and TASK-101's history holds one record of that stage (R10, R18)
And when Claude Code stops asking a subagent to hand back after denied handbacks, the subagent stops and the subagent-stop hook applies: a report for the running stage in its final message is recorded as in S7, and otherwise nothing is recorded and the stage stays in progress, as S22 says (R6, R19)

### S22: A stage whose report hook failed is named on the next request
Given "TASK-101"'s implementer subagent has finished but its handback or stop hook failed or timed out before recording, so nothing was recorded and the stage is still in progress
When Claude Code runs the before-agent hook through install.Hook with install.AgentToolInput.prompt "spec:TASK-101"
Then install.AgentToolDecision.permissionDecision is "deny" and install.AgentToolDecision.permissionDecisionReason holds "already has its implementer stage running; do not delegate it again" (R3, R19)
And it says that if that stage's subagent has finished, its report was not recorded, and holds ".spec/bin/spec ticket advance TASK-101 --report-file <report path>", with the absolute report path inside the ticket worktree parent that cli.Next.advance names, to write the subagent's final message to and record, and ".spec/bin/spec next TASK-101 --restart" to run the stage again instead (R19, CLI-007/R10)
And nothing is recorded and no stage starts (R19)

### S23: A subagent that receives a bare stage request changes nothing
Given a repository with spec installed
When Claude Code runs `spec hook claude-code subagent-start` through install.Hook for any subagent
Then stdout is one install.HookOutput whose install.HookSpecificOutput.hookEventName is "SubagentStart" and whose install.HookSpecificOutput.additionalContext is one line telling a subagent whose whole task is "spec:<ticket ID>" that its brief did not arrive, to make no change and to reply only "spec brief missing for <ticket ID>" (R20)
And with no resolvable spec root it exits 0 with empty stdout and stderr (INS-007/S11)
And install.PluginPackage.skills has feature, change, bug and run skills that, when a stage request returns "spec brief missing for <ID>", send the request again, and when that is denied as already running, treat the stage as having no running subagent and restart it as S16 says (R20)

### S24: A build stage goes through the same hooks
Given "PROP-215" in the build lane has an approved spec review, so its next stage is "implementer", and the claude-code implementer model is "sonnet" and no tester model is set
When Claude Code runs the before-agent hook through install.Hook with install.AgentToolInput.prompt "spec:PROP-215"
Then install.AgentToolDecision.permissionDecision is "allow", and install.AgentToolDecision.updatedInput has the cli.Next.task of that build stage (PIP-017/S22), description "PROP-215 implementer" and model "sonnet" (R1, R4)
And when that subagent hands back, or ends with, a valid done implementer report, the hook records it as pipeline.AdvanceTicket does, its proof run included (PIP-024), with "reviewer" the next stage (R6, R15)
And a report the proof run refuses is sent back with that problem and uses one of the three attempts, and a proof run with no results is sent back with a reason that starts "the check could not run: " and uses none (R7, R8, R16, INV-015)
And a valid report with pipeline.Report.lane "full" is recorded, and the next request "spec:PROP-215" gives the "tester" stage's task, or is refused for its missing model as in S5 (R4, R6, PIP-021/R10)
And a second delivery of either recorded report is acknowledged as in S21 (R18)

### S25: A stage request carries the chosen effort
Given "TASK-101" is ready for its "implementer" stage, whose claude-code list is opus with effort medium, then haiku with effort high, and the installed Claude Code is 2.1.292 or later
When Claude Code runs the before-agent hook through install.Hook with install.AgentToolInput.prompt "spec:TASK-101" and install.AgentToolInput.effort "low"
Then install.AgentToolDecision.updatedInput has model "opus" and effort "medium", whatever effort the call gave (R1, INV-019)
And when the implementer is the one text "sonnet", updatedInput has model "sonnet" and the effort key is as the call gave it, left out when the call had none (R1)
And when that version is not known (CLI-007/R19), updatedInput has model "opus", the list's effort is not sent, so the call's effort "low" is passed back as given, and install.HookOutput.systemMessage is the line CLI-007/S24 puts on stderr (R1, INV-019)

### S26: A failed launch is closed from the running denial
Given "TASK-101"'s "implementer" stage was started by a stage request on opus, its Agent call failed, and no subagent is running it
When Claude Code runs the before-agent hook through install.Hook with install.AgentToolInput.prompt "spec:TASK-101"
Then install.AgentToolDecision.permissionDecision is "deny", and install.AgentToolDecision.permissionDecisionReason holds what S4 and S22 say and that the stage was started on opus (R19, INV-017)
And it says, only once it is confirmed that no subagent is running the stage, and only when Claude Code's own error names opus as a model that cannot be used, to run ".spec/bin/spec config set unavailableModels.opus true --local" and then ".spec/bin/spec next TASK-101 --restart", to call Agent with that result as S16 says, and to tell the person the model skipped, why and how to unmark it (R14, R19, CLI-007/S22)
And it says to mark nothing and take the failure to the person when the error names another model or none, or is a usage limit, an outage or any other failure (R19)
And when the stage start record holds no model of this stage (PIP-025/R2), or one that is not sonnet, opus, haiku or fable, the reason names no model and no "unavailableModels" command (R19, INV-017)
And when every model of a ready stage's list is marked, the request is denied with the blockers of CLI-007/S23 and no stage starts (R3)
And install.PluginPackage.skills has feature, change, bug and run skills that say the same, and that tell the person which models are marked and how to unmark one when nothing can start (R13, R14)

## Rules
- R1: A Claude Code `Agent` or `Task` call whose prompt, trimmed, is exactly `spec:` followed by a ticket ID (`PROP-<n>`, `BUG-<n>` or `TASK-<n>`) is a spec stage request. When `spec next <ID> --harness claude-code` gives a delegate entry, the hook allows the call with its whole input passed back unchanged except prompt (cli.Next.task), description (`<ID> <role>`), model (cli.Next.model) and, when cli.Next.effort is set, effort (cli.Next.effort); otherwise an effort the call carries is passed back as given, like every other key.
- R2: Every other `Agent` or `Task` call, and every other tool, gets no output and exit 0 and starts nothing.
- R3: A request whose `spec next` result is waiting, merge, done or error is denied, and the reason tells the main agent what to do: for each open question its ID, its text and the `.spec/bin/spec ticket answer <ID> <Q>` command; `.spec/bin/spec merge <ID>` to merge; that the ticket is merged; for a running stage, what R19 says; otherwise the text of each blocker.
- R4: When the next stage's role has no valid claude-code model, the request is denied before any stage starts, with the role, the choices sonnet, opus, haiku and fable, and the `.spec/bin/spec config set delegation.claude-code.<role> <model> --local` command.
- R5: Requests for one ticket that arrive together start its stage once; the others are denied as already running. Requests for different tickets each start their own.
- R6: When a subagent stops, the hook reads `last_assistant_message`, or when it is missing or empty the last assistant text of `agent_transcript_path`. A report block in it whose ticket and role are a running stage's is recorded as `spec ticket advance <ID> --report -` records it; when it is accepted the subagent stops with no output.
- R7: A refused report blocks the stop with the attempt line and every problem as the reason, using one of the stage's three attempts (PIP-018/R3). On the refusal that blocks the ticket the subagent stops, and a systemMessage tells the person that the ticket is blocked.
- R8: When the check could not run (PIP-022), nothing is recorded and no attempt is used; the stop is blocked, or the handback denied, with the could-not-run reason, asking for the same report again or a blocked report.
- R9: A message with no report block, a report for a ticket or role whose stage is not running and is not the stage just recorded (R18), or nothing readable: the subagent stops or hands back, with no output, and nothing is recorded or counted.
- R10: One stage is recorded at most once, whether the handback hook, the stop hook, a relayed `spec ticket advance` or several of them record it, and at the same time or one after the other. A running stage is restarted only through `spec next <ID> --restart`, after the session confirms no subagent is running it.
- R11: For anything that is not a spec stage request, a hook that cannot run (no spec, a pinned CLI that predates these events, input that is not JSON, a project CLI that fails) never blocks an Agent call, a handback, a start or a stop: it exits 0 with no output, or 1, which Claude Code treats as non-blocking. A spec stage request is handled as R17 says.
- R12: The plugin's hooks.json has a PreToolUse group with matcher `Agent|Task` for before-agent with a timeout of 1800 seconds, for the worktree, base sync and setup a start may need; a PreToolUse group with matcher `SubagentHandback` for before-handback and a SubagentStop group with no matcher for subagent-stop, each with a timeout of 3600 seconds, for a full test run and its wait for a turn; and a SubagentStart group with no matcher for subagent-start, with Claude Code's default timeout. All four are separate from the existing groups, which are unchanged.
- R13: On Claude Code the shared ticket-driving instructions use stage requests when the project CLI accepts the before-agent event, and the relay otherwise; on Astro they always relay.
- R14: A stage restarted with `--restart` is delegated with its entry's task, model and effort as S16 says, the same subagent type and edit mode as a stage request, and its report is recorded by the handback or stop hook; a relay that finds the stage already recorded asks for the next one.
- R15: A `SubagentHandback` call's `tool_input.message` is checked before the call runs: a report block in it whose ticket and role are a running stage's is recorded as `spec ticket advance <ID> --report -` records it, and when it is accepted the handback is allowed. A subagent that ends without a handback is recorded from its final message (R6).
- R16: A refused handback is denied with the attempt line and every problem as the reason, so Claude Code has the subagent hand back again; it uses one of the stage's three attempts (PIP-018/R3), shared with refused stops. On the refusal that blocks the ticket the handback is allowed, and a systemMessage tells the person that the ticket is blocked.
- R17: A spec stage request that the hook cannot prepare, because the project CLI cannot start, exits non-zero, cannot load the workspace or predates the before-agent event, or because `spec next` gives an error, is denied with a reason that starts `spec could not prepare <ID>: ` and gives the error; the bare request never runs because of a failure the hook sees.
- R18: A handback or stop whose report is for the stage just recorded for that ticket and role, the ticket's latest stage record being that role's while no stage of it is running, is allowed with a systemMessage saying `<ID> <role> report already recorded`; nothing is recorded and no attempt is used.
- R19: When a handback or stop hook fails or times out, or Claude Code stops retrying a handback and the final message holds no report, nothing is recorded and the stage stays in progress. The next request for that ticket is denied as already running, and the reason says that, if the stage's subagent has finished, its report was not recorded, with the `.spec/bin/spec ticket advance <ID> --report-file <report path>` command that relays it and the `.spec/bin/spec next <ID> --restart` command that runs the stage again. It also names the model the stage was started on, from its stage start record when that is this stage's and a Claude Code alias, and the command that marks it unavailable, for a launch whose error from Claude Code names that same model as one that cannot be used; any other failure, a usage limit or an outage included, marks nothing and goes to the person. The hook reads no launch error.
- R20: Every subagent started in a project with a resolvable spec root gets one line of context telling it that, if its whole task is `spec:<ticket ID>`, its brief did not arrive, so it must make no change and reply only `spec brief missing for <ticket ID>`; the driving skills then send the request again, and restart the stage when it is denied as already running.

## Out of scope
- What `spec next` and `spec ticket advance` decide: CLI-007, PIP-017, PIP-018
- Which model, effort and permissions Claude Code actually applies to a subagent, including a model it substitutes without refusing the launch: Claude Code
