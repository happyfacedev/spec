# workspace contracts

### workspace.Worktree
Kind: entity · Status: active
The git worktree one ticket runs in, on the ticket's own branch. A ticket has at most one: whichever worktree has `ticket/<ID>` checked out, the main tree included.

#### workspace.Worktree.ticket
The ticket it belongs to. Type: string

#### workspace.Worktree.branch
`ticket/<ID>`, made from `baseBranch` (default `main`) the first time the ticket gets a worktree, and kept when the worktree is removed. Type: string

#### workspace.Worktree.path
The checkout's top folder: `<worktrees>/<ID>` when `worktrees` is set in `spec/config.json` (relative to the project root), else `<repo>.worktrees/<ID>` beside the repository. Type: string

#### workspace.Worktree.project
The project root inside the checkout: `path` plus the project's folder within the repository, so `path` itself when the project is the whole repository. Commands for the ticket run here. Type: string

### workspace.AddWorktree
Kind: operation · Status: active
`spec worktree add <TICKET>`: the ticket's worktree, made if it has none, and set up again if its last setup failed. Prints `<ID>: created <project> on ticket/<ID>`, `<ID>: set up <project> on ticket/<ID>` or `<ID>: already at <project> on ticket/<ID>`.
Output: workspace.WorktreeAdded | cli.UsageError | workspace.UnknownTicket | workspace.NotARepository | workspace.GitRefused | workspace.SetupFailed | workspace.WorktreeBusy

#### workspace.AddWorktree.ticket
The ticket ID. Type: string

### workspace.WorktreeAdded
Kind: type · Status: active
What `spec worktree add <TICKET> --format json` prints.

#### workspace.WorktreeAdded.ok
Always true; a failure prints no JSON. Type: bool

#### workspace.WorktreeAdded.path
The worktree's top folder. Type: string

#### workspace.WorktreeAdded.project
The project root inside it. Type: string

#### workspace.WorktreeAdded.created
True when this call made the worktree, false when the ticket already had one. Type: bool

### workspace.RemoveWorktree
Kind: operation · Status: active
`spec worktree remove <TICKET>`: removes the ticket's worktree and keeps its branch. Prints `<ID>: removed <path>; ticket/<ID> is kept`.
Output: null | cli.UsageError | workspace.NoWorktree | workspace.OwnWorktree | workspace.GitRefused | workspace.WorktreeBusy

#### workspace.RemoveWorktree.ticket
The ticket ID. Type: string

### workspace.ListWorktrees
Kind: operation · Status: active
`spec worktree list`: every worktree that has a `ticket/<ID>` branch checked out, one line `<ID> <status> <path>` each, or `no ticket worktrees`. A done ticket's worktree whose branch is merged into the base branch ends its line with ` (merged into <base>; spec worktree remove <ID> removes it)`.
Output: workspace.WorktreeRow[]

### workspace.WorktreeRow
Kind: type · Status: active
One entry of `spec worktree list --format json`.

#### workspace.WorktreeRow.ticket
The ticket ID from the branch name. Type: string

#### workspace.WorktreeRow.path
The worktree's top folder. Type: string

#### workspace.WorktreeRow.status
The ticket's live status, or null when no ticket has that ID; the text form prints `?` for null. Type: tickets.TicketStatus | null

#### workspace.WorktreeRow.merged
True when the ticket is done and its branch is merged into the base branch, so the worktree is left over from its merge. Left out otherwise. Type: bool?

### workspace.Dispatch
Kind: operation · Status: removed · Superseded by: cli.Next
`spec dispatch <TICKET>... [--restart] [--max <n>]`: every asked ticket the plan lets start now, up to the cap, gets its worktree and one run of `dispatchCommand` there, all at the same time; the command ends when every run has ended. An asked ticket in progress with no live run is stopped mid-stage: printed as `<ID>: stopped mid-stage (<stage>): <reason>; log <path>; run again with --restart`. Exits 0 only when at least one ticket started and every started ticket is done.
Output: workspace.DispatchResult | cli.UsageError | workspace.UnknownTicket | workspace.NoDispatchCommand | workspace.NotARepository

#### workspace.Dispatch.tickets
The ticket IDs asked for, at least one. Type: string[]

#### workspace.Dispatch.restart
`--restart`: stash each stopped ticket's uncommitted changes in its worktree, set it back to open, and dispatch it with the others. Type: bool?

#### workspace.Dispatch.max
`--max <n>`: the most tickets to start, a whole number of 1 or more; it overrides format.Config.maxParallel. Default: format.Config.maxParallel, else no cap. Type: int?

### workspace.DispatchResult
Kind: type · Status: removed · Superseded by: cli.Next
What `spec dispatch --format json` prints.

#### workspace.DispatchResult.started
One entry per ticket that ran, in the plan's order. Type: workspace.Run[]

#### workspace.DispatchResult.skipped
One entry per asked ticket that did not start, with why. Type: workspace.TicketReason[]

#### workspace.DispatchResult.stopped
One entry per asked ticket stopped mid-stage and not restarted. Type: workspace.StoppedRun[]

### workspace.StoppedRun
Kind: type · Status: removed · Superseded by: cli.Next
A ticket in progress that nothing runs: its stage died, and it waits for a restart, not for a person.

#### workspace.StoppedRun.ticket
Type: string

#### workspace.StoppedRun.stage
The stage it was in, or "?" when the ticket names none. Type: pipeline.Role | "?"

#### workspace.StoppedRun.reason
`no run is recorded for it`, `its run (pid <pid>) has ended`, or, in orchestrate, `the run exited <code>` for a run that ended in that command; a restart that failed adds `; not restarted: <why>`. Type: string

#### workspace.StoppedRun.exit
The run's exit code, when the command saw the run end; else null. Type: int | null

#### workspace.StoppedRun.log
The run's log: the run record's, else the ticket's newest `<ID>-<time>.log`; null when it has none. Type: string | null

### workspace.StageEntry
Kind: type · Status: removed · Superseded by: pipeline.StageRecord
One stage's entry in a run's log, appended when the stage's role finishes or is sent back. It is a block of lines: a heading `== stage <role> <ticket>: started <datetime>, ended <datetime>`, then `transcript: <path>` (or `transcript: none`), then `report:` followed by the report, or `problems:` followed by one `- <problem>` line each.

#### workspace.StageEntry.role
Type: pipeline.Role

#### workspace.StageEntry.started
When the stage was started. Type: datetime

#### workspace.StageEntry.ended
When the role finished or was sent back. Type: datetime

#### workspace.StageEntry.transcript
The path of the role's subagent transcript; null when the harness gave none. Type: string?

#### workspace.StageEntry.report
The role's final report; null when it was refused. Type: string?

#### workspace.StageEntry.problems
What pipeline.CheckReport found; empty when the report was accepted. Type: string[]

### workspace.RunRecord
Kind: type · Status: removed · Superseded by: cli.Next
`spec/runs/<ID>.run.json` in the repository's common git directory: written when dispatch starts a ticket's run and deleted when the run ends, so a record left behind by a process that no longer runs means the stage died.

#### workspace.RunRecord.pid
The process running `dispatchCommand`. Type: int

#### workspace.RunRecord.started
When the run started. Type: datetime

#### workspace.RunRecord.log
The run's log file. Type: string

### workspace.Run
Kind: type · Status: removed · Superseded by: cli.Next
One ticket's run of `dispatchCommand`.

#### workspace.Run.ticket
Type: string

#### workspace.Run.exit
The command's exit code, or null when it could not be run. Type: int | null

#### workspace.Run.status
The ticket's live status once every run has ended, or "unknown" when the ticket cannot be found. Type: tickets.TicketStatus | "unknown"

#### workspace.Run.worktree
The project root inside the ticket's worktree, where the command ran. Type: string

#### workspace.Run.log
The file that holds the run's standard output and standard error. Type: string

### workspace.TicketReason
Kind: type · Status: removed · Superseded by: cli.NextBlocker
A ticket that did not start, or that waits for a person, and why.

#### workspace.TicketReason.ticket
Type: string

#### workspace.TicketReason.reason
One line saying why. Type: string

### workspace.Merge
Kind: operation · Status: active
`spec merge <TICKET>...`: merges each done ticket's branch into the base branch, in the order given, each against the result of the ones before. Every argument is checked to be a ticket ID before any ticket is merged. One line per ticket: `<ID>: merged (<commit>)` or `<ID>: not merged, <reason>`; a merged ticket whose worktree git kept adds `, but its worktree was kept: <workspace.MergeResult.worktreeKept>`. Exits 0 only when every ticket merged.
Output: workspace.MergeResult[] | cli.UsageError

#### workspace.Merge.tickets
The ticket IDs, at least one. Type: string[]

### workspace.MergeResult
Kind: type · Status: active
One ticket's entry in `spec merge --format json`.

#### workspace.MergeResult.ok
Whether the ticket was merged. Type: bool

#### workspace.MergeResult.ticket
Type: string

#### workspace.MergeResult.commit
Merged only: the base branch's new HEAD, abbreviated. Type: string?

#### workspace.MergeResult.rebuilt
Merged only: true when generated files conflicted and were rebuilt. Type: bool?

#### workspace.MergeResult.agentsCompiled
Status: removed
Merged only: the legacy merge output reported whether role agents were recompiled. Type: bool?

#### workspace.MergeResult.worktreeBusy
Merged only: the ticket's lock was still held after 15 minutes, so merge left the ticket's worktree and setup state as they were: `another spec worktree add for <ID> is still running (pid <pid>)`. Left out otherwise. Type: string?

#### workspace.MergeResult.worktreeKept
Merged only: git kept the ticket's worktree, so merge left it and the ticket's setup state as they were: `<path> has uncommitted changes: <paths>`, the first five changed or untracked paths of the tree in sorted order joined by ", ", or `git could not remove <path>: <git's message>` when git refused for another reason. Left out otherwise. Type: string?

#### workspace.MergeResult.afterMergeError
Merged only: why `format.Config.afterMerge` failed, as `afterMerge failed: <last three lines of output joined by " | ">`. Left out when it succeeded or is not set. Type: string?

#### workspace.MergeResult.bundleRebuilt
Status: removed
Merged only: true when the merge rebuilt the skill's bundled CLI and it changed. Merge no longer builds the bundle; format.Config.afterMerge does (ADR-002). Type: bool?

#### workspace.MergeResult.error
Not merged only: why. Type: string?

### workspace.Orchestrate
Kind: operation · Status: removed · Superseded by: cli.Next
`spec orchestrate [<TICKET>...] [--restart] [--max <n>] [--depth <n>]`: waves of plan, dispatch and merge until nothing more can start. Prints `Merged: <IDs>` (or `Merged: none`), then, when any wait, a blank line, `Waiting for a person:` and one `- <ID>: <reason>` line each, then, when any stopped, a blank line, `Stopped mid-stage:` and one `- <ID> (<stage>): <reason>; log <path>; run again with --restart` line each, then, when any are not merged, a blank line, `Not merged:` and one `- <ID>: <reason>` line each. Exits 0 only when nothing waits, nothing stopped and nothing is not merged.
Output: workspace.OrchestrateResult | workspace.UnknownTicket | workspace.NoDispatchCommand | workspace.NotARepository

#### workspace.Orchestrate.tickets
The ticket IDs to deliver; none means every ticket the plan can start, wave after wave, and every ticket stopped mid-stage. Type: string[]

#### workspace.Orchestrate.depth
`--depth <n>`: the most waves to run. Type: int?

#### workspace.Orchestrate.restart
`--restart`: the first wave restarts the stopped tickets, as `spec dispatch --restart` does. Type: bool?

#### workspace.Orchestrate.max
`--max <n>`: the most tickets each wave starts, as `spec dispatch --max` does. Type: int?

### workspace.OrchestrateResult
Kind: type · Status: removed · Superseded by: cli.Next
What `spec orchestrate --format json` prints.

#### workspace.OrchestrateResult.merged
The tickets merged, in the order they were merged. Type: string[]

#### workspace.OrchestrateResult.waiting
The tickets that need a person, with why. Type: workspace.TicketReason[]

#### workspace.OrchestrateResult.stopped
The tickets stopped mid-stage, which a run with `--restart` starts again. Type: workspace.StoppedRun[]

#### workspace.OrchestrateResult.notMerged
The asked tickets that are neither merged, waiting for a person nor stopped, with why. Type: workspace.TicketReason[]

### workspace.UnknownTicket
Kind: error · Status: active
A ticket argument is not a ticket ID (`PROP-<n>`, `BUG-<n>` or `TASK-<n>`), or, for `worktree add`, names no ticket in the store. stderr is `Unknown <arg>.`, a blank line and the full usage; exit code 2.

### workspace.NotARepository
Kind: error · Status: active
The project root is not inside a git repository: `<project root> is not a git repository`, exit code 1.

### workspace.GitRefused
Kind: error · Status: active
git refused to add or remove a worktree: `git could not add a worktree for <ID>: <git's message>` or `git could not remove <path>: <git's message>`, exit code 1.

### workspace.SetupFailed
Kind: error · Status: active
`worktreeSetup` exited non-zero in a new worktree, or in one whose earlier setup failed: `worktreeSetup failed in <project>: <its last three lines of output, joined by " | ">`, exit code 1.

### workspace.NoWorktree
Kind: error · Status: active
No worktree has the ticket's branch checked out: `<ID> has no worktree`, exit code 1.

### workspace.OwnWorktree
Kind: error · Status: active
`worktree remove` was run inside the worktree it would remove: `<ID>'s worktree is this one; run remove from another tree`, exit code 1.

### workspace.WorktreeBusy
Kind: error · Status: active
`worktree add` or `worktree remove` waited 15 minutes for the ticket's lock, `spec/worktree-<ID>.lock` in the repository's common git directory, and another process still holds it: `another spec worktree add for <ID> is still running (pid <pid>)`, with ` (pid <pid>)` left out when the lock names no process; exit code 1, and nothing is changed. `spec merge` waits the same 15 minutes before it removes a merged ticket's worktree; there it is not a refusal: the ticket stays merged, its worktree is left as it was, and the message follows `, but its worktree was not removed: ` on the ticket's line. When merge refuses an already merged ticket, the message follows `; its worktree was not removed: ` on that refusal's line.

### workspace.BranchMoved
Kind: error · Status: active
A ticket update committed onto a branch no tree has checked out found the branch moved since its tip was read: `<branch> moved while it was being updated; try again`, where `<branch>` is `ticket/<ID>`, or the base branch for a ticket read from its tip. Nothing is committed.

### workspace.NoDispatchCommand
Kind: error · Status: removed · Superseded by: cli.Next
`spec/config.json` has no `dispatchCommand`: `config.json has no dispatchCommand, the command that runs one ticket headless, for example: claude -p {ticket} --agent overseer --permission-mode acceptEdits`, exit code 1.

### workspace.NotOnBaseBranch
Kind: error · Status: active
Merge refusal: `merging happens on <base>; this tree has <branch> checked out`, or `… has no branch checked out` on a detached HEAD.

### workspace.NoTestCommand
Kind: error · Status: active
Merge refusal: the spec has no `config.json`, so there is no `testCommand` to run on the merged result: `config.json has no testCommand to run on the merged result`. Nothing is merged.

### workspace.BaseBranchDirty
Kind: error · Status: active
Merge refusal: `<base> has uncommitted changes: <paths>`, the first five blocking paths in sorted order, joined by ", ": tracked files that are modified, staged or deleted, and untracked files at a path where the merge would write a file, whether found before the merge, found at a generated path when merge checks again before a generated rebuild or format.Config.afterMerge, or named by git when it refuses to merge over them (WSP-007/R4). Other untracked files and ignored files are not listed and do not refuse the merge.

### workspace.TicketNotFound
Kind: error · Status: active
Merge refusal: `unknown ticket <ID>`, for a well-formed ID no ticket has.

### workspace.TicketNotDone
Kind: error · Status: active
Merge refusal: `<ID> is <status>, not done`, with `in_progress` written `in progress`.

### workspace.NoTicketBranch
Kind: error · Status: active
Merge refusal: `ticket/<ID> does not exist`.

### workspace.AlreadyMerged
Kind: error · Status: active
Merge refusal: `ticket/<ID> is already merged into <base>`. Before it refuses, merge removes the ticket's worktree and `.failed` file that a merge which ended before its cleanup left (WSP-007/R1), and adds `; removed its worktree <path>` when it removed a tree, or `; its worktree was not removed: <workspace.WorktreeBusy message>` when the ticket's lock stayed held.

### workspace.MergeConflict
Kind: error · Status: active
Merge refusal: `merging ticket/<ID> conflicts in <paths>; a person must merge it`, naming every conflicted path that is not a generated file. The merge is undone.

### workspace.MergedSpecDoesNotBuild
Kind: error · Status: active
Merge refusal: generated files conflicted and the merged spec cannot be built: `the merged spec does not build: <errors joined by "; ">`. The merge is undone.

### workspace.GeneratedRebuildFails
Kind: error · Status: active
Merge refusal: a file that format.Config.generated names conflicted, and format.GeneratedConfig.command exited non-zero on the merged result: `the generated files do not rebuild: <its last three lines of output, joined by " | ">`. The merge is undone.

### workspace.MergedLintFails
Kind: error · Status: active
Merge refusal: `after merging ticket/<ID> the spec has lint errors; ticket/<ID> stays unmerged`. The merge is undone.

### workspace.MergedTestsFail
Kind: error · Status: active
Merge refusal: `after merging ticket/<ID> tests fail (<detail>); ticket/<ID> stays unmerged`, where the detail is the first three failed test names joined by "; ", else the test command's error, else `exit <code>`. The test command is run once more first; a name that passed on that rerun is written `<name> (flaky: failed, then passed on the rerun)`, and `exit <code> (flaky: failed, then passed on the rerun)` when no test was named. The merge is undone, flaky or not.

### workspace.AfterMergeFails
Kind: error · Status: active
Not a refusal: the ticket is merged and stays merged. `format.Config.afterMerge` exited non-zero after the merge: `afterMerge failed: <its last three lines of output, joined by " | ">`, reported on the ticket's line after the merge, and the run exits 1.

### workspace.MergedBundleDoesNotBuild
Kind: error · Status: removed
Merge refusal: the skill's bundled CLI cannot be rebuilt from the merged source: `the merged source does not build: <first three lines of the build's output joined by "; ">`. Merge no longer builds the bundle, so it no longer refuses for it; a failing format.Config.afterMerge is workspace.AfterMergeFails (ADR-002).
