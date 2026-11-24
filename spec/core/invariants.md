# Invariants

One `### INV-<NNN>: <title>` per rule that always holds, with a few lines, an `Applies to:` line naming the contracts or members it constrains, and an optional `Decisions: ADR-<NNN>` line. A scenario that checks one cites it in a step, for example `Then no log line holds the key (INV-002)`; every invariant is shown by one. For a large spec, split them into `core/invariants/*.md`.

### INV-001: An ID is never reused
Status: active
Applies to: format.Unit.id
Once a unit has an ID, no other unit ever takes it. A removed scenario or rule stays in its feature's `retired:` list; every other removed unit stays as a tombstone with status removed. A spec stage that deletes a unit any other way, takes a number off `retired:`, or makes a removed unit live again is refused. Against its base branch, `spec lint --base` and `--ci` report an ID that a branch and its base each added, after they parted, with different meanings, and a unit the branch dropped without retiring its number or keeping a tombstone.

### INV-007: A lint rule code keeps its meaning
Status: active
Applies to: lint.Finding.rule
Shown by: a test in CI that compares each code's name in the CLI's rule table with the base branch's, so a code two branches each added for different checks is renumbered on one of them before it merges
Each lint rule code names one check for good. A code is never given to another check, a retired code is never used again, and a code is added only with the next number free on the base branch as well as on the branch.

### INV-002: The base branch receives a ticket only when lint and every test pass
Status: active
Applies to: workspace.Worktree.branch
A ticket's branch is merged into the base branch only when the ticket's status is done, the merged spec builds, `spec lint` reports no errors and every test passes on the merged result. Otherwise the base branch is left as it was.

### INV-003: Each stage changes only the files its role may change
Status: active
Applies to: tickets.Ticket.stage
The rules apply to the stage that is running. The spec-writer changes only spec files, and only on a proposal. The tester changes only files under `testGlobs`, plus code lines marked `SPEC-STUB` on a proposal. The implementer never changes spec files, and changes no file under `testGlobs` on a proposal or a bug; on a task it may move tests with the code, and in a build stage, on a proposal whose lane has no tester, it writes the tests itself (PIP-021/R9). The spec review, the reviewer and the overseer change nothing. No stage changes a file under `protectedGlobs`. Ticket files are written by the CLI, and what a new worktree's setup made belongs to no stage, so neither ever counts. `check-report` refuses a stage that changes anything else, naming each file to revert. A blocked stage's changes are committed only on an implementer's hand-off to the tester, and only when they keep these rules (PIP-008); every other blocked stage's changes, and those of a build stage that gives up its lane (PIP-021/R10), are stashed, never committed.

### INV-004: Behaviour changes are test first
Status: active
Applies to: tickets.Ticket.type
On a bug, each violated scenario that has tests has at least one failing test when the tester finishes. On a proposal, at least one test of the scenarios its branch added or changed fails when the tester finishes; a reworded scenario does not count, nor does a scenario the spec-writer added and listed under `documents:` in its latest done stage as behaviour the current build already has, which instead needs a test that runs and passes. A proposal whose every new or changed scenario is so documented needs no failing test. This applies only to a tester stage that runs before the ticket's first implementer stage: once the implementer has run, the code may already deliver a scenario, so a tester stage that follows may leave every new test passing, and a documented scenario is checked like any new scenario, so its test may fail on its assertion. The implementer finishes only when every test passes. A tester stage that breaks this is refused. On a proposal in the build lane, which has no tester, every done build stage is held to it by the CLI's own run on the code as it was before the first one, with the branch's test files put on it (PIP-024): each new or changed scenario, reworded and documented ones aside, has a test that fails there, each on an assertion, and a documented scenario's tests pass there; a build stage that breaks this is refused. A build stage that did not end done in its lane leaves no code on the branch, so it does not count as the ticket's first implementer stage.

### INV-005: Generated output is deterministic
Status: active
Applies to: graph.Graph, graph.Index, graph.Impact
The same spec files give byte-identical `index.md`, `_generated/graph.json` and impact output, whatever order the files are read in.

### INV-006: An unverified external fact holds its ticket
Status: active
Applies to: tickets.Question.kind, pipeline.ChecklistItem
An open question of kind "external" stops the gate on every ticket whose scope holds it, exactly as a blocker does, and only its answer clears it. No stage's report clears one: a done spec-writer report whose C8 checklist item cites a question that is still open is refused, so a stage never finishes on a fact nobody verified.

### INV-008: The reported edit mode never grants an edit
Status: active
Applies to: cli.Detection.editMode
Whoever writes `.claude/settings.local.json` or `.claude/settings.json` (the person, or the repository for the shared file) sets the mode `detect` reports; `detect` only reads it and never writes either file. Claude Code alone decides whether a subagent may edit. A mode that says "acceptEdits" while Claude Code runs another only lets the driving skills background a subagent whose edits Claude Code still denies, and that stage ends in a blocked report. Spec writes `permissions.defaultMode` only through `spec init --accept-edits`, which a skill runs only after the person agrees.

### INV-018: Spec never changes where a registered marketplace points
Status: active
Applies to: install.ClaudeSettings.extraKnownMarketplaces
Whoever commits `.claude/settings.json` sets its `extraKnownMarketplaces`, and Claude Code registers what it lists only after the person trusts the folder; the person still chooses whether to install from it and whether to turn on auto-update. Init and upgrade only add the `happyface` entry when that key is missing: an existing `happyface` entry, even one naming another repository, and every other marketplace are kept as they are, and spec writes no `autoUpdate` key. So a forged entry can at worst offer a contributor a marketplace they must still trust and install from themselves, and spec never moves a project to a marketplace its committers did not choose.

### INV-010: A pinned CLI never vouches for itself
Status: active
Applies to: install.ProjectCli
Anyone who can commit sets the bytes of `.spec/bin/`: a ticket's implementer through its build, `spec upgrade` through the files it writes, a person under a bypass. A forged pinned CLI can make every check it runs, the Git hooks and `spec verify-history` among them, say anything, and pre-commit runs whichever CLI the working tree holds. So a commit's own pinned CLI never decides whether that commit is valid: history verification reads each commit's `.spec/bin/` as data and runs nothing from it, and its verdict is given by the CLI that runs it, so any honest CLI, earlier or later, lists an unauthorized change. No trailer, marker or version string inside the commit authorizes a change to `.spec/bin/`; only a ticket or a bypass does, and review is the enforcement for what they carry.

### INV-011: Where a symlink points never decides what is governed
Status: active
Applies to: format.Config.codeGlobs, format.Config.testGlobs, format.Config.protectedGlobs, format.Config.tickets
Whoever stages a symlink sets its target, and the checks never let that target decide: a staged or committed path is governed by its own place in the Git tree, never by the file a symlink at it resolves to. The target is read from the tree as text, never followed on the filesystem, and a symlink under a governed path whose target is absolute, leaves the project or cannot be resolved is refused, on the base branch and in history, whatever authorizes the rest of the commit.

### INV-013: A light lane only skips stages; it never lets unchecked work through
Status: active
Applies to: tickets.Ticket.lane, pipeline.Report.lane, pipeline.StageRecord.lane
A person sets a ticket's lane in its frontmatter; no CLI command writes it, and the gate refuses a light lane on anything but a proposal (TKT-001). The frontmatter is read only until the first stage is recorded, which keeps the lane in its record; a later edit of the frontmatter changes nothing, so no guard a stage would have run can be skipped by editing it. After that a stage can only widen the lane: a report's lane accepts "full" alone, and the CLI moves a ticket to the full lane from what it reads itself (git, its own test run, the recorded findings), never from a report's claim that the tree is fine. A record with lane "full" keeps the ticket in the full lane for good. Whatever the lane, every stage keeps INV-003, the reviewer runs last, and the branch merges only under INV-002, so a forged docs or tests lane at worst brings a diff with no code change to the reviewer and to the merge's full test run. The build lane skips the tester, never test first: the CLI decides from git and its own runs, never from the report, that the tests fail on the code before the build and pass with it (INV-004). The implementer writes the test files, so it can write one that fails there for a reason its scenario does not name; no run can tell, and what it gives up is the independent reader who would. A forged build lane therefore at worst brings tests and code by one role, proved to depend on the change, to the reviewer, who checks them against the scenarios and the named mutations, and to the merge's full test run.

### INV-015: A test run that gave no results neither accepts nor refuses a report
Status: active
Applies to: pipeline.StageRecord.refusals, tickets.Ticket.history
Whatever slows or breaks the test command (load on the machine, a runner that cannot start, a command that wrote no report) decides whether a run gives results, and it can do so at any time. `spec ticket advance` therefore lets only a run that gave results decide a report: with no results it records nothing, uses none of the report's three attempts and keeps the stage running, so a slow machine can neither pass an unchecked report nor push a good one toward the block after three refusals. It never reads missing results as passing: the stage is recorded only by a later command that gets results, and a report that has another problem, or a project with no test command set, is refused as ever (PIP-022/R1).

### INV-016: A test run's turn only orders runs; it never decides a result
Status: active
Applies to: pipeline.RunTests, format.Config.maxTestRuns
Any process of the user that can write in the repository can write the record of a turn, and any process can set "SPEC_TEST_RUN_PARENT" in a run's environment, so neither proves anything. A forged or left-over "SPEC_TEST_RUN_PARENT" counts only when it names the run's own repository and a live process holding a record there, and then it can only let the run skip waiting: the run still runs the test command and reads its own results, and nothing in the value is run. A forged or stale record can only make a run wait, or, naming a holder that is no longer alive, be taken over; it never makes a run skip the test command, never gives a run results, and never counts as passing, so INV-002 and INV-015 hold whatever it says. No part of a record is run, and the waiting notice shows from it only a ticket ID, one of spec's own command names and a process number, else "an unknown run". A record whose process number another process now uses holds a turn only until the person removes its file, which the notice names. Any process can also set the pipeline.TestRunSettings values, and they can only lower the time limit, the notice interval and the poll interval: none skips a wait, and a lower time limit can only turn a run into one with no results, never into a pass. The person decides how long to wait: a run never gives up on its own, and stopping it gives no result.

### INV-017: A stage's measures are data, never inputs to a decision
Status: active
Applies to: pipeline.StageRecord.model, pipeline.StageRecord.cost_usd, pipeline.StageRecord.duration_s
A stage's model comes from the role's transcript, a file the harness writes and the main session names with `--transcript`, or else from the stage start record, where `spec next` puts the model it selected and which any local process can write (PIP-025/R2); its cost comes from the transcript alone; its duration from the stage start record and the clock, and it includes any wait for a test-run turn, which a stale or forged turn record, a forged parent marker or lowered settings (INV-016) can lengthen or shorten; it is never below 0 (PIP-008/R8). None of them is verified, so nothing decides from model or cost: no stage order, gate, report check, lane or merge reads them. They are only shown, as data: in `spec stats` (PIP-020), in the ticket file and in the history records briefs show (PIP-012/S24), and, from the stage start record and only when it is a Claude Code alias, in the denial of a request for a running stage (INS-020/R19). What is recorded, and what a ticket file may hold, is bounded (PIP-025/R3, PIP-020/R9): a model of 1 to 100 printable ASCII characters, so at most 100 bytes on one line with no control, separator or bidirectional character, and a cost that is a finite number, 0 or more and below 1000000, so no sum of them overflows; any other value is not recorded, and nothing is estimated. A duration decides one thing only: a ticket's first record's time less its duration_s is when the ticket started, which orders conflicting tickets (PIP-002/R2); a wait inside the stage moves the record's time and its duration alike, so it does not move that start, and a hand-edited duration_s can at most make that ticket hold back, while it runs, the conflicting tickets it would not otherwise hold back, or the reverse. At worst a wrong value misstates which model ran a stage, what it cost or how long it took; it never lets work skip a check.
Shown by: PIP-025/S5 and PIP-020/S10 for the bounds, PIP-025/S6 for the wait and INS-020/S26 for the denial; review: no stage order, gate, report check, lane or merge reads a record's model or cost_usd, and only PIP-002/R2's start order reads its duration_s

### INV-012: Closing a ticket deletes no work
Status: active
Applies to: tickets.TicketClose, tickets.Ticket.absorbed_into
`spec ticket close` changes only two keys of one ticket file on the base branch: status, from open or blocked to absorbed, and absorbed_into. It never removes a worktree, branch, stash, commit or history record; only a person running the commands it prints does, so retiring a ticket needs no one's approval to destroy anything. It runs only from the base-branch checkout, never from a stage's worktree, and refuses a ticket whose stage is running. Its commit is trusted for what it holds, not for its trailer: `spec verify-history` accepts it only when the base copy of each ticket file it touches was open or blocked with stage null at its parent and differs from it only in those two keys, absorbed into the ticket the trailer names (INS-015/R6). A forged close of a ticket whose stage was running on its branch passes that check only as a change to the base copy, which keeps the branch, its commits and its history untouched and is undone by reverting the commit.

### INV-009: A narrowed spec review still sees every unapproved spec change
Status: active
Applies to: pipeline.StageRecord.findings
A spec review's brief leaves out only spec changes an earlier spec review approved: a narrowed spec delta holds every change the ticket's branch made to the spec folder since the commit that recorded the latest spec-review "approve", whichever stage made it, and only what the branch merged from the base branch is left out. The reviewer and the spec review set a finding's cites; they decide only whether the narrowed delta is offered, never which changes it shows, so a cite that is forged or too wide cannot hide a change. The spec-writer cannot narrow its own review: the CLI reads the ticket's history and git, never a report's `changed:` list, and a change to any unit outside the findings gives the full delta. Whatever it cannot establish (no approve, an approve commit not in HEAD's history, base-branch changes that conflict) gives the full delta too. A narrowed review is held to every item of the checklist, as a full one is.

### INV-019: A stage request names only a ticket, and a subagent's final message or handback is only a report
Status: active
Applies to: install.AgentToolInput.prompt, install.HandbackToolInput.message, install.SubagentStopInput.last_assistant_message, install.SubagentStopInput.agent_transcript_path
Any agent in the session can write an Agent call's prompt, and any subagent, or text it read, can write its handback message or its final message, so none of them proves who sent it. A prompt counts as a stage request only when, trimmed, it is exactly `spec:` and a ticket ID; nothing else in it is read, and the ID is passed to spec as an argument, never through a shell. A forged request can at most start the stage `spec next <ID>` would start for any session, through the same gate; the call's other input keys, its agent type and therefore its tools and permissions, are passed back as given, and the hook only replaces its prompt, description, model and, when it sends the chosen entry's effort, effort. The model and an effort spec sends come from the config, never from the call; any other effort the call carries is passed back as given, like every other key. A handback message, a final message, or the transcript at the path Claude Code gives, is read as data and nothing in it is run or followed: the hook acts only on a report block whose ticket and role are the ones whose stage is running, and that report is recorded only through the checks `spec ticket advance` makes (PIP-004), which decide from git, the tests and lint, never from what the report claims. So a forged report can at most use one of that stage's three attempts, exactly as the same text given to `spec ticket advance` would, and a message for any other ticket or role changes nothing.

### INV-020: A machine's model settings only choose among the project's own entries
Status: active
Applies to: format.LocalConfig.unavailableModels, cli.Next.effort
Any process of the user can write `config.local.json`, and whatever `claude` is on the PATH prints the version; that reading is accepted, though the session may run another. Neither proves anything. A forged mark can at most make a stage take a later entry of its role's list, or not start, with the marked models named; a forged unmark or version can at most lead to a launch Claude Code refuses. The version text is only compared and never run, and no gate, report check, lane or merge reads either.

### INV-014: A refused shell write is a guard against slips, not a boundary
Status: active
Applies to: workspace.Worktree
The stage agent sets both the command and the cwd of a Bash payload, and Claude Code or Astro passes them to the hook as given. The check reads the command as text and runs none of it, so a forged or disguised command (a nested shell, a script, a variable target, a `cd` before the write) is simply allowed, never misjudged into running something. A refusal only stops that one call; it grants nothing, changes no file and leaves no state. What a stage actually changed is decided afterwards from Git: `check-report` compares the worktree with its base (INV-003), and the reviewer reads the diff, so a shell write the check misses is still seen there.
