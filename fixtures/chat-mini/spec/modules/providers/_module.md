---
id: providers
prefix: PRV
domain: ai
status: active
---
Runs the fake model providers. It streams a reply from the active provider, counts tokens, and finishes the reply on the workspace's fallback provider when the active one rate-limits.

## Owns
- Provider configuration: which provider is active, which are enabled, and the fallback
- Streaming events and rate-limit handling
- Fallback behaviour and its limits

## Non-goals
- Storing messages (owned by `conversation`)
- Storing API keys (owned by `settings`)
