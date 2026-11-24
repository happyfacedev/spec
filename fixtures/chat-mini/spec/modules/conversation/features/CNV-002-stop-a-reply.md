---
id: CNV-002
title: Stop a reply mid-stream
module: conversation
status: active
writes: [conversation.Message.content, conversation.Message.meta]
---
## Intent
Let the user stop a reply that is still streaming, keep what has arrived, and record that the user stopped it.

## Behaviour
### S1: Partial reply kept
Given "claude" is streaming "Hel", "lo" and " world"
When the user stops the reply right after providers.TokenStreamed delivers "Hel"
Then the reply's conversation.Message.content is "Hel"
And providers.TokenStreamed is not emitted again

### S2: Stop reason recorded
Given "claude" is streaming a reply
When the user stops the reply
Then the reply's conversation.Message.meta records stopReason = "user"

## Rules
None

## Out of scope
- Resuming a stopped reply
