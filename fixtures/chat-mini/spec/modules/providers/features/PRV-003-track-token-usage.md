---
id: PRV-003
title: Track token usage per message
module: providers
status: active
writes: [conversation.Message.usage]
---
## Intent
Record how many tokens each reply used, so usage can be shown per message.

## Behaviour
### S1: Usage recorded at the end of a reply
Given providers.ProviderConfig has "claude" as the active and enabled provider
When "claude" finishes a reply reporting 12 input tokens and 3 output tokens
Then the reply's conversation.Message.usage records inputTokens = 12 and outputTokens = 3

## Rules
None

## Out of scope
- Usage of a reply that did not finish
- Cost in money
- Totals across a conversation
