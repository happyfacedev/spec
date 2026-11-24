---
name: bug
description: Report that this project does not do what its spec says. Finds the scenario the code breaks, files a bug ticket, and starts it on request. If no scenario describes the expected behaviour, it is a feature, not a bug.
argument-hint: <what goes wrong, or the scenario ID>
allowed-tools: Bash(.spec/bin/spec *), Bash(exec .spec/bin/spec brief --stdin *)
---
# /spec:bug: the code breaks a scenario

What the spec says near this report:

```!
exec .spec/bin/spec brief --stdin <<'SPEC_ARGUMENTS_4b7e2c9d_END'
$ARGUMENTS
SPEC_ARGUMENTS_4b7e2c9d_END
```

A bug means the code does something a scenario says it must not. The spec does not change; the code is fixed.

1. Find the scenario the code violates. Quote its steps to the user and confirm: "this is what should happen, and it does not?"
2. If no scenario describes the expected behaviour, it is not a bug: the spec is silent. Say so, and offer `/spec:feature` (new behaviour) or `/spec:change` (different behaviour) instead. Do not file a bug.
3. Ask only for what the scenario does not already pin down, such as the exact input that fails. The tester writes the failing test from the scenario.
4. File it with `"type": "bug"`, `"violates": [the scenario IDs]`, and `"touches": []`.

The injected brief above is required. If it is missing, if the harness does not run `!` blocks (as in Astro), run `.spec/bin/spec brief --stdin` yourself with the user request as stdin before asking questions.

How to ask:
- Read what the spec already says before asking anything. Never ask what the spec answers.
- Ask one question at a time, only about something that changes behaviour: inputs, outputs, limits, errors, what happens at the edges. Offer the likely answers as choices when you can.
- Never invent behaviour. What the user does not know becomes a question on the ticket: a `blocker` if the answer could change behaviour, a `preference` with a `default` if a reversible default is safe.
- Stop asking once every Then step could be written with a concrete value a test can check.
- If no one can answer, record every open point as a question on the ticket and continue.

How to file it:
- First check that no ticket already covers it: `.spec/bin/spec queue`, and `.spec/bin/spec show <ticket ID>` for any that looks close. If one does, tell the user its ID and file nothing.
- Name units by their IDs: features (`PRV-002`), scenarios (`PRV-002/S3`), contracts (`providers.ProviderConfig`, or a field when only it changes). Check each with `.spec/bin/spec show <ID>`; search with `.spec/bin/spec find <words>`.
- Write the ticket as JSON to a file with your file tool in the session scratch directory, then run `.spec/bin/spec ticket new --dry-run <file>`. Fix what the gate reports (an unknown ID, a scope gap), then run `.spec/bin/spec ticket new <file>`. Open questions may stay open: they are for the user.
  The JSON: `{ "type", "title", "touches": [IDs], "violates": [scenario IDs], "depends_on": [ticket IDs], "questions": [{ "kind": "blocker" | "preference", "text", "default", "cites": [IDs] }], "body": "what the user wants, in their words" }`.
- `depends_on` is only for a ticket whose result this one needs, for example a contract it adds. Tickets that change the same files or features do not depend on each other: `.spec/bin/spec plan` keeps conflicting tickets apart, and merging resolves shared files.
- Show the user the ticket ID, what it touches, its reach (`.spec/bin/spec impact <ID>`), and its open questions. Ask whether to start it. After yes, follow Driving a ticket below.
## Driving a ticket

Use the harness explicitly: `astro` if the `mcp__agents__delegate` tool exists in this session, otherwise `claude-code`.

Edit mode (Claude Code only): before the first delegation, run `.spec/bin/spec detect --format json` and read `editMode`. Only "acceptEdits" lets you run subagents in the background. For any other value, warn the person that background subagents cannot edit ticket worktrees in that mode and their stages would end in blocked reports. Offer `.spec/bin/spec init . --name <config name> --accept-edits` and run it only after the person agrees; never write `permissions.defaultMode` any other way. Then run every stage of that run in the foreground, one at a time, without `run_in_background`. A stage started by `next --start` that waits for its turn stays running: delegate it from its started entry, without `next <ID>` and without `--restart`. A mode the person accepts during the run does not change it: the rest of that run still delegates in the foreground, and the mode applies from the next run. Astro is unaffected, so it runs without the warning and keeps `background=true` for several tickets.

Stage requests (Claude Code only): before the first delegation, run `.spec/bin/spec hook claude-code before-agent` with empty stdin. When it exits 0, the project's hooks prepare and record every stage, so delegate each one by calling the Agent tool with a general-purpose subagent and the prompt `spec:<ID>` and nothing else, and call it again the same way each time it returns. Use `run_in_background` only as Edit mode allows. The hook gives the subagent its stage's task, model and effort, and records its report when it hands it back or stops: never write a report file or run an advance command for a stage delegated this way. When a request is refused, follow its reason, then send `spec:<ID>` again:
- a question: ask the person each one, one at a time, and record each answer with `.spec/bin/spec ticket answer <ID> <Q> "<answer>"`;
- a missing model: ask the person for that role's model and save it with `.spec/bin/spec config set delegation.claude-code.<role> <model> --local`;
- ready to merge: run `.spec/bin/spec merge <ID>` and tell the user whether it merged or was refused, and why; a merged ticket: report that it is merged;
- a running stage: wait for the subagent running it. Only once you have confirmed no subagent is still running it, either relay its unrecorded report as the reason says, or run `.spec/bin/spec next <ID> --restart` and call Agent with a general-purpose subagent, that result's task as `prompt`, its model as `model` and, when `entry.effort` is set and the Agent tool takes one, `entry.effort` as `effort`; the hooks record its report as usual;
- a stage whose Agent launch failed: its next request is denied as already running, and the reason names the model it was started on. Only once you have confirmed no subagent is still running it, and only when Claude Code's own error names that same model as one that cannot be used, run `.spec/bin/spec config set unavailableModels.<model> true --local` and then `.spec/bin/spec next <ID> --restart`, delegate that result as above, and tell the person which model was skipped, why, and that `.spec/bin/spec config set unavailableModels.<model> false --local` unmarks it. When the error names another model or none, or is a usage limit, an outage or any other failure, mark nothing and take the failure to the person;
- every model of the role marked unavailable: nothing starts. Tell the person which models are marked unavailable and that `.spec/bin/spec config set unavailableModels.<model> false --local` unmarks one; never unmark one or choose another model yourself;
- `spec could not prepare <ID>`: tell the user the error and stop.
If a stage request returns only `spec brief missing for <ID>`, its brief did not arrive: send the request again, and when that is denied as already running, no subagent is running the stage, so restart it with `--restart` as above. A refused report goes back to the same subagent by itself; the third refusal blocks the ticket and stashes its work, so tell the user and ask how they want to resolve the blocker. When the command fails with `unknown hook event before-agent`, or the harness is Astro, relay each stage as below instead.

Relay (Astro, or Claude Code whose CLI fails that command): if the caller supplied the full delegate entry from `spec next --start`, use it as the initial result: that stage is already running, so do not ask the user or query next before delegation. Do not stop or redelegate while its subagent is running. For an individually approved ticket, run `.spec/bin/spec next <ID> --harness <harness> --format json`. Read the whole JSON result:
- `delegate`: use `entry.task` as the entire delegated task. Use `entry.model` when it is set and valid for the active role; `next` returns null for an invalid Claude Code model and includes that role in `entry.missingModels`. Only ask for a model when `entry.missingModels` contains that role. Never ask merely because a stage is being delegated. For each listed role, ask once and save it from the project root with `.spec/bin/spec config set delegation.<harness>.<role> <model> --local`; keep a session role-to-model map and reuse the value across every ticket in this wave. Save all listed roles, including future-stage roles. If `entry.role` is listed, use its saved value for the active role; otherwise use `entry.model`. If no valid active model remains, explain the mismatch and stop. These ad hoc defaults are local and do not dirty the base config. Delegate with the active role's selected value:
  - Astro: call `mcp__agents__delegate(role=<active model>, task=entry.task, worktree=entry.worktree)`. The active model is the configured or locally selected delegate role. Set `background=true` when running several tickets.
  - Claude Code: Agent tool, general-purpose subagent, `model: <active model>`, `prompt: entry.task` and, when `entry.effort` is set and the Agent tool takes one, `effort: entry.effort`. Use the configured or locally selected alias (`sonnet`, `opus`, `haiku` or `fable`) without asking again. The task already tells the subagent to work in the worktree through the project's relative CLI with `--root`, and never to cd. Use `run_in_background` for parallel work only when `editMode` is "acceptEdits" (see Edit mode below).
- When the subagent finishes, write its final message with your file tool to the absolute report path already in `entry.advance`; it lies in the folder beside the ticket worktrees, so a person in acceptEdits mode is not asked. Write it nowhere else. Run `entry.advance` from the project root as given; the CLI records it into the ticket worktree. Do not change directory or concatenate `cd` and the CLI command. If a report is refused, send every listed problem back to the same subagent (Astro: continue with its `runId`; Claude Code: continue it with SendMessage). The third refusal is terminal: the CLI blocks the ticket and stashes any uncommitted stage work. Do not start a fourth attempt; tell the user, show `.spec/bin/spec queue` and `.spec/bin/spec gate <ID>`, and ask how they want to resolve the blocker before answering it and continuing.
- `waiting`: exit 1 on a gate question is normal. Ask the user each listed question, one at a time. For each answer run `.spec/bin/spec ticket answer <ID> Q<n> "<answer>"`, then ask `next` again. If the only blocker says its stage is already running, wait for that same live delegate; do not treat it as a question or redelegate. For an interrupted stage, first confirm no subagent is still running, then run `.spec/bin/spec next <ID> --restart`; it restores the stage's stash, clears stale report/refusal state and returns the same role's full delegate entry. Use that entry directly as the first delegation. When its blockers name models marked unavailable, tell the person which and how to unmark one, as under Stage requests. For other blockers without questions, explain them and stop.
- `merge`: run `.spec/bin/spec merge <ID>`; tell the user whether it merged or was refused, and give the reason.
- `done`: report that the ticket is merged.
- After an accepted stage report, ask `next` for the same ticket again and repeat. An advance that says the ticket has no stage running means the stage was already recorded: ask `next` for the next stage.

Never edit a ticket's files yourself, never rerun a refused stage as a new subagent, and never skip a refused report.
