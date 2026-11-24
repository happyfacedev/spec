---
id: TKT-006
title: Answer a ticket's question
module: tickets
status: active
writes: [tickets.Ticket.questions, tickets.Ticket.status, tickets.Ticket.history]
provides: [tickets.TicketAnswer]
---
## Intent
A person answers a ticket's open question from the command line, wherever the ticket's live copy is (this tree, another worktree, an unmerged branch or a tracker). The answer stays on the question for the record, a blocked ticket goes back to open, and the person is told at once whether the ticket can start now.

## Behaviour
### S1: The answer is recorded and the ticket is ready again
Given "PROP-206" has one open blocker question Q1 and nothing else stops it, so `spec gate PROP-206` exits 1
When the developer runs `spec ticket answer PROP-206 Q1 yes, history follows the provider` through tickets.TicketAnswer
Then cli.CommandResult.stdout is "PROP-206#Q1 answered. PROP-206 is ready again." and a newline
And "tickets/PROP-206.md" holds Q1 with tickets.Question.answer "yes, history follows the provider" (R1)
And cli.CommandResult.exitCode is 0

### S2: Still not ready
Given "PROP-207" has open blocker questions Q1 and Q2
When the developer runs `spec ticket answer PROP-207 Q1 no` through tickets.TicketAnswer
Then cli.CommandResult.stdout is "PROP-207#Q1 answered. PROP-207 is still not ready; spec gate PROP-207 says why." and a newline
And cli.CommandResult.exitCode is 0

### S3: A blocked ticket goes back to open
Given "PROP-206" has tickets.Ticket.status "blocked" and an open question Q1
When the developer answers Q1 through tickets.TicketAnswer
Then tickets.Ticket.status is "open" (R2)

### S4: Other statuses are kept
Given "PROP-206" has tickets.Ticket.status "open" and an open question Q1
When the developer answers Q1 through tickets.TicketAnswer
Then tickets.Ticket.status stays "open" and only tickets.Ticket.questions changes (R2)

### S5: The question may be named with its ticket
Given "PROP-206" has a question Q1
When the developer runs `spec ticket answer PROP-206 PROP-206#Q1 yes` through tickets.TicketAnswer
Then Q1 gets tickets.Question.answer "yes"

### S6: A question on a spec unit
Given the feature "PRV-002" has a question Q1
When the developer runs `spec ticket answer PROP-206 PRV-002#Q1 x` through tickets.TicketAnswer
Then the command fails with tickets.UnitQuestion, and cli.CommandResult.stderr is "PRV-002#Q1 is a question on PRV-002, a spec unit: answer it in its spec file" and a newline (R3)
And cli.CommandResult.exitCode is 1

### S7: A question the ticket does not have
Given "PROP-206" has only the question Q1
When the developer runs `spec ticket answer PROP-206 Q9 x` through tickets.TicketAnswer
Then the command fails with tickets.UnknownQuestion, and cli.CommandResult.stderr is "PROP-206 has no question Q9; its questions: Q1" and a newline

### S8: A ticket with no questions
Given "TASK-101" has no questions
When the developer runs `spec ticket answer TASK-101 Q1 x` through tickets.TicketAnswer
Then the command fails with tickets.UnknownQuestion, and cli.CommandResult.stderr is "TASK-101 has no question Q1; its questions: none" and a newline

### S9: No answer given
Given "PROP-206" has a question Q1
When the developer runs `spec ticket answer PROP-206 Q1` through tickets.TicketAnswer
Then the command fails with cli.UsageError, and cli.CommandResult.stderr starts "usage: spec ticket answer <TICKET> <Q> <answer>"
And cli.CommandResult.exitCode is 2

### S10: An unknown ticket
Given the store holds "PROP-201", "PROP-202", "PROP-205" and "PROP-206"
When the developer runs `spec ticket answer PROP-20 Q1 x` through tickets.TicketAnswer
Then the command fails with tickets.UnknownTicket, and cli.CommandResult.stderr starts "Unknown PROP-20. Did you mean PROP-201?"
And cli.CommandResult.exitCode is 2

### S11: The JSON result
Given "PROP-206" has one open blocker question Q1 and nothing else stops it
When the developer runs `spec ticket answer PROP-206 Q1 yes --format json` through tickets.TicketAnswer
Then cli.CommandResult.stdout is a tickets.AnswerResult with tickets.AnswerResult.ticket "PROP-206", tickets.AnswerResult.question "Q1", tickets.AnswerResult.answer "yes" and tickets.AnswerResult.ready true

### S12: Answering a ticket that lives elsewhere
Given "BUG-301" runs in another worktree, or lives in a tracker, and has an open question Q1
When the developer answers Q1 through tickets.TicketAnswer from the main tree
Then the answer is written to the ticket's live copy, as every other ticket change is (R1)

### S13: The store refuses
Given tickets.StoreConfig is a tickets.CommandStore whose put refuses with "PROP-206 changed since it was read"
When the developer answers Q1 of "PROP-206" through tickets.TicketAnswer
Then the command fails with tickets.StoreRefused, and cli.CommandResult.stderr is "the tracker refused the update: PROP-206 changed since it was read" and a newline
And cli.CommandResult.exitCode is 1

### S14: An answered question is answered again
Given Q1 of "PROP-206" has tickets.Question.answer "yes"
When the developer runs `spec ticket answer PROP-206 Q1 no` through tickets.TicketAnswer
Then Q1's tickets.Question.answer is "no"

### S15: An answer sends the ticket back to an earlier stage
Given "PROP-206" is a proposal with tickets.Ticket.status "blocked", whose history is done "spec-writer", done "tester", then "implementer" blocked on its open blocker Q1 "The test for PRV-002/S3 expects the wrong status"
And the clock reads "2026-10-29T09:00:00.000Z"
When the developer runs `spec ticket answer PROP-206 Q1 the test is wrong --back tester` through tickets.TicketAnswer
Then cli.CommandResult.stdout is "PROP-206#Q1 answered. PROP-206 is ready again." then "next: tester", each line ending in a newline
And Q1 has tickets.Question.answer "the test is wrong" and tickets.Ticket.status is "open" (R1, R2)
And tickets.Ticket.history ends with the pipeline.StageRecord {at "2026-10-29T09:00:00.000Z", role "tester", result "reopened", summary "reopened by PROP-206#Q1", verdict null, assumed []} (R4)
And cli.CommandResult.exitCode is 0

### S16: The JSON result names the next stage
Given the ticket of S15
When the developer runs `spec ticket answer PROP-206 Q1 the test is wrong --back tester --format json` through tickets.TicketAnswer
Then cli.CommandResult.stdout is a tickets.AnswerResult with tickets.AnswerResult.answer "the test is wrong", tickets.AnswerResult.ready true and tickets.AnswerResult.next "tester"
And with no `--back`, tickets.AnswerResult has no tickets.AnswerResult.next and tickets.Ticket.history is unchanged (R4)

### S17: A role that has not run cannot be gone back to
Given "PROP-206" is a proposal whose history is done "spec-writer" and "tester", with "implementer" blocked
When the developer runs `spec ticket answer PROP-206 Q1 x --back reviewer` through tickets.TicketAnswer
Then the command fails with tickets.BackRefused, and cli.CommandResult.stderr is "PROP-206 has no finished reviewer stage to go back to; stages it has finished: spec-writer, tester" and a newline (R4)
And cli.CommandResult.exitCode is 1
And Q1 has no tickets.Question.answer and tickets.Ticket.history is unchanged

### S18: A role the ticket's type does not run
Given "TASK-101" is a task whose history is done "implementer"
When the developer runs `spec ticket answer TASK-101 Q1 x --back tester` through tickets.TicketAnswer
Then the command fails with tickets.BackRefused, and cli.CommandResult.stderr is "TASK-101 has no finished tester stage to go back to; stages it has finished: implementer" and a newline (R4)

### S19: An unknown role, or none
Given "PROP-206" has a question Q1
When the developer runs `spec ticket answer PROP-206 Q1 x --back boss` through tickets.TicketAnswer
Then the command fails with pipeline.UnknownRole, and cli.CommandResult.exitCode is 2
And `spec ticket answer PROP-206 Q1 x --back` fails with cli.UsageError and exit code 2

### S20: A stage is running
Given "PROP-206" has tickets.Ticket.status "in_progress" and tickets.Ticket.stage "tester", and a finished "spec-writer" stage
When the developer runs `spec ticket answer PROP-206 Q1 x --back spec-writer` through tickets.TicketAnswer
Then the command fails with tickets.BackRefused, and cli.CommandResult.stderr is "PROP-206 has its tester stage running; finish it before going back" and a newline (R4)
And Q1 has no tickets.Question.answer

## Rules
- R1: The answer is every word after the question ID, joined by single spaces and trimmed; it is written to the question's answer key in the ticket's live copy, and the question stays on the ticket
- R2: Answering moves a blocked ticket back to open, so the gate decides again; any other status is kept
- R3: Only the ticket's own questions are answered here; a question on a spec unit is answered in its spec file
- R4: With `--back <role>`, the role must have a finished stage in the ticket's history and no stage may be running; the answer then also adds a "reopened" entry for that role to the history, so that role's stage is the next one and the pipeline continues from it in order. Nothing changes when `--back` is refused. Without `--back`, the history is not touched

## Out of scope
- Answering questions on spec units: edit the unit's file
- Adding or removing questions: people edit the ticket; stages add blocker questions (pipeline)
