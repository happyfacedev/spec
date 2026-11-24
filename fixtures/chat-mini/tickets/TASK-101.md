---
id: TASK-101
type: task
title: Extract provider selection into its own module
status: open
stage: null
touches: [PRV-001, PRV-002]
violates: []
changed: []
questions: []
history: []
---
The code that picks which provider handles a request is spread over the streaming and fallback code.
Move it into its own module under src/providers and call it from both places.
This is a refactor. Behaviour must stay exactly the same.
