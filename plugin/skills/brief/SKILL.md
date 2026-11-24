---
name: brief
description: Source of truth for how this project behaves. Use before writing, building, testing or reviewing any change, with a role and a ticket or unit ID, a unit ID alone, or the words of a question.
argument-hint: [<spec-writer|spec-review|tester|implementer|reviewer>] <ID> | <question words>
allowed-tools: Bash(.spec/bin/spec *), Bash(exec .spec/bin/spec brief --stdin *)
---

If `.spec/bin/spec` is missing, ask Claude to run `/spec:spec` to set up this project.

```!
exec .spec/bin/spec brief --stdin <<'SPEC_ARGUMENTS_4b7e2c9d_END'
$ARGUMENTS
SPEC_ARGUMENTS_4b7e2c9d_END
```
