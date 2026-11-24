---
id: CNV-001
title: Send a message
module: conversation
status: active
observes: [settings.ApiKey]
writes: [conversation.Message.content]
invariants: [INV-001, INV-002]
---
## Intent
Let the user send a message and hand the conversation to the active provider, but only when that provider is enabled in the workspace.

## Behaviour
### S1: Send to active provider
Given providers.ProviderConfig has "claude" as the active and enabled provider
When the user sends "Hello"
Then providers.StreamReply runs on "claude" with the messages ["Hello"]
And the user's conversation.Message.content is "Hello"

### S2: Active provider disabled
Given providers.ProviderConfig has "claude" as the active provider but "claude" is not enabled
And settings.ApiKey for "claude" is "sk-claude-secret"
When the user sends "Hello"
Then the send fails with conversation.ProviderDisabled
And "claude" is never called (INV-001)
And no conversation.Message is added
And the error text does not contain "sk-claude-secret" (INV-002)

## Rules
None

## Out of scope
- Attachments
