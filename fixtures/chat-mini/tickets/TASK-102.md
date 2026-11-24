---
id: TASK-102
type: task
title: Record which provider produced each message
status: open
stage: null
touches: [conversation.Message.meta, PRV-002, CNV-002]
violates: []
changed: []
questions: []
history: []
---
We want each message to record which provider produced it.
When a reply finishes, or is stopped, the message should say which provider wrote it.
After a fallback it should name the provider that finished the reply.
Show the value in the debug view of the conversation.
