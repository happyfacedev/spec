---
id: CLI-007
title: Prepare a pipeline stage for the main session to delegate
module: cli
status: active
invariants: [INV-020]
---

## Intent
The main session asks for one ready ticket, gets the next role's self-contained task, and delegates it through its own harness. Listing ready work is read-only; starting it creates each ticket's worktree and marks its stage running.

## Behaviour
### S1: Prepare one ready ticket
Given "TASK-101" passes the gate, has no stage running, and its next stage is "implementer"
When the main session runs `spec next TASK-101`
Then the output has action "delegate", role "implementer", its branch and worktree, and a task
And cli.Next.advance is `.spec/bin/spec ticket advance TASK-101 --report-file <report path>` relative to the project root, where the report path is absolute and inside the ticket worktree parent; the main session writes the report there and the CLI records it into the worktree (R9, R14)
And the task tells the role to work only in its named worktree, never to cd, and to run the relative `.spec/bin/spec` command with `--root` set to that worktree's spec root (R14)
And TASK-101's implementer stage is running before the command returns (R1)

### S2: An open question waits for a person
Given "TASK-101" has an unanswered blocker question "Q2"
When the main session runs `spec next TASK-101 --format json`
Then cli.Next.action is "waiting", cli.Next.questions includes "Q2", and no stage starts (R2)

### S3: No ticket lists all tickets safe to start now
Given the plan says "TASK-101" and "TASK-103" can start now, and "TASK-102" must wait
When the main session runs `spec next --format json`
Then it returns one cli.Next per ticket that can start now, and none of their stages starts (R3)
And when it runs `spec next --start --format json`, it starts those tickets in their own worktrees and returns their full tasks (R3)

### S9: The configured wave cap limits a listing and its starts
Given the plan has three safe tickets, TASK-101, TASK-103 and TASK-104, and TASK-102 waits for TASK-101
And format.Config.maxParallel is 2
When the main session runs `spec next --format json`
Then it lists TASK-101 and TASK-103, not TASK-104 or TASK-102 (R3)
And when it runs `spec next --start --format json`, only those two safe tickets start, each with a refreshed workspace

### S4: A running stage needs an explicit restart
Given "TASK-101" has its "implementer" stage running
When the main session runs `spec next TASK-101` without `--restart`
Then it refuses to delegate again and says that its implementer stage is already running (R4)

### S5: Finished and merged tickets are terminal
Given "TASK-101" has completed all stages but its branch is not merged
When the main session runs `spec next TASK-101 --format json`
Then cli.Next.action is "merge"
And when "TASK-101" is already merged, cli.Next.action is "done" (R5)

### S6: Detect the harness for model selection
Given `SPEC_HARNESS` is set, `CLAUDECODE=1` and `CLAUDE_CODE_ENTRYPOINT=astro`
When the main session runs `spec next` without `--harness`
Then it selects `SPEC_HARNESS` (R6)
And if `SPEC_HARNESS` is absent, `CLAUDE_CODE_ENTRYPOINT=astro`, `ASTRO_RUN_ID` or `ASTRO_HOOK=1` selects "astro" even when `CLAUDECODE=1`
And if no Astro marker is present, `CLAUDECODE=1` selects "claude-code"
And an explicit `--harness` always wins

### S7: JSON reports an error when a stage cannot start
Given TASK-101 passes the gate but its project folder is not a git repository
When the main session runs `spec next TASK-101 --format json`
Then it returns one JSON cli.Next with action "error" and the start reason in blockers (R7)
And when it runs `spec next TASK-101 --report - --format json`, it also returns a JSON cli.Next with action "error"

### S8: An unset model tells the main session to choose one
Given no model is configured for the implementer under the selected harness
When `spec next TASK-101` prepares the implementer task
Then the text header says `model: (not set — choose one for implementer)` (R8)

### S10: Restart a stage after its delegate stops
Given TASK-101 has its implementer stage in progress, the session confirms no subagent is running it, and its worktree has uncommitted stage changes
When the main session runs `spec next TASK-101 --restart`
Then the CLI stashes and restores those changes through the blocked-stage stash mechanism, reopens the implementer stage, and returns its delegate task again (R10)
And TASK-101 remains in progress with the implementer stage
And the same restart works when the main session runs it from inside TASK-101's worktree

### S11: Restart drops a kept refused report and refusal budget
Given TASK-101's implementer stage is in progress and no subagent is running it
And the git report store holds its third refused final message and refusal count 3
When the main session runs `spec next TASK-101 --restart`
Then the CLI restarts the implementer stage and clears the kept report and refusal count
And `spec ticket advance TASK-101` without report input is refused for a missing report, leaving the stage in progress
And the next refused report is attempt 1 of 3 (R11)

### S12: Restart requires one known ticket with a running stage
Given TASK-101 is open and TASK-999 does not exist
When the main session runs `spec next --restart`, `spec next TASK-101 --restart --start`, `spec next TASK-999 --restart`, or `spec next TASK-101 --restart`
Then the first two are refused with usage, the third is refused as an unknown ticket, and the fourth is refused because TASK-101 has no in-progress stage (R12)
And nothing starts or changes

### S13: A summary lists safe work without the task or brief
Given the plan says TASK-101 can start now and TASK-102 must wait
When the main session runs `spec next --summary --harness claude-code --format json`
Then it returns a cli.NextSummary for TASK-101 with its action, role, worktree and model, and no task or brief text (R13)

### S14: The main session advances from the project root through the relative CLI
Given TASK-101 is started for its implementer in a ticket worktree
When the main session prepares the delegate entry
Then cli.Next.advance is `.spec/bin/spec ticket advance <ID> --report-file <report path>` with the absolute report path filled in, and the main session runs it from the project root as given
And the CLI records the report into TASK-101's ticket worktree (R14)
And the task's CLI is `.spec/bin/spec --root <absolute spec root inside TASK-101's worktree>`, run from the project root without cd (R14, PIP-017/R2)

### S15: Restart gates against the base spec, not the spec-writer's partial work
Given PROP-201 has an in-progress spec-writer stage in a ticket worktree
And that worktree contains a valid new feature the ticket does not touch, while the base spec does not contain it
And the session confirms no subagent is still running
When the main session runs `spec next PROP-201 --restart` from the project root
Then cli.Next.action is "delegate" and the spec-writer restarts with its task, because its uncommitted feature is not a scope gap against the base spec (R15)

### S16: Restart still refuses a committed scope gap
Given PROP-201 has an in-progress spec-writer stage in a ticket worktree
And the base spec contains a valid feature the ticket does not touch
And the session confirms no subagent is still running
When the main session runs `spec next PROP-201 --restart` from the project root
Then cli.Next.action is "error" and its blocker reports that the ticket is not ready (R15)
And the running stage is not restarted (R15)

### S17: Delegate entries report every missing active-harness model
Given TASK-101 is ready for implementer and `delegation.astro` selects a model only for implementer
When the main session runs `spec next TASK-101 --harness astro --format json`
Then the delegate entry's `missingModels` is [spec-writer, tester, reviewer] and its `model` is the selected implementer model (R16)

### S18: A started stage remembers the model next chose for it
Given "TASK-101" is ready for its "implementer" stage and "BUG-301" for its "tester" stage, and under the harness "astro" the implementer's model is "claude-sonnet-5-5" and the tester's is "claude-opus-5-5"
When the main session runs "spec next --start --harness astro --format json"
Then the entry for "TASK-101" has cli.Next.model "claude-sonnet-5-5" and the one for "BUG-301" has "claude-opus-5-5"
And "spec/stages/TASK-101.json" in the repository's common git directory holds "stage" "implementer", "model" "claude-sonnet-5-5" and "entries", the count of TASK-101's history entries, and "spec/stages/BUG-301.json" holds "stage" "tester" and "model" "claude-opus-5-5" with its own "entries", so recording each stage with its cli.Next.advance and no transcript records that model (R17, PIP-025/R2)
And when "TASK-101" is instead started on its own by "spec next TASK-101 --harness astro", a ticket ID alone, it remembers "claude-sonnet-5-5" the same way (R1, R17)
But "spec next --format json" without "--start" starts nothing and writes no "spec/stages" file, and neither does a "spec next TASK-101" that returns waiting (R2, R3, R17)
And a stage started while cli.Next.model is null, as in S8, has no "model" in its "spec/stages" file (R17, PROP-114#Q1)

### S19: A restart remembers the model it selects, or none
Given "TASK-101"'s "implementer" stage was started by "spec next TASK-101 --harness astro", which remembered "claude-sonnet-5-5", and the session confirms its delegate stopped
When the main session runs "spec next TASK-101 --restart --harness claude-code", and the claude-code implementer model is "haiku"
Then cli.Next.model is "haiku" and "spec/stages/TASK-101.json" holds "model" "haiku" in place of "claude-sonnet-5-5", with the restart's "started" time (R10, R17)
But when the restart selects no model, as under a harness with none for the implementer, cli.Next.model is null and "spec/stages/TASK-101.json" holds no "model": recording the restarted stage with no transcript gives a record with no pipeline.StageRecord.model, never "claude-sonnet-5-5" (R8, R17, PIP-025/R1)

### S20: A start that fails remembers nothing
Given "TASK-101" and "TASK-103" are safe to start now, both for their "implementer" stage, under the harness "astro" with the implementer model "claude-sonnet-5-5"
And "TASK-103"'s worktree has an uncommitted change outside the tickets folder, so its start is refused (PIP-002/R3)
When the main session runs "spec next --start --harness astro --format json"
Then "TASK-101" starts and "spec/stages/TASK-101.json" holds "model" "claude-sonnet-5-5" (R17)
And the entry for "TASK-103" has action "waiting" with the start's reason in its blockers, its stage is not running, and "spec/stages/TASK-103.json" is as it was before the call (R3, R17)
And "spec next TASK-103 --harness astro --format json" alone fails the same way with cli.Next.action "error" and leaves "spec/stages/TASK-103.json" as it was (R7, R17)

### S21: The first model of the list is selected with its effort
Given "TASK-101" is ready for its "implementer" stage, whose claude-code list is opus with effort medium, then haiku with effort high, and the installed Claude Code is 2.1.292 or later
When the main session runs "spec next TASK-101 --harness claude-code --format json"
Then cli.Next.model is "opus", cli.Next.effort is "medium" and cli.Next.skipped is empty (R18)
And in text the header holds "model: opus" and "effort: medium", and for a role set to one text it holds no "effort:" (R18)
And the start remembers "opus" (R17)

### S22: A model marked unavailable is skipped until it is unmarked
Given the implementer stage S21 started on opus, and while it is in progress opus is marked in format.LocalConfig.unavailableModels
When the main session, having confirmed no subagent is running it, runs "spec next TASK-101 --restart --harness claude-code --format json"
Then cli.Next.action is "delegate", cli.Next.model is "haiku", cli.Next.effort is "high" and cli.Next.skipped holds opus with reason "marked unavailable" (R10, R18)
And the start remembers "haiku", which it did not before the restart, and nothing is recorded as the implementer's report (R17, R18)
And later stages skip opus too, and once it is unmarked the next start selects opus again, with cli.Next.skipped empty (R18, INV-020)

### S23: Nothing starts while every model is marked unavailable
Given "TASK-101" is ready for its "implementer" stage, whose claude-code list is opus, then haiku, both marked unavailable
When the main session runs "spec next TASK-101 --harness claude-code --format json"
Then cli.Next.action is "waiting", the exit code is 1, and cli.Next.blockers names opus and haiku with "marked unavailable" and, for each, the command ".spec/bin/spec config set unavailableModels.<model> false --local" (R18)
And "spec next" with "--start" or "--summary" lists the ticket as waiting, and no stage starts (R3, R18)
And when its implementer stage is in progress, "--restart" gives cli.Next.action "error" with the same blockers, and the stage, its worktree, its stage start record and its kept report are as they were (R17, R18)

### S24: Effort is given only to a Claude Code known to take it
Given the list of S21
When the main session runs "spec next TASK-101 --harness claude-code --format json" and "claude --version", the one on the PATH, prints "2.1.291 (Claude Code)", prints no version, fails, or does not end within 3 seconds
Then cli.Next.model is "opus", cli.Next.effort is null, and stderr says "effort medium not sent: Claude Code 2.1.292 or later was not found" (R19, INV-020)
And with "2.1.292 (Claude Code)" or "2.2.0 (Claude Code)", cli.Next.effort is "medium" and stderr says nothing of effort (R19)
And when the selected entry sets no effort, or the harness is Astro, "claude" is not run, and "spec next --start" for several tickets runs it once (R19)

## Rules
- R1: A ready ticket's next stage is started before its task is returned.
- R2: A gate that is not ready returns waiting with its open question IDs or blockers and starts nothing.
- R3: Without a ticket ID, next lists only the plan's tickets safe to start in the current wave, capped by `format.Config.maxParallel` when set; it has no side effects unless `--start` is given, which starts each listed ticket and refreshes workspace state between starts.
- R4: Without `--restart`, an in-progress ticket is never started or delegated twice; refusal names its running role. The explicit restart exception is R10.
- R5: A done ticket whose branch is not merged returns merge; a merged ticket returns done.
- R6: Harness selection is `--harness`, then non-empty `SPEC_HARNESS`, then Astro when `CLAUDE_CODE_ENTRYPOINT=astro`, `ASTRO_RUN_ID` is set or `ASTRO_HOOK=1`, then `CLAUDECODE=1` as `claude-code`, else unset.
- R7: With `--format json`, every failure returns a JSON cli.Next error object rather than plain text.
- R8: A missing role model is shown in the text header as `(not set — choose one for <role>)`.
- R9: A delegate result exposes the exact stage-advance command outside the task; text output places it in the header and the task does not include it.
- R10: The main session may use `--restart` only when its stage is in progress and it confirms no subagent is still running. The CLI stashes the stage's uncommitted changes using the blocked-stage stash, restarts the same role, restores its changes into that stage's worktree, and returns the delegate task again.
- R11: A successful `--restart` clears the kept report and refusal count for that ticket and role before returning the task, so `ticket advance` cannot consume a stale refused message.
- R12: `--restart` requires exactly one existing ticket with an in-progress stage, and cannot be combined with `--start`; invalid requests make no changes.
- R13: Without a ticket ID, `--summary` returns only each safe entry's ticket, action, role, worktree and selected model; it omits the task and brief.
- R14: A delegate task directs the role never to cd and to run the relative project CLI from the project root with `--root` set to its worktree's spec root (PIP-017/R2); `cli.Next.advance` is the relative project CLI command, with the absolute report path filled in (PIP-017/R4), for the main session to run from the project root, and the CLI routes the report into the ticket worktree.
- R15: Restart gates against the base spec while using the running ticket's committed state. Uncommitted spec changes owned by its interrupted spec-writer stage do not create scope gaps; committed scope gaps still refuse the restart.
- R16: A delegate entry reports `missingModels` as every stage role lacking a model under its active harness; with no active harness it reports an empty list.
- R17: Every start `spec next` makes (a ticket ID alone, each ticket of the listing with `--start`, and `--restart`) remembers the cli.Next.model of its entry, when it is a model within PIP-025/R3, in the stage start record the start writes (PIP-025/R2), for `spec ticket advance` to record. A start with no model selected remembers none, so a restart that selects none leaves no model from before. A start that is refused or fails writes nothing, whatever the other starts of the same call do; a listing without `--start` and a waiting result start nothing and remember nothing.
- R18: The selected model and effort are those of the first usable entry of the role's list (FMT-015/R8), a usable entry being supported and not marked unavailable. When a role has supported entries and all are marked, a start or a listing returns waiting and a restart error, with each entry, why it was skipped and how to unmark it, and nothing starts or changes. Spec never detects a refused launch: only the local mark skips a model.
- R19: A selected entry's effort is given only when `claude --version`, run as the `claude` on the PATH, prints a version of 2.1.292 or later within 3 seconds; that version counts as the session's. Otherwise, the version unknown included, the model is given without effort and one line on stderr says so. It runs at most once per command, and only when a selected entry sets an effort under claude-code, and it never fails a start.

## Out of scope
- How the task is assembled: pipeline
- How roles get their models: format
- Accepting a finished role's message: pipeline
