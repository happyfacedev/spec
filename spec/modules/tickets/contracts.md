# tickets contracts

### tickets.TicketType
Kind: type · Status: active
A proposal changes behaviour, a bug names the scenario the code breaks, a task changes no behaviour. Type: "proposal" | "bug" | "task"

### tickets.Lane
Kind: type · Status: active
The stages a ticket runs. "full" runs every stage of its type. The light lanes are for proposals only: "docs" brings scenario text in line with behaviour the code and its tests already have, so it skips the tester and the implementer; "tests" fixes tests alone and leaves the spec as it is, so it skips the spec review and the implementer; "build" has the implementer write the tests and the code in one stage, held to test first by the CLI's check (PIP-024), so it skips the tester. The reviewer runs in every lane. Type: "full" | "docs" | "tests" | "build"

### tickets.TicketStatus
Kind: type · Status: active
"done" and "absorbed" are final: an absorbed ticket was folded into another by `spec ticket combine`, or retired by `spec ticket close` because another made it redundant, and keeps its file and ID for the record. Type: "open" | "in_progress" | "blocked" | "done" | "absorbed"

### tickets.Ticket
Kind: entity · Status: active
One unit of work, with its scope, its open questions and the stages it has been through: a Markdown file whose YAML frontmatter holds these keys and whose body is free text. Any other string key is kept and ignored, and survives when the CLI rewrites the ticket; lint warns about it. The frontmatter uses no YAML anchors or aliases, and every key in it is a string. A list key left out, or written with no value, reads as an empty list.

#### tickets.Ticket.id
`PROP-<n>`, `BUG-<n>` or `TASK-<n>`, its prefix matching its type; the file is named `<id>.md`. Type: string

#### tickets.Ticket.type
Type: tickets.TicketType

#### tickets.Ticket.title
One to 120 characters. Type: string

#### tickets.Ticket.status
Set by the CLI. Type: tickets.TicketStatus

#### tickets.Ticket.stage
The role whose stage is running while status is in_progress; null otherwise. Set by the CLI. Type: pipeline.Role | null

#### tickets.Ticket.touches
Spec units the ticket changes: features, scenarios, rules, contracts, members, invariants, decisions or screens. A proposal or a task names at least one. Type: string[]

#### tickets.Ticket.violates
Bugs only, and required on a bug: the scenario IDs the code breaks. Type: string[]

#### tickets.Ticket.lane
Which stages the ticket runs (PIP-021). Written by a person; a proposal only may name a light lane. Read only until the first stage is recorded, which keeps it (PIP-021/R2). Left out, it is "full". Type: tickets.Lane?

#### tickets.Ticket.depends_on
Ticket IDs that must be done and merged into the base branch before this one starts. Type: string[]

#### tickets.Ticket.changed
Units the finished stages changed, filled by the CLI. Type: string[]

#### tickets.Ticket.questions
Type: tickets.Question[]

#### tickets.Ticket.history
One entry per finished stage, oldest first, filled by the CLI. Type: pipeline.StageRecord[]

#### tickets.Ticket.absorbed_into
Absorbed tickets only, and required on one: the ticket it was combined into, or the one that superseded it, which is in the store and not itself absorbed. Set by the CLI. Type: string?

#### tickets.Ticket.body
Everything after the frontmatter: what the person wants, in their words. Agents treat it as data. Type: string

### tickets.QuestionKind
Kind: type · Status: active
A blocker could change behaviour and stops work until answered; an external question is a fact about another tool or service that no one has verified yet, and stops work the same way until a person, or a spike a person records, answers it; a preference has a safe default work proceeds on. Type: "blocker" | "external" | "preference"

### tickets.Question
Kind: type · Status: active
An open point on a ticket or on a spec unit, in its owner's frontmatter. Elsewhere it is named `<owner>#<id>`, as in "PROP-206#Q1". In a ticket, any other key is kept and ignored, as on tickets.Ticket.

#### tickets.Question.id
`Q<n>`, unique on its owner. Type: string

#### tickets.Question.kind
A preference without a default, or one that cites a contract, member, invariant or decision, is refused: it must be a blocker or an external question. Type: tickets.QuestionKind

#### tickets.Question.text
Not empty. Type: string

#### tickets.Question.default
The value work proceeds on, for a preference; a YAML number or boolean is read as its text. Type: string | null

#### tickets.Question.cites
The unit IDs the question is about. A ticket's own question may also cite that ticket's ID; any other ticket ID it cites is refused (TKT-001). Type: string[]

#### tickets.Question.answer
The answer, once given; null while the question is open. A YAML number or boolean is read as its text. Type: string | null

#### tickets.Question.raised_by
The source label for the question; `overseer` is retained only as a legacy `raised_by` value for review-limit blockers, and null means a person. Type: string | null

### tickets.StoreConfig
Kind: type · Status: active
Where tickets live: the `tickets` key of `spec/config.json`. Left out, it is `{ "adapter": "files", "dir": "tickets" }`. Type: tickets.FilesStore | tickets.CommandStore

### tickets.FilesStore
Kind: type · Status: active
One Markdown file per ticket, in a folder of the repository.

#### tickets.FilesStore.adapter
Type: "files"

#### tickets.FilesStore.dir
The folder, relative to the project root. Type: string

### tickets.CommandStore
Kind: type · Status: active
Any tracker, through a program that speaks the list/put protocol.

#### tickets.CommandStore.adapter
Type: "command"

#### tickets.CommandStore.command
A shell command, run from the project root with `list` or `put <ID>` appended. Type: string

### tickets.TrackerList
Kind: type · Status: active
What `<command> list` prints on stdout, as one JSON object.

#### tickets.TrackerList.tickets
Type: tickets.TrackerTicket[]

### tickets.TrackerTicket
Kind: type · Status: active
One ticket as the tracker holds it.

#### tickets.TrackerTicket.id
Type: string

#### tickets.TrackerTicket.text
The whole ticket in the ticket file format. Type: string

### tickets.TrackerPut
Kind: type · Status: active
What `<command> put <ID>` reads on stdin, as one JSON object.

#### tickets.TrackerPut.id
Type: string

#### tickets.TrackerPut.text
The whole new ticket. Type: string

#### tickets.TrackerPut.previous
The text the CLI read, so the tracker can refuse a write when the ticket changed in between; null for a new ticket. Type: string | null

#### tickets.TrackerPut.note
Why: `<ID>: new ticket` for a new one, else a stage or answer note such as "PROP-201 tester: started". Type: string | null

### tickets.TrackerReply
Kind: type · Status: active
What `<command> put <ID>` prints on stdout.

#### tickets.TrackerReply.ok
False refuses the write. Type: bool

#### tickets.TrackerReply.error
Why it refused. Type: string?

### tickets.TicketNew
Kind: operation · Status: active
`spec ticket new [<file.json>] [--dry-run]`: creates a ticket with the next free ID of its type from a tickets.NewTicket, saves it in the store and gates it.
Output: tickets.TicketNewResult | tickets.NotJson | tickets.InvalidTicket | tickets.MissingFile | tickets.StoreRefused | tickets.NotOnBaseBranch | tickets.CommitRefused

#### tickets.TicketNew.file
A JSON file to read the ticket from, relative to the working directory; without it, the JSON is read on stdin. Type: string?

#### tickets.TicketNew.dryRun
`--dry-run`: gate the ticket and save nothing. Type: bool

### tickets.NewTicket
Kind: type · Status: active
The JSON `spec ticket new` reads. Any other key is refused.

#### tickets.NewTicket.type
Type: tickets.TicketType

#### tickets.NewTicket.title
One to 120 characters. Type: string

#### tickets.NewTicket.touches
Type: string[]?

#### tickets.NewTicket.violates
Type: string[]?

#### tickets.NewTicket.depends_on
Type: string[]?

#### tickets.NewTicket.questions
Numbered Q1, Q2, … in order. Type: tickets.NewQuestion[]?

#### tickets.NewTicket.body
Not empty; trimmed. Type: string

### tickets.NewQuestion
Kind: type · Status: active
A question as `spec ticket new` reads it. Any other key is refused.

#### tickets.NewQuestion.kind
Type: tickets.QuestionKind

#### tickets.NewQuestion.text
Type: string

#### tickets.NewQuestion.default
Type: (string | number | bool | null)?

#### tickets.NewQuestion.cites
Type: string[]?

### tickets.TicketNewResult
Kind: type · Status: active
What `spec ticket new --format json` prints.

#### tickets.TicketNewResult.ticket
The new ID. Type: string

#### tickets.TicketNewResult.file
Where the ticket was written, relative to the project root; null for a tracker or a dry run. Type: string | null

#### tickets.TicketNewResult.dryRun
Present, and true, only on a dry run. Type: bool?

#### tickets.TicketNewResult.gate
The gate on the new ticket. Type: tickets.GateResult

### tickets.TicketCombine
Kind: operation · Status: active
`spec ticket combine <INTO> <FROM>...`: folds each FROM into INTO, marks each FROM absorbed, saves them in the store and gates INTO.
Output: tickets.CombineResult | tickets.CombineRefused | tickets.UnknownTicket | cli.UsageError | tickets.StoreRefused | tickets.NotOnBaseBranch | tickets.CommitRefused

#### tickets.TicketCombine.into
The ticket that takes the work over. Type: string

#### tickets.TicketCombine.from
The tickets folded into it, in the order given; at least one. Type: string[]

### tickets.CombineResult
Kind: type · Status: active
What `spec ticket combine --format json` prints.

#### tickets.CombineResult.ticket
INTO. Type: string

#### tickets.CombineResult.absorbed
One entry per FROM, in the order given. Type: tickets.AbsorbedTicket[]

#### tickets.CombineResult.gate
The gate on INTO after the combine. Type: tickets.GateResult

### tickets.TicketClose
Kind: operation · Status: active
`spec ticket close <TICKET> --superseded-by <ID>`: marks an open or blocked ticket absorbed into the ticket that made it redundant, in its file on the base branch, and deletes nothing: it names the worktree, branch and blocked stashes it kept, with the command that removes each.
Output: tickets.CloseResult | tickets.CloseRefused | tickets.UnknownTicket | cli.UsageError | tickets.NotOnBaseBranch | tickets.CommitRefused

#### tickets.TicketClose.ticket
The ticket to retire. Type: string

#### tickets.TicketClose.supersededBy
`--superseded-by`: the ticket whose work made it redundant. Type: string

### tickets.CloseResult
Kind: type · Status: active
What `spec ticket close --format json` prints.

#### tickets.CloseResult.ticket
The ticket closed. Type: string

#### tickets.CloseResult.absorbedInto
The ticket that superseded it. Type: string

#### tickets.CloseResult.worktree
The ticket's worktree, kept; null when it has none. Type: string | null

#### tickets.CloseResult.branch
The ticket's branch, `ticket/<ID>`, kept; null when it has none. Type: string | null

#### tickets.CloseResult.tip
The kept branch's tip, abbreviated; null when it has no branch. Type: string | null

#### tickets.CloseResult.unmerged
How many commits on the kept branch are not on the base branch; 0 when it has no branch. Type: int

#### tickets.CloseResult.stashes
The stashes named "<ID> <role>: blocked" or "<ID> build: blocked", kept. Type: tickets.KeptStash[]

#### tickets.CloseResult.cleanup
The commands a person may run to remove what was kept, in the order the text prints them. Type: string[]

### tickets.KeptStash
Kind: type · Status: active
A blocked stage's stash that `spec ticket close` kept.

#### tickets.KeptStash.name
"<ID> <role>: blocked", or "<ID> build: blocked" for a build stage (PIP-021/R11). Type: string

#### tickets.KeptStash.ref
Its place in `git stash list` when the close ran, such as "stash@{0}". Type: string

#### tickets.KeptStash.commit
Its stash commit, abbreviated. Type: string

### tickets.CloseRefused
Kind: error · Status: active
`spec ticket close` was given a ticket it may not close, or runs where tickets are not files in the project's git repository. Prints each problem on its own line on stderr, exits 1 and changes nothing.

### tickets.AbsorbedTicket
Kind: type · Status: active
What one FROM gave INTO.

#### tickets.AbsorbedTicket.id
The FROM. Type: string

#### tickets.AbsorbedTicket.added
The IDs INTO gained from it in touches, violates and depends_on, in the order added. Type: string[]

#### tickets.AbsorbedTicket.questions
Its open questions, each with the ID it has on INTO. Type: tickets.MovedQuestion[]

### tickets.MovedQuestion
Kind: type · Status: active
An open question that moved to INTO.

#### tickets.MovedQuestion.from
`<FROM>#Q<n>`. Type: string

#### tickets.MovedQuestion.to
`<INTO>#Q<n>`. Type: string

### tickets.TicketAnswer
Kind: operation · Status: active
`spec ticket answer <TICKET> <Q> <text> [--back <role>]`: answers one of the ticket's own questions where its live copy is, and gates it again; with `--back`, also makes an earlier stage the next one.
Output: tickets.AnswerResult | tickets.UnknownTicket | tickets.UnknownQuestion | tickets.UnitQuestion | tickets.BackRefused | pipeline.UnknownRole | cli.UsageError | tickets.StoreRefused

#### tickets.TicketAnswer.ticket
Type: string

#### tickets.TicketAnswer.question
`Q<n>`, or `<TICKET>#Q<n>`. Type: string

#### tickets.TicketAnswer.answer
Every remaining word except the `--back` option and its role, joined by single spaces and trimmed. Type: string

#### tickets.TicketAnswer.back
The role whose stage runs next, one that already ran in the ticket's pipeline. Left out, the blocked stage resumes. Type: pipeline.Role?

### tickets.AnswerResult
Kind: type · Status: active
What `spec ticket answer --format json` prints.

#### tickets.AnswerResult.ticket
Type: string

#### tickets.AnswerResult.question
The question's `Q<n>`. Type: string

#### tickets.AnswerResult.answer
Type: string

#### tickets.AnswerResult.ready
Whether the gate now lets the ticket start. Type: bool

#### tickets.AnswerResult.next
The role whose stage runs next; present only when `--back` was given. Type: pipeline.Role?

### tickets.Gate
Kind: operation · Status: active
`spec gate <TICKET>`: whether the ticket may start, every reason it may not, and how to clear each. Exits 0 when ready, 1 when not.
Output: tickets.GateResult | tickets.UnknownTicket | cli.UsageError

#### tickets.Gate.ticket
Type: string

### tickets.BlockerKind
Kind: type · Status: active
Why a ticket may not start, in the order the gate lists them. Type: "absorbed" | "schema" | "unresolved" | "removed" | "draft" | "question" | "scope_gap" | "dependency"

### tickets.GateResult
Kind: type · Status: active
What `spec gate --format json` prints.

#### tickets.GateResult.ticket
Type: string

#### tickets.GateResult.ready
True when there is no blocker. Type: bool

#### tickets.GateResult.blockers
By kind in tickets.BlockerKind order, then by ID. Type: tickets.GateBlocker[]

#### tickets.GateResult.preferences
Open preferences in scope, by ID. Type: tickets.GatePreference[]

### tickets.GateBlocker
Kind: type · Status: active
One reason the ticket may not start.

#### tickets.GateBlocker.kind
Type: tickets.BlockerKind

#### tickets.GateBlocker.id
What it is about: the ticket, a unit, a module, a question as `<owner>#Q<n>`, or another ticket. Type: string

#### tickets.GateBlocker.text
Type: string

### tickets.GatePreference
Kind: type · Status: active
An open preference in scope: work proceeds on its default.

#### tickets.GatePreference.id
`<owner>#Q<n>`. Type: string

#### tickets.GatePreference.default
Type: string

#### tickets.GatePreference.text
Type: string

### tickets.Queue
Kind: operation · Status: active
`spec queue`: every ticket, grouped as ready, waiting, blocked and in progress, with a count of done ones. Takes no arguments.
Output: tickets.QueueResult | cli.UsageError

### tickets.QueueResult
Kind: type · Status: active
What `spec queue --format json` prints. Each list is in ID order.

#### tickets.QueueResult.spec
The spec version, `spec@<hash>`. Type: string

#### tickets.QueueResult.ready
Type: tickets.QueueEntry[]

#### tickets.QueueResult.waiting
Held only by tickets they depend on. Type: tickets.QueueEntry[]

#### tickets.QueueResult.blocked
Type: tickets.QueueEntry[]

#### tickets.QueueResult.inProgress
Type: tickets.QueueEntry[]

#### tickets.QueueResult.done
How many tickets are done. Type: int

### tickets.QueueEntry
Kind: type · Status: active
One ticket in the queue.

#### tickets.QueueEntry.id
Type: string

#### tickets.QueueEntry.type
The ticket type, or "unknown" for a file that does not parse. Type: string

#### tickets.QueueEntry.title
Type: string

#### tickets.QueueEntry.stage
Ready: the stage to run next. In progress: the running stage. Otherwise null. Type: pipeline.Role | null

#### tickets.QueueEntry.reason
Waiting or blocked: why. Otherwise null. Type: string | null

### tickets.Plan
Kind: operation · Status: active
`spec plan [<TICKET>...]`: which tickets can run at the same time now, which wait and for what, which need a person, and which could be combined. Always exits 0.
Output: tickets.PlanResult | tickets.UnknownTicket

#### tickets.Plan.tickets
The tickets to plan, in priority order. Without any, every ticket not done, in ID order. Type: string[]

### tickets.PlanResult
Kind: type · Status: active
What `spec plan --format json` prints.

#### tickets.PlanResult.spec
The spec version, `spec@<hash>`. Type: string

#### tickets.PlanResult.running
Tickets in progress, always in wave 1. Type: tickets.PlanEntry[]

#### tickets.PlanResult.now
Free to start now, all at once. Type: tickets.PlanEntry[]

#### tickets.PlanResult.later
Waiting for an earlier wave or for a dependency to be merged, by wave then ID. Type: tickets.PlanEntry[]

#### tickets.PlanResult.blocked
Waiting for a person, by ID. Type: tickets.TicketReason[]

#### tickets.PlanResult.together
Tickets that could be combined into one, by first ID: advice that changes no wave. Type: tickets.PlanGroup[]

### tickets.PlanGroup
Kind: type · Status: active
Open, unstarted tickets of one type that share a module and a contract, with a small combined reach.

#### tickets.PlanGroup.ids
The tickets, in ID order. Type: string[]

#### tickets.PlanGroup.type
Type: tickets.TicketType

#### tickets.PlanGroup.module
The module they share. Type: string

#### tickets.PlanGroup.contract
The contract they share. Type: string

#### tickets.PlanGroup.reach
How many distinct scenarios their impact gives to re-verify; a ticket whose re-verify list is empty counts the scenarios of the features it works on. Type: int

#### tickets.PlanGroup.command
The command that combines them, `spec ticket combine <ID> <ID>...`. Type: string

### tickets.PlanEntry
Kind: type · Status: active
One ticket in the plan.

#### tickets.PlanEntry.id
Type: string

#### tickets.PlanEntry.type
Type: tickets.TicketType

#### tickets.PlanEntry.title
Type: string

#### tickets.PlanEntry.stage
Running: the stage in progress. Otherwise the next stage. Type: pipeline.Role | null

#### tickets.PlanEntry.wave
1 is now; each later wave starts once the earlier ones land. Type: int

#### tickets.PlanEntry.after
The tickets it waits for, each with why. Type: tickets.TicketReason[]

### tickets.TicketReason
Kind: type · Status: active
A ticket and a reason.

#### tickets.TicketReason.id
Type: string

#### tickets.TicketReason.reason
Type: string

### tickets.UnknownTicket
Kind: error · Status: active
The argument is not a ticket ID, or no ticket in the store has it. Prints `Unknown <ID>.`, then ` Did you mean <closest>?` when a ticket ID is close, then the usage text, on stderr, and exits 2.

### tickets.NotJson
Kind: error · Status: active
`spec ticket new` got input that is not JSON. Prints `spec ticket new reads the ticket as JSON on stdin: ` (or `from <file>: ` when tickets.TicketNew.file is given), the keys of tickets.NewTicket in braces, a blank line and the usage text, and exits 2.

### tickets.InvalidTicket
Kind: error · Status: active
`spec ticket new` got JSON that is not a valid ticket. Prints `the ticket is not valid: ` and each problem, joined by "; ", and exits 1.

### tickets.MissingFile
Kind: error · Status: active
The JSON file passed to `spec ticket new` does not exist. Prints `<path> does not exist` and exits 1.

### tickets.UnknownQuestion
Kind: error · Status: active
The ticket has no question with that ID. Exits 1.

### tickets.BackRefused
Kind: error · Status: active
`--back` names a role that has no finished stage in the ticket's history, or the ticket has a stage running. Prints why on stderr, exits 1 and changes nothing.

### tickets.UnitQuestion
Kind: error · Status: active
The question belongs to a spec unit, not to the ticket. Exits 1.

### tickets.StoreRefused
Kind: error · Status: active
The store did not save the ticket: the ID is taken, the tracker refused, or the tickets command failed. Prints why on stderr, exits 1 and changes nothing.

### tickets.NotOnBaseBranch
Kind: error · Status: active
`spec ticket new`, `spec ticket combine` or `spec ticket close` with the files store ran in a tree whose current branch is not format.Config.baseBranch, such as a ticket's worktree. Prints `file tickets from <base>: run spec ticket <new, combine or close> in <the tree that has it checked out>; nothing was saved` (or `check out <base> first` when no tree has), exits 1 and writes nothing.

### tickets.CommitRefused
Kind: error · Status: active
git refused to stage or commit the ticket files `spec ticket new`, `spec ticket combine` or `spec ticket close` wrote. Prints `git could not commit <files, joined by ", ">: <git's first lines>; nothing was saved`, exits 1, removes a file it created and puts back each file it changed.

### tickets.CombineRefused
Kind: error · Status: active
`spec ticket combine` was given tickets it may not combine. Prints each problem on its own line on stderr, exits 1 and changes nothing.
