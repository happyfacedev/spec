---
name: base-spec
description: Source of truth for how base behaves. Use before writing, building, testing or reviewing any change, with a role and a ticket or unit ID.
argument-hint: <spec-writer|tester|implementer|reviewer> <ID>
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/spec *)
---
!`${CLAUDE_SKILL_DIR}/scripts/spec brief '$0' '$1'`
