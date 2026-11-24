# Invariants

### INV-001: A conversation goes only to enabled providers
Applies to: providers.ProviderConfig.enabled
A provider that is not enabled in the workspace never receives any part of a conversation.
This holds for the active provider and for the fallback.

### INV-002: API keys never appear in logs, exports or error messages
Applies to: settings.ApiKey.secret
The secret part of an API key is used only to call its provider.
It is never written to a log line, an exported file or an error message.
