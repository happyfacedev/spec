---
id: PROP-201
type: proposal
title: 'Add a "gemini" fake provider'
status: open
stage: null
touches: [providers.ProviderId, PRV-001, SET-001]
violates: []
changed: []
questions: []
history: []
---
Add a new fake provider called "gemini" next to the existing ones.
It should be selectable as the active provider and usable as a fallback.
It streams tokens, rate-limits and finishes like the other fake providers.
The user can enable it in settings and add an API key for it.
