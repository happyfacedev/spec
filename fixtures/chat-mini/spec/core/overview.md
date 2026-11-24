# chat-mini

## Purpose
chat-mini is a small chat app with fake model providers. A user sends messages, a provider streams the reply, and a workspace decides which providers are enabled and whether a fallback is used when a provider rate-limits.

## Actors
- User: sends messages, stops replies, exports conversations and manages settings.
- Provider: a fake model provider that streams tokens, rate-limits or finishes, driven by a script.
