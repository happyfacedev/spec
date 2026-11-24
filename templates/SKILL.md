---
name: {project}-spec
description: Source of truth for how {project} behaves. Use before writing, building, testing or reviewing any change, with a role and a ticket or unit ID, a unit ID alone, or the words of a question.
argument-hint: [<spec-writer|spec-review|tester|implementer|reviewer>] <ID> | <question words>
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/spec *), Bash(exec ${CLAUDE_SKILL_DIR}/scripts/spec brief --stdin *)
---
```!
exec ${CLAUDE_SKILL_DIR}/scripts/spec brief --stdin <<'SPEC_ARGUMENTS_4b7e2c9d_END'
$ARGUMENTS
SPEC_ARGUMENTS_4b7e2c9d_END
```
