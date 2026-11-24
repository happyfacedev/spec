# conversation contracts

### conversation.MessageId
Kind: type · Status: active
Identifies one message in a conversation. Type: string

### conversation.Message
Kind: entity · Status: active
One message, same shape for every provider.
Decisions: ADR-001

#### conversation.Message.id
Identifies the message. Type: conversation.MessageId

#### conversation.Message.content
The text of the message. Type: string

#### conversation.Message.meta
Delivery details. Type: conversation.DeliveryMeta

#### conversation.Message.usage
Token counts for the reply, null until the reply finishes. Type: conversation.Usage | null

### conversation.DeliveryMeta
Kind: type · Status: active
How a reply was delivered. A member that does not apply is left out.

#### conversation.DeliveryMeta.fallbackFrom
The provider that rate-limited before the fallback finished the reply. Type: providers.ProviderId?

#### conversation.DeliveryMeta.stopReason
Why the reply stopped. Type: ("done" | "user" | "rate_limited")?

#### conversation.DeliveryMeta.retryAfterMs
How long the provider asked callers to wait, in milliseconds. Type: int?

### conversation.Usage
Kind: type · Status: active
The tokens one reply used.

#### conversation.Usage.inputTokens
Tokens sent to the provider. Type: int

#### conversation.Usage.outputTokens
Tokens the provider returned. Type: int

### conversation.ProviderDisabled
Kind: error · Status: active
Sending failed: the active provider is not enabled in the workspace. Its text never holds key material.
