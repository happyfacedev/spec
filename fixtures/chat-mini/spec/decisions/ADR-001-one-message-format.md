---
id: ADR-001
title: One message format for all providers
status: accepted
---
## Decision
Every provider produces and consumes the same message shape. Provider-specific details are translated at the edge of the provider and never stored on the message.

## Consequences
- A reply can move to another provider mid-conversation without conversion.
- Export, usage and stopping work the same for every provider.
- A new provider needs an adapter, but no change to the message.
- Delivery details that differ per reply live in one `meta` field with a fixed set of keys.

## Context
The app talks to several fake providers. Early drafts kept one message type per provider, which made fallback and export branch on the provider.

## Alternatives
- One message type per provider: rejected, every feature would branch on the provider.
- Store the raw provider payload next to the message: rejected, it leaks provider details into export and makes fallback harder.
