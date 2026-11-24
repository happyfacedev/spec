# pipeline contracts: spec stats

### pipeline.Stats
Kind: operation · Status: active
`spec stats [<TICKET>...] [--since <date>]`: how many stages each ticket took against the fewest its type needs, how often they blocked, were reopened or had a report refused, how many questions a person answered, the verdicts of each review in order and the findings per class, with totals; each ticket's recorded time; and per role, its stages, their total and median recorded time and their total recorded cost. A recorded time is elapsed time from a stage's start to its recording, waiting for a test-run turn included (PIP-020/R8). It reads tickets.Ticket.history and tickets.Ticket.questions and changes nothing. Exits 0.
Output: pipeline.StatsResult | tickets.UnknownTicket | cli.UsageError

#### pipeline.Stats.tickets
The tickets to measure. Without any, every ticket whose history has at least one entry. Type: string[]

#### pipeline.Stats.since
`--since <date>`, as YYYY-MM-DD: keep only tickets whose first history entry was recorded on or after that day (UTC). Type: date?

### pipeline.StatsResult
Kind: type · Status: active
What `spec stats --format json` prints.

#### pipeline.StatsResult.spec
The spec version, `spec@<hash>`. Type: string

#### pipeline.StatsResult.tickets
One entry per ticket measured, in ID order. Type: pipeline.TicketStats[]

#### pipeline.StatsResult.totals
Across those tickets. Type: pipeline.StatsTotals

#### pipeline.StatsResult.roles
Across those tickets, one entry per role with at least one stage, in the order "spec-writer", "spec-review", "tester", "implementer", "reviewer"; [] when no ticket measured has a stage (PIP-020/R7). Type: pipeline.RoleStats[]

### pipeline.RoleStats
Kind: type · Status: active
One role's stages across the tickets measured, read from their pipeline.StageRecord.duration_s and pipeline.StageRecord.cost_usd. Nothing is estimated: a stage with no recorded duration or cost adds nothing to that sum (PIP-020/R7).

#### pipeline.RoleStats.role
Type: pipeline.Role

#### pipeline.RoleStats.stages
The role's stages: history entries whose result is done or blocked. Type: int

#### pipeline.RoleStats.duration_s
The sum of the recorded durations, in seconds: elapsed time from each stage's start to its recording, waiting for a test-run turn included and not subtracted (PIP-009); null when none of the stages has one. Type: int | null

#### pipeline.RoleStats.median_s
The median of the recorded durations, in seconds: the middle one, or for an even count the mean of the two middle ones rounded down to a whole second; null when none of the stages has one. Type: int | null

#### pipeline.RoleStats.timed
How many of the stages have a recorded duration. Type: int

#### pipeline.RoleStats.cost_usd
The sum of the recorded costs, in US dollars, not rounded, added in ticket ID order and then history order; null when none of the stages has one. Type: number | null

#### pipeline.RoleStats.costed
How many of the stages have a recorded cost. Type: int

### pipeline.TicketStats
Kind: type · Status: active
One ticket's measures, read from its history and questions.

#### pipeline.TicketStats.id
Type: string

#### pipeline.TicketStats.type
Type: tickets.TicketType

#### pipeline.TicketStats.stages
How many stages ran: history entries whose result is done or blocked. A "reopened" entry is not a stage. Type: int

#### pipeline.TicketStats.duration_s
The sum of pipeline.StageRecord.duration_s over the ticket's stages that have one, in seconds: elapsed time, waiting for a test-run turn included; null when none has (PIP-020/R8). Type: int | null

#### pipeline.TicketStats.timed
How many of the ticket's stages have a recorded duration (PIP-020/R8). Type: int

#### pipeline.TicketStats.minimum
The fewest stages the ticket's type needs: 5 for a proposal, 3 for a bug, 2 for a task; 4 for a proposal whose history holds a done tester stage and no spec-review stage, as one recorded before the spec review existed. A proposal whose history still runs the docs or the tests lane has 3 and one that still runs the build lane 4, whatever else its history holds; one that has left its light lane has 5 (PIP-020/R2). Type: int

#### pipeline.TicketStats.rounds
Stages run per role, keyed by role, holding only roles that ran. Type: map<string, int>

#### pipeline.TicketStats.blocked
History entries whose result is blocked, an invalid report among them. Type: int

#### pipeline.TicketStats.reopened
History entries whose result is "reopened", one per `spec ticket answer --back`. Type: int

#### pipeline.TicketStats.refusals
The sum of pipeline.StageRecord.refusals over the history. Type: int

#### pipeline.TicketStats.answered
The ticket's questions that have an answer. Type: int

#### pipeline.TicketStats.specReview
The verdicts of the spec-review stages, oldest first. Type: pipeline.Verdict[]

#### pipeline.TicketStats.review
The verdicts of the reviewer stages, oldest first. Type: pipeline.Verdict[]

#### pipeline.TicketStats.findings
Findings of both reviews, counted per class: keys in class order, only those with a count, then "unclassified" for findings with no class or one outside pipeline.FindingClass. Type: map<string, int>

### pipeline.StatsTotals
Kind: type · Status: active
Sums and means over the tickets measured.

#### pipeline.StatsTotals.tickets
Type: int

#### pipeline.StatsTotals.stages
Type: int

#### pipeline.StatsTotals.minimum
Type: int

#### pipeline.StatsTotals.blocked
Type: int

#### pipeline.StatsTotals.reopened
Type: int

#### pipeline.StatsTotals.refusals
Type: int

#### pipeline.StatsTotals.answered
Type: int

#### pipeline.StatsTotals.specReview
The spec review's rounds. Type: pipeline.RoundStats

#### pipeline.StatsTotals.review
The reviewer's rounds. Type: pipeline.RoundStats

#### pipeline.StatsTotals.findings
Summed as in pipeline.TicketStats.findings. Type: map<string, int>

### pipeline.RoundStats
Kind: type · Status: active
How many rounds one review took to approve, over the tickets it approved, read from each ticket's whole verdict sequence for that review.

#### pipeline.RoundStats.approved
Tickets whose latest verdict for this review is "approve". Type: int

#### pipeline.RoundStats.meanRounds
Over those tickets, the mean count of all their verdicts for this review; null when none approved. Type: number | null

#### pipeline.RoundStats.firstRound
The share of those tickets, from 0 to 1, whose only verdict for this review is "approve"; null when none approved. Type: number | null
