# Glossary

### Provider
A fake model backend that streams a reply for a conversation.
Aliases: providers

### Workspace
The scope that owns the provider settings, API keys and conversations of one user.
Aliases: workspaces

### Fallback
The one provider that finishes a reply when the active provider rate-limits, if the workspace has set one.

### Rate limit
A refusal by a provider to serve a request now, with a time after which to retry.
Aliases: rate-limit, rate-limits, rate-limited, rate limits

### Message
One entry in a conversation, with the same shape for every provider.
Aliases: messages
