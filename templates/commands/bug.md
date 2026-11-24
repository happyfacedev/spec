---
name: bug
description: Report that {project} does not do what its spec says. Finds the scenario the code breaks, files a bug ticket, and starts it on request. If no scenario describes the expected behaviour, it is a feature, not a bug.
argument-hint: <what goes wrong, or the scenario ID>
---
# /bug: the code breaks a scenario

What the spec says near this report:

```!
exec {cli} brief --stdin <<'SPEC_ARGUMENTS_4b7e2c9d_END'
$ARGUMENTS
SPEC_ARGUMENTS_4b7e2c9d_END
```

A bug means the code does something a scenario says it must not. The spec does not change; the code is fixed.

1. Find the scenario the code violates. Quote its steps to the user and confirm: "this is what should happen, and it does not?"
2. If no scenario describes the expected behaviour, it is not a bug: the spec is silent. Say so, and offer `/feature` (new behaviour) or `/change` (different behaviour) instead. Do not file a bug.
3. Ask only for what the scenario does not already pin down, such as the exact input that fails. The tester writes the failing test from the scenario.
4. File it with `"type": "bug"`, `"violates": [the scenario IDs]`, and `"touches": []`.

{interview}
{drive}
