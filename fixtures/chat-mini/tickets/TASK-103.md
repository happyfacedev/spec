---
id: TASK-103
type: task
title: Simplify the fallback code
status: open
stage: null
touches: [PRV-002]
violates: []
changed: []
questions: []
history: []
---
The fallback code has grown several nested branches and is hard to read.
Flatten it into a few small functions with early returns.
To make it shorter, if no fallback is set, just pick the cheapest provider instead of stopping the reply.
Keep the rest of the behaviour the same.
