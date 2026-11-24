---
id: PRV-002
title: Fall back when a provider rate-limits
module: providers
status: active
writes: [conversation.Message.meta]
invariants: [INV-001]
decisions: [ADR-002]
ui: [UI-001]
---
## Intent
When the active provider rate-limits, finish the reply on the workspace's fallback provider so long tasks are not interrupted. When there is no usable fallback, stop the reply and record when to retry.

## Behaviour
### S1: Fallback enabled
Given providers.ProviderConfig has "claude" active, "claude" and "gpt" enabled, and "gpt" as fallback
When "claude" emits providers.RateLimited before streaming any text
Then "gpt" is called with the same messages as "claude"
And conversation.Message.meta records fallbackFrom = "claude"
And providers.FallbackTriggered is emitted with from "claude" and to "gpt"
And UI-001 is shown with the text "Switched to gpt because claude is rate-limited."

### S2: Fallback disabled
Given providers.ProviderConfig has "claude" active, "claude" and "gpt" enabled, and no fallback
When "claude" emits providers.RateLimited with retryAfterMs 500
Then the reply stops
And conversation.Message.meta records stopReason = "rate_limited" and retryAfterMs = 500
And "gpt" is never called

### S3: Fallback provider also rate-limits
Given providers.ProviderConfig has "claude" active, "claude", "gpt" and "mistral" enabled, and "gpt" as fallback
When "claude" emits providers.RateLimited with retryAfterMs 500
And "gpt" then emits providers.RateLimited with retryAfterMs 800
Then the reply stops
And conversation.Message.meta is fallbackFrom = "claude", stopReason = "rate_limited" and retryAfterMs = 800
And "mistral" is never called (R2)

### S4: Fallback provider not enabled
Given providers.ProviderConfig has "claude" active, only "claude" enabled, and "gpt" as fallback
When "claude" emits providers.RateLimited with retryAfterMs 500
Then the reply stops
And conversation.Message.meta records stopReason = "rate_limited" and retryAfterMs = 500
And "gpt" is never called (INV-001, R1)

## Rules
- R1: The fallback is used only when it is enabled in this workspace (INV-001)
- R2: One fallback per reply. No chains.

## Out of scope
- Picking a fallback provider automatically (ADR-002)
- Retrying the same provider after the delay
