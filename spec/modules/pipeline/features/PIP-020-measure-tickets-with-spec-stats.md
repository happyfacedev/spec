---
id: PIP-020
title: Measure each ticket's stages with spec stats
module: pipeline
status: active
provides: [pipeline.Stats]
invariants: [INV-017]
---
## Intent
The process is improved from numbers the tool produces, not from memory. `spec stats` reads each ticket's history and questions and shows where it churned: how many stages ran against the fewest its type needs, how often a stage blocked, was reopened or had its report refused, how many questions a person answered, each review's verdicts in order, and the findings per class. A clean proposal takes 5 stages, 4 in the build lane, or 3 in another light lane; a churned one takes many more, and the columns say why. Totals give the mean rounds each review took to approve and the share approved in one round. Each ticket shows the time its stages took, and each role its stages, their total and median time and their total cost, from what the records hold. A time is elapsed time from a stage's start to its recording: waiting for a test-run turn (PIP-009) is in it and cannot be told apart, so a long time may be a wait and not work. A stage whose record has no duration or no cost adds none, and the "timed" and "costed" counts say how many stages a sum is from, so nothing is estimated. It changes nothing.

## Behaviour
### S1: One row per ticket, then the totals
Given "PROP-201" whose tickets.Ticket.history holds, in order: done "spec-writer"; "spec-review" verdict "changes" with findings of class "C1" and "C4"; done "spec-writer"; "spec-review" verdict "approve"; done "tester"; "implementer" blocked; a "tester" entry with result "reopened"; done "tester"; done "implementer" with pipeline.StageRecord.refusals 1; "reviewer" verdict "changes" with one finding of class "C1"; done "implementer"; "reviewer" verdict "approve"
And "PROP-201" has two tickets.Question with an answer and one without
And "BUG-301" whose history is done "tester", done "implementer", "reviewer" verdict "approve" with no findings, and which has no questions
When the developer runs "spec stats" through pipeline.Stats
Then stdout is a table with the columns "ticket", "stages", "time", "timed", "blocked", "reopened", "refused", "answered", "spec review", "review" and "findings", aligned, and one row per ticket in ID order (R1, R2, R8)
And the "BUG-301" row reads "BUG-301", "3/3", "-", "0/3", "0", "0", "0", "0", "-", "approve", "-": none of its records holds a pipeline.StageRecord.duration_s (R2, R3, R8)
And the "PROP-201" row reads "PROP-201", "11/5", "-", "0/11", "1", "1", "1", "2", "changes, approve", "changes, approve", "C1 2, C4 1" (R2, R3, R4, R8)
And then the lines "total: 2 tickets, 14 stages for a minimum of 8, 1 blocked, 1 reopened, 1 refused, 2 answered", "spec review: 2.0 rounds to approve, 0% approved in one round (1 ticket)", "review: 1.5 rounds to approve, 50% approved in one round (2 tickets)" and "findings: C1 2, C4 1" (R5)
And then, after a blank line, the role table with rows "spec-writer" with 2 stages, "spec-review" with 2, "tester" with 3, "implementer" with 4 and "reviewer" with 3, in that order, each with "-" for time, median and cost and "0/<stages>" for timed and costed (R7)
And the exit code is 0, and no file changes

### S2: JSON output
Given the tickets of S1
When the developer runs "spec stats PROP-201 --format json" through pipeline.Stats
Then stdout is one pipeline.StatsResult whose pipeline.StatsResult.tickets is one pipeline.TicketStats: {"id": "PROP-201", "type": "proposal", "stages": 11, "minimum": 5, "rounds": {"spec-writer": 2, "spec-review": 2, "tester": 2, "implementer": 3, "reviewer": 2}, "blocked": 1, "reopened": 1, "refusals": 1, "answered": 2, "specReview": ["changes", "approve"], "review": ["changes", "approve"], "findings": {"C1": 2, "C4": 1}, "duration_s": null, "timed": 0} (R2, R3, R4, R8)
And pipeline.StatsResult.roles holds one pipeline.RoleStats per role that ran, in the order of R7, the "implementer" one {"role": "implementer", "stages": 3, "duration_s": null, "median_s": null, "timed": 0, "cost_usd": null, "costed": 0} (R7)
And pipeline.StatsResult.totals has pipeline.StatsTotals.specReview {"approved": 1, "meanRounds": 2, "firstRound": 0} and pipeline.StatsTotals.review {"approved": 1, "meanRounds": 2, "firstRound": 0} (R5)
And with no ticket approved by a review, its pipeline.RoundStats is {"approved": 0, "meanRounds": null, "firstRound": null}, and the text line reads "review: no ticket approved yet" (R5)

### S3: Which tickets are measured
Given "PROP-201" and "BUG-301" of S1, whose first history entries were recorded on "2026-10-20" and "2026-10-30", "TASK-101" with an empty history, and "PROP-202" whose "tester" stage is running after a done "spec-writer" recorded on "2026-10-31" and an approving "spec-review"
When the developer runs "spec stats" through pipeline.Stats
Then the rows are "BUG-301", "PROP-201" and "PROP-202", and not "TASK-101" (R1)
And "PROP-202" shows "2/5": the running stage is not counted, and running "spec stats" again once it is recorded counts it (R1, R2)
And "spec stats --since 2026-10-30" shows only "BUG-301" and "PROP-202"
And "spec stats TASK-101" shows the row "TASK-101", "0/2", "-", "0/0", then the totals lines, and stdout ends with the line "findings: none": with no stage there is no role table and no blank line after the totals; with "--format json" pipeline.StatsResult.roles is [] (R1, R7, R9)
And when no ticket is left, stdout is "no tickets with a recorded stage" and the exit code is 0, and with "--format json" pipeline.StatsResult.tickets is [] and pipeline.StatsResult.roles is [] (R1, R7)

### S4: A history recorded by an earlier version
Given "PROP-205" whose history, recorded before the spec review and finding classes existed, is done "spec-writer", done "tester", done "implementer", then "reviewer" verdict "changes" with one finding that has no class, done "implementer" and "reviewer" verdict "approve"
When the developer runs "spec stats PROP-205" through pipeline.Stats
Then its row reads "PROP-205", "6/4", "-", "0/6", "0", "0", "0", "0", "-", "changes, approve", "unclassified 1": none of its records holds a duration (R3, R4, R8)
And a finding whose class is "C10", as a hand-edited history may hold, is counted as "unclassified" too (R4)

### S5: A wrong command line
Given any spec
When the developer runs "spec stats PROP-999" through pipeline.Stats, where no ticket has that ID
Then it fails with tickets.UnknownTicket: stderr starts "Unknown PROP-999." and the exit code is 2 (R6)
And "spec stats --since yesterday" fails with cli.UsageError: stderr starts "--since is a date as YYYY-MM-DD, not yesterday" and the exit code is 2 (R6)
And "spec stats --since 2026-02-30" fails the same way, as no such day exists (R6)

### S6: A review that ran again after approving counts every round
Given "PROP-203" whose spec-review verdicts are "approve", "changes", "approve", because a reviewer finding marked spec sent it back through the spec-writer and spec review after its first approval (PIP-001/S14), and whose reviewer verdicts are "changes", "approve"
And "PROP-204" whose spec-review verdicts are "approve", "changes", now back with the spec-writer, and which has no reviewer verdict
When the developer runs "spec stats PROP-203 PROP-204 --format json" through pipeline.Stats
Then pipeline.StatsTotals.specReview is {"approved": 1, "meanRounds": 3, "firstRound": 0}: "PROP-203" took 3 rounds and not 1, and "PROP-204", whose latest verdict is "changes", is not approved (R5)
And pipeline.StatsTotals.review is {"approved": 1, "meanRounds": 2, "firstRound": 0} (R5)
And in text the lines read "spec review: 3.0 rounds to approve, 0% approved in one round (1 ticket)" and "review: 2.0 rounds to approve, 0% approved in one round (1 ticket)" (R5)

### S7: A proposal in a light lane
Given "PROP-210" whose history is a done "spec-writer" with pipeline.StageRecord.lane "docs", "spec-review" verdict "approve" and "reviewer" verdict "approve"
And "PROP-211" whose history is a done "spec-writer" with pipeline.StageRecord.lane "tests", a done "tester" and "reviewer" verdict "approve"
And "PROP-212" whose history is a done "spec-writer" with pipeline.StageRecord.lane "docs", then a done "spec-writer" with pipeline.StageRecord.lane "full" after a spec review's "changes", and nothing after
When the developer runs "spec stats PROP-210 PROP-211 PROP-212 --format json" through pipeline.Stats
Then pipeline.TicketStats.minimum is 3 for "PROP-210" and for "PROP-211", and 5 for "PROP-212" (R2)
And in text the rows of "PROP-210" and "PROP-211" show "3/3" (R2)
And for "PROP-215", whose history is a done "spec-writer" with pipeline.StageRecord.lane "build", "spec-review" verdict "approve", a done "implementer" and "reviewer" verdict "approve", pipeline.TicketStats.minimum is 4 and the row shows "4/4"; with pipeline.StageRecord.lane "full" on its "implementer" record the minimum is 5 (R2)

### S8: Time per ticket, and stages, time and cost per role
Given "PROP-220" whose history is, in order: done "spec-writer" with pipeline.StageRecord.duration_s 600, pipeline.StageRecord.model "claude-opus-5-5" and pipeline.StageRecord.cost_usd 1.25; "spec-review" verdict "approve" with duration_s 300; done "tester" with duration_s 1800 and cost_usd 0.5; blocked "implementer" with duration_s 1000; done "implementer" with duration_s 2001; "reviewer" verdict "approve" with duration_s 400
And "TASK-120" whose history is a done "implementer" recorded by an earlier version, with no duration_s, then "reviewer" verdict "approve" with duration_s 3600 and cost_usd 0.25
When the developer runs "spec stats PROP-220 TASK-120" through pipeline.Stats
Then the "PROP-220" row's time and timed cells are "1:41:41" and "6/6", and the "TASK-120" row's are "1:00:00" and "1/2" (R8)
And the role table after the totals has the columns "role", "stages", "time", "median", "timed", "cost" and "costed", and its rows read: "spec-writer", "1", "0:10:00", "0:10:00", "1/1", "$1.25", "1/1"; "spec-review", "1", "0:05:00", "0:05:00", "1/1", "-", "0/1"; "tester", "1", "0:30:00", "0:30:00", "1/1", "$0.50", "1/1"; "implementer", "3", "0:50:01", "0:25:00", "2/3", "-", "0/3"; "reviewer", "2", "1:06:40", "0:33:20", "2/2", "$0.25", "1/2" (R7)
And the "implementer" median is that of 1000 and 2001 alone, rounded down, and its time leaves out the stage with no duration_s, which its timed "2/3" shows: nothing is estimated (R7)
And with "--format json", pipeline.TicketStats.duration_s and pipeline.TicketStats.timed are 6101 and 6 for "PROP-220" and 3600 and 1 for "TASK-120", and pipeline.StatsResult.roles ends with {"role": "implementer", "stages": 3, "duration_s": 3001, "median_s": 1500, "timed": 2, "cost_usd": null, "costed": 0} and {"role": "reviewer", "stages": 2, "duration_s": 4000, "median_s": 2000, "timed": 2, "cost_usd": 0.25, "costed": 1} (R7, R8)
And "spec stats TASK-120" has a role table of only "implementer", "1", "-", "-", "0/1", "-", "0/1" and "reviewer", "1", "1:00:00", "1:00:00", "1/1", "$0.25", "1/1": the roles are counted over the tickets measured (R1, R7)

### S9: Waiting time is in the time, and cost is rounded only in text
Given "PROP-230" whose history is, in order: done "spec-writer" with pipeline.StageRecord.duration_s 300 and pipeline.StageRecord.cost_usd 0.1; "spec-review" verdict "changes" with duration_s 60; done "spec-writer" with duration_s 240 and cost_usd 0.2; "spec-review" verdict "approve" with duration_s 60; done "tester" with duration_s 2400 and cost_usd 0.125, whose recording waited 15 minutes for a test-run turn (PIP-025/S6)
When the developer runs "spec stats PROP-230" through pipeline.Stats
Then the "PROP-230" row's time and timed cells are "0:51:00" and "5/5": the tester's 2400 seconds count whole, the wait included and not subtracted (R8)
And the role rows read: "spec-writer", "2", "0:09:00", "0:04:30", "2/2", "$0.30", "2/2"; "spec-review", "2", "0:02:00", "0:01:00", "2/2", "-", "0/2"; "tester", "1", "0:40:00", "0:40:00", "1/1", "$0.13", "1/1": a cost exactly halfway between two cents is rounded up (R7, R9)
And with "--format json", the "spec-writer" pipeline.RoleStats.cost_usd is 0.30000000000000004, the unrounded sum of 0.1 then 0.2, and the "tester" one is 0.125 (R9)
And for "PROP-232", whose history is a done "spec-writer" with cost_usd 1.005, a done "tester" with cost_usd 2.675 and a done "implementer" with cost_usd 0.004999, "spec stats PROP-232" shows the costs "$1.01", "$2.68" and "$0.00" in those role rows: the rounding reads the sum's shortest decimal text, as JSON writes it, not the nearest binary value (R9)

### S10: A record with a cost, duration or model out of bounds is not measured
Given "PROP-220" of S8, and "tickets/PROP-231.md" whose history holds a done "tester" with pipeline.StageRecord.cost_usd -1, 1000000, 1e308, the text "0.42" or ".inf", with pipeline.StageRecord.duration_s 1.5 or -5, or with pipeline.StageRecord.model "" or "claude" followed by U+2028
When the developer runs "spec lint", then "spec stats --format json" through pipeline.Stats
Then lint reports an L020 error for "tickets/PROP-231.md" (TKT-001) (R9)
And "spec stats PROP-231" fails with tickets.UnknownTicket (R6, R9)
And pipeline.StatsResult.tickets holds no entry for "PROP-231", and pipeline.StatsResult.roles holds only "PROP-220"'s stages: its "tester" one is {"role": "tester", "stages": 1, "duration_s": 1800, "median_s": 1800, "timed": 1, "cost_usd": 0.5, "costed": 1} (R7, R9, INV-017)

## Rules
- R1: Without ticket IDs, every ticket whose history has at least one entry is measured; with IDs, those tickets, even with an empty history. `--since <date>` then keeps only tickets whose first history entry was recorded on or after that day, in UTC. Only recorded stages count: a running stage is not in the history yet. Rows are in ID order.
- R2: Stages are the history entries whose result is done or blocked; the table shows them as "<stages>/<minimum>", where the minimum is 5 for a proposal, 3 for a bug and 2 for a task, and 4 for a proposal whose history holds a done tester stage and no spec-review stage. A proposal whose history still runs a light lane (PIP-021/R2, R3) has the minimum 3 in the docs or the tests lane and 4 in the build lane, which comes before the other rule of 4; one that has left its light lane has the minimum 5.
- R3: Blocked counts entries whose result is blocked; reopened counts "reopened" entries; refused sums pipeline.StageRecord.refusals; answered counts the ticket's questions with an answer. Each review's cell is its verdicts in order, joined by ", ", or "-" when it has none.
- R4: The findings cell counts the findings of both reviews per class, as "<class> <count>" joined by ", ", in class order (C1 to C9, other, then unclassified), or "-" when there are none. A finding with no class, or one outside pipeline.FindingClass, is "unclassified".
- R5: The totals lines follow the table: "total: <n> tickets, <stages> stages for a minimum of <minimum>, <blocked> blocked, <reopened> reopened, <refused> refused, <answered> answered"; then, for the spec review and for the reviewer, "<mean> rounds to approve, <share>% approved in one round (<n> ticket|tickets)" over the tickets that review approved, the mean with one decimal and the share a whole percent, or "no ticket approved yet"; then "findings: " with the summed counts as in R4, or "none". Each is read from a review's whole verdict sequence: a ticket is approved by that review when its latest verdict is "approve"; its rounds are all its verdicts; it is approved in one round when it has exactly one verdict and that is "approve". A ticket whose latest verdict is "changes" counts in none of the three.
- R6: An ID no ticket has is refused with tickets.UnknownTicket, and a `--since` that is not a real day written YYYY-MM-DD with cli.UsageError, each with exit 2, before anything is printed on stdout.
- R7: When at least one ticket measured has a stage, the totals lines are followed by a blank line and a table of roles with the columns "role", "stages", "time", "median", "timed", "cost" and "costed", aligned, one row per role with at least one stage among the tickets measured, in the order "spec-writer", "spec-review", "tester", "implementer", "reviewer". Stages counts the role's stages as R2 does. Time is the sum of their pipeline.StageRecord.duration_s, and median the median of those durations (the middle one, or for an even count the mean of the two middle ones rounded down to a whole second), each over the stages that hold one, or "-" when none does; timed is "<stages with a duration>/<stages>". Cost is the sum of their pipeline.StageRecord.cost_usd, over the stages that hold one, as R9 writes it, or "-" when none does; costed is "<stages with a cost>/<stages>". A stage with no recorded duration or cost adds nothing: nothing is estimated. A duration is written "<hours>:<mm>:<ss>", the hours not padded. JSON holds each row as a pipeline.RoleStats in pipeline.StatsResult.roles.
- R8: Each ticket's row has a "time" cell and a "timed" cell after its stages cell: the sum of pipeline.StageRecord.duration_s over its stages that hold one, written as in R7, or "-" when none does, and "<stages with a duration>/<stages>"; pipeline.TicketStats.duration_s holds the sum in seconds, or null, and pipeline.TicketStats.timed the count. A duration is elapsed time from the stage's start to its recording (PIP-008/R8): a wait for a test-run turn is in it, never subtracted.
- R9: Only values a ticket file may hold are measured: a record's duration_s is a whole number, 0 or more, its cost_usd a finite number, 0 or more and below 1000000, and its model 1 to 100 printable ASCII characters (PIP-025/R3); a ticket file that holds anything else there fails lint with an L020 error (TKT-001) and is not measured at all; `spec queue` still lists it as a file that does not parse, as for any other schema error (TKT-010/S7). A cost is written "$<amount>" with two decimals: the sum's shortest decimal text, the one JSON writes for it, rounded to cents, a third decimal of 5 or more rounding up. JSON holds the unrounded sum, added in ticket ID order and then history order; with each cost below 1000000 the sum stays finite. A ticket measured with no stage leaves the role table out, its blank line too.

## Out of scope
- How a stage is recorded, its duration (PIP-008), its model and cost (PIP-025)
- How a refused report is counted: PIP-018
- Which class a finding has: the review that gives it (PIP-004, PIP-017)
