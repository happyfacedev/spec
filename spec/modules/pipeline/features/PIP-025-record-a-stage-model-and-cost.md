---
id: PIP-025
title: Record which model ran a stage and what it cost
module: pipeline
status: active
writes: [tickets.Ticket.history]
invariants: [INV-017]
---
## Intent
Every recorded stage should say which model ran it and, where the harness reports one, what it cost, so the project can measure what a ticket costs and compare models (PIP-020). A harness such as Astro has no transcript to pass, so `spec ticket advance` also records the model `spec next` chose when it started the stage (CLI-007/R17). A transcript's model wins, because it says what actually ran. The cost comes from the transcript alone: nothing is estimated. Both are data a person reads, never inputs to a decision, and any local process can forge them, so what is recorded is bounded (INV-017).

## Behaviour
### S1: The model next chose is recorded without a transcript
Given "BUG-301"'s "tester" stage was started by "spec next BUG-301", whose cli.Next.model was "claude-opus-5-5", so "spec/stages/BUG-301.json" in the repository's common git directory holds "stage" "tester", its "started" time, "model" "claude-opus-5-5" and "entries" 0, the number of entries tickets.Ticket.history held at the start
When the main session records the stage by running its cli.Next.advance, through pipeline.AdvanceTicket, with no transcript given or kept by the finish hook
Then tickets.Ticket.history ends with a pipeline.StageRecord with pipeline.StageRecord.model "claude-opus-5-5" and no pipeline.StageRecord.cost_usd: nothing estimates one (R1)
And "spec/stages/BUG-301.json" no longer holds a "model" or "entries", and still holds "stage" "tester" and its "started" time (R2)
And for a report refused by its checks, which records a blocked stage and commits nothing (PIP-008/R4), "spec/stages/BUG-301.json" no longer holds a "model" either (R2)
And the same holds when the report is blocked, is an implementer's hand-off to the tester (PIP-008/R13), or is refused by its checks (R1, R2)
And when "spec ticket start BUG-301 tester" through pipeline.StartStage ran while the stage was running, which changes nothing (PIP-002/S3), the record still has pipeline.StageRecord.model "claude-opus-5-5" (R2)

### S2: A transcript's model wins
Given the "BUG-301" stage of S1, and the transcript "/home/dev/.claude/agent-a1.jsonl" reports model "claude-sonnet-5-5" and cost 0.42 US dollars
When the developer runs "spec ticket advance BUG-301 --transcript /home/dev/.claude/agent-a1.jsonl" through pipeline.AdvanceTicket with pipeline.AdvanceTicket.transcript
Then the new pipeline.StageRecord has pipeline.StageRecord.model "claude-sonnet-5-5" and pipeline.StageRecord.cost_usd 0.42 (R1)
And with a transcript that reports a cost of 0.42 and no model, the record has pipeline.StageRecord.model "claude-opus-5-5" and pipeline.StageRecord.cost_usd 0.42 (R1)
And with a transcript that reports neither, the record has pipeline.StageRecord.model "claude-opus-5-5" and no pipeline.StageRecord.cost_usd (R1)
And the transcript the finish hook kept with the stored report counts as one given with "--transcript" (R1)

### S3: A remembered model belongs to one stage
Given the "tester" stage of "BUG-301" was started by "spec next BUG-301" with cli.Next.model "claude-opus-5-5" and was recorded through pipeline.AdvanceTicket
When its "implementer" stage is started by "spec ticket start BUG-301 implementer" through pipeline.StartStage, then recorded with no transcript
Then the implementer's pipeline.StageRecord has no pipeline.StageRecord.model (R2)
And the same holds when that start was made by an earlier version of spec, whether it writes "spec/stages/BUG-301.json" without a "model" or does not write it at all (R2)
And the same holds when the stage started that way is a second "tester" stage: the first one's model was forgotten when it was recorded (R2)
And when "spec/stages/BUG-301.json" holds "stage" "implementer" and a "model" but "entries" 0 while tickets.Ticket.history now holds 1 entry, or no "entries" at all, no model is recorded from it, whatever its "started" time says (R2)

### S4: A recording that does not happen keeps the remembered model
Given the "BUG-301" stage of S1
When "spec ticket advance BUG-301" through pipeline.AdvanceTicket fails with pipeline.NoReport or with pipeline.CheckCouldNotRun, or refuses the report at intake with attempts left (PIP-018)
Then the stage is still running and "spec/stages/BUG-301.json" still holds "model" "claude-opus-5-5" and "entries" 0 (R2)
And when its report is recorded later with no transcript, the record has pipeline.StageRecord.model "claude-opus-5-5" (R2)

### S5: Only a bounded model and a plain cost are recorded
Given the "BUG-301" stage of S1, recorded through pipeline.AdvanceTicket with a transcript
When the transcript's model is "", 101 printable ASCII characters, "claude opus" followed by a line break, a tab, U+007F or U+0085, "claude" followed by U+2028 or U+202E, "claude-opüs", or "e" followed by 200000 times U+0301 (one grapheme, 200001 code points)
Then the record has pipeline.StageRecord.model "claude-opus-5-5": the transcript names no model that can be recorded (R1, R3, INV-017)
And a model of exactly 100 printable ASCII characters, spaces among them, is recorded as it is (R3)
And a transcript cost of -1, of 1e400 (which is not finite), of 1000000, or of the text "0.42" gives no pipeline.StageRecord.cost_usd, and costs of 0 and 999999.99 are recorded as they are (R3, INV-017)
And when "spec/stages/BUG-301.json" holds a "model" outside R3, as a configured model "claude-opüs" or a hand-edited file would, and no transcript names a model, the record has no pipeline.StageRecord.model, and "spec next" does not write such a configured model into the file (R3, CLI-007/R17)

### S6: Time spent waiting for a test-run turn is in the duration
Given "BUG-301"'s "implementer" stage started at "2026-10-27T12:00:00.000Z"
And a live process of another ticket holds the repository's test-run turn (PIP-009), and gives it up only when the test releases it, on an event and not after a set time
And the one clock the CLI reads, for the stage and for the wait alike, shows "2026-10-27T12:16:00.000Z" when advance begins, moves on by 15 minutes while the turn is held, so it reads "2026-10-27T12:31:00.000Z" when the turn is released, and reads "2026-10-27T12:40:00.000Z" when the stage is recorded
When "spec ticket advance BUG-301" through pipeline.AdvanceTicket begins, waits until the turn is released, then runs the tests and records the stage
Then the test command did not start before the turn was released, and the new pipeline.StageRecord has pipeline.StageRecord.duration_s 2400, the seconds from the start to the recording: the 15 minutes of waiting are included, so a build that subtracted the wait it measured would record 1500 (PIP-008/R8, INV-017)
And "spec stats BUG-301" through pipeline.Stats shows that stage's 2400 seconds in the ticket's time and the implementer's time, as "0:40:00" (PIP-020/R8)

### S7: A commit refused after the ticket was updated leaves a model nothing records
Given "PROP-201"'s history holds one done "spec-writer" entry, and its "spec-review" stage was started by "spec next PROP-201", whose cli.Next.model was "worker-review", so "spec/stages/PROP-201.json" holds "stage" "spec-review", "model" "worker-review" and "entries" 1
And the spec review's done report has verdict "approve" and the stage changed nothing outside the tickets folder, and the repository's pre-commit hook prints "commits are closed" and exits 1
When the main session runs "spec ticket advance PROP-201" through pipeline.AdvanceTicket
Then it fails with pipeline.RecordFailed: stderr is "git commit failed: commits are closed" and the exit code is 1, after the ticket was already updated (PIP-008/S18): "tickets/PROP-201.md" holds tickets.Ticket.status "open", tickets.Ticket.stage null and 2 history entries, the last the spec review's
And "spec/stages/PROP-201.json" still holds "stage" "spec-review", "model" "worker-review" and "entries" 1, one short of the history (R2)
And "spec ticket start PROP-201 tester" through pipeline.StartStage is accepted, as the tree's only change is in the tickets folder (PIP-002/R3), and writes the record anew with "stage" "tester" and no "model"; the tester stage, recorded with no transcript once the hook lets commits through, has no pipeline.StageRecord.model (R2)

## Rules
- R1: A recorded stage's pipeline.StageRecord.model is the model the role's transcript reports, given with `--transcript` or kept by the finish hook with the stored report, when R3 lets it be recorded; else the model remembered for this stage (R2), when R3 lets it be recorded; else it has none. Its pipeline.StageRecord.cost_usd is the cost the transcript reports, when R3 lets it be recorded, and nothing else: never an estimate. This holds for every recorded stage, done, blocked, handed off or refused by its checks.
- R2: The stage start record is "spec/stages/<ID>.json" in the repository's common git directory, a JSON object with "stage" (the role) and "started" (an ISO time), which every start of a stage writes anew, except a start that changes nothing (PIP-002/S3). `spec next` adds "model" to it, with "entries", the number of entries tickets.Ticket.history holds at the start, when it starts a stage with a model R3 lets it record (CLI-007/R17); nothing else adds one. Recording a stage uses that model only when the record's "stage" is the role being recorded and its "entries" equals the number of entries tickets.Ticket.history holds before this recording; no clock decides it. Every recording of the stage, by R1's cases, removes "model" and "entries" from the record and leaves "stage" and "started" as they were; a command that records nothing (pipeline.NoReport, pipeline.CheckCouldNotRun, a report refused at intake with attempts left) keeps them. A recording that fails with pipeline.RecordFailed after the ticket was updated (PIP-008/S18) has already added its history entry and leaves "model" and "entries" in the record, which no longer match the history, so no recording uses them; the next start writes the record anew (S7). The entries test is a second guard there, behind that rewrite; S3's last step is the case where it alone decides.
- R3: A model is recorded, or remembered by `spec next`, only when it is 1 to 100 characters, each a printable ASCII character from U+0020 (space) to U+007E, so it is at most 100 bytes on one line and holds no control, separator or bidirectional character; every model name a harness reports today is such a text. A configured model is bounded as the config yields it, trimmed as before this ticket (" opus " is "opus"). A cost is recorded only when it is a finite number, 0 or more and below 1000000. Any other value counts as not reported. The same bounds hold for a model or cost already in a ticket file (PIP-020/R9).

## Out of scope
- How the stage is checked, recorded and committed, and its duration: PIP-008
- Which model `spec next` selects: CLI-007
- What `spec stats` shows from the records: PIP-020
