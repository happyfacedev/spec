---
id: SET-001
title: Enable providers
module: settings
status: active
writes: [providers.ProviderConfig]
observes: [conversation.ProviderDisabled]
invariants: [INV-001]
---
## Intent
Let the user choose which providers the workspace may use. A provider needs an API key to be enabled, and a disabled provider receives no new messages.

## Behaviour
### S1: Enable
Given settings.ApiKey exists for "gpt"
And providers.ProviderConfig does not list "gpt" as enabled
When the user enables "gpt"
Then providers.ProviderConfig lists "gpt" as enabled

### S2: Disable stops new messages to it
Given providers.ProviderConfig has "claude" as the active and enabled provider
When the user disables "claude"
Then providers.ProviderConfig no longer lists "claude" as enabled
And sending a message then fails with conversation.ProviderDisabled
And "claude" is never called (INV-001)

### S3: Enable without a key
Given no settings.ApiKey exists for "gpt"
When the user enables "gpt"
Then enabling fails with settings.MissingApiKey (R1)
And providers.ProviderConfig does not list "gpt" as enabled

## Rules
- R1: A provider needs an API key before it can be enabled

## Out of scope
- Choosing the active or fallback provider
- Ordering of providers in any list
