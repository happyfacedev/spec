---
name: feature
description: Add new behaviour to {project}, spec first. Interviews the user until the change is clear, files a proposal ticket, and starts it on request. Use when the user wants something the software does not do yet.
argument-hint: <what the feature should do>
---
# /feature: new behaviour, spec first

What the spec says near this request:

```!
exec {cli} brief --stdin <<'SPEC_ARGUMENTS_4b7e2c9d_END'
$ARGUMENTS
SPEC_ARGUMENTS_4b7e2c9d_END
```

Turn the request into one proposal ticket. The spec changes first; tests and code follow it.

1. Find where it belongs. Which features does it extend, or which are closest when it is a new area? Which contracts does it read, change or add? The spec-writer adds new units later; the ticket names the existing ones it touches.
2. Interview the user until the behaviour is clear (rules below).
3. File the ticket with `"type": "proposal"`.

{interview}
{drive}
