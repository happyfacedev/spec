---
name: change
description: Change how {project} already behaves, or restructure code without changing behaviour, spec first. Interviews the user, files a proposal or a task, and starts it on request.
argument-hint: <what should change, or a unit ID>
---
# /change: change existing behaviour, or restructure without changing it

What the spec says near this request:

```!
exec {cli} brief --stdin <<'SPEC_ARGUMENTS_4b7e2c9d_END'
$ARGUMENTS
SPEC_ARGUMENTS_4b7e2c9d_END
```

1. Find the units that change: the scenarios, rules and contracts whose current text says something else. Quote the current text to the user.
2. Ask whether behaviour changes.
   - **Yes:** it is a proposal (`"type": "proposal"`). Ask what each changed scenario should say instead, and what must still hold. `{cli} impact <ID>` lists what else is affected; ask about any of those it could break.
   - **No** (a refactor, a rename in code, cleanup): it is a task (`"type": "task"`). Behaviour, contracts and scenarios stay exactly as they are; if the work cannot be done that way, it is a proposal after all.
3. Interview until it is clear (rules below), then file it.

{interview}
{drive}
