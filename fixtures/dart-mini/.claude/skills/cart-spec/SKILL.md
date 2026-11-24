---
name: cart-spec
description: Source of truth for how cart behaves. Use before writing, building, testing or reviewing any change, with a role and a ticket or unit ID, a unit ID alone, or the words of a question.
argument-hint: [<spec-writer|tester|implementer|reviewer>] <ID> | <question words>
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/spec *)
---
!`${CLAUDE_SKILL_DIR}/scripts/spec brief '$0' '$1' --query '$ARGUMENTS'`
