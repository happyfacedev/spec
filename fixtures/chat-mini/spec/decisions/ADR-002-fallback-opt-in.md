---
id: ADR-002
title: Fallback is opt-in per workspace
status: accepted
---
## Decision
A workspace uses a fallback provider only when it sets one. With no fallback set, a rate-limited reply stops and the user is told when to retry. The app never picks a fallback on its own.

## Consequences
- The user decides which providers may see a conversation, so INV-001 holds without exceptions.
- Cost and data handling stay predictable: no reply silently moves to another provider.
- Some replies stop on a rate limit that a fallback could have finished.

## Context
Providers differ in price and in how the user's data is handled. A silent switch to another provider would surprise the user.

## Alternatives
- Always fall back to any enabled provider: rejected, the user did not choose that provider as a fallback.
- Fall back to the cheapest provider when none is set: rejected, same surprise, and it hides the rate limit.
