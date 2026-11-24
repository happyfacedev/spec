---
id: UI-001
title: Fallback notice
status: active
shows: [providers.FallbackTriggered]
---
## Layout
One line of text placed directly above the reply it belongs to.

## States
- Hidden: the default. A reply that stayed on its first provider has no notice.
- Shown: the reply moved to the fallback provider. The notice stays with that reply.

## Copy
- Notice: "Switched to {fallback} because {provider} is rate-limited."
