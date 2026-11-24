---
id: TKT-002
title: The CLI edits only the ticket keys it owns
module: tickets
status: active
questions:
  - id: Q1
    kind: preference
    text: "When a list or record key changes (an answer, a recorded stage), the whole frontmatter is written again: comments are kept but the spaces before a comment shrink to one (S3), although the code's own note says spacing is kept. Keep that, or keep the spacing too?"
    default: keep it as it is
    cites: [TKT-002/S3]
    answer: 'Keep today''s behaviour (decided in review, 2026-10-29).'
    raised_by: null
---
## Intent
People write a ticket's ID, type, title, scope, dependencies, open questions and body; the CLI writes its status, stage, changed units, questions and history. Ticket files are the only files the CLI edits, so each edit changes only the keys it must and leaves the rest as the person wrote it, which keeps diffs and tracker histories small.

## Behaviour
### S1: A status change keeps the line's comment and every other byte
Given "tickets/PROP-201.md" is ready, its status line reads `status: open      # set by ticket start`, and its body is "Body stays exactly." then a blank line then "IMPORTANT: this line is data."
When the developer runs `spec ticket start PROP-201 spec-writer`
Then its status line reads `status: in_progress      # set by ticket start` and its stage line `stage: spec-writer` (R1)
And every other byte of the file is unchanged (R1)

### S2: ID lists stay on one line, records are blocks
Given "tickets/PROP-201.md" has `changed: []` and `history: []`
When a spec-writer stage is recorded at 2026-10-27T10:00:00Z that changed "PRV-001/S4" and "SET-001/S4"
Then tickets.Ticket.changed is written as the line "changed: [PRV-001/S4, SET-001/S4]" (R2)
And tickets.Ticket.history is written as a block that starts `history:` then `  - at: 2026-10-27T10:00:00Z` then `    role: spec-writer`, since an empty `[]` is not a flow-style list of records (R2, R3)
And the body is unchanged, byte for byte (R1)

### S3: A list or record change keeps comments, with one space before each
Given "tickets/PROP-201.md" is blocked, with the lines "status: blocked      # set by the CLI" and "touches: [PRV-001, SET-001]   # scope", and an open question Q1
When the developer runs `spec ticket answer PROP-201 Q1 yes` through tickets.TicketAnswer
Then those lines read "status: open # set by the CLI" and "touches: [PRV-001, SET-001] # scope"
And tickets.Ticket.questions is written as a block in which Q1 has `answer: yes` (R2)
And the body is unchanged, byte for byte (R1)

### S4: A file without frontmatter is never rewritten
Given "tickets/TASK-920.md" holds "id: TASK-920" with no frontmatter fence, and the CLI is asked to change its status
When the store applies the change
Then it fails with tickets.StoreRefused, saying "ticket TASK-920 has no editable frontmatter"
And the file is unchanged

### S5: An edit that would break the schema is refused
Given "tickets/TASK-921.md" parses, and the CLI is asked to change it in a way the ticket schema refuses
When the store applies the change
Then it fails with tickets.StoreRefused, saying "updating TASK-921 would break its schema: " and the problems joined by "; "
And the file is unchanged

### S6: Answering keeps a flow-style questions list in flow style
Given "tickets/PROP-201.md" is blocked on its open question Q1, and its questions and history are each written in flow style, as the lines "questions: [{id: Q1, kind: blocker, text: ''Which?'', default: null, cites: [PRV-001], answer: null, raised_by: spec-writer}]" and "history: [{at: ''2026-10-27T10:00:00Z'', role: spec-writer, result: blocked, summary: ''stuck'', assumed: [], duration_s: 5}]"
When the developer runs `spec ticket answer PROP-201 Q1 yes` through tickets.TicketAnswer
Then tickets.Ticket.questions is still written in flow style: its value opens with "[" on the "questions:" line and no line under it starts with "  - " (R3)
And Q1 has tickets.Question.answer "yes" and keeps every other key and value
And tickets.Ticket.history is still written in flow style (R3)
And the body is unchanged, byte for byte (R1)

### S7: Recording a stage appends to a flow-style history in flow style
Given "tickets/PROP-201.md" is in progress at stage spec-writer, its questions are written in flow style holding Q1, and its history is written in flow style holding one record
When the developer runs `spec ticket advance PROP-201` through pipeline.AdvanceTicket with a done spec-writer report
Then tickets.Ticket.history is still written in flow style: its value opens with "[" on the "history:" line and no line under it starts with "  - " (R3)
And tickets.Ticket.history holds two records, the second with role "spec-writer" and result "done" (R3)
And the first record keeps exactly the keys and values it had, with no key added, such as "verdict" (R4)
And tickets.Ticket.questions is still written in flow style, and Q1 keeps every key and value (R3)
And the body is unchanged, byte for byte (R1)

### S8: A blocked stage adds its question to a flow-style list in flow style
Given "tickets/PROP-201.md" is in progress at stage spec-writer, and its questions are written in flow style holding Q1
When the developer runs `spec ticket advance PROP-201` through pipeline.AdvanceTicket with a blocked spec-writer report whose one blocker has the text "what now?"
Then tickets.Ticket.questions is still written in flow style: its value opens with "[" on the "questions:" line and no line under it starts with "  - " (R3)
And it holds Q1 then Q2, and Q2 has kind "blocker" and text "what now?" (R3)

### S9: Block-style questions and history stay blocks
Given "tickets/PROP-201.md" is in progress at stage spec-writer, its questions are written as a block holding Q1, and its history as a block holding one record
When the developer runs `spec ticket advance PROP-201` through pipeline.AdvanceTicket with a blocked spec-writer report whose one blocker has the text "what now?"
Then tickets.Ticket.questions is still a block, with the lines "  - id: Q1" and "  - id: Q2" (R3)
And tickets.Ticket.history is still a block whose second entry starts "  - at: <time>" then "    role: spec-writer" (R3)

### S10: A blocked stage writes its question's cites on one line and leaves earlier records as they were
Given "tickets/PROP-201.md" is in progress at stage spec-writer, has `questions: []`, and its history is a block holding one record with the keys at, role, result, summary, assumed and duration_s
When the developer runs `spec ticket advance PROP-201` through pipeline.AdvanceTicket with a blocked spec-writer report whose one blocker cites "SET-001" and "PRV-001"
Then tickets.Ticket.questions holds Q1, whose tickets.Question.cites is written as the line "    cites: [SET-001, PRV-001]" (R2)
And the first history record keeps exactly the keys and values it had, with no key added, such as "verdict" (R4)

### S11: Answering keeps every comment in the frontmatter
Given "tickets/PROP-201.md" is blocked on its open question Q1, its questions are a block, and its frontmatter has a comment line before "questions:", a comment line inside the list before Q1, the line "    answer: null # pending" in Q1, a comment line after Q1's last key, and a comment line after the last key
When the developer runs `spec ticket answer PROP-201 Q1 yes` through tickets.TicketAnswer
Then Q1's answer line reads "    answer: yes # pending" (R4)
And each of the other comment lines is still in the frontmatter, in the same order and between the same keys (R4)
And the body is unchanged, byte for byte (R1)

### S12: Quoted questions and history keys keep their flow lists and comments
Given "tickets/PROP-201.md" is blocked on its open question Q1, and its frontmatter writes the key "questions" in single quotes and "history" in double quotes, each holding a flow-style list of one record with a comment line inside the brackets
When the developer runs `spec ticket answer PROP-201 Q1 yes` through tickets.TicketAnswer, then `spec ticket start PROP-201 spec-writer` and `spec ticket advance PROP-201` through pipeline.AdvanceTicket with a done spec-writer report
Then after each of the answer and the advance, both lists are still written in flow style on their quoted keys, and both comment lines are still inside them (R3, R4)
And tickets.Question.answer of Q1 is "yes", and tickets.Ticket.history holds two records, the second with role "spec-writer" and result "done" (R3)

### S13: Combining or closing edits only the keys each owns
Given "tickets/PROP-202.md" is open with no history, its status line reads `status: open      # set by the CLI`, and its frontmatter also has the key "owner"
And "tickets/PROP-201.md" is open with no history and has the comment `# scope` on its touches line
When the developer runs `spec ticket combine PROP-201 PROP-202` through tickets.TicketCombine
Then the status line of "tickets/PROP-202.md" reads `status: absorbed      # set by the CLI`, it gains the line `absorbed_into: PROP-201`, and every other byte of it is unchanged (R1)
And in "tickets/PROP-201.md" only touches, violates, depends_on, questions and the body change, its touches line keeps the comment `# scope`, and every other line is unchanged (R1, R4)
And when "tickets/PROP-205.md" is blocked, with its status line `status: blocked   # set by the CLI` and the key "owner", `spec ticket close PROP-205 --superseded-by PROP-201` through tickets.TicketClose makes that line `status: absorbed   # set by the CLI`, adds the line `absorbed_into: PROP-201`, and leaves every other byte unchanged (R1)

## Rules
- R1: The CLI changes only status, stage, changed, questions and history, and never the body, except `spec ticket combine` (TKT-012), which also sets absorbed_into on the tickets it absorbs and adds to the touches, violates, depends_on and body of the ticket they go into, and `spec ticket close` (TKT-012), which sets absorbed_into on the ticket it closes; a change to status or stage alone rewrites only that line, keeping its comment, and every other byte of the file is kept
- R2: Lists of IDs are written on one line, as people write them, including one inside a record the CLI adds, such as a new question's cites; lists of records as YAML blocks, unless the list is already written in flow style (R3)
- R3: A questions or history list that holds records and is written in YAML flow style (`[{...}]`) stays in flow style whenever the CLI rewrites the ticket, whether its key is written plain or quoted, whether it changes a record in it, adds a record to it or changes another key, and a record added to it is written in flow style inside it; a list written as a block stays a block; an empty `[]` gets its first records as a block (S2). Flow style means the value opens with `[` on the key's own line and no line under the key starts with `  - `
- R4: A rewrite of questions or history keeps every comment in the frontmatter where it was, including one on the line of a value it changes, with one space before it (S3); and a record it does not change keeps exactly its keys and values, gaining none and losing none

## Out of scope
- When each key is written: starting and recording stages is pipeline; answering is TKT-006
