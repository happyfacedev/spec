# pipeline contracts

### pipeline.Role
Kind: type · Status: active
The pipeline stage roles. "spec-review" is the spec review, which runs on a proposal between the spec-writer and the tester (PIP-001); in the build lane the implementer follows it (PIP-021). Type: "spec-writer" | "spec-review" | "implementer" | "tester" | "reviewer"

### pipeline.Result
Kind: type · Status: active
How a stage ended: its work is finished, or it stopped on something only a person can answer. Type: "done" | "blocked"

### pipeline.Verdict
Kind: type · Status: active
The reviewer's or the spec review's decision. The reviewer's: the ticket is finished, or it goes back for changes: to the implementer, or to an earlier stage when a finding names a gap in the spec or asks only for tests (PIP-001). The spec review's: the tester starts, or the spec goes back to the spec-writer. Type: "approve" | "changes"

### pipeline.Report
Kind: entity · Status: active
The one fenced `report` block a role ends its final message with: a fence of three or more backticks or tildes with the info string `report`, holding YAML. A key not listed here is refused. A list key with no value is an empty list.

#### pipeline.Report.role
The role that ran the stage. Type: pipeline.Role

#### pipeline.Report.ticket
The ticket the stage was for: `PROP-<n>`, `BUG-<n>` or `TASK-<n>`. Type: string

#### pipeline.Report.result
How the stage ended. Type: pipeline.Result

#### pipeline.Report.summary
One line, 1 to 500 characters; roles are asked for at most 120. Type: string

#### pipeline.Report.changed
Unit IDs the stage changed or covers. Type: string[]?

#### pipeline.Report.assumed
Defaults the stage applied. Type: pipeline.Assumption[]?

#### pipeline.Report.blockers
What stopped a blocked stage. Type: pipeline.Blocker[]?

#### pipeline.Report.verdict
Reviewer and spec-review only. Type: (pipeline.Verdict | null)?

#### pipeline.Report.findings
Reviewer and spec-review only: what the review found. Type: pipeline.ReviewFinding[]?

#### pipeline.Report.documents
Spec-writer only: scenario IDs the stage added that state behaviour the current build already has, each checked by running the build on it. Their tests pass before the implementer starts, so they are exempt from test first (PIP-006). Type: string[]?

#### pipeline.Report.checklist
Spec-writer only: how the stage covered each item of the case checklist in its brief (PIP-012/R9), one entry per item. A done spec-writer stage needs every item (PIP-007). Type: pipeline.ChecklistItem[]?

#### pipeline.Report.mutations
Tester and build stage (PIP-021/R9) only: for each scenario the tests cover, a plausible wrong implementation its test fails against. A done tester stage on a proposal or bug, and a done build stage, needs one for every scenario the ticket changes (PIP-019). Type: pipeline.Mutation[]?

#### pipeline.Report.lane
Any role, done or blocked: "full" when the stage found that the ticket needs a stage its light lane skips, so the ticket leaves its lane for good (PIP-021/R4). Only "full" is accepted: no report can make a ticket's lane lighter. Left out, the lane stays as it is. Type: "full"?

### pipeline.Mutation
Kind: type · Status: active
A wrong implementation a test is written to catch. Any other key is refused.

#### pipeline.Mutation.scenario
The scenario the test covers, as `<feature ID>/S<n>`. Type: string

#### pipeline.Mutation.wrong
The wrong implementation, as one non-empty line, for example "returns the configured provider even when it is disabled". Type: string

### pipeline.ChecklistItem
Kind: type · Status: active
One item of the case checklist and what covers it. Any other key is refused.

#### pipeline.ChecklistItem.item
Which item. Type: pipeline.CaseItem

#### pipeline.ChecklistItem.outcome
How it ended. Type: pipeline.ChecklistOutcome

#### pipeline.ChecklistItem.ids
What covers it: scenario IDs for scenarios, invariant IDs for invariant, questions as `<owner>#Q<n>` for question. Left out, it is []. Type: string[]?

#### pipeline.ChecklistItem.reason
Why the item does not apply, for na; a note otherwise. Type: string?

### pipeline.CaseItem
Kind: type · Status: active
The items of the case checklist: C1 neighbours, C2 environment axes, C3 concurrency and ordering, C4 trust boundaries, C5 fail closed, C6 preserved behaviour, C8 external facts. C7 (tests that cannot fail) is the tester's, so it is not among them. Type: "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C8"

### pipeline.ChecklistOutcome
Kind: type · Status: active
How a checklist item ended: covered by scenarios, by an invariant, by a question, or not applicable. Type: "scenarios" | "invariant" | "question" | "na"

### pipeline.AssumedPreference
Kind: type · Status: active
A default applied to an open preference question of the ticket or of a unit in its scope.

#### pipeline.AssumedPreference.question
The question, as `<owner>#Q<n>`. Type: string

#### pipeline.AssumedPreference.value
The value assumed; a number or boolean is kept as text. Type: string

### pipeline.AssumedNew
Kind: type · Status: active
A default applied to a question the stage met mid-work, which no ticket or unit holds yet.

#### pipeline.AssumedNew.new
The question, in words. Type: string

#### pipeline.AssumedNew.value
The value assumed. Type: string

### pipeline.Assumption
Kind: type · Status: active
One default a stage applied. Type: pipeline.AssumedPreference | pipeline.AssumedNew

### pipeline.Blocker
Kind: type · Status: active
Something a blocked stage cannot decide alone.

#### pipeline.Blocker.text
What is unknown. Type: string

#### pipeline.Blocker.cites
The IDs it is about: spec units, the ticket itself, or the ticket's questions. Type: string[]?

#### pipeline.Blocker.external
True when what is unknown is a fact about another tool or service that the stage could not verify; recording the stage then raises a question of kind "external" instead of "blocker" (PIP-008). Left out, or false, otherwise. Type: bool?

#### pipeline.Blocker.tests
True when the implementer's code is done and only a test is wrong, so the fix is the tester's: a test contradicts its scenario, or encodes behaviour the ticket replaced. When every blocker of a blocked implementer report on a proposal or a bug is so marked, recording the stage hands the implementer's work to the tester instead of raising questions (PIP-008). Only an implementer's blocker may carry it, never in a build stage, which writes the tests itself, nor together with pipeline.Blocker.external (PIP-004). Left out, or false, otherwise. Type: bool?

### pipeline.ReviewFinding
Kind: type · Status: active
One thing the reviewer found.

#### pipeline.ReviewFinding.cites
The IDs it is about, at least one. Type: string[]?

#### pipeline.ReviewFinding.text
What is wrong. Type: string

#### pipeline.ReviewFinding.spec
True when the finding is a gap in the spec: a scenario, rule or invariant the diff needs is missing or wrong, so the code and tests cannot be fixed without the spec changing first. Left out, or false, when the finding is about the code. Only a verdict "changes" may carry it. Type: bool?

#### pipeline.ReviewFinding.tests
True when the finding needs only new or stronger tests: the spec already states the behaviour, and a test is missing or does not check what its scenario says. The ticket then goes to the tester before the implementer (PIP-001). Left out, or false, otherwise. Only a verdict "changes" may carry it. Type: bool?

#### pipeline.ReviewFinding.class
The class of case the finding is about, as the conventions define the finding classes. A reviewer's or spec review's report needs it on every finding (PIP-004); a finding recorded before classes existed has none. Type: pipeline.FindingClass?

### pipeline.FindingClass
Kind: type · Status: active
The finding classes of the conventions: C1 neighbours, C2 environment axes, C3 concurrency and ordering, C4 trust boundaries, C5 fail closed, C6 preserved behaviour, C7 tests that cannot fail, C8 external facts, C9 text and docs, and other. Type: "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7" | "C8" | "C9" | "other"

### pipeline.StageRecord
Kind: type · Status: active
One finished stage, as the ticket's `history` keeps it. Any other key, such as one a newer spec added, is kept and ignored, as on tickets.Ticket.

#### pipeline.StageRecord.at
When it was recorded, as an ISO timestamp. Type: string

#### pipeline.StageRecord.role
The role that ran the stage. Type: pipeline.Role

#### pipeline.StageRecord.result
How it ended, or "reopened" for the entry `spec ticket answer --back` adds to make this role's stage run again. Type: pipeline.Result | "reopened"

#### pipeline.StageRecord.summary
The report's summary on one line, or "invalid report". Type: string

#### pipeline.StageRecord.verdict
Reviewer and spec-review stages only. Type: pipeline.Verdict | null

#### pipeline.StageRecord.findings
Reviewer and spec-review stages only: the report's findings, kept whole including pipeline.ReviewFinding.spec, pipeline.ReviewFinding.tests and pipeline.ReviewFinding.class; left out when the report has none. Type: pipeline.ReviewFinding[]?

#### pipeline.StageRecord.checklist
Done spec-writer stages only: the report's checklist, kept whole, so the spec review's brief can show the spec-writer's answers (PIP-012/R11); only the latest done spec-writer stage's checklist counts. Left out when the report has none. Type: pipeline.ChecklistItem[]?

#### pipeline.StageRecord.documents
Done spec-writer stages only: the report's documents, so the tester's check and brief know which new scenarios state behaviour the code already has; only the latest done spec-writer stage's list counts. Left out when the report has none. Type: string[]?

#### pipeline.StageRecord.mutations
Done tester stages, and done build stages that stay in their lane (PIP-021/R9, R10), only: the report's mutations, kept whole, so the reviewer can check a test against the wrong implementation it names, and a later tester round need not name them again (PIP-019). Left out when the report has none. Type: pipeline.Mutation[]?

#### pipeline.StageRecord.blockers
Implementer stages that handed their work to the tester only (PIP-008/R13): the report's blockers, kept whole, so the stage order and the tester's brief know it. An implementer record that holds it is a hand-off; any other record leaves it out. Type: pipeline.Blocker[]?

#### pipeline.StageRecord.passed
Done tester stages that follow a hand-off only (PIP-008/R14): true only when the tree, the implementer's committed code with the tester's tests, passes every check a done implementer stage gets (PIP-006/R5, R6, R7): the test run the stage was checked on exited 0 with no failed test, every command of format.Config.checkCommands exits 0, and no "SPEC-STUB" line the branch added is left; false otherwise. It decides whether the reviewer or the implementer runs next (PIP-001). Left out on every other record. Type: bool?

#### pipeline.StageRecord.lane
The ticket's first record holds the light lane the ticket started in, "docs", "tests" or "build", read from tickets.Ticket.lane, and from then on the order reads the lane from here alone (PIP-021/R2). Any record holds "full" when recording it moved the ticket out of a light lane: the report asked for it, or the CLI found the ticket needs a stage the lane skips (PIP-021/R3); from that record on, the ticket runs the full order of its type. Left out on every other record, and a first record without it means the full lane. Type: tickets.Lane?

#### pipeline.StageRecord.assumed
The defaults the stage applied, for the main session to report. Type: pipeline.Assumption[]

#### pipeline.StageRecord.duration_s
Whole seconds elapsed from the stage's start to its recording, waiting for a test-run turn (PIP-009) included and not subtracted, never below 0 (PIP-008/R8). Data only (INV-017). Type: int

#### pipeline.StageRecord.model
The model that ran the stage: the one the role's transcript reports, else the one `spec next` remembered for this stage (CLI-007/R17); left out when neither is known. 1 to 100 printable ASCII characters, U+0020 to U+007E (PIP-025/R1, R3). Data only (INV-017). Type: string?

#### pipeline.StageRecord.cost_usd
What the stage cost in US dollars, as the role's transcript reports it: a finite number, 0 or more and below 1000000; left out otherwise, never estimated (PIP-025/R1, R3). Data only (INV-017). Type: number?

#### pipeline.StageRecord.refusals
How many of this stage's reports were refused at intake (PIP-018/R3), including a third refusal that blocked it; left out when none was. Type: int?

### pipeline.StartStage
Kind: operation · Status: active
`spec ticket start <TICKET> <role>`: checks that the stage may begin, switches to the ticket's branch and marks the stage running.
Output: pipeline.StageStarted | pipeline.StageRefused | tickets.UnknownTicket | pipeline.UnknownRole | cli.UsageError

#### pipeline.StartStage.ticket
The ticket ID. Type: string

#### pipeline.StartStage.role
The role whose stage begins. Type: pipeline.Role

### pipeline.StageStarted
Kind: type · Status: active
What `spec ticket start --format json` prints when the stage begins.

#### pipeline.StageStarted.ticket
The ticket ID. Type: string

#### pipeline.StageStarted.branch
`ticket/<ID>`. Type: string

#### pipeline.StageStarted.created
Whether the branch was created by this call, from the base branch. Type: bool

#### pipeline.StageStarted.stage
The role whose stage is running. Type: pipeline.Role

#### pipeline.StageStarted.status
Type: "in_progress"

### pipeline.CheckReport
Kind: operation · Status: active
`spec check-report <role> <TICKET> [--report-file <path>]`: validates a finished stage's final message, read from the file or else on stdin, against the ticket, the working tree, lint and, when needed, the tests. It changes nothing.
Output: pipeline.ReportCheck | pipeline.UnknownRole | pipeline.UnknownTicket | pipeline.UnreadableReportFile

#### pipeline.CheckReport.role
The role of the stage being checked. Type: pipeline.Role

#### pipeline.CheckReport.ticket
The ticket ID. Type: string

#### pipeline.CheckReport.message
The role's final message: the content of pipeline.CheckReport.reportFile when that is given, else stdin. Type: string

#### pipeline.CheckReport.reportFile
`--report-file <path>`: the file that holds the final message, with the same meaning as on `ticket advance` (PIP-018/R1): a relative path is read from the project root. Left out, the message is read from stdin. Type: string?

### pipeline.UnreadableReportFile
Kind: error · Status: active
`spec check-report` was given a `--report-file` path that names no file, or a file that cannot be read. stderr is the path, then " does not exist" when nothing is there; for any other path that cannot be read, stderr starts with the path and holds no stack trace. stdout is empty and the exit code is 2. No check runs.

#### pipeline.UnreadableReportFile.path
The path as given. Type: string

### pipeline.ReportCheck
Kind: type · Status: active
What `spec check-report --format json` prints.

#### pipeline.ReportCheck.ok
True when there are no problems. Type: bool

#### pipeline.ReportCheck.problems
Each reason the stage is refused, one sentence with its fix, in the order the checks run. Type: string[]

#### pipeline.ReportCheck.report
The parsed report, or null when none could be read. Type: pipeline.Report | null

### pipeline.AdvanceTicket
Kind: operation · Status: active
`spec ticket advance <TICKET>`: checks the running stage's report, records it in the ticket, rebuilds the generated files, commits the stage and names the next stage.
Output: pipeline.Advanced | pipeline.InvalidReport | pipeline.CheckCouldNotRun | pipeline.NoReport | pipeline.NoStageRunning | pipeline.UnknownTicket | pipeline.RecordFailed

#### pipeline.AdvanceTicket.ticket
The ticket ID. Type: string

#### pipeline.AdvanceTicket.message
The role's final message on stdin; may be empty when a report was stored by the finish check. Type: string

#### pipeline.AdvanceTicket.transcript
`--transcript <path>`: the role's transcript (JSONL), where the harness reports the stage's model and cost. Without it, the transcript the finish hook kept with the stored report. A model it reports within PIP-025/R3 wins over the one `spec next` remembered for the stage (PIP-025/R1). Type: string?

### pipeline.Advanced
Kind: type · Status: active
What `spec ticket advance --format json` prints.

#### pipeline.Advanced.ticket
The ticket ID. Type: string

#### pipeline.Advanced.next
The role whose stage runs next, or null when the ticket is done or blocked. Type: pipeline.Role | null

#### pipeline.Advanced.status
The ticket's status after the stage. Type: tickets.TicketStatus

#### pipeline.Advanced.problems
Why the report was refused; empty when it was recorded. When the check could not run (pipeline.CheckCouldNotRun), the one sentence "the test command gave no results: <reason>". Type: string[]

#### pipeline.Advanced.stash
A blocked stage, or a build stage that gives up its lane, only: the git stash that holds its uncommitted changes, "<ID> <role>: blocked", or "<ID> build: blocked" for a build stage (PIP-021/R11). Left out when the stage left none. Type: string?

### pipeline.RunTests
Kind: operation · Status: active
`spec test [<scenario ID>]`: runs the project's `testCommand` and reads its report, one line per test. Every run of the test command spec starts first waits for its turn, shared by the main checkout and every worktree of the repository, and says on stderr whose run it waits for.
Output: pipeline.TestRun | pipeline.InvalidScenarioFilter | pipeline.NoTestResults | pipeline.MissingTestCommand

#### pipeline.RunTests.scenario
The scenario whose tests to run, put in place of `{filter}`; left out, `{filter}` is empty and every test runs. Type: string?

### pipeline.TestRunSettings
Kind: type · Status: active
Environment values read by every spec command that runs the test command, and passed on, like the rest of its environment, to the test command and every process it starts. Each can only lower its default: a value is used only when it is plain decimal digits (no sign, spaces, point, exponent or prefix) for a whole number of 1 or more below the default; anything else is ignored and the default applies. No value skips a wait, lengthens anything past its default, or makes a run pass (INV-016).

#### pipeline.TestRunSettings.SPEC_TEST_RUN_TIMEOUT_MS
The test command's time limit in milliseconds, counted from its own start. Default: 600000. Type: string?

#### pipeline.TestRunSettings.SPEC_TEST_RUN_NOTICE_INTERVAL_MS
How often, in milliseconds, a waiting run repeats its waiting line. Default: 60000. Type: string?

#### pipeline.TestRunSettings.SPEC_TEST_RUN_POLL_INTERVAL_MS
How often, in milliseconds, a waiting run looks again for a free turn. Default: 100. Type: string?

### pipeline.TestRunTurn
Kind: type · Status: active
One held turn: the JSON object in the file "<git folder>/spec-test-runs/<pid>". Holders are ordered by the files' modification times. A file that is not such an object, or whose pid is not the file's name, cannot be read and its turn is free.

#### pipeline.TestRunTurn.pid
The holder's process number, the same as the file's name. Type: int

#### pipeline.TestRunTurn.command
Which of the five commands holds the turn, for example "spec check-report"; any other text is shown as an unknown run. Type: string

#### pipeline.TestRunTurn.ticket
The ticket whose worktree the run is in, or null. Type: string | null

#### pipeline.TestRunTurn.startedAt
When the turn was taken, an ISO 8601 time. Type: string

#### pipeline.TestRunTurn.location
Where the run is: "ticket" (with a ticket), "main" (the main checkout) or "worktree" (a worktree without a ticket); left out, the holder is shown as an unknown run. Type: ("ticket" | "main" | "worktree")?

### pipeline.TestStatus
Kind: type · Status: active
Type: "passed" | "failed" | "skipped"

### pipeline.TestFailureKind
Kind: type · Status: active
Type: "assertion" | "error"

### pipeline.TestCase
Kind: type · Status: active
One test from the report.

#### pipeline.TestCase.name
The test's name as the report gives it. Type: string

#### pipeline.TestCase.status
Type: pipeline.TestStatus

#### pipeline.TestCase.failureKind
Failed tests only: "assertion" when the report says the test failed on a check, "error" when it says the test failed by an error raised, for example a type error or a missing function. Left out when the test did not fail or the report does not tell the two apart. Type: pipeline.TestFailureKind?

#### pipeline.TestCase.firstErrorLine
Failed tests only: the first non-blank line of the failure's message, when the report gives one. Type: string?

### pipeline.TestRun
Kind: type · Status: active
What one run of the test command gave, as `spec test --format json` prints it.

#### pipeline.TestRun.exitCode
The test command's exit code, or null when it could not run. Type: int | null

#### pipeline.TestRun.tests
Every test the report holds, in report order. Type: pipeline.TestCase[]

#### pipeline.TestRun.error
Why there are no results, or null. Type: string | null

### pipeline.Brief
Kind: operation · Status: active
`spec brief <role> [<ID>] [--base <ref>] [--query <text>]`, or `spec brief --stdin [--base <ref>]` with the arguments on standard input: the part of the spec, the ticket and the diff one role needs for one stage, as Markdown on stdout. It always exits 0.
Output: string

#### pipeline.Brief.role
A role, or with no ID an ID to show; empty for the home brief. Type: string

#### pipeline.Brief.id
A ticket or unit ID. Type: string?

#### pipeline.Brief.base
The reviewer's diff base; the config's `baseBranch` when left out, else "main". Type: string?

#### pipeline.Brief.query
The whole argument text a skill was loaded with. Given a role name as its first word, it is that role's brief; otherwise it is searched, except that a lone unit, module, ticket or glossary term is shown as it is (PIP-015/R4). Type: string?

#### pipeline.Brief.stdin
The whole argument text on standard input, used in place of the role, the ID and the query: its first word is the role, its second the ID and all of it the query (PIP-015/R5). Type: string?

### pipeline.UnknownRole
Kind: error · Status: active
The role is not a pipeline stage. stderr: "Unknown role <role>. Roles: spec-writer, spec-review, tester, implementer, reviewer" and the usage text; exit 2.

### pipeline.UnknownTicket
Kind: error · Status: active
`spec check-report` or `spec ticket advance` was given an ID that is not a ticket ID, or that no ticket has. stderr: "Unknown <ID>." (or "Unknown (none)." when the ID is missing), a blank line and the usage text; exit 2. Unlike tickets.UnknownTicket, it never suggests a close ID.

### pipeline.StageRefused
Kind: error · Status: active
`spec ticket start` will not begin the stage. stderr holds the reason; exit 1; the ticket and the branch are left as they were.

### pipeline.InvalidReport
Kind: error · Status: active
The report was read but failed its checks: the ticket is blocked on a question listing the problems, and nothing is committed; exit 1.

### pipeline.NoReport
Kind: error · Status: active
No report reached `spec ticket advance`: nothing is recorded and the stage keeps running; exit 2.

### pipeline.CheckCouldNotRun
Kind: error · Status: active
`spec ticket advance` could not check the report because the test run gave no results (the test command failed to start, timed out, wrote no report or wrote one in no known format), and nothing else is wrong with the report: nothing is recorded and no refusal is counted (INV-015). stderr starts "the check could not run: " followed by the reason, and ends with a line telling the role's driver to run the same command again; exit 3.

### pipeline.NoStageRunning
Kind: error · Status: active
The ticket has no stage running. stderr: "<ID> has no stage running; spec ticket start begins one"; exit 1.

### pipeline.RecordFailed
Kind: error · Status: active
The stage was checked but could not be recorded: the project is not a git repository, the ticket store refused the write, the build failed, or git add or commit failed. stderr says which; exit 1.

### pipeline.InvalidScenarioFilter
Kind: error · Status: active
`spec test` was given something other than a scenario ID. stderr: "Unknown <arg>. spec test takes a scenario ID, or nothing for every test." and the usage text; exit 2.

### pipeline.NoTestResults
Kind: error · Status: active
The test command gave no results: it failed to start, timed out, wrote no report, or wrote one in no known format (XML that is not a complete JUnit report is one). `spec test` prints "spec test: <reason>" on stderr and exits 1.

### pipeline.MissingTestCommand
Kind: error · Status: active
There is no config to take `testCommand` from. stderr: "config.json has no testCommand"; exit 1.
