# providers contracts

### providers.ProviderId
Kind: type · Status: active
Names one fake provider. Type: "claude" | "gpt" | "mistral"

### providers.ProviderConfig
Kind: entity · Status: active
The provider settings of one workspace: which provider is active, which are enabled, and the optional fallback.
Decisions: ADR-002

#### providers.ProviderConfig.active
The provider that receives new messages. Type: providers.ProviderId

#### providers.ProviderConfig.enabled
The providers the workspace allows. Type: providers.ProviderId[]

#### providers.ProviderConfig.fallback
The provider that finishes a reply when the active one rate-limits, or none. Type: providers.ProviderId | null

### providers.StreamReply
Kind: operation · Status: active
Streams a reply to a conversation from the active provider into its reply message.
Code: streamReply
Output: null

#### providers.StreamReply.messages
The conversation so far, oldest first. Type: string[]

### providers.TokenStreamed
Kind: event · Status: active
A chunk of reply text arrived from the provider.

#### providers.TokenStreamed.messageId
The reply the text belongs to. Type: conversation.MessageId

#### providers.TokenStreamed.text
The chunk of text. Type: string

### providers.RateLimited
Kind: event · Status: active
The provider refused a request because of rate limits.

#### providers.RateLimited.providerId
The provider that refused. Type: providers.ProviderId

#### providers.RateLimited.retryAfterMs
How long the provider asks callers to wait, in milliseconds. Type: int

### providers.FallbackTriggered
Kind: event · Status: active
A reply moved from one provider to the fallback provider.

#### providers.FallbackTriggered.messageId
The reply that moved. Type: conversation.MessageId

#### providers.FallbackTriggered.from
The provider that rate-limited. Type: providers.ProviderId

#### providers.FallbackTriggered.to
The fallback provider that finishes the reply. Type: providers.ProviderId
