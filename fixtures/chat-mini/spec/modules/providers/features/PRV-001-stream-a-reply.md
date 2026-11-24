---
id: PRV-001
title: Stream a reply from the active provider
module: providers
status: active
writes: [conversation.Message.content]
provides: [providers.StreamReply]
invariants: [INV-002]
---
## Intent
Send the conversation to the active provider and stream its reply into the reply message chunk by chunk, so the user sees text early and a rate limit is reported instead of hidden.

## Behaviour
### S1: Streams tokens
Given providers.ProviderConfig has "claude" as the active and enabled provider
And settings.ApiKey for "claude" is "sk-claude-secret"
When providers.StreamReply runs for a message and "claude" streams "Hel" then "lo"
Then "claude" is called with the key "sk-claude-secret"
And providers.TokenStreamed is emitted twice, with "Hel" then "lo"
And the reply's conversation.Message.content is "Hello"

### S2: Provider rate-limits
Given providers.ProviderConfig has "claude" as the active and enabled provider and no fallback
When "claude" streams "Hel" then rate-limits with a retry delay of 500 ms
Then providers.RateLimited is emitted with providerId "claude" and retryAfterMs 500
And the reply's conversation.Message.content stays "Hel"

### S3: The key never reaches the log
Given providers.ProviderConfig has "claude" as the active and enabled provider
And settings.ApiKey for "claude" is "sk-claude-secret"
When the user sends a message and "claude" streams a reply
Then no line of the app log contains "sk-claude-secret" (INV-002)

## Rules
None

## Out of scope
- Moving the reply to another provider (PRV-002)
